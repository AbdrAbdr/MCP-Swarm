/**
 * SONA — Self-Optimizing Neural Architecture
 * 
 * MCP Swarm v0.9.5
 * 
 * A self-learning task routing system that:
 * 1. Records which agents perform best for each task type
 * 2. Routes new tasks to best-performing agents
 * 3. Learns from outcomes (<0.05ms adaptation)
 * 4. Improves over time with reinforcement learning
 * 
 * Inspired by Claude-Flow's SONA architecture but adapted for
 * distributed multi-agent coordination.
 * 
 * Key Features:
 * - Task Type Classification (semantic + keyword)
 * - Agent Performance Tracking (success rate, quality, speed)
 * - Elastic Weight Consolidation (EWC++) to prevent forgetting
 * - Online Learning with exponential decay
 * - Confidence-based routing with exploration/exploitation balance
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";

// ============ CONSTANTS ============

const SONA_DIR = ".swarm/sona";
const MODEL_FILE = "model.json";
const HISTORY_FILE = "history.json";
const METRICS_FILE = "metrics.json";

// Learning parameters
const LEARNING_RATE = 0.1;
const DECAY_FACTOR = 0.95; // Exponential decay for old data
const MIN_CONFIDENCE = 0.3;
const EXPLORATION_RATE = 0.1; // 10% chance to try non-optimal agent
const EWC_LAMBDA = 0.5; // Elastic Weight Consolidation strength

// ============ TYPES ============

/**
 * Task categories for classification
 */
export type TaskCategory =
  | "frontend_ui"      // UI components, styling, React/Vue
  | "backend_api"      // API routes, controllers, middleware
  | "database"         // Migrations, models, queries
  | "testing"          // Unit tests, integration tests
  | "devops"           // CI/CD, Docker, deployment
  | "documentation"    // Docs, README, comments
  | "refactoring"      // Code cleanup, optimization
  | "bugfix"           // Bug fixes, error handling
  | "feature"          // New features, enhancements
  | "security"         // Auth, permissions, validation
  | "performance"      // Speed optimization, caching
  | "infrastructure"   // Config, tooling, dependencies
  | "unknown";         // Unclassified

/**
 * Task complexity levels
 */
export type TaskComplexity = "trivial" | "simple" | "medium" | "complex" | "epic";

/**
 * Outcome of a task assignment
 */
export interface TaskOutcome {
  taskId: string;
  agentName: string;
  category: TaskCategory;
  complexity: TaskComplexity;
  success: boolean;          // Did the agent complete successfully?
  qualityScore: number;      // 0-1 quality rating (from review)
  timeMinutes: number;       // Time to complete
  errorCount: number;        // Number of errors/rejections
  reviewScore?: number;      // Code review score 0-1
  timestamp: number;
}

/**
 * Agent's performance profile for a category
 */
export interface AgentCategoryProfile {
  successRate: number;       // Rolling success rate 0-1
  avgQuality: number;        // Rolling average quality 0-1
  avgTimeMinutes: number;    // Rolling average completion time
  taskCount: number;         // Total tasks in this category
  lastUpdated: number;
  confidence: number;        // Statistical confidence 0-1
}

/**
 * Complete agent profile across all categories
 */
export interface AgentProfile {
  agentName: string;
  categories: Record<TaskCategory, AgentCategoryProfile>;
  overallScore: number;      // Weighted overall performance
  totalTasks: number;
  lastActive: number;
  specializations: TaskCategory[]; // Top 3 categories
}

/**
 * The SONA model state
 */
export interface SONAModel {
  version: string;
  agents: Record<string, AgentProfile>;
  categoryWeights: Record<TaskCategory, number>; // Fisher Information for EWC
  globalStats: {
    totalTasks: number;
    avgSuccessRate: number;
    avgQuality: number;
    lastUpdated: number;
  };
  config: SONAConfig;
}

/**
 * SONA configuration
 */
export interface SONAConfig {
  learningRate: number;
  decayFactor: number;
  explorationRate: number;
  minConfidence: number;
  ewcLambda: number;
  enabled: boolean;
  autoLearn: boolean;        // Auto-update from task completions
  preferSpecialists: boolean; // Prefer agents specialized in category
}

