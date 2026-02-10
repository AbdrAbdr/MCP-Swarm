/* eslint-disable @typescript-eslint/no-explicit-any -- MCP SDK handlers receive Zod-validated input but SDK doesn't propagate inferred types */
/**
 * MCP Swarm v1.1.0 - Smart Tools: security
 * Consolidated: swarm_defence + swarm_immune + swarm_consensus → swarm_defence
 */

import { z } from "zod";

import { reportCiAlert, resolveAlert, getImmuneStatus, runLocalTests } from "../workflows/immuneSystem.js";
import { patrolMode } from "../workflows/ghostMode.js";
import { handleDefenceTool } from "../workflows/aiDefence.js";
import { handleConsensusTool } from "../workflows/consensus.js";
import { handleVaultTool } from "../workflows/vault.js";

// Helper to wrap results
function wrapResult(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}

/**
 * swarm_defence - AI Security, immune system & consensus protocols
 * Merged: swarm_defence + swarm_immune + swarm_consensus
 */
export const swarmDefenceTool = [
  "swarm_defence",
  {
    title: "Swarm Defence",
    description: `AI Security, immune system & consensus protocols.

Actions (Defence):
- scan, validate_agent, validate_tool, events, quarantine, release, stats, config, set_config, trust, untrust, clear_events

Actions (Immune):
- immune_alert, immune_resolve, immune_status, immune_test, immune_patrol

Actions (Consensus):
- consensus_join, consensus_leave, consensus_heartbeat, consensus_status, consensus_elect, consensus_leader, consensus_propose, consensus_vote, consensus_proposals, consensus_get_proposal, consensus_execute, consensus_log, consensus_append, consensus_commit, consensus_config, consensus_set_config, consensus_stats`,
    inputSchema: z.object({
      action: z.enum([
        // Defence actions
        "scan", "validate_agent", "validate_tool", "events",
        "quarantine", "release", "stats", "config", "set_config",
        "trust", "untrust", "clear_events",
        // Immune actions
        "immune_alert", "immune_resolve", "immune_status", "immune_test", "immune_patrol",
        // Consensus actions
        "consensus_join", "consensus_leave", "consensus_heartbeat", "consensus_status",
        "consensus_elect", "consensus_leader", "consensus_propose", "consensus_vote",
        "consensus_proposals", "consensus_get_proposal", "consensus_execute",
        "consensus_log", "consensus_append", "consensus_commit",
        "consensus_config", "consensus_set_config", "consensus_stats"
      ]).describe("Action to perform"),
      repoPath: z.string().optional().describe("Repository path"),
      // Defence params
      text: z.string().optional().describe("Text to scan for threats"),
      source: z.string().optional().describe("Source of text or alert"),
      context: z.string().optional().describe("Context for scan"),
      agentName: z.string().optional().describe("Agent name"),
      agentId: z.string().optional().describe("Agent ID"),
      agentAction: z.string().optional().describe("Action the agent is performing"),
      toolName: z.string().optional().describe("Tool name to validate"),
      toolArgs: z.record(z.unknown()).optional().describe("Tool arguments"),
      limit: z.number().optional().describe("Limit results"),
      category: z.enum([
        "prompt_injection", "jailbreak", "code_injection", "data_exfiltration",
        "unauthorized_tool", "impersonation", "dos_attack", "sensitive_data",
        "unsafe_command", "social_engineering"
      ]).optional().describe("Filter by threat category"),
      severity: z.enum(["low", "medium", "high", "critical"]).optional().describe("Filter by severity"),
      includeExpired: z.boolean().optional().describe("Include expired quarantine items"),
      id: z.string().optional().describe("Quarantine item ID to release"),
      config: z.object({
        enabled: z.boolean().optional(),
        sensitivity: z.enum(["low", "medium", "high", "paranoid"]).optional(),
        blockOnHighThreat: z.boolean().optional(),
        quarantineEnabled: z.boolean().optional(),
        auditLog: z.boolean().optional(),
      }).optional().describe("Defence configuration"),
      // Immune params
      level: z.enum(["info", "warning", "error", "critical"]).optional().describe("Alert level"),
      message: z.string().optional().describe("Alert message"),
      details: z.any().optional().describe("Alert details"),
      alertId: z.string().optional().describe("Alert ID"),
      runLint: z.boolean().optional().describe("Run lint (for patrol)"),
      checkImports: z.boolean().optional().describe("Check imports (for patrol)"),
      checkOptimizations: z.boolean().optional().describe("Check optimizations (for patrol)"),
      // Consensus params
      nodeId: z.string().optional().describe("Node ID"),
      nodeName: z.string().optional().describe("Node name"),
      isTrusted: z.boolean().optional().describe("Is node trusted (BFT)"),
      commitIndex: z.number().optional().describe("Current commit index"),
      logLength: z.number().optional().describe("Current log length"),
      title: z.string().optional().describe("Proposal title"),
      description: z.string().optional().describe("Proposal description"),
      type: z.enum([
        "config_change", "task_assignment", "architecture",
        "rollback", "emergency", "custom"
      ]).optional().describe("Proposal type"),
      data: z.record(z.unknown()).optional().describe("Proposal data"),
      requiredMajority: z.number().optional().describe("Required majority (0.5-1.0)"),
      timeoutMs: z.number().optional().describe("Proposal timeout in ms"),
      proposalId: z.string().optional().describe("Proposal ID"),
      vote: z.enum(["approve", "reject", "abstain"]).optional().describe("Vote type"),
      reason: z.string().optional().describe("Vote reason"),
      status: z.enum([
        "pending", "approved", "rejected", "expired", "executed"
      ]).optional().describe("Filter by status"),
      executorId: z.string().optional().describe("Executor node ID"),
      fromIndex: z.number().optional().describe("Start index for log"),
      command: z.string().optional().describe("Command to append"),
      leaderId: z.string().optional().describe("Leader node ID"),
      upToIndex: z.number().optional().describe("Commit up to this index"),
      consensusConfig: z.object({
        mode: z.enum(["raft", "bft", "simple_majority"]).optional(),
        heartbeatInterval: z.number().optional(),
        electionTimeout: z.number().optional(),
        proposalTimeout: z.number().optional(),
        minNodes: z.number().optional(),
        defaultMajority: z.number().optional(),
        bftThreshold: z.number().optional(),
        autoFailover: z.boolean().optional(),
        requireSignatures: z.boolean().optional(),
      }).optional().describe("Consensus configuration"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const repoPath = input.repoPath || process.cwd();

    // Defence actions - delegate to handleDefenceTool
    const defenceActions = [
      "scan", "validate_agent", "validate_tool", "events",
      "quarantine", "release", "stats", "config", "set_config",
      "trust", "untrust", "clear_events"
    ];
    if (defenceActions.includes(input.action)) {
      return wrapResult(await handleDefenceTool({ ...input, repoPath }));
    }

    // Immune actions
    switch (input.action) {
      case "immune_alert":
        return wrapResult(await reportCiAlert({
          repoPath,
          level: input.level,
          source: input.source,
          message: input.message,
          details: input.details,
          commitMode: input.commitMode || "push",
        }));
      case "immune_resolve":
        return wrapResult(await resolveAlert({
          repoPath,
          alertId: input.alertId,
          commitMode: input.commitMode || "push",
        }));
      case "immune_status":
        return wrapResult(await getImmuneStatus(repoPath));
      case "immune_test":
        return wrapResult(await runLocalTests(repoPath));
      case "immune_patrol":
        return wrapResult(await patrolMode({
          repoPath,
          runLint: input.runLint,
          checkImports: input.checkImports,
          checkOptimizations: input.checkOptimizations,
        }));
    }

    // Consensus actions - strip prefix and delegate
    if (input.action.startsWith("consensus_")) {
      const consensusAction = input.action.replace("consensus_", "");
      return wrapResult(await handleConsensusTool({
        ...input,
        action: consensusAction,
        repoPath,
        config: input.consensusConfig,
      }));
    }

    throw new Error(`Unknown action: ${input.action}`);
  },
] as const;

// ================================================================
// 2. swarm_vault — Encrypted secret storage
// ================================================================
export const swarmVaultTool = [
  "swarm_vault",
  {
    title: "Swarm Vault",
    description: `Encrypted secret storage for API keys.

Actions: init, set, get, list, delete, has, status, lock, export, import, destroy

Vault stores secrets locally in .swarm/vault.enc (AES-256-GCM).
Password required to unlock. Session stays open until lock or process exit.`,
    inputSchema: z.object({
      action: z.enum([
        "init", "set", "get", "list", "delete", "has",
        "status", "lock", "export", "import", "destroy"
      ]).describe("Action to perform"),
      repoPath: z.string().optional().describe("Repository path"),
      password: z.string().optional().describe("Vault password (for init/import)"),
      key: z.string().optional().describe("Secret key name (for set/get/delete/has)"),
      value: z.string().optional().describe("Secret value (for set)"),
      file: z.string().optional().describe("Backup file path (for import)"),
      outputPath: z.string().optional().describe("Output path (for export)"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    return wrapResult(await handleVaultTool(input));
  },
] as const;
