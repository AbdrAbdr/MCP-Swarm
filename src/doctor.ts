#!/usr/bin/env node
/**
 * MCP Swarm Doctor — Self-diagnostics CLI
 * 
 * Checks:
 * 1. Node.js version (>= 18)
 * 2. Git availability and version
 * 3. Hub connectivity (SWARM_HUB_URL)
 * 4. PID file (is companion running?)
 * 5. Port availability (37373)
 * 6. npm registry (latest version check)
 * 7. IDE config detection
 * 
 * Usage: npx mcp-swarm-doctor
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { readFileSync } from "node:fs";

// ============ COLORS ============
const c = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
};

function ok(msg: string) { console.log(`  ${c.green}✅${c.reset} ${msg}`); }
function warn(msg: string) { console.log(`  ${c.yellow}⚠️${c.reset}  ${msg}`); }
function fail(msg: string) { console.log(`  ${c.red}❌${c.reset} ${msg}`); }
function info(msg: string) { console.log(`  ${c.blue}ℹ${c.reset}  ${msg}`); }
function header(msg: string) { console.log(`\n${c.bright}${msg}${c.reset}`); }

// ============ DOCTOR RESULT TYPE ============

interface DoctorCheckResult {
    name: string;
    status: "ok" | "warn" | "fail" | "info";
    message: string;
}

interface DoctorResult {
    version: string;
    ts: string;
    checks: DoctorCheckResult[];
    summary: { ok: number; warn: number; fail: number; info: number };
}

// ============ VERSION ============
function getVersion(): string {
    try {
        const pkgPath = path.join(new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"), "..", "package.json");
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        return pkg.version || "unknown";
    } catch {
        return "unknown";
    }
}

// ============ CHECKS ============
function checkNode(results?: DoctorCheckResult[]): boolean {
    const version = process.version;
    const major = parseInt(version.slice(1).split(".")[0], 10);
    if (major >= 18) {
        const msg = `Node.js ${version} (>= 18 required)`;
        if (results) results.push({ name: "node", status: "ok", message: msg }); else ok(msg);
        return true;
    } else {
        const msg = `Node.js ${version} — requires >= 18.0.0`;
        if (results) results.push({ name: "node", status: "fail", message: msg }); else fail(msg);
        return false;
    }
}

function checkGit(results?: DoctorCheckResult[]): boolean {
    try {
        const version = execSync("git --version", { encoding: "utf-8" }).trim();
        if (results) results.push({ name: "git", status: "ok", message: version }); else ok(`${version}`);
        return true;
    } catch {
        const msg = "Git not found — install from https://git-scm.com";
        if (results) results.push({ name: "git", status: "fail", message: msg }); else fail(msg);
        return false;
    }
}

function checkPidFile(): boolean {
    const pidFile = path.join(os.homedir(), ".mcp-swarm", "companion.pid");
    if (fs.existsSync(pidFile)) {
        const pid = fs.readFileSync(pidFile, "utf-8").trim();
        ok(`Companion PID file found (PID: ${pid})`);

        // Check if process is actually running
        try {
            process.kill(parseInt(pid, 10), 0);
            ok(`Companion process is running (PID: ${pid})`);
        } catch {
            warn(`PID file exists but process ${pid} is not running (stale PID file)`);
        }
        return true;
    } else {
        info("Companion is not running (no PID file)");
        return true;
    }
}

async function checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    if (json.ok) {
                        ok(`Port ${port} — Companion responding (uptime: ${Math.floor(json.uptime)}s)`);
                    } else {
                        warn(`Port ${port} — Companion responding but unhealthy`);
                    }
                } catch {
                    warn(`Port ${port} — Something is listening but not Companion`);
                }
                resolve(true);
            });
        });
        req.on("error", () => {
            info(`Port ${port} — Not in use (Companion not running)`);
            resolve(true);
        });
        req.setTimeout(3000, () => {
            req.destroy();
            info(`Port ${port} — Timeout`);
            resolve(true);
        });
    });
}

function checkLogDir(): boolean {
    const logDir = path.join(os.homedir(), ".mcp-swarm", "logs");
    if (fs.existsSync(logDir)) {
        const files = fs.readdirSync(logDir).filter(f => f.endsWith(".log"));
        ok(`Log directory exists — ${files.length} log file(s)`);
        if (files.length > 0) {
            const latest = files.sort().pop()!;
            const stat = fs.statSync(path.join(logDir, latest));
            const sizeKb = (stat.size / 1024).toFixed(1);
            info(`Latest: ${latest} (${sizeKb} KB)`);
        }
    } else {
        info("Log directory not created yet (will be created on first run)");
    }
    return true;
}

function checkHubUrl(): boolean {
    const hubUrl = process.env.SWARM_HUB_URL;
    if (hubUrl) {
        ok(`SWARM_HUB_URL = ${hubUrl}`);
        return true;
    } else {
        warn("SWARM_HUB_URL not set — Hub connectivity disabled");
        info("Set it in your MCP config env to enable remote sync");
        return true;
    }
}

function checkIdeConfigs(): void {
    const homeDir = os.homedir();
    const configs = [
        { name: "Claude Code", path: path.join(homeDir, ".claude", "mcp_config.json") },
        { name: "Cursor", path: path.join(process.cwd(), ".cursor", "mcp.json") },
        { name: "Windsurf", path: path.join(process.cwd(), ".windsurf", "mcp.json") },
        { name: "Antigravity", path: path.join(homeDir, ".gemini", "antigravity", "mcp_config.json") },
    ];

    let found = 0;
    for (const cfg of configs) {
        if (fs.existsSync(cfg.path)) {
            try {
                const content = JSON.parse(fs.readFileSync(cfg.path, "utf-8"));
                const hasMcpSwarm = content.mcpServers?.["mcp-swarm"];
                if (hasMcpSwarm) {
                    ok(`${cfg.name} — MCP Swarm configured`);
                    found++;
                } else {
                    info(`${cfg.name} — Config exists but MCP Swarm not configured`);
                }
            } catch {
                warn(`${cfg.name} — Config exists but cannot parse`);
            }
        }
    }

    if (found === 0) {
        info("No IDE configs found with MCP Swarm. See examples/ for setup.");
    }
}

async function checkLatestVersion(currentVersion: string): Promise<void> {
    return new Promise((resolve) => {
        const req = http.get("http://registry.npmjs.org/mcp-swarm/latest", (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    const latest = json.version;
                    if (latest === currentVersion) {
                        ok(`Latest version (${currentVersion}) — up to date`);
                    } else {
                        warn(`Update available: ${currentVersion} → ${latest}`);
                        info(`Run: npm install -g mcp-swarm@latest`);
                    }
                } catch {
                    info("Could not check npm registry");
                }
                resolve();
            });
        });
        req.on("error", () => {
            info("Could not reach npm registry (offline?)");
            resolve();
        });
        req.setTimeout(5000, () => {
            req.destroy();
            info("npm registry timeout");
            resolve();
        });
    });
}

// ============ SWARM CONFIG ============
async function checkSwarmConfig(): Promise<void> {
    // Try common config locations
    const candidates = [
        process.cwd(),
        path.join(os.homedir(), ".mcp-swarm"),
    ];

    for (const base of candidates) {
        const configPath = path.join(base, ".swarm", "config.json");
        try {
            const raw = fs.readFileSync(configPath, "utf-8");
            const config = JSON.parse(raw);
            ok(`Config found: ${configPath}`);
            info(`  Mode: ${config.mode || "standard"}`);
            if (config.vector) {
                info(`  Vector Backend: ${config.vector.backend || "local"}`);
                info(`  Embedding Provider: ${config.vector.embeddingProvider || "builtin"}`);
                if (config.vector.ttlDays) info(`  TTL: ${config.vector.ttlDays} days`);
                info(`  Semantic Cache: ${config.vector.semanticCachingEnabled ? "✅" : "❌"}`);
                info(`  Global Memory: ${config.vector.globalMemoryEnabled ? "✅" : "❌"}`);
            }
            if (config.vault) {
                info(`  Vault: ${config.vault.enabled ? "✅ enabled" : "❌ disabled"}`);
                if (config.vault.autoBackup) info(`  Vault Backup: ${config.vault.backupTarget || "local"}`);
            }
            if (config.github) {
                info(`  GitHub Sync: ${config.github.enabled ? "✅" : "❌"}`);
            }
            if (config.profiles) {
                info(`  Profiles: ${config.profiles.enabled ? `✅ (${config.profiles.defaultProfile || "fullstack"})` : "❌"}`);
            }
            if (config.scheduledTasks) {
                const taskCount = config.scheduledTasks.tasks?.length || 0;
                info(`  Scheduler: ${config.scheduledTasks.enabled ? `✅ (${taskCount} tasks)` : "❌"}`);
            }
            if (config.plugins) {
                info(`  Plugins: ${config.plugins.enabled ? "✅" : "❌"}`);
            }
            return;
        } catch {
            // Try next
        }
    }
    info("No config.json found (run swarm_setup wizard to create)");
}

function checkVaultFile(): void {
    const candidates = [
        path.join(process.cwd(), ".swarm", "vault.enc"),
        path.join(os.homedir(), ".mcp-swarm", "vault.enc"),
    ];

    for (const vaultPath of candidates) {
        if (fs.existsSync(vaultPath)) {
            const stat = fs.statSync(vaultPath);
            const sizeKb = (stat.size / 1024).toFixed(1);
            ok(`Vault file: ${vaultPath} (${sizeKb} KB)`);
            return;
        }
    }
    info("No vault.enc found (vault not initialized)");
}

/**
 * Run all doctor checks and return structured results
 */
