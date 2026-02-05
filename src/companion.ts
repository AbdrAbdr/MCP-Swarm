import { createRequire } from "node:module";
import http from "node:http";
import path from "node:path";

import { gitTry } from "./workflows/git.js";
import { getRepoRoot } from "./workflows/repo.js";
import { getStopState } from "./workflows/stopFlag.js";
import { whoami, registerAgent } from "./workflows/agentRegistry.js";
import { pollSwarmEvents } from "./workflows/auction.js";
import {
  tryBecomeOrchestrator,
  orchestratorHeartbeat,
  executorHeartbeat,
  fetchAgentInbox,
  acknowledgeMessage,
  type AgentRole,
} from "./workflows/orchestrator.js";
import { BridgeManager } from "./bridge.js";
import { getProjectIdSource } from "./workflows/projectId.js";

// ============ TELEGRAM BOT URL ============
// Set TELEGRAM_BOT_URL env variable to your deployed telegram-bot worker
const TELEGRAM_BOT_URL = process.env.TELEGRAM_BOT_URL || "";

/**
 * Register project in Telegram Bot for user notifications
 * Called when companion starts with TELEGRAM_USER_ID env variable
 */
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
    
    if (response.ok) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

type CompanionConfig = {
  repoPath?: string;
  project?: string;
  hubUrl?: string;
  mcpServerUrl?: string; // URL персонального MCP Server для Auto-Bridge
  pollSeconds?: number;
  controlPort?: number;
  controlToken?: string;
  hybridMode?: boolean; // WS primary, Git fallback
  forceOrchestratorMode?: boolean; // Always run as orchestrator (infinite loop)
};

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WS = require("ws") as any;

function getEnvConfig(): CompanionConfig {
  const pollSeconds = Number(process.env.SWARM_POLL_SECONDS ?? "10");
  const controlPort = Number(process.env.SWARM_CONTROL_PORT ?? "37373");
  const hybridMode = process.env.SWARM_HYBRID_MODE !== "false"; // default true
  const forceOrchestratorMode = process.env.SWARM_FORCE_ORCHESTRATOR === "true";
  return {
    repoPath: process.env.SWARM_REPO_PATH,
    project: process.env.SWARM_PROJECT ?? "default",
    hubUrl: process.env.SWARM_HUB_URL,
    mcpServerUrl: process.env.MCP_SERVER_URL, // Auto-Bridge к Remote MCP
    pollSeconds: Number.isFinite(pollSeconds) ? pollSeconds : 10,
    controlPort: Number.isFinite(controlPort) ? controlPort : 37373,
    controlToken: process.env.SWARM_CONTROL_TOKEN,
    hybridMode,
    forceOrchestratorMode,
  };
}

async function pullIfPossible(repoRoot: string) {
  await gitTry(["pull", "--ff-only"], { cwd: repoRoot });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Console colors for better visibility
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(level: "info" | "warn" | "error" | "success", message: string) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const colorMap = {
    info: colors.cyan,
    warn: colors.yellow,
    error: colors.red,
    success: colors.green,
  };
  const prefix = {
    info: "ℹ️",
    warn: "⚠️",
    error: "❌",
    success: "✅",
  };
  // eslint-disable-next-line no-console
  console.log(`${colorMap[level]}[${timestamp}] ${prefix[level]} ${message}${colors.reset}`);
}