/**
 * Routing recommendation from SONA
 */
export interface SONARecommendation {
  recommendedAgent: string | null;
  confidence: number;
  category: TaskCategory;
  complexity: TaskComplexity;
  reasoning: string;
  alternatives: Array<{
    agent: string;
    score: number;
    reason: string;
  }>;
  isExploration: boolean;    // True if this is an exploratory choice
  expectedQuality: number;
  expectedTimeMinutes: number;
}

/**
 * Task classification result
 */
export interface TaskClassification {
  category: TaskCategory;
  confidence: number;
  complexity: TaskComplexity;
  keywords: string[];
  affectedAreas: string[];
}

// ============ HELPER FUNCTIONS ============

/**
 * Get SONA directory path
 */
async function getSONADir(repoRoot: string): Promise<string> {
  const sonaDir = path.join(repoRoot, SONA_DIR);
  await fs.mkdir(sonaDir, { recursive: true });
  return sonaDir;
}

/**
 * Load SONA model from disk
 */
async function loadModel(repoRoot: string): Promise<SONAModel> {
  const sonaDir = await getSONADir(repoRoot);
  const modelPath = path.join(sonaDir, MODEL_FILE);
  
  try {
    const raw = await fs.readFile(modelPath, "utf8");
    return JSON.parse(raw) as SONAModel;
  } catch {
    // Return default model
    return createDefaultModel();
  }
}

/**
 * Save SONA model to disk
 */
async function saveModel(repoRoot: string, model: SONAModel): Promise<void> {
  const sonaDir = await getSONADir(repoRoot);
  const modelPath = path.join(sonaDir, MODEL_FILE);
  model.globalStats.lastUpdated = Date.now();
  await fs.writeFile(modelPath, JSON.stringify(model, null, 2), "utf8");
}

/**
 * Create default SONA model
 */
function createDefaultModel(): SONAModel {
  const defaultConfig: SONAConfig = {
    learningRate: LEARNING_RATE,
    decayFactor: DECAY_FACTOR,
    explorationRate: EXPLORATION_RATE,
    minConfidence: MIN_CONFIDENCE,
    ewcLambda: EWC_LAMBDA,
    enabled: true,
    autoLearn: true,
    preferSpecialists: true,
  };

  const categoryWeights: Record<TaskCategory, number> = {
    frontend_ui: 1.0,
    backend_api: 1.0,
    database: 1.0,
    testing: 1.0,
    devops: 1.0,
    documentation: 0.5,
    refactoring: 0.8,
    bugfix: 1.2,
    feature: 1.0,
    security: 1.5,
    performance: 1.2,
    infrastructure: 0.8,
    unknown: 0.5,
  };

  return {
    version: "0.9.5",
    agents: {},
    categoryWeights,
    globalStats: {
      totalTasks: 0,
      avgSuccessRate: 0,
      avgQuality: 0,
      lastUpdated: Date.now(),
    },
    config: defaultConfig,
  };
}

/**
 * Create default agent profile
 */
function createDefaultAgentProfile(agentName: string): AgentProfile {
  const categories: Record<TaskCategory, AgentCategoryProfile> = {} as any;
  const allCategories: TaskCategory[] = [
    "frontend_ui", "backend_api", "database", "testing", "devops",
    "documentation", "refactoring", "bugfix", "feature", "security",
    "performance", "infrastructure", "unknown"
  ];

  for (const cat of allCategories) {
    categories[cat] = {
      successRate: 0.5, // Prior: 50% success
      avgQuality: 0.5,
      avgTimeMinutes: 30,
      taskCount: 0,
      lastUpdated: Date.now(),
      confidence: 0,
    };
  }

  return {
    agentName,
    categories,
    overallScore: 0.5,
    totalTasks: 0,
    lastActive: Date.now(),
    specializations: [],
  };
}

// ============ TASK CLASSIFICATION ============

/**
 * Keyword patterns for task classification
 */
