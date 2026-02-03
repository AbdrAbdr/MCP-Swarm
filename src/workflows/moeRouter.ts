/**
 * MoE Router — Mixture of Experts Model Selection
 * 
 * MCP Swarm v0.9.10
 * 
 * Implements intelligent model routing based on task characteristics:
 * 
 * 1. Expert Classification
 *    - Code generation (Claude, GPT-4, Codex)
 *    - Reasoning (Claude, o1)
 *    - Creative writing (GPT-4, Claude)
 *    - Data analysis (GPT-4, Claude)
 *    - Quick tasks (GPT-3.5, Claude Haiku)
 * 
 * 2. Gating Network
 *    - Task complexity analysis
 *    - Token estimation
 *    - Cost-performance optimization
 *    - Latency requirements
 * 
 * 3. Expert Pool
 *    - Model capabilities database
 *    - Performance history
 *    - Cost tracking
 *    - Availability monitoring
 * 
 * 4. Load Balancing
 *    - Rate limit awareness
 *    - Fallback strategies
 *    - Queue management
 * 
 * Inspired by Mixture of Experts architecture (Shazeer et al.)
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

/**
 * Task category for expert selection
 */
export type TaskCategory =
  | "code_generation"    // Writing new code
  | "code_review"        // Reviewing/analyzing code
  | "code_refactor"      // Refactoring existing code
  | "debugging"          // Finding and fixing bugs
  | "reasoning"          // Complex logical reasoning
  | "math"               // Mathematical computations
  | "creative"           // Creative writing
  | "summarization"      // Summarizing text/code
  | "translation"        // Language translation
  | "data_analysis"      // Analyzing data
  | "quick_answer"       // Simple Q&A
  | "conversation"       // Chat/dialogue
  | "planning"           // Task planning
  | "documentation";     // Writing docs

/**
 * Model provider
 */
export type ModelProvider = 
  | "anthropic" 
  | "openai" 
  | "google" 
  | "mistral" 
  | "local"
  | "custom";

/**
 * Model tier for cost optimization
 */
export type ModelTier = "economy" | "standard" | "premium" | "flagship";

/**
 * Expert model definition
 */
export interface Expert {
  id: string;
  name: string;
  provider: ModelProvider;
  modelId: string;           // e.g., "claude-3-5-sonnet-20241022"
  tier: ModelTier;
  capabilities: TaskCategory[];
  strengthScores: Record<TaskCategory, number>; // 0-1 per category
  contextWindow: number;     // Max tokens
  costPer1kInput: number;    // $ per 1k input tokens
  costPer1kOutput: number;   // $ per 1k output tokens
  avgLatencyMs: number;      // Average response time
  rateLimit: number;         // Requests per minute
  available: boolean;
  lastUsed: number;
  totalCalls: number;
  successRate: number;       // 0-1
}

/**
 * Routing decision
 */
export interface RoutingDecision {
  selectedExpert: Expert;
  confidence: number;        // 0-1
  alternatives: Expert[];
  reasoning: string;
  estimatedCost: number;
  estimatedLatency: number;
  estimatedTokens: {
    input: number;
    output: number;
  };
  factors: {
    taskMatch: number;       // How well expert matches task
    costEfficiency: number;  // Cost optimization score
    performanceScore: number;// Historical performance
    loadBalance: number;     // Current load consideration
  };
}

/**
 * Task request for routing
 */
export interface TaskRequest {
  content: string;
  category?: TaskCategory;
  complexity?: "trivial" | "simple" | "medium" | "complex" | "extreme";
  maxLatencyMs?: number;
  maxCost?: number;
  preferredProvider?: ModelProvider;
  preferredTier?: ModelTier;
  requiredContext?: number;  // Minimum context window needed
  priority?: "low" | "normal" | "high" | "critical";
}

/**
 * Routing result with feedback
 */
export interface RoutingResult {
  requestId: string;
  decision: RoutingDecision;
  timestamp: number;
  actualLatencyMs?: number;
  actualCost?: number;
  success?: boolean;
  feedback?: {
    quality: number;         // 1-5 rating
    comment?: string;
  };
}

/**
 * MoE Configuration
 */
