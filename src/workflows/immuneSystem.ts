import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { git } from "./git.js";
import { getRepoRoot } from "./repo.js";
import { appendEvent } from "./auction.js";
import { getErrorMessage } from "../utils/errorUtils.js";

const execFileAsync = promisify(execFile);

export type AlertLevel = "info" | "warning" | "error" | "critical";

export type CiAlert = {
  id: string;
  level: AlertLevel;
  source: string;
  message: string;
  details?: string;
  ts: number;
  resolved: boolean;
};

export type ImmuneStatus = {
  healthy: boolean;
  alerts: CiAlert[];
  lastCheck: number;
};

async function safePush(repoRoot: string): Promise<void> {
  try {
    await git(["push"], { cwd: repoRoot });
  } catch {
    await git(["push", "-u", "origin", "HEAD"], { cwd: repoRoot });
  }
}

async function ensureImmuneDir(repoRoot: string): Promise<string> {
  const dir = path.join(repoRoot, "swarm", "immune");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function reportCiAlert(input: {
  repoPath?: string;
  level: AlertLevel;
  source: string;
  message: string;
  details?: string;
  commitMode: "none" | "local" | "push";
}): Promise<{ alertId: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const immuneDir = await ensureImmuneDir(repoRoot);

  const alertId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const alert: CiAlert = {
    id: alertId,
    level: input.level,
    source: input.source,
    message: input.message,
    details: input.details,
    ts: Date.now(),
    resolved: false,
  };

  const alertPath = path.join(immuneDir, `${alertId}.json`);
  await fs.writeFile(alertPath, JSON.stringify(alert, null, 2) + "\n", "utf8");

  // Also broadcast as event
  await appendEvent({
    repoPath: repoRoot,
    type: input.level === "critical" ? "emergency_stop" : "ci_alert",
    payload: alert,
    commitMode: "none",
  });

  const rel = path.posix.join("swarm", "immune", `${alertId}.json`);
  if (input.commitMode !== "none") {
    await git(["add", rel, path.posix.join("swarm", "EVENTS.ndjson")], { cwd: repoRoot });
    await git(["commit", "-m", `swarm: CI alert ${input.level} - ${input.source}`], { cwd: repoRoot });
    if (input.commitMode === "push") await safePush(repoRoot);
  }

  return { alertId };
}

export async function resolveAlert(input: {
  repoPath?: string;
  alertId: string;
  commitMode: "none" | "local" | "push";
}): Promise<{ ok: boolean }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const alertPath = path.join(repoRoot, "swarm", "immune", `${input.alertId}.json`);

  try {
    const raw = await fs.readFile(alertPath, "utf8");
    const alert: CiAlert = JSON.parse(raw);
    alert.resolved = true;
    await fs.writeFile(alertPath, JSON.stringify(alert, null, 2) + "\n", "utf8");

    const rel = path.posix.join("swarm", "immune", `${input.alertId}.json`);
    if (input.commitMode !== "none") {
      await git(["add", rel], { cwd: repoRoot });
      await git(["commit", "-m", `swarm: resolved alert ${input.alertId}`], { cwd: repoRoot });
      if (input.commitMode === "push") await safePush(repoRoot);
    }

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function getImmuneStatus(repoPath?: string): Promise<ImmuneStatus> {
  const repoRoot = await getRepoRoot(repoPath);
  const immuneDir = path.join(repoRoot, "swarm", "immune");
  const alerts: CiAlert[] = [];

  try {
    const entries = await fs.readdir(immuneDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(immuneDir, ent.name), "utf8");
        const alert: CiAlert = JSON.parse(raw);
        if (!alert.resolved) {
          alerts.push(alert);
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // dir doesn't exist
  }

  // Sort by severity and time
  const levelOrder: Record<AlertLevel, number> = { critical: 0, error: 1, warning: 2, info: 3 };
  alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level] || b.ts - a.ts);

  const healthy = !alerts.some(a => a.level === "critical" || a.level === "error");

  return {
    healthy,
    alerts,
    lastCheck: Date.now(),
  };
}

export async function runLocalTests(repoPath?: string): Promise<{ passed: boolean; output: string }> {
  const repoRoot = await getRepoRoot(repoPath);

  try {
    const pkgPath = path.join(repoRoot, "package.json");
    const raw = await fs.readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw);

    if (pkg?.scripts?.test) {
      const { stdout, stderr } = await execFileAsync("npm", ["test"], {
        cwd: repoRoot,
        windowsHide: true,
        timeout: 120000,
      });
      return { passed: true, output: stdout + stderr };
    }

    return { passed: true, output: "No test script found" };
  } catch (err: unknown) {
    const e = err as Record<string, unknown> | undefined;
    return { passed: false, output: String(e?.stdout || e?.stderr || getErrorMessage(err) || "Test failed") };
  }
}
