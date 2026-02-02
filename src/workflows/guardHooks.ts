import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { git } from "./git.js";
import { getRepoRoot } from "./repo.js";

/**
 * Guard Hooks: Pre-commit and Pre-push safety hooks
 * 
 * Install git hooks that run checks before allowing commits/pushes:
 * - pre-commit: lint, format, type check
 * - pre-push: tests, security scan
 */

export type HookType = "pre-commit" | "pre-push" | "commit-msg";

export type HookCheck = {
  name: string;
  command: string;
  args: string[];
  failOnError: boolean;
  [key: string]: unknown;
};

export type HookConfig = {
  type: HookType;
  enabled: boolean;
  checks: HookCheck[];
  bypassKeyword?: string;
  [key: string]: unknown;
};

export type GuardConfig = {
  version: string;
  hooks: HookConfig[];
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
};

async function runCommand(cmd: string, args: string[], cwd: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "cmd" : "/bin/sh";
    const shellArgs = isWindows ? ["/c", cmd, ...args] : ["-c", `${cmd} ${args.join(" ")}`];
    
    const proc = spawn(shell, shellArgs, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    
    proc.stdout?.on("data", (data) => { output += data.toString(); });
    proc.stderr?.on("data", (data) => { output += data.toString(); });
    
    proc.on("close", (code) => {
      resolve({ code: code ?? 1, output });
    });
    
    proc.on("error", () => {
      resolve({ code: 1, output: "Failed to run command" });
    });
  });
}

