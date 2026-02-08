/**
 * Smart Router Proxy — Intelligent Cost Optimization Layer
 * 
 * MCP Swarm v0.9.20
 * 
 * Inspired by distiq-code. Key ideas:
 * 1. Request Classification — analyze complexity before routing
 * 2. Automatic Downgrade — use cheaper models when possible (Opus → Sonnet → Haiku)
 * 3. Semantic Cache — reuse similar responses (via HNSW)
 * 4. Prompt Caching — auto cache_control breakpoints
 * 
 * Expected savings: 50-70% token cost reduction
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

/**
 * Request complexity classification
 */
type ComplexityLevel = "trivial" | "simple" | "medium" | "complex" | "extreme";

/**
 * Tier recommendation based on complexity
 */
type TierRecommendation = "economy" | "standard" | "premium" | "flagship";

/**
 * Classification result
 */
interface ClassificationResult {
    complexity: ComplexityLevel;
    recommendedTier: TierRecommendation;
    reasoning: string;
    estimatedTokens: number;
    shouldCache: boolean;
    cacheKey?: string;
    /** Downgrade recommendation (e.g., Opus→Sonnet for simple tasks) */
    downgradeHint?: string;
    /** Effort level hint for models supporting /effort parameter */
    effortHint?: string;
}

/**
 * Cache entry for semantic cache
 */
interface CacheEntry {
    key: string;
    promptHash: string;
    response: string;
    model: string;
    tier: string;
    createdAt: number;
    ttlMs: number;
    hitCount: number;
    tokensSaved: number;
    costSaved: number;
}

/**
 * Proxy statistics
 */
interface ProxyStats {
    totalRequests: number;
    downgradedRequests: number;
    cacheHits: number;
    cacheMisses: number;
    totalTokensSaved: number;
    totalCostSaved: number;
    avgSavingsPercent: number;
    byTier: Record<string, { count: number; originalTier: string; savings: number }>;
    lastUpdated: number;
    /** Live savings session tracking */
    sessionSavings: {
        startedAt: number;
        tokensSaved: number;
        costSaved: number;
        requestsProcessed: number;
    };
}

/**
 * Prompt cache configuration for Anthropic
 */
interface PromptCacheConfig {
    enabled: boolean;
    systemPromptCached: boolean;
    toolDefinitionsCached: boolean;
    conversationPrefixCached: boolean;
    cacheHitRate: number;
    estimatedSavings: number; // percentage
}

// ============ CONSTANTS ============

const PROXY_DIR = "smart-router";
const CACHE_DIR = "cache";
const STATS_FILE = "proxy-stats.json";
const CACHE_INDEX_FILE = "cache-index.json";
const CONFIG_FILE = "proxy-config.json";

/** Complexity → Tier mapping */
const COMPLEXITY_TO_TIER: Record<ComplexityLevel, TierRecommendation> = {
    trivial: "economy",     // Simple questions, formatting, typos
    simple: "standard",     // Basic code generation, summaries
    medium: "premium",      // Code review, refactoring, debugging
    complex: "flagship",    // Architecture, complex analysis
    extreme: "flagship",    // Multi-step reasoning, novel solutions
};

/** Keywords that indicate trivial requests */
const TRIVIAL_KEYWORDS = [
    "format", "typo", "rename", "import", "console.log", "console log",
    "hello world", "simple", "basic", "fix typo", "remove unused",
    "add comment", "sort imports", "lint", "prettify",
];

/** Keywords that indicate complex requests */
const COMPLEX_KEYWORDS = [
    "architecture", "design pattern", "optimize", "security audit",
    "refactor entire", "migrate", "scalability", "distributed",
    "machine learning", "algorithm", "concurrent", "thread-safe",
    "microservices", "system design", "state machine",
];

/** Default cache TTL: 7 days (distiq-code style) */
const DEFAULT_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 604800000ms

/** Maximum cache entries (scaled for production) */
const MAX_CACHE_ENTRIES = 10_000;