const CATEGORY_PATTERNS: Record<TaskCategory, RegExp[]> = {
  frontend_ui: [
    /\b(react|vue|angular|svelte|component|ui|ux|css|style|button|form|modal|page|layout|responsive|tailwind|styled)/i,
    /\b(frontend|front-end|client-side|dom|jsx|tsx|html)/i,
  ],
  backend_api: [
    /\b(api|endpoint|route|controller|middleware|rest|graphql|grpc|server|handler)/i,
    /\b(backend|back-end|express|fastify|nest|koa|hono)/i,
  ],
  database: [
    /\b(database|db|sql|nosql|mongo|postgres|mysql|redis|prisma|drizzle|migration|model|schema|query)/i,
    /\b(orm|repository|entity|table|collection|index)/i,
  ],
  testing: [
    /\b(test|spec|jest|vitest|mocha|cypress|playwright|e2e|unit|integration|coverage|mock|stub)/i,
    /\b(tdd|bdd|assertion|expect|describe|it\s*\()/i,
  ],
  devops: [
    /\b(docker|kubernetes|k8s|ci|cd|pipeline|deploy|github\s*actions|gitlab|jenkins|terraform|ansible)/i,
    /\b(container|image|helm|argocd|workflow)/i,
  ],
  documentation: [
    /\b(doc|readme|changelog|comment|jsdoc|tsdoc|wiki|guide|tutorial|example)/i,
    /\b(documentation|api\s*doc|openapi|swagger)/i,
  ],
  refactoring: [
    /\b(refactor|cleanup|clean\s*up|reorganize|restructure|simplify|optimize|improve|modernize)/i,
    /\b(rename|extract|inline|move|split|merge|consolidate)/i,
  ],
  bugfix: [
    /\b(bug|fix|issue|error|crash|broken|not\s*working|regression|hotfix|patch)/i,
    /\b(debug|troubleshoot|resolve|repair)/i,
  ],
  feature: [
    /\b(feature|implement|add|create|new|build|develop|introduce)/i,
    /\b(enhancement|improvement|capability)/i,
  ],
  security: [
    /\b(security|auth|authentication|authorization|permission|role|jwt|oauth|cors|csrf|xss|injection)/i,
    /\b(encrypt|hash|password|token|session|cookie)/i,
  ],
  performance: [
    /\b(performance|speed|fast|slow|optimize|cache|lazy|bundle|minify|compress)/i,
    /\b(memory|cpu|profil|benchmark|latency|throughput)/i,
  ],
  infrastructure: [
    /\b(config|configuration|setup|install|dependency|package|npm|yarn|pnpm|tsconfig|eslint|prettier)/i,
    /\b(tooling|build|webpack|vite|rollup|esbuild)/i,
  ],
  unknown: [],
};

/**
 * Complexity indicators
 */
const COMPLEXITY_INDICATORS = {
  trivial: {
    patterns: [/\b(typo|rename|update\s*version|bump|simple\s*fix|minor)/i],
    maxFiles: 2,
    maxLines: 50,
  },
  simple: {
    patterns: [/\b(small|quick|easy|straightforward|basic)/i],
    maxFiles: 5,
    maxLines: 200,
  },
  medium: {
    patterns: [/\b(moderate|standard|normal|typical)/i],
    maxFiles: 10,
    maxLines: 500,
  },
  complex: {
    patterns: [/\b(complex|complicated|difficult|challenging|large|major)/i],
    maxFiles: 20,
    maxLines: 2000,
  },
  epic: {
    patterns: [/\b(epic|massive|huge|redesign|rewrite|overhaul|architecture)/i],
    maxFiles: Infinity,
    maxLines: Infinity,
  },
};

/**
 * Classify a task based on title and description
 */
export async function classifyTask(input: {
  repoPath?: string;
  title: string;
  description: string;
  affectedFiles?: string[];
}): Promise<TaskClassification> {
  const text = `${input.title} ${input.description}`.toLowerCase();
  const scores: Record<TaskCategory, number> = {} as any;
  const keywords: string[] = [];
  
  // Score each category
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    let score = 0;
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        score += matches.length;
        keywords.push(...matches.map(m => m.trim()));
      }
    }
    scores[category as TaskCategory] = score;
  }
  
  // Find best category
  let bestCategory: TaskCategory = "unknown";
  let bestScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat as TaskCategory;
    }
  }
  
  // Calculate confidence (normalized)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? bestScore / totalScore : 0;
  
  // Determine complexity
  let complexity: TaskComplexity = "medium";
  for (const [level, config] of Object.entries(COMPLEXITY_INDICATORS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        complexity = level as TaskComplexity;
        break;
      }
    }
  }
  
  // Use file count as additional complexity signal
  if (input.affectedFiles) {
    const fileCount = input.affectedFiles.length;
    if (fileCount <= 2) complexity = "trivial";
    else if (fileCount <= 5) complexity = "simple";
    else if (fileCount <= 10) complexity = "medium";
    else if (fileCount <= 20) complexity = "complex";
    else complexity = "epic";
  }
  
  // Affected areas from file paths
  const affectedAreas: string[] = [];
  if (input.affectedFiles) {
    for (const file of input.affectedFiles.slice(0, 10)) {
      const parts = file.replace(/\\/g, "/").split("/");
      if (parts.length > 1) {
        affectedAreas.push(parts[0]);
      }
    }
  }
  
  return {
    category: bestCategory,
    confidence: Math.min(confidence + 0.2, 1), // Boost confidence slightly
    complexity,
    keywords: [...new Set(keywords)].slice(0, 10),
    affectedAreas: [...new Set(affectedAreas)],
  };
}

