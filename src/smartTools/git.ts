/**
 * MCP Swarm v0.9.17 - Smart Tools: git
 * Auto-generated from smartTools.ts
 */

import { z } from "zod";

import { syncWithBaseBranch } from "../workflows/git.js";
import { createGithubPr, checkMainHealth } from "../workflows/githubPr.js";
import { autoDeleteMergedBranch, cleanupAllMergedBranches } from "../workflows/remoteCleanup.js";
import { signalDependencyChange, syncDependencies } from "../workflows/dependencySync.js";

// Helper to wrap results
function wrapResult(result: any) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}


/**
 * 4. swarm_git - Git operations
 */
export const swarmGitTool = [
  "swarm_git",
  {
    title: "Swarm Git",
    description: "Git operations. Actions: sync, pr, health, cleanup, cleanup_all",
    inputSchema: z.object({
      action: z.enum(["sync", "pr", "health", "cleanup", "cleanup_all"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      baseBranch: z.string().optional().describe("Base branch"),
      title: z.string().optional().describe("PR title (for pr)"),
      body: z.string().optional().describe("PR body (for pr)"),
      draft: z.boolean().optional().describe("Draft PR (for pr)"),
      branch: z.string().optional().describe("Branch name (for cleanup)"),
      deleteLocal: z.boolean().optional().describe("Delete local (for cleanup)"),
      deleteRemote: z.boolean().optional().describe("Delete remote (for cleanup)"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const { getRepoRoot } = await import("../workflows/repo.js");
    const repoRoot = await getRepoRoot(input.repoPath);
    
    switch (input.action) {
      case "sync":
        return wrapResult(await syncWithBaseBranch({
          repoRoot,
          baseBranch: input.baseBranch,
        }));
      case "pr":
        return wrapResult(await createGithubPr({
          repoPath: input.repoPath,
          title: input.title,
          body: input.body,
          baseBranch: input.baseBranch,
          draft: input.draft,
        }));
      case "health":
        return wrapResult(await checkMainHealth({
          repoPath: input.repoPath,
          baseBranch: input.baseBranch,
        }));
      case "cleanup":
        return wrapResult(await autoDeleteMergedBranch({
          repoPath: input.repoPath,
          branch: input.branch,
          deleteLocal: input.deleteLocal,
          deleteRemote: input.deleteRemote,
        }));
      case "cleanup_all":
        return wrapResult(await cleanupAllMergedBranches({
          repoPath: input.repoPath,
          deleteLocal: input.deleteLocal,
          deleteRemote: input.deleteRemote,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 29. swarm_dependency - Dependency synchronization
 */
export const swarmDependencyTool = [
  "swarm_dependency",
  {
    title: "Swarm Dependency",
    description: "Dependency synchronization. Actions: signal, sync",
    inputSchema: z.object({
      action: z.enum(["signal", "sync"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      type: z.enum(["npm", "pip", "cargo", "go"]).optional().describe("Dependency type (for signal)"),
      added: z.array(z.string()).optional().describe("Added packages (for signal)"),
      removed: z.array(z.string()).optional().describe("Removed packages (for signal)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "signal":
        return wrapResult(await signalDependencyChange({
          repoPath: input.repoPath,
          type: input.type,
          added: input.added || [],
          removed: input.removed,
          commitMode: input.commitMode || "push",
        }));
      case "sync":
        return wrapResult(await syncDependencies(input.repoPath));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 30. swarm_platform - Cross-platform checks
 */

