/**
 * External Sync - GitHub Issues and Linear.app integration
 * Syncs swarm tasks with external issue trackers
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ========== Types ==========

export interface ExternalIssue {
  id: string;
  externalId: string; // GitHub issue number or Linear issue ID
  source: "github" | "linear";
  url: string;
  title: string;
  body: string;
  state: "open" | "closed";
  labels: string[];
  assignee?: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  linkedTaskId?: string; // Swarm task ID
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

export interface SyncConfig {
  github?: {
    enabled: boolean;
    owner: string;
    repo: string;
    labelFilter?: string[]; // Only sync issues with these labels
    autoImport: boolean; // Auto-import new issues as tasks
    autoClose: boolean; // Auto-close issues when task is done
  };
  linear?: {
    enabled: boolean;
    teamId: string;
    projectId?: string;
    stateFilter?: string[]; // Only sync issues in these states
    autoImport: boolean;
    autoClose: boolean;
  };
}

export interface SyncResult {
  source: "github" | "linear";
  imported: number;
  updated: number;
  closed: number;
  errors: string[];
}

// ========== File Paths ==========

function getSyncDir(repoPath: string): string {
  return path.join(repoPath, ".swarm", "sync");
}

function getConfigPath(repoPath: string): string {
  return path.join(getSyncDir(repoPath), "config.json");
}

function getIssuesPath(repoPath: string): string {
  return path.join(getSyncDir(repoPath), "issues.json");
}

function getTasksDir(repoPath: string): string {
  return path.join(repoPath, "swarm", "tasks");
}

// ========== Helpers ==========

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// ========== GitHub Integration ==========

async function ghCommand(args: string[], cwd: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync("gh", args, { cwd, windowsHide: true });
    return { ok: true, stdout, stderr };
  } catch (err: any) {
    return { ok: false, stdout: "", stderr: err?.message || "gh command failed" };
  }
}

export async function fetchGitHubIssues(repoPath: string): Promise<ExternalIssue[]> {
  const config = await getSyncConfig(repoPath);
  if (!config.github?.enabled) return [];

  const { owner, repo, labelFilter } = config.github;

  // Build gh command
  const args = ["issue", "list", "--repo", `${owner}/${repo}`, "--json", "number,title,body,state,labels,assignees,url,createdAt,updatedAt", "--limit", "100"];
  
  if (labelFilter && labelFilter.length > 0) {
    args.push("--label", labelFilter.join(","));
  }

  const result = await ghCommand(args, repoPath);
  if (!result.ok) {
    console.error("Failed to fetch GitHub issues:", result.stderr);
    return [];
  }

  try {
    const issues = JSON.parse(result.stdout);
    return issues.map((issue: any) => ({
      id: `gh-${issue.number}`,
      externalId: String(issue.number),
      source: "github" as const,
      url: issue.url,
      title: issue.title,
      body: issue.body || "",
      state: issue.state === "OPEN" ? "open" : "closed",
      labels: issue.labels?.map((l: any) => l.name) || [],
      assignee: issue.assignees?.[0]?.login,
      priority: extractPriority(issue.labels?.map((l: any) => l.name) || []),
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      syncedAt: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function createGitHubIssue(
  repoPath: string,
  title: string,
  body: string,
  labels?: string[]
): Promise<{ ok: boolean; issueNumber?: string; url?: string; error?: string }> {
  const config = await getSyncConfig(repoPath);
  if (!config.github?.enabled) {
    return { ok: false, error: "GitHub sync not enabled" };
  }

  const { owner, repo } = config.github;
  const args = ["issue", "create", "--repo", `${owner}/${repo}`, "--title", title, "--body", body];
  
  if (labels && labels.length > 0) {
    args.push("--label", labels.join(","));
  }

  const result = await ghCommand(args, repoPath);
  if (!result.ok) {
    return { ok: false, error: result.stderr };
  }

  // Parse issue URL from output
  const urlMatch = result.stdout.match(/https:\/\/github\.com\/[^\s]+/);
  const url = urlMatch ? urlMatch[0] : undefined;
  const numberMatch = url?.match(/\/issues\/(\d+)/);
  const issueNumber = numberMatch ? numberMatch[1] : undefined;

  return { ok: true, issueNumber, url };
}

export async function closeGitHubIssue(
  repoPath: string,
  issueNumber: string,
  comment?: string
): Promise<{ ok: boolean; error?: string }> {
  const config = await getSyncConfig(repoPath);
  if (!config.github?.enabled) {
    return { ok: false, error: "GitHub sync not enabled" };
  }

  const { owner, repo } = config.github;

  // Add comment if provided
  if (comment) {
    await ghCommand(["issue", "comment", issueNumber, "--repo", `${owner}/${repo}`, "--body", comment], repoPath);
  }

  // Close issue
  const result = await ghCommand(["issue", "close", issueNumber, "--repo", `${owner}/${repo}`], repoPath);
  if (!result.ok) {
    return { ok: false, error: result.stderr };
  }

  return { ok: true };
}

export async function addGitHubComment(
  repoPath: string,
  issueNumber: string,
  comment: string
): Promise<{ ok: boolean; error?: string }> {
  const config = await getSyncConfig(repoPath);
  if (!config.github?.enabled) {
    return { ok: false, error: "GitHub sync not enabled" };
  }

  const { owner, repo } = config.github;
  const result = await ghCommand(["issue", "comment", issueNumber, "--repo", `${owner}/${repo}`, "--body", comment], repoPath);
  
  return { ok: result.ok, error: result.ok ? undefined : result.stderr };
}

// ========== Linear Integration ==========

async function linearRequest(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      return { ok: false, error: `Linear API error: ${response.status}` };
    }

    const result = await response.json();
    if (result.errors) {
      return { ok: false, error: result.errors[0]?.message || "GraphQL error" };
    }

    return { ok: true, data: result.data };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network error" };
  }
}

export async function fetchLinearIssues(repoPath: string): Promise<ExternalIssue[]> {
  const config = await getSyncConfig(repoPath);
  if (!config.linear?.enabled) return [];

  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("LINEAR_API_KEY not set");
    return [];
  }

  const query = `
    query GetIssues($teamId: String!, $first: Int!) {
      team(id: $teamId) {
        issues(first: $first) {
          nodes {
            id
            identifier
            title
            description
            url
            state { name }
            labels { nodes { name } }
            assignee { name }
            priority
            createdAt
            updatedAt
          }
        }
      }
    }
  `;

  const result = await linearRequest(apiKey, query, {
    teamId: config.linear.teamId,
    first: 100,
  });

  if (!result.ok || !result.data?.team?.issues?.nodes) {
    console.error("Failed to fetch Linear issues:", result.error);
    return [];
  }

  return result.data.team.issues.nodes.map((issue: any) => ({
    id: `linear-${issue.identifier}`,
    externalId: issue.identifier,
    source: "linear" as const,
    url: issue.url,
    title: issue.title,
    body: issue.description || "",
    state: ["Done", "Canceled"].includes(issue.state?.name) ? "closed" : "open",
    labels: issue.labels?.nodes?.map((l: any) => l.name) || [],
    assignee: issue.assignee?.name,
    priority: mapLinearPriority(issue.priority),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    syncedAt: new Date().toISOString(),
  }));
}

export async function createLinearIssue(
  repoPath: string,
  title: string,
  description: string,
  priority?: number
): Promise<{ ok: boolean; issueId?: string; url?: string; error?: string }> {
  const config = await getSyncConfig(repoPath);
  if (!config.linear?.enabled) {
    return { ok: false, error: "Linear sync not enabled" };
  }

  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "LINEAR_API_KEY not set" };
  }

  const mutation = `
    mutation CreateIssue($teamId: String!, $title: String!, $description: String, $priority: Int) {
      issueCreate(input: { teamId: $teamId, title: $title, description: $description, priority: $priority }) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `;

  const result = await linearRequest(apiKey, mutation, {
    teamId: config.linear.teamId,
    title,
    description,
    priority,
  });

  if (!result.ok || !result.data?.issueCreate?.success) {
    return { ok: false, error: result.error || "Failed to create issue" };
  }

  return {
    ok: true,
    issueId: result.data.issueCreate.issue.identifier,
    url: result.data.issueCreate.issue.url,
  };
}

export async function updateLinearIssueState(
  repoPath: string,
  issueId: string,
  stateId: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "LINEAR_API_KEY not set" };
  }

  const mutation = `
    mutation UpdateIssue($issueId: String!, $stateId: String!) {
      issueUpdate(id: $issueId, input: { stateId: $stateId }) {
        success
      }
    }
  `;

  const result = await linearRequest(apiKey, mutation, { issueId, stateId });
  return { ok: result.ok && result.data?.issueUpdate?.success, error: result.error };
}

// ========== Priority Helpers ==========

function extractPriority(labels: string[]): ExternalIssue["priority"] {
  const lowercaseLabels = labels.map((l) => l.toLowerCase());
  
  if (lowercaseLabels.some((l) => l.includes("urgent") || l.includes("critical"))) return "urgent";
  if (lowercaseLabels.some((l) => l.includes("high") || l.includes("important"))) return "high";
  if (lowercaseLabels.some((l) => l.includes("medium"))) return "medium";
  if (lowercaseLabels.some((l) => l.includes("low"))) return "low";
  
  return "none";
}

function mapLinearPriority(priority: number): ExternalIssue["priority"] {
  // Linear: 0=none, 1=urgent, 2=high, 3=medium, 4=low
  switch (priority) {
    case 1: return "urgent";
    case 2: return "high";
    case 3: return "medium";
    case 4: return "low";
    default: return "none";
  }
}

function priorityToLinear(priority: ExternalIssue["priority"]): number {
  switch (priority) {
    case "urgent": return 1;
    case "high": return 2;
    case "medium": return 3;
    case "low": return 4;
    default: return 0;
  }
}

// ========== Sync Config ==========

export async function getSyncConfig(repoPath: string): Promise<SyncConfig> {
  return readJson<SyncConfig>(getConfigPath(repoPath), {});
}

export async function setSyncConfig(repoPath: string, config: SyncConfig): Promise<void> {
  await writeJson(getConfigPath(repoPath), config);
}

export async function enableGitHubSync(
  repoPath: string,
  owner: string,
  repo: string,
  options?: { labelFilter?: string[]; autoImport?: boolean; autoClose?: boolean }
): Promise<void> {
  const config = await getSyncConfig(repoPath);
  config.github = {
    enabled: true,
    owner,
    repo,
    labelFilter: options?.labelFilter,
    autoImport: options?.autoImport ?? true,
    autoClose: options?.autoClose ?? true,
  };
  await setSyncConfig(repoPath, config);
}

export async function enableLinearSync(
  repoPath: string,
  teamId: string,
  options?: { projectId?: string; stateFilter?: string[]; autoImport?: boolean; autoClose?: boolean }
): Promise<void> {
  const config = await getSyncConfig(repoPath);
  config.linear = {
    enabled: true,
    teamId,
    projectId: options?.projectId,
    stateFilter: options?.stateFilter,
    autoImport: options?.autoImport ?? true,
    autoClose: options?.autoClose ?? true,
  };
  await setSyncConfig(repoPath, config);
}

// ========== Cached Issues ==========

async function getCachedIssues(repoPath: string): Promise<ExternalIssue[]> {
  return readJson<ExternalIssue[]>(getIssuesPath(repoPath), []);
}

async function setCachedIssues(repoPath: string, issues: ExternalIssue[]): Promise<void> {
  await writeJson(getIssuesPath(repoPath), issues);
}

// ========== Task Sync ==========

interface SwarmTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  externalId?: string;
  externalSource?: "github" | "linear";
}

async function listSwarmTasks(repoPath: string): Promise<SwarmTask[]> {
  const tasksDir = getTasksDir(repoPath);
  try {
    const files = await fs.readdir(tasksDir);
    const tasks: SwarmTask[] = [];
    
    for (const file of files) {
      if (file.endsWith(".md")) {
        const content = await fs.readFile(path.join(tasksDir, file), "utf8");
        const task = parseTaskFile(file, content);
        if (task) tasks.push(task);
      }
    }
    
    return tasks;
  } catch {
    return [];
  }
}

function parseTaskFile(filename: string, content: string): SwarmTask | null {
  const id = filename.replace(/\.md$/, "");
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const statusMatch = content.match(/status:\s*(\w+)/i);
  const priorityMatch = content.match(/priority:\s*(\w+)/i);
  const externalIdMatch = content.match(/external_id:\s*(.+)/i);
  const externalSourceMatch = content.match(/external_source:\s*(\w+)/i);

  return {
    id,
    title: titleMatch?.[1] || id,
    description: content,
    status: statusMatch?.[1] || "pending",
    priority: priorityMatch?.[1],
    externalId: externalIdMatch?.[1],
    externalSource: externalSourceMatch?.[1] as "github" | "linear" | undefined,
  };
}

async function createSwarmTaskFromIssue(repoPath: string, issue: ExternalIssue): Promise<string> {
  const tasksDir = getTasksDir(repoPath);
  await ensureDir(tasksDir);

  const taskId = `${issue.source}-${issue.externalId}`;
  const taskPath = path.join(tasksDir, `${taskId}.md`);

  const content = `# ${issue.title}

## Metadata
- status: pending
- priority: ${issue.priority || "medium"}
- external_id: ${issue.externalId}
- external_source: ${issue.source}
- external_url: ${issue.url}
- synced_at: ${new Date().toISOString()}

## Description
${issue.body}

## Labels
${issue.labels.map((l) => `- ${l}`).join("\n") || "- none"}
`;

  await fs.writeFile(taskPath, content);
  return taskId;
}

// ========== Main Sync Functions ==========

export async function syncFromGitHub(repoPath: string): Promise<SyncResult> {
  const result: SyncResult = { source: "github", imported: 0, updated: 0, closed: 0, errors: [] };
  
  const config = await getSyncConfig(repoPath);
  if (!config.github?.enabled) {
    result.errors.push("GitHub sync not enabled");
    return result;
  }

  try {
    // Fetch issues from GitHub
    const ghIssues = await fetchGitHubIssues(repoPath);
    const existingTasks = await listSwarmTasks(repoPath);
    const cachedIssues = await getCachedIssues(repoPath);

    // Find new issues to import
    for (const issue of ghIssues) {
      if (issue.state === "closed") continue;

      const existingTask = existingTasks.find(
        (t) => t.externalId === issue.externalId && t.externalSource === "github"
      );

      if (!existingTask && config.github.autoImport) {
        // Create new task
        await createSwarmTaskFromIssue(repoPath, issue);
        result.imported++;
      }
    }

    // Update cache
    const updatedCache = cachedIssues.filter((i) => i.source !== "github");
    updatedCache.push(...ghIssues);
    await setCachedIssues(repoPath, updatedCache);

    result.updated = ghIssues.length;
  } catch (err: any) {
    result.errors.push(err?.message || "Sync failed");
  }

  return result;
}

export async function syncFromLinear(repoPath: string): Promise<SyncResult> {
  const result: SyncResult = { source: "linear", imported: 0, updated: 0, closed: 0, errors: [] };
  
  const config = await getSyncConfig(repoPath);
  if (!config.linear?.enabled) {
    result.errors.push("Linear sync not enabled");
    return result;
  }

  try {
    const linearIssues = await fetchLinearIssues(repoPath);
    const existingTasks = await listSwarmTasks(repoPath);
    const cachedIssues = await getCachedIssues(repoPath);

    for (const issue of linearIssues) {
      if (issue.state === "closed") continue;

      const existingTask = existingTasks.find(
        (t) => t.externalId === issue.externalId && t.externalSource === "linear"
      );

      if (!existingTask && config.linear.autoImport) {
        await createSwarmTaskFromIssue(repoPath, issue);
        result.imported++;
      }
    }

    const updatedCache = cachedIssues.filter((i) => i.source !== "linear");
    updatedCache.push(...linearIssues);
    await setCachedIssues(repoPath, updatedCache);

    result.updated = linearIssues.length;
  } catch (err: any) {
    result.errors.push(err?.message || "Sync failed");
  }

  return result;
}

export async function syncToGitHub(repoPath: string): Promise<SyncResult> {
  const result: SyncResult = { source: "github", imported: 0, updated: 0, closed: 0, errors: [] };
  
  const config = await getSyncConfig(repoPath);
  if (!config.github?.enabled || !config.github.autoClose) {
    return result;
  }

  try {
    const tasks = await listSwarmTasks(repoPath);
    const cachedIssues = await getCachedIssues(repoPath);

    for (const task of tasks) {
      if (task.status !== "done" || task.externalSource !== "github" || !task.externalId) {
        continue;
      }

      const cachedIssue = cachedIssues.find(
        (i) => i.externalId === task.externalId && i.source === "github"
      );

      if (cachedIssue && cachedIssue.state === "open") {
        const closeResult = await closeGitHubIssue(
          repoPath,
          task.externalId,
          `Closed by MCP Swarm agent. Task ${task.id} completed.`
        );

        if (closeResult.ok) {
          result.closed++;
          // Update cache
          cachedIssue.state = "closed";
        } else {
          result.errors.push(`Failed to close issue #${task.externalId}: ${closeResult.error}`);
        }
      }
    }

    await setCachedIssues(repoPath, cachedIssues);
  } catch (err: any) {
    result.errors.push(err?.message || "Sync failed");
  }

  return result;
}

export async function syncAll(repoPath: string): Promise<{
  github?: SyncResult;
  linear?: SyncResult;
}> {
  const config = await getSyncConfig(repoPath);
  const results: { github?: SyncResult; linear?: SyncResult } = {};

  if (config.github?.enabled) {
    results.github = await syncFromGitHub(repoPath);
    const toGh = await syncToGitHub(repoPath);
    results.github.closed = toGh.closed;
    results.github.errors.push(...toGh.errors);
  }

  if (config.linear?.enabled) {
    results.linear = await syncFromLinear(repoPath);
  }

  return results;
}

// ========== Export Task to External ==========

export async function exportTaskToGitHub(
  repoPath: string,
  taskId: string
): Promise<{ ok: boolean; issueNumber?: string; url?: string; error?: string }> {
  const tasks = await listSwarmTasks(repoPath);
  const task = tasks.find((t) => t.id === taskId);
  
  if (!task) {
    return { ok: false, error: `Task ${taskId} not found` };
  }

  if (task.externalId && task.externalSource === "github") {
    return { ok: false, error: `Task already linked to GitHub issue #${task.externalId}` };
  }

  const labels = ["swarm-task"];
  if (task.priority) labels.push(`priority:${task.priority}`);

  return createGitHubIssue(repoPath, task.title, task.description || "", labels);
}

export async function exportTaskToLinear(
  repoPath: string,
  taskId: string
): Promise<{ ok: boolean; issueId?: string; url?: string; error?: string }> {
  const tasks = await listSwarmTasks(repoPath);
  const task = tasks.find((t) => t.id === taskId);
  
  if (!task) {
    return { ok: false, error: `Task ${taskId} not found` };
  }

  if (task.externalId && task.externalSource === "linear") {
    return { ok: false, error: `Task already linked to Linear issue ${task.externalId}` };
  }

  const priority = priorityToLinear(task.priority as ExternalIssue["priority"]);
  return createLinearIssue(repoPath, task.title, task.description || "", priority);
}

// ========== Status ==========

export async function getSyncStatus(repoPath: string): Promise<{
  config: SyncConfig;
  cachedIssues: { github: number; linear: number };
  linkedTasks: number;
}> {
  const config = await getSyncConfig(repoPath);
  const cachedIssues = await getCachedIssues(repoPath);
  const tasks = await listSwarmTasks(repoPath);

  const githubIssues = cachedIssues.filter((i) => i.source === "github").length;
  const linearIssues = cachedIssues.filter((i) => i.source === "linear").length;
  const linkedTasks = tasks.filter((t) => t.externalId).length;

  return {
    config,
    cachedIssues: { github: githubIssues, linear: linearIssues },
    linkedTasks,
  };
}
