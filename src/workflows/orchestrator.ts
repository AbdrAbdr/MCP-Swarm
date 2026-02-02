/**
 * Orchestrator Election & Infinite Loop System
 * 
 * Key Concepts:
 * - First agent to register becomes ORCHESTRATOR
 * - All subsequent agents become EXECUTORS
 * - Orchestrator runs in INFINITE LOOP (never stops unless user says "stop")
 * - Orchestrator coordinates all other agents
 * - Uses leader election via Cloudflare Durable Objects or Git-based fallback
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";

// Role types
export type AgentRole = "orchestrator" | "executor" | "unknown";

// Orchestrator state persisted to file
export type OrchestratorState = {
  orchestratorId: string | null;
  orchestratorName: string | null;
  orchestratorPlatform: string | null;
  electedAt: number | null;
  lastHeartbeat: number;
  executors: ExecutorInfo[];
  isRunning: boolean;
  loopMode: "infinite" | "until_stop" | "single_pass";
};

export type ExecutorInfo = {
  agentId: string;
  agentName: string;
  platform: string;
  registeredAt: number;
  lastSeen: number;
  status: "active" | "idle" | "dead";
  currentTask: string | null;
};

// Message types for agent communication
export type AgentMessage = {
  id: string;
  from: string;
  to: string | "*"; // "*" = broadcast
  subject: string;
  body: string;
  importance: "low" | "normal" | "high" | "urgent";
  threadId: string | null;
  replyTo: string | null;
  ts: number;
  ackRequired: boolean;
  acknowledged: boolean;
  attachments: string[];
};

const ORCHESTRATOR_FILE = ".swarm/ORCHESTRATOR.json";
const MESSAGES_DIR = ".swarm/messages";
const INBOX_DIR = ".swarm/inbox";
const HEARTBEAT_TIMEOUT_MS = 60_000; // 1 minute

/**
 * Get orchestrator file path
 */
function getOrchestratorPath(repoRoot: string): string {
  return path.join(repoRoot, ORCHESTRATOR_FILE);
}

/**
 * Get messages directory
 */
function getMessagesDir(repoRoot: string): string {
  return path.join(repoRoot, MESSAGES_DIR);
}

/**
 * Get inbox directory for an agent
 */
function getInboxDir(repoRoot: string, agentName: string): string {
  return path.join(repoRoot, INBOX_DIR, agentName);
}

/**
 * Initialize orchestrator state
 */
async function initOrchestratorState(repoRoot: string): Promise<OrchestratorState> {
  const state: OrchestratorState = {
    orchestratorId: null,
    orchestratorName: null,
    orchestratorPlatform: null,
    electedAt: null,
    lastHeartbeat: Date.now(),
    executors: [],
    isRunning: false,
    loopMode: "infinite",
  };
  
  const orchestratorPath = getOrchestratorPath(repoRoot);
  await fs.mkdir(path.dirname(orchestratorPath), { recursive: true });
  await fs.writeFile(orchestratorPath, JSON.stringify(state, null, 2), "utf8");
  
  return state;
}

/**
 * Load orchestrator state
 */
async function loadOrchestratorState(repoRoot: string): Promise<OrchestratorState | null> {
  const orchestratorPath = getOrchestratorPath(repoRoot);
  try {
    const raw = await fs.readFile(orchestratorPath, "utf8");
    return JSON.parse(raw) as OrchestratorState;
  } catch {
    return null;
  }
}

/**
 * Save orchestrator state
 */
async function saveOrchestratorState(repoRoot: string, state: OrchestratorState): Promise<void> {
  const orchestratorPath = getOrchestratorPath(repoRoot);
  await fs.mkdir(path.dirname(orchestratorPath), { recursive: true });
  await fs.writeFile(orchestratorPath, JSON.stringify(state, null, 2), "utf8");
}

/**
 * Check if orchestrator is alive (heartbeat within timeout)
 */
function isOrchestratorAlive(state: OrchestratorState): boolean {
  if (!state.orchestratorId) return false;
  if (!state.isRunning) return false;
  
  const now = Date.now();
  return (now - state.lastHeartbeat) < HEARTBEAT_TIMEOUT_MS;
}

/**
 * Try to become orchestrator (first agent wins)
 * Returns the role assigned to this agent
 */
