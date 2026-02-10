/**
 * MCP Swarm v1.2.0 - Smart Tools Index
 * 35 Consolidated Smart Tools
 *
 * Consolidation rationale: IDE tool slot optimization.
 * Each tool now uses an `action` parameter to expose multiple operations.
 */

// Core (2)
import { swarmAgentTool, swarmControlTool } from "./core.js";
// Tasks (2)
import { swarmTaskTool, swarmPlanTool } from "./tasks.js";
// Files (2)
import { swarmFileTool, swarmWorktreeTool } from "./files.js";
// Git (1)
import { swarmGitTool } from "./git.js";
// Collaboration (4)
import { swarmChatTool, swarmVotingTool, swarmOrchestratorTool, swarmMessageTool } from "./collaboration.js";
// Security (2)
import { swarmDefenceTool, swarmVaultTool } from "./security.js";
// Analytics (3)
import { swarmBudgetTool, swarmMoETool, swarmQualityTool } from "./analytics.js";
// Intelligence (4)
import { swarmVectorTool, swarmBoosterTool, swarmBrainTool, swarmContextTool } from "./intelligence.js";
// Infra (7)
import { swarmHealthTool, swarmExternalTool, swarmExpertiseTool, swarmKnowledgeTool, swarmSessionTool, swarmClustersTool, swarmTelegramTool } from "./infra.js";
// v1.2.0 (8)
import {
  swarmAnalyticsTool, swarmMemoryTool, swarmEmbeddingsTool,
  swarmProfilesTool, swarmSchedulerTool, swarmPluginsTool,
  swarmGitHubTool, swarmSetupTool,
} from "./v120.js";

export {
  // Core (2)
  swarmAgentTool,       // swarm_agent + swarm_companion
  swarmControlTool,     // swarm_control + swarm_pulse
  // Tasks (2)
  swarmTaskTool,        // swarm_task + swarm_briefing
  swarmPlanTool,        // swarm_plan + swarm_spec
  // Files (2)
  swarmFileTool,        // swarm_file + swarm_snapshot
  swarmWorktreeTool,    // swarm_worktree + swarm_hooks
  // Git (1)
  swarmGitTool,         // swarm_git + swarm_dependency
  // Collaboration (4)
  swarmChatTool,        // swarm_chat + swarm_review
  swarmVotingTool,      // swarm_voting + swarm_auction
  swarmOrchestratorTool,// swarm_orchestrator (unchanged)
  swarmMessageTool,     // swarm_message + swarm_mcp
  // Security (2)
  swarmDefenceTool,     // swarm_defence + swarm_immune + swarm_consensus
  swarmVaultTool,       // swarm_vault (encrypted secret storage)
  // Analytics (3)
  swarmBudgetTool,      // swarm_cost + swarm_budget
  swarmMoETool,         // swarm_moe + swarm_sona
  swarmQualityTool,     // swarm_quality + swarm_regression
  // Intelligence (4)
  swarmVectorTool,      // HNSW vector search (unchanged)
  swarmBoosterTool,     // Agent booster (unchanged)
  swarmBrainTool,       // swarm_brainstorm + swarm_debug
  swarmContextTool,     // swarm_context + swarm_context_pool + swarm_batch
  // Infra (7)
  swarmHealthTool,      // swarm_health + swarm_preemption
  swarmExternalTool,    // swarm_external + swarm_platform
  swarmExpertiseTool,   // swarm_expertise + swarm_routing
  swarmKnowledgeTool,   // swarm_knowledge + swarm_docs + swarm_advice
  swarmSessionTool,     // swarm_session + swarm_timeline + swarm_screenshot
  swarmClustersTool,    // swarm_clusters + swarm_conflict
  swarmTelegramTool,    // swarm_telegram + swarm_qa
  // v1.2.0 (8)
  swarmAnalyticsTool,   // task/event analytics & agent metrics
  swarmMemoryTool,      // auto-index, smart context, self-correction
  swarmEmbeddingsTool,  // embedding cascade & vector backend health
  swarmProfilesTool,    // agent profiles & specialization
  swarmSchedulerTool,   // scheduled tasks (cron)
  swarmPluginsTool,     // plugin system
  swarmGitHubTool,      // GitHub Issue ↔ Task sync
  swarmSetupTool,       // setup wizard & config
};

/**
 * All 35 Smart Tools as an array.
 * Total: 2 + 2 + 2 + 1 + 4 + 2 + 3 + 4 + 7 + 8 = 35
 */
export const allSmartTools = [
  // Core (2)
  swarmAgentTool,
  swarmControlTool,
  // Tasks (2)
  swarmTaskTool,
  swarmPlanTool,
  // Files (2)
  swarmFileTool,
  swarmWorktreeTool,
  // Git (1)
  swarmGitTool,
  // Collaboration (4)
  swarmChatTool,
  swarmVotingTool,
  swarmOrchestratorTool,
  swarmMessageTool,
  // Security (2)
  swarmDefenceTool,
  swarmVaultTool,
  // Analytics (3)
  swarmBudgetTool,
  swarmMoETool,
  swarmQualityTool,
  // Intelligence (4)
  swarmVectorTool,
  swarmBoosterTool,
  swarmBrainTool,
  swarmContextTool,
  // Infra (7)
  swarmHealthTool,
  swarmExternalTool,
  swarmExpertiseTool,
  swarmKnowledgeTool,
  swarmSessionTool,
  swarmClustersTool,
  swarmTelegramTool,
  // v1.2.0 (8)
  swarmAnalyticsTool,
  swarmMemoryTool,
  swarmEmbeddingsTool,
  swarmProfilesTool,
  swarmSchedulerTool,
  swarmPluginsTool,
  swarmGitHubTool,
  swarmSetupTool,
];