// ============ LEARNING FUNCTIONS ============

/**
 * Update agent profile with new task outcome (Online Learning)
 */
function updateAgentProfile(
  profile: AgentProfile,
  outcome: TaskOutcome,
  config: SONAConfig
): AgentProfile {
  const category = outcome.category;
  const catProfile = profile.categories[category];
  
  // Apply exponential moving average for online learning
  const alpha = config.learningRate;
  const n = catProfile.taskCount + 1;
  
  // Update rolling metrics with decay
  catProfile.successRate = catProfile.successRate * (1 - alpha) + 
    (outcome.success ? 1 : 0) * alpha;
  
  catProfile.avgQuality = catProfile.avgQuality * (1 - alpha) + 
    outcome.qualityScore * alpha;
  
  catProfile.avgTimeMinutes = catProfile.avgTimeMinutes * (1 - alpha) + 
    outcome.timeMinutes * alpha;
  
  catProfile.taskCount = n;
  catProfile.lastUpdated = Date.now();
  
  // Calculate confidence (based on sample size)
  // Uses Wilson score interval approximation
  const z = 1.96; // 95% confidence
  const phat = catProfile.successRate;
  catProfile.confidence = Math.min(
    1,
    phat - z * Math.sqrt((phat * (1 - phat) + z * z / (4 * n)) / n) / 
      (1 + z * z / n)
  );
  
  // Update overall stats
  profile.totalTasks++;
  profile.lastActive = Date.now();
  
  // Recalculate overall score (weighted average)
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [cat, cp] of Object.entries(profile.categories)) {
    if (cp.taskCount > 0) {
      const weight = cp.taskCount * cp.confidence;
      totalWeight += weight;
      weightedSum += (cp.successRate * 0.6 + cp.avgQuality * 0.4) * weight;
    }
  }
  profile.overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  
  // Update specializations (top 3 categories by score)
  const categoryScores = Object.entries(profile.categories)
    .filter(([_, cp]) => cp.taskCount >= 3)
    .map(([cat, cp]) => ({
      category: cat as TaskCategory,
      score: cp.successRate * 0.6 + cp.avgQuality * 0.4,
    }))
    .sort((a, b) => b.score - a.score);
  
  profile.specializations = categoryScores
    .slice(0, 3)
    .map(cs => cs.category);
  
  return profile;
}

/**
 * Apply Elastic Weight Consolidation to prevent catastrophic forgetting
 */