export async function tryBecomeOrchestrator(input: {
  repoPath?: string;
  agentId: string;
  agentName: string;
  platform: string;
}): Promise<{
  role: AgentRole;
  isOrchestrator: boolean;
  orchestratorName: string | null;
  message: string;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  
  let state = await loadOrchestratorState(repoRoot);
  
  // Initialize if no state exists
  if (!state) {
    state = await initOrchestratorState(repoRoot);
  }
  
  // Check if current orchestrator is alive
  const orchestratorAlive = isOrchestratorAlive(state);
  
  // If no orchestrator or orchestrator is dead, this agent becomes orchestrator
  if (!state.orchestratorId || !orchestratorAlive) {
    state.orchestratorId = input.agentId;
    state.orchestratorName = input.agentName;
    state.orchestratorPlatform = input.platform;
    state.electedAt = Date.now();
    state.lastHeartbeat = Date.now();
    state.isRunning = true;
    state.loopMode = "infinite";
    
    await saveOrchestratorState(repoRoot, state);
    
    return {
      role: "orchestrator",
      isOrchestrator: true,
      orchestratorName: input.agentName,
      message: `Agent ${input.agentName} elected as ORCHESTRATOR. Running in infinite loop mode.`,
    };
  }
  
  // Otherwise, register as executor
  const existingExecutor = state.executors.find(e => e.agentId === input.agentId);
  if (existingExecutor) {
    existingExecutor.lastSeen = Date.now();
    existingExecutor.status = "active";
  } else {
    state.executors.push({
      agentId: input.agentId,
      agentName: input.agentName,
      platform: input.platform,
      registeredAt: Date.now(),
      lastSeen: Date.now(),
      status: "active",
      currentTask: null,
    });
  }
  
  await saveOrchestratorState(repoRoot, state);
  
  return {
    role: "executor",
    isOrchestrator: false,
    orchestratorName: state.orchestratorName,
    message: `Agent ${input.agentName} registered as EXECUTOR. Orchestrator: ${state.orchestratorName}`,
  };
}

/**
 * Get current orchestrator info
 */
export async function getOrchestratorInfo(input: {
  repoPath?: string;
}): Promise<{
  hasOrchestrator: boolean;
  orchestratorName: string | null;
  orchestratorPlatform: string | null;
  isAlive: boolean;
  electedAt: number | null;
  executorCount: number;
  loopMode: string;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const state = await loadOrchestratorState(repoRoot);
  
  if (!state) {
    return {
      hasOrchestrator: false,
      orchestratorName: null,
      orchestratorPlatform: null,
      isAlive: false,
      electedAt: null,
      executorCount: 0,
      loopMode: "none",
    };
  }
  
  return {
    hasOrchestrator: !!state.orchestratorId,
    orchestratorName: state.orchestratorName,
    orchestratorPlatform: state.orchestratorPlatform,
    isAlive: isOrchestratorAlive(state),
    electedAt: state.electedAt,
    executorCount: state.executors.filter(e => e.status === "active").length,
    loopMode: state.loopMode,
  };
}

/**
 * Orchestrator heartbeat (must be called regularly to stay alive)
 */
export async function orchestratorHeartbeat(input: {
  repoPath?: string;
  agentId: string;
}): Promise<{
  success: boolean;
  isOrchestrator: boolean;
  message: string;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const state = await loadOrchestratorState(repoRoot);
  
  if (!state) {
    return {
      success: false,
      isOrchestrator: false,
      message: "No orchestrator state found",
    };
  }
  
  if (state.orchestratorId !== input.agentId) {
    return {
      success: false,
      isOrchestrator: false,
      message: "Agent is not the orchestrator",
    };
  }
  
  state.lastHeartbeat = Date.now();
  await saveOrchestratorState(repoRoot, state);
  
  return {
    success: true,
    isOrchestrator: true,
    message: "Heartbeat recorded",
  };
}

/**
 * Resign as orchestrator (allows another agent to take over)
 */
export async function resignOrchestrator(input: {
  repoPath?: string;
  agentId: string;
}): Promise<{
  success: boolean;
  message: string;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const state = await loadOrchestratorState(repoRoot);
  
  if (!state) {
    return { success: false, message: "No orchestrator state found" };
  }
  
  if (state.orchestratorId !== input.agentId) {
    return { success: false, message: "Only the orchestrator can resign" };
  }
  
  state.orchestratorId = null;
  state.orchestratorName = null;
  state.orchestratorPlatform = null;
  state.isRunning = false;
  
  await saveOrchestratorState(repoRoot, state);
  
  return {
    success: true,
    message: "Orchestrator resigned. Next agent to register will become orchestrator.",
  };
}

/**
 * List all executors
 */
