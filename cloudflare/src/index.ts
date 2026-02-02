/// <reference types="@cloudflare/workers-types" />

export interface Env {
  SWARM_ROOM: DurableObjectNamespace;
  GITHUB_WEBHOOK_SECRET?: string;
}

type SwarmEvent = {
  id: string;
  ts: number;
  type: string;
  payload: unknown;
};

type TaskClaim = {
  taskId: string;
  agent: string;
  ts: number;
};

type FileLock = {
  path: string;
  agent: string;
  exclusive: boolean;
  exp: number;
};

type AuctionBid = {
  taskId: string;
  agent: string;
  capabilities: string[];
  ts: number;
};

type AgentActivity = {
  agent: string;
  lastPing: number;
  actionsLast5Min: number;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const project = url.searchParams.get("project") || "default";
    const id = env.SWARM_ROOM.idFromName(project);
    const stub = env.SWARM_ROOM.get(id);

    if (url.pathname === "/ws") return stub.fetch(request);
    if (url.pathname === "/github/webhook") return stub.fetch(request);
    if (url.pathname.startsWith("/api/")) return stub.fetch(request);

    return new Response("MCP Swarm Hub v0.7", { status: 200 });
  },
};

export class SwarmRoom {
  private state: DurableObjectState;
  private sockets: Map<WebSocket, string> = new Map(); // ws -> agentName
  private agentActivity: Map<string, AgentActivity> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const agent = url.searchParams.get("agent") || "unknown";
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      await this.handleSession(server, agent);
      return new Response(null, { status: 101, webSocket: client });
    }

    // GitHub webhook
    if (url.pathname === "/github/webhook") {
      const body = await request.text();
      const eventType = request.headers.get("x-github-event") || "unknown";
      await this.appendEvent({ type: `github.${eventType}`, payload: { raw: body } });
      await this.broadcast({ kind: "event", type: `github.${eventType}` });
      return new Response("ok");
    }

    // REST API endpoints
    if (url.pathname === "/api/state") {
      const leader = await this.state.storage.get<string>("leader");
      const policy = await this.state.storage.get<string[]>("authorized_mcps");
      return Response.json({ leader: leader || null, authorizedMcps: policy || [] });
    }

    if (url.pathname === "/api/events" && request.method === "GET") {
      const since = Number(url.searchParams.get("since") || "0");
      const events = await this.getEventsSince(since);
      return Response.json({ events });
    }

    if (url.pathname === "/api/claim_task" && request.method === "POST") {
      const body = await request.json() as { taskId: string; agent: string };
      const result = await this.claimTask(body.taskId, body.agent);
      return Response.json(result);
    }

    if (url.pathname === "/api/release_task" && request.method === "POST") {
      const body = await request.json() as { taskId: string; agent: string };
      await this.releaseTask(body.taskId, body.agent);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/lock_file" && request.method === "POST") {
      const body = await request.json() as { path: string; agent: string; exclusive: boolean; ttlMs?: number };
      const result = await this.lockFile(body.path, body.agent, body.exclusive, body.ttlMs || 60000);
      return Response.json(result);
    }

    if (url.pathname === "/api/unlock_file" && request.method === "POST") {
      const body = await request.json() as { path: string; agent: string };
      await this.unlockFile(body.path, body.agent);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/announce_task" && request.method === "POST") {
      const body = await request.json() as { taskId: string; title: string; requiredCapabilities?: string[] };
      await this.announceTask(body.taskId, body.title, body.requiredCapabilities || []);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/bid_task" && request.method === "POST") {
      const body = await request.json() as { taskId: string; agent: string; capabilities: string[] };
      await this.bidTask(body.taskId, body.agent, body.capabilities);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/resolve_auction" && request.method === "POST") {
      const body = await request.json() as { taskId: string };
      const winner = await this.resolveAuction(body.taskId);
      return Response.json({ winner });
    }

    if (url.pathname === "/api/authorize_mcps" && request.method === "POST") {
      const body = await request.json() as { mcps: string[] };
      await this.authorizeMcps(body.mcps);
      return Response.json({ ok: true, mcps: body.mcps });
    }

    if (url.pathname === "/api/broadcast" && request.method === "POST") {
      const body = await request.json() as { message: string; channel?: string };
      await this.broadcastChat(body.message, body.channel || "chat");
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/freeze_agent" && request.method === "POST") {
      const body = await request.json() as { agent: string; reason: string };
      await this.freezeAgent(body.agent, body.reason);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/unfreeze_agent" && request.method === "POST") {
      const body = await request.json() as { agent: string };
      await this.unfreezeAgent(body.agent);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/check_frozen" && request.method === "GET") {
      const agent = url.searchParams.get("agent") || "";
      const frozen = await this.isFrozen(agent);
      return Response.json({ frozen });
    }

    if (url.pathname === "/api/report_activity" && request.method === "POST") {
      const body = await request.json() as { agent: string; actions: number };
      const anomaly = await this.reportActivity(body.agent, body.actions);
      return Response.json({ anomaly });
    }

    // v0.4 API endpoints
    if (url.pathname === "/api/pulse" && request.method === "GET") {
      const pulse = await this.getSwarmPulse();
      return Response.json(pulse);
    }

    if (url.pathname === "/api/pulse" && request.method === "POST") {
      const body = await request.json() as { agent: string; platform: string; branch: string; currentFile?: string; currentTask?: string; status: string };
      await this.updatePulse(body);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/urgent" && request.method === "POST") {
      const body = await request.json() as { taskId: string; title: string; reason: string; initiator: string; affectedFiles: string[] };
      const result = await this.triggerUrgent(body);
      return Response.json(result);
    }

    if (url.pathname === "/api/urgent" && request.method === "GET") {
      const urgent = await this.getActiveUrgent();
      return Response.json({ urgent });
    }

    if (url.pathname === "/api/urgent/resolve" && request.method === "POST") {
      const body = await request.json() as { urgentId: string };
      await this.resolveUrgent(body.urgentId);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/timeline" && request.method === "GET") {
      const since = Number(url.searchParams.get("since") || "0");
      const timeline = await this.getTimeline(since);
      return Response.json({ timeline });
    }

    if (url.pathname === "/api/knowledge" && request.method === "POST") {
      const body = await request.json() as { agent: string; category: string; title: string; description: string; solution?: string };
      const id = await this.addKnowledge(body);
      return Response.json({ id });
    }

    if (url.pathname === "/api/knowledge" && request.method === "GET") {
      const query = url.searchParams.get("q") || "";
      const entries = await this.searchKnowledge(query);
      return Response.json({ entries });
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handleSession(ws: WebSocket, agent: string) {
    ws.accept();
    this.sockets.set(ws, agent);

    ws.addEventListener("message", async (evt: MessageEvent) => {
      const text = typeof evt.data === "string" ? evt.data : "";
      if (!text) return;

      let msg: any;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }

      const frozen = await this.isFrozen(agent);
      if (frozen && msg?.kind !== "ping") {
        ws.send(JSON.stringify({ kind: "error", error: "agent_frozen" }));
        return;
      }

      if (msg?.kind === "ping") {
        ws.send(JSON.stringify({ kind: "pong", ts: Date.now() }));
        return;
      }

      if (msg?.kind === "try_leader") {
        const ok = await this.tryBecomeLeader(agent);
        ws.send(JSON.stringify({ kind: "leader_result", ok }));
        return;
      }

      if (msg?.kind === "claim_task") {
        const result = await this.claimTask(String(msg.taskId), agent);
        ws.send(JSON.stringify({ kind: "claim_result", ...result }));
        return;
      }

      if (msg?.kind === "release_task") {
        await this.releaseTask(String(msg.taskId), agent);
        ws.send(JSON.stringify({ kind: "release_result", ok: true }));
        return;
      }

      if (msg?.kind === "lock_file") {
        const result = await this.lockFile(String(msg.path), agent, !!msg.exclusive, msg.ttlMs || 60000);
        ws.send(JSON.stringify({ kind: "lock_result", ...result }));
        return;
      }

      if (msg?.kind === "unlock_file") {
        await this.unlockFile(String(msg.path), agent);
        ws.send(JSON.stringify({ kind: "unlock_result", ok: true }));
        return;
      }

      if (msg?.kind === "announce_task") {
        await this.announceTask(String(msg.taskId), String(msg.title), msg.capabilities || []);
        ws.send(JSON.stringify({ kind: "announce_result", ok: true }));
        return;
      }

      if (msg?.kind === "bid_task") {
        await this.bidTask(String(msg.taskId), agent, msg.capabilities || []);
        ws.send(JSON.stringify({ kind: "bid_result", ok: true }));
        return;
      }

      if (msg?.kind === "broadcast") {
        await this.broadcastChat(String(msg.message), msg.channel || "chat");
        return;
      }

      if (msg?.kind === "event") {
        await this.appendEvent({ type: String(msg.type || "custom"), payload: msg.payload });
        await this.broadcast(msg);
        return;
      }
    });

    ws.addEventListener("close", () => {
      this.sockets.delete(ws);
    });

    const policy = await this.state.storage.get<string[]>("authorized_mcps");
    ws.send(JSON.stringify({ kind: "hello", ts: Date.now(), authorizedMcps: policy || [] }));
  }

  private async broadcast(obj: unknown) {
    const payload = JSON.stringify(obj);
    for (const [ws] of this.sockets) {
      try {
        ws.send(payload);
      } catch {
        this.sockets.delete(ws);
      }
    }
  }

  private async broadcastToAgent(agent: string, obj: unknown) {
    const payload = JSON.stringify(obj);
    for (const [ws, a] of this.sockets) {
      if (a === agent) {
        try {
          ws.send(payload);
        } catch {
          this.sockets.delete(ws);
        }
      }
    }
  }

  private async appendEvent(input: { type: string; payload: unknown }) {
    const ts = Date.now();
    const id = crypto.randomUUID();
    const ev: SwarmEvent = { id, ts, type: input.type, payload: input.payload };
    const key = `event:${ts}:${id}`;
    await this.state.storage.put(key, ev);
  }

  private async getEventsSince(since: number): Promise<SwarmEvent[]> {
    const all = await this.state.storage.list<SwarmEvent>({ prefix: "event:" });
    const events: SwarmEvent[] = [];
    for (const [, ev] of all) {
      if (ev.ts > since) events.push(ev);
    }
    events.sort((a, b) => a.ts - b.ts);
    return events.slice(-500);
  }

  private async tryBecomeLeader(agent: string): Promise<boolean> {
    const now = Date.now();
    const leaseKey = "leader_lease";
    const current = await this.state.storage.get<{ agent: string; exp: number }>(leaseKey);
    if (current && current.exp > now && current.agent !== agent) return false;

    const next = { agent, exp: now + 30_000 };
    await this.state.storage.put(leaseKey, next);
    await this.state.storage.put("leader", agent);
    await this.broadcast({ kind: "leader_changed", agent, ts: now });
    return true;
  }

  // ==================== TASK CLAIM (Anti-duplication) ====================
  private async claimTask(taskId: string, agent: string): Promise<{ ok: boolean; claimedBy?: string }> {
    const key = `task_claim:${taskId}`;
    const existing = await this.state.storage.get<TaskClaim>(key);
    if (existing && existing.agent !== agent) {
      return { ok: false, claimedBy: existing.agent };
    }
    const claim: TaskClaim = { taskId, agent, ts: Date.now() };
    await this.state.storage.put(key, claim);
    await this.broadcast({ kind: "task_claimed", taskId, agent, ts: claim.ts });
    return { ok: true };
  }

  private async releaseTask(taskId: string, agent: string) {
    const key = `task_claim:${taskId}`;
    const existing = await this.state.storage.get<TaskClaim>(key);
    if (existing && existing.agent === agent) {
      await this.state.storage.delete(key);
      await this.broadcast({ kind: "task_released", taskId, agent, ts: Date.now() });
    }
  }

  // ==================== FILE LOCKS (1 writer, many readers) ====================
  private async lockFile(path: string, agent: string, exclusive: boolean, ttlMs: number): Promise<{ ok: boolean; lockedBy?: string }> {
    const key = `file_lock:${path}`;
    const now = Date.now();
    const existing = await this.state.storage.get<FileLock>(key);

    if (existing && existing.exp > now) {
      if (existing.exclusive) {
        if (existing.agent !== agent) return { ok: false, lockedBy: existing.agent };
      } else if (exclusive) {
        return { ok: false, lockedBy: existing.agent };
      }
    }

    const lock: FileLock = { path, agent, exclusive, exp: now + ttlMs };
    await this.state.storage.put(key, lock);
    await this.broadcast({ kind: "file_locked", path, agent, exclusive, ts: now });
    return { ok: true };
  }

  private async unlockFile(path: string, agent: string) {
    const key = `file_lock:${path}`;
    const existing = await this.state.storage.get<FileLock>(key);
    if (existing && existing.agent === agent) {
      await this.state.storage.delete(key);
      await this.broadcast({ kind: "file_unlocked", path, agent, ts: Date.now() });
    }
  }

  // ==================== AUCTION ====================
  private async announceTask(taskId: string, title: string, requiredCapabilities: string[]) {
    const key = `auction:${taskId}`;
    await this.state.storage.put(key, { taskId, title, requiredCapabilities, bids: [], ts: Date.now() });
    await this.broadcast({ kind: "task_announced", taskId, title, requiredCapabilities, ts: Date.now() });
  }

  private async bidTask(taskId: string, agent: string, capabilities: string[]) {
    const key = `auction:${taskId}`;
    const auction = await this.state.storage.get<{ bids: AuctionBid[] }>(key);
    if (!auction) return;

    const bid: AuctionBid = { taskId, agent, capabilities, ts: Date.now() };
    auction.bids.push(bid);
    await this.state.storage.put(key, auction);
    await this.broadcast({ kind: "task_bid", taskId, agent, ts: bid.ts });
  }

  private async resolveAuction(taskId: string): Promise<string | null> {
    const key = `auction:${taskId}`;
    const auction = await this.state.storage.get<{ bids: AuctionBid[]; requiredCapabilities: string[] }>(key);
    if (!auction || auction.bids.length === 0) return null;

    // простейшая логика: первый с нужными capabilities
    const required = new Set(auction.requiredCapabilities || []);
    for (const bid of auction.bids) {
      const has = new Set(bid.capabilities);
      let ok = true;
      for (const r of required) {
        if (!has.has(r)) { ok = false; break; }
      }
      if (ok) {
        await this.claimTask(taskId, bid.agent);
        await this.broadcast({ kind: "auction_resolved", taskId, winner: bid.agent, ts: Date.now() });
        return bid.agent;
      }
    }
    // fallback: первый
    const winner = auction.bids[0].agent;
    await this.claimTask(taskId, winner);
    await this.broadcast({ kind: "auction_resolved", taskId, winner, ts: Date.now() });
    return winner;
  }

  // ==================== POLICY (authorized MCPs) ====================
  private async authorizeMcps(mcps: string[]) {
    await this.state.storage.put("authorized_mcps", mcps);
    await this.broadcast({ kind: "policy_update", authorizedMcps: mcps, ts: Date.now() });
  }

  // ==================== BROADCAST CHAT ====================
  private async broadcastChat(message: string, channel: string) {
    await this.appendEvent({ type: `chat.${channel}`, payload: { message } });
    await this.broadcast({ kind: "chat", channel, message, ts: Date.now() });
  }

  // ==================== EMERGENCY STOP / FREEZE ====================
  private async freezeAgent(agent: string, reason: string) {
    const key = `frozen:${agent}`;
    await this.state.storage.put(key, { reason, ts: Date.now() });
    await this.broadcast({ kind: "agent_frozen", agent, reason, ts: Date.now() });
    await this.broadcastToAgent(agent, { kind: "you_are_frozen", reason });
  }

  private async unfreezeAgent(agent: string) {
    const key = `frozen:${agent}`;
    await this.state.storage.delete(key);
    await this.broadcast({ kind: "agent_unfrozen", agent, ts: Date.now() });
  }

  private async isFrozen(agent: string): Promise<boolean> {
    const key = `frozen:${agent}`;
    const data = await this.state.storage.get(key);
    return !!data;
  }

  // ==================== ANOMALY DETECTION (Auto-Emergency Stop) ====================
  private async reportActivity(agent: string, actions: number): Promise<boolean> {
    const now = Date.now();
    let activity = this.agentActivity.get(agent);
    if (!activity) {
      activity = { agent, lastPing: now, actionsLast5Min: 0 };
    }

    // reset counter if >5 min since last ping
    if (now - activity.lastPing > 5 * 60 * 1000) {
      activity.actionsLast5Min = 0;
    }

    activity.actionsLast5Min += actions;
    activity.lastPing = now;
    this.agentActivity.set(agent, activity);

    // anomaly: >200 actions in 5 min
    if (activity.actionsLast5Min > 200) {
      await this.freezeAgent(agent, "anomaly_detected: too many actions");
      return true;
    }
    return false;
  }

  // ==================== SWARM PULSE (Live Agent Map) ====================
  private async getSwarmPulse(): Promise<{ agents: any[]; lastUpdate: number }> {
    const all = await this.state.storage.list<any>({ prefix: "pulse:" });
    const agents: any[] = [];
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000;
    
    for (const [, pulse] of all) {
      if (now - pulse.lastUpdate < staleThreshold) {
        agents.push(pulse);
      }
    }
    return { agents, lastUpdate: now };
  }

  private async updatePulse(input: { agent: string; platform: string; branch: string; currentFile?: string; currentTask?: string; status: string }) {
    const key = `pulse:${input.agent}`;
    const pulse = { ...input, lastUpdate: Date.now() };
    await this.state.storage.put(key, pulse);
    await this.broadcast({ kind: "pulse_update", ...pulse });
  }

  // ==================== URGENT PREEMPTION ====================
  private async triggerUrgent(input: { taskId: string; title: string; reason: string; initiator: string; affectedFiles: string[] }): Promise<{ urgentId: string; preemptedAgents: string[] }> {
    const urgentId = `urgent-${Date.now()}`;
    const preemptedAgents: string[] = [];
    
    // Find agents working on affected files
    const pulseData = await this.getSwarmPulse();
    for (const agent of pulseData.agents) {
      if (agent.status === "active" && agent.currentFile) {
        if (input.affectedFiles.some((f: string) => agent.currentFile.includes(f))) {
          preemptedAgents.push(agent.agent);
        }
      }
    }

    const urgent = { ...input, id: urgentId, preemptedAgents, status: "active", createdAt: Date.now() };
    await this.state.storage.put("urgent_active", urgent);
    await this.broadcast({ kind: "urgent_preemption", ...urgent });
    
    // Notify preempted agents
    for (const agent of preemptedAgents) {
      await this.broadcastToAgent(agent, { kind: "you_are_preempted", urgentId, reason: input.reason });
    }
    
    return { urgentId, preemptedAgents };
  }

  private async getActiveUrgent(): Promise<any | null> {
    const urgent = await this.state.storage.get<any>("urgent_active");
    return urgent?.status === "active" ? urgent : null;
  }

  private async resolveUrgent(urgentId: string) {
    const urgent = await this.state.storage.get<any>("urgent_active");
    if (urgent && urgent.id === urgentId) {
      urgent.status = "resolved";
      urgent.resolvedAt = Date.now();
      await this.state.storage.put("urgent_active", urgent);
      await this.broadcast({ kind: "urgent_resolved", urgentId });
    }
  }

  // ==================== TIMELINE VISUALIZATION ====================
  private async getTimeline(since: number): Promise<any[]> {
    const events = await this.getEventsSince(since);
    const pulseData = await this.getSwarmPulse();
    
    const timeline: any[] = [];
    
    // Add events to timeline
    for (const ev of events) {
      timeline.push({
        type: "event",
        ts: ev.ts,
        eventType: ev.type,
        payload: ev.payload,
      });
    }
    
    // Add current agent states
    for (const agent of pulseData.agents) {
      timeline.push({
        type: "agent_state",
        ts: agent.lastUpdate,
        agent: agent.agent,
        platform: agent.platform,
        status: agent.status,
        currentFile: agent.currentFile,
        currentTask: agent.currentTask,
      });
    }
    
    timeline.sort((a, b) => a.ts - b.ts);
    return timeline.slice(-200);
  }

  // ==================== KNOWLEDGE BASE ====================
  private async addKnowledge(input: { agent: string; category: string; title: string; description: string; solution?: string }): Promise<string> {
    const id = `kb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = { ...input, id, createdAt: Date.now() };
    await this.state.storage.put(`knowledge:${id}`, entry);
    await this.broadcast({ kind: "knowledge_added", id, title: input.title, agent: input.agent });
    return id;
  }

  private async searchKnowledge(query: string): Promise<any[]> {
    const all = await this.state.storage.list<any>({ prefix: "knowledge:" });
    const entries: any[] = [];
    const q = query.toLowerCase();
    
    for (const [, entry] of all) {
      if (!query || entry.title.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q)) {
        entries.push(entry);
      }
    }
    
    entries.sort((a, b) => b.createdAt - a.createdAt);
    return entries.slice(0, 50);
  }
}