/** Minimum tokens for prompt caching breakpoint (Anthropic minimum) */
const MIN_CACHEABLE_TOKENS = 1024;

/** Tool compression aliases (ClaudeSlim-inspired) */
const TOOL_ALIASES: Record<string, string> = {
    Bash: "B", Read: "R", Write: "W", Grep: "S", Glob: "G",
    TodoRead: "TR", TodoWrite: "TW", MultiEdit: "ME",
    // MCP Swarm aliases
    swarm_task: "ST", swarm_file: "SF", swarm_chat: "SC",
    swarm_agent: "SA", swarm_git: "SG", swarm_review: "SR",
};

/** Parameter key compression map */
const PARAM_ALIASES: Record<string, string> = {
    file_path: "f", command: "c", pattern: "p", content: "t",
    description: "d", timeout: "to", working_directory: "wd",
    regex: "rx", include: "in", exclude: "ex",
};

/** Max description length for compressed tools */
const MAX_COMPRESSED_DESC_LENGTH = 100;

// ============ CLASSIFICATION ============

/**
 * Classify request complexity to determine optimal model tier
 */
function classifyRequest(content: string): ClassificationResult {
    const lower = content.toLowerCase();
    const wordCount = content.split(/\s+/).length;
    const lineCount = content.split("\n").length;
    const hasCode = /```[\s\S]*```/.test(content) || /\b(function|class|const|let|var|import|export)\b/.test(content);

    // Estimate tokens (rough: 1 token ≈ 4 chars)
    const estimatedTokens = Math.ceil(content.length / 4);

    // Score complexity
    let score = 0;

    // Length factors
    if (wordCount < 20) score -= 2;
    else if (wordCount < 50) score -= 1;
    else if (wordCount > 200) score += 2;
    else if (wordCount > 500) score += 3;

    // Keyword matching
    const trivialMatches = TRIVIAL_KEYWORDS.filter(k => lower.includes(k)).length;
    const complexMatches = COMPLEX_KEYWORDS.filter(k => lower.includes(k)).length;
    score -= trivialMatches * 2;
    score += complexMatches * 3;

    // Code presence
    if (hasCode) score += 1;
    if (lineCount > 50) score += 2;

    // Question complexity
    if (lower.includes("?") && wordCount < 15) score -= 1;
    if (lower.startsWith("how to ") || lower.startsWith("what is ")) score -= 1;
    if (lower.includes("explain ") && wordCount < 30) score -= 1;

    // Multi-step indicators
    if (/\b(step \d|first|then|finally|also|additionally)\b/i.test(content)) score += 1;
    if (/\b(compare|analyze|evaluate|trade-?off)\b/i.test(content)) score += 2;

    // Determine complexity level
    let complexity: ComplexityLevel;
    if (score <= -3) complexity = "trivial";
    else if (score <= 0) complexity = "simple";
    else if (score <= 3) complexity = "medium";
    else if (score <= 6) complexity = "complex";
    else complexity = "extreme";

    const recommendedTier = COMPLEXITY_TO_TIER[complexity];

    // Generate reasoning
    const reasons: string[] = [];
    if (trivialMatches > 0) reasons.push(`trivial keywords: ${trivialMatches}`);
    if (complexMatches > 0) reasons.push(`complex keywords: ${complexMatches}`);
    if (wordCount < 20) reasons.push("very short request");
    if (wordCount > 200) reasons.push("long request");
    if (hasCode) reasons.push("contains code");

    // Downgrade hint: recommend cheaper model for simple tasks
    let downgradeHint: string | undefined;
    if (complexity === "trivial" || complexity === "simple") {
        downgradeHint = "Opus→Sonnet: задача достаточно простая для Sonnet 4.5, экономия ~70%";
    } else if (complexity === "medium" && !hasCode) {
        downgradeHint = "Opus→Sonnet: средняя без кода, Sonnet 4.5 справится, экономия ~40%";
    }

    // Effort level hint for models supporting /effort
    let effortHint: string | undefined;
    if (complexity === "trivial") {
        effortHint = "/effort low — минимальная вычислительная мощность";
    } else if (complexity === "simple") {
        effortHint = "/effort medium — баланс скорости и качества";
    }

    // Should cache? — cache trivial/simple/medium, not complex/extreme
    const shouldCache = complexity !== "complex" && complexity !== "extreme" && estimatedTokens < 2000;
    const cacheKey = shouldCache ? crypto.createHash("sha256").update(lower.trim()).digest("hex").slice(0, 16) : undefined;

    return {
        complexity,
        recommendedTier,
        reasoning: `score=${score}, ${reasons.join(", ")}`,
        estimatedTokens,
        shouldCache,
        cacheKey,
        downgradeHint,
        effortHint,
    };
}