export async function listExecutors(input: {
  repoPath?: string;
}): Promise<{
  executors: ExecutorInfo[];
  activeCount: number;
  deadCount: number;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const state = await loadOrchestratorState(repoRoot);
  
  if (!state) {
    return { executors: [], activeCount: 0, deadCount: 0 };
  }
  
  // Mark dead executors
  const now = Date.now();
  for (const executor of state.executors) {
    if (now - executor.lastSeen > HEARTBEAT_TIMEOUT_MS) {
      executor.status = "dead";
    }
  }
  
  await saveOrchestratorState(repoRoot, state);
  
  return {
    executors: state.executors,
    activeCount: state.executors.filter(e => e.status === "active").length,
    deadCount: state.executors.filter(e => e.status === "dead").length,
  };
}

/**
 * Executor heartbeat
 */
export async function executorHeartbeat(input: {
  repoPath?: string;
  agentId: string;
  currentTask?: string;
}): Promise<{
  success: boolean;
  message: string;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const state = await loadOrchestratorState(repoRoot);
  
  if (!state) {
    return { success: false, message: "No orchestrator state found" };
  }
  
  const executor = state.executors.find(e => e.agentId === input.agentId);
  if (!executor) {
    return { success: false, message: "Executor not found" };
  }
  
  executor.lastSeen = Date.now();
  executor.status = "active";
  if (input.currentTask !== undefined) {
    executor.currentTask = input.currentTask;
  }
  
  await saveOrchestratorState(repoRoot, state);
  
  return { success: true, message: "Executor heartbeat recorded" };
}

// ============ MESSAGING SYSTEM ============

/**
 * Generate unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Send a message to another agent
 */
export async function sendAgentMessage(input: {
  repoPath?: string;
  from: string;
  to: string | string[]; // agent name or "*" for broadcast
  subject: string;
  body: string;
  importance?: "low" | "normal" | "high" | "urgent";
  threadId?: string;
  replyTo?: string;
  ackRequired?: boolean;
}): Promise<{
  success: boolean;
  messageId: string;
  deliveredTo: string[];
  message: string;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const messagesDir = getMessagesDir(repoRoot);
  await fs.mkdir(messagesDir, { recursive: true });
  
  const messageId = generateMessageId();
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  
  const msg: AgentMessage = {
    id: messageId,
    from: input.from,
    to: recipients.length === 1 ? recipients[0] : recipients.join(","),
    subject: input.subject,
    body: input.body,
    importance: input.importance || "normal",
    threadId: input.threadId || null,
    replyTo: input.replyTo || null,
    ts: Date.now(),
    ackRequired: input.ackRequired || false,
    acknowledged: false,
    attachments: [],
  };
  
  // Save canonical message
  const msgPath = path.join(messagesDir, `${messageId}.json`);
  await fs.writeFile(msgPath, JSON.stringify(msg, null, 2), "utf8");
  
  // Deliver to inboxes
  const deliveredTo: string[] = [];
  
  if (recipients.includes("*")) {
    // Broadcast: deliver to all agents
    const state = await loadOrchestratorState(repoRoot);
    if (state) {
      const allAgents = [
        state.orchestratorName,
        ...state.executors.map(e => e.agentName),
      ].filter((n): n is string => n !== null && n !== input.from);
      
      for (const agent of allAgents) {
        await deliverToInbox(repoRoot, agent, msg);
        deliveredTo.push(agent);
      }
    }
  } else {
    // Direct delivery
    for (const recipient of recipients) {
      if (recipient !== input.from) {
        await deliverToInbox(repoRoot, recipient, msg);
        deliveredTo.push(recipient);
      }
    }
  }
  
  return {
    success: true,
    messageId,
    deliveredTo,
    message: `Message sent to ${deliveredTo.length} recipient(s)`,
  };
}

/**
 * Deliver message to agent's inbox
 */
async function deliverToInbox(repoRoot: string, agentName: string, msg: AgentMessage): Promise<void> {
  const inboxDir = getInboxDir(repoRoot, agentName);
  await fs.mkdir(inboxDir, { recursive: true });
  
  const msgPath = path.join(inboxDir, `${msg.id}.json`);
  await fs.writeFile(msgPath, JSON.stringify(msg, null, 2), "utf8");
}

/**
 * Fetch messages from inbox
 */
