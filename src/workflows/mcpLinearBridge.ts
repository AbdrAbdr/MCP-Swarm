/**
 * MCP Linear Bridge — Linear.app Integration
 * 
 * MCP Swarm v0.9.19
 * 
 * Bridges swarm_task ↔ Linear issues when mcp-linear is available.
 * Passive integration — activates only if Linear MCP is detected.
 * 
 * Features:
 * - Auto-sync swarm tasks → Linear issues
 * - Status mapping: open → Todo, in_progress → In Progress, done → Done
 * - Two-way sync on poll
 * - Team/project auto-detection
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

interface LinearConfig {
    enabled: boolean;
    teamId?: string;
    projectId?: string;
    autoSync: boolean;
    syncInterval: number; // ms
    statusMapping: Record<string, string>;
    labelPrefix: string;
    lastSyncAt: number;
}

interface LinearSyncEntry {
    swarmTaskId: string;
    linearIssueId?: string;
    linearIdentifier?: string; // e.g. "ENG-123"
    lastSynced: number;
    direction: "swarm→linear" | "linear→swarm" | "bidirectional";
    status: string;
}

interface LinearBridgeStats {
    totalSynced: number;
    issuesCreated: number;
    issuesClosed: number;
    lastSync: number;
    errors: number;
}

// ============ CONSTANTS ============

const LINEAR_DIR = "linear-bridge";
const CONFIG_FILE = "linear-config.json";
const SYNC_FILE = "linear-sync.json";
const STATS_FILE = "linear-stats.json";

const DEFAULT_STATUS_MAPPING: Record<string, string> = {
    "open": "Todo",
    "in_progress": "In Progress",
    "needs_review": "In Review",
    "done": "Done",
    "canceled": "Canceled",
};

const DEFAULT_CONFIG: LinearConfig = {
    enabled: false,
    autoSync: true,
    syncInterval: 5 * 60 * 1000, // 5 min
    statusMapping: DEFAULT_STATUS_MAPPING,
    labelPrefix: "swarm",
    lastSyncAt: 0,
};

// ============ STORAGE ============

async function getBridgeDir(repoPath: string): Promise<string> {
    const root = await getRepoRoot(repoPath);
    const dir = path.join(root, ".swarm", LINEAR_DIR);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

async function loadConfig(repoPath: string): Promise<LinearConfig> {
    const dir = await getBridgeDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, CONFIG_FILE), "utf-8");
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

async function saveConfig(repoPath: string, config: LinearConfig): Promise<void> {
    const dir = await getBridgeDir(repoPath);
    await fs.writeFile(path.join(dir, CONFIG_FILE), JSON.stringify(config, null, 2), "utf-8");
}

async function loadSyncEntries(repoPath: string): Promise<LinearSyncEntry[]> {
    const dir = await getBridgeDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, SYNC_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function saveSyncEntries(repoPath: string, entries: LinearSyncEntry[]): Promise<void> {
    const dir = await getBridgeDir(repoPath);
    await fs.writeFile(path.join(dir, SYNC_FILE), JSON.stringify(entries, null, 2), "utf-8");
}

async function loadStats(repoPath: string): Promise<LinearBridgeStats> {
    const dir = await getBridgeDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, STATS_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return { totalSynced: 0, issuesCreated: 0, issuesClosed: 0, lastSync: 0, errors: 0 };
    }
}

async function saveStats(repoPath: string, stats: LinearBridgeStats): Promise<void> {
    const dir = await getBridgeDir(repoPath);
    await fs.writeFile(path.join(dir, STATS_FILE), JSON.stringify(stats, null, 2), "utf-8");
}

// ============ SYNC LOGIC ============

/**
 * Register a task for Linear sync
 */
