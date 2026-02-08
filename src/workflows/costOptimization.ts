/**
 * Cost Optimization - Smart model routing based on task complexity
 * Routes simple tasks to cheaper models, complex tasks to expensive models
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

// ========== Types ==========

export type ModelTier = "cheap" | "standard" | "premium";

export interface ModelConfig {
  id: string;
  name: string;
  tier: ModelTier;
  costPer1kInput: number; // USD per 1k input tokens
  costPer1kOutput: number; // USD per 1k output tokens
  maxTokens: number;
  capabilities: string[]; // e.g., ["code", "reasoning", "vision"]
}

export interface TaskComplexity {
  level: "simple" | "medium" | "complex";
  score: number; // 0-100
  factors: {
    fileCount: number;
    linesOfCode: number;
    hasTests: boolean;
    hasArchitecture: boolean;
    requiresReasoning: boolean;
    requiresCreativity: boolean;
  };
  recommendedTier: ModelTier;
  recommendedModel?: string;
}

export interface UsageRecord {
  id: string;
  timestamp: string;
  agentId: string;
  taskId?: string;
  model: string;
  tier: ModelTier;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  complexity?: TaskComplexity["level"];
}

export interface BudgetConfig {
  dailyLimit: number; // USD
  weeklyLimit: number;
  monthlyLimit: number;
  alertThresholds: number[]; // e.g., [0.5, 0.8, 0.95] for 50%, 80%, 95%
  lastAlert?: string; // ISO timestamp
}

export interface BudgetStatus {
  daily: { used: number; limit: number; percentage: number };
  weekly: { used: number; limit: number; percentage: number };
  monthly: { used: number; limit: number; percentage: number };
  isOverBudget: boolean;
  alerts: string[];
}

// ========== Default Models ==========

const DEFAULT_MODELS: ModelConfig[] = [
  // Cheap tier - for simple tasks
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    tier: "cheap",
    costPer1kInput: 0.0005,
    costPer1kOutput: 0.0015,
    maxTokens: 16384,
    capabilities: ["code", "general"],
  },
  {
    id: "claude-3-haiku",
    name: "Claude 3 Haiku",
    tier: "cheap",
    costPer1kInput: 0.00025,
    costPer1kOutput: 0.00125,
    maxTokens: 200000,
    capabilities: ["code", "general", "fast"],
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    tier: "cheap",
    costPer1kInput: 0.000075,
    costPer1kOutput: 0.0003,
    maxTokens: 1000000,
    capabilities: ["code", "general", "fast"],
  },

  // Standard tier - for medium tasks
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    tier: "standard",
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    maxTokens: 128000,
    capabilities: ["code", "reasoning", "vision"],
  },
  {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    tier: "standard",
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    maxTokens: 200000,
    capabilities: ["code", "reasoning", "creativity"],
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    tier: "standard",
    costPer1kInput: 0.00125,
    costPer1kOutput: 0.005,
    maxTokens: 2000000,
    capabilities: ["code", "reasoning", "long-context"],
  },

  // Premium tier - for complex tasks
  {
    id: "gpt-4o",
    name: "GPT-4o",
    tier: "premium",
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
    maxTokens: 128000,
    capabilities: ["code", "reasoning", "vision", "creativity"],
  },
  {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
    tier: "premium",
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    maxTokens: 200000,
    capabilities: ["code", "reasoning", "creativity", "complex"],
  },
  {
    id: "o1-preview",
    name: "OpenAI o1-preview",
    tier: "premium",
    costPer1kInput: 0.015,
    costPer1kOutput: 0.06,
    maxTokens: 128000,
    capabilities: ["reasoning", "complex", "math", "science"],
  },
];

// ========== File Paths ==========

function getCostDir(repoPath: string): string {
  return path.join(repoPath, ".swarm", "cost");
}

function getModelsPath(repoPath: string): string {
  return path.join(getCostDir(repoPath), "models.json");
}

function getBudgetPath(repoPath: string): string {
  return path.join(getCostDir(repoPath), "budget.json");
}

function getUsagePath(repoPath: string): string {
  return path.join(getCostDir(repoPath), "usage.json");
}

// ========== Helpers ==========

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ========== Task Complexity Analysis ==========

const SIMPLE_KEYWORDS = [
  "fix typo",
  "update comment",
  "rename",
  "format",
  "lint",
  "import",
  "export",
  "add log",
  "remove log",
  "bump version",
  "update readme",
  "add todo",
];

const COMPLEX_KEYWORDS = [
  "refactor",
  "architecture",
  "design",
  "implement feature",
  "integrate",
  "migrate",
  "optimize performance",
  "security",
  "authentication",
  "authorization",
  "database schema",
  "api design",
  "testing strategy",
  "debugging",
  "memory leak",
  "race condition",
  "concurrency",
];

const MEDIUM_KEYWORDS = [
  "add feature",
  "fix bug",
  "update logic",
  "add test",
  "add validation",
  "error handling",
  "add endpoint",
  "update ui",
  "add component",
];

export function analyzeTaskComplexity(
  taskTitle: string,
  taskDescription: string,
  affectedFiles: string[] = []
): TaskComplexity {
  const text = `${taskTitle} ${taskDescription}`.toLowerCase();

  let score = 50; // Start at medium
  const factors = {
    fileCount: affectedFiles.length,
    linesOfCode: 0,
    hasTests: false,
    hasArchitecture: false,
    requiresReasoning: false,
    requiresCreativity: false,
  };

  // Check keywords
  for (const keyword of SIMPLE_KEYWORDS) {
    if (text.includes(keyword)) score -= 15;
  }
  for (const keyword of COMPLEX_KEYWORDS) {
    if (text.includes(keyword)) score += 20;
  }
  for (const keyword of MEDIUM_KEYWORDS) {
    if (text.includes(keyword)) score += 5;
  }

  // Check file count
  if (affectedFiles.length > 10) {
    score += 20;
    factors.hasArchitecture = true;
  } else if (affectedFiles.length > 5) {
    score += 10;
  } else if (affectedFiles.length <= 1) {
    score -= 10;
  }

  // Check for test files
  factors.hasTests = affectedFiles.some(
    (f) => f.includes("test") || f.includes("spec") || f.includes("__tests__")
  );
  if (factors.hasTests) score += 5;

  // Check for reasoning/creativity requirements
  if (text.includes("design") || text.includes("architect") || text.includes("plan")) {
    factors.requiresReasoning = true;
    score += 15;
  }
  if (text.includes("creative") || text.includes("innovative") || text.includes("new approach")) {
    factors.requiresCreativity = true;
    score += 10;
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: TaskComplexity["level"];
  let recommendedTier: ModelTier;

  if (score < 35) {
    level = "simple";
    recommendedTier = "cheap";
  } else if (score < 70) {
    level = "medium";
    recommendedTier = "standard";
  } else {
    level = "complex";
    recommendedTier = "premium";
  }

  return {
    level,
    score,
    factors,
    recommendedTier,
  };
}

// ========== Model Selection ==========

export async function getAvailableModels(repoPath: string): Promise<ModelConfig[]> {
  const customModels = await readJson<ModelConfig[]>(getModelsPath(repoPath), []);
  return customModels.length > 0 ? customModels : DEFAULT_MODELS;
}

export async function setCustomModels(repoPath: string, models: ModelConfig[]): Promise<void> {
  await writeJson(getModelsPath(repoPath), models);
}

export async function selectModel(
  repoPath: string,
  complexity: TaskComplexity,
  requiredCapabilities: string[] = []
): Promise<ModelConfig | null> {
  const models = await getAvailableModels(repoPath);

  // Filter by tier
  let candidates = models.filter((m) => m.tier === complexity.recommendedTier);

  // If no candidates at recommended tier, try adjacent tiers
  if (candidates.length === 0) {
    if (complexity.recommendedTier === "cheap") {
      candidates = models.filter((m) => m.tier === "standard");
    } else if (complexity.recommendedTier === "premium") {
      candidates = models.filter((m) => m.tier === "standard");
    } else {
      candidates = models; // Use all models
    }
  }

  // Filter by capabilities
  if (requiredCapabilities.length > 0) {
    const filtered = candidates.filter((m) =>
      requiredCapabilities.every((cap) => m.capabilities.includes(cap))
    );
    if (filtered.length > 0) candidates = filtered;
  }

  // Sort by cost (cheapest first within tier)
  candidates.sort((a, b) => {
    const costA = a.costPer1kInput + a.costPer1kOutput;
    const costB = b.costPer1kInput + b.costPer1kOutput;
    return costA - costB;
  });

  return candidates[0] || null;
}

export async function recommendModel(
  repoPath: string,
  taskTitle: string,
  taskDescription: string,
  affectedFiles: string[] = [],
  requiredCapabilities: string[] = []
): Promise<{
  complexity: TaskComplexity;
  model: ModelConfig | null;
  estimatedCost: { min: number; max: number };
}> {
  const complexity = analyzeTaskComplexity(taskTitle, taskDescription, affectedFiles);
  const model = await selectModel(repoPath, complexity, requiredCapabilities);

  // Estimate cost based on typical token usage
  let estimatedCost = { min: 0, max: 0 };
  if (model) {
    const tokensMin = complexity.level === "simple" ? 500 : complexity.level === "medium" ? 2000 : 5000;
    const tokensMax = complexity.level === "simple" ? 2000 : complexity.level === "medium" ? 8000 : 20000;

    estimatedCost.min =
      (tokensMin * model.costPer1kInput) / 1000 + (tokensMin * model.costPer1kOutput) / 1000;
    estimatedCost.max =
      (tokensMax * model.costPer1kInput) / 1000 + (tokensMax * model.costPer1kOutput) / 1000;
  }

  complexity.recommendedModel = model?.id;

  return { complexity, model, estimatedCost };
}

// ========== Usage Tracking ==========

export async function logUsage(
  repoPath: string,
  record: Omit<UsageRecord, "id" | "timestamp" | "cost">
): Promise<UsageRecord> {
  const models = await getAvailableModels(repoPath);
  const model = models.find((m) => m.id === record.model);

  const cost = model
    ? (record.inputTokens * model.costPer1kInput) / 1000 +
    (record.outputTokens * model.costPer1kOutput) / 1000
    : 0;

  const fullRecord: UsageRecord = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    cost,
    ...record,
  };

  const usage = await readJson<UsageRecord[]>(getUsagePath(repoPath), []);
  usage.push(fullRecord);

  // Keep last 10000 records
  if (usage.length > 10000) {
    usage.splice(0, usage.length - 10000);
  }

  await writeJson(getUsagePath(repoPath), usage);
  return fullRecord;
}

export async function getUsage(
  repoPath: string,
  filter?: {
    agentId?: string;
    taskId?: string;
    model?: string;
    tier?: ModelTier;
    since?: string;
    until?: string;
  }
): Promise<UsageRecord[]> {
  let usage = await readJson<UsageRecord[]>(getUsagePath(repoPath), []);

  if (filter) {
    if (filter.agentId) {
      usage = usage.filter((r) => r.agentId === filter.agentId);
    }
    if (filter.taskId) {
      usage = usage.filter((r) => r.taskId === filter.taskId);
    }
    if (filter.model) {
      usage = usage.filter((r) => r.model === filter.model);
    }
    if (filter.tier) {
      usage = usage.filter((r) => r.tier === filter.tier);
    }
    if (filter.since) {
      usage = usage.filter((r) => r.timestamp >= filter.since!);
    }
    if (filter.until) {
      usage = usage.filter((r) => r.timestamp <= filter.until!);
    }
  }

  return usage;
}

export async function getUsageStats(
  repoPath: string,
  period: "day" | "week" | "month" = "day"
): Promise<{
  totalCost: number;
  totalTokens: { input: number; output: number };
  byModel: Record<string, { cost: number; count: number }>;
  byTier: Record<ModelTier, { cost: number; count: number }>;
  byAgent: Record<string, { cost: number; count: number }>;
}> {
  const now = new Date();
  let since: Date;

  switch (period) {
    case "day":
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "week":
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  const usage = await getUsage(repoPath, { since: since.toISOString() });

  const stats = {
    totalCost: 0,
    totalTokens: { input: 0, output: 0 },
    byModel: {} as Record<string, { cost: number; count: number }>,
    byTier: {
      cheap: { cost: 0, count: 0 },
      standard: { cost: 0, count: 0 },
      premium: { cost: 0, count: 0 },
    } as Record<ModelTier, { cost: number; count: number }>,
    byAgent: {} as Record<string, { cost: number; count: number }>,
  };

  for (const record of usage) {
    stats.totalCost += record.cost;
    stats.totalTokens.input += record.inputTokens;
    stats.totalTokens.output += record.outputTokens;

    // By model
    if (!stats.byModel[record.model]) {
      stats.byModel[record.model] = { cost: 0, count: 0 };
    }
    stats.byModel[record.model].cost += record.cost;
    stats.byModel[record.model].count += 1;

    // By tier
    stats.byTier[record.tier].cost += record.cost;
    stats.byTier[record.tier].count += 1;

    // By agent
    if (!stats.byAgent[record.agentId]) {
      stats.byAgent[record.agentId] = { cost: 0, count: 0 };
    }
    stats.byAgent[record.agentId].cost += record.cost;
    stats.byAgent[record.agentId].count += 1;
  }

  return stats;
}

// ========== Budget Management ==========

export async function getBudgetConfig(repoPath: string): Promise<BudgetConfig> {
  return readJson<BudgetConfig>(getBudgetPath(repoPath), {
    dailyLimit: 10, // $10/day default
    weeklyLimit: 50, // $50/week
    monthlyLimit: 150, // $150/month
    alertThresholds: [0.5, 0.8, 0.95],
  });
}

export async function setBudgetConfig(repoPath: string, config: Partial<BudgetConfig>): Promise<void> {
  const existing = await getBudgetConfig(repoPath);
  await writeJson(getBudgetPath(repoPath), { ...existing, ...config });
}

export async function checkBudget(repoPath: string): Promise<BudgetStatus> {
  const config = await getBudgetConfig(repoPath);
  const now = new Date();

  // Calculate periods
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Get usage for each period
  const dailyUsage = await getUsage(repoPath, { since: dayStart });
  const weeklyUsage = await getUsage(repoPath, { since: weekStart });
  const monthlyUsage = await getUsage(repoPath, { since: monthStart });

  const dailyTotal = dailyUsage.reduce((sum, r) => sum + r.cost, 0);
  const weeklyTotal = weeklyUsage.reduce((sum, r) => sum + r.cost, 0);
  const monthlyTotal = monthlyUsage.reduce((sum, r) => sum + r.cost, 0);

  const status: BudgetStatus = {
    daily: {
      used: dailyTotal,
      limit: config.dailyLimit,
      percentage: (dailyTotal / config.dailyLimit) * 100,
    },
    weekly: {
      used: weeklyTotal,
      limit: config.weeklyLimit,
      percentage: (weeklyTotal / config.weeklyLimit) * 100,
    },
    monthly: {
      used: monthlyTotal,
      limit: config.monthlyLimit,
      percentage: (monthlyTotal / config.monthlyLimit) * 100,
    },
    isOverBudget: false,
    alerts: [],
  };

  // Check for over-budget
  if (dailyTotal >= config.dailyLimit) {
    status.isOverBudget = true;
    status.alerts.push(`Daily budget exceeded: $${dailyTotal.toFixed(2)} / $${config.dailyLimit}`);
  }
  if (weeklyTotal >= config.weeklyLimit) {
    status.isOverBudget = true;
    status.alerts.push(`Weekly budget exceeded: $${weeklyTotal.toFixed(2)} / $${config.weeklyLimit}`);
  }
  if (monthlyTotal >= config.monthlyLimit) {
    status.isOverBudget = true;
    status.alerts.push(`Monthly budget exceeded: $${monthlyTotal.toFixed(2)} / $${config.monthlyLimit}`);
  }

  // Check thresholds
  for (const threshold of config.alertThresholds) {
    if (status.daily.percentage >= threshold * 100 && status.daily.percentage < 100) {
      status.alerts.push(`Daily budget at ${(threshold * 100).toFixed(0)}%`);
    }
  }

  return status;
}

export async function getRemainingBudget(repoPath: string): Promise<{
  daily: number;
  weekly: number;
  monthly: number;
  canProceed: boolean;
  recommendedTier: ModelTier | null;
}> {
  const status = await checkBudget(repoPath);

  const daily = Math.max(0, status.daily.limit - status.daily.used);
  const weekly = Math.max(0, status.weekly.limit - status.weekly.used);
  const monthly = Math.max(0, status.monthly.limit - status.monthly.used);

  const minRemaining = Math.min(daily, weekly, monthly);

  // Determine what tier we can afford
  let recommendedTier: ModelTier | null = null;
  if (minRemaining > 0.1) {
    recommendedTier = "premium";
  } else if (minRemaining > 0.01) {
    recommendedTier = "standard";
  } else if (minRemaining > 0.001) {
    recommendedTier = "cheap";
  }

  return {
    daily,
    weekly,
    monthly,
    canProceed: !status.isOverBudget && minRemaining > 0,
    recommendedTier,
  };
}

// ========== Smart Router ==========

export async function routeTask(
  repoPath: string,
  taskTitle: string,
  taskDescription: string,
  options?: {
    affectedFiles?: string[];
    requiredCapabilities?: string[];
    preferCheaper?: boolean;
    forceModel?: string;
  }
): Promise<{
  model: ModelConfig | null;
  complexity: TaskComplexity;
  budget: BudgetStatus;
  canProceed: boolean;
  reason?: string;
}> {
  // Check budget first
  const budget = await checkBudget(repoPath);
  const remaining = await getRemainingBudget(repoPath);

  if (!remaining.canProceed) {
    return {
      model: null,
      complexity: analyzeTaskComplexity(taskTitle, taskDescription, options?.affectedFiles),
      budget,
      canProceed: false,
      reason: "Budget exceeded",
    };
  }

  // Force specific model if requested
  if (options?.forceModel) {
    const models = await getAvailableModels(repoPath);
    const forced = models.find((m) => m.id === options.forceModel);
    if (forced) {
      return {
        model: forced,
        complexity: analyzeTaskComplexity(taskTitle, taskDescription, options?.affectedFiles),
        budget,
        canProceed: true,
      };
    }
  }

  // Analyze and recommend
  const recommendation = await recommendModel(
    repoPath,
    taskTitle,
    taskDescription,
    options?.affectedFiles,
    options?.requiredCapabilities
  );

  // If preferCheaper, downgrade tier
  if (options?.preferCheaper && recommendation.model) {
    const models = await getAvailableModels(repoPath);
    const cheaperTier =
      recommendation.complexity.recommendedTier === "premium"
        ? "standard"
        : recommendation.complexity.recommendedTier === "standard"
          ? "cheap"
          : "cheap";

    const cheaper = models.find((m) => m.tier === cheaperTier);
    if (cheaper) {
      return {
        model: cheaper,
        complexity: recommendation.complexity,
        budget,
        canProceed: true,
        reason: "Downgraded to cheaper model as requested",
      };
    }
  }

  // Check if recommended model fits remaining budget
  if (recommendation.model && remaining.recommendedTier) {
    const tierOrder: ModelTier[] = ["cheap", "standard", "premium"];
    const recommendedIndex = tierOrder.indexOf(recommendation.model.tier);
    const affordableIndex = tierOrder.indexOf(remaining.recommendedTier);

    if (recommendedIndex > affordableIndex) {
      // Need to downgrade
      const models = await getAvailableModels(repoPath);
      const affordable = models.find((m) => m.tier === remaining.recommendedTier);
      if (affordable) {
        return {
          model: affordable,
          complexity: recommendation.complexity,
          budget,
          canProceed: true,
          reason: `Downgraded from ${recommendation.model.tier} to ${remaining.recommendedTier} due to budget`,
        };
      }
    }
  }

  return {
    model: recommendation.model,
    complexity: recommendation.complexity,
    budget,
    canProceed: true,
  };
}

// ========== Cost Report ==========

export async function generateCostReport(
  repoPath: string,
  period: "day" | "week" | "month" = "week"
): Promise<string> {
  const stats = await getUsageStats(repoPath, period);
  const budget = await checkBudget(repoPath);

  const periodName = period === "day" ? "Daily" : period === "week" ? "Weekly" : "Monthly";

  let report = `# ${periodName} Cost Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;

  // Summary
  report += `## Summary\n\n`;
  report += `- **Total Cost:** $${stats.totalCost.toFixed(4)}\n`;
  report += `- **Total Tokens:** ${stats.totalTokens.input.toLocaleString()} input, ${stats.totalTokens.output.toLocaleString()} output\n\n`;

  // Budget status
  const periodBudget = period === "day" ? budget.daily : period === "week" ? budget.weekly : budget.monthly;
  report += `## Budget Status\n\n`;
  report += `- **Used:** $${periodBudget.used.toFixed(2)} / $${periodBudget.limit.toFixed(2)} (${periodBudget.percentage.toFixed(1)}%)\n`;
  report += `- **Remaining:** $${(periodBudget.limit - periodBudget.used).toFixed(2)}\n\n`;

  if (budget.alerts.length > 0) {
    report += `### Alerts\n\n`;
    for (const alert of budget.alerts) {
      report += `- ⚠️ ${alert}\n`;
    }
    report += `\n`;
  }

  // By tier
  report += `## Cost by Tier\n\n`;
  report += `| Tier | Cost | Requests |\n`;
  report += `|------|------|----------|\n`;
  for (const [tier, data] of Object.entries(stats.byTier)) {
    if (data.count > 0) {
      report += `| ${tier} | $${data.cost.toFixed(4)} | ${data.count} |\n`;
    }
  }
  report += `\n`;

  // By model
  report += `## Cost by Model\n\n`;
  report += `| Model | Cost | Requests |\n`;
  report += `|-------|------|----------|\n`;
  const sortedModels = Object.entries(stats.byModel).sort((a, b) => b[1].cost - a[1].cost);
  for (const [model, data] of sortedModels) {
    report += `| ${model} | $${data.cost.toFixed(4)} | ${data.count} |\n`;
  }
  report += `\n`;

  // By agent
  if (Object.keys(stats.byAgent).length > 0) {
    report += `## Cost by Agent\n\n`;
    report += `| Agent | Cost | Requests |\n`;
    report += `|-------|------|----------|\n`;
    const sortedAgents = Object.entries(stats.byAgent).sort((a, b) => b[1].cost - a[1].cost);
    for (const [agent, data] of sortedAgents) {
      report += `| ${agent} | $${data.cost.toFixed(4)} | ${data.count} |\n`;
    }
  }

  return report;
}

// ─── Legacy-compatible exports (merged from costTracker.ts) ───

/**
 * @deprecated Use logUsage instead
 * Legacy wrapper for backward compatibility with costTracker.ts consumers
 */
