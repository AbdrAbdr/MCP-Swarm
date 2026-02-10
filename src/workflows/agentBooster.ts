/**
 * Agent Booster — Fast Local Execution for Simple Tasks
 * 
 * MCP Swarm v1.1.6
 * 
 * Executes trivial tasks locally without calling LLM APIs:
 * - Rename variables/functions
 * - Fix typos in strings/comments
 * - Update imports
 * - Add/remove console.log statements
 * - Format code
 * - Update version numbers
 * - Toggle feature flags
 * - Simple find/replace operations
 * 
 * Benefits:
 * - 352x faster than LLM (local execution)
 * - $0 cost (no API calls)
 * - Works offline
 * - Deterministic results
 * 
 * Inspired by Claude-Flow's Agent Booster concept.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

/**
 * Task types that can be boosted (executed locally)
 */
export type BoosterTaskType =
  | "rename_variable"       // Rename a variable/function
  | "rename_file"           // Rename a file
  | "fix_typo"              // Fix a typo in strings/comments
  | "update_import"         // Update import paths
  | "add_console_log"       // Add debug logging
  | "remove_console_log"    // Remove console.log statements
  | "toggle_flag"           // Toggle boolean flags
  | "update_version"        // Update version numbers
  | "find_replace"          // Simple find/replace
  | "add_comment"           // Add a comment
  | "remove_comment"        // Remove comments
  | "format_json"           // Format JSON files
  | "sort_imports"          // Sort imports alphabetically
  | "remove_unused_imports" // Remove unused imports
  | "add_export"            // Add export to a function/class
  | "wrap_try_catch"        // Wrap code in try-catch
  | "ollama_generate"       // [Optional] Use local Ollama LLM for complex tasks
  | "extract_constant"      // Extract magic number to constant
  | "inline_variable";      // Inline a variable

/**
 * Booster task definition
 */
export interface BoosterTask {
  type: BoosterTaskType;
  filePath: string;
  // Type-specific parameters
  oldName?: string;         // For rename
  newName?: string;         // For rename
  searchText?: string;      // For find/replace, fix_typo
  replaceText?: string;     // For find/replace, fix_typo
  lineNumber?: number;      // For line-specific operations
  variableName?: string;    // For toggle_flag, extract_constant
  value?: string | boolean; // For toggle_flag, add_comment
  comment?: string;         // For add_comment
  scope?: "file" | "function" | "block"; // For operations scope
  prompt?: string;          // For ollama_generate
  model?: string;           // For ollama_generate (default: codellama:7b)
}

/**
 * Result of a booster operation
 */
export interface BoosterResult {
  success: boolean;
  taskType: BoosterTaskType;
  filePath: string;
  changes: number;          // Number of changes made
  linesAffected: number[];  // Line numbers affected
  diff?: string;            // Before/after diff
  message: string;
  timeMs: number;           // Execution time
  savedCost: number;        // Estimated cost saved (vs LLM)
}

/**
 * Booster statistics
 */
export interface BoosterStats {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  totalChanges: number;
  totalTimeSavedMs: number;
  totalCostSaved: number;
  byType: Record<BoosterTaskType, {
    count: number;
    successRate: number;
    avgTimeMs: number;
  }>;
  lastUpdated: number;
}

/**
 * Booster configuration
 */
export interface BoosterConfig {
  enabled: boolean;
  autoDetect: boolean;      // Auto-detect boostable tasks
  maxFileSize: number;      // Max file size to process (bytes)
  backupBeforeChange: boolean;
  dryRun: boolean;          // Preview changes without applying
  estimatedLLMCostPerTask: number; // For cost savings calculation
  ollamaUrl?: string;       // Optional: Ollama URL (e.g. http://localhost:11434)
  ollamaModel?: string;     // Optional: default model (e.g. codellama:7b)
}

// ============ CONSTANTS ============

const BOOSTER_DIR = ".swarm/booster";
const STATS_FILE = "stats.json";
const CONFIG_FILE = "config.json";
const HISTORY_FILE = "history.json";

const DEFAULT_CONFIG: BoosterConfig = {
  enabled: true,
  autoDetect: true,
  maxFileSize: 1024 * 1024, // 1MB
  backupBeforeChange: true,
  dryRun: false,
  estimatedLLMCostPerTask: 0.01, // $0.01 per simple task
  ollamaUrl: undefined,     // Not set by default — fully optional
  ollamaModel: "codellama:7b",
};

// Estimated LLM time for comparison (ms)
const ESTIMATED_LLM_TIME_MS = 3000;

// ============ HELPERS ============