// ============ SIMILARITY (Jaccard N-gram) ============

/**
 * Generate character n-grams from text
 */
function generateNgrams(text: string, n: number = 3): Set<string> {
    const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    const ngrams = new Set<string>();
    for (let i = 0; i <= normalized.length - n; i++) {
        ngrams.add(normalized.slice(i, i + n));
    }
    return ngrams;
}

/**
 * Calculate Jaccard similarity between two texts using n-grams.
 * Returns a value between 0.0 (no overlap) and 1.0 (identical).
 */
function calculateSimilarity(textA: string, textB: string, ngramSize: number = 3): number {
    const gramsA = generateNgrams(textA, ngramSize);
    const gramsB = generateNgrams(textB, ngramSize);

    if (gramsA.size === 0 && gramsB.size === 0) return 1.0;
    if (gramsA.size === 0 || gramsB.size === 0) return 0.0;

    let intersection = 0;
    for (const gram of gramsA) {
        if (gramsB.has(gram)) intersection++;
    }

    const union = gramsA.size + gramsB.size - intersection;
    return union > 0 ? intersection / union : 0;
}

// ============ TF-IDF COSINE SIMILARITY ============

/**
 * Build a simple TF-IDF term-frequency map from text.
 * Uses word-level tokens (code-aware: preserves camelCase, snake_case).
 */
function buildTfVector(text: string): Map<string, number> {
    const tokens = text.toLowerCase()
        .replace(/[^a-z0-9_]+/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 1);
    const tf = new Map<string, number>();
    for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
    }
    // Normalize by max frequency
    const maxFreq = Math.max(...tf.values(), 1);
    for (const [k, v] of tf) {
        tf.set(k, v / maxFreq);
    }
    return tf;
}

/**
 * Calculate cosine similarity between two TF vectors.
 * More accurate than Jaccard for semantic similarity.
 * Returns 0.0 (orthogonal) to 1.0 (identical).
 */
