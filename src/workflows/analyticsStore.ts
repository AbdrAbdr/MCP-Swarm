/**
 * Analytics Store — Local persistent storage for metrics
 * 
 * MCP Swarm v1.2.0
 * 
 * Stores task history, agent metrics, and events in .swarm/analytics.json.
 * Uses JSON file storage for zero-dependency portability.
 * Automatically limits events to last 10,000 entries and supports
 * TTL-based cleanup for long-running projects.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

export interface TaskRecord {
    id: string;
    title: string;
    status: string;
    assignee?: string;
    createdAt: string;
    completedAt?: string;
    durationMs?: number;
    files?: string[];
    tags?: string[];
}

export interface EventRecord {
    id: string;
    type: string;
    agent?: string;
    message: string;
    data?: Record<string, unknown>;
    timestamp: string;
}

export interface AgentMetric {
    agentName: string;
    tasksCompleted: number;
    avgDurationMs: number;
    lastActive: string;
    specializations: string[];
}

type AnalyticsAction =
    | "log_task"
    | "log_event"
    | "get_tasks"
    | "get_events"
    | "get_metrics"
    | "get_agent_stats"
    | "summary"
    | "cleanup";

// ============ JSON FALLBACK STORAGE ============

interface AnalyticsStore {
    tasks: TaskRecord[];
    events: EventRecord[];
}

const ANALYTICS_DIR = ".swarm";
const ANALYTICS_FILE = "analytics.json";

async function getStorePath(repoRoot: string): Promise<string> {
    const dir = path.join(repoRoot, ANALYTICS_DIR);
    await fs.mkdir(dir, { recursive: true });
    return path.join(dir, ANALYTICS_FILE);
}

async function loadStore(repoRoot: string): Promise<AnalyticsStore> {
    try {
        const storePath = await getStorePath(repoRoot);
        const raw = await fs.readFile(storePath, "utf8");
        return JSON.parse(raw) as AnalyticsStore;
    } catch {
        return { tasks: [], events: [] };
    }
}

async function saveStore(repoRoot: string, store: AnalyticsStore): Promise<void> {
    const storePath = await getStorePath(repoRoot);
    await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

// ============ PUBLIC API ============

async function logTask(repoRoot: string, task: TaskRecord): Promise<{ success: boolean }> {
    const store = await loadStore(repoRoot);

    // Update existing or add new
    const idx = store.tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) {
        store.tasks[idx] = { ...store.tasks[idx], ...task };
    } else {
        store.tasks.push(task);
    }

    await saveStore(repoRoot, store);
    return { success: true };
}

async function logEvent(repoRoot: string, event: EventRecord): Promise<{ success: boolean }> {
    const store = await loadStore(repoRoot);
    store.events.push(event);

    // Keep last 10000 events
    if (store.events.length > 10000) {
        store.events = store.events.slice(-10000);
    }

    await saveStore(repoRoot, store);
    return { success: true };
}

async function getTasks(repoRoot: string, input: {
    status?: string;
    assignee?: string;
    limit?: number;
}): Promise<{ tasks: TaskRecord[]; total: number }> {
    const store = await loadStore(repoRoot);
    let tasks = store.tasks;

    if (input.status) tasks = tasks.filter(t => t.status === input.status);
    if (input.assignee) tasks = tasks.filter(t => t.assignee === input.assignee);

    const total = tasks.length;
    const limit = input.limit || 50;
    tasks = tasks.slice(-limit);

    return { tasks, total };
}

async function getEvents(repoRoot: string, input: {
    type?: string;
    agent?: string;
    limit?: number;
}): Promise<{ events: EventRecord[]; total: number }> {
    const store = await loadStore(repoRoot);
    let events = store.events;

    if (input.type) events = events.filter(e => e.type === input.type);
    if (input.agent) events = events.filter(e => e.agent === input.agent);

    const total = events.length;
    const limit = input.limit || 50;
    events = events.slice(-limit);

    return { events, total };
}

async function getAgentStats(repoRoot: string): Promise<{ agents: AgentMetric[] }> {
    const store = await loadStore(repoRoot);
    const agentMap = new Map<string, { total: number; durations: number[]; lastActive: string; specs: Set<string> }>();

    for (const task of store.tasks) {
        if (!task.assignee || task.status !== "done") continue;

        if (!agentMap.has(task.assignee)) {
            agentMap.set(task.assignee, { total: 0, durations: [], lastActive: "", specs: new Set() });
        }

        const stats = agentMap.get(task.assignee)!;
        stats.total++;
        if (task.durationMs) stats.durations.push(task.durationMs);
        if (task.completedAt && task.completedAt > stats.lastActive) stats.lastActive = task.completedAt;
        if (task.tags) task.tags.forEach(t => stats.specs.add(t));
    }

    const agents: AgentMetric[] = [];
    for (const [name, stats] of agentMap) {
        const avgDuration = stats.durations.length > 0
            ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
            : 0;

        agents.push({
            agentName: name,
            tasksCompleted: stats.total,
            avgDurationMs: avgDuration,
            lastActive: stats.lastActive,
            specializations: Array.from(stats.specs),
        });
    }

    return { agents: agents.sort((a, b) => b.tasksCompleted - a.tasksCompleted) };
}

async function getSummary(repoRoot: string): Promise<{
    totalTasks: number;
    completedTasks: number;
    totalEvents: number;
    topAgents: string[];
    recentTasks: TaskRecord[];
}> {
    const store = await loadStore(repoRoot);
    const completedTasks = store.tasks.filter(t => t.status === "done").length;

    // Top agents
    const agentCounts = new Map<string, number>();
    for (const task of store.tasks) {
        if (task.assignee && task.status === "done") {
            agentCounts.set(task.assignee, (agentCounts.get(task.assignee) || 0) + 1);
        }
    }
    const topAgents = Array.from(agentCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

    return {
        totalTasks: store.tasks.length,
        completedTasks,
        totalEvents: store.events.length,
        topAgents,
        recentTasks: store.tasks.slice(-5),
    };
}

async function cleanup(repoRoot: string, input: {
    olderThanDays?: number;
}): Promise<{ deletedTasks: number; deletedEvents: number }> {
    const store = await loadStore(repoRoot);
    const days = input.olderThanDays || 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const origTasks = store.tasks.length;
    const origEvents = store.events.length;

    store.tasks = store.tasks.filter(t => (t.completedAt || t.createdAt) > cutoff);
    store.events = store.events.filter(e => e.timestamp > cutoff);

    await saveStore(repoRoot, store);

    return {
        deletedTasks: origTasks - store.tasks.length,
        deletedEvents: origEvents - store.events.length,
    };
}

// ============ CONVENIENCE EXPORT ============

/**
 * Quick-log a completed task (for use by other modules)
 */
