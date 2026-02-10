import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import { getRepoRoot } from "./repo.js";
import { getErrorMessage } from "../utils/errorUtils.js";

const execAsync = promisify(exec);

interface QualityThreshold {
  maxLintErrors: number;
  maxLintWarnings: number;
  minTestCoverage: number;
  requireAllTestsPass: boolean;
  requireTypeCheck: boolean;
}

interface QualityReport {
  timestamp: number;
  branch: string;
  lintErrors: number;
  lintWarnings: number;
  testsTotal: number;
  testsPassed: number;
  testsFailed: number;
  testsSkipped: number;
  typeCheckPassed: boolean;
  typeCheckErrors: number;
  overallPassed: boolean;
  details: string;
}

const DEFAULT_THRESHOLD: QualityThreshold = {
  maxLintErrors: 0,
  maxLintWarnings: 10,
  minTestCoverage: 0,
  requireAllTestsPass: true,
  requireTypeCheck: true,
};

async function ensureQualityDir(repoRoot: string): Promise<string> {
  const dir = path.join(repoRoot, "swarm", "quality");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function getCurrentBranch(repoRoot: string): Promise<string> {
  try {
    const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd: repoRoot });
    return stdout.trim();
  } catch {
    return "unknown";
  }
}

async function loadThreshold(repoRoot: string): Promise<QualityThreshold> {
  const dir = await ensureQualityDir(repoRoot);
  const thresholdPath = path.join(dir, "threshold.json");
  try {
    const raw = await fs.readFile(thresholdPath, "utf8");
    return { ...DEFAULT_THRESHOLD, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_THRESHOLD;
  }
}

/**
 * Запускает quality gate: lint + tests + type-check
 */
export async function runQualityGate(input: {
  repoPath?: string;
  runLint?: boolean;
  runTests?: boolean;
  runTypeCheck?: boolean;
  commitMode?: "none" | "local" | "push";
}): Promise<QualityReport> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const dir = await ensureQualityDir(repoRoot);
  const branch = await getCurrentBranch(repoRoot);
  const threshold = await loadThreshold(repoRoot);

  const runLint = input.runLint !== false;
  const runTests = input.runTests !== false;
  const runTypeCheck = input.runTypeCheck !== false;

  let lintErrors = 0;
  let lintWarnings = 0;
  let testsTotal = 0;
  let testsPassed = 0;
  let testsFailed = 0;
  let testsSkipped = 0;
  let typeCheckPassed = true;
  let typeCheckErrors = 0;
  const details: string[] = [];

  // Lint check (ESLint)
  if (runLint) {
    try {
      const { stdout, stderr } = await execAsync("npm run lint 2>&1 || true", {
        cwd: repoRoot,
        timeout: 120000,
      });
      const output = stdout + stderr;

      // Парсим количество ошибок из вывода ESLint
      const errorMatch = output.match(/(\d+)\s+error/);
      const warningMatch = output.match(/(\d+)\s+warning/);

      lintErrors = errorMatch ? parseInt(errorMatch[1], 10) : 0;
      lintWarnings = warningMatch ? parseInt(warningMatch[1], 10) : 0;

      details.push(`Lint: ${lintErrors} errors, ${lintWarnings} warnings`);
    } catch (err: unknown) {
      details.push(`Lint failed: ${getErrorMessage(err)}`);
      lintErrors = 999;
    }
  }

  // Type check (tsc)
  if (runTypeCheck) {
    try {
      const { stdout, stderr } = await execAsync("npx tsc --noEmit 2>&1 || true", {
        cwd: repoRoot,
        timeout: 120000,
      });
      const output = stdout + stderr;

      // Считаем строки с ошибками
      const errorLines = output.split("\n").filter((l) => l.includes("error TS"));
      typeCheckErrors = errorLines.length;
      typeCheckPassed = typeCheckErrors === 0;

      details.push(`TypeCheck: ${typeCheckPassed ? "PASSED" : `FAILED (${typeCheckErrors} errors)`}`);
    } catch (err: unknown) {
      details.push(`TypeCheck failed: ${getErrorMessage(err)}`);
      typeCheckPassed = false;
      typeCheckErrors = 999;
    }
  }

  // Tests (npm test)
  if (runTests) {
    try {
      const { stdout, stderr } = await execAsync("npm test 2>&1 || true", {
        cwd: repoRoot,
        timeout: 300000,
      });
      const output = stdout + stderr;

      // Парсим результаты Jest/Vitest
      const passedMatch = output.match(/(\d+)\s+passed/);
      const failedMatch = output.match(/(\d+)\s+failed/);
      const skippedMatch = output.match(/(\d+)\s+skipped/);

      testsPassed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
      testsFailed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
      testsSkipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
      testsTotal = testsPassed + testsFailed + testsSkipped;

      details.push(`Tests: ${testsPassed}/${testsTotal} passed, ${testsFailed} failed`);
    } catch (err: unknown) {
      details.push(`Tests failed: ${getErrorMessage(err)}`);
      testsFailed = 999;
    }
  }

  // Проверяем, прошел ли quality gate
  const overallPassed =
    lintErrors <= threshold.maxLintErrors &&
    lintWarnings <= threshold.maxLintWarnings &&
    (!threshold.requireAllTestsPass || testsFailed === 0) &&
    (!threshold.requireTypeCheck || typeCheckPassed);

  const report: QualityReport = {
    timestamp: Date.now(),
    branch,
    lintErrors,
    lintWarnings,
    testsTotal,
    testsPassed,
    testsFailed,
    testsSkipped,
    typeCheckPassed,
    typeCheckErrors,
    overallPassed,
    details: details.join("; "),
  };

  // Сохраняем отчет
  const reportPath = path.join(dir, "reports", `${branch.replace(/\//g, "-")}.json`);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  return report;
}

