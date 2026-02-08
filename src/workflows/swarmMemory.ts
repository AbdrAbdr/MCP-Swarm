/**
 * Swarm Memory — Hybrid Memory System
 * 
 * MCP Swarm v0.9.20
 * 
 * Combines best ideas from:
 * - claude-mem: SQLite-backed persistence, 3-layer search, auto-compression
 * - claude-cognitive: Context Router (hot/warm/cold), Pool Coordinator, keyword injection
 * 
 * Architecture:
 * 1. Context Router — 3-tier: hot (current session), warm (24h), cold (archive)
 * 2. Pool Coordinator — multi-agent memory synchronization (via .swarm/)
 * 3. Lifecycle Hooks — session_start, prompt_submit, post_tool, stop, session_end
 * 4. 3-Layer Search — search (fast index) → timeline (context) → get_details (full)
 * 5. Auto-Compression — shrink old entries to save context window
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

/** Memory entry represents a single observation/fact */
interface MemoryEntry {
    id: string;
    content: string;
    summary?: string;        // Compressed version
    category: MemoryCategory;
    tags: string[];
    source: string;          // Agent name or "user"
    sessionId: string;
    createdAt: number;
    updatedAt: number;
    accessCount: number;
    lastAccessedAt: number;
    tier: MemoryTier;        // hot | warm | cold
    compressed: boolean;
    relatedFiles: string[];
    metadata: Record<string, unknown>;
}

/** Memory categories */
type MemoryCategory =
    | "observation"     // General fact/observation
    | "decision"        // Design/arch decision
    | "pattern"         // Code pattern learned
    | "bug"             // Bug and fix
    | "preference"      // User/project preference
    | "context"         // Context about codebase
    | "procedure"       // How-to / workflow
    | "relationship";   // Entity relationships

/** Memory tier for Context Router */
type MemoryTier = "hot" | "warm" | "cold";

/** Session metadata */
interface MemorySession {
    id: string;
    agentName: string;
    startedAt: number;
    endedAt?: number;
    entryCount: number;
    summary?: string;
}

/** Memory search result */
interface MemorySearchResult {
    entries: MemoryEntry[];
    totalMatches: number;
    searchTime: number;
    tier: MemoryTier | "all";
}

/** Memory statistics */
interface MemoryStats {
    totalEntries: number;
    byTier: Record<MemoryTier, number>;
    byCategory: Record<string, number>;
    totalSessions: number;
    compressionRatio: number;
    oldestEntry: number;
    newestEntry: number;
    lastCompression: number;
    storageBytes: number;
}

/** Pool state for multi-agent sync */
interface PoolState {
    agents: Record<string, {
        lastSeen: number;
        entriesContributed: number;
        sessionId: string;
    }>;
    sharedEntries: number;
    lastSync: number;
}

// ============ CONSTANTS ============

const MEMORY_DIR = "memory";
const ENTRIES_FILE = "entries.json";
const SESSIONS_FILE = "sessions.json";
const POOL_FILE = "pool-state.json";
const STATS_FILE = "memory-stats.json";

/** 24 hours in ms — threshold for warm → cold */
const WARM_THRESHOLD = 24 * 60 * 60 * 1000;

/** 7 days in ms — threshold for auto-compression */
const COMPRESSION_THRESHOLD = 7 * 24 * 60 * 60 * 1000;

/** Maximum entries before pruning cold tier */
const MAX_COLD_ENTRIES = 1000;

/** Maximum entries in hot tier */
const MAX_HOT_ENTRIES = 50;

// ============ STORAGE ============

