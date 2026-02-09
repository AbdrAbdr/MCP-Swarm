#!/usr/bin/env node
/**
 * MCP Swarm Remote Proxy
 * 
 * Connects to a remote MCP Swarm server via Streamable HTTP transport.
 * Translates stdio <-> HTTP POST for IDE compatibility.
 * 
 * Features:
 * - Auto-starts companion daemon if not running
 * - Translates stdio to HTTP
 * - Session management
 * 
 * Usage:
 *   npx mcp-swarm-remote --url https://your-server.workers.dev/mcp
 *   
 * Or in MCP config:
 *   {
 *     "mcpServers": {
 *       "mcp-swarm": {
 *         "command": "npx",
 *         "args": ["mcp-swarm-remote", "--url", "https://your-server.workers.dev/mcp"]
 *       }
 *     }
 *   }
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
let serverUrl: string | null = null;
let telegramUserId: string | null = null;
let sessionId: string | null = null;
let debug = false;
let noCompanion = false;

for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
        serverUrl = args[i + 1];
        i++;
    } else if (args[i] === "--telegram-user-id" && args[i + 1]) {
        telegramUserId = args[i + 1];
        i++;
    } else if (args[i] === "--debug") {
        debug = true;
    } else if (args[i] === "--no-companion") {
        noCompanion = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
        console.error(`
MCP Swarm Remote - Connect to your Cloudflare MCP Server

Usage: npx mcp-swarm-remote --url <your-server-url> [options]

Required:
  --url <url>              Your MCP server URL (deploy cloudflare/mcp-server first)
                           Example: https://mcp-swarm-server.myaccount.workers.dev/mcp

Options:
  --telegram-user-id <id>  Your Telegram User ID for notifications
  --no-companion           Don't auto-start companion daemon
  --debug                  Enable debug logging

Setup instructions:
  https://github.com/AbdrAbdr/Swarm_MCP#-cloudflare-workers--its-free
`);
        process.exit(0);
    }
}

if (!serverUrl) {
    console.error(`
ERROR: --url is required!

You must deploy your own Cloudflare MCP Server first.
See: https://github.com/AbdrAbdr/Swarm_MCP#-cloudflare-workers--its-free

Usage: npx mcp-swarm-remote --url https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp
`);
    process.exit(1);
}

// Log to stderr (for debugging)
function log(message: string): void {
    if (debug) {
        process.stderr.write(`[mcp-swarm-remote] ${message}\n`);
    }
}

function logError(message: string): void {
    process.stderr.write(`[mcp-swarm-remote] ERROR: ${message}\n`);
}

// Check if companion is running
async function isCompanionRunning(): Promise<boolean> {
    try {
        const response = await fetch("http://localhost:37373/health", {
            method: "GET",
            signal: AbortSignal.timeout(2000),
        });
        return response.ok;
    } catch {
        return false;
    }
}

// Start companion daemon in background
async function startCompanion(): Promise<void> {
    const companionPath = join(__dirname, "..", "companion.js");

    log(`Starting companion daemon: ${companionPath}`);

    const child = spawn("node", [companionPath], {
        detached: true,
        stdio: "ignore",
        env: {
            ...process.env,
            MCP_SERVER_URL: serverUrl!, // Auto-Bridge: передаём URL сервера для подключения бриджа
        },
    });

    child.unref();

    // Wait a bit for companion to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify it started
    if (await isCompanionRunning()) {
        log("Companion daemon started successfully (bridge enabled)");
    } else {
        log("Warning: Companion daemon may not have started correctly");
    }
}

// Ensure companion is running
async function ensureCompanion(): Promise<void> {
    if (noCompanion) {
        log("Companion auto-start disabled");
        return;
    }

    const running = await isCompanionRunning();
    if (running) {
        log("Companion daemon already running");
        return;
    }

    log("Companion daemon not running, starting...");
    await startCompanion();
}

// Build full URL with query params
function buildUrl(): string {
    const url = new URL(serverUrl!); // serverUrl is validated above
    if (telegramUserId) {
        url.searchParams.set("telegram_user_id", telegramUserId);
    }
    return url.toString();
}

// Send JSON-RPC request to remote server
async function sendRequest(request: unknown): Promise<unknown> {
    const reqObj = request as { id?: string | number; method?: string };
    const requestId = reqObj?.id ?? null;

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-03-26",
    };

    if (sessionId) {
        headers["Mcp-Session-Id"] = sessionId;
    }

    try {
        log(`Sending request: ${JSON.stringify(request)}`);

        const response = await fetch(buildUrl(), {
            method: "POST",
            headers,
            body: JSON.stringify(request),
            signal: AbortSignal.timeout(30000),
        });

        // Extract session ID from response headers
        const newSessionId = response.headers.get("Mcp-Session-Id");
        if (newSessionId) {
            sessionId = newSessionId;
            log(`Session ID: ${sessionId}`);
        }

        // Handle different response types
        const contentType = response.headers.get("Content-Type") || "";

        if (response.status === 202) {
            // Notification acknowledged, no response body
            return null;
        }

        // Check for HTTP errors before parsing
        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            logError(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
            return {
                jsonrpc: "2.0",
                id: requestId,
                error: {
                    code: -32000,
                    message: `Server error HTTP ${response.status}: ${errorText.slice(0, 200)}`,
                },
            };
        }

        if (contentType.includes("application/json")) {
            const result = await response.json();
            log(`Received response: ${JSON.stringify(result)}`);
            // Ensure jsonrpc field is present
            return ensureJsonRpc(result, requestId);
        }

        if (contentType.includes("text/event-stream")) {
            // Parse SSE response (for streaming responses)
            const text = await response.text();
            const lines = text.split("\n");
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const parsed = JSON.parse(line.slice(6));
                        return ensureJsonRpc(parsed, requestId);
                    } catch {
                        // Continue to next line
                    }
                }
            }
        }

        // Fallback: try to parse as JSON
        const text = await response.text();
        try {
            const parsed = JSON.parse(text);
            return ensureJsonRpc(parsed, requestId);
        } catch {
            logError(`Non-JSON response: ${text.slice(0, 200)}`);
            return {
                jsonrpc: "2.0",
                id: requestId,
                error: { code: -32000, message: `Unexpected non-JSON response from server` },
            };
        }
    } catch (error) {
        logError(`Connection error: ${error instanceof Error ? error.message : String(error)}`);
        return {
            jsonrpc: "2.0",
            id: requestId,
            error: {
                code: -32000,
                message: `Connection error: ${error instanceof Error ? error.message : String(error)}`,
            },
        };
    }
}

// Ensure response has jsonrpc: "2.0" field (IDE requirement)
function ensureJsonRpc(response: unknown, fallbackId: unknown): unknown {
    if (response && typeof response === "object") {
        const obj = response as Record<string, unknown>;
        if (!obj.jsonrpc) {
            obj.jsonrpc = "2.0";
        }
        if (obj.id === undefined && fallbackId !== undefined) {
            obj.id = fallbackId;
        }
        return obj;
    }
    return { jsonrpc: "2.0", id: fallbackId, error: { code: -32000, message: "Invalid response format" } };
}

// Write JSON-RPC response to stdout
function writeResponse(response: unknown): void {
    if (response !== null) {
        const json = JSON.stringify(response);
        process.stdout.write(json + "\n");
        log(`Wrote response: ${json}`);
    }
}

// Process a single line of input
async function processLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
        const request = JSON.parse(trimmed);
        const response = await sendRequest(request);
        writeResponse(response);
    } catch (error) {
        writeResponse({
            jsonrpc: "2.0",
            id: null,
            error: {
                code: -32700,
                message: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
            },
        });
    }
}

// Main entry point - robust stdin handling for Windows
async function main(): Promise<void> {
    log(`Starting MCP Swarm Remote Proxy`);
    log(`Server URL: ${serverUrl}`);
    if (telegramUserId) {
        log(`Telegram User ID: ${telegramUserId}`);
    }

    // Ensure companion daemon is running for local file operations
    await ensureCompanion();

    // Set up stdin for reading
    process.stdin.setEncoding("utf8");

    let buffer = "";
    let isProcessing = false;
    const pendingLines: string[] = [];

    // Process lines sequentially to maintain order
    async function processNext(): Promise<void> {
        if (isProcessing || pendingLines.length === 0) return;

        isProcessing = true;
        const line = pendingLines.shift()!;

        try {
            await processLine(line);
        } catch (error) {
            logError(`Error processing line: ${error}`);
        }

        isProcessing = false;

        // Process next line if available
        if (pendingLines.length > 0) {
            setImmediate(processNext);
        }
    }

    // Handle incoming data
    process.stdin.on("data", (chunk: string) => {
        log(`Received chunk: ${chunk.length} bytes`);
        buffer += chunk;

        // Split by newlines and process complete lines
        const lines = buffer.split("\n");

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        // Queue complete lines for processing
        for (const line of lines) {
            if (line.trim()) {
                pendingLines.push(line);
            }
        }

        // Start processing
        processNext();
    });

    // Handle stdin end
    process.stdin.on("end", () => {
        log("stdin ended");

        // Process any remaining data in buffer
        if (buffer.trim()) {
            pendingLines.push(buffer);
            processNext();
        }

        // Wait for all pending requests to complete
        const checkComplete = setInterval(() => {
            if (pendingLines.length === 0 && !isProcessing) {
                clearInterval(checkComplete);
                log("All requests processed, exiting");
                process.exit(0);
            }
        }, 100);
    });

    // Handle stdin errors
    process.stdin.on("error", (error) => {
        logError(`stdin error: ${error.message}`);
    });

    // Handle process signals
    process.on("SIGINT", () => {
        log("Interrupted");
        process.exit(0);
    });

    process.on("SIGTERM", () => {
        log("Terminated");
        process.exit(0);
    });

    // Resume stdin (important for piped input on Windows)
    process.stdin.resume();

    log("Ready for input");
}

main().catch((error) => {
    logError(`Fatal error: ${error}`);
    process.exit(1);
});
