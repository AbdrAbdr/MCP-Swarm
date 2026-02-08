import fs from "node:fs/promises";
import path from "node:path";

import { gitTry, normalizeLineEndings } from "./git.js";
import { getRepoRoot } from "./repo.js";

export type ConflictPrediction = {
  file: string;
  conflictScore: number;
  reason: string;
  recentEditors: string[];
};

export async function predictConflicts(input: {
  repoPath?: string;
  filesToEdit: string[];
}): Promise<{ predictions: ConflictPrediction[] }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const predictions: ConflictPrediction[] = [];

  for (const file of input.filesToEdit) {
    let score = 0;
    const reasons: string[] = [];
    let editors: string[] = [];

    // Get recent editors
    const logRes = await gitTry(["log", "--format=%an", "-n", "20", "--", file], { cwd: repoRoot });
    if (logRes.ok) {
      editors = [...new Set(normalizeLineEndings(logRes.stdout).trim().split("\n").filter(Boolean))];
      if (editors.length >= 3) {
        score += 30;
        reasons.push(`${editors.length} different editors`);
      }
    }

    // Check edit frequency
    const countRes = await gitTry(["log", "--oneline", "-n", "100", "--", file], { cwd: repoRoot });
    if (countRes.ok) {
      const editCount = normalizeLineEndings(countRes.stdout).trim().split("\n").filter(Boolean).length;
      if (editCount > 20) {
        score += 40;
        reasons.push(`${editCount} recent edits (hot file)`);
      } else if (editCount > 10) {
        score += 20;
        reasons.push(`${editCount} recent edits`);
      }
    }

    // Check for merge conflicts in history
    const mergeRes = await gitTry(["log", "--oneline", "--grep=conflict", "-n", "10", "--", file], { cwd: repoRoot });
    if (mergeRes.ok) {
      const conflicts = normalizeLineEndings(mergeRes.stdout).trim().split("\n").filter(Boolean).length;
      if (conflicts > 0) {
        score += conflicts * 15;
        reasons.push(`${conflicts} historical conflicts`);
      }
    }

    predictions.push({
      file,
      conflictScore: Math.min(100, score),
      reason: reasons.length > 0 ? reasons.join(", ") : "Low risk",
      recentEditors: editors.slice(0, 5),
    });
  }

  predictions.sort((a, b) => b.conflictScore - a.conflictScore);
  return { predictions };
}

// ==================== ADVANCED CONFLICT PREDICTION ====================

type FileConflictStats = {
  filePath: string;
  conflictCount: number;
  mergeCount: number;
  lastConflict: string | null;
  hotspotScore: number;
  contributors: string[];
  avgChangesPerCommit: number;
};

type ConflictDb = {
  files: { [filePath: string]: FileConflictStats };
  lastAnalysis: string;
  totalMerges: number;
  totalConflicts: number;
};

/**
 * Путь к базе данных конфликтов
 */
function getConflictDbPath(repoRoot: string): string {
  return path.join(repoRoot, "swarm", "CONFLICT_HISTORY.json");
}

/**
 * Загружает базу конфликтов
 */
async function loadConflictDb(repoRoot: string): Promise<ConflictDb> {
  const dbPath = getConflictDbPath(repoRoot);
  try {
    const content = await fs.readFile(dbPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { files: {}, lastAnalysis: "", totalMerges: 0, totalConflicts: 0 };
  }
}

/**
 * Сохраняет базу конфликтов
 */
async function saveConflictDb(repoRoot: string, db: ConflictDb, commitMode: "none" | "local" | "push"): Promise<void> {
  const swarmDir = path.join(repoRoot, "swarm");
  await fs.mkdir(swarmDir, { recursive: true });

  const dbPath = getConflictDbPath(repoRoot);
  db.lastAnalysis = new Date().toISOString();
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2), "utf-8");

  if (commitMode !== "none") {
    await gitTry(["add", dbPath], { cwd: repoRoot });
    await gitTry(["commit", "-m", "swarm: update conflict history"], { cwd: repoRoot });
    if (commitMode === "push") {
      await gitTry(["push"], { cwd: repoRoot });
    }
  }
}

/**
 * Анализирует историю Git для выявления паттернов конфликтов
 */