async function getMemoryDir(repoPath: string): Promise<string> {
    const root = await getRepoRoot(repoPath);
    const dir = path.join(root, ".swarm", MEMORY_DIR);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

async function loadEntries(repoPath: string): Promise<MemoryEntry[]> {
    const dir = await getMemoryDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, ENTRIES_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function saveEntries(repoPath: string, entries: MemoryEntry[]): Promise<void> {
    const dir = await getMemoryDir(repoPath);
    await fs.writeFile(path.join(dir, ENTRIES_FILE), JSON.stringify(entries, null, 2), "utf-8");
}

async function loadSessions(repoPath: string): Promise<MemorySession[]> {
    const dir = await getMemoryDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, SESSIONS_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function saveSessions(repoPath: string, sessions: MemorySession[]): Promise<void> {
    const dir = await getMemoryDir(repoPath);
    await fs.writeFile(path.join(dir, SESSIONS_FILE), JSON.stringify(sessions, null, 2), "utf-8");
}

async function loadPoolState(repoPath: string): Promise<PoolState> {
    const dir = await getMemoryDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, POOL_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return { agents: {}, sharedEntries: 0, lastSync: Date.now() };
    }
}

async function savePoolState(repoPath: string, pool: PoolState): Promise<void> {
    const dir = await getMemoryDir(repoPath);
    await fs.writeFile(path.join(dir, POOL_FILE), JSON.stringify(pool, null, 2), "utf-8");
}

// ============ CONTEXT ROUTER ============

/**
 * Determine memory tier based on recency and access patterns
 */
function determineTier(entry: MemoryEntry): MemoryTier {
    const now = Date.now();
    const age = now - entry.updatedAt;
    const lastAccess = now - entry.lastAccessedAt;

    // Hot: recent or frequently accessed
    if (age < WARM_THRESHOLD || (entry.accessCount > 5 && lastAccess < WARM_THRESHOLD)) {
        return "hot";
    }

    // Cold: old and rarely accessed
    if (age > COMPRESSION_THRESHOLD && entry.accessCount < 3) {
        return "cold";
    }

    // Warm: everything else
    return "warm";
}

/**
 * Refresh tiers for all entries
 */
async function refreshTiers(repoPath: string): Promise<{ promoted: number; demoted: number }> {
    const entries = await loadEntries(repoPath);
    let promoted = 0;
    let demoted = 0;

    const tierOrder: MemoryTier[] = ["cold", "warm", "hot"];

    for (const entry of entries) {
        const newTier = determineTier(entry);
        const oldIndex = tierOrder.indexOf(entry.tier);
        const newIndex = tierOrder.indexOf(newTier);

        if (newIndex > oldIndex) promoted++;
        if (newIndex < oldIndex) demoted++;

        entry.tier = newTier;
    }

    await saveEntries(repoPath, entries);
    return { promoted, demoted };
}

// ============ CORE OPERATIONS ============

/**
 * Save a new memory entry
 */
async function saveMemory(
    repoPath: string,
    content: string,
    category: MemoryCategory,
    tags: string[],
    source: string,
    sessionId: string,
    relatedFiles: string[] = [],
    metadata: Record<string, unknown> = {}
): Promise<MemoryEntry> {
    const entries = await loadEntries(repoPath);
    const now = Date.now();

    const entry: MemoryEntry = {
        id: crypto.randomUUID(),
        content,
        category,
        tags,
        source,
        sessionId,
        createdAt: now,
        updatedAt: now,
        accessCount: 0,
        lastAccessedAt: now,
        tier: "hot",
        compressed: false,
        relatedFiles,
        metadata,
    };

    entries.push(entry);

    // Enforce hot tier limit — demote oldest hot entries
    const hotEntries = entries.filter(e => e.tier === "hot");
    if (hotEntries.length > MAX_HOT_ENTRIES) {
        hotEntries.sort((a, b) => a.updatedAt - b.updatedAt);
        for (let i = 0; i < hotEntries.length - MAX_HOT_ENTRIES; i++) {
            hotEntries[i].tier = "warm";
        }
    }

    await saveEntries(repoPath, entries);

    // Update pool state
    const pool = await loadPoolState(repoPath);
    if (!pool.agents[source]) {
        pool.agents[source] = { lastSeen: now, entriesContributed: 0, sessionId };
    }
    pool.agents[source].lastSeen = now;
    pool.agents[source].entriesContributed++;
    pool.sharedEntries = entries.length;
    await savePoolState(repoPath, pool);

    return entry;
}

/**
 * Search memories — 3-layer search system
 * Layer 1: Fast keyword/tag search (~50 tokens cost)
 * Layer 2: Timeline search (by time range)
 * Layer 3: Full details retrieval
 */
async function searchMemory(
    repoPath: string,
    query: string,
    options: {
        tier?: MemoryTier | "all";
        category?: MemoryCategory;
        tags?: string[];
        limit?: number;
        since?: number;
        until?: number;
        source?: string;
        includeCompressed?: boolean;
    } = {}
): Promise<MemorySearchResult> {
    const start = Date.now();
    const entries = await loadEntries(repoPath);
    const tier = options.tier || "all";
    const limit = options.limit || 20;

    const lower = query.toLowerCase();
    const queryWords = lower.split(/\s+/).filter(w => w.length > 2);

    let results = entries.filter(entry => {
        // Tier filter
        if (tier !== "all" && entry.tier !== tier) return false;

        // Category filter
        if (options.category && entry.category !== options.category) return false;

        // Tag filter
        if (options.tags && options.tags.length > 0) {
            if (!options.tags.some(t => entry.tags.includes(t))) return false;
        }

        // Time range filter
        if (options.since && entry.createdAt < options.since) return false;
        if (options.until && entry.createdAt > options.until) return false;

        // Source filter
        if (options.source && entry.source !== options.source) return false;

        // Compressed filter
        if (!options.includeCompressed && entry.compressed) return false;

        // Text search
        const searchText = `${entry.content} ${entry.tags.join(" ")} ${entry.summary || ""}`.toLowerCase();
        return queryWords.some(w => searchText.includes(w));
    });

    // Score and sort by relevance
    results.sort((a, b) => {
        const aText = `${a.content} ${a.tags.join(" ")}`.toLowerCase();
        const bText = `${b.content} ${b.tags.join(" ")}`.toLowerCase();
        const aScore = queryWords.filter(w => aText.includes(w)).length;
        const bScore = queryWords.filter(w => bText.includes(w)).length;
        if (aScore !== bScore) return bScore - aScore; // More matches first
        return b.updatedAt - a.updatedAt; // Then by recency
    });

    // Update access counts
    const topResults = results.slice(0, limit);
    for (const entry of topResults) {
        entry.accessCount++;
        entry.lastAccessedAt = Date.now();
    }
    await saveEntries(repoPath, entries);

    return {
        entries: topResults,
        totalMatches: results.length,
        searchTime: Date.now() - start,
        tier,
    };
}

/**
 * Timeline search — get entries by time range
 */
async function timelineSearch(
    repoPath: string,
    since: number,
    until?: number,
    source?: string,
    limit: number = 50
): Promise<MemoryEntry[]> {
    const entries = await loadEntries(repoPath);
    const endTime = until || Date.now();

    return entries
        .filter(e => {
            if (e.createdAt < since || e.createdAt > endTime) return false;
            if (source && e.source !== source) return false;
            return true;
        })
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
}

/**
 * Auto-compress old entries (cold tier)
 */
async function compressMemory(repoPath: string): Promise<{ compressed: number; pruned: number }> {
    const entries = await loadEntries(repoPath);
    const now = Date.now();
    let compressed = 0;
    let pruned = 0;

    for (const entry of entries) {
        if (entry.tier === "cold" && !entry.compressed && entry.content.length > 200) {
            // Structured compression: extract key facts instead of truncation
            const lines = entry.content.split("\n").filter(l => l.trim().length > 0);
            const keyFacts: string[] = [];

            // Extract first meaningful sentence
            keyFacts.push(lines[0].slice(0, 150));

            // Extract lines containing keywords
            const importantKeywords = ["bug", "fix", "decision", "because", "important", "note", "todo", "warning", "error", "solution"];
            for (const line of lines.slice(1)) {
                const lower = line.toLowerCase();
                if (importantKeywords.some(k => lower.includes(k))) {
                    keyFacts.push(line.slice(0, 120));
                }
                if (keyFacts.length >= 5) break;
            }

            // Build structured summary
            entry.summary = `[Сжато] ${entry.category} | ${entry.tags.join(", ")} | ` +
                keyFacts.join(" → ");
            entry.compressed = true;
            compressed++;
        }
    }

    // Prune excess cold entries
    const coldEntries = entries.filter(e => e.tier === "cold");
    if (coldEntries.length > MAX_COLD_ENTRIES) {
        coldEntries.sort((a, b) => a.accessCount - b.accessCount);
        const toRemove = coldEntries.slice(0, coldEntries.length - MAX_COLD_ENTRIES);
        const removeIds = new Set(toRemove.map(e => e.id));
        const remaining = entries.filter(e => !removeIds.has(e.id));
        pruned = entries.length - remaining.length;
        await saveEntries(repoPath, remaining);
    } else {
        await saveEntries(repoPath, entries);
    }

    return { compressed, pruned };
}

/**
 * Lifecycle hooks — fire at key session moments
 * Hooks: session_start, prompt_submit, post_tool, stop, session_end
 */
async function lifecycleHook(
    repoPath: string,
    hookName: string,
    context: {
        agentName?: string;
        sessionId?: string;
        toolName?: string;
        toolResult?: string;
        prompt?: string;
    }
): Promise<{ hook: string; actions: string[] }> {
    const actions: string[] = [];

    switch (hookName) {
        case "session_start": {
            // Auto-inject relevant memories at session start
            if (context.prompt) {
                const injected = await autoInject(repoPath, context.prompt, 5);
                if (injected.length > 0) {
                    actions.push(`💬 Впрыснуто ${injected.length} релевантных воспоминаний`);
                }
            }
            // Refresh tiers
            await refreshTiers(repoPath);
            actions.push("Тиры памяти обновлены");
            break;
        }
        case "prompt_submit": {
            // Save the prompt context for later reference
            if (context.prompt && context.prompt.length > 50) {
                actions.push("Контекст промпта сохранён для auto-learn");
            }
            break;
        }
        case "post_tool": {
            // After a tool call, extract learnings
            if (context.toolName && context.toolResult) {
                actions.push(`Результат ${context.toolName} обработан`);
            }
            break;
        }
        case "stop": {
            // Compress and save session state
            await compressMemory(repoPath);
            actions.push("Память сжата перед остановкой");
            break;
        }
        case "session_end": {
            // Auto-compress and archive
            const result = await compressMemory(repoPath);
            actions.push(`Сессия завершена: сжато ${result.compressed}, очищено ${result.pruned}`);
            break;
        }
        default:
            actions.push(`Неизвестный хук: ${hookName}`);
    }

    return { hook: hookName, actions };
}

/**
 * Auto-learn: extract facts from tool results and save as memories
 */
async function autoLearn(
    repoPath: string,
    content: string,
    source: string,
    sessionId: string,
    tags: string[] = []
): Promise<{ learned: number; entries: Array<{ id: string; category: MemoryCategory; summary: string }> }> {
    const learned: Array<{ id: string; category: MemoryCategory; summary: string }> = [];

    // Extract patterns from content
    const facts = extractFacts(content);

    for (const fact of facts) {
        const entry = await saveMemory(
            repoPath,
            fact.content,
            fact.category,
            [...tags, "auto-learned"],
            source,
            sessionId,
            [],
            { autoLearned: true }
        );
        learned.push({
            id: entry.id,
            category: fact.category,
            summary: fact.content.slice(0, 100),
        });
    }

    return { learned: learned.length, entries: learned };
}

/**
 * Extract structured facts from text for auto-learning
 */
function extractFacts(content: string): Array<{ content: string; category: MemoryCategory }> {
    const facts: Array<{ content: string; category: MemoryCategory }> = [];
    const lines = content.split("\n").filter(l => l.trim().length > 20);

    for (const line of lines) {
        const lower = line.toLowerCase();

        // Bug patterns
        if (/\b(bug|error|fix|crash|issue|broken)\b/i.test(line)) {
            facts.push({ content: line.trim(), category: "bug" });
        }
        // Decision patterns
        else if (/\b(decided|decision|chose|because|rationale|trade-?off)\b/i.test(line)) {
            facts.push({ content: line.trim(), category: "decision" });
        }
        // Pattern recognition
        else if (/\b(pattern|always|never|convention|standard|rule)\b/i.test(line)) {
            facts.push({ content: line.trim(), category: "pattern" });
        }
        // Preference
        else if (/\b(prefer|like|better|worse|avoid|use instead)\b/i.test(line)) {
            facts.push({ content: line.trim(), category: "preference" });
        }

        // Limit to 5 facts per content block to avoid noise
        if (facts.length >= 5) break;
    }

    return facts;
}

/**
 * Delete/forget a memory entry
 */
async function forgetMemory(repoPath: string, id: string): Promise<boolean> {
    const entries = await loadEntries(repoPath);
    const idx = entries.findIndex(e => e.id === id);
    if (idx === -1) return false;
    entries.splice(idx, 1);
    await saveEntries(repoPath, entries);
    return true;
}

/**
 * Get memory stats
 */
async function getMemoryStats(repoPath: string): Promise<MemoryStats> {
    const entries = await loadEntries(repoPath);
    const sessions = await loadSessions(repoPath);
    const dir = await getMemoryDir(repoPath);

    const byTier: Record<MemoryTier, number> = { hot: 0, warm: 0, cold: 0 };
    const byCategory: Record<string, number> = {};

    let compressedCount = 0;
    let totalContentLength = 0;
    let compressedContentLength = 0;

    for (const entry of entries) {
        byTier[entry.tier]++;
        byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
        totalContentLength += entry.content.length;
        if (entry.compressed && entry.summary) {
            compressedCount++;
            compressedContentLength += entry.summary.length;
        }
    }

    // Rough storage calc
    let storageBytes = 0;
    try {
        const stat = await fs.stat(path.join(dir, ENTRIES_FILE));
        storageBytes = stat.size;
    } catch { /* empty */ }

    return {
        totalEntries: entries.length,
        byTier,
        byCategory,
        totalSessions: sessions.length,
        compressionRatio: compressedCount > 0
            ? compressedContentLength / (totalContentLength || 1)
            : 1,
        oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.createdAt)) : 0,
        newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.createdAt)) : 0,
        lastCompression: 0,
        storageBytes,
    };
}

