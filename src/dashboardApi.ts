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
╔════════════════════════════════════════════════════╗
║       MCP Swarm Dashboard API Server               ║
╠════════════════════════════════════════════════════╣
║  API:       http://localhost:${PORT}                 ║
║  Dashboard: http://localhost:3333                  ║
╠════════════════════════════════════════════════════╣
║  Endpoints:                                        ║
║    GET /api/stats       - Статистика swarm         ║
║    GET /api/agents      - Список агентов           ║
║    GET /api/tasks       - Список задач             ║
║    GET /api/messages    - Сообщения                ║
║    GET /api/locks       - Блокировки файлов        ║
║    GET /api/orchestrator - Инфо об оркестраторе    ║
║    GET /api/health      - Проверка работоспособности║
╚════════════════════════════════════════════════════╝
  `);
});

export { server };