export interface MoEConfig {
  enabled: boolean;
  defaultTier: ModelTier;
  costWeight: number;        // 0-1, how much to prioritize cost
  latencyWeight: number;     // 0-1, how much to prioritize speed
  qualityWeight: number;     // 0-1, how much to prioritize quality
  enableFallback: boolean;
  fallbackChain: string[];   // Expert IDs for fallback
  maxRetries: number;
  learningEnabled: boolean;  // Learn from feedback
  learningRate: number;      // How fast to adapt
}

/**
 * MoE Statistics
 */
export interface MoEStats {
  totalRequests: number;
  successfulRoutes: number;
  fallbacksUsed: number;
  avgLatencyMs: number;
  totalCost: number;
  byCategory: Record<TaskCategory, {
    count: number;
    avgQuality: number;
    preferredExpert: string;
  }>;
  byExpert: Record<string, {
    calls: number;
    avgLatency: number;
    totalCost: number;
    successRate: number;
  }>;
  lastUpdated: number;
}

// ============ CONSTANTS ============

const MOE_DIR = "moe";
const CONFIG_FILE = "config.json";
const EXPERTS_FILE = "experts.json";
const HISTORY_FILE = "history.json";
const STATS_FILE = "stats.json";

const DEFAULT_CONFIG: MoEConfig = {
  enabled: true,
  defaultTier: "standard",
  costWeight: 0.3,
  latencyWeight: 0.2,
  qualityWeight: 0.5,
  enableFallback: true,
  fallbackChain: [],
  maxRetries: 2,
  learningEnabled: true,
  learningRate: 0.1,
};

/**
 * Default expert models
 */