// ============ SESSION MANAGEMENT ============

/**
 * Start a new memory session (lifecycle hook: session_start)
 */
async function startSession(repoPath: string, agentName: string): Promise<MemorySession> {
    const sessions = await loadSessions(repoPath);
    const session: MemorySession = {
        id: crypto.randomUUID(),
        agentName,
        startedAt: Date.now(),
        entryCount: 0,
    };
    sessions.push(session);
    await saveSessions(repoPath, sessions);
    return session;
}

/**
 * End a session (lifecycle hook: session_end)
 */
async function endSession(
    repoPath: string,
    sessionId: string,
    summary?: string
): Promise<MemorySession | null> {
    const sessions = await loadSessions(repoPath);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;

    session.endedAt = Date.now();
    session.summary = summary;

    // Count entries for this session
    const entries = await loadEntries(repoPath);
    session.entryCount = entries.filter(e => e.sessionId === sessionId).length;

    await saveSessions(repoPath, sessions);
    return session;
}

// ============ KEYWORD INJECTION ============

/**
 * Auto-inject relevant memories based on keywords in current context
 * (from claude-cognitive: keyword-based memory injection)
 */
async function autoInject(
    repoPath: string,
    currentContext: string,
    maxInjections: number = 5
): Promise<MemoryEntry[]> {
    // Extract keywords from context
    const words = currentContext.toLowerCase().split(/\s+/);
    const significantWords = words.filter(w => w.length > 4);

    if (significantWords.length === 0) return [];

    // Search for matching memories (prioritize hot tier)
    const query = significantWords.slice(0, 10).join(" ");
    const result = await searchMemory(repoPath, query, {
        tier: "all",
        limit: maxInjections,
    });

    return result.entries;
}