export async function runDoctorChecks(): Promise<DoctorResult> {
    const version = getVersion();
    const checks: DoctorCheckResult[] = [];

    checkNode(checks);
    checkGit(checks);
    checkPidFile();
    await checkPort(37373);
    checkLogDir();
    checkHubUrl();

    const summary = {
        ok: checks.filter(c => c.status === "ok").length,
        warn: checks.filter(c => c.status === "warn").length,
        fail: checks.filter(c => c.status === "fail").length,
        info: checks.filter(c => c.status === "info").length,
    };

    return { version, ts: new Date().toISOString(), checks, summary };
}

// ============ MAIN ============
async function main() {
    const isJson = process.argv.includes("--json");

    if (isJson) {
        const result = await runDoctorChecks();
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    const version = getVersion();

    console.log(`
${c.bright}🐝 MCP Swarm Doctor v${version}${c.reset}
${c.dim}${"─".repeat(40)}${c.reset}`);

    header("📋 System");
    checkNode();
    checkGit();

    header("🐝 Companion");
    checkPidFile();
    await checkPort(37373);
    checkLogDir();

    header("🌐 Network");
    checkHubUrl();
    await checkLatestVersion(version);

    header("⚙️ Swarm Config");
    await checkSwarmConfig();
    checkVaultFile();

    header("🔧 IDE Configs");
    checkIdeConfigs();

    console.log(`\n${c.dim}${"─".repeat(40)}${c.reset}`);
    console.log(`${c.bright}Done!${c.reset} If you see warnings, follow the suggestions above.\n`);
}

main().catch(err => {
    console.error("Doctor error:", err.message);
    process.exit(1);
});
