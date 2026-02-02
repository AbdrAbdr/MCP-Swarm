import { createHash } from "node:crypto";
import path from "node:path";

import { git, normalizeLineEndings } from "./git.js";

export async function getRepoRoot(repoPath?: string): Promise<string> {
  // Priority: 1) explicit repoPath, 2) SWARM_REPO_PATH env, 3) process.cwd()
  const envPath = process.env.SWARM_REPO_PATH;
  const cwd = repoPath 
    ? path.resolve(repoPath) 
    : (envPath ? path.resolve(envPath) : process.cwd());
  
  try {
    const { stdout } = await git(["rev-parse", "--show-toplevel"], { cwd });
    return normalizeLineEndings(stdout).trim();
  } catch {
    // Not a git repo - return cwd as-is
    return cwd;
  }
}

export async function getNormalizedOrigin(repoRoot: string): Promise<string> {
  try {
    const { stdout } = await git(["remote", "get-url", "origin"], { cwd: repoRoot });
    return normalizeLineEndings(stdout).trim();
  } catch {
    return "";
  }
}

export function computeRepoSlug(repoRoot: string, originUrl: string): string {
  const repoName = path.basename(repoRoot).replace(/[^a-zA-Z0-9._-]/g, "-");
  const h = createHash("sha1").update(`${originUrl}|${repoRoot}`).digest("hex").slice(0, 6);
  return `${repoName}__${h}`;
}