export async function analyzeConflictHistory(input: {
  repoPath?: string;
  lookbackDays?: number;
  commitMode: "none" | "local" | "push";
}): Promise<{ analyzed: boolean; filesScanned: number; hotspots: string[] }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const lookbackDays = input.lookbackDays || 90;
  const since = `${lookbackDays} days ago`;

  const db = await loadConflictDb(repoRoot);

  // Get merge commits
  const mergeRes = await gitTry(["log", "--merges", "--format=%H", `--since=${since}`], { cwd: repoRoot });
  const mergeCommits = mergeRes.ok ? normalizeLineEndings(mergeRes.stdout).trim().split("\n").filter(Boolean) : [];
  db.totalMerges = mergeCommits.length;

  const fileChangeCounts: Map<string, number> = new Map();
  const fileContributors: Map<string, Set<string>> = new Map();

  for (const commit of mergeCommits.slice(0, 100)) {
    const filesRes = await gitTry(["diff-tree", "--no-commit-id", "--name-only", "-r", commit], { cwd: repoRoot });
    if (!filesRes.ok) continue;

    const files = normalizeLineEndings(filesRes.stdout).trim().split("\n").filter(Boolean);
    const authorRes = await gitTry(["log", "-1", "--format=%an", commit], { cwd: repoRoot });
    const author = authorRes.ok ? authorRes.stdout.trim() : "unknown";

    for (const file of files) {
      fileChangeCounts.set(file, (fileChangeCounts.get(file) || 0) + 1);
      if (!fileContributors.has(file)) {
        fileContributors.set(file, new Set());
      }
      fileContributors.get(file)!.add(author);
    }
  }

  // Search for conflict-related commits
  const conflictRes = await gitTry(["log", "--format=%H", `--since=${since}`, "--grep=conflict", "-i"], { cwd: repoRoot });
  const conflictCommits = conflictRes.ok ? normalizeLineEndings(conflictRes.stdout).trim().split("\n").filter(Boolean) : [];

  const conflictFiles: Set<string> = new Set();
  for (const commit of conflictCommits.slice(0, 50)) {
    const filesRes = await gitTry(["diff-tree", "--no-commit-id", "--name-only", "-r", commit], { cwd: repoRoot });
    if (filesRes.ok) {
      normalizeLineEndings(filesRes.stdout).trim().split("\n").filter(Boolean).forEach(f => conflictFiles.add(f));
    }
  }
  db.totalConflicts = conflictFiles.size;

  // Calculate hotspot scores
  for (const [file, mergeCount] of fileChangeCounts) {
    const conflictCount = conflictFiles.has(file) ? 1 : 0;
    const contributors = [...(fileContributors.get(file) || [])];

    const hotspotScore =
      (mergeCount * 2) +
      (conflictCount * 10) +
      (contributors.length > 3 ? contributors.length * 3 : 0);

    db.files[file] = {
      filePath: file,
      conflictCount,
      mergeCount,
      lastConflict: conflictCount > 0 ? new Date().toISOString() : null,
      hotspotScore,
      contributors,
      avgChangesPerCommit: 0,
    };
  }

  await saveConflictDb(repoRoot, db, input.commitMode);

  const hotspots = Object.values(db.files)
    .sort((a, b) => b.hotspotScore - a.hotspotScore)
    .slice(0, 10)
    .map(f => f.filePath);

  return {
    analyzed: true,
    filesScanned: Object.keys(db.files).length,
    hotspots,
  };
}

/**
 * Получает список hotspot файлов (наиболее конфликтных)
 */
export async function getConflictHotspots(input: { repoPath?: string; limit?: number }): Promise<{ hotspots: FileConflictStats[] }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const db = await loadConflictDb(repoRoot);
  const limit = input.limit || 20;

  const hotspots = Object.values(db.files)
    .sort((a, b) => b.hotspotScore - a.hotspotScore)
    .slice(0, limit);

  return { hotspots };
}

/**
 * Проверяет безопасность редактирования файла
 */
export async function checkFileSafety(input: {
  repoPath?: string;
  file: string;
  agent: string;
}): Promise<{ safe: boolean; warning: string | null; suggestedAction: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const db = await loadConflictDb(repoRoot);
  const stats = db.files[input.file];

  if (!stats || stats.hotspotScore < 20) {
    return { safe: true, warning: null, suggestedAction: "Proceed with edit" };
  }

  if (stats.hotspotScore >= 50) {
    return {
      safe: false,
      warning: `High-risk file: ${stats.conflictCount} past conflicts, ${stats.contributors.length} contributors`,
      suggestedAction: "Coordinate with other agents before editing. Use file_reserve to lock.",
    };
  }

  return {
    safe: true,
    warning: `Medium-risk file: frequently edited by ${stats.contributors.slice(0, 3).join(", ")}`,
    suggestedAction: "Consider notifying team via broadcast_chat before major changes",
  };
}

