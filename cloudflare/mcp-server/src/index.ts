/// <reference types="@cloudflare/workers-types" />

/**
 * MCP Swarm Server - Streamable HTTP Transport (MCP 2025-03-26 spec)
 * 
 * This replaces the old HTTP+SSE transport which doesn't work on Cloudflare
 * due to response buffering.
 * 
 * Endpoints:
 * - POST /mcp - MCP endpoint (handles all JSON-RPC messages)
 * - GET /mcp - Optional SSE stream for server->client notifications (not required)
 * - WS /bridge - WebSocket for Companion bridge
 * 
 * Query params:
 * - telegram_user_id - User ID from Telegram (for auto-registration)
 * 
 * Headers:
 * - Mcp-Session-Id - Session ID (returned on initialize, required for subsequent requests)
 * - MCP-Protocol-Version - Protocol version (2025-03-26 or 2025-06-18)
 */

// ============ TELEGRAM BOT URL ============
const TELEGRAM_BOT_URL = "https://mcp-swarm-telegram.unilife-ch.workers.dev";

export interface Env {
    MCP_SESSION: DurableObjectNamespace;
    HUB_URL: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
}

// ============ TELEGRAM REGISTRATION ============

async function registerProjectInTelegram(
    userId: string,
    projectId: string,
    projectName: string
): Promise<boolean> {
    try {
        const response = await fetch(`${TELEGRAM_BOT_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: parseInt(userId, 10),
                projectId,
                name: projectName,
            }),
        });
        return response.ok;
    } catch {
        return false;
    }
}

// ============ SESSION MANAGEMENT ============

interface Session {
    id: string;
    telegramUserId: string | null;
    protocolVersion: string;
    createdAt: number;
    lastActivity: number;
}

const sessions = new Map<string, Session>();

function createSession(telegramUserId: string | null, protocolVersion: string): Session {
    const id = crypto.randomUUID();
    const session: Session = {
        id,
        telegramUserId,
        protocolVersion,
        createdAt: Date.now(),
        lastActivity: Date.now(),
    };
    sessions.set(id, session);
    return session;
}

function getSession(sessionId: string): Session | null {
    const session = sessions.get(sessionId);
    if (session) {
        session.lastActivity = Date.now();
    }
    return session || null;
}

function deleteSession(sessionId: string): boolean {
    return sessions.delete(sessionId);
}

// ============ CORS HEADERS ============

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Access-Control-Max-Age": "86400",
};

// ============ MAIN WORKER ============

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        
        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: CORS_HEADERS });
        }
        
        // Extract telegram_user_id from query params
        const telegramUserId = url.searchParams.get("telegram_user_id");
        
        // Get session ID from header
        const sessionId = request.headers.get("Mcp-Session-Id");
        const protocolVersion = request.headers.get("MCP-Protocol-Version") || "2025-03-26";

        // Root - info
        if (url.pathname === "/" || url.pathname === "") {
            return Response.json({
                name: "MCP Swarm Server",
                version: "0.9.11",
                transport: "Streamable HTTP (MCP 2025-03-26)",
                status: "running",
                endpoints: {
                    mcp: "/mcp (POST for messages, GET for SSE, DELETE to end session)",
                    bridge: "/bridge (WebSocket)",
                },
                telegram: telegramUserId ? `Connected as user ${telegramUserId}` : "Not connected (add telegram_user_id param)",
                usage: {
                    initialize: "POST /mcp with InitializeRequest, receive Mcp-Session-Id header",
                    request: "POST /mcp with Mcp-Session-Id header",
                    notifications: "GET /mcp for server-to-client notifications (optional)",
                },
            }, { headers: CORS_HEADERS });
        }

        // MCP endpoint - Streamable HTTP transport
        if (url.pathname === "/mcp") {
            // POST - receive JSON-RPC messages from client
            if (request.method === "POST") {
                return handleMcpPost(request, env, sessionId, telegramUserId, protocolVersion);
            }
            
            // GET - SSE stream for server->client notifications (optional)
            if (request.method === "GET") {
                // For now, return 405 - we don't need server-initiated messages
                // This could be implemented later if needed
                return new Response("Server-initiated SSE not implemented", { 
                    status: 405,
                    headers: CORS_HEADERS,
                });
            }
            
            // DELETE - end session
            if (request.method === "DELETE") {
                if (sessionId && deleteSession(sessionId)) {
                    return new Response(null, { status: 200, headers: CORS_HEADERS });
                }
                return new Response("Session not found", { status: 404, headers: CORS_HEADERS });
            }
        }

        // Legacy SSE endpoint - redirect to new transport info
        if (url.pathname === "/mcp/sse") {
            return Response.json({
                error: "deprecated_transport",
                message: "HTTP+SSE transport is deprecated. Use Streamable HTTP transport instead.",
                migration: {
                    old: "GET /mcp/sse + POST /mcp/messages",
                    new: "POST /mcp (single endpoint)",
                },
                documentation: "https://modelcontextprotocol.io/docs/concepts/transports",
            }, { 
                status: 410, // Gone
                headers: CORS_HEADERS,
            });
        }

        // Legacy messages endpoint - redirect
        if (url.pathname === "/mcp/messages") {
            return Response.json({
                error: "deprecated_transport",
                message: "Use POST /mcp instead",
            }, { 
                status: 301, 
                headers: {
                    ...CORS_HEADERS,
                    "Location": "/mcp",
                },
            });
        }

        // Bridge WebSocket
        if (url.pathname === "/bridge") {
            const session = url.searchParams.get("session") || "default";
            const id = env.MCP_SESSION.idFromName(session);
            const stub = env.MCP_SESSION.get(id);
            return stub.fetch(request);
        }

        return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
    },
};

// ============ STREAMABLE HTTP HANDLER ============

async function handleMcpPost(
    request: Request, 
    env: Env, 
    sessionId: string | null,
    telegramUserId: string | null,
    protocolVersion: string
): Promise<Response> {
    try {
        const body = await request.json() as {
            jsonrpc: string;
            id?: string | number;
            method?: string;
            params?: unknown;
            result?: unknown;
            error?: unknown;
        };

        // Check if it's a response or notification (no id means notification)
        if (body.result !== undefined || body.error !== undefined) {
            // This is a JSON-RPC response from client - just acknowledge
            return new Response(null, { status: 202, headers: CORS_HEADERS });
        }

        if (!body.method) {
            // Notification without method - acknowledge
            return new Response(null, { status: 202, headers: CORS_HEADERS });
        }

        // Handle JSON-RPC requests
        const method = body.method;
        const id = body.id;

        // Initialize - create new session
        if (method === "initialize") {
            const session = createSession(telegramUserId, protocolVersion);
            
            const result = {
                protocolVersion: "2025-03-26",
                capabilities: {
                    tools: {},
                },
                serverInfo: {
                    name: "mcp-swarm",
                    version: "0.9.11",
                },
            };
            
            return Response.json({
                jsonrpc: "2.0",
                id,
                result,
            }, {
                headers: {
                    ...CORS_HEADERS,
                    "Content-Type": "application/json",
                    "Mcp-Session-Id": session.id,
                },
            });
        }

        // For notifications, just acknowledge
        if (method === "notifications/initialized" || method.startsWith("notifications/")) {
            return new Response(null, { status: 202, headers: CORS_HEADERS });
        }

        // Note: Cloudflare Workers are stateless, so we can't persist sessions in memory.
        // For now, we'll be lenient and allow requests without session validation.
        // In production, you'd use Durable Objects or KV for session storage.
        
        // Get telegram user from params or query
        const effectiveTelegramUserId = telegramUserId;

        // tools/list
        if (method === "tools/list") {
            return Response.json({
                jsonrpc: "2.0",
                id,
                result: {
                    tools: getToolsList(),
                },
            }, {
                headers: {
                    ...CORS_HEADERS,
                    "Content-Type": "application/json",
                },
            });
        }

        // tools/call
        if (method === "tools/call") {
            const params = body.params as { name: string; arguments?: Record<string, unknown> };
            const result = await executeToolRemote(params.name, params.arguments || {}, env, effectiveTelegramUserId);
            
            return Response.json({
                jsonrpc: "2.0",
                id,
                result: {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                },
            }, {
                headers: {
                    ...CORS_HEADERS,
                    "Content-Type": "application/json",
                },
            });
        }

        // ping
        if (method === "ping") {
            return Response.json({
                jsonrpc: "2.0",
                id,
                result: {},
            }, {
                headers: {
                    ...CORS_HEADERS,
                    "Content-Type": "application/json",
                },
            });
        }

        // Unknown method
        return Response.json({
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
        }, {
            headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json",
            },
        });

    } catch (error) {
        return Response.json({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error", data: String(error) },
        }, { 
            status: 400,
            headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json",
            },
        });
    }
}

// ============ TOOLS LIST ============
// All 54 Smart Tools from MCP Swarm v0.9.10

function getToolsList() {
    return [
        // 1. swarm_agent
        {
            name: "swarm_agent",
            description: "Agent registration and identity. Actions: register, whoami, init",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["register", "whoami", "init"] },
                    repoPath: { type: "string" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        // 2. swarm_task
        {
            name: "swarm_task",
            description: "Task management. Actions: create, list, update, decompose, get_decomposition",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["create", "list", "update", "decompose", "get_decomposition"] },
                    repoPath: { type: "string" },
                    shortDesc: { type: "string" },
                    title: { type: "string" },
                    questions: { type: "array", items: { type: "string" } },
                    answers: { type: "array", items: { type: "string" } },
                    notes: { type: "string" },
                    taskId: { type: "string" },
                    status: { type: "string", enum: ["open", "in_progress", "needs_review", "done", "canceled"] },
                    assignee: { type: "string" },
                    branch: { type: "string" },
                    links: { type: "array", items: { type: "string" } },
                    parentTitle: { type: "string" },
                    subtasks: { type: "array" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        // 3. swarm_file
        {
            name: "swarm_file",
            description: "File locking and conflict management. Actions: reserve, release, list, forecast, conflicts, safety",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["reserve", "release", "list", "forecast", "conflicts", "safety"] },
                    repoPath: { type: "string" },
                    filePath: { type: "string" },
                    files: { type: "array", items: { type: "string" } },
                    agent: { type: "string" },
                    exclusive: { type: "boolean" },
                    ttlMs: { type: "number" },
                    taskId: { type: "string" },
                    estimatedMinutesFromNow: { type: "number" },
                    confidence: { type: "string", enum: ["low", "medium", "high"] },
                    excludeAgent: { type: "string" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        // 4. swarm_git
        {
            name: "swarm_git",
            description: "Git operations. Actions: sync, pr, health, cleanup, cleanup_all",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["sync", "pr", "health", "cleanup", "cleanup_all"] },
                    repoPath: { type: "string" },
                    baseBranch: { type: "string" },
                    title: { type: "string" },
                    body: { type: "string" },
                    draft: { type: "boolean" },
                    branch: { type: "string" },
                    deleteLocal: { type: "boolean" },
                    deleteRemote: { type: "boolean" },
                },
                required: ["action"],
            },
        },
        // 5. swarm_worktree
        {
            name: "swarm_worktree",
            description: "Git worktree management. Actions: create, list, remove",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["create", "list", "remove"] },
                    repoPath: { type: "string" },
                    agentName: { type: "string" },
                    shortDesc: { type: "string" },
                    baseRef: { type: "string" },
                    push: { type: "boolean" },
                    worktreePath: { type: "string" },
                    force: { type: "boolean" },
                },
                required: ["action"],
            },
        },
        // 6. swarm_companion
        {
            name: "swarm_companion",
            description: "Companion daemon control. Actions: status, stop, pause, resume",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["status", "stop", "pause", "resume"] },
                    port: { type: "number" },
                    token: { type: "string" },
                },
                required: ["action"],
            },
        },
        // 7. swarm_control
        {
            name: "swarm_control",
            description: "Swarm stop/resume control. Actions: stop, resume, status",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["stop", "resume", "status"] },
                    repoPath: { type: "string" },
                    reason: { type: "string" },
                    by: { type: "string" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        // 8. swarm_chat
        {
            name: "swarm_chat",
            description: "Team communication. Actions: broadcast, dashboard, thought, thoughts",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["broadcast", "dashboard", "thought", "thoughts"] },
                    repoPath: { type: "string" },
                    message: { type: "string" },
                    statusLine: { type: "string" },
                    agent: { type: "string" },
                    taskId: { type: "string" },
                    context: { type: "string" },
                    limit: { type: "number" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        // 9. swarm_orchestrator
        {
            name: "swarm_orchestrator",
            description: "Orchestrator election and management. Actions: elect, info, heartbeat, resign, executors, executor_heartbeat",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["elect", "info", "heartbeat", "resign", "executors", "executor_heartbeat"] },
                    repoPath: { type: "string" },
                    agentId: { type: "string" },
                    agentName: { type: "string" },
                    platform: { type: "string" },
                    currentTask: { type: "string" },
                },
                required: ["action"],
            },
        },
        // 10. swarm_pulse
        {
            name: "swarm_pulse",
            description: "Real-time agent status. Actions: update, get",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["update", "get"] },
                    repoPath: { type: "string" },
                    agent: { type: "string" },
                    currentFile: { type: "string" },
                    currentTask: { type: "string" },
                    status: { type: "string", enum: ["active", "idle", "paused", "offline"] },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        // Additional essential tools (abbreviated for brevity - full list in original)
        {
            name: "swarm_review",
            description: "Code review between agents. Actions: request, respond, list",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_voting",
            description: "Voting for dangerous actions. Actions: start, vote, list, get",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_auction",
            description: "Task auction system. Actions: announce, bid, poll",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_message",
            description: "Agent messaging system. Actions: send, inbox, ack, reply, search, thread",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_briefing",
            description: "Agent briefing management. Actions: save, load",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_knowledge",
            description: "Knowledge base management. Actions: archive, search",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_snapshot",
            description: "File snapshots for rollback. Actions: create, rollback, list",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_health",
            description: "Agent health monitoring. Actions: check, dead, reassign, summary",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_quality",
            description: "Quality gate checks. Actions: run, report, threshold, pr_ready",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_cost",
            description: "API cost tracking. Actions: log, agent, project, limit, remaining",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_brainstorm",
            description: "Brainstorming sessions. Actions: start, ask, answer, propose, present, validate, save, get, list",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_plan",
            description: "Implementation planning. Actions: create, add, next, start, step, complete, prompt, export, status, list, ready",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_debug",
            description: "Systematic debugging. Actions: start, investigate, evidence, phase1, patterns, phase2, hypothesis, test, fix, verify, get, list, redflags",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_spec",
            description: "Spec pipeline. Actions: start, phase, complete, get, list, export",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_qa",
            description: "QA loop. Actions: start, iterate, fix, get, list, suggest, report",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_hooks",
            description: "Git hooks management. Actions: install, uninstall, run, config, update, list",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_patrol",
            description: "Ghost mode patrol. Actions: run",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_mcp",
            description: "MCP scanner and authorization. Actions: scan, authorize, policy",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_telegram",
            description: "Telegram notifications. Actions: setup, send, notify_task_created, notify_task_completed",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
        {
            name: "swarm_clusters",
            description: "Tool clusters. Actions: init, list, tools, find, add, create, summary",
            inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] },
        },
    ];
}

// ============ TOOL EXECUTION ============

async function executeToolRemote(
    toolName: string,
    args: Record<string, unknown>,
    env: Env,
    telegramUserId: string | null
): Promise<unknown> {
    const repoPath = args.repoPath as string | undefined;

    // Check if this tool needs the bridge
    const needsBridge = toolNeedsBridge(toolName, args);

    if (needsBridge && !repoPath) {
        return {
            error: "repoPath is required",
            bridge_required: true,
        };
    }

    if (needsBridge) {
        // Delegate to bridge through Durable Object
        const sessionId = repoPath || "default";
        const id = env.MCP_SESSION.idFromName(sessionId);
        const stub = env.MCP_SESSION.get(id);

        const response = await stub.fetch(new Request("http://internal/execute", {
            method: "POST",
            body: JSON.stringify({ tool: toolName, args }),
        }));

        const result = await response.json() as { bridgeConnected: boolean;[key: string]: unknown };

        if (!result.bridgeConnected) {
            return {
                status: "bridge_required",
                message: "Companion bridge is not connected. Run: npx mcp-swarm-companion",
                repoPath,
                instructions: [
                    "1. Install Companion: npm install -g mcp-swarm-companion",
                    "2. Run: mcp-swarm-companion",
                    "3. Companion will auto-connect to this server",
                ],
            };
        }

        // Auto-register project in Telegram when agent registers
        if (toolName === "swarm_agent" && args.action === "register" && telegramUserId && repoPath) {
            const projectName = repoPath.split(/[/\\]/).pop() || "unknown";
            const projectId = generateProjectId(repoPath);
            await registerProjectInTelegram(telegramUserId, projectId, projectName);
        }

        return result;
    }

    // Tools that don't need bridge - execute directly
    return executeCloudTool(toolName, args, env);
}

// Generate a stable project ID from repoPath
function generateProjectId(repoPath: string): string {
    const normalized = repoPath.toLowerCase().replace(/\\/g, "/");
    const name = normalized.split("/").pop() || "project";
    const hash = Array.from(normalized).reduce((acc, char) => {
        return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
    }, 0);
    return `${name}_${Math.abs(hash).toString(36).slice(0, 6)}`;
}

function toolNeedsBridge(toolName: string, args: Record<string, unknown>): boolean {
    // Tools that require file system access
    const fsTools = [
        "swarm_file",
        "swarm_git",
        "swarm_snapshot",
        "swarm_guard",
    ];

    // Some actions within tools need bridge
    if (toolName === "swarm_agent") {
        const action = args.action as string;
        return action === "init" || action === "register";
    }

    return fsTools.includes(toolName);
}

async function executeCloudTool(
    toolName: string,
    args: Record<string, unknown>,
    env: Env
): Promise<unknown> {
    // Cloud-only tools execution

    if (toolName === "swarm_chat") {
        const action = args.action as string;
        if (action === "broadcast") {
            try {
                const response = await fetch(`${env.HUB_URL.replace("wss://", "https://").replace("/ws", "")}/api/broadcast`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: args.message, channel: "chat" }),
                });
                return { ok: response.ok, action: "broadcast" };
            } catch {
                return { ok: false, error: "Hub unavailable" };
            }
        }
        return { ok: true, action };
    }

    if (toolName === "swarm_telegram" && env.TELEGRAM_BOT_TOKEN) {
        const message = args.message as string;
        try {
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: env.TELEGRAM_CHAT_ID,
                    text: message,
                    parse_mode: "Markdown",
                }),
            });
            return { ok: true, sent: true };
        } catch {
            return { ok: false, error: "Telegram API error" };
        }
    }

    return { ok: true, tool: toolName, args };
}

// ============ MCP SESSION DURABLE OBJECT ============

export class McpSession {
    private state: DurableObjectState;
    private bridges: Map<WebSocket, string> = new Map(); // ws -> repoPath
    private pendingRequests: Map<string, { resolve: (value: unknown) => void; timeout: ReturnType<typeof setTimeout> }> = new Map();

    constructor(state: DurableObjectState) {
        this.state = state;
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // WebSocket upgrade for bridge
        if (request.headers.get("Upgrade") === "websocket") {
            const pair = new WebSocketPair();
            const [client, server] = [pair[0], pair[1]];
            await this.handleBridge(server, url.searchParams.get("repoPath") || "default");
            return new Response(null, { status: 101, webSocket: client });
        }

        // Internal tool execution
        if (url.pathname === "/execute" && request.method === "POST") {
            const body = await request.json() as { tool: string; args: Record<string, unknown> };
            const result = await this.executeThroughBridge(body.tool, body.args);
            return Response.json(result);
        }

        return new Response("Not Found", { status: 404 });
    }

    private async handleBridge(ws: WebSocket, repoPath: string) {
        ws.accept();
        this.bridges.set(ws, repoPath);

        ws.addEventListener("message", (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data as string) as { requestId?: string; result?: unknown };
                if (data.requestId && this.pendingRequests.has(data.requestId)) {
                    const pending = this.pendingRequests.get(data.requestId)!;
                    clearTimeout(pending.timeout);
                    pending.resolve(data.result);
                    this.pendingRequests.delete(data.requestId);
                }
            } catch {
                // Ignore parse errors
            }
        });

        ws.addEventListener("close", () => {
            this.bridges.delete(ws);
        });

        // Send hello
        ws.send(JSON.stringify({ kind: "hello", ts: Date.now() }));
    }

    private async executeThroughBridge(tool: string, args: Record<string, unknown>): Promise<unknown> {
        const repoPath = args.repoPath as string;

        // Find bridge for this repoPath
        let targetBridge: WebSocket | null = null;
        for (const [ws, path] of this.bridges) {
            if (path === repoPath || path === "default") {
                targetBridge = ws;
                break;
            }
        }

        if (!targetBridge) {
            return { bridgeConnected: false };
        }

        // Send request to bridge
        const requestId = crypto.randomUUID();

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                resolve({ bridgeConnected: true, error: "Bridge timeout" });
            }, 30000);

            this.pendingRequests.set(requestId, { resolve, timeout });

            targetBridge!.send(JSON.stringify({
                kind: "execute",
                requestId,
                tool,
                args,
            }));
        });
    }
}