export async function quickLogTask(repoPath: string, id: string, title: string, assignee?: string): Promise<void> {
    const repoRoot = await getRepoRoot(repoPath);
    await logTask(repoRoot, {
        id,
        title,
        status: "done",
        assignee,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
    });
}

/**
 * Quick-log an event (for use by other modules)
 */
export async function quickLogEvent(repoPath: string, type: string, message: string, agent?: string): Promise<void> {
    const repoRoot = await getRepoRoot(repoPath);
    await logEvent(repoRoot, {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        agent,
        message,
        timestamp: new Date().toISOString(),
    });
}

// ============ TOOL HANDLER ============

export async function handleAnalyticsTool(input: {
    action: AnalyticsAction;
    repoPath?: string;
    // log_task
    taskId?: string;
    title?: string;
    status?: string;
    assignee?: string;
    durationMs?: number;
    files?: string[];
    tags?: string[];
    // log_event
    eventType?: string;
    agent?: string;
    message?: string;
    data?: Record<string, unknown>;
    // queries
    limit?: number;
    olderThanDays?: number;
}): Promise<unknown> {
    const repoRoot = await getRepoRoot(input.repoPath);

    switch (input.action) {
        case "log_task":
            return logTask(repoRoot, {
                id: input.taskId || `task_${Date.now()}`,
                title: input.title || "Untitled",
                status: input.status || "done",
                assignee: input.assignee,
                createdAt: new Date().toISOString(),
                completedAt: input.status === "done" ? new Date().toISOString() : undefined,
                durationMs: input.durationMs,
                files: input.files,
                tags: input.tags,
            });

        case "log_event":
            return logEvent(repoRoot, {
                id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                type: input.eventType || "unknown",
                agent: input.agent,
                message: input.message || "",
                data: input.data,
                timestamp: new Date().toISOString(),
            });

        case "get_tasks":
            return getTasks(repoRoot, {
                status: input.status,
                assignee: input.assignee,
                limit: input.limit,
            });

        case "get_events":
            return getEvents(repoRoot, {
                type: input.eventType,
                agent: input.agent,
                limit: input.limit,
            });

        case "get_metrics":
        case "get_agent_stats":
            return getAgentStats(repoRoot);

        case "summary":
            return getSummary(repoRoot);

        case "cleanup":
            return cleanup(repoRoot, { olderThanDays: input.olderThanDays });

        default:
            throw new Error(`Unknown analytics action: ${input.action}`);
    }
}
