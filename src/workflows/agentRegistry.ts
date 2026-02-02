import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { git, gitTry } from "./git.js";
import { getRepoRoot } from "./repo.js";

import { AGENT_RULES_CONTENT } from "./constants.js";

const ADJECTIVES = [
  "Blue",
  "Green",
  "Silver",
  "Golden",
  "Quiet",
  "Swift",
  "Brave",
  "Calm",
  "Bright",
  "Sharp",
  "Bold",
  "Gentle",
  "Hidden",
  "Rapid",
  "Lucky",
  "Witty",
  "Clever",
  "Solid",
  "Amber",
  "Crimson",
];

const NOUNS = [
  "Lake",
  "Castle",
  "Fox",
  "Eagle",
  "Pine",
  "River",
  "Stone",
  "Beacon",
  "Comet",
  "Harbor",
  "Garden",
  "Bridge",
  "Forge",
  "Shield",
  "Tower",
  "Lion",
  "Falcon",
  "Canyon",
  "Cloud",
  "Anchor",
];

export type AgentInfo = {
  agentId: string;
  agentName: string;
  hostname: string;
  platform: string;
  createdAtIso: string;
  lastSeenIso?: string;
};

export type AgentRegisterInput = {
  repoPath?: string;
  program?: string;
  model?: string;
  commitMode: "none" | "local" | "push";
};

export type AgentRegisterOutput = {
  repoRoot: string;
  agent: AgentInfo;
  agentPath: string;
  agentRelativePath: string;
};

function randPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function safePush(repoRoot: string): Promise<void> {
  const first = await gitTry(["push"], { cwd: repoRoot });
  if (first.ok) return;
  await git(["push", "-u", "origin", "HEAD"], { cwd: repoRoot });
}

async function ensureAgentsDir(repoRoot: string): Promise<string> {
  const dir = path.join(repoRoot, "swarm", "agents");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function listAgentNames(dir: string): Promise<Set<string>> {
  const s = new Set<string>();
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!ent.name.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(dir, ent.name), "utf8");
      const parsed = JSON.parse(raw) as Partial<AgentInfo>;
      if (parsed.agentName) s.add(parsed.agentName);
    } catch {
      // ignore
    }
  }
  return s;
}

async function generateUniqueName(dir: string): Promise<string> {
  const used = await listAgentNames(dir);
  for (let i = 0; i < 200; i++) {
    const name = `${randPick(ADJECTIVES)}${randPick(NOUNS)}`;
    if (!used.has(name)) return name;
  }
  return `${randPick(ADJECTIVES)}${randPick(NOUNS)}${Math.floor(Math.random() * 1000)}`;
}

function machineId(): string {
  return `${os.hostname()}-${os.platform()}-${os.userInfo().username}`.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function bootstrapProject(repoPath?: string): Promise<{ success: boolean; files: string[] }> {
  const repoRoot = await getRepoRoot(repoPath);
  const filesToCreate = ["CLAUDE.md", "GEMINI.md", "AGENT.md", "AGENTS.md", ".cursorrules", ".windsurfrules", ".clinerules"];
  const created: string[] = [];

  for (const fileName of filesToCreate) {
    const filePath = path.join(repoRoot, fileName);
    let existingContent = "";
    try {
      existingContent = await fs.readFile(filePath, "utf8");
    } catch {
      // ignore
    }

    if (!existingContent.includes("# MCP Swarm Agent Rules")) {
      const newContent = existingContent 
        ? existingContent + "\n\n" + AGENT_RULES_CONTENT 
        : AGENT_RULES_CONTENT;
      await fs.writeFile(filePath, newContent, "utf8");
      created.push(fileName);
    }
  }

  // Ensure directories
  await fs.mkdir(path.join(repoRoot, "swarm", "agents"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, "orchestrator"), { recursive: true });

  return { success: true, files: created };
}

export async function registerAgent(input: AgentRegisterInput): Promise<AgentRegisterOutput> {
  const repoRoot = await getRepoRoot(input.repoPath);
  
  // AUTO-INIT: Check if swarm is initialized, if not - bootstrap
  const swarmDir = path.join(repoRoot, "swarm");
  let isInitialized = false;
  try {
    await fs.access(swarmDir);
    isInitialized = true;
  } catch {
    isInitialized = false;
  }

  if (!isInitialized) {
    await bootstrapProject(input.repoPath);
  }

  const dir = await ensureAgentsDir(repoRoot);

  const agentId = machineId();
  const agentPath = path.join(dir, `${agentId}.json`);
  const agentRelativePath = path.posix.join("swarm", "agents", `${agentId}.json`);

  let agent: AgentInfo | null = null;
  try {
    const raw = await fs.readFile(agentPath, "utf8");
    agent = JSON.parse(raw) as AgentInfo;
  } catch {
    agent = null;
  }

  if (!agent?.agentName) {
    const agentName = await generateUniqueName(dir);
    agent = {
      agentId,
      agentName,
      hostname: os.hostname(),
      platform: `${os.platform()}-${os.arch()}`,
      createdAtIso: nowIso(),
      lastSeenIso: nowIso(),
    };
  } else {
    agent = { ...agent, lastSeenIso: nowIso() };
  }

  await fs.writeFile(agentPath, JSON.stringify(agent, null, 2) + "\n", "utf8");

  if (input.commitMode !== "none") {
    await git(["add", agentRelativePath], { cwd: repoRoot });
    await git(["commit", "-m", `swarm: register agent ${agent.agentName}`], { cwd: repoRoot });
    if (input.commitMode === "push") {
      await safePush(repoRoot);
    }
  }

  return { repoRoot, agent, agentPath, agentRelativePath };
}

export async function whoami(repoPath?: string): Promise<{ repoRoot: string; agent: AgentInfo | null }> {
  const repoRoot = await getRepoRoot(repoPath);
  const dir = await ensureAgentsDir(repoRoot);
  const agentId = machineId();
  const agentPath = path.join(dir, `${agentId}.json`);

  try {
    const raw = await fs.readFile(agentPath, "utf8");
    const agent = JSON.parse(raw) as AgentInfo;
    return { repoRoot, agent };
  } catch {
    return { repoRoot, agent: null };
  }
}
