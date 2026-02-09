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
function checkNode(): boolean {
    const version = process.version;
    const major = parseInt(version.slice(1).split(".")[0], 10);
    if (major >= 18) {
        ok(`Node.js ${version} (>= 18 required)`);
        return true;
    } else {
        fail(`Node.js ${version} — requires >= 18.0.0`);
        return false;
    }
}

function checkGit(): boolean {
    try {
        const version = execSync("git --version", { encoding: "utf-8" }).trim();
        ok(`${version}`);
        return true;
    } catch {
        fail("Git not found — install from https://git-scm.com");
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

// ============ MAIN ============
async function main() {
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

    header("🔧 IDE Configs");
    checkIdeConfigs();

    console.log(`\n${c.dim}${"─".repeat(40)}${c.reset}`);
    console.log(`${c.bright}Done!${c.reset} If you see warnings, follow the suggestions above.\n`);
}

main().catch(err => {
    console.error("Doctor error:", err.message);
    process.exit(1);
});
