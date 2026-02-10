/* eslint-disable @typescript-eslint/no-explicit-any -- MCP SDK handlers receive Zod-validated input but SDK doesn't propagate inferred types */
/**
 * MCP Swarm v1.1.0 - Smart Tools: files
 * Consolidated: swarm_file + swarm_snapshot → swarm_file
 *               swarm_worktree + swarm_hooks → swarm_worktree
 */

import { z } from "zod";

import { fileReserve, fileRelease, listFileLocks } from "../workflows/fileLocks.js";
import { forecastFileTouches, checkFileConflicts } from "../workflows/conflictPrediction.js";
import { checkFileSafety } from "../workflows/conflictPrediction.js";
import { createWorktree, listWorktrees, removeWorktree } from "../workflows/worktree.js";
import { createSnapshot, triggerRollback, listSnapshots } from "../workflows/snapshot.js";
import { installGuardHooks, uninstallGuardHooks, runGuardHooks, getGuardConfig, updateGuardHook, listGuardHooks } from "../workflows/guardHooks.js";

// Helper to wrap results
function wrapResult(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}

// ===== schemas =====

const swarmFileInput = z.object({
  action: z.enum(["reserve", "release", "list", "forecast", "conflicts", "safety", "snap_create", "snap_rollback", "snap_list"]).describe("Action to perform"),
  repoPath: z.string().optional(),
  filePath: z.string().optional().describe("File path (for reserve, release, safety)"),
  files: z.array(z.string()).optional().describe("Files (for forecast, conflicts, snap_create)"),
  agent: z.string().optional().describe("Agent name"),
  exclusive: z.boolean().optional().default(true).describe("Exclusive lock (for reserve)"),
  ttlMs: z.number().optional().describe("TTL in ms (for reserve)"),
  taskId: z.string().optional().describe("Task ID (for forecast, snap_create)"),
  estimatedMinutesFromNow: z.number().optional().describe("Estimated minutes (for forecast)"),
  confidence: z.enum(["low", "medium", "high"]).optional().describe("Confidence (for forecast)"),
  excludeAgent: z.string().optional().describe("Exclude agent (for conflicts)"),
  snapshotId: z.string().optional().describe("Snapshot ID (for snap_rollback)"),
  reason: z.string().optional().describe("Reason (for snap_rollback)"),
  commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
}).strict();


const swarmWorktreeInput = z.object({
  action: z.enum(["create", "list", "remove", "hook_install", "hook_uninstall", "hook_run", "hook_config", "hook_update", "hook_list"]).describe("Action to perform"),
  repoPath: z.string().optional(),
  agentName: z.string().optional().describe("Agent name (for create)"),
  shortDesc: z.string().optional().describe("Short description (for create)"),
  baseRef: z.string().optional().describe("Base ref (for create)"),
  push: z.boolean().optional().describe("Push (for create)"),
  worktreePath: z.string().optional().describe("Worktree path (for remove)"),
  force: z.boolean().optional().describe("Force remove (for remove)"),
  preCommitChecks: z.array(z.string()).optional().describe("Pre-commit checks (for hook_install)"),
  prePushChecks: z.array(z.string()).optional().describe("Pre-push checks (for hook_install)"),
  bypassKeyword: z.string().optional().describe("Bypass keyword (for hook_install)"),
  hooks: z.array(z.string()).optional().describe("Hooks to uninstall (for hook_uninstall)"),
  hook: z.string().optional().describe("Hook name (for hook_run, hook_update)"),
  enabled: z.boolean().optional().describe("Enabled (for hook_update)"),
  checks: z.array(z.string()).optional().describe("Checks (for hook_update)"),
  commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
}).strict();


/**
 * swarm_file - File locking, conflict management & snapshots
 * Merged: swarm_file + swarm_snapshot
 */
export const swarmFileTool = [
  "swarm_file",
  {
    title: "Swarm File",
    description: "File locking, conflict management & snapshots. Actions: reserve, release, list, forecast, conflicts, safety, snap_create, snap_rollback, snap_list",
    inputSchema: swarmFileInput,
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
      // --- Snapshot actions ---
      case "snap_create":
        return wrapResult(await createSnapshot({
          repoPath: input.repoPath,
          agent: input.agent,
          taskId: input.taskId,
          files: input.files || [],
          commitMode: input.commitMode || "push",
        }));
      case "snap_rollback":
        return wrapResult(await triggerRollback({
          repoPath: input.repoPath,
          snapshotId: input.snapshotId,
          agent: input.agent,
          reason: input.reason,
          commitMode: input.commitMode || "push",
        }));
      case "snap_list":
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
 * swarm_worktree - Git worktree & guard hooks management
 * Merged: swarm_worktree + swarm_hooks
 */
export const swarmWorktreeTool = [
  "swarm_worktree",
  {
    title: "Swarm Worktree",
    description: "Git worktree & guard hooks management. Actions: create, list, remove, hook_install, hook_uninstall, hook_run, hook_config, hook_update, hook_list",
    inputSchema: swarmWorktreeInput,
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
      // --- Hook actions ---
      case "hook_install":
        return wrapResult(await installGuardHooks({
          repoPath: input.repoPath,
          preCommitChecks: input.preCommitChecks,
          prePushChecks: input.prePushChecks,
          bypassKeyword: input.bypassKeyword,
          commitMode: input.commitMode || "push",
        }));
      case "hook_uninstall":
        return wrapResult(await uninstallGuardHooks({
          repoPath: input.repoPath,
          hooks: input.hooks,
        }));
      case "hook_run":
        return wrapResult(await runGuardHooks({
          repoPath: input.repoPath,
          hook: input.hook,
        }));
      case "hook_config":
        return wrapResult(await getGuardConfig({
          repoPath: input.repoPath,
        }));
      case "hook_update":
        return wrapResult(await updateGuardHook({
          repoPath: input.repoPath,
          hook: input.hook,
          enabled: input.enabled,
          checks: input.checks,
          commitMode: input.commitMode || "push",
        }));
      case "hook_list":
        return wrapResult(await listGuardHooks({
          repoPath: input.repoPath,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;