function calculateCosineSimilarity(textA: string, textB: string): number {
    const vecA = buildTfVector(textA);
    const vecB = buildTfVector(textB);

    if (vecA.size === 0 && vecB.size === 0) return 1.0;
    if (vecA.size === 0 || vecB.size === 0) return 0.0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const [term, weightA] of vecA) {
        normA += weightA * weightA;
        const weightB = vecB.get(term) || 0;
        dotProduct += weightA * weightB;
    }
    for (const [, weightB] of vecB) {
        normB += weightB * weightB;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * Combined similarity: weighted average of Jaccard (surface) and Cosine (semantic).
 * Weights: 40% Jaccard + 60% Cosine for better semantic matching.
 */
function calculateCombinedSimilarity(textA: string, textB: string): number {
    const jaccard = calculateSimilarity(textA, textB);
    const cosine = calculateCosineSimilarity(textA, textB);
    return jaccard * 0.4 + cosine * 0.6;
}

// ============ SEMANTIC CACHE ============

/**
 * Get cache directory path
 */
async function getCacheDir(repoPath: string): Promise<string> {
    const root = await getRepoRoot(repoPath);
    const dir = path.join(root, ".swarm", PROXY_DIR, CACHE_DIR);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

/**
 * Get proxy directory path
 */
async function getProxyDir(repoPath: string): Promise<string> {
    const root = await getRepoRoot(repoPath);
    const dir = path.join(root, ".swarm", PROXY_DIR);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

/**
 * Load cache index
 */
async function loadCacheIndex(repoPath: string): Promise<CacheEntry[]> {
    const dir = await getProxyDir(repoPath);
    const filePath = path.join(dir, CACHE_INDEX_FILE);
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

/**
 * Save cache index
 */
async function saveCacheIndex(repoPath: string, entries: CacheEntry[]): Promise<void> {
    const dir = await getProxyDir(repoPath);
    const filePath = path.join(dir, CACHE_INDEX_FILE);
    await fs.writeFile(filePath, JSON.stringify(entries, null, 2), "utf-8");
}

/**
 * Look up cache by key
 */
async function cacheLookup(repoPath: string, cacheKey: string): Promise<CacheEntry | null> {
    const entries = await loadCacheIndex(repoPath);
    const now = Date.now();

    const entry = entries.find(e =>
        e.key === cacheKey &&
        (now - e.createdAt) < e.ttlMs
    );

    if (entry) {
        // Update hit count
        entry.hitCount++;
        await saveCacheIndex(repoPath, entries);
        return entry;
    }

    return null;
}

/**
 * Store response in cache
 */
async function cacheStore(
    repoPath: string,
    key: string,
    promptHash: string,
    response: string,
    model: string,
    tier: string,
    tokensSaved: number,
    costSaved: number
): Promise<void> {
    const entries = await loadCacheIndex(repoPath);

    // Remove expired entries
    const now = Date.now();
    const valid = entries.filter(e => (now - e.createdAt) < e.ttlMs);

    // Evict oldest if at capacity
    while (valid.length >= MAX_CACHE_ENTRIES) {
        valid.sort((a, b) => a.createdAt - b.createdAt);
        valid.shift();
    }

    valid.push({
        key,
        promptHash,
        response,
        model,
        tier,
        createdAt: now,
        ttlMs: DEFAULT_CACHE_TTL,
        hitCount: 0,
        tokensSaved,
        costSaved,
    });

    await saveCacheIndex(repoPath, valid);
}

/**
 * Clean expired cache entries
 */
async function cacheClean(repoPath: string): Promise<{ removed: number; remaining: number }> {
    const entries = await loadCacheIndex(repoPath);
    const now = Date.now();
    const valid = entries.filter(e => (now - e.createdAt) < e.ttlMs);

    await saveCacheIndex(repoPath, valid);
    return { removed: entries.length - valid.length, remaining: valid.length };
}

// ============ STATS ============

/**
 * Load proxy stats
 */
async function loadStats(repoPath: string): Promise<ProxyStats> {
    const dir = await getProxyDir(repoPath);
    const filePath = path.join(dir, STATS_FILE);
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw);
    } catch {
        return {
            totalRequests: 0,
            downgradedRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            totalTokensSaved: 0,
            totalCostSaved: 0,
            avgSavingsPercent: 0,
            byTier: {},
            lastUpdated: Date.now(),
            sessionSavings: {
                startedAt: Date.now(),
                tokensSaved: 0,
                costSaved: 0,
                requestsProcessed: 0,
            },
        };
    }
}

/**
 * Save proxy stats
 */
async function saveStats(repoPath: string, stats: ProxyStats): Promise<void> {
    const dir = await getProxyDir(repoPath);
    const filePath = path.join(dir, STATS_FILE);
    stats.lastUpdated = Date.now();
    await fs.writeFile(filePath, JSON.stringify(stats, null, 2), "utf-8");
}

/**
 * Record a routing decision for analytics
 */
async function recordRouting(
    repoPath: string,
    originalTier: string,
    finalTier: string,
    tokensSaved: number,
    costSaved: number,
    wasCacheHit: boolean
): Promise<void> {
    const stats = await loadStats(repoPath);

    stats.totalRequests++;
    if (originalTier !== finalTier) {
        stats.downgradedRequests++;
    }
    if (wasCacheHit) {
        stats.cacheHits++;
    } else {
        stats.cacheMisses++;
    }

    stats.totalTokensSaved += tokensSaved;
    stats.totalCostSaved += costSaved;

    if (stats.totalRequests > 0) {
        stats.avgSavingsPercent = (stats.downgradedRequests + stats.cacheHits) / stats.totalRequests * 100;
    }

    // Track by tier
    if (!stats.byTier[finalTier]) {
        stats.byTier[finalTier] = { count: 0, originalTier, savings: 0 };
    }
    stats.byTier[finalTier].count++;
    stats.byTier[finalTier].savings += costSaved;

    // Update session savings
    if (!stats.sessionSavings) {
        stats.sessionSavings = { startedAt: Date.now(), tokensSaved: 0, costSaved: 0, requestsProcessed: 0 };
    }
    stats.sessionSavings.tokensSaved += tokensSaved;
    stats.sessionSavings.costSaved += costSaved;
    stats.sessionSavings.requestsProcessed++;

    await saveStats(repoPath, stats);
}

// ============ PROMPT CACHING ============

/**
 * Generate cache_control breakpoint suggestions for Anthropic API
 */
function generateCacheBreakpoints(messages: Array<{ role: string; content: string }>): {
    breakpoints: Array<{ index: number; type: string; reason: string }>;
    estimatedSavings: string;
} {
    const breakpoints: Array<{ index: number; type: string; reason: string }> = [];

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];

        // System prompts should always be cached
        if (msg.role === "system") {
            breakpoints.push({
                index: i,
                type: "ephemeral",
                reason: "System prompt — cache for 90% input discount",
            });
        }

        // Tool definitions (usually early in conversation)
        if (msg.content.includes("function") && msg.content.includes("parameters") && i < 5) {
            breakpoints.push({
                index: i,
                type: "ephemeral",
                reason: "Tool definitions — stable content, good cache candidate",
            });
        }

        // Long context blocks
        if (msg.content.length > 4000 && i < messages.length - 2) {
            breakpoints.push({
                index: i,
                type: "ephemeral",
                reason: `Long content block (${Math.ceil(msg.content.length / 4)} tokens) — cache prefix`,
            });
        }

        // Repeated content detection — cache duplicate messages
        if (i > 0) {
            const prevMsg = messages[i - 1];
            if (prevMsg.role === msg.role && calculateSimilarity(prevMsg.content, msg.content) > 0.85) {
                breakpoints.push({
                    index: i - 1,
                    type: "ephemeral",
                    reason: `Similar consecutive messages detected (similarity >85%) — cache prefix up to [${i - 1}]`,
                });
            }
        }
    }

    // Calculate estimated savings based on breakpoint types
    const systemBreakpoints = breakpoints.filter(b => b.reason.includes("System")).length;
    const toolBreakpoints = breakpoints.filter(b => b.reason.includes("Tool")).length;
    const longBreakpoints = breakpoints.filter(b => b.reason.includes("Long")).length;
    const savingPercent = Math.min(90,
        systemBreakpoints * 30 + toolBreakpoints * 20 + longBreakpoints * 15 + (breakpoints.length > 3 ? 10 : 0)
    );

    const estimatedSavings = breakpoints.length > 0
        ? `~${savingPercent}% input cost reduction (Anthropic prompt caching, ${breakpoints.length} breakpoints)`
        : "No caching opportunities detected";

    return { breakpoints, estimatedSavings };
}