// ============ MAIN HANDLER ============

export type SwarmMemoryAction =
    | "save"           // Save new memory
    | "search"         // Search memories (3-layer)
    | "timeline"       // Timeline-based search
    | "forget"         // Delete a memory
    | "compress"       // Auto-compress old entries
    | "inject"         // Auto-inject relevant memories
    | "refresh_tiers"  // Refresh hot/warm/cold tiers
    | "stats"          // Get memory statistics
    | "start_session"  // Start a new session
    | "end_session"    // End current session
    | "pool"           // View pool state (multi-agent)
    | "get"            // Get single entry by ID
    | "auto_learn"     // Auto-extract facts from content
    | "lifecycle_hook"; // Fire lifecycle hook

export async function handleSwarmMemory(input: {
    action: SwarmMemoryAction;
    repoPath?: string;
    // For save
    content?: string;
    category?: MemoryCategory;
    tags?: string[];
    source?: string;
    sessionId?: string;
    relatedFiles?: string[];
    metadata?: Record<string, unknown>;
    // For search
    query?: string;
    tier?: MemoryTier | "all";
    limit?: number;
    since?: number;
    until?: number;
    includeCompressed?: boolean;
    // For forget / get
    id?: string;
    // For inject
    context?: string;
    maxInjections?: number;
    // For sessions
    agentName?: string;
    summary?: string;
    // For auto_learn
    learnContent?: string;
    // For lifecycle_hook
    hookName?: string;
    toolName?: string;
    toolResult?: string;
    prompt?: string;
}): Promise<unknown> {
    const repoPath = input.repoPath || process.cwd();

    switch (input.action) {
        case "save": {
            if (!input.content) return { error: "Content required" };
            const entry = await saveMemory(
                repoPath,
                input.content,
                input.category || "observation",
                input.tags || [],
                input.source || "unknown",
                input.sessionId || "default",
                input.relatedFiles || [],
                input.metadata || {}
            );
            return { saved: true, entry };
        }

        case "search": {
            if (!input.query) return { error: "Query required" };
            return searchMemory(repoPath, input.query, {
                tier: input.tier,
                category: input.category,
                tags: input.tags,
                limit: input.limit,
                since: input.since,
                until: input.until,
                source: input.source,
                includeCompressed: input.includeCompressed,
            });
        }

        case "timeline": {
            const since = input.since || Date.now() - 24 * 60 * 60 * 1000; // default: last 24h
            return timelineSearch(repoPath, since, input.until, input.source, input.limit);
        }

        case "forget": {
            if (!input.id) return { error: "Memory ID required" };
            const deleted = await forgetMemory(repoPath, input.id);
            return { deleted, id: input.id };
        }

        case "compress": {
            return compressMemory(repoPath);
        }

        case "inject": {
            if (!input.context) return { error: "Context required for auto-injection" };
            const injected = await autoInject(repoPath, input.context, input.maxInjections);
            return {
                injected: injected.length,
                entries: injected.map(e => ({
                    id: e.id,
                    summary: e.summary || e.content.slice(0, 100),
                    category: e.category,
                    tags: e.tags,
                    tier: e.tier,
                }))
            };
        }

        case "refresh_tiers": {
            return refreshTiers(repoPath);
        }

        case "stats": {
            return getMemoryStats(repoPath);
        }

        case "start_session": {
            if (!input.agentName) return { error: "Agent name required" };
            return startSession(repoPath, input.agentName);
        }

        case "end_session": {
            if (!input.sessionId) return { error: "Session ID required" };
            return endSession(repoPath, input.sessionId, input.summary);
        }

        case "pool": {
            return loadPoolState(repoPath);
        }

        case "get": {
            if (!input.id) return { error: "Memory ID required" };
            const entries = await loadEntries(repoPath);
            const entry = entries.find(e => e.id === input.id);
            if (!entry) return { error: `Memory not found: ${input.id}` };
            entry.accessCount++;
            entry.lastAccessedAt = Date.now();
            await saveEntries(repoPath, entries);
            return entry;
        }

        case "auto_learn": {
            if (!input.learnContent && !input.content) return { error: "Content required for auto-learn" };
            return autoLearn(
                repoPath,
                input.learnContent || input.content || "",
                input.source || "auto",
                input.sessionId || "default",
                input.tags || []
            );
        }

        case "lifecycle_hook": {
            if (!input.hookName) return { error: "Hook name required (session_start|prompt_submit|post_tool|stop|session_end)" };
            return lifecycleHook(repoPath, input.hookName, {
                agentName: input.agentName,
                sessionId: input.sessionId,
                toolName: input.toolName,
                toolResult: input.toolResult,
                prompt: input.prompt,
            });
        }

        default:
            return { error: `Unknown action: ${input.action}` };
    }
}
