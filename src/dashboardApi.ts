/**
 * MCP Swarm Dashboard API Server
 * 
 * Запускается параллельно с MCP сервером и предоставляет HTTP API
 * для веб-дашборда. Читает данные из .swarm/ директории.
 */

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const PORT = parseInt(process.env.DASHBOARD_API_PORT || "3334", 10);
const REPO_PATH = process.env.SWARM_REPO_PATH || process.cwd();

// CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// Helper: read JSON file
async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Helper: list JSON files in directory
async function listJsonFiles(dirPath: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dirPath);
    return files.filter(f => f.endsWith(".json"));
  } catch {
    return [];
  }
}

// Get orchestrator info
async function getOrchestratorInfo(repoPath: string) {
  const orchestratorPath = path.join(repoPath, ".swarm", "ORCHESTRATOR.json");
  const state = await readJson<{
    orchestratorId: string | null;
    orchestratorName: string | null;
    orchestratorPlatform: string | null;
    electedAt: number | null;
    lastHeartbeat: number;
    executors: Array<{
      agentId: string;
      agentName: string;
      platform: string;
      registeredAt: number;
      lastSeen: number;
      status: string;
      currentTask: string | null;
    }>;
    isRunning: boolean;
    loopMode: string;
  }>(orchestratorPath);
  
  if (!state) {
    return { hasOrchestrator: false };
  }
  
  const now = Date.now();
  const isAlive = state.isRunning && (now - state.lastHeartbeat) < 60000;
  
  return {
    hasOrchestrator: !!state.orchestratorId,
    orchestratorName: state.orchestratorName,
    orchestratorPlatform: state.orchestratorPlatform,
    isAlive,
    lastHeartbeat: state.lastHeartbeat,
    electedAt: state.electedAt,
    loopMode: state.loopMode,
    executors: state.executors.map(e => ({
      ...e,
      status: (now - e.lastSeen) > 60000 ? "dead" : e.status,
    })),
  };
}

// Get all agents
async function getAgents(repoPath: string) {
  const info = await getOrchestratorInfo(repoPath);
  const agents = [];
  
  if (info.hasOrchestrator && info.orchestratorName) {
    agents.push({
      id: "orchestrator",
      name: info.orchestratorName,
      platform: info.orchestratorPlatform,
      status: info.isAlive ? "active" : "dead",
      role: "orchestrator",
      currentTask: "Координация задач",
      lastSeen: info.lastHeartbeat,
      registeredAt: info.electedAt,
    });
  }
  
  if (info.executors) {
    for (const exec of info.executors) {
      agents.push({
        id: exec.agentId,
        name: exec.agentName,
        platform: exec.platform,
        status: exec.status,
        role: "executor",
        currentTask: exec.currentTask,
        lastSeen: exec.lastSeen,
        registeredAt: exec.registeredAt,
      });
    }
  }
  
  return agents;
}

// Get tasks
async function getTasks(repoPath: string) {
  const tasksPath = path.join(repoPath, "swarm", "tasks", "TASKS.json");
  const tasks = await readJson<Array<{
    id: string;
    title: string;
    status: string;
    assignee?: string;
    priority?: string;
    createdAt?: number;
  }>>(tasksPath);
  
  return tasks || [];
}

// Get messages
async function getMessages(repoPath: string, limit = 20) {
  const messagesDir = path.join(repoPath, ".swarm", "messages");
  const files = await listJsonFiles(messagesDir);
  
  const messages = [];
  for (const file of files.slice(-limit)) {
    const msg = await readJson<{
      id: string;
      from: string;
      to: string;
      subject: string;
      importance: string;
      ts: number;
      acknowledged: boolean;
    }>(path.join(messagesDir, file));
    if (msg) messages.push(msg);
  }
  
  return messages.sort((a, b) => b.ts - a.ts);
}

// Get file locks
async function getFileLocks(repoPath: string) {
  const locksPath = path.join(repoPath, "swarm", "FILE_LOCKS.json");
  const locks = await readJson<Record<string, {
    agent: string;
    exclusive: boolean;
    ts: number;
  }>>(locksPath);
  
  return locks || {};
}