// ============ TOOL DEFINITION COMPRESSION (ClaudeSlim-inspired) ============

/**
 * Compress tool definitions to save ~100-300 tokens per request.
 * Inspired by distiq-code ClaudeSlim approach.
 * 
 * What gets compressed:
 * - Tool names: "Bash" → "B", "Read" → "R", "swarm_task" → "ST"
 * - Parameter keys: "file_path" → "f", "command" → "c"
 * - Long descriptions: truncated to 100 chars
 * 
 * ⚠️ Experimental: may break if Claude updates internal tool schemas.
 * Disable with toolCompressionEnabled=false if issues arise.
 */
function compressToolDefinitions(tools: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
}>): {
    compressed: Array<{ name: string; description?: string; parameters?: Record<string, unknown> }>;
    originalNames: Record<string, string>; // alias → original name mapping
    tokensSaved: number;
    compressionRatio: string;
} {
    const originalNames: Record<string, string> = {};
    let originalTokens = 0;
    let compressedTokens = 0;

    const compressed = tools.map(tool => {
        const originalJson = JSON.stringify(tool);
        originalTokens += Math.ceil(originalJson.length / 4);

        // Compress tool name
        const alias = TOOL_ALIASES[tool.name] || tool.name;
        originalNames[alias] = tool.name;

        // Compress description
        let desc = tool.description;
        if (desc && desc.length > MAX_COMPRESSED_DESC_LENGTH) {
            desc = desc.slice(0, MAX_COMPRESSED_DESC_LENGTH) + "…";
        }

        // Compress parameter keys
        let params = tool.parameters;
        if (params && typeof params === "object" && (params as Record<string, unknown>).properties) {
            const compressed: Record<string, unknown> = { ...params };
            const props = { ...(params as Record<string, Record<string, unknown>>).properties };
            const newProps: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(props)) {
                const alias = PARAM_ALIASES[key] || key;
                newProps[alias] = value;
            }
            compressed.properties = newProps;
            params = compressed;
        }

        const result = { name: alias, description: desc, parameters: params };
        compressedTokens += Math.ceil(JSON.stringify(result).length / 4);
        return result;
    });

    const tokensSaved = Math.max(0, originalTokens - compressedTokens);
    const ratio = originalTokens > 0
        ? ((tokensSaved / originalTokens) * 100).toFixed(1)
        : "0.0";

    return {
        compressed,
        originalNames,
        tokensSaved,
        compressionRatio: `${ratio}% (${tokensSaved} tokens saved)`,
    };
}