function applyEWC(
  oldProfile: AgentCategoryProfile,
  newProfile: AgentCategoryProfile,
  fisherWeight: number,
  lambda: number
): AgentCategoryProfile {
  // EWC adds a penalty for moving away from old weights
  // proportional to their importance (Fisher information)
  const ewcPenalty = lambda * fisherWeight;
  
  // Blend old and new values based on importance
  const blend = 1 / (1 + ewcPenalty);
  
  return {
    ...newProfile,
    successRate: newProfile.successRate * blend + 
      oldProfile.successRate * (1 - blend),
    avgQuality: newProfile.avgQuality * blend + 
      oldProfile.avgQuality * (1 - blend),
    avgTimeMinutes: newProfile.avgTimeMinutes * blend + 
      oldProfile.avgTimeMinutes * (1 - blend),
  };
}

// ============ ROUTING FUNCTIONS ============

/**
 * Calculate agent score for a specific category
 */
function calculateAgentScore(
  profile: AgentProfile,
  category: TaskCategory,
  complexity: TaskComplexity,
  categoryWeight: number
): number {
  const catProfile = profile.categories[category];
  
  // Base score from success rate and quality
  let score = catProfile.successRate * 0.5 + catProfile.avgQuality * 0.3;
  
  // Confidence bonus
  score += catProfile.confidence * 0.1;
  
  // Specialization bonus
  if (profile.specializations.includes(category)) {
    const specIndex = profile.specializations.indexOf(category);
    score += (3 - specIndex) * 0.05; // Top spec gets +0.15
  }
  
  // Recency bonus (agents active recently get slight boost)
  const hoursSinceActive = (Date.now() - profile.lastActive) / (1000 * 60 * 60);
  if (hoursSinceActive < 1) score += 0.05;
  else if (hoursSinceActive < 24) score += 0.02;
  
  // Apply category weight
  score *= categoryWeight;
  
  // Complexity adjustment
  const complexityMultipliers: Record<TaskComplexity, number> = {
    trivial: 0.8,
    simple: 0.9,
    medium: 1.0,
    complex: 1.1,
    epic: 1.2,
  };
  
  // For complex tasks, prefer agents with high confidence
  if (complexity === "complex" || complexity === "epic") {
    score *= catProfile.confidence + 0.5;
  }
  
  return score * complexityMultipliers[complexity];
}

/**
 * Get routing recommendation from SONA
 */
export async function route(input: {
  repoPath?: string;
  title: string;
  description: string;
  affectedFiles?: string[];
  availableAgents?: string[];
  forceExplore?: boolean;
}): Promise<SONARecommendation> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const model = await loadModel(repoRoot);
  
  if (!model.config.enabled) {
    return {
      recommendedAgent: null,
      confidence: 0,
      category: "unknown",
      complexity: "medium",
      reasoning: "SONA is disabled",
      alternatives: [],
      isExploration: false,
      expectedQuality: 0.5,
      expectedTimeMinutes: 30,
    };
  }
  
  // Classify the task
  const classification = await classifyTask({
    repoPath: input.repoPath,
    title: input.title,
    description: input.description,
    affectedFiles: input.affectedFiles,
  });
  
  // Filter available agents
  const availableAgents = input.availableAgents || Object.keys(model.agents);
  if (availableAgents.length === 0) {
    return {
      recommendedAgent: null,
      confidence: 0,
      category: classification.category,
      complexity: classification.complexity,
      reasoning: "No agents available",
      alternatives: [],
      isExploration: false,
      expectedQuality: 0.5,
      expectedTimeMinutes: 30,
    };
  }
  
  // Score each agent
  const scores: Array<{
    agent: string;
    score: number;
    profile: AgentProfile;
  }> = [];
  
  for (const agentName of availableAgents) {
    let profile = model.agents[agentName];
    if (!profile) {
      // Unknown agent gets default profile
      profile = createDefaultAgentProfile(agentName);
    }
    
    const score = calculateAgentScore(
      profile,
      classification.category,
      classification.complexity,
      model.categoryWeights[classification.category]
    );
    
    scores.push({ agent: agentName, score, profile });
  }
  
  // Sort by score
  scores.sort((a, b) => b.score - a.score);
  
  // Decide: exploit (best agent) or explore (random agent)
  let selectedIndex = 0;
  let isExploration = false;
  
  if (input.forceExplore || Math.random() < model.config.explorationRate) {
    // Exploration: pick a random agent (with some bias toward better ones)
    const weights = scores.map((s, i) => Math.pow(0.7, i)); // Exponential decay
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        selectedIndex = i;
        break;
      }
    }
    isExploration = selectedIndex !== 0;
  }
  
  const selected = scores[selectedIndex];
  const catProfile = selected.profile.categories[classification.category];
  
  // Build alternatives list
  const alternatives = scores
    .filter((_, i) => i !== selectedIndex)
    .slice(0, 3)
    .map(s => ({
      agent: s.agent,
      score: Math.round(s.score * 100) / 100,
      reason: s.profile.specializations.includes(classification.category)
        ? `Specialist in ${classification.category}`
        : `Score: ${Math.round(s.score * 100)}%`,
    }));
  
  // Build reasoning
  let reasoning = `Best match for ${classification.category} task`;
  if (isExploration) {
    reasoning = `Exploration choice (learning mode)`;
  } else if (selected.profile.specializations[0] === classification.category) {
    reasoning = `Top specialist in ${classification.category}`;
  } else if (catProfile.taskCount > 10 && catProfile.successRate > 0.8) {
    reasoning = `Proven track record: ${Math.round(catProfile.successRate * 100)}% success`;
  }
  
  return {
    recommendedAgent: selected.agent,
    confidence: catProfile.confidence,
    category: classification.category,
    complexity: classification.complexity,
    reasoning,
    alternatives,
    isExploration,
    expectedQuality: catProfile.avgQuality,
    expectedTimeMinutes: catProfile.avgTimeMinutes,
  };
}