// Get swarm stats
async function getStats(repoPath: string) {
  const agents = await getAgents(repoPath);
  const tasks = await getTasks(repoPath);
  const messages = await getMessages(repoPath, 1000);
  const info = await getOrchestratorInfo(repoPath);
  
  const activeAgents = agents.filter(a => a.status === "active").length;
  const deadAgents = agents.filter(a => a.status === "dead").length;
  const pendingTasks = tasks.filter(t => t.status === "pending").length;
  const completedTasks = tasks.filter(t => t.status === "done").length;
  const unreadMessages = messages.filter(m => !m.acknowledged).length;
  
  // Memory usage (approximation)
  const memUsage = process.memoryUsage();
  const memoryUsage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
  
  // Uptime
  const uptime = info.electedAt ? Date.now() - info.electedAt : 0;
  
  return {
    totalAgents: agents.length,
    activeAgents,
    deadAgents,
    totalTasks: tasks.length,
    pendingTasks,
    completedTasks,
    totalMessages: messages.length,
    unreadMessages,
    orchestratorName: info.orchestratorName,
    orchestratorAlive: info.isAlive,
    lastHeartbeat: info.lastHeartbeat,
    memoryUsage,
    uptime,
  };
}

// Get expertise map (Smart Routing)
async function getExpertise(repoPath: string) {
  const expertisePath = path.join(repoPath, ".swarm", "EXPERTISE.json");
  const expertise = await readJson<{
    agents: Record<string, {
      agentName: string;
      fileEdits: Record<string, number>;
      folderEdits: Record<string, number>;
      totalEdits: number;
    }>;
  }>(expertisePath);
  
  if (!expertise) return { agents: [] };
  
  return {
    agents: Object.values(expertise.agents).map(a => ({
      name: a.agentName,
      totalEdits: a.totalEdits,
      topFiles: Object.entries(a.fileEdits)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 5)
        .map(([file, count]) => ({ file, count })),
      topFolders: Object.entries(a.folderEdits)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 5)
        .map(([folder, count]) => ({ folder, count })),
    })),
  };
}

// Get context notes (Context Pool)
async function getContextPool(repoPath: string) {
  const indexPath = path.join(repoPath, ".swarm", "context", "INDEX.json");
  const index = await readJson<{
    notes: Record<string, {
      id: string;
      targetPath: string;
      summary: string;
      author: string;
      tags: string[];
      helpful: number;
      stale: boolean;
      createdAt: number;
    }>;
  }>(indexPath);
  
  if (!index) return { notes: [], stats: { total: 0, stale: 0, helpful: 0 } };
  
  const notes = Object.values(index.notes);
  const stale = notes.filter(n => n.stale).length;
  const totalHelpful = notes.reduce((sum, n) => sum + n.helpful, 0);
  
  return {
    notes: notes.slice(-50).map(n => ({
      id: n.id,
      path: n.targetPath,
      summary: n.summary,
      author: n.author,
      tags: n.tags,
      helpful: n.helpful,
      stale: n.stale,
      createdAt: n.createdAt,
    })),
    stats: {
      total: notes.length,
      stale,
      helpful: totalHelpful,
    },
  };
}

// Get reviews (Auto Review)
async function getReviews(repoPath: string) {
  const indexPath = path.join(repoPath, ".swarm", "reviews", "INDEX.json");
  const index = await readJson<{
    reviews: Record<string, {
      id: string;
      taskId: string;
      taskTitle: string;
      codeAuthor: string;
      reviewer: string | null;
      status: string;
      changedFiles: string[];
      comments: Array<{ severity: string; resolved: boolean }>;
      createdAt: number;
    }>;
  }>(indexPath);
  
  if (!index) return { reviews: [], stats: { total: 0, pending: 0, approved: 0 } };
  
  const reviews = Object.values(index.reviews);
  const pending = reviews.filter(r => r.status === "pending" || r.status === "in_progress").length;
  const approved = reviews.filter(r => r.status === "approved").length;
  
  return {
    reviews: reviews.slice(-20).map(r => ({
      id: r.id,
      taskId: r.taskId,
      taskTitle: r.taskTitle,
      author: r.codeAuthor,
      reviewer: r.reviewer,
      status: r.status,
      filesCount: r.changedFiles.length,
      commentsCount: r.comments.length,
      blockersCount: r.comments.filter(c => c.severity === "blocker" && !c.resolved).length,
      createdAt: r.createdAt,
    })),
    stats: {
      total: reviews.length,
      pending,
      approved,
    },
  };
}

