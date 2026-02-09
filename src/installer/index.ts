#!/usr/bin/env node
/**
 * MCP Swarm Installer v1.0.4
 * 
 * Smart installer that:
 * - Detects existing IDE configs
 * - Merges with existing MCP servers (doesn't overwrite!)
 * - Can auto-write configs with confirmation
 * 
 * Usage:
 *   npx mcp-swarm-install
 *   npx mcp-swarm-install --telegram-user-id 123456789
 *   npx mcp-swarm-install --auto-install -y
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";

// Parse CLI arguments
const cliArgs = process.argv.slice(2);
let cliTelegramId: string | null = null;
let cliMode: "remote" | "local" = "remote";
let nonInteractive = false;
let autoInstall = false;
let showHelp = false;

for (let i = 0; i < cliArgs.length; i++) {
    const arg = cliArgs[i];
    if ((arg === "--telegram-user-id" || arg === "-t") && cliArgs[i + 1]) {
        cliTelegramId = cliArgs[i + 1];
        i++;
    } else if ((arg === "--mode" || arg === "-m") && cliArgs[i + 1]) {
        cliMode = cliArgs[i + 1] === "local" ? "local" : "remote";
        i++;
    } else if (arg === "--yes" || arg === "-y") {
        nonInteractive = true;
    } else if (arg === "--auto-install" || arg === "-a") {
        autoInstall = true;
    } else if (arg === "--help" || arg === "-h") {
        showHelp = true;
    }
}

// Colors
const c = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    red: "\x1b[31m",
};

const log = (msg: string) => console.log(msg);
const logOk = (msg: string) => console.log(`${c.green}✓${c.reset} ${msg}`);
const logInfo = (msg: string) => console.log(`${c.blue}ℹ${c.reset} ${msg}`);
const logWarn = (msg: string) => console.log(`${c.yellow}⚠${c.reset} ${msg}`);
const logErr = (msg: string) => console.log(`${c.red}✗${c.reset} ${msg}`);
const logHeader = (msg: string) => console.log(`\n${c.bright}${c.cyan}${msg}${c.reset}\n`);

// OS detection
function getOS(): "windows" | "macos" | "linux" {
    const p = os.platform();
    return p === "win32" ? "windows" : p === "darwin" ? "macos" : "linux";
}

// IDE config structure
interface IDEInfo {
    name: string;
    configPath: string;
    exists: boolean;
    currentConfig: Record<string, unknown> | null;
    hasMcpSwarm: boolean;
    mcpServersKey: string; // "mcpServers" or "servers" for VS Code
}

function getIDEConfigs(): IDEInfo[] {
    const home = os.homedir();
    const osType = getOS();
    const configs: IDEInfo[] = [];

    // Helper to read and parse config
    const readConfig = (filePath: string): Record<string, unknown> | null => {
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, "utf8");
                return JSON.parse(content);
            }
        } catch {
            // Invalid JSON or read error
        }
        return null;
    };

    // Helper to check if mcp-swarm exists
    const hasMcpSwarm = (config: Record<string, unknown> | null, key: string): boolean => {
        if (!config) return false;
        const servers = config[key] as Record<string, unknown> | undefined;
        return servers ? "mcp-swarm" in servers : false;
    };

    // Claude Desktop
    let claudePath: string;
    if (osType === "windows") {
        claudePath = path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json");
    } else if (osType === "macos") {
        claudePath = path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    } else {
        claudePath = path.join(home, ".config", "claude", "claude_desktop_config.json");
    }
    const claudeConfig = readConfig(claudePath);
    configs.push({
        name: "Claude Desktop",
        configPath: claudePath,
        exists: fs.existsSync(claudePath),
        currentConfig: claudeConfig,
        hasMcpSwarm: hasMcpSwarm(claudeConfig, "mcpServers"),
        mcpServersKey: "mcpServers",
    });

    // Cursor
    const cursorPath = path.join(home, ".cursor", "mcp.json");
    const cursorConfig = readConfig(cursorPath);
    configs.push({
        name: "Cursor",
        configPath: cursorPath,
        exists: fs.existsSync(cursorPath),
        currentConfig: cursorConfig,
        hasMcpSwarm: hasMcpSwarm(cursorConfig, "mcpServers"),
        mcpServersKey: "mcpServers",
    });

    // Windsurf
    const windsurfPath = path.join(home, ".codeium", "windsurf", "mcp_config.json");
    const windsurfConfig = readConfig(windsurfPath);
    configs.push({
        name: "Windsurf",
        configPath: windsurfPath,
        exists: fs.existsSync(windsurfPath),
        currentConfig: windsurfConfig,
        hasMcpSwarm: hasMcpSwarm(windsurfConfig, "mcpServers"),
        mcpServersKey: "mcpServers",
    });

    // OpenCode
    const opencodePath = path.join(home, ".opencode", "config.json");
    const opencodeConfig = readConfig(opencodePath);
    configs.push({
        name: "OpenCode",
        configPath: opencodePath,
        exists: fs.existsSync(opencodePath),
        currentConfig: opencodeConfig,
        hasMcpSwarm: hasMcpSwarm(opencodeConfig, "mcpServers"),
        mcpServersKey: "mcpServers",
    });

    // VS Code (uses "servers" instead of "mcpServers")
    const vscodePath = path.join(home, ".vscode", "mcp.json");
    const vscodeConfig = readConfig(vscodePath);
    configs.push({
        name: "VS Code",
        configPath: vscodePath,
        exists: fs.existsSync(vscodePath),
        currentConfig: vscodeConfig,
        hasMcpSwarm: hasMcpSwarm(vscodeConfig, "servers"),
        mcpServersKey: "servers",
    });

    return configs;
}

// Generate MCP Swarm server config
interface McpSwarmConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
}

function generateMcpSwarmConfig(mode: "remote" | "local", telegramId?: string, serverUrl?: string, hubUrl?: string): McpSwarmConfig {
    if (mode === "remote") {
        if (!serverUrl) {
            throw new Error("Server URL is required for remote mode. Deploy cloudflare/mcp-server first.");
        }
        const args = [
            "mcp-swarm-remote",
            "--url", serverUrl,
        ];
        if (telegramId) {
            args.push("--telegram-user-id", telegramId);
        }
        return { command: "npx", args };
    } else {
        if (!hubUrl) {
            throw new Error("Hub URL is required for local mode. Deploy cloudflare/hub first.");
        }
        const env: Record<string, string> = {
            SWARM_HUB_URL: hubUrl,
        };
        if (telegramId) {
            env.TELEGRAM_USER_ID = telegramId;
        }
        return { command: "npx", args: ["mcp-swarm"], env };
    }
}

// Merge config with existing
function mergeConfig(
    existing: Record<string, unknown> | null,
    mcpSwarmConfig: McpSwarmConfig,
    serversKey: string
): Record<string, unknown> {
    const base = existing ? { ...existing } : {};
    const servers = (base[serversKey] as Record<string, unknown>) || {};

    // Add or update mcp-swarm
    servers["mcp-swarm"] = mcpSwarmConfig;
    base[serversKey] = servers;

    return base;
}

// Count existing servers
function countServers(config: Record<string, unknown> | null, key: string): number {
    if (!config) return 0;
    const servers = config[key] as Record<string, unknown> | undefined;
    return servers ? Object.keys(servers).length : 0;
}

// Get server names
function getServerNames(config: Record<string, unknown> | null, key: string): string[] {
    if (!config) return [];
    const servers = config[key] as Record<string, unknown> | undefined;
    return servers ? Object.keys(servers) : [];
}

// Ask question helper
function ask(rl: readline.Interface, q: string): Promise<string> {
    return new Promise(resolve => rl.question(q, a => resolve(a.trim())));
}

// Write config to file
function writeConfig(filePath: string, config: Record<string, unknown>): boolean {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
        return true;
    } catch (err) {
        return false;
    }
}

// Show help
function showHelpMessage(): void {
    console.log(`
${c.bright}MCP Swarm Installer${c.reset}

Usage:
  npx mcp-swarm-install [options]

Options:
  -t, --telegram-user-id <id>  Your Telegram User ID for notifications
  -m, --mode <mode>            Installation mode: remote (default) or local
  -a, --auto-install           Automatically write to detected IDE configs
  -y, --yes                    Non-interactive mode (use defaults)
  -h, --help                   Show this help message

Examples:
  npx mcp-swarm-install                          # Interactive
  npx mcp-swarm-install -t 123456789             # With Telegram
  npx mcp-swarm-install -a -y                    # Auto-install to all IDEs
  npx mcp-swarm-install -t 123456789 -a -y       # Full auto with Telegram

Get your Telegram User ID:
  1. Open Telegram and find @MySwarmBot
  2. Send /start
  3. Bot will show your User ID
`);
}

// Main
async function main(): Promise<void> {
    if (showHelp) {
        showHelpMessage();
        return;
    }

    console.log(`
${c.bright}${c.magenta}
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🐝 MCP Swarm Installer v1.0.4                         ║
║                                                           ║
║   Universal AI Agent Coordination Platform                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
${c.reset}`);

    // Step 1: Detect
    logHeader("Step 1: Detecting Environment");

    const osType = getOS();
    logOk(`OS: ${osType.charAt(0).toUpperCase() + osType.slice(1)}`);

    const ideConfigs = getIDEConfigs();
    const existingIDEs = ideConfigs.filter(i => i.exists);
    const withMcpSwarm = ideConfigs.filter(i => i.hasMcpSwarm);

    log("");
    log(`${c.bright}Detected IDE Configs:${c.reset}`);
    for (const ide of ideConfigs) {
        const serverCount = countServers(ide.currentConfig, ide.mcpServersKey);
        const serverNames = getServerNames(ide.currentConfig, ide.mcpServersKey);

        if (ide.exists) {
            if (ide.hasMcpSwarm) {
                logWarn(`${ide.name}: ${c.yellow}mcp-swarm already installed${c.reset} (${serverCount} servers)`);
            } else if (serverCount > 0) {
                logInfo(`${ide.name}: ${serverCount} servers [${serverNames.join(", ")}]`);
            } else {
                logOk(`${ide.name}: empty config`);
            }
        } else {
            log(`${c.dim}  ${ide.name}: not found${c.reset}`);
        }
    }

    // Interactive mode setup
    let mode = cliMode;
    let telegramId = cliTelegramId;
    let rl: readline.Interface | null = null;

    if (!nonInteractive) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }

    try {
        // Step 2: Mode selection
        if (!nonInteractive && rl) {
            logHeader("Step 2: Installation Mode");
            log("1) Remote (Recommended) - Cloud server, minimal setup");
            log("2) Local + Hub - Full local with cloud sync");
            log("");
            const modeAnswer = await ask(rl, "Choose [1/2] (default: 1): ");
            mode = modeAnswer === "2" ? "local" : "remote";
        }
        logOk(`Mode: ${mode === "remote" ? "Remote (Cloud)" : "Local + Hub"}`);

        // Step 3: Telegram
        if (!telegramId && !nonInteractive && rl) {
            logHeader("Step 3: Telegram Integration (Optional)");
            log("Get notifications via @MySwarmBot");
            log("Send /start to the bot to get your User ID");
            log("");
            telegramId = await ask(rl, "Telegram User ID (Enter to skip): ") || null;
        }
        if (telegramId) {
            logOk(`Telegram: ${telegramId}`);
        } else {
            logInfo("Telegram: skipped");
        }

        // Generate config
        const mcpSwarmConfig = generateMcpSwarmConfig(mode, telegramId || undefined);

        // Step 4: Show merged configs
        logHeader("Step 4: Configuration Preview");

        const targetIDEs = existingIDEs.length > 0 ? existingIDEs : ideConfigs.slice(0, 3);

        for (const ide of targetIDEs) {
            const merged = mergeConfig(ide.currentConfig, mcpSwarmConfig, ide.mcpServersKey);
            const serverCount = countServers(merged, ide.mcpServersKey);

            log(`${c.bright}${ide.name}${c.reset} (${serverCount} servers after install):`);
            log(`${c.dim}${ide.configPath}${c.reset}`);

            if (ide.hasMcpSwarm) {
                logWarn("Will UPDATE existing mcp-swarm config");
            } else if (ide.exists && countServers(ide.currentConfig, ide.mcpServersKey) > 0) {
                logOk("Will ADD mcp-swarm (keeping existing servers)");
            } else {
                logOk("Will CREATE new config");
            }
            log("");
        }

        // Show the config to copy
        log("─".repeat(60));
        log(`${c.cyan}${JSON.stringify({ [targetIDEs[0]?.mcpServersKey || "mcpServers"]: { "mcp-swarm": mcpSwarmConfig } }, null, 2)}${c.reset}`);
        log("─".repeat(60));
        log("");

        // Step 5: Auto-install or manual
        if (autoInstall || (!nonInteractive && rl)) {
            logHeader("Step 5: Install");

            let doInstall = autoInstall;

            if (!autoInstall && rl) {
                const answer = await ask(rl, "Auto-install to detected IDEs? [y/N]: ");
                doInstall = answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
            }

            if (doInstall) {
                for (const ide of existingIDEs) {
                    const merged = mergeConfig(ide.currentConfig, mcpSwarmConfig, ide.mcpServersKey);

                    if (writeConfig(ide.configPath, merged)) {
                        logOk(`${ide.name}: Updated successfully`);
                    } else {
                        logErr(`${ide.name}: Failed to write`);
                    }
                }

                // Create for IDEs that don't exist yet
                if (existingIDEs.length === 0) {
                    const claude = ideConfigs.find(i => i.name === "Claude Desktop");
                    if (claude) {
                        const merged = mergeConfig(null, mcpSwarmConfig, claude.mcpServersKey);
                        if (writeConfig(claude.configPath, merged)) {
                            logOk(`${claude.name}: Created successfully`);
                        }
                    }
                }
            } else {
                logInfo("Manual install: Copy the config above to your IDE's config file");
            }
        }

        // Step 6: Companion info
        if (mode === "remote") {
            logHeader("Step 6: Companion (For File Operations)");
            log("For file tools (swarm_file, swarm_task, etc.), run:");
            log(`  ${c.cyan}npx mcp-swarm-companion${c.reset}`);
            log("");
        }

        // Done
        logHeader("✅ Setup Complete!");
        log("Next steps:");
        log("  1. Restart your IDE");
        log("  2. Tell your AI: \"Use MCP Swarm. Register as agent.\"");
        log("");
        if (telegramId) {
            log(`📱 Notifications → Telegram user ${telegramId}`);
        }
        log("📖 Docs: https://github.com/AbdrAbdr/Swarm_MCP");
        log("💬 Bot: @MySwarmBot");
        log("");

    } finally {
        if (rl) rl.close();
    }
}

main().catch(err => {
    logErr(`Failed: ${err.message}`);
    process.exit(1);
});