// ============ LEARNING API ============

/**
 * Record a task outcome and update the model
 */
export async function learn(input: {
  repoPath?: string;
  taskId: string;
  agentName: string;
  title: string;
  description: string;
  success: boolean;
  qualityScore: number;  // 0-1
  timeMinutes: number;
  errorCount?: number;
  reviewScore?: number;
}): Promise<{
  success: boolean;
  message: string;
  agentProfile?: AgentProfile;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const model = await loadModel(repoRoot);
  
  if (!model.config.autoLearn) {
    return { success: false, message: "Auto-learning is disabled" };
  }
  
  // Classify the task
  const classification = await classifyTask({
    repoPath: input.repoPath,
    title: input.title,
    description: input.description,
  });
  
  // Create outcome record
  const outcome: TaskOutcome = {
    taskId: input.taskId,
    agentName: input.agentName,
    category: classification.category,
    complexity: classification.complexity,
    success: input.success,
    qualityScore: input.qualityScore,
    timeMinutes: input.timeMinutes,
    errorCount: input.errorCount || 0,
    reviewScore: input.reviewScore,
    timestamp: Date.now(),
  };
  
  // Get or create agent profile
  if (!model.agents[input.agentName]) {
    model.agents[input.agentName] = createDefaultAgentProfile(input.agentName);
  }
  
  const oldProfile = JSON.parse(JSON.stringify(
    model.agents[input.agentName]
  )) as AgentProfile;
  
  // Update profile with online learning
  model.agents[input.agentName] = updateAgentProfile(
    model.agents[input.agentName],
    outcome,
    model.config
  );
  
  // Apply EWC to prevent forgetting
  const catProfile = model.agents[input.agentName].categories[classification.category];
  const oldCatProfile = oldProfile.categories[classification.category];
  const ewcApplied = applyEWC(
    oldCatProfile,
    catProfile,
    model.categoryWeights[classification.category],
    model.config.ewcLambda
  );
  model.agents[input.agentName].categories[classification.category] = ewcApplied;
  
  // Update global stats
  model.globalStats.totalTasks++;
  const alpha = 0.05; // Slow update for global stats
  model.globalStats.avgSuccessRate = 
    model.globalStats.avgSuccessRate * (1 - alpha) + 
    (input.success ? 1 : 0) * alpha;
  model.globalStats.avgQuality = 
    model.globalStats.avgQuality * (1 - alpha) + 
    input.qualityScore * alpha;
  
  // Save updated model
  await saveModel(repoRoot, model);
  
  // Save to history
  const sonaDir = await getSONADir(repoRoot);
  const historyPath = path.join(sonaDir, HISTORY_FILE);
  let history: TaskOutcome[] = [];
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    history = JSON.parse(raw);
  } catch {}
  history.push(outcome);
  if (history.length > 1000) history = history.slice(-1000);
  await fs.writeFile(historyPath, JSON.stringify(history, null, 2), "utf8");
  
  return {
    success: true,
    message: `Learned from ${input.agentName}'s ${input.success ? "success" : "failure"} on ${classification.category} task`,
    agentProfile: model.agents[input.agentName],
  };
}