async function loadGuardConfig(repoRoot: string): Promise<GuardConfig | null> {
  const configPath = path.join(repoRoot, ".swarm-guard.json");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveGuardConfig(repoRoot: string, config: GuardConfig): Promise<void> {
  const configPath = path.join(repoRoot, ".swarm-guard.json");
  config.updatedAt = Date.now();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

function generateHookScript(hook: HookConfig, bypassKeyword: string): string {
  const checks = hook.checks.map(c => {
    const cmd = `${c.command} ${c.args.join(" ")}`.trim();
    return c.failOnError
      ? `echo "Running ${c.name}..." && ${cmd}`
      : `echo "Running ${c.name}..." && (${cmd} || true)`;
  }).join(" && ");
  
  return `#!/bin/sh
# MCP Swarm Guard Hook: ${hook.type}
# Generated automatically - do not edit manually

# Bypass check
if git log -1 --pretty=%B | grep -q "${bypassKeyword}"; then
  echo "Bypass keyword found, skipping ${hook.type} hooks"
  exit 0
fi

# Run checks
${checks}

exit_code=$?
if [ $exit_code -ne 0 ]; then
  echo ""
  echo "❌ ${hook.type} hook failed!"
  echo "Fix the issues above or use '${bypassKeyword}' in commit message to bypass"
  exit 1
fi

echo "✅ ${hook.type} hook passed!"
exit 0
`;
}

// ==================== TOOL FUNCTIONS ====================

/**
 * Install guard hooks in the repository
 */
export async function installGuardHooks(input: {
  repoPath?: string;
  preCommitChecks?: Array<{ name: string; command: string; args?: string[]; failOnError?: boolean }>;
  prePushChecks?: Array<{ name: string; command: string; args?: string[]; failOnError?: boolean }>;
  bypassKeyword?: string;
  commitMode: "none" | "local" | "push";
}): Promise<{ success: boolean; installedHooks: HookType[]; message: string }> {
  const repoRoot = input.repoPath || process.cwd();
  
  // Check if .git exists
  const gitDir = path.join(repoRoot, ".git");
  try {
    await fs.access(gitDir);
  } catch {
    return { success: false, installedHooks: [], message: "Not a git repository" };
  }
  
  const hooksDir = path.join(gitDir, "hooks");
  await fs.mkdir(hooksDir, { recursive: true });
  
  const bypassKeyword = input.bypassKeyword || "[skip-hooks]";
  
  // Default checks
  const defaultPreCommit: HookCheck[] = [
    { name: "TypeScript", command: "npx", args: ["tsc", "--noEmit"], failOnError: true },
    { name: "ESLint", command: "npx", args: ["eslint", ".", "--ext", ".ts,.tsx", "--max-warnings", "0"], failOnError: true },
  ];
  
  const defaultPrePush: HookCheck[] = [
    { name: "Tests", command: "npm", args: ["test"], failOnError: true },
  ];
  
  const preCommitChecks: HookCheck[] = input.preCommitChecks?.map(c => ({
    name: c.name,
    command: c.command,
    args: c.args || [],
    failOnError: c.failOnError ?? true,
  })) || defaultPreCommit;
  
  const prePushChecks: HookCheck[] = input.prePushChecks?.map(c => ({
    name: c.name,
    command: c.command,
    args: c.args || [],
    failOnError: c.failOnError ?? true,
  })) || defaultPrePush;
  
  const config: GuardConfig = {
    version: "1.0.0",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hooks: [
      { type: "pre-commit", enabled: true, checks: preCommitChecks, bypassKeyword },
      { type: "pre-push", enabled: true, checks: prePushChecks, bypassKeyword },
    ],
  };
  
  const installedHooks: HookType[] = [];
  
  for (const hook of config.hooks) {
    if (!hook.enabled || hook.checks.length === 0) continue;
    
    const script = generateHookScript(hook, bypassKeyword);
    const hookPath = path.join(hooksDir, hook.type);
    
    await fs.writeFile(hookPath, script, { mode: 0o755 });
    installedHooks.push(hook.type);
  }
  
  await saveGuardConfig(repoRoot, config);
  
  // Add config to git
  if (input.commitMode !== "none") {
    await git(["add", ".swarm-guard.json"], { cwd: repoRoot });
    await git(["commit", "-m", "chore: install swarm guard hooks"], { cwd: repoRoot });
    if (input.commitMode === "push") {
      try {
        await git(["push"], { cwd: repoRoot });
      } catch {
        await git(["push", "-u", "origin", "HEAD"], { cwd: repoRoot });
      }
    }
  }
  
  return { 
    success: true, 
    installedHooks,
    message: `Installed hooks: ${installedHooks.join(", ")}. Bypass with '${bypassKeyword}' in commit message.`
  };
}

/**
 * Uninstall guard hooks
 */
export async function uninstallGuardHooks(input: {
  repoPath?: string;
  hooks?: HookType[];
}): Promise<{ success: boolean; removedHooks: HookType[]; message: string }> {
  const repoRoot = input.repoPath || process.cwd();
  
  const gitDir = path.join(repoRoot, ".git");
  const hooksDir = path.join(gitDir, "hooks");
  
  const hooksToRemove = input.hooks || ["pre-commit", "pre-push", "commit-msg"];
  const removedHooks: HookType[] = [];
  
  for (const hook of hooksToRemove) {
    const hookPath = path.join(hooksDir, hook);
    try {
      const content = await fs.readFile(hookPath, "utf8");
      if (content.includes("MCP Swarm Guard Hook")) {
        await fs.unlink(hookPath);
        removedHooks.push(hook as HookType);
      }
    } catch {
      // hook doesn't exist
    }
  }
  
  return {
    success: true,
    removedHooks,
    message: removedHooks.length > 0 
      ? `Removed hooks: ${removedHooks.join(", ")}`
      : "No swarm guard hooks found to remove"
  };
}

/**
 * Run hooks manually (for testing)
 */
export async function runGuardHooks(input: {
  repoPath?: string;
  hook: HookType;
}): Promise<{ passed: boolean; results: Array<{ name: string; passed: boolean; output: string }> }> {
  const repoRoot = input.repoPath || process.cwd();
  const config = await loadGuardConfig(repoRoot);
  
  if (!config) {
    return { passed: false, results: [{ name: "config", passed: false, output: "Guard config not found" }] };
  }
  
  const hookConfig = config.hooks.find(h => h.type === input.hook);
  if (!hookConfig || !hookConfig.enabled) {
    return { passed: false, results: [{ name: "hook", passed: false, output: `Hook ${input.hook} not configured` }] };
  }
  
  const results: Array<{ name: string; passed: boolean; output: string }> = [];
  let allPassed = true;
  
  for (const check of hookConfig.checks) {
    const { code, output } = await runCommand(check.command, check.args, repoRoot);
    const passed = code === 0;
    
    results.push({ name: check.name, passed, output });
    
    if (!passed && check.failOnError) {
      allPassed = false;
    }
  }
  
  return { passed: allPassed, results };
}

/**
 * Get guard hooks configuration
 */
export async function getGuardConfig(input: {
  repoPath?: string;
}): Promise<{ config: GuardConfig | null }> {
  const repoRoot = input.repoPath || process.cwd();
  const config = await loadGuardConfig(repoRoot);
  return { config };
}

/**
 * Update a specific hook's checks
 */
export async function updateGuardHook(input: {
  repoPath?: string;
  hook: HookType;
  enabled?: boolean;
  checks?: Array<{ name: string; command: string; args?: string[]; failOnError?: boolean }>;
  commitMode: "none" | "local" | "push";
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = input.repoPath || process.cwd();
  let config = await loadGuardConfig(repoRoot);
  
  if (!config) {
    return { success: false, message: "Guard config not found. Run install_guard_hooks first." };
  }
  
  const hookIndex = config.hooks.findIndex(h => h.type === input.hook);
  if (hookIndex === -1) {
    return { success: false, message: `Hook ${input.hook} not found in config` };
  }
  
  if (input.enabled !== undefined) {
    config.hooks[hookIndex].enabled = input.enabled;
  }
  
  if (input.checks) {
    config.hooks[hookIndex].checks = input.checks.map(c => ({
      name: c.name,
      command: c.command,
      args: c.args || [],
      failOnError: c.failOnError ?? true,
    }));
  }
  
  await saveGuardConfig(repoRoot, config);
  
  // Regenerate hook script
  const gitDir = path.join(repoRoot, ".git");
  const hooksDir = path.join(gitDir, "hooks");
  const hookConfig = config.hooks[hookIndex];
  
  if (hookConfig.enabled && hookConfig.checks.length > 0) {
    const script = generateHookScript(hookConfig, hookConfig.bypassKeyword || "[skip-hooks]");
    await fs.writeFile(path.join(hooksDir, input.hook), script, { mode: 0o755 });
  } else {
    try {
      await fs.unlink(path.join(hooksDir, input.hook));
    } catch {
      // hook doesn't exist
    }
  }
  
  if (input.commitMode !== "none") {
    await git(["add", ".swarm-guard.json"], { cwd: repoRoot });
    await git(["commit", "-m", `chore: update ${input.hook} guard hook`], { cwd: repoRoot });
    if (input.commitMode === "push") {
      try {
        await git(["push"], { cwd: repoRoot });
      } catch {
        await git(["push", "-u", "origin", "HEAD"], { cwd: repoRoot });
      }
    }
  }
  
  return { success: true, message: `Hook ${input.hook} updated` };
}

/**
 * List all available guard hooks
 */
export async function listGuardHooks(input: {
  repoPath?: string;
}): Promise<{ hooks: Array<{ type: HookType; enabled: boolean; checksCount: number }> }> {
  const repoRoot = input.repoPath || process.cwd();
  const config = await loadGuardConfig(repoRoot);
  
  if (!config) {
    return { hooks: [] };
  }
  
  return {
    hooks: config.hooks.map(h => ({
      type: h.type,
      enabled: h.enabled,
      checksCount: h.checks.length,
    })),
  };
}
