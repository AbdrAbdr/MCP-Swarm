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
// This should be set via wrangler.toml [vars] TELEGRAM_BOT_URL
// or passed in request if user deploys their own telegram-bot

export interface Env {
    MCP_SESSION: DurableObjectNamespace;
    HUB_URL: string;
    TELEGRAM_BOT_URL?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
}

// ============ TELEGRAM REGISTRATION ============

async function registerProjectInTelegram(
    telegramBotUrl: string | undefined,
    userId: string,
    projectId: string,
    projectName: string
): Promise<boolean> {
    if (!telegramBotUrl) {
        // Telegram bot not configured, skip registration
        return false;
    }
    try {
        const response = await fetch(`${telegramBotUrl}/register`, {
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
                version: "1.0.4",
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
                    version: "1.0.4",
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
// All 26 Consolidated Smart Tools from MCP Swarm v1.1.0

function getToolsList() {
    return [
        // === Core (2) ===
        {
            name: "swarm_agent",
            description: "Agent registration, identity & companion control. Actions: register, whoami, init, companion_status, companion_stop, companion_pause, companion_resume",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["register", "whoami", "init", "companion_status", "companion_stop", "companion_pause", "companion_resume"] },
                    repoPath: { type: "string" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                    port: { type: "number" },
                    token: { type: "string" },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_control",
            description: "Swarm stop/resume & real-time agent status. Actions: stop, resume, status, pulse_update, pulse_get",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["stop", "resume", "status", "pulse_update", "pulse_get"] },
                    repoPath: { type: "string" },
                    reason: { type: "string" },
                    by: { type: "string" },
                    agent: { type: "string" },
                    currentFile: { type: "string" },
                    currentTask: { type: "string" },
                    status: { type: "string", enum: ["active", "idle", "paused", "offline"] },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        // === Tasks (2) ===
        {
            name: "swarm_task",
            description: "Task & briefing management. Actions: create, list, update, decompose, get_decomposition, briefing_save, briefing_load",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["create", "list", "update", "decompose", "get_decomposition", "briefing_save", "briefing_load"] },
                    repoPath: { type: "string" },
                    taskId: { type: "string" },
                    title: { type: "string" },
                    shortDesc: { type: "string" },
                    status: { type: "string", enum: ["open", "in_progress", "needs_review", "done", "canceled"] },
                    assignee: { type: "string" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_plan",
            description: "Implementation planning & spec pipeline. Actions: create, add, next, start, step, complete, prompt, export, status, list, ready, spec_start, spec_phase, spec_complete, spec_get, spec_list, spec_export",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    planId: { type: "string" },
                    taskId: { type: "string" },
                },
                required: ["action"],
            },
        },
        // === Files (2) ===
        {
            name: "swarm_file",
            description: "File locking, snapshots & conflict management. Actions: reserve, release, list, forecast, conflicts, safety, snapshot_create, snapshot_rollback, snapshot_list",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["reserve", "release", "list", "forecast", "conflicts", "safety", "snapshot_create", "snapshot_rollback", "snapshot_list"] },
                    repoPath: { type: "string" },
                    filePath: { type: "string" },
                    files: { type: "array", items: { type: "string" } },
                    agent: { type: "string" },
                    exclusive: { type: "boolean" },
                    ttlMs: { type: "number" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_worktree",
            description: "Git worktree & hooks management. Actions: create, list, remove, hooks_install, hooks_uninstall, hooks_run, hooks_config, hooks_update, hooks_list",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    agentName: { type: "string" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        // === Git (1) ===
        {
            name: "swarm_git",
            description: "Git operations & dependency management. Actions: sync, pr, health, cleanup, cleanup_all, dep_signal, dep_sync",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["sync", "pr", "health", "cleanup", "cleanup_all", "dep_signal", "dep_sync"] },
                    repoPath: { type: "string" },
                    title: { type: "string" },
                    body: { type: "string" },
                    draft: { type: "boolean" },
                    branch: { type: "string" },
                    baseBranch: { type: "string" },
                },
                required: ["action"],
            },
        },
        // === Collaboration (4) ===
        {
            name: "swarm_chat",
            description: "Team communication & code review. Actions: broadcast, dashboard, thought, thoughts, review_request, review_respond, review_list",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["broadcast", "dashboard", "thought", "thoughts", "review_request", "review_respond", "review_list"] },
                    repoPath: { type: "string" },
                    message: { type: "string" },
                    agent: { type: "string" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_voting",
            description: "Voting & task auction system. Actions: start, vote, list, get, auction_announce, auction_bid, auction_poll",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["start", "vote", "list", "get", "auction_announce", "auction_bid", "auction_poll"] },
                    repoPath: { type: "string" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
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
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_message",
            description: "Agent messaging & MCP scanner. Actions: send, inbox, ack, reply, search, thread, mcp_scan, mcp_authorize, mcp_policy",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["send", "inbox", "ack", "reply", "search", "thread", "mcp_scan", "mcp_authorize", "mcp_policy"] },
                    repoPath: { type: "string" },
                    from: { type: "string" },
                    to: {},
                    subject: { type: "string" },
                    body: { type: "string" },
                },
                required: ["action"],
            },
        },
        // === Security (1) ===
        {
            name: "swarm_defence",
            description: "AI security, immune system & consensus. Actions: scan, validate_agent, validate_tool, events, quarantine, release, stats, config, set_config, trust, untrust, clear_events, immune_alert, immune_resolve, immune_status, immune_test, immune_patrol, consensus_*",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    text: { type: "string" },
                    source: { type: "string" },
                },
                required: ["action"],
            },
        },
        // === Analytics (3) ===
        {
            name: "swarm_budget",
            description: "Budget analysis & cost tracking. Actions: analyze, models, select, recommend, route, log_usage, usage, stats, config, set_config, check, remaining, report, cost_log, cost_agent, cost_project, cost_limit, cost_remaining",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    agentId: { type: "string" },
                    taskId: { type: "string" },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_moe",
            description: "Mixture of Experts routing & SONA task assignment. Actions: route, feedback, experts, add_expert, remove_expert, config, set_config, stats, history, classify, reset, sona_route, sona_learn, sona_classify, sona_profile, sona_profiles, sona_specialists, sona_history, sona_stats, sona_config, sona_set_config, sona_reset",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    content: { type: "string" },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_quality",
            description: "Quality gates & regression tracking. Actions: run, report, threshold, pr_ready, regression_baseline, regression_check, regression_list, regression_resolve, regression_baselines",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        // === Intelligence (4) ===
        {
            name: "swarm_vector",
            description: "HNSW vector search. Actions: init, add, add_batch, search, get, delete, list, stats, config, set_config, clear, duplicates, embed",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    query: { type: "string" },
                    text: { type: "string" },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_booster",
            description: "Agent booster for quick tasks. Actions: execute, can_boost, stats, history, config, set_config, types",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_brain",
            description: "Brainstorming & systematic debugging. Actions: start, ask, answer, propose, present, validate, save, get, list, debug_start, debug_investigate, debug_evidence, debug_phase1, debug_patterns, debug_phase2, debug_hypothesis, debug_test, debug_fix, debug_verify, debug_get, debug_list, debug_redflags",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    sessionId: { type: "string" },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_context",
            description: "Context management, shared notes & batch processing. Actions: estimate, compress, compress_many, stats, pool_add, pool_get, pool_search_tag, pool_search, pool_helpful, pool_update, pool_cleanup, pool_stats, batch_queue, batch_config, batch_set_config, batch_job, batch_jobs, batch_result, batch_stats, batch_flush",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    text: { type: "string" },
                },
                required: ["action"],
            },
        },
        // === Infra (7) ===
        {
            name: "swarm_health",
            description: "Agent health monitoring & urgent preemption. Actions: check, dead, reassign, summary, preempt_trigger, preempt_resolve, preempt_active",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    agent: { type: "string" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_external",
            description: "External integrations & platform checks. Actions: enable_github, enable_linear, sync_github, sync_linear, sync_all, export_github, export_linear, status, create_issue, close_issue, comment, platform_request, platform_respond, platform_list",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_expertise",
            description: "Agent expertise tracking & smart routing. Actions: track, suggest, record, experts, list, route_record, route_find_agent, route_expertise, route_predict, route_auto_assign",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    agent: { type: "string" },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_knowledge",
            description: "Knowledge base, docs generation & advice. Actions: archive, search, docs_generate, docs_task_docs, docs_list, docs_get, advice_request, advice_provide, advice_list",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    query: { type: "string" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_session",
            description: "Session recording, timeline & screenshots. Actions: start, log, stop, list, replay, timeline_generate, timeline_visualize, screenshot_share, screenshot_list",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    agent: { type: "string" },
                    sessionId: { type: "string" },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_clusters",
            description: "Tool clusters & conflict prediction. Actions: init, list, tools, find, add, create, summary, conflict_predict, conflict_analyze, conflict_hotspots, conflict_record",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    commitMode: { type: "string", enum: ["none", "local", "push"] },
                },
                required: ["action"],
            },
        },
        {
            name: "swarm_telegram",
            description: "Telegram notifications & QA loops. Actions: setup, config, enable, disable, send, notify_task_created, notify_task_completed, notify_task_failed, notify_agent_joined, notify_agent_died, start_polling, stop_polling, command, qa_start, qa_iterate, qa_fix, qa_get, qa_list, qa_suggest, qa_report",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    repoPath: { type: "string" },
                    message: { type: "string" },
                },
                required: ["action"],
            },
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
            await registerProjectInTelegram(env.TELEGRAM_BOT_URL, telegramUserId, projectId, projectName);
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

function toolNeedsBridge(toolName: string, _args: Record<string, unknown>): boolean {
    // ALL swarm tools need local filesystem access via bridge companion.
    // The bridge's smart tool handlers provide full coverage of all 26 tools.
    return toolName.startsWith("swarm_");
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
        const action = args.action as string;
        if (action === "send" || action.startsWith("notify_")) {
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
