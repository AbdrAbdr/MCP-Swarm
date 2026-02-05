/**
 * MCP Swarm Bridge Client
 * 
 * Обеспечивает доступ к локальным файлам для Remote MCP Server.
 * Поддерживает несколько проектов одновременно.
 */

import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./workflows/repo.js";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WS = require("ws") as any;

// ============ TYPES ============

export interface BridgeConfig {
    mcpServerUrl: string;
    projects: string[];
    reconnectIntervalMs?: number;
    maxReconnectAttempts?: number;
}

interface BridgeConnection {
    ws: WebSocket | null;
    repoPath: string;
    connected: boolean;
    reconnectAttempts: number;
    lastPing: number;
}

type ToolRequest = {
    kind: "execute";
    requestId: string;
    tool: string;
    args: Record<string, unknown>;
};

// ============ BRIDGE MANAGER ============

export class BridgeManager {
    private connections: Map<string, BridgeConnection> = new Map();
    private config: BridgeConfig;
    private stopped = false;

    constructor(config: BridgeConfig) {
        this.config = {
            reconnectIntervalMs: 5000,
            maxReconnectAttempts: 10,
            ...config,
        };
    }

    async start() {
        console.log(`🌉 Bridge Manager starting with ${this.config.projects.length} project(s)`);

        for (const projectPath of this.config.projects) {
            await this.addProject(projectPath);
        }

        // Periodic health check
        this.runHealthCheck();
    }

    async addProject(projectPath: string) {
        if (this.connections.has(projectPath)) {
            console.log(`⚠️ Project already connected: ${projectPath}`);
            return;
        }

        const repoRoot = await getRepoRoot(projectPath);
        console.log(`🔌 Connecting bridge for: ${repoRoot}`);

        const connection: BridgeConnection = {
            ws: null,
            repoPath: repoRoot,
            connected: false,
            reconnectAttempts: 0,
            lastPing: Date.now(),
        };

        this.connections.set(repoRoot, connection);
        await this.connectProject(repoRoot);
    }

    removeProject(projectPath: string) {
        const connection = this.connections.get(projectPath);
        if (connection) {
            if (connection.ws) {
                try {
                    (connection.ws as any).close();
                } catch {
                    // ignore
                }
            }
            this.connections.delete(projectPath);
            console.log(`🔌 Disconnected bridge for: ${projectPath}`);
        }
    }

    stop() {
        this.stopped = true;
        for (const [path, connection] of this.connections) {
            if (connection.ws) {
                try {
                    (connection.ws as any).close();
                } catch {
                    // ignore
                }
            }
        }
        this.connections.clear();
        console.log("🛑 Bridge Manager stopped");
    }

    private async connectProject(repoPath: string) {
        const connection = this.connections.get(repoPath);
        if (!connection || this.stopped) return;

        try {
            const url = new URL(this.config.mcpServerUrl);
            url.pathname = "/bridge";
            url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
            url.searchParams.set("repoPath", repoPath);

            const ws = new WS(url.toString());
            connection.ws = ws;

            ws.on("open", () => {
                connection.connected = true;
                connection.reconnectAttempts = 0;
                connection.lastPing = Date.now();
                console.log(`✅ Bridge connected: ${repoPath}`);
            });

            ws.on("message", async (data: unknown) => {
                const text = typeof data === "string" ? data : Buffer.from(data as any).toString();
                try {
                    const msg = JSON.parse(text);
                    if (msg.kind === "hello") {
                        console.log(`👋 Server hello received for ${repoPath}`);
                    } else if (msg.kind === "execute") {
                        await this.handleToolExecution(ws, msg as ToolRequest, repoPath);
                    } else if (msg.kind === "ping") {
                        connection.lastPing = Date.now();
                        ws.send(JSON.stringify({ kind: "pong", ts: Date.now() }));
                    }
                } catch (err) {
                    console.error(`❌ Bridge message error: ${err}`);
                }
            });

            ws.on("close", () => {
                connection.connected = false;
                connection.ws = null;
                console.log(`⚠️ Bridge disconnected: ${repoPath}`);
                this.scheduleReconnect(repoPath);
            });

            ws.on("error", (err: Error) => {
                console.error(`❌ Bridge error: ${err.message}`);
            });

        } catch (err) {
            console.error(`❌ Failed to connect bridge: ${err}`);
            this.scheduleReconnect(repoPath);
        }
    }