const DEFAULT_EXPERTS: Expert[] = [
  // Anthropic
  {
    id: "claude-opus",
    name: "Claude Opus 4",
    provider: "anthropic",
    modelId: "claude-opus-4-20250514",
    tier: "flagship",
    capabilities: ["code_generation", "code_review", "reasoning", "creative", "planning", "documentation"],
    strengthScores: {
      code_generation: 0.98,
      code_review: 0.97,
      code_refactor: 0.96,
      debugging: 0.95,
      reasoning: 0.99,
      math: 0.92,
      creative: 0.95,
      summarization: 0.93,
      translation: 0.88,
      data_analysis: 0.90,
      quick_answer: 0.85,
      conversation: 0.94,
      planning: 0.97,
      documentation: 0.96,
    },
    contextWindow: 200000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    avgLatencyMs: 5000,
    rateLimit: 50,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    modelId: "claude-sonnet-4-20250514",
    tier: "premium",
    capabilities: ["code_generation", "code_review", "reasoning", "planning"],
    strengthScores: {
      code_generation: 0.95,
      code_review: 0.94,
      code_refactor: 0.93,
      debugging: 0.92,
      reasoning: 0.94,
      math: 0.88,
      creative: 0.90,
      summarization: 0.92,
      translation: 0.85,
      data_analysis: 0.88,
      quick_answer: 0.90,
      conversation: 0.92,
      planning: 0.93,
      documentation: 0.94,
    },
    contextWindow: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    avgLatencyMs: 2000,
    rateLimit: 100,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  {
    id: "claude-haiku",
    name: "Claude Haiku 3.5",
    provider: "anthropic",
    modelId: "claude-3-5-haiku-20241022",
    tier: "economy",
    capabilities: ["quick_answer", "summarization", "conversation"],
    strengthScores: {
      code_generation: 0.75,
      code_review: 0.70,
      code_refactor: 0.70,
      debugging: 0.68,
      reasoning: 0.72,
      math: 0.65,
      creative: 0.75,
      summarization: 0.85,
      translation: 0.80,
      data_analysis: 0.70,
      quick_answer: 0.92,
      conversation: 0.88,
      planning: 0.72,
      documentation: 0.78,
    },
    contextWindow: 200000,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    avgLatencyMs: 500,
    rateLimit: 200,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  // OpenAI
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    modelId: "gpt-4o",
    tier: "premium",
    capabilities: ["code_generation", "reasoning", "creative", "data_analysis"],
    strengthScores: {
      code_generation: 0.92,
      code_review: 0.90,
      code_refactor: 0.88,
      debugging: 0.88,
      reasoning: 0.90,
      math: 0.90,
      creative: 0.93,
      summarization: 0.90,
      translation: 0.92,
      data_analysis: 0.91,
      quick_answer: 0.88,
      conversation: 0.90,
      planning: 0.88,
      documentation: 0.89,
    },
    contextWindow: 128000,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
    avgLatencyMs: 2500,
    rateLimit: 80,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    modelId: "gpt-4o-mini",
    tier: "economy",
    capabilities: ["quick_answer", "conversation", "summarization"],
    strengthScores: {
      code_generation: 0.78,
      code_review: 0.75,
      code_refactor: 0.73,
      debugging: 0.72,
      reasoning: 0.75,
      math: 0.72,
      creative: 0.78,
      summarization: 0.82,
      translation: 0.80,
      data_analysis: 0.75,
      quick_answer: 0.88,
      conversation: 0.85,
      planning: 0.73,
      documentation: 0.76,
    },
    contextWindow: 128000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    avgLatencyMs: 400,
    rateLimit: 300,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  {
    id: "o1",
    name: "OpenAI o1",
    provider: "openai",
    modelId: "o1",
    tier: "flagship",
    capabilities: ["reasoning", "math", "code_generation", "debugging"],
    strengthScores: {
      code_generation: 0.94,
      code_review: 0.92,
      code_refactor: 0.90,
      debugging: 0.96,
      reasoning: 0.99,
      math: 0.98,
      creative: 0.80,
      summarization: 0.85,
      translation: 0.82,
      data_analysis: 0.94,
      quick_answer: 0.75,
      conversation: 0.78,
      planning: 0.95,
      documentation: 0.88,
    },
    contextWindow: 200000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.060,
    avgLatencyMs: 15000,
    rateLimit: 20,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  // Google
  {
    id: "gemini-2-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    modelId: "gemini-2.0-flash",
    tier: "standard",
    capabilities: ["code_generation", "quick_answer", "data_analysis"],
    strengthScores: {
      code_generation: 0.88,
      code_review: 0.85,
      code_refactor: 0.83,
      debugging: 0.82,
      reasoning: 0.86,
      math: 0.88,
      creative: 0.82,
      summarization: 0.87,
      translation: 0.90,
      data_analysis: 0.89,
      quick_answer: 0.90,
      conversation: 0.85,
      planning: 0.84,
      documentation: 0.85,
    },
    contextWindow: 1000000,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0004,
    avgLatencyMs: 600,
    rateLimit: 200,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
];

// ============ HELPERS ============

async function getMoEDir(repoRoot: string): Promise<string> {
  const dir = path.join(repoRoot, ".swarm", MOE_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function loadJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

async function saveJson<T>(filePath: string, data: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

/**
 * Estimate tokens from text (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English
  return Math.ceil(text.length / 4);
}

/**
 * Classify task category from content
 */
function classifyTask(content: string): TaskCategory {
  const lower = content.toLowerCase();
  
  // Code-related patterns
  if (/\b(write|create|implement|build|generate)\b.*\b(function|class|code|api|component)\b/i.test(content)) {
    return "code_generation";
  }
  if (/\b(review|check|analyze)\b.*\b(code|implementation|pr|pull request)\b/i.test(content)) {
    return "code_review";
  }
  if (/\b(refactor|optimize|improve|clean)\b.*\b(code|function|class)\b/i.test(content)) {
    return "code_refactor";
  }
  if (/\b(debug|fix|bug|error|issue|broken)\b/i.test(content)) {
    return "debugging";
  }
  
  // Reasoning patterns
  if (/\b(explain|why|how|reason|logic|think|analyze)\b/i.test(content) && content.length > 200) {
    return "reasoning";
  }
  if (/\b(calculate|compute|math|equation|formula|solve)\b/i.test(content)) {
    return "math";
  }
  
  // Creative patterns
  if (/\b(write|create|compose)\b.*\b(story|poem|essay|article|blog)\b/i.test(content)) {
    return "creative";
  }
  
  // Summary patterns
  if (/\b(summarize|summary|tldr|brief|overview)\b/i.test(content)) {
    return "summarization";
  }
  
  // Translation
  if (/\b(translate|translation|convert to)\b.*\b(english|spanish|french|german|chinese|japanese|russian)\b/i.test(content)) {
    return "translation";
  }
  
  // Data analysis
  if (/\b(analyze|data|statistics|trend|pattern|csv|json|dataset)\b/i.test(content)) {
    return "data_analysis";
  }
  
  // Planning
  if (/\b(plan|roadmap|architecture|design|strategy|approach)\b/i.test(content)) {
    return "planning";
  }
  
  // Documentation
  if (/\b(document|documentation|readme|docs|api docs|jsdoc)\b/i.test(content)) {
    return "documentation";
  }
  
  // Quick questions (short content)
  if (content.length < 100 && /\?$/.test(content.trim())) {
    return "quick_answer";
  }
  
  // Default to conversation
  return "conversation";
}

/**
 * Estimate complexity from content
 */
function estimateComplexity(content: string): TaskRequest["complexity"] {
  const tokens = estimateTokens(content);
  const hasCodeBlocks = /```[\s\S]*?```/.test(content);
  const hasMultipleParts = content.split(/\d+\./).length > 3;
  
  if (tokens < 50 && !hasCodeBlocks) return "trivial";
  if (tokens < 200 && !hasMultipleParts) return "simple";
  if (tokens < 500) return "medium";
  if (tokens < 2000 || hasMultipleParts) return "complex";
  return "extreme";
}

// ============ CORE FUNCTIONS ============

/**
 * Load configuration
 */
async function loadConfig(repoRoot: string): Promise<MoEConfig> {
  const dir = await getMoEDir(repoRoot);
  return loadJson(path.join(dir, CONFIG_FILE), DEFAULT_CONFIG);
}

/**
 * Save configuration
 */
async function saveConfig(repoRoot: string, config: MoEConfig): Promise<void> {
  const dir = await getMoEDir(repoRoot);
  await saveJson(path.join(dir, CONFIG_FILE), config);
}

/**
 * Load experts
 */
async function loadExperts(repoRoot: string): Promise<Expert[]> {
  const dir = await getMoEDir(repoRoot);
  const experts = await loadJson<Expert[]>(path.join(dir, EXPERTS_FILE), []);
  return experts.length > 0 ? experts : DEFAULT_EXPERTS;
}

/**
 * Save experts
 */
async function saveExperts(repoRoot: string, experts: Expert[]): Promise<void> {
  const dir = await getMoEDir(repoRoot);
  await saveJson(path.join(dir, EXPERTS_FILE), experts);
}

/**
 * Load history
 */
async function loadHistory(repoRoot: string): Promise<RoutingResult[]> {
  const dir = await getMoEDir(repoRoot);
  return loadJson(path.join(dir, HISTORY_FILE), []);
}

/**
 * Save history
 */
async function saveHistory(repoRoot: string, history: RoutingResult[]): Promise<void> {
  const dir = await getMoEDir(repoRoot);
  // Keep last 1000 entries
  const trimmed = history.slice(-1000);
  await saveJson(path.join(dir, HISTORY_FILE), trimmed);
}

/**
 * Load stats
 */
async function loadStats(repoRoot: string): Promise<MoEStats> {
  const dir = await getMoEDir(repoRoot);
  return loadJson(path.join(dir, STATS_FILE), {
    totalRequests: 0,
    successfulRoutes: 0,
    fallbacksUsed: 0,
    avgLatencyMs: 0,
    totalCost: 0,
    byCategory: {} as any,
    byExpert: {} as any,
    lastUpdated: Date.now(),
  });
}

/**
 * Save stats
 */
async function saveStats(repoRoot: string, stats: MoEStats): Promise<void> {
  const dir = await getMoEDir(repoRoot);
  await saveJson(path.join(dir, STATS_FILE), stats);
}

// ============ GATING NETWORK ============

/**
 * Calculate expert score for a task
 */
function calculateExpertScore(
  expert: Expert,
  task: TaskRequest,
  config: MoEConfig
): number {
  const category = task.category || classifyTask(task.content);
  
  // Task match score (how well expert handles this category)
  const taskMatch = expert.strengthScores[category] || 0.5;
  
  // Cost efficiency (inverse of cost, normalized)
  const estimatedTokens = estimateTokens(task.content);
  const estimatedCost = (estimatedTokens / 1000) * expert.costPer1kInput + 
                        (estimatedTokens / 1000) * 0.5 * expert.costPer1kOutput;
  const maxCost = 0.1; // $0.10 as reference
  const costEfficiency = 1 - Math.min(estimatedCost / maxCost, 1);
  
  // Performance score (historical success)
  const performanceScore = expert.successRate;
  
  // Load balance (prefer less recently used)
  const now = Date.now();
  const timeSinceUse = now - expert.lastUsed;
  const loadBalance = Math.min(timeSinceUse / 60000, 1); // Max out at 1 minute
  
  // Weighted combination
  const score = 
    taskMatch * config.qualityWeight +
    costEfficiency * config.costWeight +
    performanceScore * 0.1 +
    loadBalance * config.latencyWeight;
  
  return score;
}

/**
 * Route task to best expert
 */
export async function route(input: {
  repoPath?: string;
  content: string;
  category?: TaskCategory;
  complexity?: TaskRequest["complexity"];
  maxLatencyMs?: number;
  maxCost?: number;
  preferredProvider?: ModelProvider;
  preferredTier?: ModelTier;
  requiredContext?: number;
  priority?: TaskRequest["priority"];
}): Promise<RoutingDecision> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const config = await loadConfig(repoRoot);
  const experts = await loadExperts(repoRoot);
  const stats = await loadStats(repoRoot);
  
  const task: TaskRequest = {
    content: input.content,
    category: input.category || classifyTask(input.content),
    complexity: input.complexity || estimateComplexity(input.content),
    maxLatencyMs: input.maxLatencyMs,
    maxCost: input.maxCost,
    preferredProvider: input.preferredProvider,
    preferredTier: input.preferredTier,
    requiredContext: input.requiredContext,
    priority: input.priority || "normal",
  };
  
  // Filter available experts
  let candidates = experts.filter(e => e.available);
  
  // Apply constraints
  if (task.preferredProvider) {
    const providerExperts = candidates.filter(e => e.provider === task.preferredProvider);
    if (providerExperts.length > 0) candidates = providerExperts;
  }
  
  if (task.preferredTier) {
    const tierExperts = candidates.filter(e => e.tier === task.preferredTier);
    if (tierExperts.length > 0) candidates = tierExperts;
  }
  
  if (task.requiredContext) {
    candidates = candidates.filter(e => e.contextWindow >= task.requiredContext!);
  }
  
  if (task.maxLatencyMs) {
    candidates = candidates.filter(e => e.avgLatencyMs <= task.maxLatencyMs!);
  }
  
  // Score all candidates
  const scored = candidates.map(expert => ({
    expert,
    score: calculateExpertScore(expert, task, config),
    taskMatch: expert.strengthScores[task.category!] || 0.5,
  }));
  
  // Sort by score
  scored.sort((a, b) => b.score - a.score);
  
  if (scored.length === 0) {
    throw new Error("No suitable experts available for this task");
  }
  
  const selected = scored[0];
  const alternatives = scored.slice(1, 4).map(s => s.expert);
  
  // Estimate costs
  const inputTokens = estimateTokens(task.content);
  const outputTokens = Math.ceil(inputTokens * 0.5); // Rough estimate
  const estimatedCost = 
    (inputTokens / 1000) * selected.expert.costPer1kInput +
    (outputTokens / 1000) * selected.expert.costPer1kOutput;
  
  // Update stats
  stats.totalRequests++;
  stats.lastUpdated = Date.now();
  await saveStats(repoRoot, stats);
  
  return {
    selectedExpert: selected.expert,
    confidence: selected.score,
    alternatives,
    reasoning: `Selected ${selected.expert.name} for ${task.category} task. ` +
               `Task match: ${(selected.taskMatch * 100).toFixed(0)}%, ` +
               `Tier: ${selected.expert.tier}, ` +
               `Estimated cost: $${estimatedCost.toFixed(4)}`,
    estimatedCost,
    estimatedLatency: selected.expert.avgLatencyMs,
    estimatedTokens: {
      input: inputTokens,
      output: outputTokens,
    },
    factors: {
      taskMatch: selected.taskMatch,
      costEfficiency: 1 - (estimatedCost / 0.1),
      performanceScore: selected.expert.successRate,
      loadBalance: Math.min((Date.now() - selected.expert.lastUsed) / 60000, 1),
    },
  };
}

/**
 * Record routing result feedback
 */
export async function feedback(input: {
  repoPath?: string;
  requestId: string;
  expertId: string;
  success: boolean;
  actualLatencyMs?: number;
  actualCost?: number;
  quality?: number;
  comment?: string;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const experts = await loadExperts(repoRoot);
  const config = await loadConfig(repoRoot);
  const stats = await loadStats(repoRoot);
  const history = await loadHistory(repoRoot);
  
  // Find expert
  const expert = experts.find(e => e.id === input.expertId);
  if (!expert) {
    return { success: false, message: "Expert not found" };
  }
  
  // Update expert stats
  expert.lastUsed = Date.now();
  expert.totalCalls++;
  
  // Update success rate with exponential moving average
  if (config.learningEnabled) {
    const newSuccess = input.success ? 1 : 0;
    expert.successRate = expert.successRate * (1 - config.learningRate) + 
                         newSuccess * config.learningRate;
  }
  
  // Update latency
  if (input.actualLatencyMs) {
    expert.avgLatencyMs = expert.avgLatencyMs * 0.9 + input.actualLatencyMs * 0.1;
  }
  
  // Add to history
  history.push({
    requestId: input.requestId,
    decision: {
      selectedExpert: expert,
      confidence: 1,
      alternatives: [],
      reasoning: "Feedback recorded",
      estimatedCost: input.actualCost || 0,
      estimatedLatency: input.actualLatencyMs || 0,
      estimatedTokens: { input: 0, output: 0 },
      factors: { taskMatch: 0, costEfficiency: 0, performanceScore: 0, loadBalance: 0 },
    },
    timestamp: Date.now(),
    actualLatencyMs: input.actualLatencyMs,
    actualCost: input.actualCost,
    success: input.success,
    feedback: input.quality ? {
      quality: input.quality,
      comment: input.comment,
    } : undefined,
  });
  
  // Update global stats
  if (input.success) stats.successfulRoutes++;
  if (input.actualLatencyMs) {
    stats.avgLatencyMs = stats.avgLatencyMs * 0.9 + input.actualLatencyMs * 0.1;
  }
  if (input.actualCost) {
    stats.totalCost += input.actualCost;
  }
  
  // Update per-expert stats
  if (!stats.byExpert[expert.id]) {
    stats.byExpert[expert.id] = {
      calls: 0,
      avgLatency: 0,
      totalCost: 0,
      successRate: 1,
    };
  }
  stats.byExpert[expert.id].calls++;
  if (input.actualLatencyMs) {
    stats.byExpert[expert.id].avgLatency = 
      stats.byExpert[expert.id].avgLatency * 0.9 + input.actualLatencyMs * 0.1;
  }
  if (input.actualCost) {
    stats.byExpert[expert.id].totalCost += input.actualCost;
  }
  stats.byExpert[expert.id].successRate = expert.successRate;
  
  stats.lastUpdated = Date.now();
  
  await saveExperts(repoRoot, experts);
  await saveStats(repoRoot, stats);
  await saveHistory(repoRoot, history);
  
  return { success: true, message: `Feedback recorded for ${expert.name}` };
}

/**
 * Get all experts
 */
export async function getExperts(input: {
  repoPath?: string;
  provider?: ModelProvider;
  tier?: ModelTier;
  category?: TaskCategory;
}): Promise<Expert[]> {
  const repoRoot = await getRepoRoot(input.repoPath);
  let experts = await loadExperts(repoRoot);
  
  if (input.provider) {
    experts = experts.filter(e => e.provider === input.provider);
  }
  if (input.tier) {
    experts = experts.filter(e => e.tier === input.tier);
  }
  if (input.category) {
    experts = experts.filter(e => e.capabilities.includes(input.category!));
  }
  
  return experts;
}

/**
 * Add or update expert
 */
export async function addExpert(input: {
  repoPath?: string;
  expert: Partial<Expert> & { id: string; name: string; provider: ModelProvider; modelId: string };
}): Promise<{ success: boolean; expert: Expert }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const experts = await loadExperts(repoRoot);
  
  const existing = experts.find(e => e.id === input.expert.id);
  
  const expert: Expert = {
    id: input.expert.id,
    name: input.expert.name,
    provider: input.expert.provider,
    modelId: input.expert.modelId,
    tier: input.expert.tier || "standard",
    capabilities: input.expert.capabilities || ["conversation"],
    strengthScores: input.expert.strengthScores || {
      code_generation: 0.5,
      code_review: 0.5,
      code_refactor: 0.5,
      debugging: 0.5,
      reasoning: 0.5,
      math: 0.5,
      creative: 0.5,
      summarization: 0.5,
      translation: 0.5,
      data_analysis: 0.5,
      quick_answer: 0.5,
      conversation: 0.5,
      planning: 0.5,
      documentation: 0.5,
    },
    contextWindow: input.expert.contextWindow || 100000,
    costPer1kInput: input.expert.costPer1kInput || 0.001,
    costPer1kOutput: input.expert.costPer1kOutput || 0.002,
    avgLatencyMs: input.expert.avgLatencyMs || 2000,
    rateLimit: input.expert.rateLimit || 100,
    available: input.expert.available ?? true,
    lastUsed: existing?.lastUsed || 0,
    totalCalls: existing?.totalCalls || 0,
    successRate: existing?.successRate || 1.0,
  };
  
  if (existing) {
    Object.assign(existing, expert);
  } else {
    experts.push(expert);
  }
  
  await saveExperts(repoRoot, experts);
  return { success: true, expert };
}

/**
 * Remove expert
 */
export async function removeExpert(input: {
  repoPath?: string;
  expertId: string;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const experts = await loadExperts(repoRoot);
  
  const index = experts.findIndex(e => e.id === input.expertId);
  if (index === -1) {
    return { success: false, message: "Expert not found" };
  }
  
  const removed = experts.splice(index, 1)[0];
  await saveExperts(repoRoot, experts);
  
  return { success: true, message: `Removed expert: ${removed.name}` };
}

/**
 * Get configuration
 */
export async function getConfig(input: {
  repoPath?: string;
}): Promise<MoEConfig> {
  const repoRoot = await getRepoRoot(input.repoPath);
  return loadConfig(repoRoot);
}

/**
 * Update configuration
 */
export async function setConfig(input: {
  repoPath?: string;
  config: Partial<MoEConfig>;
}): Promise<{ success: boolean; config: MoEConfig }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const current = await loadConfig(repoRoot);
  const updated = { ...current, ...input.config };
  await saveConfig(repoRoot, updated);
  return { success: true, config: updated };
}

/**
 * Get statistics
 */
export async function getStats(input: {
  repoPath?: string;
}): Promise<MoEStats> {
  const repoRoot = await getRepoRoot(input.repoPath);
  return loadStats(repoRoot);
}

/**
 * Get routing history
 */
export async function getHistory(input: {
  repoPath?: string;
  limit?: number;
  expertId?: string;
}): Promise<RoutingResult[]> {
  const repoRoot = await getRepoRoot(input.repoPath);
  let history = await loadHistory(repoRoot);
  
  if (input.expertId) {
    history = history.filter(h => h.decision.selectedExpert.id === input.expertId);
  }
  
  return history.slice(-(input.limit || 50)).reverse();
}

/**
 * Classify task
 */
export async function classify(input: {
  repoPath?: string;
  content: string;
}): Promise<{
  category: TaskCategory;
  complexity: TaskRequest["complexity"];
  estimatedTokens: number;
}> {
  return {
    category: classifyTask(input.content),
    complexity: estimateComplexity(input.content),
    estimatedTokens: estimateTokens(input.content),
  };
}

/**
 * Reset expert stats
 */
export async function resetStats(input: {
  repoPath?: string;
  expertId?: string;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  
  if (input.expertId) {
    const experts = await loadExperts(repoRoot);
    const expert = experts.find(e => e.id === input.expertId);
    if (!expert) {
      return { success: false, message: "Expert not found" };
    }
    expert.totalCalls = 0;
    expert.successRate = 1.0;
    expert.lastUsed = 0;
    await saveExperts(repoRoot, experts);
    return { success: true, message: `Reset stats for ${expert.name}` };
  }
  
  // Reset all
  const stats: MoEStats = {
    totalRequests: 0,
    successfulRoutes: 0,
    fallbacksUsed: 0,
    avgLatencyMs: 0,
    totalCost: 0,
    byCategory: {} as any,
    byExpert: {} as any,
    lastUpdated: Date.now(),
  };
  await saveStats(repoRoot, stats);
  
  return { success: true, message: "All statistics reset" };
}

// ============ MAIN HANDLER ============

export type MoEAction =
  | "route"          // Route task to best expert
  | "feedback"       // Record routing feedback
  | "experts"        // List experts
  | "add_expert"     // Add/update expert
  | "remove_expert"  // Remove expert
  | "config"         // Get config
  | "set_config"     // Update config
  | "stats"          // Get statistics
  | "history"        // Get routing history
  | "classify"       // Classify task
  | "reset";         // Reset stats

export async function handleMoETool(input: {
  action: MoEAction;
  repoPath?: string;
  // For route
  content?: string;
  category?: TaskCategory;
  complexity?: TaskRequest["complexity"];
  maxLatencyMs?: number;
  maxCost?: number;
  preferredProvider?: ModelProvider;
  preferredTier?: ModelTier;
  requiredContext?: number;
  priority?: TaskRequest["priority"];
  // For feedback
  requestId?: string;
  expertId?: string;
  success?: boolean;
  actualLatencyMs?: number;
  actualCost?: number;
  quality?: number;
  comment?: string;
  // For experts
  provider?: ModelProvider;
  tier?: ModelTier;
  // For add_expert
  expert?: Partial<Expert> & { id: string; name: string; provider: ModelProvider; modelId: string };
  // For history
  limit?: number;
  // For set_config
  config?: Partial<MoEConfig>;
}): Promise<unknown> {
  switch (input.action) {
    case "route":
      return route({
        repoPath: input.repoPath,
        content: input.content || "",
        category: input.category,
        complexity: input.complexity,
        maxLatencyMs: input.maxLatencyMs,
        maxCost: input.maxCost,
        preferredProvider: input.preferredProvider,
        preferredTier: input.preferredTier,
        requiredContext: input.requiredContext,
        priority: input.priority,
      });

    case "feedback":
      return feedback({
        repoPath: input.repoPath,
        requestId: input.requestId || "",
        expertId: input.expertId || "",
        success: input.success ?? true,
        actualLatencyMs: input.actualLatencyMs,
        actualCost: input.actualCost,
        quality: input.quality,
        comment: input.comment,
      });

    case "experts":
      return getExperts({
        repoPath: input.repoPath,
        provider: input.provider,
        tier: input.tier,
        category: input.category,
      });

    case "add_expert":
      if (!input.expert) {
        return { error: "Expert data required" };
      }
      return addExpert({
        repoPath: input.repoPath,
        expert: input.expert,
      });

    case "remove_expert":
      return removeExpert({
        repoPath: input.repoPath,
        expertId: input.expertId || "",
      });

    case "config":
      return getConfig({ repoPath: input.repoPath });

    case "set_config":
      return setConfig({
        repoPath: input.repoPath,
        config: input.config || {},
      });

    case "stats":
      return getStats({ repoPath: input.repoPath });

    case "history":
      return getHistory({
        repoPath: input.repoPath,
        limit: input.limit,
        expertId: input.expertId,
      });

    case "classify":
      return classify({
        repoPath: input.repoPath,
        content: input.content || "",
      });

    case "reset":
      return resetStats({
        repoPath: input.repoPath,
        expertId: input.expertId,
      });

    default:
      return { error: `Unknown action: ${input.action}` };
  }
}
