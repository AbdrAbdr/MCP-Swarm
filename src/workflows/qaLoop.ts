import fs from "node:fs/promises";
import path from "node:path";

import { git } from "./git.js";
import { getRepoRoot } from "./repo.js";

/**
 * QA Loop: reviewer → fixer → loop
 * 
 * Enhanced Quality Gate with iterative review/fix cycles:
 * 1. REVIEWER - Runs checks, identifies issues
 * 2. FIXER - Addresses issues
 * 3. LOOP - Repeat until all checks pass or max iterations reached
 */

export type QACheck = {
  name: string;
  type: "lint" | "test" | "type" | "security" | "coverage" | "custom";
  command: string;
  passed: boolean;
  output?: string;
  fixSuggestion?: string;
  [key: string]: unknown;
};

export type QAIteration = {
  number: number;
  startedAt: number;
  completedAt?: number;
  checks: QACheck[];
  allPassed: boolean;
  fixesApplied: string[];
  [key: string]: unknown;
};

export type QALoop = {
  id: string;
  taskId: string;
  branch?: string;
  createdAt: number;
  updatedAt: number;
  status: "running" | "passed" | "failed" | "max_iterations";
  currentIteration: number;
  maxIterations: number;
  iterations: QAIteration[];
  autoFix: boolean;
  [key: string]: unknown;
};

async function safePush(repoRoot: string): Promise<void> {
  try {
    await git(["push"], { cwd: repoRoot });
  } catch {
    await git(["push", "-u", "origin", "HEAD"], { cwd: repoRoot });
  }
}