// Get budget status (Cost Optimization)
async function getBudget(repoPath: string) {
  const budgetPath = path.join(repoPath, ".swarm", "cost", "budget.json");
  const usagePath = path.join(repoPath, ".swarm", "cost", "usage.json");
  
  const budget = await readJson<{
    dailyLimit: number;
    weeklyLimit: number;
    monthlyLimit: number;
  }>(budgetPath);
  
  const usage = await readJson<Array<{
    cost: number;
    timestamp: string;
    model: string;
    tier: string;
  }>>(usagePath);
  
  if (!budget) {
    return {
      configured: false,
      limits: { daily: 10, weekly: 50, monthly: 150 },
      usage: { daily: 0, weekly: 0, monthly: 0 },
    };
  }
  
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  const records = usage || [];
  const dailyUsage = records.filter(r => r.timestamp >= dayStart).reduce((s, r) => s + r.cost, 0);
  const weeklyUsage = records.filter(r => r.timestamp >= weekStart).reduce((s, r) => s + r.cost, 0);
  const monthlyUsage = records.filter(r => r.timestamp >= monthStart).reduce((s, r) => s + r.cost, 0);
  
  return {
    configured: true,
    limits: {
      daily: budget.dailyLimit,
      weekly: budget.weeklyLimit,
      monthly: budget.monthlyLimit,
    },
    usage: {
      daily: dailyUsage,
      weekly: weeklyUsage,
      monthly: monthlyUsage,
    },
    byModel: records.reduce((acc, r) => {
      acc[r.model] = (acc[r.model] || 0) + r.cost;
      return acc;
    }, {} as Record<string, number>),
  };
}

// Get sync status (External Sync)
async function getSyncStatus(repoPath: string) {
  const configPath = path.join(repoPath, ".swarm", "sync", "config.json");
  const issuesPath = path.join(repoPath, ".swarm", "sync", "issues.json");
  
  const config = await readJson<{
    github?: { enabled: boolean; owner: string; repo: string };
    linear?: { enabled: boolean; teamId: string };
  }>(configPath);
  
  const issues = await readJson<Array<{
    source: string;
    state: string;
  }>>(issuesPath);
  
  return {
    github: config?.github || { enabled: false },
    linear: config?.linear || { enabled: false },
    issues: {
      total: issues?.length || 0,
      open: issues?.filter(i => i.state === "open").length || 0,
      github: issues?.filter(i => i.source === "github").length || 0,
      linear: issues?.filter(i => i.source === "linear").length || 0,
    },
  };
}

// Get Telegram config
async function getTelegramConfig(repoPath: string) {
  const configPath = path.join(repoPath, ".swarm", "telegram.json");
  
  const config = await readJson<{
    enabled: boolean;
    chatId: string;
    notifyOn: {
      taskCreated: boolean;
      taskCompleted: boolean;
      taskFailed: boolean;
      agentJoined: boolean;
      agentDied: boolean;
      ciError: boolean;
      reviewRequested: boolean;
      votingStarted: boolean;
    };
  }>(configPath);
  
  const hasToken = !!process.env.TELEGRAM_BOT_TOKEN;
  
  return {
    enabled: config?.enabled || false,
    configured: hasToken && !!config?.chatId,
    hasToken,
    hasChatId: !!config?.chatId,
    notifyOn: config?.notifyOn || {
      taskCreated: true,
      taskCompleted: true,
      taskFailed: true,
      agentJoined: true,
      agentDied: true,
      ciError: true,
      reviewRequested: true,
      votingStarted: true,
    },
    setupInstructions: !hasToken ? {
      step1: "Create a bot via @BotFather in Telegram",
      step2: "Set TELEGRAM_BOT_TOKEN environment variable",
      step3: "Get your chat ID (send /start to @userinfobot)",
      step4: "Configure chatId in .swarm/telegram.json or via swarm_telegram tool",
    } : null,
  };
}