/**
 * Check if a request involves tool usage (should skip semantic cache)
 */
function isToolUseRequest(content: string): boolean {
    return /\b(tool_use|function_call|tool_result|tool_code)\b/i.test(content) ||
        /"type"\s*:\s*"tool_use"/i.test(content);
}

// ============ MAIN PROXY HANDLER ============

export type SmartRouterAction =
    | "analyze"        // Classify request and recommend tier
    | "proxy_route"    // Route with automatic downgrade
    | "cache_lookup"   // Check semantic cache
    | "cache_store"    // Store in semantic cache
    | "cache_clean"    // Clean expired entries
    | "cache_stats"    // Cache statistics
    | "prompt_cache"   // Generate prompt caching suggestions
    | "compress_tools" // Compress tool definitions (ClaudeSlim-style)
    | "stats"          // Get proxy statistics
    | "config"         // Get proxy configuration
    | "set_config";    // Update proxy configuration

interface ProxyConfig {
    enabled: boolean;
    autoDowngrade: boolean;
    semanticCacheEnabled: boolean;
    promptCacheEnabled: boolean;
    toolCompressionEnabled: boolean;     // ClaudeSlim-стиль: сжатие tool definitions
    useCombinedSimilarity: boolean;      // true = Cosine+Jaccard, false = Jaccard only
    maxDowngradeLevels: number;          // How many tiers to downgrade
    cacheTtlMs: number;
    minSimilarityForCache: number;       // 0.0-1.0 (default 0.85 = distiq-code threshold)
    maxCacheEntries: number;             // Max cache size
    skipToolUseCache: boolean;           // Never cache tool-use conversations
    forceMinTier?: TierRecommendation;   // Never downgrade below this
}

