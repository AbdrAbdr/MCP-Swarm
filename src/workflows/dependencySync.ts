import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { git } from "./git.js";
import { getRepoRoot } from "./repo.js";
import { getErrorMessage, isNodeError } from "../utils/errorUtils.js";

const execFileAsync = promisify(execFile);

export type DependencyChangeEvent = {
  type: "npm" | "pip" | "other";
  added: string[];
  removed: string[];
  ts: number;
};

async function safePush(repoRoot: string): Promise<void> {
  try {
    await git(["push"], { cwd: repoRoot });
  } catch {
    await git(["push", "-u", "origin", "HEAD"], { cwd: repoRoot });
  }
}

export async function signalDependencyChange(input: {
  repoPath?: string;
  type: "npm" | "pip" | "other";
  added: string[];
  removed?: string[];
  commitMode: "none" | "local" | "push";
}): Promise<{ ok: boolean }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const swarmDir = path.join(repoRoot, "swarm");
  await fs.mkdir(swarmDir, { recursive: true });

  const eventsPath = path.join(swarmDir, "EVENTS.ndjson");
  const event: { id: string; ts: number; type: string; payload: DependencyChangeEvent } = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    ts: Date.now(),
    type: "dependency_change",
    payload: {
      type: input.type,
      added: input.added,
      removed: input.removed || [],
      ts: Date.now(),
    },
  };

  await fs.appendFile(eventsPath, JSON.stringify(event) + "\n", "utf8");

  const rel = path.posix.join("swarm", "EVENTS.ndjson");
  if (input.commitMode !== "none") {
    await git(["add", rel], { cwd: repoRoot });
    await git(["commit", "-m", `swarm: dependency change (${input.type})`], { cwd: repoRoot });
    if (input.commitMode === "push") await safePush(repoRoot);
  }

  return { ok: true };
}

export async function syncDependencies(repoPath?: string): Promise<{ synced: string[]; errors: string[] }> {
  const repoRoot = await getRepoRoot(repoPath);
  const synced: string[] = [];
  const errors: string[] = [];

  // npm
  const pkgPath = path.join(repoRoot, "package.json");
  try {
    await fs.access(pkgPath);
    await execFileAsync("npm", ["install"], { cwd: repoRoot, windowsHide: true, timeout: 300000 });
    synced.push("npm");
  } catch (err: unknown) {
    if (!isNodeError(err) || err.code !== "ENOENT") {
      errors.push(`npm: ${getErrorMessage(err)}`);
    }
  }

  // pip
  const reqPath = path.join(repoRoot, "requirements.txt");
  try {
    await fs.access(reqPath);
    await execFileAsync("pip", ["install", "-r", "requirements.txt"], { cwd: repoRoot, windowsHide: true, timeout: 300000 });
    synced.push("pip");
  } catch (err: unknown) {
    if (!isNodeError(err) || err.code !== "ENOENT") {
      errors.push(`pip: ${getErrorMessage(err)}`);
    }
  }

  return { synced, errors };
}