/**
 * Получает последний отчет качества для ветки
 */
export async function getQualityReport(input: {
  repoPath?: string;
  branch?: string;
}): Promise<{
  found: boolean;
  report: QualityReport | null;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const dir = path.join(repoRoot, "swarm", "quality", "reports");
  const branch = input.branch || (await getCurrentBranch(repoRoot));
  const reportPath = path.join(dir, `${branch.replace(/\//g, "-")}.json`);

  try {
    const raw = await fs.readFile(reportPath, "utf8");
    return { found: true, report: JSON.parse(raw) };
  } catch {
    return { found: false, report: null };
  }
}

/**
 * Устанавливает пороговые значения качества
 */
export async function setQualityThreshold(input: {
  repoPath?: string;
  maxLintErrors?: number;
  maxLintWarnings?: number;
  minTestCoverage?: number;
  requireAllTestsPass?: boolean;
  requireTypeCheck?: boolean;
  commitMode?: "none" | "local" | "push";
}): Promise<{
  updated: boolean;
  threshold: QualityThreshold;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const dir = await ensureQualityDir(repoRoot);
  const thresholdPath = path.join(dir, "threshold.json");

  const current = await loadThreshold(repoRoot);
  const updated: QualityThreshold = {
    maxLintErrors: input.maxLintErrors ?? current.maxLintErrors,
    maxLintWarnings: input.maxLintWarnings ?? current.maxLintWarnings,
    minTestCoverage: input.minTestCoverage ?? current.minTestCoverage,
    requireAllTestsPass: input.requireAllTestsPass ?? current.requireAllTestsPass,
    requireTypeCheck: input.requireTypeCheck ?? current.requireTypeCheck,
  };

  await fs.writeFile(thresholdPath, JSON.stringify(updated, null, 2), "utf8");

  return { updated: true, threshold: updated };
}

/**
 * Проверяет, готова ли ветка для создания PR
 */
export async function checkPrReady(input: {
  repoPath?: string;
  branch?: string;
  runFreshCheck?: boolean;
}): Promise<{
  ready: boolean;
  issues: string[];
  report: QualityReport | null;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const branch = input.branch || (await getCurrentBranch(repoRoot));

  let report: QualityReport | null = null;

  if (input.runFreshCheck) {
    report = await runQualityGate({ repoPath: input.repoPath });
  } else {
    const existing = await getQualityReport({ repoPath: input.repoPath, branch });
    report = existing.report;
  }

  const issues: string[] = [];

  if (!report) {
    issues.push("No quality report found. Run run_quality_gate first.");
    return { ready: false, issues, report: null };
  }

  const threshold = await loadThreshold(repoRoot);

  if (report.lintErrors > threshold.maxLintErrors) {
    issues.push(`Lint errors: ${report.lintErrors} (max: ${threshold.maxLintErrors})`);
  }

  if (report.lintWarnings > threshold.maxLintWarnings) {
    issues.push(`Lint warnings: ${report.lintWarnings} (max: ${threshold.maxLintWarnings})`);
  }

  if (threshold.requireAllTestsPass && report.testsFailed > 0) {
    issues.push(`Failed tests: ${report.testsFailed}`);
  }

  if (threshold.requireTypeCheck && !report.typeCheckPassed) {
    issues.push(`TypeCheck failed: ${report.typeCheckErrors} errors`);
  }

  return {
    ready: issues.length === 0,
    issues,
    report,
  };
}