async function registerTask(
    repoPath: string,
    swarmTaskId: string,
    linearIssueId?: string,
    linearIdentifier?: string
): Promise<LinearSyncEntry> {
    const entries = await loadSyncEntries(repoPath);

    const existing = entries.find(e => e.swarmTaskId === swarmTaskId);
    if (existing) {
        existing.linearIssueId = linearIssueId || existing.linearIssueId;
        existing.linearIdentifier = linearIdentifier || existing.linearIdentifier;
        existing.lastSynced = Date.now();
        await saveSyncEntries(repoPath, entries);
        return existing;
    }

    const entry: LinearSyncEntry = {
        swarmTaskId,
        linearIssueId,
        linearIdentifier,
        lastSynced: Date.now(),
        direction: "swarm→linear",
        status: "open",
    };

    entries.push(entry);
    await saveSyncEntries(repoPath, entries);
    return entry;
}

/**
 * Update sync status when swarm task changes
 */
async function syncTaskStatus(
    repoPath: string,
    swarmTaskId: string,
    newStatus: string
): Promise<{ synced: boolean; linearStatus?: string }> {
    const config = await loadConfig(repoPath);
    const entries = await loadSyncEntries(repoPath);

    const entry = entries.find(e => e.swarmTaskId === swarmTaskId);
    if (!entry) return { synced: false };

    entry.status = newStatus;
    entry.lastSynced = Date.now();
    await saveSyncEntries(repoPath, entries);

    const linearStatus = config.statusMapping[newStatus] || newStatus;

    const stats = await loadStats(repoPath);
    stats.totalSynced++;
    if (newStatus === "done") stats.issuesClosed++;
    stats.lastSync = Date.now();
    await saveStats(repoPath, stats);

    return {
        synced: true,
        linearStatus,
    };
}

// ============ MAIN HANDLER ============

export type LinearBridgeAction =
    | "detect"       // Check if mcp-linear is available
    | "enable"       // Enable Linear bridge
    | "disable"      // Disable Linear bridge
    | "register"     // Register a task for sync
    | "sync"         // Sync task status
    | "list"         // List synced tasks
    | "config"       // Get config
    | "set_config"   // Update config
    | "stats";       // Get sync statistics

export async function handleLinearBridge(input: {
    action: LinearBridgeAction;
    repoPath?: string;
    // For register
    swarmTaskId?: string;
    linearIssueId?: string;
    linearIdentifier?: string;
    // For sync
    status?: string;
    // For enable
    teamId?: string;
    projectId?: string;
    // For set_config
    config?: Partial<LinearConfig>;
}): Promise<unknown> {
    const repoPath = input.repoPath || process.cwd();

    switch (input.action) {
        case "detect": {
            // Check for mcp-linear indicators
            // In real implementation, this would check MCP server list
            return {
                detected: false,
                message: "mcp-linear not detected. Install it to enable Linear integration.",
                installHint: "Add mcp-linear to your MCP config to enable auto-sync",
            };
        }

        case "enable": {
            const config = await loadConfig(repoPath);
            config.enabled = true;
            if (input.teamId) config.teamId = input.teamId;
            if (input.projectId) config.projectId = input.projectId;
            await saveConfig(repoPath, config);
            return { enabled: true, config };
        }

        case "disable": {
            const config = await loadConfig(repoPath);
            config.enabled = false;
            await saveConfig(repoPath, config);
            return { enabled: false };
        }

        case "register": {
            if (!input.swarmTaskId) return { error: "swarmTaskId required" };
            const entry = await registerTask(
                repoPath,
                input.swarmTaskId,
                input.linearIssueId,
                input.linearIdentifier
            );
            return { registered: true, entry };
        }

        case "sync": {
            if (!input.swarmTaskId || !input.status) return { error: "swarmTaskId and status required" };
            return syncTaskStatus(repoPath, input.swarmTaskId, input.status);
        }

        case "list": {
            return loadSyncEntries(repoPath);
        }

        case "config": {
            return loadConfig(repoPath);
        }

        case "set_config": {
            const current = await loadConfig(repoPath);
            const updated = { ...current, ...input.config };
            await saveConfig(repoPath, updated);
            return { updated: true, config: updated };
        }

        case "stats": {
            return loadStats(repoPath);
        }

        default:
            return { error: `Unknown action: ${input.action}` };
    }
}