// ============ QUERY API ============

/**
 * Get agent's complete profile
 */
export async function getAgentProfile(input: {
  repoPath?: string;
  agentName: string;
}): Promise<AgentProfile | null> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const model = await loadModel(repoRoot);
  return model.agents[input.agentName] || null;
}

/**
 * Get all agent profiles
 */
export async function getAllProfiles(input: {
  repoPath?: string;
}): Promise<{
  agents: AgentProfile[];
  globalStats: SONAModel["globalStats"];
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const model = await loadModel(repoRoot);
  
  return {
    agents: Object.values(model.agents).sort(
      (a, b) => b.overallScore - a.overallScore
    ),
    globalStats: model.globalStats,
  };
}

/**
 * Get specialists for a category
 */
export async function getSpecialists(input: {
  repoPath?: string;
  category: TaskCategory;
  limit?: number;
}): Promise<Array<{
  agent: string;
  score: number;
  confidence: number;
  taskCount: number;
}>> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const model = await loadModel(repoRoot);
  
  const specialists = Object.values(model.agents)
    .map(profile => ({
      agent: profile.agentName,
      score: profile.categories[input.category].successRate * 0.6 +
        profile.categories[input.category].avgQuality * 0.4,
      confidence: profile.categories[input.category].confidence,
      taskCount: profile.categories[input.category].taskCount,
    }))
    .filter(s => s.taskCount > 0)
    .sort((a, b) => b.score - a.score);
  
  return specialists.slice(0, input.limit || 5);
}

/**
 * Get learning history
 */
export async function getHistory(input: {
  repoPath?: string;
  agentName?: string;
  category?: TaskCategory;
  limit?: number;
}): Promise<TaskOutcome[]> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const sonaDir = await getSONADir(repoRoot);
  const historyPath = path.join(sonaDir, HISTORY_FILE);
  
  let history: TaskOutcome[] = [];
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    history = JSON.parse(raw);
  } catch {}
  
  // Filter by agent/category if specified
  if (input.agentName) {
    history = history.filter(h => h.agentName === input.agentName);
  }
  if (input.category) {
    history = history.filter(h => h.category === input.category);
  }
  
  return history.slice(-(input.limit || 100));
}

// ============ CONFIG API ============

/**
 * Get SONA configuration
 */
export async function getConfig(input: {
  repoPath?: string;
}): Promise<SONAConfig> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const model = await loadModel(repoRoot);
  return model.config;
}

/**
 * Update SONA configuration
 */
export async function setConfig(input: {
  repoPath?: string;
  config: Partial<SONAConfig>;
}): Promise<{ success: boolean; config: SONAConfig }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const model = await loadModel(repoRoot);
  
  model.config = { ...model.config, ...input.config };
  await saveModel(repoRoot, model);
  
  return { success: true, config: model.config };
}

/**
 * Reset SONA model (start fresh)
 */