export async function logApiUsage(input: {
  repoPath?: string;
  agent: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  taskId?: string;
  tool?: string;
}): Promise<{ logged: boolean; cost: number; totalTokens: number }> {
  const repoPath = input.repoPath || process.cwd();
  const record = await logUsage(repoPath, {
    agentId: input.agent,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    taskId: input.taskId,
    tier: "standard" as ModelTier,
  });
  return {
    logged: true,
    cost: record.cost,
    totalTokens: input.inputTokens + input.outputTokens,
  };
}

/**
 * @deprecated Use getUsageStats with filter instead
 */
export async function getAgentCosts(input: {
  repoPath?: string;
  agent: string;
  periodDays?: number;
}): Promise<{ agent: string; totalCost: number; totalTokens: number; entries: number }> {
  const repoPath = input.repoPath || process.cwd();
  const since = new Date(Date.now() - (input.periodDays || 30) * 86400000).toISOString();
  const usage = await getUsage(repoPath, { agentId: input.agent, since });
  return {
    agent: input.agent,
    totalCost: usage.reduce((s, r) => s + r.cost, 0),
    totalTokens: usage.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
    entries: usage.length,
  };
}

/**
 * @deprecated Use getUsageStats instead
 */
export async function getProjectCosts(input: {
  repoPath?: string;
  periodDays?: number;
}): Promise<{ totalCost: number; totalTokens: number; entries: number; byAgent: Record<string, number> }> {
  const repoPath = input.repoPath || process.cwd();
  const since = new Date(Date.now() - (input.periodDays || 30) * 86400000).toISOString();
  const usage = await getUsage(repoPath, { since });
  const byAgent: Record<string, number> = {};
  for (const r of usage) {
    byAgent[r.agentId] = (byAgent[r.agentId] || 0) + r.cost;
  }
  return {
    totalCost: usage.reduce((s, r) => s + r.cost, 0),
    totalTokens: usage.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
    entries: usage.length,
    byAgent,
  };
}

/**
 * @deprecated Use setBudgetConfig instead
 */
export async function setBudgetLimit(input: {
  repoPath?: string;
  dailyLimit?: number;
  monthlyLimit?: number;
  perAgentLimit?: number;
  alertThreshold?: number;
  commitMode?: "none" | "local" | "push";
}): Promise<{ set: boolean }> {
  const repoPath = input.repoPath || process.cwd();
  await setBudgetConfig(repoPath, {
    dailyLimit: input.dailyLimit,
    monthlyLimit: input.monthlyLimit,
  });
  return { set: true };
}

/**
 * @deprecated Use getRemainingBudget instead
 */
export async function checkBudgetRemaining(input: {
  repoPath?: string;
  agent?: string;
}): Promise<{ remaining: number; limit: number; used: number; percentage: number }> {
  const repoPath = input.repoPath || process.cwd();
  const status = await checkBudget(repoPath);
  return {
    remaining: Math.max(0, status.daily.limit - status.daily.used),
    limit: status.daily.limit,
    used: status.daily.used,
    percentage: status.daily.percentage,
  };
}