const DEFAULT_PROXY_CONFIG: ProxyConfig = {
    enabled: true,
    autoDowngrade: true,
    semanticCacheEnabled: true,
    promptCacheEnabled: true,
    toolCompressionEnabled: false,       // ⚠️ Experimental: отключено по умолчанию
    useCombinedSimilarity: true,         // Cosine+Jaccard лучше чем только Jaccard
    maxDowngradeLevels: 2,
    cacheTtlMs: DEFAULT_CACHE_TTL,       // 7 дней
    minSimilarityForCache: 0.85,         // distiq-code threshold (было 0.92)
    maxCacheEntries: MAX_CACHE_ENTRIES,  // 10,000
    skipToolUseCache: true,              // Tool-use никогда не кэшируются
    forceMinTier: undefined,
};

/**
 * Load proxy config
 */
async function loadConfig(repoPath: string): Promise<ProxyConfig> {
    const dir = await getProxyDir(repoPath);
    const filePath = path.join(dir, CONFIG_FILE);
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return { ...DEFAULT_PROXY_CONFIG, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_PROXY_CONFIG };
    }
}

/**
 * Save proxy config
 */
async function saveConfig(repoPath: string, config: ProxyConfig): Promise<void> {
    const dir = await getProxyDir(repoPath);
    const filePath = path.join(dir, CONFIG_FILE);
    await fs.writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");
}

// ============ MAIN HANDLER ============

