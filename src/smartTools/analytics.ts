/* eslint-disable @typescript-eslint/no-explicit-any -- MCP SDK handlers receive Zod-validated input but SDK doesn't propagate inferred types */
/**
 * MCP Swarm v1.1.0 - Smart Tools: analytics
 * Consolidated:
 *   swarm_cost + swarm_budget → swarm_budget
 *   swarm_moe + swarm_sona → swarm_moe
 *   swarm_quality + swarm_regression → swarm_quality
 */

import { z } from "zod";

import { analyzeTaskComplexity, getAvailableModels, selectModel, recommendModel, routeTask, logUsage, getUsage, getUsageStats, getBudgetConfig, setBudgetConfig, checkBudget, getRemainingBudget, generateCostReport } from "../workflows/costOptimization.js";
import { handleSONATool } from "../workflows/sona.js";
import { handleMoETool } from "../workflows/moeRouter.js";
import { runQualityGate, getQualityReport, setQualityThreshold, checkPrReady } from "../workflows/qualityGate.js";
import { logApiUsage, getAgentCosts, getProjectCosts, setBudgetLimit, checkBudgetRemaining } from "../workflows/costOptimization.js";
import { saveBaseline, checkRegression, listRegressions, resolveRegression, listBaselines } from "../workflows/regressionDetector.js";

// Helper to wrap results
function wrapResult(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}

/**
 * swarm_budget - Cost tracking, optimization & smart model routing
 * Merged: swarm_cost + swarm_budget
 */