async function run() {
  const cfg = getEnvConfig();
  const repoRoot = await getRepoRoot(cfg.repoPath);

  // ============ SMART PROJECT ID ============
  const projectInfo = await getProjectIdSource(repoRoot);
  const projectId = projectInfo.id;
  log("info", `📁 Project ID: ${colors.bright}${projectId}${colors.reset} (source: ${projectInfo.source})`);

  // ============ TELEGRAM REGISTRATION ============
  // If TELEGRAM_USER_ID is set, register this project for the user
  const telegramUserId = process.env.TELEGRAM_USER_ID;
  if (telegramUserId) {
    const projectName = path.basename(repoRoot);
    const registered = await registerProjectInTelegram(telegramUserId, projectId, projectName);
    if (registered) {
      log("success", `📱 Project registered in Telegram for user ${telegramUserId}`);
    } else {
      log("warn", `📱 Failed to register project in Telegram (will retry later)`);
    }
  }

  // Register agent if not already registered
  let me = await whoami(repoRoot);
  if (!me.agent) {
    const platform = process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "macOS" : "Linux";
    const registered = await registerAgent({ repoPath: repoRoot, commitMode: "push" });
    me = await whoami(repoRoot);
    log("success", `Agent registered: ${registered.agent.agentName} (${platform})`);
  }

  const agentName = me.agent?.agentName ?? "UnknownAgent";
  const agentId = me.agent?.agentId ?? `agent-${Date.now()}`;
  const platform = process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "macOS" : "Linux";

  log("info", `Starting companion for agent: ${colors.bright}${agentName}${colors.reset}`);

  // ============ ORCHESTRATOR ELECTION ============
  // First agent to start becomes ORCHESTRATOR, others become EXECUTORS
  const electionResult = await tryBecomeOrchestrator({
    repoPath: repoRoot,
    agentId,
    agentName,
    platform,
  });

  let role: AgentRole = electionResult.role;
  const isOrchestrator = electionResult.isOrchestrator;

  if (isOrchestrator) {
    log("success", `🎯 ${colors.bright}ORCHESTRATOR MODE${colors.reset} - Running in INFINITE LOOP`);
    log("info", "Orchestrator will coordinate all other agents and never stop automatically");
  } else {
    log("info", `👷 ${colors.bright}EXECUTOR MODE${colors.reset} - Orchestrator: ${electionResult.orchestratorName}`);
    log("info", "Executor will follow orchestrator's commands");
  }

  const hubUrl = cfg.hubUrl;
  const pollMs = Math.max(2, cfg.pollSeconds ?? 10) * 1000;
  const controlPort = cfg.controlPort ?? 37373;
  const controlToken = cfg.controlToken;

  let ws: any | null = null;
  let stop = false;
  let paused = false;

  // ============ AUTO-BRIDGE ============
  // Если задан MCP_SERVER_URL, автоматически подключаемся к Remote MCP
  let bridgeManager: BridgeManager | null = null;
  if (cfg.mcpServerUrl) {
    log("info", `🌉 Auto-Bridge enabled: ${cfg.mcpServerUrl}`);
    bridgeManager = new BridgeManager({
      mcpServerUrl: cfg.mcpServerUrl,
      projects: [repoRoot],
    });
    bridgeManager.start().catch(err => {
      log("error", `Bridge start failed: ${err.message}`);
    });
  }

  function checkToken(req: http.IncomingMessage): boolean {
    if (!controlToken) return true;
    const header = req.headers["x-swarm-token"];
    if (typeof header === "string" && header === controlToken) return true;
    return false;
  }

  const controlServer = http.createServer((req, res) => {
    if (!req.url || !req.method) {
      res.statusCode = 400;
      res.end("bad request");
      return;
    }

    if (!checkToken(req)) {
      res.statusCode = 403;
      res.end("forbidden");
      return;
    }

    if (req.method === "POST" && req.url === "/stop") {
      // ORCHESTRATOR CANNOT BE STOPPED VIA API - only user can stop
      if (isOrchestrator) {
        log("warn", "Received stop command but ORCHESTRATOR ignores API stops. Use 'stop' in terminal.");
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: false, message: "Orchestrator cannot be stopped via API. Use terminal." }));
        return;
      }
      stop = true;
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, stop: true }));
      return;
    }

    if (req.method === "POST" && req.url === "/pause") {
      paused = true;
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, paused: true }));
      return;
    }

    if (req.method === "POST" && req.url === "/resume") {
      paused = false;
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, paused: false }));
      return;
    }

    if (req.method === "GET" && req.url === "/status") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        stop,
        paused,
        agentName,
        role,
        isOrchestrator,
        bridge: bridgeManager?.getStatus() ?? null,
      }));
      return;
    }

    // ============ BRIDGE AUTO-ADD ============
    // POST /bridge/add?project=/path/to/project
    if (req.method === "POST" && req.url?.startsWith("/bridge/add")) {
      const url = new URL(req.url, `http://localhost:${controlPort}`);
      const projectPath = url.searchParams.get("project");

      if (!projectPath) {
        res.statusCode = 400;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: false, error: "Missing ?project= parameter" }));
        return;
      }

      if (!bridgeManager) {
        res.statusCode = 400;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: false, error: "Bridge not enabled. Set MCP_SERVER_URL env." }));
        return;
      }

      log("info", `🌉 Auto-adding project: ${projectPath}`);
      bridgeManager.addProject(projectPath).then(() => {
        log("success", `🌉 Project added: ${projectPath}`);
      }).catch(err => {
        log("error", `🌉 Failed to add project: ${err.message}`);
      });

      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, added: projectPath }));
      return;
    }

    // GET /bridge/status
    if (req.method === "GET" && req.url === "/bridge/status") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        enabled: !!bridgeManager,
        projects: bridgeManager?.getStatus() ?? {},
      }));
      return;
    }

    // POST /bridge/remove?project=/path/to/project
    if (req.method === "POST" && req.url?.startsWith("/bridge/remove")) {
      const url = new URL(req.url, `http://localhost:${controlPort}`);
      const projectPath = url.searchParams.get("project");

      if (!projectPath || !bridgeManager) {
        res.statusCode = 400;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: false, error: "Missing project or bridge not enabled" }));
        return;
      }

      bridgeManager.removeProject(projectPath);
      log("info", `🌉 Project removed: ${projectPath}`);

      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, removed: projectPath }));
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  await new Promise<void>((resolve, reject) => {
    controlServer.once("error", reject);
    controlServer.listen(controlPort, "127.0.0.1", () => resolve());
  });

  log("info", `Control server listening on http://127.0.0.1:${controlPort}`);

  // stdin control: type "stop" / "pause" / "resume"
  // IMPORTANT: Only terminal "stop" can stop ORCHESTRATOR
  if (process.stdin.isTTY) {
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      const cmd = chunk.trim().toLowerCase();
      if (cmd === "stop" || cmd === "exit" || cmd === "quit") {
        if (isOrchestrator) {
          log("warn", "⛔ ORCHESTRATOR STOP REQUESTED BY USER");
          log("info", "Stopping orchestrator...");
        }
        stop = true;
      }
      if (cmd === "pause") {
        paused = true;
        log("info", "Companion paused");
      }
      if (cmd === "resume" || cmd === "start") {
        paused = false;
        log("info", "Companion resumed");
      }
      if (cmd === "status") {
        log("info", `Role: ${role}, Paused: ${paused}, Stop: ${stop}`);
      }
      if (cmd === "help") {
        log("info", "Commands: stop, pause, resume, status, help");
      }
    });
  }

  async function connectWs() {
    if (!hubUrl) return;

    const url = new URL(hubUrl);
    url.searchParams.set("project", projectId); // Use smart projectId instead of cfg.project
    url.searchParams.set("agent", agentName);

    ws = new WS(url.toString());

    ws.on("open", () => {
      ws?.send(JSON.stringify({ kind: "hello", agent: agentName, role, ts: Date.now() }));
      log("success", "Connected to WebSocket hub");
    });

    ws.on("close", () => {
      ws = null;
      log("warn", "WebSocket connection closed");
    });

    ws.on("message", (data: unknown) => {
      const text = typeof data === "string" ? data : Buffer.from(data as any).toString();
      try {
        const msg = JSON.parse(text);
        if (msg?.kind === "stop") {
          // Only non-orchestrator can be stopped via WS
          if (!isOrchestrator) {
            stop = true;
          }
        }

        // ============ AUTO-DETECT PROJECTS ============
        // Если пришёл event с новым repoPath — автоматически подключаем bridge
        if (bridgeManager && msg?.payload?.repoPath) {
          const eventRepoPath = msg.payload.repoPath as string;
          const status = bridgeManager.getStatus();
          if (!status[eventRepoPath]) {
            log("info", `🔍 Auto-detected new project: ${eventRepoPath}`);
            bridgeManager.addProject(eventRepoPath).catch(err => {
              log("error", `🌉 Failed to auto-add: ${err.message}`);
            });
          }
        }
      } catch {
        // ignore
      }
    });
  }

  await connectWs();

  // Hybrid Transport: track last event timestamp for Git fallback
  let lastEventTs = Date.now();
  let wsConnected = false;
  let wsFailCount = 0;
  const maxWsFailCount = 3;
  let loopCount = 0;
  let lastInboxCheck = 0;
  const inboxCheckInterval = 30_000; // Check inbox every 30 seconds

  log("info", "Entering main loop...");
  log("info", isOrchestrator
    ? "🔄 INFINITE LOOP MODE - Type 'stop' to exit"
    : "🔄 EXECUTOR MODE - Will stop when orchestrator stops or task complete");

  // ============ MAIN LOOP ============
  // ORCHESTRATOR runs FOREVER until user types "stop"
  // EXECUTOR runs until stopped or task complete
  while (true) {
    loopCount++;

    // ONLY terminal stop can stop orchestrator
    if (stop) {
      if (isOrchestrator) {
        log("warn", "Orchestrator stopping by user command...");
      }
      break;
    }

    if (paused) {
      await sleep(pollMs);
      continue;
    }

    // Always pull Git (for STOP.json and other files)
    await pullIfPossible(repoRoot);

    // Check STOP.json - but ORCHESTRATOR ignores it unless user explicitly stopped
    const stopState = await getStopState(repoRoot);
    if (stopState.state.stopped && !isOrchestrator) {
      log("info", "Stop flag detected in Git, stopping executor...");
      break;
    }

    // ============ HEARTBEAT ============
    if (isOrchestrator) {
      await orchestratorHeartbeat({ repoPath: repoRoot, agentId });
    } else {
      await executorHeartbeat({ repoPath: repoRoot, agentId });
    }

    // ============ CHECK INBOX ============
    const now = Date.now();
    if (now - lastInboxCheck > inboxCheckInterval) {
      lastInboxCheck = now;

      try {
        const inbox = await fetchAgentInbox({
          repoPath: repoRoot,
          agentName,
          limit: 10,
          urgentOnly: false,
        });

        if (inbox.unread > 0) {
          log("info", `📬 ${inbox.unread} unread message(s) in inbox`);

          // Auto-acknowledge urgent messages for orchestrator
          for (const msg of inbox.messages) {
            if (msg.importance === "urgent" && !msg.acknowledged) {
              log("warn", `🚨 URGENT: ${msg.subject} from ${msg.from}`);
              if (msg.ackRequired) {
                await acknowledgeMessage({
                  repoPath: repoRoot,
                  agentName,
                  messageId: msg.id,
                });
              }
            }
          }
        }
      } catch {
        // Ignore inbox errors
      }
    }

    // ============ WEBSOCKET ============
    wsConnected = ws && ws.readyState === 1;

    if (wsConnected) {
      // WS is primary - just heartbeat
      ws.send(JSON.stringify({ kind: "ping", agent: agentName, role, ts: Date.now() }));
      wsFailCount = 0;
    } else if (hubUrl) {
      // Try to reconnect WS
      wsFailCount++;
      if (wsFailCount <= maxWsFailCount) {
        await connectWs();
      }
    }

    // ============ GIT FALLBACK ============
    if (cfg.hybridMode && (!wsConnected || wsFailCount > maxWsFailCount)) {
      try {
        const { events } = await pollSwarmEvents({ repoPath: repoRoot, since: lastEventTs });
        for (const ev of events) {
          // Process events from Git
          if (ev.type === "emergency_stop" || ev.type === "agent_frozen") {
            const payload = ev.payload as any;
            // Orchestrator ignores emergency stop unless specifically targeted
            if (!isOrchestrator && (!payload?.agent || payload.agent === agentName)) {
              stop = true;
              break;
            }
          }
          if (ev.type === "task_announced") {
            // Could auto-bid here in future
            if (!isOrchestrator) {
              log("info", `📢 New task announced: ${(ev.payload as any)?.taskId}`);
            }
          }
          lastEventTs = Math.max(lastEventTs, ev.ts);
        }
      } catch {
        // ignore poll errors
      }
    }

    // ============ PERIODIC STATUS ============
    if (loopCount % 60 === 0) { // Every ~10 minutes at 10s poll
      log("info", `Still running... Loop #${loopCount}, Role: ${role}`);
    }

    await sleep(pollMs);
  }

  // ============ CLEANUP ============
  if (bridgeManager) {
    bridgeManager.stop();
    log("info", "🌉 Bridge stopped");
  }

  if (ws) {
    try {
      ws.close();
    } catch {
      // ignore
    }
  }

  try {
    controlServer.close();
  } catch {
    // ignore
  }

  log("info", `Companion stopped for agent ${agentName} (${role})`);
}

run().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