// Get SONA stats (Self-Optimizing Neural Architecture)
async function getSONAStats(repoPath: string) {
  const modelPath = path.join(repoPath, ".swarm", "sona", "model.json");
  const historyPath = path.join(repoPath, ".swarm", "sona", "history.json");
  
  const model = await readJson<{
    version: string;
    agents: Record<string, {
      agentName: string;
      overallScore: number;
      totalTasks: number;
      lastActive: number;
      specializations: string[];
      categories: Record<string, {
        successRate: number;
        avgQuality: number;
        taskCount: number;
        confidence: number;
      }>;
    }>;
    globalStats: {
      totalTasks: number;
      avgSuccessRate: number;
      avgQuality: number;
      lastUpdated: number;
    };
    config: {
      enabled: boolean;
      autoLearn: boolean;
      explorationRate: number;
      learningRate: number;
    };
  }>(modelPath);
  
  const history = await readJson<Array<{
    taskId: string;
    agentName: string;
    category: string;
    success: boolean;
    qualityScore: number;
    timestamp: number;
  }>>(historyPath);
  
  if (!model) {
    return {
      enabled: false,
      configured: false,
      message: "SONA not initialized. Use swarm_sona({ action: 'route', ... }) to start learning.",
    };
  }
  
  // Calculate category distribution
  const categoryDistribution: Record<string, number> = {};
  if (history) {
    for (const h of history) {
      categoryDistribution[h.category] = (categoryDistribution[h.category] || 0) + 1;
    }
  }
  
  // Top performers
  const topAgents = Object.values(model.agents)
    .map(a => ({
      name: a.agentName,
      score: Math.round(a.overallScore * 100),
      tasks: a.totalTasks,
      specializations: a.specializations,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  
  // Recent learning events
  const recentHistory = (history || []).slice(-10).reverse().map(h => ({
    taskId: h.taskId,
    agent: h.agentName,
    category: h.category,
    success: h.success,
    quality: Math.round(h.qualityScore * 100),
    time: new Date(h.timestamp).toISOString(),
  }));
  
  return {
    enabled: model.config?.enabled ?? true,
    configured: true,
    version: model.version,
    config: {
      autoLearn: model.config?.autoLearn ?? true,
      explorationRate: model.config?.explorationRate ?? 0.1,
      learningRate: model.config?.learningRate ?? 0.1,
    },
    globalStats: {
      totalTasks: model.globalStats?.totalTasks || 0,
      avgSuccessRate: Math.round((model.globalStats?.avgSuccessRate || 0) * 100),
      avgQuality: Math.round((model.globalStats?.avgQuality || 0) * 100),
      lastUpdated: model.globalStats?.lastUpdated,
    },
    agentCount: Object.keys(model.agents).length,
    topAgents,
    categoryDistribution,
    recentHistory,
  };
}

// Get Agent Booster stats
async function getBoosterStats(repoPath: string) {
  const statsPath = path.join(repoPath, ".swarm", "booster", "stats.json");
  const configPath = path.join(repoPath, ".swarm", "booster", "config.json");
  const historyPath = path.join(repoPath, ".swarm", "booster", "history.json");
  
  const stats = await readJson<{
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    totalChanges: number;
    totalTimeSavedMs: number;
    totalCostSaved: number;
    byType: Record<string, { count: number; successRate: number; avgTimeMs: number }>;
    lastUpdated: number;
  }>(statsPath);
  
  const config = await readJson<{
    enabled: boolean;
    autoDetect: boolean;
    maxFileSize: number;
    backupBeforeChange: boolean;
    dryRun: boolean;
    estimatedLLMCostPerTask: number;
  }>(configPath);
  
  const history = await readJson<Array<{
    taskType: string;
    filePath: string;
    success: boolean;
    changes: number;
    timeMs: number;
    savedCost: number;
  }>>(historyPath);
  
  if (!stats) {
    return {
      enabled: config?.enabled ?? true,
      configured: false,
      message: "Agent Booster not initialized. Use swarm_booster({ action: 'execute', ... }) to start.",
      supportedTypes: [
        "rename_variable", "fix_typo", "find_replace", "add_console_log",
        "remove_console_log", "toggle_flag", "update_version", "update_import",
        "format_json", "sort_imports", "add_export", "extract_constant"
      ],
    };
  }
  
  // Calculate type distribution
  const typeDistribution: Record<string, number> = {};
  for (const [type, data] of Object.entries(stats.byType || {})) {
    typeDistribution[type] = data.count;
  }
  
  // Recent history
  const recentHistory = (history || []).slice(-10).reverse().map(h => ({
    type: h.taskType,
    file: h.filePath.split("/").pop() || h.filePath,
    success: h.success,
    changes: h.changes,
    timeMs: h.timeMs,
    savedCost: `$${h.savedCost.toFixed(3)}`,
  }));
  
  return {
    enabled: config?.enabled ?? true,
    configured: true,
    stats: {
      totalTasks: stats.totalTasks,
      successRate: stats.totalTasks > 0 
        ? Math.round((stats.successfulTasks / stats.totalTasks) * 100) 
        : 0,
      totalChanges: stats.totalChanges,
      timeSavedMinutes: Math.round(stats.totalTimeSavedMs / 60000),
      costSaved: `$${stats.totalCostSaved.toFixed(2)}`,
      lastUpdated: stats.lastUpdated,
    },
    config: {
      autoDetect: config?.autoDetect ?? true,
      backupBeforeChange: config?.backupBeforeChange ?? true,
      dryRun: config?.dryRun ?? false,
    },
    typeDistribution,
    recentHistory,
  };
}

// Get HNSW Vector stats
async function getVectorStats(repoPath: string) {
  const indexPath = path.join(repoPath, ".swarm", "hnsw", "index.json");
  const configPath = path.join(repoPath, ".swarm", "hnsw", "config.json");
  
  const index = await readJson<{
    version: string;
    dimensions: number;
    totalDocuments: number;
    maxLevel: number;
    lastUpdated: number;
    nodes: Record<string, { neighbors: string[][] }>;
  }>(indexPath);
  
  const config = await readJson<{
    dimensions: number;
    M: number;
    efConstruction: number;
    efSearch: number;
    distanceMetric: string;
  }>(configPath);
  
  if (!index || index.totalDocuments === 0) {
    return {
      configured: false,
      message: "Vector index not initialized. Use swarm_vector({ action: 'init' }) to start.",
      supportedDimensions: [384, 768, 1536],
      distanceMetrics: ["cosine", "euclidean", "dot"],
    };
  }
  
  // Calculate average connections
  let totalConnections = 0;
  let nodeCount = 0;
  for (const node of Object.values(index.nodes || {})) {
    for (const neighbors of node.neighbors || []) {
      if (neighbors) totalConnections += neighbors.length;
    }
    nodeCount++;
  }
  
  // Estimate memory
  const memoryKB = Math.round(JSON.stringify(index).length / 1024);
  
  return {
    configured: true,
    version: index.version,
    stats: {
      totalDocuments: index.totalDocuments,
      dimensions: index.dimensions,
      maxLevel: index.maxLevel,
      avgConnections: nodeCount > 0 ? Math.round(totalConnections / nodeCount * 10) / 10 : 0,
      memoryKB,
      lastUpdated: index.lastUpdated,
    },
    config: {
      dimensions: config?.dimensions || index.dimensions,
      M: config?.M || 16,
      efSearch: config?.efSearch || 50,
      distanceMetric: config?.distanceMetric || "cosine",
    },
  };
}

// Get AIDefence stats
async function getDefenceStats(repoPath: string) {
  const configPath = path.join(repoPath, ".swarm", "defence", "config.json");
  const statsPath = path.join(repoPath, ".swarm", "defence", "stats.json");
  const eventsPath = path.join(repoPath, ".swarm", "defence", "events.json");
  const quarantinePath = path.join(repoPath, ".swarm", "defence", "quarantine.json");
  
  const config = await readJson<{
    enabled: boolean;
    sensitivity: string;
    blockOnHighThreat: boolean;
    quarantineEnabled: boolean;
    auditLog: boolean;
    allowedAgents: string[];
    blockedPatterns: string[];
  }>(configPath);
  
  const stats = await readJson<{
    totalScans: number;
    threatsDetected: number;
    threatsBlocked: number;
    threatsByCategory: Record<string, number>;
    threatsBySeverity: Record<string, number>;
    lastScan: number;
  }>(statsPath);
  
  const events = await readJson<Array<{
    id: string;
    timestamp: number;
    category: string;
    severity: string;
    source: string;
    action: string;
    resolved: boolean;
  }>>(eventsPath);
  
  const quarantine = await readJson<Array<{
    id: string;
    timestamp: number;
    category: string;
    released: boolean;
    expiresAt: number;
  }>>(quarantinePath);
  
  if (!config && !stats) {
    return {
      enabled: true,
      configured: false,
      message: "AIDefence not initialized. Use swarm_defence({ action: 'scan', text: '...' }) to start.",
      threatCategories: [
        "prompt_injection", "jailbreak", "code_injection", "data_exfiltration",
        "unauthorized_tool", "impersonation", "dos_attack", "sensitive_data",
        "unsafe_command", "social_engineering"
      ],
      sensitivityLevels: ["low", "medium", "high", "paranoid"],
    };
  }
  
  const now = Date.now();
  const activeQuarantine = (quarantine || []).filter(q => !q.released && q.expiresAt > now);
  const recentEvents = (events || []).slice(-10).reverse();
  
  return {
    enabled: config?.enabled ?? true,
    configured: true,
    stats: {
      totalScans: stats?.totalScans || 0,
      threatsDetected: stats?.threatsDetected || 0,
      threatsBlocked: stats?.threatsBlocked || 0,
      detectionRate: stats?.totalScans ? 
        Math.round((stats.threatsDetected / stats.totalScans) * 100) : 0,
      lastScan: stats?.lastScan,
    },
    config: {
      sensitivity: config?.sensitivity || "medium",
      blockOnHighThreat: config?.blockOnHighThreat ?? true,
      quarantineEnabled: config?.quarantineEnabled ?? true,
      auditLog: config?.auditLog ?? true,
      trustedAgents: config?.allowedAgents?.length || 0,
    },
    threatsByCategory: stats?.threatsByCategory || {},
    threatsBySeverity: stats?.threatsBySeverity || {},
    quarantine: {
      active: activeQuarantine.length,
      total: (quarantine || []).length,
    },
    recentEvents: recentEvents.map(e => ({
      id: e.id,
      category: e.category,
      severity: e.severity,
      source: e.source,
      action: e.action,
      timestamp: e.timestamp,
      resolved: e.resolved,
    })),
  };
}

// Get Consensus stats
async function getConsensusStats(repoPath: string) {
  const configPath = path.join(repoPath, ".swarm", "consensus", "config.json");
  const nodesPath = path.join(repoPath, ".swarm", "consensus", "nodes.json");
  const electionPath = path.join(repoPath, ".swarm", "consensus", "election.json");
  const proposalsPath = path.join(repoPath, ".swarm", "consensus", "proposals.json");
  const statsPath = path.join(repoPath, ".swarm", "consensus", "stats.json");
  
  const config = await readJson<{
    mode: string;
    heartbeatInterval: number;
    electionTimeout: number;
    minNodes: number;
    defaultMajority: number;
  }>(configPath);
  
  const nodes = await readJson<Array<{
    id: string;
    name: string;
    state: string;
    term: number;
    lastHeartbeat: number;
    isTrusted: boolean;
  }>>(nodesPath);
  
  const election = await readJson<{
    term: number;
    leaderId: string | null;
    leaderName: string | null;
    electedAt: number | null;
  }>(electionPath);
  
  const proposals = await readJson<Array<{
    id: string;
    title: string;
    status: string;
    type: string;
    proposedBy: string;
    proposedAt: number;
    votes: Array<{ vote: string }>;
  }>>(proposalsPath);
  
  const stats = await readJson<{
    totalProposals: number;
    approvedProposals: number;
    rejectedProposals: number;
    totalElections: number;
  }>(statsPath);
  
  if (!config && !nodes?.length) {
    return {
      configured: false,
      message: "Consensus not initialized. Use swarm_consensus({ action: 'join', ... }) to start.",
      consensusModes: ["simple_majority", "raft", "bft"],
    };
  }
  
  const now = Date.now();
  const timeout = (config?.electionTimeout || 15000) * 2;
  const activeNodes = (nodes || []).filter(n => (now - n.lastHeartbeat) < timeout);
  const pendingProposals = (proposals || []).filter(p => p.status === "pending");
  
  return {
    configured: true,
    mode: config?.mode || "simple_majority",
    cluster: {
      totalNodes: nodes?.length || 0,
      activeNodes: activeNodes.length,
      quorumRequired: config?.minNodes || 2,
      hasQuorum: activeNodes.length >= (config?.minNodes || 2),
    },
    leader: election?.leaderId ? {
      id: election.leaderId,
      name: election.leaderName,
      term: election.term,
      electedAt: election.electedAt,
    } : null,
    proposals: {
      total: stats?.totalProposals || 0,
      pending: pendingProposals.length,
      approved: stats?.approvedProposals || 0,
      rejected: stats?.rejectedProposals || 0,
    },
    elections: stats?.totalElections || 0,
    nodes: (nodes || []).map(n => ({
      id: n.id,
      name: n.name,
      state: n.id === election?.leaderId ? "leader" :
             (now - n.lastHeartbeat) < timeout ? "follower" : "offline",
      isTrusted: n.isTrusted,
      lastSeen: n.lastHeartbeat,
    })),
    recentProposals: (proposals || []).slice(-5).reverse().map(p => ({
      id: p.id,
      title: p.title,
      type: p.type,
      status: p.status,
      proposedBy: p.proposedBy,
      votes: p.votes?.length || 0,
    })),
  };
}

// Get MoE Router stats
async function getMoEStats(repoPath: string) {
  const configPath = path.join(repoPath, ".swarm", "moe", "config.json");
  const expertsPath = path.join(repoPath, ".swarm", "moe", "experts.json");
  const statsPath = path.join(repoPath, ".swarm", "moe", "stats.json");
  
  const config = await readJson<{
    enabled: boolean;
    defaultTier: string;
    costWeight: number;
    latencyWeight: number;
    qualityWeight: number;
    learningEnabled: boolean;
  }>(configPath);
  
  const experts = await readJson<Array<{
    id: string;
    name: string;
    provider: string;
    tier: string;
    available: boolean;
    successRate: number;
    totalCalls: number;
    avgLatencyMs: number;
    costPer1kInput: number;
    costPer1kOutput: number;
  }>>(expertsPath);
  
  const stats = await readJson<{
    totalRequests: number;
    successfulRoutes: number;
    fallbacksUsed: number;
    avgLatencyMs: number;
    totalCost: number;
    byExpert: Record<string, {
      calls: number;
      avgLatency: number;
      totalCost: number;
      successRate: number;
    }>;
    lastUpdated: number;
  }>(statsPath);
  
  if (!experts?.length) {
    return {
      configured: false,
      message: "MoE Router not initialized. Use swarm_moe({ action: 'route', content: '...' }) to start.",
      builtInExperts: ["Claude Opus", "Claude Sonnet", "Claude Haiku", "GPT-4o", "GPT-4o Mini", "o1", "Gemini 2.0 Flash"],
      taskCategories: ["code_generation", "code_review", "debugging", "reasoning", "creative", "summarization"],
    };
  }
  
  const availableExperts = experts.filter(e => e.available);
  const expertsByProvider = experts.reduce((acc, e) => {
    acc[e.provider] = (acc[e.provider] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    configured: true,
    enabled: config?.enabled ?? true,
    stats: {
      totalRequests: stats?.totalRequests || 0,
      successfulRoutes: stats?.successfulRoutes || 0,
      successRate: stats?.totalRequests ? 
        Math.round((stats.successfulRoutes / stats.totalRequests) * 100) : 0,
      avgLatencyMs: Math.round(stats?.avgLatencyMs || 0),
      totalCost: `$${(stats?.totalCost || 0).toFixed(2)}`,
      fallbacksUsed: stats?.fallbacksUsed || 0,
    },
    config: {
      defaultTier: config?.defaultTier || "standard",
      costWeight: config?.costWeight || 0.3,
      latencyWeight: config?.latencyWeight || 0.2,
      qualityWeight: config?.qualityWeight || 0.5,
      learningEnabled: config?.learningEnabled ?? true,
    },
    experts: {
      total: experts.length,
      available: availableExperts.length,
      byProvider: expertsByProvider,
    },
    topExperts: experts
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        name: e.name,
        provider: e.provider,
        tier: e.tier,
        calls: e.totalCalls,
        successRate: Math.round(e.successRate * 100),
        avgLatency: Math.round(e.avgLatencyMs),
      })),
  };
}

// Request handler
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url || "/", true);
  const pathname = parsedUrl.pathname || "/";
  const repoPath = (parsedUrl.query.repoPath as string) || REPO_PATH;
  
  try {
    let data: unknown;
    
    switch (pathname) {
      case "/api/stats":
        data = await getStats(repoPath);
        break;
      case "/api/agents":
        data = await getAgents(repoPath);
        break;
      case "/api/tasks":
        data = await getTasks(repoPath);
        break;
      case "/api/messages":
        data = await getMessages(repoPath);
        break;
      case "/api/locks":
        data = await getFileLocks(repoPath);
        break;
      case "/api/orchestrator":
        data = await getOrchestratorInfo(repoPath);
        break;
      case "/api/expertise":
        data = await getExpertise(repoPath);
        break;
      case "/api/context":
        data = await getContextPool(repoPath);
        break;
      case "/api/reviews":
        data = await getReviews(repoPath);
        break;
      case "/api/budget":
        data = await getBudget(repoPath);
        break;
      case "/api/sync":
        data = await getSyncStatus(repoPath);
        break;
      case "/api/telegram":
        data = await getTelegramConfig(repoPath);
        break;
      case "/api/sona":
        data = await getSONAStats(repoPath);
        break;
      case "/api/booster":
        data = await getBoosterStats(repoPath);
        break;
      case "/api/vector":
        data = await getVectorStats(repoPath);
        break;
      case "/api/defence":
        data = await getDefenceStats(repoPath);
        break;
      case "/api/consensus":
        data = await getConsensusStats(repoPath);
        break;
      case "/api/moe":
        data = await getMoEStats(repoPath);
        break;
      case "/api/health":
        data = { status: "ok", timestamp: Date.now() };
        break;
      default:
        res.writeHead(404, CORS_HEADERS);
        res.end(JSON.stringify({ error: "Not found" }));
        return;
    }
    
    res.writeHead(200, CORS_HEADERS);
    res.end(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("API Error:", error);
    res.writeHead(500, CORS_HEADERS);
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}

// Start server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║         MCP Swarm Dashboard API Server v0.9.12         ║
╠════════════════════════════════════════════════════════╣
║  API:       http://localhost:${PORT}                     ║
║  Dashboard: http://localhost:3333                      ║
╠════════════════════════════════════════════════════════╣
║  Endpoints:                                            ║
║    GET /api/stats        - Статистика swarm            ║
║    GET /api/agents       - Список агентов              ║
║    GET /api/tasks        - Список задач                ║
║    GET /api/messages     - Сообщения                   ║
║    GET /api/locks        - Блокировки файлов           ║
║    GET /api/orchestrator - Инфо об оркестраторе        ║
║    GET /api/expertise    - Smart Routing экспертиза    ║
║    GET /api/context      - Context Pool заметки        ║
║    GET /api/reviews      - Auto Review ревью           ║
║    GET /api/budget       - Cost бюджет и использование ║
║    GET /api/sync         - External Sync статус        ║
║    GET /api/telegram     - Telegram Bot конфигурация   ║
║    GET /api/sona         - SONA статистика и профили   ║
║    GET /api/booster      - Agent Booster статистика    ║
║    GET /api/vector       - HNSW Vector Search статус   ║
║    GET /api/defence      - AIDefence безопасность      ║
║    GET /api/consensus    - Consensus распред. согласие ║
║    GET /api/moe          - MoE Router выбор моделей    ║
║    GET /api/health       - Проверка работоспособности  ║
╚════════════════════════════════════════════════════════╝
  `);
});

export { server };