export const swarmBudgetTool = [
  "swarm_budget",
  {
    title: "Swarm Budget",
    description: "Cost tracking, optimization & smart model routing. Actions: cost_log, cost_agent, cost_project, cost_limit, cost_remaining, analyze, models, select, recommend, route, log_usage, usage, stats, config, set_config, check, remaining, report",
    inputSchema: z.object({
      action: z.enum([
        // cost tracking actions (from swarm_cost)
        "cost_log", "cost_agent", "cost_project", "cost_limit", "cost_remaining",
        // budget optimization actions
        "analyze", "models", "select", "recommend", "route",
        "log_usage", "usage", "stats", "config", "set_config",
        "check", "remaining", "report"
      ]).describe("Action to perform"),
      repoPath: z.string().optional(),
      // cost params
      agent: z.string().optional().describe("Agent name"),
      model: z.string().optional().describe("Model name"),
      inputTokens: z.number().optional().describe("Input tokens"),
      outputTokens: z.number().optional().describe("Output tokens"),
      taskId: z.string().optional().describe("Task ID"),
      tool: z.string().optional().describe("Tool name"),
      periodDays: z.number().optional().describe("Period days"),
      alertThreshold: z.number().optional().describe("Alert threshold"),
      perAgentLimit: z.number().optional().describe("Per agent limit"),
      // budget params
      taskTitle: z.string().optional().describe("Task title"),
      taskDescription: z.string().optional().describe("Task description"),
      affectedFiles: z.array(z.string()).optional().describe("Affected files"),
      requiredCapabilities: z.array(z.string()).optional().describe("Required capabilities"),
      preferCheaper: z.boolean().optional().describe("Prefer cheaper model"),
      forceModel: z.string().optional().describe("Force specific model"),
      agentId: z.string().optional().describe("Agent ID"),
      tier: z.enum(["cheap", "standard", "premium"]).optional().describe("Model tier"),
      dailyLimit: z.number().optional().describe("Daily limit USD"),
      weeklyLimit: z.number().optional().describe("Weekly limit USD"),
      monthlyLimit: z.number().optional().describe("Monthly limit USD"),
      period: z.enum(["day", "week", "month"]).optional().describe("Period for stats/report"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const repoPath = input.repoPath || process.cwd();
    switch (input.action) {
      // --- Cost tracking actions ---
      case "cost_log":
        return wrapResult(await logApiUsage({
          repoPath,
          agent: input.agent,
          model: input.model,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          taskId: input.taskId,
          tool: input.tool,
        }));
      case "cost_agent":
        return wrapResult(await getAgentCosts({
          repoPath,
          agent: input.agent,
          periodDays: input.periodDays,
        }));
      case "cost_project":
        return wrapResult(await getProjectCosts({
          repoPath,
          periodDays: input.periodDays,
        }));
      case "cost_limit":
        return wrapResult(await setBudgetLimit({
          repoPath,
          dailyLimit: input.dailyLimit,
          monthlyLimit: input.monthlyLimit,
          perAgentLimit: input.perAgentLimit,
          alertThreshold: input.alertThreshold,
          commitMode: input.commitMode || "push",
        }));
      case "cost_remaining":
        return wrapResult(await checkBudgetRemaining({
          repoPath,
          agent: input.agent,
        }));
      // --- Budget optimization actions ---
      case "analyze":
        return wrapResult(analyzeTaskComplexity(
          input.taskTitle || "",
          input.taskDescription || "",
          input.affectedFiles
        ));
      case "models":
        return wrapResult(await getAvailableModels(repoPath));
      case "select": {
        const complexity = analyzeTaskComplexity(
          input.taskTitle || "",
          input.taskDescription || "",
          input.affectedFiles
        );
        return wrapResult(await selectModel(repoPath, complexity, input.requiredCapabilities));
      }
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
 * swarm_moe - Mixture of Experts & SONA self-learning router
 * Merged: swarm_moe + swarm_sona
 */
export const swarmMoETool = [
  "swarm_moe",
  {
    title: "Swarm MoE Router",
    description: `Mixture of Experts & SONA self-learning router.

MoE Actions: route, feedback, experts, add_expert, remove_expert, config, set_config, stats, history, classify, reset
SONA Actions: sona_route, sona_learn, sona_classify, sona_profile, sona_profiles, sona_specialists, sona_history, sona_stats, sona_config, sona_set_config, sona_reset`,
    inputSchema: z.object({
      action: z.enum([
        // MoE actions
        "route", "feedback", "experts", "add_expert", "remove_expert",
        "config", "set_config", "stats", "history", "classify", "reset",
        // SONA actions
        "sona_route", "sona_learn", "sona_classify", "sona_profile", "sona_profiles",
        "sona_specialists", "sona_history", "sona_stats", "sona_config", "sona_set_config", "sona_reset"
      ]).describe("Action to perform"),
      repoPath: z.string().optional().describe("Repository path"),
      // MoE params
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
      requestId: z.string().optional().describe("Request ID from routing"),
      expertId: z.string().optional().describe("Expert/model ID"),
      success: z.boolean().optional().describe("Was the routing successful"),
      actualLatencyMs: z.number().optional().describe("Actual latency in ms"),
      actualCost: z.number().optional().describe("Actual cost in $"),
      quality: z.number().optional().describe("Quality rating 1-5"),
      comment: z.string().optional().describe("Feedback comment"),
      provider: z.enum(["anthropic", "openai", "google", "mistral", "local", "custom"]).optional(),
      tier: z.enum(["economy", "standard", "premium", "flagship"]).optional(),
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
      limit: z.number().optional().describe("Limit results"),
      moeConfig: z.object({
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
      // SONA params
      title: z.string().optional().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      affectedFiles: z.array(z.string()).optional().describe("Affected file paths"),
      availableAgents: z.array(z.string()).optional().describe("Available agent names"),
      forceExplore: z.boolean().optional().describe("Force exploration mode"),
      taskId: z.string().optional().describe("Task ID"),
      agentName: z.string().optional().describe("Agent name"),
      qualityScore: z.number().optional().describe("Quality score 0-1"),
      timeMinutes: z.number().optional().describe("Time to complete in minutes"),
      errorCount: z.number().optional().describe("Number of errors"),
      reviewScore: z.number().optional().describe("Code review score 0-1"),
      sonaCategory: z.enum([
        "frontend_ui", "backend_api", "database", "testing", "devops",
        "documentation", "refactoring", "bugfix", "feature", "security",
        "performance", "infrastructure", "unknown"
      ]).optional().describe("SONA task category"),
      sonaConfig: z.object({
        learningRate: z.number().optional(),
        decayFactor: z.number().optional(),
        explorationRate: z.number().optional(),
        minConfidence: z.number().optional(),
        ewcLambda: z.number().optional(),
        enabled: z.boolean().optional(),
        autoLearn: z.boolean().optional(),
        preferSpecialists: z.boolean().optional(),
      }).optional().describe("SONA configuration"),
      keepConfig: z.boolean().optional().describe("Keep config on reset?"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const repoPath = input.repoPath || process.cwd();

    // MoE actions - delegate to handleMoETool
    const moeActions = [
      "route", "feedback", "experts", "add_expert", "remove_expert",
      "config", "set_config", "stats", "history", "classify", "reset"
    ];
    if (moeActions.includes(input.action)) {
      return wrapResult(await handleMoETool({ ...input, repoPath, config: input.moeConfig }));
    }

    // SONA actions - strip prefix and delegate
    if (input.action.startsWith("sona_")) {
      const sonaAction = input.action.replace("sona_", "");
      return wrapResult(await handleSONATool({
        ...input,
        action: sonaAction,
        repoPath,
        category: input.sonaCategory,
        config: input.sonaConfig,
      }));
    }

    throw new Error(`Unknown action: ${input.action}`);
  },
] as const;

/**
 * swarm_quality - Quality gates & regression detection
 * Merged: swarm_quality + swarm_regression
 */
export const swarmQualityTool = [
  "swarm_quality",
  {
    title: "Swarm Quality",
    description: "Quality gates & regression detection. Actions: run, report, threshold, pr_ready, reg_baseline, reg_check, reg_list, reg_resolve, reg_baselines",
    inputSchema: z.object({
      action: z.enum([
        "run", "report", "threshold", "pr_ready",
        "reg_baseline", "reg_check", "reg_list", "reg_resolve", "reg_baselines"
      ]).describe("Action to perform"),
      repoPath: z.string().optional(),
      // quality params
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
      // regression params
      name: z.string().optional().describe("Baseline name"),
      agent: z.string().optional().describe("Agent name"),
      metrics: z.any().optional().describe("Metrics (for reg_baseline)"),
      baselineName: z.string().optional().describe("Baseline name (for reg_check)"),
      includeResolved: z.boolean().optional().describe("Include resolved (for reg_list)"),
      regressionId: z.string().optional().describe("Regression ID (for reg_resolve)"),
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
      // --- Regression actions ---
      case "reg_baseline":
        return wrapResult(await saveBaseline({
          repoPath: input.repoPath,
          name: input.name,
          agent: input.agent,
          metrics: input.metrics,
          commitMode: input.commitMode || "push",
        }));
      case "reg_check":
        return wrapResult(await checkRegression({
          repoPath: input.repoPath,
          baselineName: input.baselineName || input.name,
          agent: input.agent,
          commitMode: input.commitMode || "push",
        }));
      case "reg_list":
        return wrapResult(await listRegressions({
          repoPath: input.repoPath,
          includeResolved: input.includeResolved,
        }));
      case "reg_resolve":
        return wrapResult(await resolveRegression({
          repoPath: input.repoPath,
          regressionId: input.regressionId,
          agent: input.agent,
          commitMode: input.commitMode || "push",
        }));
      case "reg_baselines":
        return wrapResult(await listBaselines({
          repoPath: input.repoPath,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;