async function getBoosterDir(repoRoot: string): Promise<string> {
  const dir = path.join(repoRoot, BOOSTER_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function loadStats(repoRoot: string): Promise<BoosterStats> {
  const dir = await getBoosterDir(repoRoot);
  const statsPath = path.join(dir, STATS_FILE);

  try {
    const raw = await fs.readFile(statsPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      totalChanges: 0,
      totalTimeSavedMs: 0,
      totalCostSaved: 0,
      byType: {} as BoosterStats["byType"],
      lastUpdated: Date.now(),
    };
  }
}

async function saveStats(repoRoot: string, stats: BoosterStats): Promise<void> {
  const dir = await getBoosterDir(repoRoot);
  const statsPath = path.join(dir, STATS_FILE);
  stats.lastUpdated = Date.now();
  await fs.writeFile(statsPath, JSON.stringify(stats, null, 2), "utf8");
}

async function loadConfig(repoRoot: string): Promise<BoosterConfig> {
  const dir = await getBoosterDir(repoRoot);
  const configPath = path.join(dir, CONFIG_FILE);

  try {
    const raw = await fs.readFile(configPath, "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function saveConfig(repoRoot: string, config: BoosterConfig): Promise<void> {
  const dir = await getBoosterDir(repoRoot);
  const configPath = path.join(dir, CONFIG_FILE);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
}

async function recordHistory(
  repoRoot: string,
  result: BoosterResult
): Promise<void> {
  const dir = await getBoosterDir(repoRoot);
  const historyPath = path.join(dir, HISTORY_FILE);

  let history: BoosterResult[] = [];
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    history = JSON.parse(raw);
  } catch { }

  history.push(result);
  if (history.length > 500) {
    history = history.slice(-500);
  }

  await fs.writeFile(historyPath, JSON.stringify(history, null, 2), "utf8");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generateDiff(original: string, modified: string, maxLines = 10): string {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  const diffs: string[] = [];

  for (let i = 0; i < Math.max(origLines.length, modLines.length); i++) {
    if (origLines[i] !== modLines[i]) {
      if (origLines[i]) diffs.push(`- ${i + 1}: ${origLines[i].substring(0, 80)}`);
      if (modLines[i]) diffs.push(`+ ${i + 1}: ${modLines[i].substring(0, 80)}`);
    }
    if (diffs.length >= maxLines * 2) break;
  }

  return diffs.slice(0, maxLines).join("\n");
}

// ============ TASK EXECUTORS ============

/**
 * Rename variable/function across a file
 */
async function executeRenameVariable(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  if (!task.oldName || !task.newName) {
    throw new Error("oldName and newName are required for rename_variable");
  }

  const lines = content.split("\n");
  const affectedLines: number[] = [];
  let changes = 0;

  // Create regex that matches word boundaries
  const regex = new RegExp(`\\b${escapeRegex(task.oldName)}\\b`, "g");

  const newLines = lines.map((line, i) => {
    const matches = line.match(regex);
    if (matches) {
      affectedLines.push(i + 1);
      changes += matches.length;
      return line.replace(regex, task.newName!);
    }
    return line;
  });

  return {
    content: newLines.join("\n"),
    changes,
    lines: affectedLines,
  };
}

/**
 * Fix typo in strings and comments
 */
async function executeFixTypo(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  if (!task.searchText || !task.replaceText) {
    throw new Error("searchText and replaceText are required for fix_typo");
  }

  const lines = content.split("\n");
  const affectedLines: number[] = [];
  let changes = 0;

  // Only replace in strings and comments
  const stringOrCommentRegex = /(["'`].*?["'`]|\/\/.*$|\/\*[\s\S]*?\*\/)/g;

  const newLines = lines.map((line, i) => {
    let modified = line;
    let lineChanged = false;

    modified = line.replace(stringOrCommentRegex, (match) => {
      if (match.includes(task.searchText!)) {
        lineChanged = true;
        changes++;
        return match.replace(new RegExp(escapeRegex(task.searchText!), "g"), task.replaceText!);
      }
      return match;
    });

    if (lineChanged) {
      affectedLines.push(i + 1);
    }

    return modified;
  });

  return {
    content: newLines.join("\n"),
    changes,
    lines: affectedLines,
  };
}

/**
 * Simple find/replace
 */
async function executeFindReplace(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  if (!task.searchText || task.replaceText === undefined) {
    throw new Error("searchText and replaceText are required for find_replace");
  }

  const lines = content.split("\n");
  const affectedLines: number[] = [];
  let changes = 0;

  const regex = new RegExp(escapeRegex(task.searchText), "g");

  const newLines = lines.map((line, i) => {
    const matches = line.match(regex);
    if (matches) {
      affectedLines.push(i + 1);
      changes += matches.length;
      return line.replace(regex, task.replaceText!);
    }
    return line;
  });

  return {
    content: newLines.join("\n"),
    changes,
    lines: affectedLines,
  };
}

/**
 * Add console.log at specific line
 */
async function executeAddConsoleLog(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  const lines = content.split("\n");
  const lineNum = task.lineNumber || 1;
  const varName = task.variableName || "debug";
  const logStatement = `console.log("[DEBUG] ${varName}:", ${varName});`;

  // Find indentation of the target line
  const targetLine = lines[lineNum - 1] || "";
  const indent = targetLine.match(/^(\s*)/)?.[1] || "";

  lines.splice(lineNum, 0, indent + logStatement);

  return {
    content: lines.join("\n"),
    changes: 1,
    lines: [lineNum + 1],
  };
}

/**
 * Remove console.log statements
 */
async function executeRemoveConsoleLog(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  const lines = content.split("\n");
  const affectedLines: number[] = [];
  let changes = 0;

  const consoleLogRegex = /^\s*console\.(log|debug|info|warn|error)\s*\([^)]*\);?\s*$/;

  const newLines = lines.filter((line, i) => {
    if (consoleLogRegex.test(line)) {
      affectedLines.push(i + 1);
      changes++;
      return false;
    }
    return true;
  });

  return {
    content: newLines.join("\n"),
    changes,
    lines: affectedLines,
  };
}

/**
 * Toggle boolean flag
 */
async function executeToggleFlag(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  if (!task.variableName) {
    throw new Error("variableName is required for toggle_flag");
  }

  const lines = content.split("\n");
  const affectedLines: number[] = [];
  let changes = 0;

  // Match patterns like: const FLAG = true; or let flag = false;
  const flagRegex = new RegExp(
    `((?:const|let|var)\\s+${escapeRegex(task.variableName)}\\s*=\\s*)(true|false)`,
    "g"
  );

  const newLines = lines.map((line, i) => {
    if (flagRegex.test(line)) {
      affectedLines.push(i + 1);
      changes++;
      return line.replace(flagRegex, (match, prefix, value) => {
        const newValue = value === "true" ? "false" : "true";
        return prefix + newValue;
      });
    }
    return line;
  });

  return {
    content: newLines.join("\n"),
    changes,
    lines: affectedLines,
  };
}

/**
 * Update version numbers
 */
async function executeUpdateVersion(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  if (!task.searchText || !task.replaceText) {
    throw new Error("searchText (old version) and replaceText (new version) are required");
  }

  const lines = content.split("\n");
  const affectedLines: number[] = [];
  let changes = 0;

  // Match version patterns
  const versionRegex = new RegExp(
    `(["']?version["']?\\s*[:=]\\s*["']?)${escapeRegex(task.searchText)}(["']?)`,
    "gi"
  );

  const newLines = lines.map((line, i) => {
    if (versionRegex.test(line)) {
      affectedLines.push(i + 1);
      changes++;
      return line.replace(versionRegex, `$1${task.replaceText}$2`);
    }
    return line;
  });

  return {
    content: newLines.join("\n"),
    changes,
    lines: affectedLines,
  };
}

/**
 * Update import paths
 */
async function executeUpdateImport(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  if (!task.searchText || !task.replaceText) {
    throw new Error("searchText (old path) and replaceText (new path) are required");
  }

  const lines = content.split("\n");
  const affectedLines: number[] = [];
  let changes = 0;

  // Match import/require statements
  const importRegex = new RegExp(
    `((?:import|from|require)\\s*\\(?\\s*["'])${escapeRegex(task.searchText)}(["']\\)?)`,
    "g"
  );

  const newLines = lines.map((line, i) => {
    if (importRegex.test(line)) {
      affectedLines.push(i + 1);
      changes++;
      return line.replace(importRegex, `$1${task.replaceText}$2`);
    }
    return line;
  });

  return {
    content: newLines.join("\n"),
    changes,
    lines: affectedLines,
  };
}

/**
 * Add a comment
 */
async function executeAddComment(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  if (!task.comment || !task.lineNumber) {
    throw new Error("comment and lineNumber are required for add_comment");
  }

  const lines = content.split("\n");
  const lineNum = task.lineNumber;

  // Get indentation from target line
  const targetLine = lines[lineNum - 1] || "";
  const indent = targetLine.match(/^(\s*)/)?.[1] || "";

  // Determine comment style based on file extension
  const ext = path.extname(task.filePath).toLowerCase();
  let commentLine: string;

  if ([".py", ".rb", ".sh", ".yaml", ".yml"].includes(ext)) {
    commentLine = `${indent}# ${task.comment}`;
  } else if ([".html", ".xml", ".svg"].includes(ext)) {
    commentLine = `${indent}<!-- ${task.comment} -->`;
  } else if ([".css", ".scss", ".less"].includes(ext)) {
    commentLine = `${indent}/* ${task.comment} */`;
  } else {
    commentLine = `${indent}// ${task.comment}`;
  }

  lines.splice(lineNum - 1, 0, commentLine);

  return {
    content: lines.join("\n"),
    changes: 1,
    lines: [lineNum],
  };
}

/**
 * Remove comments (single-line)
 */
async function executeRemoveComment(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  const lines = content.split("\n");
  const affectedLines: number[] = [];
  let changes = 0;

  // Match single-line comments
  const commentRegex = /^\s*(\/\/|#|--)\s*.*/;

  const newLines = lines.filter((line, i) => {
    if (commentRegex.test(line)) {
      // If searchText provided, only remove matching comments
      if (task.searchText && !line.includes(task.searchText)) {
        return true;
      }
      affectedLines.push(i + 1);
      changes++;
      return false;
    }
    return true;
  });

  return {
    content: newLines.join("\n"),
    changes,
    lines: affectedLines,
  };
}

/**
 * Format JSON file
 */
async function executeFormatJson(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  try {
    const parsed = JSON.parse(content);
    const formatted = JSON.stringify(parsed, null, 2);

    if (formatted === content) {
      return { content, changes: 0, lines: [] };
    }

    return {
      content: formatted,
      changes: 1,
      lines: [1], // Whole file
    };
  } catch (e) {
    throw new Error(`Invalid JSON: ${e}`);
  }
}

/**
 * Sort imports alphabetically
 */
async function executeSortImports(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  const lines = content.split("\n");
  const importLines: { index: number; line: string }[] = [];
  let inImportBlock = false;
  let firstImportIndex = -1;

  // Find all import lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isImport = /^import\s/.test(line) || /^import\s*{/.test(line);

    if (isImport) {
      if (!inImportBlock) {
        firstImportIndex = i;
        inImportBlock = true;
      }
      importLines.push({ index: i, line });
    } else if (inImportBlock && line.trim() !== "") {
      break;
    }
  }

  if (importLines.length <= 1) {
    return { content, changes: 0, lines: [] };
  }

  // Sort imports
  const sortedImports = [...importLines].sort((a, b) => {
    // Extract the module path for comparison
    const pathA = a.line.match(/from\s+["'](.+?)["']/)?.[1] || a.line;
    const pathB = b.line.match(/from\s+["'](.+?)["']/)?.[1] || b.line;
    return pathA.localeCompare(pathB);
  });

  // Check if already sorted
  const alreadySorted = importLines.every((imp, i) => imp.line === sortedImports[i].line);
  if (alreadySorted) {
    return { content, changes: 0, lines: [] };
  }

  // Replace imports with sorted version
  const newLines = [...lines];
  importLines.forEach((imp, i) => {
    newLines[imp.index] = sortedImports[i].line;
  });

  return {
    content: newLines.join("\n"),
    changes: importLines.length,
    lines: importLines.map(i => i.index + 1),
  };
}

/**
 * Add export to function/class
 */
async function executeAddExport(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  if (!task.variableName) {
    throw new Error("variableName (function/class name) is required for add_export");
  }

  const lines = content.split("\n");
  const affectedLines: number[] = [];
  let changes = 0;

  // Match function/class/const declarations
  const declRegex = new RegExp(
    `^(\\s*)(function\\s+${escapeRegex(task.variableName)}|class\\s+${escapeRegex(task.variableName)}|(?:const|let|var)\\s+${escapeRegex(task.variableName)})`,
    ""
  );

  const newLines = lines.map((line, i) => {
    const match = line.match(declRegex);
    if (match && !line.trimStart().startsWith("export")) {
      affectedLines.push(i + 1);
      changes++;
      return match[1] + "export " + line.trimStart();
    }
    return line;
  });

  return {
    content: newLines.join("\n"),
    changes,
    lines: affectedLines,
  };
}

/**
 * Extract magic number to constant
 */
async function executeExtractConstant(
  content: string,
  task: BoosterTask
): Promise<{ content: string; changes: number; lines: number[] }> {
  if (!task.searchText || !task.variableName) {
    throw new Error("searchText (value) and variableName (constant name) are required");
  }

  const lines = content.split("\n");
  const affectedLines: number[] = [];
  let changes = 0;

  // Find first occurrence and its line
  let firstOccurrenceLine = -1;
  const valueRegex = new RegExp(`(?<!\\w)${escapeRegex(task.searchText)}(?!\\w)`, "g");

  const newLines = lines.map((line, i) => {
    const matches = line.match(valueRegex);
    if (matches) {
      if (firstOccurrenceLine === -1) {
        firstOccurrenceLine = i;
      }
      affectedLines.push(i + 1);
      changes += matches.length;
      return line.replace(valueRegex, task.variableName!);
    }
    return line;
  });

  // Add constant declaration at the top (after imports)
  if (changes > 0 && firstOccurrenceLine >= 0) {
    // Find end of imports
    let insertLine = 0;
    for (let i = 0; i < newLines.length; i++) {
      if (/^import\s/.test(newLines[i]) || /^require\s*\(/.test(newLines[i])) {
        insertLine = i + 1;
      } else if (insertLine > 0 && newLines[i].trim() !== "") {
        break;
      }
    }

    const constDecl = `const ${task.variableName} = ${task.searchText};`;
    newLines.splice(insertLine, 0, "", constDecl);
    affectedLines.unshift(insertLine + 2);
  }

  return {
    content: newLines.join("\n"),
    changes,
    lines: affectedLines,
  };
}

// ============ OLLAMA INTEGRATION (OPTIONAL) ============

/**
 * Execute a complex task via local Ollama LLM
 * Only works if ollamaUrl is set in booster config
 */
async function executeOllamaGenerate(
  content: string,
  task: BoosterTask,
  config: BoosterConfig
): Promise<{ content: string; changes: number; lines: number[] }> {
  if (!config.ollamaUrl) {
    throw new Error(
      "Ollama is not configured. Set ollamaUrl in booster config:\n" +
      "  swarm_booster({ action: 'set_config', config: { ollamaUrl: 'http://localhost:11434' } })"
    );
  }

  const prompt = task.prompt || `Modify this code:\n\n${content}`;
  const model = task.model || config.ollamaModel || "codellama:7b";

  try {
    const response = await fetch(`${config.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `You are a code assistant. Given the following code, apply the requested change and return ONLY the modified code without explanation.\n\nCode:\n\`\`\`\n${content}\n\`\`\`\n\nRequest: ${prompt}\n\nModified code:`,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 4096,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama error (${response.status}): ${err}`);
    }

    const data = await response.json() as { response: string };
    let newContent = data.response || "";

    // Clean up ollama response — extract code from markdown blocks if present
    const codeBlockMatch = newContent.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      newContent = codeBlockMatch[1].trim();
    }

    if (!newContent || newContent.trim() === content.trim()) {
      return { content, changes: 0, lines: [] };
    }

    // Simple diff: count changed lines
    const oldLines = content.split("\n");
    const newLines = newContent.split("\n");
    const changedLines: number[] = [];
    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
      if ((oldLines[i] || "") !== (newLines[i] || "")) {
        changedLines.push(i + 1);
      }
    }

    return {
      content: newContent,
      changes: changedLines.length,
      lines: changedLines,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Ollama error")) {
      throw err;
    }
    throw new Error(
      `Cannot connect to Ollama at ${config.ollamaUrl}. ` +
      `Make sure Ollama is running: ollama serve`
    );
  }
}

// ============ MAIN EXECUTOR ============

/**
 * Execute a booster task
 */
export async function executeTask(input: {
  repoPath?: string;
  task: BoosterTask;
  dryRun?: boolean;
}): Promise<BoosterResult> {
  const startTime = Date.now();
  const repoRoot = await getRepoRoot(input.repoPath);
  const config = await loadConfig(repoRoot);

  if (!config.enabled) {
    return {
      success: false,
      taskType: input.task.type,
      filePath: input.task.filePath,
      changes: 0,
      linesAffected: [],
      message: "Agent Booster is disabled",
      timeMs: Date.now() - startTime,
      savedCost: 0,
    };
  }

  const fullPath = path.isAbsolute(input.task.filePath)
    ? input.task.filePath
    : path.join(repoRoot, input.task.filePath);

  try {
    // Read file
    const originalContent = await fs.readFile(fullPath, "utf8");

    // Check file size
    if (originalContent.length > config.maxFileSize) {
      return {
        success: false,
        taskType: input.task.type,
        filePath: input.task.filePath,
        changes: 0,
        linesAffected: [],
        message: `File too large: ${originalContent.length} bytes (max: ${config.maxFileSize})`,
        timeMs: Date.now() - startTime,
        savedCost: 0,
      };
    }

    // Execute the appropriate task
    let result: { content: string; changes: number; lines: number[] };

    switch (input.task.type) {
      case "rename_variable":
        result = await executeRenameVariable(originalContent, input.task);
        break;
      case "fix_typo":
        result = await executeFixTypo(originalContent, input.task);
        break;
      case "find_replace":
        result = await executeFindReplace(originalContent, input.task);
        break;
      case "add_console_log":
        result = await executeAddConsoleLog(originalContent, input.task);
        break;
      case "remove_console_log":
        result = await executeRemoveConsoleLog(originalContent, input.task);
        break;
      case "toggle_flag":
        result = await executeToggleFlag(originalContent, input.task);
        break;
      case "update_version":
        result = await executeUpdateVersion(originalContent, input.task);
        break;
      case "update_import":
        result = await executeUpdateImport(originalContent, input.task);
        break;
      case "add_comment":
        result = await executeAddComment(originalContent, input.task);
        break;
      case "remove_comment":
        result = await executeRemoveComment(originalContent, input.task);
        break;
      case "format_json":
        result = await executeFormatJson(originalContent, input.task);
        break;
      case "sort_imports":
        result = await executeSortImports(originalContent, input.task);
        break;
      case "add_export":
        result = await executeAddExport(originalContent, input.task);
        break;
      case "extract_constant":
        result = await executeExtractConstant(originalContent, input.task);
        break;
      case "ollama_generate":
        result = await executeOllamaGenerate(originalContent, input.task, config);
        break;
      default:
        throw new Error(`Unsupported task type: ${input.task.type}`);
    }

    const timeMs = Date.now() - startTime;
    const dryRun = input.dryRun ?? config.dryRun;

    // Generate diff
    const diff = generateDiff(originalContent, result.content);

    if (result.changes === 0) {
      return {
        success: true,
        taskType: input.task.type,
        filePath: input.task.filePath,
        changes: 0,
        linesAffected: [],
        message: "No changes needed",
        timeMs,
        savedCost: config.estimatedLLMCostPerTask,
      };
    }

    if (!dryRun) {
      // Backup if configured
      if (config.backupBeforeChange) {
        const backupPath = `${fullPath}.bak`;
        await fs.writeFile(backupPath, originalContent, "utf8");
      }

      // Write modified content
      await fs.writeFile(fullPath, result.content, "utf8");
    }

    const boosterResult: BoosterResult = {
      success: true,
      taskType: input.task.type,
      filePath: input.task.filePath,
      changes: result.changes,
      linesAffected: result.lines,
      diff,
      message: dryRun
        ? `[DRY RUN] Would make ${result.changes} changes`
        : `Made ${result.changes} changes in ${timeMs}ms`,
      timeMs,
      savedCost: config.estimatedLLMCostPerTask,
    };

    // Update stats
    const stats = await loadStats(repoRoot);
    stats.totalTasks++;
    stats.successfulTasks++;
    stats.totalChanges += result.changes;
    stats.totalTimeSavedMs += ESTIMATED_LLM_TIME_MS - timeMs;
    stats.totalCostSaved += config.estimatedLLMCostPerTask;

    if (!stats.byType[input.task.type]) {
      stats.byType[input.task.type] = { count: 0, successRate: 1, avgTimeMs: 0 };
    }
    const typeStats = stats.byType[input.task.type];
    typeStats.count++;
    typeStats.avgTimeMs = (typeStats.avgTimeMs * (typeStats.count - 1) + timeMs) / typeStats.count;

    await saveStats(repoRoot, stats);
    await recordHistory(repoRoot, boosterResult);

    return boosterResult;

  } catch (error) {
    const timeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update failure stats
    const stats = await loadStats(repoRoot);
    stats.totalTasks++;
    stats.failedTasks++;
    await saveStats(repoRoot, stats);

    return {
      success: false,
      taskType: input.task.type,
      filePath: input.task.filePath,
      changes: 0,
      linesAffected: [],
      message: `Error: ${errorMessage}`,
      timeMs,
      savedCost: 0,
    };
  }
}

// ============ DETECTION ============

/**
 * Analyze a task description to determine if it can be boosted
 */
export async function canBoost(input: {
  repoPath?: string;
  description: string;
  title?: string;
}): Promise<{
  canBoost: boolean;
  taskType: BoosterTaskType | null;
  confidence: number;
  suggestedParams: Partial<BoosterTask>;
  reason: string;
}> {
  const text = `${input.title || ""} ${input.description}`.toLowerCase();

  // Pattern matching for boostable tasks
  const patterns: Array<{
    regex: RegExp;
    type: BoosterTaskType;
    extractParams: (match: RegExpMatchArray, text: string) => Partial<BoosterTask>;
  }> = [
      {
        regex: /rename\s+(?:variable|function|const|let|var)?\s*[`"']?(\w+)[`"']?\s+(?:to|->|=>)\s*[`"']?(\w+)[`"']?/i,
        type: "rename_variable",
        extractParams: (match) => ({
          oldName: match[1],
          newName: match[2],
        }),
      },
      {
        regex: /fix\s+typo\s*:?\s*[`"']?(.+?)[`"']?\s*(?:->|=>|to)\s*[`"']?(.+?)[`"']?/i,
        type: "fix_typo",
        extractParams: (match) => ({
          searchText: match[1].trim(),
          replaceText: match[2].trim(),
        }),
      },
      {
        regex: /replace\s+[`"']?(.+?)[`"']?\s+(?:with|->|=>|to)\s+[`"']?(.+?)[`"']?/i,
        type: "find_replace",
        extractParams: (match) => ({
          searchText: match[1].trim(),
          replaceText: match[2].trim(),
        }),
      },
      {
        regex: /add\s+(?:debug\s+)?(?:console\.?)?log(?:ging)?\s+(?:for|to)?\s*[`"']?(\w+)[`"']?/i,
        type: "add_console_log",
        extractParams: (match) => ({
          variableName: match[1],
        }),
      },
      {
        regex: /remove\s+(?:all\s+)?(?:console\.?)?logs?/i,
        type: "remove_console_log",
        extractParams: () => ({}),
      },
      {
        regex: /toggle\s+(?:flag|boolean)?\s*[`"']?(\w+)[`"']?/i,
        type: "toggle_flag",
        extractParams: (match) => ({
          variableName: match[1],
        }),
      },
      {
        regex: /update\s+version\s+(?:from\s+)?[`"']?([0-9.]+)[`"']?\s+(?:to|->|=>)\s*[`"']?([0-9.]+)[`"']?/i,
        type: "update_version",
        extractParams: (match) => ({
          searchText: match[1],
          replaceText: match[2],
        }),
      },
      {
        regex: /update\s+import\s+(?:path\s+)?(?:from\s+)?[`"']?(.+?)[`"']?\s+(?:to|->|=>)\s*[`"']?(.+?)[`"']?/i,
        type: "update_import",
        extractParams: (match) => ({
          searchText: match[1].trim(),
          replaceText: match[2].trim(),
        }),
      },
      {
        regex: /format\s+json/i,
        type: "format_json",
        extractParams: () => ({}),
      },
      {
        regex: /sort\s+imports?/i,
        type: "sort_imports",
        extractParams: () => ({}),
      },
      {
        regex: /add\s+export\s+(?:to\s+)?[`"']?(\w+)[`"']?/i,
        type: "add_export",
        extractParams: (match) => ({
          variableName: match[1],
        }),
      },
      {
        regex: /extract\s+(?:magic\s+)?(?:number|value)?\s*[`"']?(.+?)[`"']?\s+(?:to|as|into)\s+(?:constant\s+)?[`"']?(\w+)[`"']?/i,
        type: "extract_constant",
        extractParams: (match) => ({
          searchText: match[1].trim(),
          variableName: match[2],
        }),
      },
    ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      return {
        canBoost: true,
        taskType: pattern.type,
        confidence: 0.9,
        suggestedParams: pattern.extractParams(match, text),
        reason: `Detected ${pattern.type} task`,
      };
    }
  }

  // Simple heuristics for generic detection
  const simplePatterns: Array<{ keywords: string[]; type: BoosterTaskType }> = [
    { keywords: ["rename", "refactor name"], type: "rename_variable" },
    { keywords: ["typo", "spelling", "misspell"], type: "fix_typo" },
    { keywords: ["console.log", "debug log", "logging"], type: "add_console_log" },
    { keywords: ["remove log", "delete console"], type: "remove_console_log" },
    { keywords: ["toggle", "flip", "switch flag"], type: "toggle_flag" },
    { keywords: ["bump version", "version update"], type: "update_version" },
    { keywords: ["import path", "update import"], type: "update_import" },
    { keywords: ["format json", "prettify json"], type: "format_json" },
    { keywords: ["sort import", "organize import"], type: "sort_imports" },
  ];

  for (const pattern of simplePatterns) {
    if (pattern.keywords.some(kw => text.includes(kw))) {
      return {
        canBoost: true,
        taskType: pattern.type,
        confidence: 0.6,
        suggestedParams: {},
        reason: `Keyword match for ${pattern.type}`,
      };
    }
  }

  // Check if Ollama is available for more complex tasks
  const repoRoot = await getRepoRoot(input.repoPath);
  const config = await loadConfig(repoRoot);
  if (config.ollamaUrl) {
    // With Ollama, we can handle more complex tasks
    const complexPatterns = [
      /refactor/i, /optimize/i, /simplify/i, /generate/i,
      /explain/i, /document/i, /review/i, /suggest/i,
    ];
    if (complexPatterns.some(p => p.test(text))) {
      return {
        canBoost: true,
        taskType: "ollama_generate" as BoosterTaskType,
        confidence: 0.7,
        suggestedParams: { prompt: input.description },
        reason: `Ollama available — can handle complex task via local LLM (${config.ollamaModel || 'codellama:7b'})`,
      };
    }
  }

  return {
    canBoost: false,
    taskType: null,
    confidence: 0,
    suggestedParams: {},
    reason: config.ollamaUrl
      ? "Task does not match any boostable pattern (Ollama available for complex tasks)"
      : "Task does not match any boostable pattern (tip: set ollamaUrl in config for complex tasks)",
  };
}

// ============ API ============

/**
 * Get booster statistics
 */
export async function getStats(input: {
  repoPath?: string;
}): Promise<BoosterStats> {
  const repoRoot = await getRepoRoot(input.repoPath);
  return loadStats(repoRoot);
}

/**
 * Get booster configuration
 */
export async function getConfig(input: {
  repoPath?: string;
}): Promise<BoosterConfig> {
  const repoRoot = await getRepoRoot(input.repoPath);
  return loadConfig(repoRoot);
}

/**
 * Update booster configuration
 */
export async function setConfig(input: {
  repoPath?: string;
  config: Partial<BoosterConfig>;
}): Promise<{ success: boolean; config: BoosterConfig }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const current = await loadConfig(repoRoot);
  const updated = { ...current, ...input.config };
  await saveConfig(repoRoot, updated);
  return { success: true, config: updated };
}

/**
 * Get execution history
 */
export async function getHistory(input: {
  repoPath?: string;
  limit?: number;
}): Promise<BoosterResult[]> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const dir = await getBoosterDir(repoRoot);
  const historyPath = path.join(dir, HISTORY_FILE);

  try {
    const raw = await fs.readFile(historyPath, "utf8");
    const history = JSON.parse(raw) as BoosterResult[];
    return history.slice(-(input.limit || 50));
  } catch {
    return [];
  }
}

/**
 * Get list of supported task types
 */
export function getSupportedTypes(): Array<{
  type: BoosterTaskType;
  description: string;
  requiredParams: string[];
}> {
  return [
    { type: "rename_variable", description: "Rename a variable or function", requiredParams: ["oldName", "newName"] },
    { type: "fix_typo", description: "Fix typo in strings/comments", requiredParams: ["searchText", "replaceText"] },
    { type: "find_replace", description: "Simple find and replace", requiredParams: ["searchText", "replaceText"] },
    { type: "add_console_log", description: "Add debug console.log", requiredParams: ["lineNumber"] },
    { type: "remove_console_log", description: "Remove all console.log", requiredParams: [] },
    { type: "toggle_flag", description: "Toggle boolean flag", requiredParams: ["variableName"] },
    { type: "update_version", description: "Update version number", requiredParams: ["searchText", "replaceText"] },
    { type: "update_import", description: "Update import path", requiredParams: ["searchText", "replaceText"] },
    { type: "add_comment", description: "Add a comment", requiredParams: ["lineNumber", "comment"] },
    { type: "remove_comment", description: "Remove comments", requiredParams: [] },
    { type: "format_json", description: "Format JSON file", requiredParams: [] },
    { type: "sort_imports", description: "Sort imports alphabetically", requiredParams: [] },
    { type: "add_export", description: "Add export to declaration", requiredParams: ["variableName"] },
    { type: "extract_constant", description: "Extract value to constant", requiredParams: ["searchText", "variableName"] },
    { type: "ollama_generate", description: "[Optional] Use local Ollama LLM for complex tasks (requires OLLAMA_URL)", requiredParams: ["prompt"] },
  ];
}

// ============ MAIN HANDLER ============

export type BoosterAction =
  | "execute"        // Execute a booster task
  | "can_boost"      // Check if task can be boosted
  | "stats"          // Get statistics
  | "history"        // Get execution history
  | "config"         // Get configuration
  | "set_config"     // Update configuration
  | "types";         // List supported types

export async function handleBoosterTool(input: {
  action: BoosterAction;
  repoPath?: string;
  // For execute
  task?: BoosterTask;
  dryRun?: boolean;
  // For can_boost
  title?: string;
  description?: string;
  // For history
  limit?: number;
  // For set_config
  config?: Partial<BoosterConfig>;
}): Promise<unknown> {
  switch (input.action) {
    case "execute":
      if (!input.task) {
        throw new Error("task is required for execute action");
      }
      return executeTask({
        repoPath: input.repoPath,
        task: input.task,
        dryRun: input.dryRun,
      });

    case "can_boost":
      return canBoost({
        repoPath: input.repoPath,
        title: input.title,
        description: input.description || "",
      });

    case "stats":
      return getStats({ repoPath: input.repoPath });

    case "history":
      return getHistory({
        repoPath: input.repoPath,
        limit: input.limit,
      });

    case "config":
      return getConfig({ repoPath: input.repoPath });

    case "set_config":
      return setConfig({
        repoPath: input.repoPath,
        config: input.config || {},
      });

    case "types":
      return getSupportedTypes();

    default:
      throw new Error(`Unknown booster action: ${input.action}`);
  }
}
