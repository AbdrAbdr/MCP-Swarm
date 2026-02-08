/**
 * MCP Swarm v0.9.17 - Smart Tools: analytics
 * Auto-generated from smartTools.ts
 */

import { z } from "zod";

import { analyzeTaskComplexity, getAvailableModels, selectModel, recommendModel, routeTask, logUsage, getUsage, getUsageStats, getBudgetConfig, setBudgetConfig, checkBudget, getRemainingBudget, generateCostReport } from "../workflows/costOptimization.js";
import { handleSONATool } from "../workflows/sona.js";
import { handleMoETool } from "../workflows/moeRouter.js";
import { runQualityGate, getQualityReport, setQualityThreshold, checkPrReady } from "../workflows/qualityGate.js";
import { logApiUsage, getAgentCosts, getProjectCosts, setBudgetLimit, checkBudgetRemaining } from "../workflows/costOptimization.js";
import { saveBaseline, checkRegression, listRegressions, resolveRegression, listBaselines } from "../workflows/regressionDetector.js";

// Helper to wrap results
function wrapResult(result: any) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}


/**
 * 21. swarm_cost - API cost tracking
 */
export const swarmCostTool = [
  "swarm_cost",
  {
    title: "Swarm Cost",
    description: "API cost tracking. Actions: log, agent, project, limit, remaining",
    inputSchema: z.object({
      action: z.enum(["log", "agent", "project", "limit", "remaining"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      agent: z.string().optional().describe("Agent name"),
      model: z.string().optional().describe("Model name (for log)"),
      inputTokens: z.number().optional().describe("Input tokens (for log)"),
      outputTokens: z.number().optional().describe("Output tokens (for log)"),
      taskId: z.string().optional().describe("Task ID (for log)"),
      tool: z.string().optional().describe("Tool name (for log)"),
      periodDays: z.number().optional().describe("Period days (for agent, project)"),
      dailyLimit: z.number().optional().describe("Daily limit (for limit)"),
      monthlyLimit: z.number().optional().describe("Monthly limit (for limit)"),
      perAgentLimit: z.number().optional().describe("Per agent limit (for limit)"),
      alertThreshold: z.number().optional().describe("Alert threshold (for limit)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "log":
        return wrapResult(await logApiUsage({
          repoPath: input.repoPath,
          agent: input.agent,
          model: input.model,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          taskId: input.taskId,
          tool: input.tool,
        }));
      case "agent":
        return wrapResult(await getAgentCosts({
          repoPath: input.repoPath,
          agent: input.agent,
          periodDays: input.periodDays,
        }));
      case "project":
        return wrapResult(await getProjectCosts({
          repoPath: input.repoPath,
          periodDays: input.periodDays,
        }));
      case "limit":
        return wrapResult(await setBudgetLimit({
          repoPath: input.repoPath,
          dailyLimit: input.dailyLimit,
          monthlyLimit: input.monthlyLimit,
          perAgentLimit: input.perAgentLimit,
          alertThreshold: input.alertThreshold,
          commitMode: input.commitMode || "push",
        }));
      case "remaining":
        return wrapResult(await checkBudgetRemaining({
          repoPath: input.repoPath,
          agent: input.agent,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

// ============ TOOL 54: MOE ROUTER ============

export const swarmMoETool = [
  "swarm_moe",
  {
    title: "Swarm MoE Router",
    description: `Mixture of Experts — intelligent model routing for optimal performance and cost.

Routes tasks to the best AI model based on task type, complexity, cost constraints, and performance history.

Actions:
- route: Route task to best expert model
- feedback: Record routing result feedback (for learning)
- experts: List available expert models
- add_expert: Add or update an expert model
- remove_expert: Remove an expert model
- config: Get MoE configuration
- set_config: Update configuration
- stats: Get routing statistics
- history: Get routing history
- classify: Classify task category and complexity
- reset: Reset statistics

Built-in Experts: Claude Opus/Sonnet/Haiku, GPT-4o/Mini, o1, Gemini 2.0 Flash

Task Categories: code_generation, code_review, debugging, reasoning, math, creative, summarization, data_analysis, planning, documentation`,
    inputSchema: z.object({
      action: z.enum([
        "route", "feedback", "experts", "add_expert", "remove_expert",
        "config", "set_config", "stats", "history", "classify", "reset"
      ]).describe("Action to perform"),
      repoPath: z.string().optional().describe("Repository path"),
      // For route/classify
      content: z.string().optional().describe("Task content to route"),
      category: z.enum([
        "code_generation", "code_review", "code_refactor", "debugging",
        "reasoning", "math", "creative", "summarization", "translation",
        "data_analysis", "quick_answer", "conversation", "planning", "documentation"
      ]).optional().describe("Task category"),
      complexity: z.enum(["trivial", "simple", "medium", "complex", "extreme"]).optional(),
      maxLatencyMs: z.number().optional().describe("Maximum latency constraint"),
      maxCost: z.number().optional().describe("Maximum cost constraint"),
      preferredProvider: z.enum(["anthropic", "openai", "google", "mistral", "local", "custom"]).optional(),
      preferredTier: z.enum(["economy", "standard", "premium", "flagship"]).optional(),
      requiredContext: z.number().optional().describe("Required context window size"),
      priority: z.enum(["low", "normal", "high", "critical"]).optional(),
      // For feedback
      requestId: z.string().optional().describe("Request ID from routing"),
      expertId: z.string().optional().describe("Expert/model ID"),
      success: z.boolean().optional().describe("Was the routing successful"),
      actualLatencyMs: z.number().optional().describe("Actual latency in ms"),
      actualCost: z.number().optional().describe("Actual cost in $"),
      quality: z.number().optional().describe("Quality rating 1-5"),
      comment: z.string().optional().describe("Feedback comment"),
      // For experts
      provider: z.enum(["anthropic", "openai", "google", "mistral", "local", "custom"]).optional(),
      tier: z.enum(["economy", "standard", "premium", "flagship"]).optional(),
      // For add_expert
      expert: z.object({
        id: z.string(),
        name: z.string(),
        provider: z.enum(["anthropic", "openai", "google", "mistral", "local", "custom"]),
        modelId: z.string(),
        tier: z.enum(["economy", "standard", "premium", "flagship"]).optional(),
        capabilities: z.array(z.string()).optional(),
        contextWindow: z.number().optional(),
        costPer1kInput: z.number().optional(),
        costPer1kOutput: z.number().optional(),
        avgLatencyMs: z.number().optional(),
        rateLimit: z.number().optional(),
      }).optional().describe("Expert model to add"),
      // For history
      limit: z.number().optional().describe("Limit results"),
      // For set_config
      config: z.object({
        enabled: z.boolean().optional(),
        defaultTier: z.enum(["economy", "standard", "premium", "flagship"]).optional(),
        costWeight: z.number().optional(),
        latencyWeight: z.number().optional(),
        qualityWeight: z.number().optional(),
        enableFallback: z.boolean().optional(),
        maxRetries: z.number().optional(),
        learningEnabled: z.boolean().optional(),
        learningRate: z.number().optional(),
      }).optional().describe("MoE configuration"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const repoPath = input.repoPath || process.cwd();
    return wrapResult(await handleMoETool({ ...input, repoPath }));
  },
] as const;


/**
 * 49. swarm_sona - Self-Optimizing Neural Architecture (v0.9.5)
 * 
 * Self-learning task routing system that:
 * - Records which agents perform best for each task type
 * - Routes new tasks to best-performing agents  
 * - Learns from outcomes (<0.05ms adaptation)
 * - Improves over time with reinforcement learning
 */
export const swarmSONATool = [
  "swarm_sona",
  {
    title: "Swarm SONA",
    description: `Self-Optimizing Neural Architecture - self-learning task router.
Actions:
- route: Get routing recommendation for a task
- learn: Record task outcome and update model
- classify: Classify a task (category, complexity)
- profile: Get agent's performance profile
- profiles: Get all agent profiles
- specialists: Get top agents for a category
- history: Get learning history
- stats: Get SONA statistics
- config: Get configuration
- set_config: Update configuration
- reset: Reset the model`,
    inputSchema: z.object({
      action: z.enum([
        "route", "learn", "classify", "profile", "profiles",
        "specialists", "history", "stats", "config", "set_config", "reset"
      ]).describe("Action to perform"),
      repoPath: z.string().optional().describe("Repository path"),
      // For route/classify
      title: z.string().optional().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      affectedFiles: z.array(z.string()).optional().describe("Affected file paths"),
      availableAgents: z.array(z.string()).optional().describe("Available agent names"),
      forceExplore: z.boolean().optional().describe("Force exploration mode"),
      // For learn
      taskId: z.string().optional().describe("Task ID"),
      agentName: z.string().optional().describe("Agent name"),
      success: z.boolean().optional().describe("Was task successful?"),
      qualityScore: z.number().optional().describe("Quality score 0-1"),
      timeMinutes: z.number().optional().describe("Time to complete in minutes"),
      errorCount: z.number().optional().describe("Number of errors"),
      reviewScore: z.number().optional().describe("Code review score 0-1"),
      // For specialists/history
      category: z.enum([
        "frontend_ui", "backend_api", "database", "testing", "devops",
        "documentation", "refactoring", "bugfix", "feature", "security",
        "performance", "infrastructure", "unknown"
      ]).optional().describe("Task category"),
      limit: z.number().optional().describe("Limit results"),
      // For set_config
      config: z.object({
        learningRate: z.number().optional(),
        decayFactor: z.number().optional(),
        explorationRate: z.number().optional(),
        minConfidence: z.number().optional(),
        ewcLambda: z.number().optional(),
        enabled: z.boolean().optional(),
        autoLearn: z.boolean().optional(),
        preferSpecialists: z.boolean().optional(),
      }).optional().describe("SONA configuration"),
      // For reset
      keepConfig: z.boolean().optional().describe("Keep config on reset?"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const repoPath = input.repoPath || process.cwd();
    return wrapResult(await handleSONATool({ ...input, repoPath }));
  },
] as const;

/**
 * 50. swarm_booster - Agent Booster for fast local execution (v0.9.6)
 * 
 * Executes trivial tasks locally without LLM API calls:
 * - 352x faster than LLM
 * - $0 cost
 * - Works offline
 * - Deterministic results
 */


/**
 * 46. swarm_budget - Cost optimization and model routing
 */
export const swarmBudgetTool = [
  "swarm_budget",
  {
    title: "Swarm Budget",
    description: "Cost optimization and smart model routing. Actions: analyze, models, select, recommend, route, log_usage, usage, stats, config, set_config, check, remaining, report",
    inputSchema: z.object({
      action: z.enum(["analyze", "models", "select", "recommend", "route", "log_usage", "usage", "stats", "config", "set_config", "check", "remaining", "report"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      // Task analysis
      taskTitle: z.string().optional().describe("Task title"),
      taskDescription: z.string().optional().describe("Task description"),
      affectedFiles: z.array(z.string()).optional().describe("Affected files"),
      requiredCapabilities: z.array(z.string()).optional().describe("Required capabilities"),
      preferCheaper: z.boolean().optional().describe("Prefer cheaper model"),
      forceModel: z.string().optional().describe("Force specific model"),
      // Usage logging
      agentId: z.string().optional().describe("Agent ID"),
      taskId: z.string().optional().describe("Task ID"),
      model: z.string().optional().describe("Model ID"),
      tier: z.enum(["cheap", "standard", "premium"]).optional().describe("Model tier"),
      inputTokens: z.number().optional().describe("Input tokens"),
      outputTokens: z.number().optional().describe("Output tokens"),
      // Config
      dailyLimit: z.number().optional().describe("Daily limit USD"),
      weeklyLimit: z.number().optional().describe("Weekly limit USD"),
      monthlyLimit: z.number().optional().describe("Monthly limit USD"),
      // Stats/report
      period: z.enum(["day", "week", "month"]).optional().describe("Period for stats/report"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const repoPath = input.repoPath || process.cwd();
    switch (input.action) {
      case "analyze":
        return wrapResult(analyzeTaskComplexity(
          input.taskTitle || "",
          input.taskDescription || "",
          input.affectedFiles
        ));
      case "models":
        return wrapResult(await getAvailableModels(repoPath));
      case "select":
        const complexity = analyzeTaskComplexity(
          input.taskTitle || "",
          input.taskDescription || "",
          input.affectedFiles
        );
        return wrapResult(await selectModel(repoPath, complexity, input.requiredCapabilities));
      case "recommend":
        return wrapResult(await recommendModel(
          repoPath,
          input.taskTitle || "",
          input.taskDescription || "",
          input.affectedFiles,
          input.requiredCapabilities
        ));
      case "route":
        return wrapResult(await routeTask(repoPath, input.taskTitle || "", input.taskDescription || "", {
          affectedFiles: input.affectedFiles,
          requiredCapabilities: input.requiredCapabilities,
          preferCheaper: input.preferCheaper,
          forceModel: input.forceModel,
        }));
      case "log_usage":
        return wrapResult(await logUsage(repoPath, {
          agentId: input.agentId,
          taskId: input.taskId,
          model: input.model,
          tier: input.tier || "standard",
          inputTokens: input.inputTokens || 0,
          outputTokens: input.outputTokens || 0,
        }));
      case "usage":
        return wrapResult(await getUsage(repoPath, {
          agentId: input.agentId,
          taskId: input.taskId,
          model: input.model,
          tier: input.tier,
        }));
      case "stats":
        return wrapResult(await getUsageStats(repoPath, input.period || "day"));
      case "config":
        return wrapResult(await getBudgetConfig(repoPath));
      case "set_config":
        return wrapResult(await setBudgetConfig(repoPath, {
          dailyLimit: input.dailyLimit,
          weeklyLimit: input.weeklyLimit,
          monthlyLimit: input.monthlyLimit,
        }));
      case "check":
        return wrapResult(await checkBudget(repoPath));
      case "remaining":
        return wrapResult(await getRemainingBudget(repoPath));
      case "report":
        return wrapResult(await generateCostReport(repoPath, input.period || "week"));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 20. swarm_quality - Quality gate checks
 */
export const swarmQualityTool = [
  "swarm_quality",
  {
    title: "Swarm Quality",
    description: "Quality gate checks. Actions: run, report, threshold, pr_ready",
    inputSchema: z.object({
      action: z.enum(["run", "report", "threshold", "pr_ready"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      runLint: z.boolean().optional().describe("Run lint (for run)"),
      runTests: z.boolean().optional().describe("Run tests (for run)"),
      runTypeCheck: z.boolean().optional().describe("Run type check (for run)"),
      branch: z.string().optional().describe("Branch (for report, pr_ready)"),
      maxLintErrors: z.number().optional().describe("Max lint errors (for threshold)"),
      maxLintWarnings: z.number().optional().describe("Max lint warnings (for threshold)"),
      minTestCoverage: z.number().optional().describe("Min test coverage (for threshold)"),
      requireAllTestsPass: z.boolean().optional().describe("Require all tests pass (for threshold)"),
      requireTypeCheck: z.boolean().optional().describe("Require type check (for threshold)"),
      runFreshCheck: z.boolean().optional().describe("Run fresh check (for pr_ready)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "run":
        return wrapResult(await runQualityGate({
          repoPath: input.repoPath,
          runLint: input.runLint,
          runTests: input.runTests,
          runTypeCheck: input.runTypeCheck,
          commitMode: input.commitMode || "push",
        }));
      case "report":
        return wrapResult(await getQualityReport({
          repoPath: input.repoPath,
          branch: input.branch,
        }));
      case "threshold":
        return wrapResult(await setQualityThreshold({
          repoPath: input.repoPath,
          maxLintErrors: input.maxLintErrors,
          maxLintWarnings: input.maxLintWarnings,
          minTestCoverage: input.minTestCoverage,
          requireAllTestsPass: input.requireAllTestsPass,
          requireTypeCheck: input.requireTypeCheck,
          commitMode: input.commitMode || "push",
        }));
      case "pr_ready":
        return wrapResult(await checkPrReady({
          repoPath: input.repoPath,
          branch: input.branch,
          runFreshCheck: input.runFreshCheck,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 33. swarm_regression - Regression detection
 */
export const swarmRegressionTool = [
  "swarm_regression",
  {
    title: "Swarm Regression",
    description: "Regression detection. Actions: baseline, check, list, resolve, baselines",
    inputSchema: z.object({
      action: z.enum(["baseline", "check", "list", "resolve", "baselines"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      name: z.string().optional().describe("Baseline name (for baseline, check)"),
      agent: z.string().optional().describe("Agent name"),
      metrics: z.any().optional().describe("Metrics (for baseline)"),
      baselineName: z.string().optional().describe("Baseline name (for check)"),
      includeResolved: z.boolean().optional().describe("Include resolved (for list)"),
      regressionId: z.string().optional().describe("Regression ID (for resolve)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "baseline":
        return wrapResult(await saveBaseline({
          repoPath: input.repoPath,
          name: input.name,
          agent: input.agent,
          metrics: input.metrics,
          commitMode: input.commitMode || "push",
        }));
      case "check":
        return wrapResult(await checkRegression({
          repoPath: input.repoPath,
          baselineName: input.baselineName || input.name,
          agent: input.agent,
          commitMode: input.commitMode || "push",
        }));
      case "list":
        return wrapResult(await listRegressions({
          repoPath: input.repoPath,
          includeResolved: input.includeResolved,
        }));
      case "resolve":
        return wrapResult(await resolveRegression({
          repoPath: input.repoPath,
          regressionId: input.regressionId,
          agent: input.agent,
          commitMode: input.commitMode || "push",
        }));
      case "baselines":
        return wrapResult(await listBaselines({
          repoPath: input.repoPath,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 34. swarm_expertise - Agent expertise tracking
 */