export async function handleSmartRouterProxy(input: {
    action: SmartRouterAction;
    repoPath?: string;
    // For analyze / proxy_route
    content?: string;
    requestedTier?: TierRecommendation;
    // For cache operations
    cacheKey?: string;
    response?: string;
    model?: string;
    tier?: string;
    tokensSaved?: number;
    costSaved?: number;
    // For prompt_cache
    messages?: Array<{ role: string; content: string }>;
    // For compress_tools
    tools?: Array<{ name: string; description?: string; parameters?: Record<string, unknown> }>;
    // For set_config
    config?: Partial<ProxyConfig>;
}): Promise<unknown> {
    const repoPath = input.repoPath || process.cwd();

    switch (input.action) {
        case "analyze": {
            if (!input.content) return { error: "Content required for analysis" };

            const classification = classifyRequest(input.content);
            const requestedTier = input.requestedTier || "flagship";

            const downgraded = classification.recommendedTier !== requestedTier;
            const tierOrder: TierRecommendation[] = ["economy", "standard", "premium", "flagship"];
            const originalIndex = tierOrder.indexOf(requestedTier);
            const recommendedIndex = tierOrder.indexOf(classification.recommendedTier);
            const levelsDown = originalIndex - recommendedIndex;

            return {
                classification,
                originalTier: requestedTier,
                suggestedTier: classification.recommendedTier,
                downgraded,
                levelsDown: Math.max(0, levelsDown),
                potentialSavings: downgraded
                    ? `~${Math.min(90, levelsDown * 30)}% cost reduction`
                    : "No savings — request requires requested tier",
            };
        }

        case "proxy_route": {
            if (!input.content) return { error: "Content required for routing" };

            const config = await loadConfig(repoPath);
            const classification = classifyRequest(input.content);
            const requestedTier = input.requestedTier || "flagship";

            let finalTier: TierRecommendation = requestedTier;
            let wasCached = false;
            let savings = { tokensSaved: 0, costSaved: 0 };

            // Step 1: Check semantic cache
            if (config.semanticCacheEnabled && classification.shouldCache && classification.cacheKey) {
                const cached = await cacheLookup(repoPath, classification.cacheKey);
                if (cached) {
                    wasCached = true;
                    savings.tokensSaved = classification.estimatedTokens * 2; // input + output
                    savings.costSaved = savings.tokensSaved * 0.005; // rough estimate

                    await recordRouting(repoPath, requestedTier, "cached", savings.tokensSaved, savings.costSaved, true);

                    return {
                        source: "cache",
                        cacheKey: classification.cacheKey,
                        response: cached.response,
                        model: cached.model,
                        tokensSaved: savings.tokensSaved,
                        costSaved: savings.costSaved,
                        hitCount: cached.hitCount,
                    };
                }
            }

            // Step 2: Auto-downgrade if enabled
            if (config.autoDowngrade) {
                const tierOrder: TierRecommendation[] = ["economy", "standard", "premium", "flagship"];
                const requestedIndex = tierOrder.indexOf(requestedTier);
                const recommendedIndex = tierOrder.indexOf(classification.recommendedTier);

                // Don't downgrade more than maxDowngradeLevels
                const maxDownIndex = Math.max(0, requestedIndex - config.maxDowngradeLevels);
                const finalIndex = Math.max(maxDownIndex, recommendedIndex);

                // Respect forceMinTier
                if (config.forceMinTier) {
                    const minIndex = tierOrder.indexOf(config.forceMinTier);
                    finalTier = tierOrder[Math.max(finalIndex, minIndex)];
                } else {
                    finalTier = tierOrder[finalIndex];
                }
            }

            await recordRouting(repoPath, requestedTier, finalTier, savings.tokensSaved, savings.costSaved, false);

            return {
                source: "moe_router",
                classification,
                originalTier: requestedTier,
                finalTier,
                downgraded: finalTier !== requestedTier,
                cacheKey: classification.cacheKey,
                message: finalTier !== requestedTier
                    ? `Downgraded ${requestedTier} → ${finalTier} (complexity: ${classification.complexity})`
                    : `Using requested tier: ${requestedTier}`,
            };
        }

        case "cache_lookup": {
            if (!input.cacheKey) return { error: "Cache key required" };
            const entry = await cacheLookup(repoPath, input.cacheKey);
            return entry
                ? { hit: true, entry }
                : { hit: false, cacheKey: input.cacheKey };
        }

        case "cache_store": {
            if (!input.cacheKey || !input.response) return { error: "Cache key and response required" };
            await cacheStore(
                repoPath,
                input.cacheKey,
                crypto.createHash("sha256").update(input.content || "").digest("hex"),
                input.response,
                input.model || "unknown",
                input.tier || "standard",
                input.tokensSaved || 0,
                input.costSaved || 0
            );
            return { stored: true, cacheKey: input.cacheKey };
        }

        case "cache_clean": {
            return cacheClean(repoPath);
        }

        case "cache_stats": {
            const entries = await loadCacheIndex(repoPath);
            const now = Date.now();
            const active = entries.filter(e => (now - e.createdAt) < e.ttlMs);
            const totalHits = active.reduce((sum, e) => sum + e.hitCount, 0);
            const totalSaved = active.reduce((sum, e) => sum + e.costSaved * e.hitCount, 0);

            return {
                totalEntries: entries.length,
                activeEntries: active.length,
                expiredEntries: entries.length - active.length,
                totalHits,
                totalCostSaved: totalSaved,
                avgHitsPerEntry: active.length > 0 ? totalHits / active.length : 0,
            };
        }

        case "prompt_cache": {
            if (!input.messages || input.messages.length === 0) {
                return { error: "Messages array required for prompt cache analysis" };
            }
            return generateCacheBreakpoints(input.messages);
        }

        case "compress_tools": {
            if (!input.tools || input.tools.length === 0) {
                return { error: "Tools array required for compression" };
            }
            const config = await loadConfig(repoPath);
            if (!config.toolCompressionEnabled) {
                return {
                    warning: "Tool compression is disabled. Enable with set_config({ toolCompressionEnabled: true })",
                    compressed: input.tools,
                    tokensSaved: 0,
                };
            }
            return compressToolDefinitions(input.tools);
        }

        case "stats": {
            return loadStats(repoPath);
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

        default:
            return { error: `Unknown action: ${input.action}` };
    }
}