async function ensureQADir(repoRoot: string): Promise<string> {
  const dir = path.join(repoRoot, "orchestrator", "qa-loops");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function loadLoop(repoRoot: string, loopId: string): Promise<QALoop | null> {
  const qaDir = await ensureQADir(repoRoot);
  const filePath = path.join(qaDir, `${loopId}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveLoop(repoRoot: string, loop: QALoop, commitMode: "none" | "local" | "push"): Promise<void> {
  const qaDir = await ensureQADir(repoRoot);
  const filePath = path.join(qaDir, `${loop.id}.json`);
  
  loop.updatedAt = Date.now();
  await fs.writeFile(filePath, JSON.stringify(loop, null, 2) + "\n", "utf8");
  
  const relPath = path.posix.join("orchestrator", "qa-loops", `${loop.id}.json`);
  
  if (commitMode !== "none") {
    await git(["add", relPath], { cwd: repoRoot });
    await git(["commit", "-m", `qa-loop: iteration ${loop.currentIteration} for ${loop.taskId}`], { cwd: repoRoot });
    if (commitMode === "push") await safePush(repoRoot);
  }
}

// ==================== TOOL FUNCTIONS ====================

/**
 * Start a QA loop for a task
 */
export async function startQALoop(input: {
  repoPath?: string;
  taskId: string;
  branch?: string;
  maxIterations?: number;
  autoFix?: boolean;
  checks?: Array<{ name: string; type: QACheck["type"]; command: string }>;
  commitMode: "none" | "local" | "push";
}): Promise<{ loopId: string; message: string }> {
  const repoRoot = input.repoPath || process.cwd();
  
  const loopId = `qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  const defaultChecks: Array<{ name: string; type: QACheck["type"]; command: string }> = [
    { name: "TypeScript", type: "type", command: "npx tsc --noEmit" },
    { name: "ESLint", type: "lint", command: "npx eslint . --ext .ts,.tsx" },
    { name: "Tests", type: "test", command: "npm test" },
  ];
  
  const loop: QALoop = {
    id: loopId,
    taskId: input.taskId,
    branch: input.branch,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "running",
    currentIteration: 0,
    maxIterations: input.maxIterations || 5,
    iterations: [],
    autoFix: input.autoFix ?? false,
  };
  
  // Store checks config
  const checksConfig = input.checks || defaultChecks;
  (loop as Record<string, unknown>).checksConfig = checksConfig;
  
  await saveLoop(repoRoot, loop, input.commitMode);
  
  return { 
    loopId, 
    message: `QA loop started for ${input.taskId}. Max ${loop.maxIterations} iterations. Call run_qa_iteration to begin.`
  };
}

/**
 * Run one iteration of QA checks
 */
export async function runQAIteration(input: {
  repoPath?: string;
  loopId: string;
  checkResults: Array<{
    name: string;
    passed: boolean;
    output?: string;
    fixSuggestion?: string;
  }>;
  commitMode: "none" | "local" | "push";
}): Promise<{ 
  allPassed: boolean; 
  iteration: number; 
  failedChecks: string[];
  status: QALoop["status"];
  message: string;
}> {
  const repoRoot = input.repoPath || process.cwd();
  const loop = await loadLoop(repoRoot, input.loopId);
  
  if (!loop) {
    return { 
      allPassed: false, 
      iteration: 0, 
      failedChecks: [], 
      status: "failed",
      message: `Loop ${input.loopId} not found` 
    };
  }
  
  loop.currentIteration++;
  
  const checksConfig = (loop as Record<string, unknown>).checksConfig as Array<{ name: string; type: QACheck["type"]; command: string }> || [];
  
  const checks: QACheck[] = input.checkResults.map(r => {
    const config = checksConfig.find(c => c.name === r.name);
    return {
      name: r.name,
      type: config?.type || "custom",
      command: config?.command || "",
      passed: r.passed,
      output: r.output,
      fixSuggestion: r.fixSuggestion,
    };
  });
  
  const allPassed = checks.every(c => c.passed);
  const failedChecks = checks.filter(c => !c.passed).map(c => c.name);
  
  const iteration: QAIteration = {
    number: loop.currentIteration,
    startedAt: Date.now(),
    completedAt: Date.now(),
    checks,
    allPassed,
    fixesApplied: [],
  };
  
  loop.iterations.push(iteration);
  
  if (allPassed) {
    loop.status = "passed";
  } else if (loop.currentIteration >= loop.maxIterations) {
    loop.status = "max_iterations";
  }
  
  await saveLoop(repoRoot, loop, input.commitMode);
  
  const message = allPassed
    ? `All checks passed on iteration ${loop.currentIteration}!`
    : loop.status === "max_iterations"
    ? `Max iterations (${loop.maxIterations}) reached. Failed checks: ${failedChecks.join(", ")}`
    : `Iteration ${loop.currentIteration}: ${failedChecks.length} check(s) failed. Fix and run again.`;
  
  return {
    allPassed,
    iteration: loop.currentIteration,
    failedChecks,
    status: loop.status,
    message,
  };
}

/**
 * Log a fix that was applied
 */
export async function logQAFix(input: {
  repoPath?: string;
  loopId: string;
  fixDescription: string;
  commitMode: "none" | "local" | "push";
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = input.repoPath || process.cwd();
  const loop = await loadLoop(repoRoot, input.loopId);
  
  if (!loop) {
    return { success: false, message: `Loop ${input.loopId} not found` };
  }
  
  if (loop.iterations.length === 0) {
    return { success: false, message: "No iterations yet. Run run_qa_iteration first." };
  }
  
  const lastIteration = loop.iterations[loop.iterations.length - 1];
  lastIteration.fixesApplied.push(input.fixDescription);
  
  await saveLoop(repoRoot, loop, input.commitMode);
  
  return { 
    success: true, 
    message: `Fix logged: ${input.fixDescription}. Run next QA iteration to verify.`
  };
}

/**
 * Get QA loop status
 */
export async function getQALoop(input: {
  repoPath?: string;
  loopId: string;
}): Promise<{ loop: QALoop | null }> {
  const repoRoot = input.repoPath || process.cwd();
  const loop = await loadLoop(repoRoot, input.loopId);
  return { loop };
}

/**
 * List all QA loops
 */
export async function listQALoops(input: {
  repoPath?: string;
  status?: QALoop["status"];
}): Promise<{ loops: Array<{ id: string; taskId: string; status: string; iterations: number }> }> {
  const repoRoot = input.repoPath || process.cwd();
  const qaDir = await ensureQADir(repoRoot);
  
  const files = await fs.readdir(qaDir).catch(() => []);
  const loops: Array<{ id: string; taskId: string; status: string; iterations: number }> = [];
  
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(qaDir, file), "utf8");
      const l: QALoop = JSON.parse(raw);
      if (!input.status || l.status === input.status) {
        loops.push({
          id: l.id,
          taskId: l.taskId,
          status: l.status,
          iterations: l.currentIteration,
        });
      }
    } catch {
      // skip invalid files
    }
  }
  
  return { loops };
}

