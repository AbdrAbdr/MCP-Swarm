import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { git } from "./git.js";
import { getRepoRoot } from "./repo.js";

export type Briefing = {
  id: string;
  taskId?: string;
  agent: string;
  platform: string;
  branch: string;
  filesWorkedOn: string[];
  currentState: string;
  nextSteps: string[];
  blockers?: string[];
  notes?: string;
  createdAt: number;
};

async function safePush(repoRoot: string): Promise<void> {
  try {
    await git(["push"], { cwd: repoRoot });
  } catch {
    await git(["push", "-u", "origin", "HEAD"], { cwd: repoRoot });
  }
}

async function ensureBriefingsDir(repoRoot: string): Promise<string> {
  const dir = path.join(repoRoot, "orchestrator", "briefings");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function getCurrentPlatform(): string {
  const platform = os.platform();
  const hostname = os.hostname();
  return `${platform === "win32" ? "Windows" : platform === "darwin" ? "macOS" : "Linux"}-${hostname}`;
}

export async function saveBriefing(input: {
  repoPath?: string;
  taskId?: string;
  agent: string;
  filesWorkedOn: string[];
  currentState: string;
  nextSteps: string[];
  blockers?: string[];
  notes?: string;
  commitMode: "none" | "local" | "push";
}): Promise<{ briefingId: string; briefingPath: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const briefingsDir = await ensureBriefingsDir(repoRoot);

  // Get current branch
  const { gitTry, normalizeLineEndings } = await import("./git.js");
  const branchRes = await gitTry(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoRoot });
  const branch = normalizeLineEndings(branchRes.stdout).trim();

  const briefingId = `briefing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const briefing: Briefing = {
    id: briefingId,
    taskId: input.taskId,
    agent: input.agent,
    platform: getCurrentPlatform(),
    branch,
    filesWorkedOn: input.filesWorkedOn,
    currentState: input.currentState,
    nextSteps: input.nextSteps,
    blockers: input.blockers,
    notes: input.notes,
    createdAt: Date.now(),
  };

  const briefingPath = path.join(briefingsDir, `${briefingId}.json`);
  await fs.writeFile(briefingPath, JSON.stringify(briefing, null, 2) + "\n", "utf8");

  // Also create markdown version for human reading
  const mdPath = path.join(briefingsDir, `${briefingId}.md`);
  const mdContent = `# Briefing: ${briefingId}

**Agent:** ${input.agent}
**Platform:** ${briefing.platform}
**Branch:** ${branch}
**Task:** ${input.taskId || "N/A"}
**Created:** ${new Date(briefing.createdAt).toISOString()}

## Current State
${input.currentState}

## Files Worked On
${input.filesWorkedOn.map(f => `- ${f}`).join("\n")}

## Next Steps
${input.nextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

${input.blockers && input.blockers.length > 0 ? `## Blockers\n${input.blockers.map(b => `- ⚠️ ${b}`).join("\n")}` : ""}

${input.notes ? `## Notes\n${input.notes}` : ""}
`;

  await fs.writeFile(mdPath, mdContent, "utf8");

  const relJson = path.posix.join("orchestrator", "briefings", `${briefingId}.json`);
  const relMd = path.posix.join("orchestrator", "briefings", `${briefingId}.md`);

  if (input.commitMode !== "none") {
    await git(["add", relJson, relMd], { cwd: repoRoot });
    await git(["commit", "-m", `orchestrator: briefing from ${input.agent}`], { cwd: repoRoot });
    if (input.commitMode === "push") await safePush(repoRoot);
  }

  return { briefingId, briefingPath };
}

export async function loadBriefing(input: {
  repoPath?: string;
  taskId?: string;
  agent?: string;
}): Promise<{ briefings: Briefing[] }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const briefingsDir = path.join(repoRoot, "orchestrator", "briefings");
  const briefings: Briefing[] = [];

  try {
    const entries = await fs.readdir(briefingsDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(briefingsDir, ent.name), "utf8");
        const briefing: Briefing = JSON.parse(raw);

        // Filter by taskId or agent if specified
        if (input.taskId && briefing.taskId !== input.taskId) continue;
        if (input.agent && briefing.agent !== input.agent) continue;

        briefings.push(briefing);
      } catch {
        // ignore
      }
    }
  } catch {
    // dir doesn't exist
  }

  // Sort by creation time descending (newest first)
  briefings.sort((a, b) => b.createdAt - a.createdAt);
  return { briefings };
}

export async function getLatestBriefingForTask(input: {
  repoPath?: string;
  taskId: string;
}): Promise<Briefing | null> {
  const { briefings } = await loadBriefing({ repoPath: input.repoPath, taskId: input.taskId });
  return briefings.length > 0 ? briefings[0] : null;
}