export async function fetchAgentInbox(input: {
  repoPath?: string;
  agentName: string;
  limit?: number;
  urgentOnly?: boolean;
  sinceTs?: number;
}): Promise<{
  messages: AgentMessage[];
  total: number;
  unread: number;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const inboxDir = getInboxDir(repoRoot, input.agentName);
  
  let files: string[] = [];
  try {
    files = await fs.readdir(inboxDir);
  } catch {
    // Inbox doesn't exist yet
    return { messages: [], total: 0, unread: 0 };
  }
  
  const messages: AgentMessage[] = [];
  
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    
    try {
      const raw = await fs.readFile(path.join(inboxDir, file), "utf8");
      const msg = JSON.parse(raw) as AgentMessage;
      
      // Filter by timestamp
      if (input.sinceTs && msg.ts <= input.sinceTs) continue;
      
      // Filter by urgency
      if (input.urgentOnly && msg.importance !== "urgent" && msg.importance !== "high") continue;
      
      messages.push(msg);
    } catch {
      // Skip invalid files
    }
  }
  
  // Sort by timestamp (newest first)
  messages.sort((a, b) => b.ts - a.ts);
  
  const limit = input.limit || 20;
  const unread = messages.filter(m => m.ackRequired && !m.acknowledged).length;
  
  return {
    messages: messages.slice(0, limit),
    total: messages.length,
    unread,
  };
}

/**
 * Acknowledge a message
 */
export async function acknowledgeMessage(input: {
  repoPath?: string;
  agentName: string;
  messageId: string;
}): Promise<{
  success: boolean;
  message: string;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const inboxDir = getInboxDir(repoRoot, input.agentName);
  const msgPath = path.join(inboxDir, `${input.messageId}.json`);
  
  try {
    const raw = await fs.readFile(msgPath, "utf8");
    const msg = JSON.parse(raw) as AgentMessage;
    msg.acknowledged = true;
    await fs.writeFile(msgPath, JSON.stringify(msg, null, 2), "utf8");
    
    return { success: true, message: "Message acknowledged" };
  } catch {
    return { success: false, message: "Message not found" };
  }
}

/**
 * Reply to a message
 */
export async function replyToMessage(input: {
  repoPath?: string;
  from: string;
  messageId: string;
  body: string;
}): Promise<{
  success: boolean;
  replyId: string;
  message: string;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const messagesDir = getMessagesDir(repoRoot);
  
  // Find original message
  const originalPath = path.join(messagesDir, `${input.messageId}.json`);
  let original: AgentMessage;
  
  try {
    const raw = await fs.readFile(originalPath, "utf8");
    original = JSON.parse(raw) as AgentMessage;
  } catch {
    return { success: false, replyId: "", message: "Original message not found" };
  }
  
  // Send reply
  const result = await sendAgentMessage({
    repoPath: input.repoPath,
    from: input.from,
    to: original.from,
    subject: `Re: ${original.subject}`,
    body: input.body,
    importance: original.importance,
    threadId: original.threadId || original.id,
    replyTo: input.messageId,
  });
  
  return {
    success: result.success,
    replyId: result.messageId,
    message: result.message,
  };
}

/**
 * Search messages
 */
export async function searchMessages(input: {
  repoPath?: string;
  query: string;
  limit?: number;
}): Promise<{
  messages: AgentMessage[];
  total: number;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const messagesDir = getMessagesDir(repoRoot);
  
  let files: string[] = [];
  try {
    files = await fs.readdir(messagesDir);
  } catch {
    return { messages: [], total: 0 };
  }
  
  const messages: AgentMessage[] = [];
  const queryLower = input.query.toLowerCase();
  
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    
    try {
      const raw = await fs.readFile(path.join(messagesDir, file), "utf8");
      const msg = JSON.parse(raw) as AgentMessage;
      
      // Search in subject and body
      if (
        msg.subject.toLowerCase().includes(queryLower) ||
        msg.body.toLowerCase().includes(queryLower)
      ) {
        messages.push(msg);
      }
    } catch {
      // Skip invalid files
    }
  }
  
  // Sort by timestamp (newest first)
  messages.sort((a, b) => b.ts - a.ts);
  
  const limit = input.limit || 50;
  
  return {
    messages: messages.slice(0, limit),
    total: messages.length,
  };
}

/**
 * Get thread messages
 */
export async function getThreadMessages(input: {
  repoPath?: string;
  threadId: string;
}): Promise<{
  messages: AgentMessage[];
  participants: string[];
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const messagesDir = getMessagesDir(repoRoot);
  
  let files: string[] = [];
  try {
    files = await fs.readdir(messagesDir);
  } catch {
    return { messages: [], participants: [] };
  }
  
  const messages: AgentMessage[] = [];
  const participants = new Set<string>();
  
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    
    try {
      const raw = await fs.readFile(path.join(messagesDir, file), "utf8");
      const msg = JSON.parse(raw) as AgentMessage;
      
      if (msg.threadId === input.threadId || msg.id === input.threadId) {
        messages.push(msg);
        participants.add(msg.from);
      }
    } catch {
      // Skip invalid files
    }
  }
  
  // Sort by timestamp (oldest first for threads)
  messages.sort((a, b) => a.ts - b.ts);
  
  return {
    messages,
    participants: Array.from(participants),
  };
}