    private scheduleReconnect(repoPath: string) {
        const connection = this.connections.get(repoPath);
        if (!connection || this.stopped) return;

        if (connection.reconnectAttempts >= (this.config.maxReconnectAttempts ?? 10)) {
            console.error(`❌ Max reconnect attempts reached for ${repoPath}`);
            return;
        }

        connection.reconnectAttempts++;
        const delay = this.config.reconnectIntervalMs ?? 5000;
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${connection.reconnectAttempts})...`);

        setTimeout(() => {
            if (!this.stopped && this.connections.has(repoPath)) {
                this.connectProject(repoPath);
            }
        }, delay);
    }

    private async handleToolExecution(ws: any, request: ToolRequest, repoPath: string) {
        const { requestId, tool, args } = request;
        console.log(`🔧 Executing ${tool} for ${repoPath}`);

        try {
            const result = await this.executeLocalTool(tool, { ...args, repoPath });
            const resultData = typeof result === 'object' && result !== null ? result : {};
            ws.send(JSON.stringify({
                requestId,
                result: { bridgeConnected: true, ...(resultData as Record<string, unknown>) },
            }));
        } catch (err: any) {
            ws.send(JSON.stringify({
                requestId,
                result: { bridgeConnected: true, error: err.message },
            }));
        }
    }

    private async executeLocalTool(tool: string, args: Record<string, unknown>): Promise<unknown> {
        const repoPath = args.repoPath as string;

        // File operations
        if (tool === "swarm_file") {
            const action = args.action as string;

            if (action === "read") {
                const filePath = path.resolve(repoPath, args.filePath as string);
                const content = await fs.readFile(filePath, "utf-8");
                return { ok: true, content };
            }

            if (action === "write") {
                const filePath = path.resolve(repoPath, args.filePath as string);
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, args.content as string, "utf-8");
                return { ok: true, written: filePath };
            }

            if (action === "list") {
                const dirPath = path.resolve(repoPath, (args.dirPath as string) || ".");
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                return {
                    ok: true,
                    files: entries.map(e => ({
                        name: e.name,
                        isDir: e.isDirectory(),
                    })),
                };
            }

            return { ok: false, error: `Unknown file action: ${action}` };
        }

        // Git operations
        if (tool === "swarm_git") {
            // Delegate to existing git workflows
            const { gitTry } = await import("./workflows/git.js");
            const action = args.action as string;

            if (action === "status") {
                const result = await gitTry(["status", "--porcelain"], { cwd: repoPath });
                return { ok: true, status: result };
            }

            if (action === "sync") {
                await gitTry(["add", "-A"], { cwd: repoPath });
                await gitTry(["commit", "-m", args.message as string || "swarm sync"], { cwd: repoPath });
                await gitTry(["push"], { cwd: repoPath });
                return { ok: true, synced: true };
            }

            return { ok: false, error: `Unknown git action: ${action}` };
        }

        // Agent operations
        if (tool === "swarm_agent") {
            const action = args.action as string;

            if (action === "init" || action === "register") {
                const { registerAgent, whoami } = await import("./workflows/agentRegistry.js");
                const existing = await whoami(repoPath);
                if (existing.agent) {
                    return { ok: true, agent: existing.agent };
                }
                const result = await registerAgent({ repoPath, commitMode: "push" });
                return { ok: true, agent: result.agent };
            }

            if (action === "whoami") {
                const { whoami } = await import("./workflows/agentRegistry.js");
                const result = await whoami(repoPath);
                return { ok: true, ...result };
            }

            return { ok: false, error: `Unknown agent action: ${action}` };
        }

        // Unknown tool - return error
        return { ok: false, error: `Unknown tool: ${tool}` };
    }

    private runHealthCheck() {
        if (this.stopped) return;

        const now = Date.now();
        const timeout = 60_000; // 1 minute

        for (const [repoPath, connection] of this.connections) {
            if (connection.connected && now - connection.lastPing > timeout) {
                console.log(`⚠️ Connection stale for ${repoPath}, reconnecting...`);
                if (connection.ws) {
                    try {
                        (connection.ws as any).close();
                    } catch {
                        // ignore
                    }
                }
                connection.connected = false;
                this.connectProject(repoPath);
            }
        }

        setTimeout(() => this.runHealthCheck(), 30_000);
    }

    getStatus() {
        const status: Record<string, { connected: boolean; lastPing: number }> = {};
        for (const [repoPath, connection] of this.connections) {
            status[repoPath] = {
                connected: connection.connected,
                lastPing: connection.lastPing,
            };
        }
        return status;
    }
}

// ============ STANDALONE CLI ============

async function main() {
    const mcpServerUrl = process.env.MCP_SERVER_URL || "https://mcp-swarm-server.YOUR-ACCOUNT.workers.dev";
    const projectPaths = (process.env.SWARM_PROJECTS || process.cwd()).split(",").map(p => p.trim());

    console.log("🌉 MCP Swarm Bridge Client");
    console.log(`📡 Server: ${mcpServerUrl}`);
    console.log(`📁 Projects: ${projectPaths.join(", ")}`);

    const bridge = new BridgeManager({
        mcpServerUrl,
        projects: projectPaths,
    });

    await bridge.start();

    // Handle shutdown
    process.on("SIGINT", () => {
        console.log("\n🛑 Shutting down...");
        bridge.stop();
        process.exit(0);
    });

    process.on("SIGTERM", () => {
        bridge.stop();
        process.exit(0);
    });

    // Keep running
    console.log("\n✅ Bridge running. Press Ctrl+C to stop.");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { main as runBridge };
