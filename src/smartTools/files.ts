/**
 * MCP Swarm v0.9.17 - Smart Tools: files
 * Auto-generated from smartTools.ts
 */

import { z } from "zod";

import { fileReserve, fileRelease, listFileLocks } from "../workflows/fileLocks.js";
import { forecastFileTouches, checkFileConflicts } from "../workflows/conflictForecast.js";
import { checkFileSafety } from "../workflows/conflictPrediction.js";
import { createWorktree, listWorktrees, removeWorktree } from "../workflows/worktree.js";
import { createSnapshot, triggerRollback, listSnapshots } from "../workflows/snapshot.js";
import { installGuardHooks, uninstallGuardHooks, runGuardHooks, getGuardConfig, updateGuardHook, listGuardHooks } from "../workflows/guardHooks.js";

// Helper to wrap results
function wrapResult(result: any) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}


/**
 * 3. swarm_file - File locking and conflict management
 */
export const swarmFileTool = [
  "swarm_file",
  {
    title: "Swarm File",
    description: "File locking and conflict management. Actions: reserve, release, list, forecast, conflicts, safety",
    inputSchema: z.object({
      action: z.enum(["reserve", "release", "list", "forecast", "conflicts", "safety"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      filePath: z.string().optional().describe("File path (for reserve, release, safety)"),
      files: z.array(z.string()).optional().describe("Files (for forecast, conflicts)"),
      agent: z.string().optional().describe("Agent name"),
      exclusive: z.boolean().optional().default(true).describe("Exclusive lock (for reserve)"),
      ttlMs: z.number().optional().describe("TTL in ms (for reserve)"),
      taskId: z.string().optional().describe("Task ID (for forecast)"),
      estimatedMinutesFromNow: z.number().optional().describe("Estimated minutes (for forecast)"),
      confidence: z.enum(["low", "medium", "high"]).optional().describe("Confidence (for forecast)"),
      excludeAgent: z.string().optional().describe("Exclude agent (for conflicts)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "reserve":
        return wrapResult(await fileReserve({
          repoPath: input.repoPath,
          filePath: input.filePath,
          agent: input.agent,
          exclusive: input.exclusive ?? true,
          ttlMs: input.ttlMs,
          commitMode: input.commitMode || "push",
        }));
      case "release":
        return wrapResult(await fileRelease({
          repoPath: input.repoPath,
          filePath: input.filePath,
          agent: input.agent,
          commitMode: input.commitMode || "push",
        }));
      case "list":
        return wrapResult(await listFileLocks(input.repoPath));
      case "forecast":
        return wrapResult(await forecastFileTouches({
          repoPath: input.repoPath,
          agent: input.agent,
          taskId: input.taskId,
          files: input.files || [],
          estimatedMinutesFromNow: input.estimatedMinutesFromNow,
          confidence: input.confidence,
          commitMode: input.commitMode || "push",
        }));
      case "conflicts":
        return wrapResult(await checkFileConflicts({
          repoPath: input.repoPath,
          files: input.files || [],
          excludeAgent: input.excludeAgent,
        }));
      case "safety":
        return wrapResult(await checkFileSafety({
          repoPath: input.repoPath,
          file: input.filePath,
          agent: input.agent,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 18. swarm_snapshot - File snapshots for rollback
 */
export const swarmSnapshotTool = [
  "swarm_snapshot",
  {
    title: "Swarm Snapshot",
    description: "File snapshots for rollback. Actions: create, rollback, list",
    inputSchema: z.object({
      action: z.enum(["create", "rollback", "list"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      agent: z.string().optional().describe("Agent name"),
      taskId: z.string().optional().describe("Task ID"),
      files: z.array(z.string()).optional().describe("Files to snapshot (for create)"),
      snapshotId: z.string().optional().describe("Snapshot ID (for rollback)"),
      reason: z.string().optional().describe("Reason (for rollback)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "create":
        return wrapResult(await createSnapshot({
          repoPath: input.repoPath,
          agent: input.agent,
          taskId: input.taskId,
          files: input.files || [],
          commitMode: input.commitMode || "push",
        }));
      case "rollback":
        return wrapResult(await triggerRollback({
          repoPath: input.repoPath,
          snapshotId: input.snapshotId,
          agent: input.agent,
          reason: input.reason,
          commitMode: input.commitMode || "push",
        }));
      case "list":
        return wrapResult(await listSnapshots({
          repoPath: input.repoPath,
          taskId: input.taskId,
          agent: input.agent,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 5. swarm_worktree - Git worktree management
 */
export const swarmWorktreeTool = [
  "swarm_worktree",
  {
    title: "Swarm Worktree",
    description: "Git worktree management. Actions: create, list, remove",
    inputSchema: z.object({
      action: z.enum(["create", "list", "remove"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      agentName: z.string().optional().describe("Agent name (for create)"),
      shortDesc: z.string().optional().describe("Short description (for create)"),
      baseRef: z.string().optional().describe("Base ref (for create)"),
      push: z.boolean().optional().describe("Push (for create)"),
      worktreePath: z.string().optional().describe("Worktree path (for remove)"),
      force: z.boolean().optional().describe("Force remove (for remove)"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "create":
        return wrapResult(await createWorktree({
          repoPath: input.repoPath,
          agentName: input.agentName,
          shortDesc: input.shortDesc,
          baseRef: input.baseRef || "main",
          push: input.push ?? true,
        }));
      case "list":
        return wrapResult(await listWorktrees({ repoPath: input.repoPath }));
      case "remove":
        return wrapResult(await removeWorktree({
          worktreePath: input.worktreePath,
          force: input.force ?? false,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 27. swarm_hooks - Git guard hooks
 */
export const swarmHooksTool = [
  "swarm_hooks",
  {
    title: "Swarm Hooks",
    description: "Git guard hooks. Actions: install, uninstall, run, config, update, list",
    inputSchema: z.object({
      action: z.enum(["install", "uninstall", "run", "config", "update", "list"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      preCommitChecks: z.array(z.string()).optional().describe("Pre-commit checks (for install)"),
      prePushChecks: z.array(z.string()).optional().describe("Pre-push checks (for install)"),
      bypassKeyword: z.string().optional().describe("Bypass keyword (for install)"),
      hooks: z.array(z.string()).optional().describe("Hooks to uninstall (for uninstall)"),
      hook: z.string().optional().describe("Hook name (for run, update)"),
      enabled: z.boolean().optional().describe("Enabled (for update)"),
      checks: z.array(z.string()).optional().describe("Checks (for update)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "install":
        return wrapResult(await installGuardHooks({
          repoPath: input.repoPath,
          preCommitChecks: input.preCommitChecks,
          prePushChecks: input.prePushChecks,
          bypassKeyword: input.bypassKeyword,
          commitMode: input.commitMode || "push",
        }));
      case "uninstall":
        return wrapResult(await uninstallGuardHooks({
          repoPath: input.repoPath,
          hooks: input.hooks,
        }));
      case "run":
        return wrapResult(await runGuardHooks({
          repoPath: input.repoPath,
          hook: input.hook,
        }));
      case "config":
        return wrapResult(await getGuardConfig({
          repoPath: input.repoPath,
        }));
      case "update":
        return wrapResult(await updateGuardHook({
          repoPath: input.repoPath,
          hook: input.hook,
          enabled: input.enabled,
          checks: input.checks,
          commitMode: input.commitMode || "push",
        }));
      case "list":
        return wrapResult(await listGuardHooks({
          repoPath: input.repoPath,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

// ============ SMART TOOLS 28-41 ============

/**
 * 28. swarm_screenshot - Screenshot sharing
 */