/**
 * Записывает событие конфликта
 */
export async function recordConflictEvent(input: {
  repoPath?: string;
  file: string;
  agent: string;
  resolved: boolean;
  commitMode: "none" | "local" | "push";
}): Promise<{ recorded: boolean }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const db = await loadConflictDb(repoRoot);

  if (!db.files[input.file]) {
    db.files[input.file] = {
      filePath: input.file,
      conflictCount: 0,
      mergeCount: 0,
      lastConflict: null,
      hotspotScore: 0,
      contributors: [],
      avgChangesPerCommit: 0,
    };
  }

  db.files[input.file].conflictCount++;
  db.files[input.file].lastConflict = new Date().toISOString();
  db.files[input.file].hotspotScore += 10;

  if (!db.files[input.file].contributors.includes(input.agent)) {
    db.files[input.file].contributors.push(input.agent);
  }

  db.totalConflicts++;

  await saveConflictDb(repoRoot, db, input.commitMode);

  return { recorded: true };
}

// ─── Legacy-compatible exports (merged from conflictForecast.ts) ───

export type FileForecast = {
  id: string;
  agent: string;
  files: string[];
  estimatedMinutesFromNow: number;
  confidence: "low" | "medium" | "high";
  createdAt: number;
};

/**
 * @deprecated Use predictConflicts instead
 * Legacy wrapper for backward compatibility with conflictForecast.ts consumers
 */
export async function forecastFileTouches(input: {
  repoPath?: string;
  agent: string;
  taskId?: string;
  files: string[];
  estimatedMinutesFromNow?: number;
  confidence?: "low" | "medium" | "high";
  commitMode: "none" | "local" | "push";
}): Promise<{ forecastId: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const forecastDir = path.join(repoRoot, "swarm", "forecasts");
  await fs.mkdir(forecastDir, { recursive: true });

  const forecastId = `forecast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const forecast: FileForecast = {
    id: forecastId,
    agent: input.agent,
    files: input.files,
    estimatedMinutesFromNow: input.estimatedMinutesFromNow || 30,
    confidence: input.confidence || "medium",
    createdAt: Date.now(),
  };

  await fs.writeFile(
    path.join(forecastDir, `${forecastId}.json`),
    JSON.stringify(forecast, null, 2),
    "utf-8"
  );

  if (input.commitMode !== "none") {
    await gitTry(["add", forecastDir], { cwd: repoRoot });
    await gitTry(["commit", "-m", `swarm: forecast by ${input.agent}`], { cwd: repoRoot });
    if (input.commitMode === "push") {
      await gitTry(["push"], { cwd: repoRoot });
    }
  }

  return { forecastId };
}

/**
 * @deprecated Use predictConflicts instead
 * Legacy wrapper: checks file conflicts based on forecasts
 */
export async function checkFileConflicts(input: {
  repoPath?: string;
  files: string[];
  excludeAgent?: string;
}): Promise<{ conflicts: Array<{ file: string; holders: string[] }> }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const forecastDir = path.join(repoRoot, "swarm", "forecasts");
  const conflicts: Array<{ file: string; holders: string[] }> = [];

  try {
    const entries = await fs.readdir(forecastDir);
    const forecasts: FileForecast[] = [];
    for (const e of entries) {
      if (!e.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(forecastDir, e), "utf-8");
        forecasts.push(JSON.parse(raw));
      } catch { /* skip */ }
    }

    const now = Date.now();
    const activeForecasts = forecasts.filter(f => {
      const expiresAt = f.createdAt + (f.estimatedMinutesFromNow * 60000);
      return expiresAt > now && f.agent !== input.excludeAgent;
    });

    for (const file of input.files) {
      const holders = activeForecasts
        .filter(f => f.files.includes(file))
        .map(f => f.agent);
      if (holders.length > 0) {
        conflicts.push({ file, holders: [...new Set(holders)] });
      }
    }
  } catch { /* dir doesn't exist */ }

  return { conflicts };
}

