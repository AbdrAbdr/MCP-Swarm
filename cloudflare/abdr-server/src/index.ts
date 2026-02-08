/// <reference types="@cloudflare/workers-types" />

/**
 * abdr-swarm-server v0.9.17
 * Персональный MCP Server с аутентификацией через SWARM_AUTH_TOKEN
 * Streamable HTTP Transport (MCP 2025-03-26 spec)
 */

export interface Env {
    MCP_SESSION: DurableObjectNamespace;
    HUB_URL: string;
    SWARM_AUTH_TOKEN?: string;
    TELEGRAM_BOT_URL?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
}

// ==================== AUTH MIDDLEWARE ====================

function validateAuth(request: Request, env: Env): Response | null {
    const token = env.SWARM_AUTH_TOKEN;
    if (!token) return null; // No token = open access (dev mode)

    const url = new URL(request.url);

    // Allow health/root without auth
    if (url.pathname === "/" || url.pathname === "/health") return null;

    // Check Authorization header
    const authHeader = request.headers.get("Authorization");
    if (authHeader === `Bearer ${token}`) return null;

    // Check query param (for WebSocket/bridge)
    const queryToken = url.searchParams.get("token");
    if (queryToken === token) return null;

    return new Response(JSON.stringify({
        error: "Unauthorized",
        hint: "Set SWARM_AUTH_TOKEN or pass Authorization: Bearer <token>",
    }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
}

// ==================== TELEGRAM ====================

async function registerProjectInTelegram(
    telegramBotUrl: string | undefined,
    userId: string,
    projectId: string,
    projectName: string
): Promise<boolean> {
    if (!telegramBotUrl) return false;
    try {
        const response = await fetch(`${telegramBotUrl}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: parseInt(userId, 10), projectId, name: projectName }),
        });
        return response.ok;
    } catch {
        return false;
    }
}

// ==================== SESSION ====================

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
    const session: Session = { id, telegramUserId, protocolVersion, createdAt: Date.now(), lastActivity: Date.now() };
    sessions.set(id, session);
    return session;
}

function getSession(sessionId: string): Session | null {
    const session = sessions.get(sessionId);
    if (session) session.lastActivity = Date.now();
    return session || null;
}

function deleteSession(sessionId: string): boolean {
    return sessions.delete(sessionId);
}

// ==================== CORS ====================

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Authorization",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Access-Control-Max-Age": "86400",
};

// ==================== MAIN WORKER ====================

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // CORS preflight
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: CORS_HEADERS });
        }

        // Auth check
        const authError = validateAuth(request, env);
        if (authError) return authError;

        const telegramUserId = url.searchParams.get("telegram_user_id");
        const sessionId = request.headers.get("Mcp-Session-Id");
        const protocolVersion = request.headers.get("MCP-Protocol-Version") || "2025-03-26";

        // Root / Health
        if (url.pathname === "/" || url.pathname === "" || url.pathname === "/health") {
            return Response.json({
                name: "abdr-swarm-server",
                version: "0.9.17",
                transport: "Streamable HTTP (MCP 2025-03-26)",
                status: "running",
                authenticated: !!env.SWARM_AUTH_TOKEN,
                endpoints: {
                    mcp: "/mcp (POST for messages, GET for SSE, DELETE to end session)",
                    bridge: "/bridge (WebSocket)",
                },
                telegram: telegramUserId ? `Connected as user ${telegramUserId}` : "Not connected",
            }, { headers: CORS_HEADERS });
        }

        // MCP endpoint
        if (url.pathname === "/mcp") {
            if (request.method === "POST") {
                return handleMcpPost(request, env, sessionId, telegramUserId, protocolVersion);
            }
            if (request.method === "GET") {
                return new Response("Server-initiated SSE not implemented", { status: 405, headers: CORS_HEADERS });
            }
            if (request.method === "DELETE") {
                if (sessionId && deleteSession(sessionId)) {
                    return new Response(null, { status: 200, headers: CORS_HEADERS });
                }
                return new Response("Session not found", { status: 404, headers: CORS_HEADERS });
            }
        }

        // Legacy SSE endpoint
        if (url.pathname === "/mcp/sse") {
            return Response.json({
                error: "deprecated_transport",
                message: "Use Streamable HTTP: POST /mcp",
            }, { status: 410, headers: CORS_HEADERS });
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

// ==================== MCP POST HANDLER ====================

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

        // Response from client
        if (body.result !== undefined || body.error !== undefined) {
            return new Response(null, { status: 202, headers: CORS_HEADERS });
        }

        if (!body.method) {
            return new Response(null, { status: 202, headers: CORS_HEADERS });
        }

        const method = body.method;
        const id = body.id;

        // Initialize
        if (method === "initialize") {
            const session = createSession(telegramUserId, protocolVersion);
            return Response.json({
                jsonrpc: "2.0",
                id,
                result: {
                    protocolVersion: "2025-03-26",
                    capabilities: { tools: {} },
                    serverInfo: { name: "abdr-swarm-server", version: "0.9.17" },
                },
            }, {
                headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Mcp-Session-Id": session.id },
            });
        }

        // Notifications
        if (method.startsWith("notifications/")) {
            return new Response(null, { status: 202, headers: CORS_HEADERS });
        }

        // tools/list
        if (method === "tools/list") {
            return Response.json({
                jsonrpc: "2.0",
                id,
                result: { tools: getToolsList() },
            }, { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
        }

        // tools/call
        if (method === "tools/call") {
            const params = body.params as { name: string; arguments?: Record<string, unknown> };
            const result = await executeToolRemote(params.name, params.arguments || {}, env, telegramUserId);
            return Response.json({
                jsonrpc: "2.0",
                id,
                result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
            }, { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
        }

        // ping
        if (method === "ping") {
            return Response.json({ jsonrpc: "2.0", id, result: {} }, {
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            });
        }

        // Unknown
        return Response.json({
            jsonrpc: "2.0", id,
            error: { code: -32601, message: `Method not found: ${method}` },
        }, { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

    } catch (error) {
        return Response.json({
            jsonrpc: "2.0", id: null,
            error: { code: -32700, message: "Parse error", data: String(error) },
        }, { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }
}

// ==================== TOOLS LIST (54 Smart Tools v0.9.17) ====================

function getToolsList() {
    return [
        { name: "swarm_agent", description: "Agent registration and identity. Actions: register, whoami, init", inputSchema: { type: "object", properties: { action: { type: "string", enum: ["register", "whoami", "init"] }, repoPath: { type: "string" }, commitMode: { type: "string", enum: ["none", "local", "push"] } }, required: ["action"] } },
        { name: "swarm_task", description: "Task management. Actions: create, list, update, decompose, get_decomposition", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_file", description: "File locking. Actions: reserve, release, list, forecast, conflicts, safety", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" }, filePath: { type: "string" }, agent: { type: "string" }, exclusive: { type: "boolean" } }, required: ["action"] } },
        { name: "swarm_git", description: "Git operations. Actions: sync, pr, health, cleanup, cleanup_all", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_worktree", description: "Git worktree management. Actions: create, list, remove", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_companion", description: "Companion daemon. Actions: status, stop, pause, resume", inputSchema: { type: "object", properties: { action: { type: "string" } }, required: ["action"] } },
        { name: "swarm_control", description: "Swarm stop/resume. Actions: stop, resume, status", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_chat", description: "Team communication. Actions: broadcast, dashboard, thought, thoughts", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_orchestrator", description: "Orchestrator. Actions: elect, info, heartbeat, resign, executors, executor_heartbeat", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_pulse", description: "Real-time agent status. Actions: update, get", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_review", description: "Code review. Actions: request, respond, list", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_voting", description: "Voting for dangerous actions. Actions: start, vote, list, get", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_auction", description: "Task auction. Actions: announce, bid, poll", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_message", description: "Agent messaging. Actions: send, inbox, ack, reply, search, thread", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_briefing", description: "Agent briefings. Actions: save, load", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_knowledge", description: "Knowledge base. Actions: archive, search", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_snapshot", description: "File snapshots. Actions: create, rollback, list", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_health", description: "Agent health. Actions: check, dead, reassign, summary", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_quality", description: "Quality gates. Actions: run, report, threshold, pr_ready", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_cost", description: "API cost tracking. Actions: log, agent, project, limit, remaining", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_brainstorm", description: "Brainstorming. Actions: start, ask, answer, propose, present, validate, save, get, list", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_plan", description: "Planning. Actions: create, add, next, start, step, complete, prompt, export, status, list, ready", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_debug", description: "Debugging. Actions: start, investigate, evidence, phase1, patterns, phase2, hypothesis, test, fix, verify, get, list, redflags", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_spec", description: "Spec pipeline. Actions: start, phase, complete, get, list, export", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_qa", description: "QA loop. Actions: start, iterate, fix, get, list, suggest, report", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_hooks", description: "Git hooks. Actions: install, uninstall, run, config, update, list", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_patrol", description: "Ghost mode patrol. Actions: run", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_mcp", description: "MCP authorization. Actions: scan, authorize, policy", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_telegram", description: "Telegram notifications. Actions: setup, send, notify_task_created, notify_task_completed", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_clusters", description: "Tool clusters. Actions: init, list, tools, find, add, create, summary", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_conflict", description: "Conflict prediction. Actions: predict, analyze, hotspots, record", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_dependency", description: "Dependency management. Actions: signal, sync", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_docs", description: "Documentation generator. Actions: generate, task_docs, list, get", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_expertise", description: "Expertise tracking. Actions: track, suggest, record, experts, list", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_preemption", description: "Urgent preemption. Actions: trigger, resolve, active", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_regression", description: "Regression detection. Actions: baseline, check, list, resolve, baselines", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_screenshot", description: "Screenshot sharing. Actions: share, list", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_session", description: "Session replay. Actions: start, log, stop, list, replay", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_timeline", description: "Activity timeline. Actions: generate, visualize", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_platform", description: "Platform testing. Actions: request, respond, list", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_external", description: "External integrations. Actions: enable_github, sync_github, export_github, status, create_issue", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_immune", description: "System health patrol. Actions: alert, resolve, status, test, patrol", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_autoreview", description: "Auto code review. Actions: create, assign, comment, complete, resolve, for_reviewer, for_author, pending, stats", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_context", description: "Context management. Actions: estimate, compress, compress_many, stats", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_context_pool", description: "Context pool. Actions: add, get, search_tag, search, helpful, update, cleanup, stats", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_budget", description: "Budget management. Actions: analyze, models, select, recommend, route, log_usage, usage, stats, config, set_config, check, remaining, report", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_consensus", description: "Consensus protocol. Actions: join, leave, heartbeat, status, elect, leader, propose, vote, proposals, get_proposal, execute, log, append, commit, config, set_config, stats", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_defence", description: "Security defence. Actions: scan, validate_agent, validate_tool, events, quarantine, release, stats, config, set_config, trust, untrust, clear_events", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_moe", description: "Mixture of Experts. Actions: route, feedback, experts, add_expert, remove_expert, config, set_config, stats, history, classify, reset", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_sona", description: "SONA routing. Actions: route, learn, classify, profile, profiles, specialists, history, stats, config, set_config, reset", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_vector", description: "Vector store. Actions: init, add, add_batch, search, get, delete, list, stats, config, set_config, clear, duplicates, embed", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_batch", description: "Batch processing. Actions: queue, config, set_config, job, jobs, result, stats, flush", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_booster", description: "Task booster. Actions: execute, can_boost, stats, history, config, set_config, types", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
        { name: "swarm_routing", description: "Smart routing. Actions: record, find_agent, expertise, predict, auto_assign", inputSchema: { type: "object", properties: { action: { type: "string" }, repoPath: { type: "string" } }, required: ["action"] } },
    ];
}

// ==================== TOOL EXECUTION ====================

async function executeToolRemote(
    toolName: string,
    args: Record<string, unknown>,
    env: Env,
    telegramUserId: string | null
): Promise<unknown> {
    const repoPath = args.repoPath as string | undefined;
    const needsBridge = toolNeedsBridge(toolName, args);

    if (needsBridge && !repoPath) {
        return { error: "repoPath is required", bridge_required: true };
    }

    if (needsBridge) {
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
                message: "Companion bridge not connected. Run: npx mcp-swarm-companion",
                repoPath,
            };
        }

        // Auto-register in Telegram on agent registration
        if (toolName === "swarm_agent" && args.action === "register" && telegramUserId && repoPath) {
            const projectName = repoPath.split(/[/\\]/).pop() || "unknown";
            const projectId = generateProjectId(repoPath);
            await registerProjectInTelegram(env.TELEGRAM_BOT_URL, telegramUserId, projectId, projectName);
        }

        return result;
    }

    return executeCloudTool(toolName, args, env);
}

function generateProjectId(repoPath: string): string {
    const normalized = repoPath.toLowerCase().replace(/\\/g, "/");
    const name = normalized.split("/").pop() || "project";
    const hash = Array.from(normalized).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
    return `${name}_${Math.abs(hash).toString(36).slice(0, 6)}`;
}

function toolNeedsBridge(toolName: string, args: Record<string, unknown>): boolean {
    const fsTools = ["swarm_file", "swarm_git", "swarm_snapshot", "swarm_guard"];
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
    if (toolName === "swarm_chat") {
        const action = args.action as string;
        if (action === "broadcast") {
            try {
                const hubUrl = env.HUB_URL.replace("wss://", "https://").replace("/ws", "");
                const headers: Record<string, string> = { "Content-Type": "application/json" };
                if (env.SWARM_AUTH_TOKEN) {
                    headers["Authorization"] = `Bearer ${env.SWARM_AUTH_TOKEN}`;
                }
                const response = await fetch(`${hubUrl}/api/broadcast`, {
                    method: "POST",
                    headers,
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
                body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message, parse_mode: "Markdown" }),
            });
            return { ok: true, sent: true };
        } catch {
            return { ok: false, error: "Telegram API error" };
        }
    }

    return { ok: true, tool: toolName, args };
}

// ==================== MCP SESSION DURABLE OBJECT ====================

export class McpSession {
    private state: DurableObjectState;
    private bridges: Map<WebSocket, string> = new Map();
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
            } catch { /* ignore */ }
        });

        ws.addEventListener("close", () => {
            this.bridges.delete(ws);
        });

        ws.send(JSON.stringify({ kind: "hello", ts: Date.now() }));
    }

    private async executeThroughBridge(tool: string, args: Record<string, unknown>): Promise<unknown> {
        const repoPath = args.repoPath as string;

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
