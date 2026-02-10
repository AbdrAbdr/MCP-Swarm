/**
 * MCP Swarm Bridge Client
 * 
 * Обеспечивает доступ к локальным файлам для Remote MCP Server.
 * Поддерживает несколько проектов одновременно.
 */

import WebSocket from "ws";
import { getRepoRoot } from "./workflows/repo.js";
import { getErrorMessage } from "./utils/errorUtils.js";

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
                    connection.ws.close();
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
                    connection.ws.close();
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

            const ws = new WebSocket(url.toString());
            connection.ws = ws;

            ws.on("open", () => {
                connection.connected = true;
                connection.reconnectAttempts = 0;
                connection.lastPing = Date.now();
                console.log(`✅ Bridge connected: ${repoPath}`);
            });

            ws.on("message", async (data: WebSocket.RawData) => {
                const text = typeof data === "string" ? data : Buffer.from(data as Buffer).toString();
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

    private async handleToolExecution(ws: WebSocket, request: ToolRequest, repoPath: string) {
        const { requestId, tool, args } = request;
        console.log(`🔧 Executing ${tool} for ${repoPath}`);

        try {
            const result = await this.executeLocalTool(tool, { ...args, repoPath });
            const resultData = typeof result === 'object' && result !== null ? result : {};
            ws.send(JSON.stringify({
                requestId,
                result: { bridgeConnected: true, ...(resultData as Record<string, unknown>) },
            }));
        } catch (err: unknown) {
            ws.send(JSON.stringify({
                requestId,
                result: { bridgeConnected: true, error: getErrorMessage(err) },
            }));
        }
    }

    /**
     * Universal tool execution via smart tool handlers.
     * Instead of manually implementing each tool/action,
     * we delegate to the same handlers used by the local MCP server.
     */
    private async executeLocalTool(tool: string, args: Record<string, unknown>): Promise<unknown> {
        // Lazy-load tool handlers on first call
        if (!this.toolHandlers) {
            await this.buildToolHandlers();
        }

        const handler = this.toolHandlers!.get(tool);
        if (!handler) {
            return { ok: false, error: `Unknown tool: ${tool}. Available: ${[...this.toolHandlers!.keys()].join(", ")}` };
        }

        try {
            const result = await handler(args);
            // Smart tools return { content: [...], structuredContent: ... }
            // Bridge needs the structured data, not the MCP wrapper
            if (result && typeof result === "object" && "structuredContent" in result) {
                return (result as { structuredContent: unknown }).structuredContent;
            }
            return result;
        } catch (err: unknown) {
            return { ok: false, error: getErrorMessage(err) };
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toolHandlers: Map<string, (input: any) => Promise<unknown>> | null = null;

    private async buildToolHandlers() {
        const { allSmartTools } = await import("./smartTools/index.js");
        this.toolHandlers = new Map();
        for (const tool of allSmartTools) {
            // Each smart tool is [name, schema, handler]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const [name, , handler] = tool as unknown as [string, unknown, (input: any) => Promise<unknown>];
            this.toolHandlers.set(name, handler);
        }
        console.log(`🔧 Loaded ${this.toolHandlers.size} smart tool handlers for bridge`);
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
                        connection.ws.close();
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