export async function reset(input: {
  repoPath?: string;
  keepConfig?: boolean;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const oldModel = await loadModel(repoRoot);
  
  const newModel = createDefaultModel();
  if (input.keepConfig) {
    newModel.config = oldModel.config;
  }
  
  await saveModel(repoRoot, newModel);
  
  // Clear history
  const sonaDir = await getSONADir(repoRoot);
  const historyPath = path.join(sonaDir, HISTORY_FILE);
  await fs.writeFile(historyPath, "[]", "utf8");
  
  return { success: true, message: "SONA model reset successfully" };
}

/**
 * Get SONA stats/metrics
 */
export async function getStats(input: {
  repoPath?: string;
}): Promise<{
  totalAgents: number;
  totalTasks: number;
  avgSuccessRate: number;
  avgQuality: number;
  topCategories: Array<{ category: TaskCategory; count: number }>;
  topAgents: Array<{ agent: string; score: number }>;
  learningEnabled: boolean;
  explorationRate: number;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const model = await loadModel(repoRoot);
  const history = await getHistory({ repoPath: input.repoPath, limit: 1000 });
  
  // Count tasks per category
  const categoryCounts: Record<TaskCategory, number> = {} as any;
  for (const h of history) {
    categoryCounts[h.category] = (categoryCounts[h.category] || 0) + 1;
  }
  
  const topCategories = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category: category as TaskCategory, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  const topAgents = Object.values(model.agents)
    .map(a => ({ agent: a.agentName, score: a.overallScore }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  
  return {
    totalAgents: Object.keys(model.agents).length,
    totalTasks: model.globalStats.totalTasks,
    avgSuccessRate: Math.round(model.globalStats.avgSuccessRate * 100) / 100,
    avgQuality: Math.round(model.globalStats.avgQuality * 100) / 100,
    topCategories,
    topAgents,
    learningEnabled: model.config.autoLearn,
    explorationRate: model.config.explorationRate,
  };
}

// ============ MAIN HANDLER ============

export type SONAAction =
  | "route"           // Get routing recommendation
  | "learn"           // Record task outcome
  | "classify"        // Classify a task
  | "profile"         // Get agent profile
  | "profiles"        // Get all profiles
  | "specialists"     // Get specialists for category
  | "history"         // Get learning history
  | "stats"           // Get SONA statistics
  | "config"          // Get configuration
  | "set_config"      // Update configuration
  | "reset";          // Reset model

export async function handleSONATool(input: {
  action: SONAAction;
  repoPath?: string;
  // For route/classify
  title?: string;
  description?: string;
  affectedFiles?: string[];
  availableAgents?: string[];
  forceExplore?: boolean;
  // For learn
  taskId?: string;
  agentName?: string;
  success?: boolean;
  qualityScore?: number;
  timeMinutes?: number;
  errorCount?: number;
  reviewScore?: number;
  // For specialists
  category?: TaskCategory;
  limit?: number;
  // For set_config
  config?: Partial<SONAConfig>;
  // For reset
  keepConfig?: boolean;
}): Promise<unknown> {
  switch (input.action) {
    case "route":
      return route({
        repoPath: input.repoPath,
        title: input.title || "",
        description: input.description || "",
        affectedFiles: input.affectedFiles,
        availableAgents: input.availableAgents,
        forceExplore: input.forceExplore,
      });

    case "learn":
      return learn({
        repoPath: input.repoPath,
        taskId: input.taskId || `task_${Date.now()}`,
        agentName: input.agentName || "unknown",
        title: input.title || "",
        description: input.description || "",
        success: input.success ?? true,
        qualityScore: input.qualityScore ?? 0.8,
        timeMinutes: input.timeMinutes ?? 30,
        errorCount: input.errorCount,
        reviewScore: input.reviewScore,
      });

    case "classify":
      return classifyTask({
        repoPath: input.repoPath,
        title: input.title || "",
        description: input.description || "",
        affectedFiles: input.affectedFiles,
      });

    case "profile":
      return getAgentProfile({
        repoPath: input.repoPath,
        agentName: input.agentName || "",
      });

    case "profiles":
      return getAllProfiles({ repoPath: input.repoPath });

    case "specialists":
      return getSpecialists({
        repoPath: input.repoPath,
        category: input.category || "unknown",
        limit: input.limit,
      });

    case "history":
      return getHistory({
        repoPath: input.repoPath,
        agentName: input.agentName,
        category: input.category,
        limit: input.limit,
      });

    case "stats":
      return getStats({ repoPath: input.repoPath });

    case "config":
      return getConfig({ repoPath: input.repoPath });

    case "set_config":
      return setConfig({
        repoPath: input.repoPath,
        config: input.config || {},
      });

    case "reset":
      return reset({
        repoPath: input.repoPath,
        keepConfig: input.keepConfig,
      });

    default:
      throw new Error(`Unknown SONA action: ${input.action}`);
  }
}
