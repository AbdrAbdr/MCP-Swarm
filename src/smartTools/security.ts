/**
 * MCP Swarm v0.9.17 - Smart Tools: security
 * Auto-generated from smartTools.ts
 */

import { z } from "zod";

import { reportCiAlert, resolveAlert, getImmuneStatus, runLocalTests } from "../workflows/immuneSystem.js";
import { patrolMode } from "../workflows/ghostMode.js";
import { handleDefenceTool } from "../workflows/aiDefence.js";
import { handleConsensusTool } from "../workflows/consensus.js";

// Helper to wrap results
function wrapResult(result: any) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}


// ============ TOOL 52: AI DEFENCE ============

export const swarmDefenceTool = [
  "swarm_defence",
  {
    title: "Swarm Defence",
    description: `AI Security — threat detection, prompt injection protection, and agent validation.
    
Actions:
- scan: Scan text for threats (prompt injection, jailbreak, code injection, etc.)
- validate_agent: Validate agent identity and permissions
- validate_tool: Validate tool usage is authorized
- events: Get security events log
- quarantine: Get quarantined items
- release: Release item from quarantine
- stats: Get defence statistics
- config: Get defence configuration
- set_config: Update defence settings
- trust: Add agent to trusted whitelist
- untrust: Remove agent from whitelist
- clear_events: Clear event log`,
    inputSchema: z.object({
      action: z.enum([
        "scan", "validate_agent", "validate_tool", "events",
        "quarantine", "release", "stats", "config", "set_config",
        "trust", "untrust", "clear_events"
      ]).describe("Action to perform"),
      repoPath: z.string().optional().describe("Repository path"),
      // For scan
      text: z.string().optional().describe("Text to scan for threats"),
      source: z.string().optional().describe("Source of the text (agent name or 'user')"),
      context: z.string().optional().describe("Context for the scan"),
      // For validate_agent
      agentName: z.string().optional().describe("Agent name to validate"),
      agentId: z.string().optional().describe("Agent ID"),
      agentAction: z.string().optional().describe("Action the agent is trying to perform"),
      // For validate_tool
      toolName: z.string().optional().describe("Tool name to validate"),
      toolArgs: z.record(z.unknown()).optional().describe("Tool arguments"),
      // For events
      limit: z.number().optional().describe("Limit number of events"),
      category: z.enum([
        "prompt_injection", "jailbreak", "code_injection", "data_exfiltration",
        "unauthorized_tool", "impersonation", "dos_attack", "sensitive_data",
        "unsafe_command", "social_engineering"
      ]).optional().describe("Filter by threat category"),
      severity: z.enum(["low", "medium", "high", "critical"]).optional().describe("Filter by severity"),
      // For quarantine
      includeExpired: z.boolean().optional().describe("Include expired quarantine items"),
      // For release
      id: z.string().optional().describe("Quarantine item ID to release"),
      // For set_config
      config: z.object({
        enabled: z.boolean().optional(),
        sensitivity: z.enum(["low", "medium", "high", "paranoid"]).optional(),
        blockOnHighThreat: z.boolean().optional(),
        quarantineEnabled: z.boolean().optional(),
        auditLog: z.boolean().optional(),
      }).optional().describe("Defence configuration"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const repoPath = input.repoPath || process.cwd();
    return wrapResult(await handleDefenceTool({ ...input, repoPath }));
  },
] as const;

// ============ TOOL 53: CONSENSUS PROTOCOLS ============


/**
 * 31. swarm_immune - Immune system and CI alerts
 */
export const swarmImmuneTool = [
  "swarm_immune",
  {
    title: "Swarm Immune",
    description: "Immune system and CI alerts. Actions: alert, resolve, status, test, patrol",
    inputSchema: z.object({
      action: z.enum(["alert", "resolve", "status", "test", "patrol"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      level: z.enum(["info", "warning", "error", "critical"]).optional().describe("Alert level (for alert)"),
      source: z.string().optional().describe("Alert source (for alert)"),
      message: z.string().optional().describe("Alert message (for alert)"),
      details: z.any().optional().describe("Alert details (for alert)"),
      alertId: z.string().optional().describe("Alert ID (for resolve)"),
      runLint: z.boolean().optional().describe("Run lint (for patrol)"),
      checkImports: z.boolean().optional().describe("Check imports (for patrol)"),
      checkOptimizations: z.boolean().optional().describe("Check optimizations (for patrol)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "alert":
        return wrapResult(await reportCiAlert({
          repoPath: input.repoPath,
          level: input.level,
          source: input.source,
          message: input.message,
          details: input.details,
          commitMode: input.commitMode || "push",
        }));
      case "resolve":
        return wrapResult(await resolveAlert({
          repoPath: input.repoPath,
          alertId: input.alertId,
          commitMode: input.commitMode || "push",
        }));
      case "status":
        return wrapResult(await getImmuneStatus(input.repoPath));
      case "test":
        return wrapResult(await runLocalTests(input.repoPath));
      case "patrol":
        return wrapResult(await patrolMode({
          repoPath: input.repoPath,
          runLint: input.runLint,
          checkImports: input.checkImports,
          checkOptimizations: input.checkOptimizations,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

// ============ TOOL 53: CONSENSUS PROTOCOLS ============

export const swarmConsensusTool = [
  "swarm_consensus",
  {
    title: "Swarm Consensus",
    description: `Distributed agreement protocols for multi-agent coordination.

Implements Raft-like leader election, log replication, and Byzantine fault tolerance.

Actions:
- join: Join the consensus cluster
- leave: Leave the cluster
- heartbeat: Send heartbeat to cluster
- status: Get cluster status (nodes, leader, quorum)
- elect: Start leader election
- leader: Get current leader info
- propose: Create a proposal for voting
- vote: Vote on a proposal (approve/reject/abstain)
- proposals: List proposals
- get_proposal: Get single proposal details
- execute: Execute approved proposal
- log: Get replicated log entries
- append: Append to log (leader only)
- commit: Commit log entries
- config: Get consensus configuration
- set_config: Update configuration
- stats: Get consensus statistics

Consensus Modes:
- simple_majority: 50%+ votes needed
- raft: Raft-style with term-based leadership
- bft: Byzantine fault tolerant (2/3+1 votes)`,
    inputSchema: z.object({
      action: z.enum([
        "join", "leave", "heartbeat", "status", "elect", "leader",
        "propose", "vote", "proposals", "get_proposal", "execute",
        "log", "append", "commit", "config", "set_config", "stats"
      ]).describe("Action to perform"),
      repoPath: z.string().optional().describe("Repository path"),
      // For join/leave/heartbeat/elect
      nodeId: z.string().optional().describe("Node ID"),
      nodeName: z.string().optional().describe("Node name"),
      isTrusted: z.boolean().optional().describe("Is node trusted (for BFT)"),
      commitIndex: z.number().optional().describe("Current commit index"),
      logLength: z.number().optional().describe("Current log length"),
      // For propose
      title: z.string().optional().describe("Proposal title"),
      description: z.string().optional().describe("Proposal description"),
      type: z.enum([
        "config_change", "task_assignment", "architecture", 
        "rollback", "emergency", "custom"
      ]).optional().describe("Proposal type"),
      data: z.record(z.unknown()).optional().describe("Proposal data"),
      requiredMajority: z.number().optional().describe("Required majority (0.5-1.0)"),
      timeoutMs: z.number().optional().describe("Proposal timeout in ms"),
      // For vote
      proposalId: z.string().optional().describe("Proposal ID"),
      vote: z.enum(["approve", "reject", "abstain"]).optional().describe("Vote type"),
      reason: z.string().optional().describe("Vote reason"),
      // For proposals
      status: z.enum([
        "pending", "approved", "rejected", "expired", "executed"
      ]).optional().describe("Filter by status"),
      limit: z.number().optional().describe("Limit results"),
      // For execute
      executorId: z.string().optional().describe("Executor node ID"),
      // For log
      fromIndex: z.number().optional().describe("Start index for log"),
      // For append
      command: z.string().optional().describe("Command to append"),
      leaderId: z.string().optional().describe("Leader node ID"),
      // For commit
      upToIndex: z.number().optional().describe("Commit up to this index"),
      // For set_config
      config: z.object({
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
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const repoPath = input.repoPath || process.cwd();
    return wrapResult(await handleConsensusTool({ ...input, repoPath }));
  },
] as const;

// ============ TOOL 54: MOE ROUTER ============