/**
 * Get fix suggestions for failed checks
 */
export async function getQAFixSuggestions(input: {
  repoPath?: string;
  loopId: string;
}): Promise<{ suggestions: Array<{ check: string; suggestion: string }> }> {
  const repoRoot = input.repoPath || process.cwd();
  const loop = await loadLoop(repoRoot, input.loopId);
  
  if (!loop || loop.iterations.length === 0) {
    return { suggestions: [] };
  }
  
  const lastIteration = loop.iterations[loop.iterations.length - 1];
  const suggestions: Array<{ check: string; suggestion: string }> = [];
  
  for (const check of lastIteration.checks) {
    if (!check.passed && check.fixSuggestion) {
      suggestions.push({
        check: check.name,
        suggestion: check.fixSuggestion,
      });
    }
  }
  
  return { suggestions };
}

/**
 * Generate QA summary report
 */
export async function generateQAReport(input: {
  repoPath?: string;
  loopId: string;
  commitMode: "none" | "local" | "push";
}): Promise<{ success: boolean; report: string }> {
  const repoRoot = input.repoPath || process.cwd();
  const loop = await loadLoop(repoRoot, input.loopId);
  
  if (!loop) {
    return { success: false, report: `Loop ${input.loopId} not found` };
  }
  
  const statusEmoji: Record<string, string> = {
    running: "🔄",
    passed: "✅",
    failed: "❌",
    max_iterations: "⚠️",
  };
  
  let report = `# QA Loop Report

**Task:** ${loop.taskId}
**Status:** ${statusEmoji[loop.status]} ${loop.status}
**Iterations:** ${loop.currentIteration}/${loop.maxIterations}
**Branch:** ${loop.branch || "N/A"}

---

`;

  for (const iter of loop.iterations) {
    report += `## Iteration ${iter.number}

| Check | Status | 
|-------|--------|
${iter.checks.map(c => `| ${c.name} | ${c.passed ? "✅" : "❌"} |`).join("\n")}

${iter.fixesApplied.length > 0 ? `**Fixes Applied:**\n${iter.fixesApplied.map(f => `- ${f}`).join("\n")}\n` : ""}

---

`;
  }
  
  report += `
_Generated by MCP Swarm QA Loop_
`;

  // Save report
  const qaDir = path.join(repoRoot, "orchestrator", "quality");
  await fs.mkdir(qaDir, { recursive: true });
  const reportPath = path.join(qaDir, `${loop.id}-report.md`);
  await fs.writeFile(reportPath, report, "utf8");
  
  const relPath = path.posix.join("orchestrator", "quality", `${loop.id}-report.md`);
  
  if (input.commitMode !== "none") {
    await git(["add", relPath], { cwd: repoRoot });
    await git(["commit", "-m", `qa: report for ${loop.taskId}`], { cwd: repoRoot });
    if (input.commitMode === "push") await safePush(repoRoot);
  }
  
  return { success: true, report };
}
