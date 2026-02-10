/**
 * Embeddings Cascade — Multi-provider embedding system
 * 
 * MCP Swarm v1.2.0
 * 
 * Priority: Ollama (free) → OpenAI (paid) → simpleEmbed v2 (offline)
 * Includes semantic caching, rate limiting, and cost tracking.
 */

import { createHash } from "node:crypto";
import { getVaultSecret } from "./vault.js";
import { loadSwarmConfig } from "./setupWizard.js";

// ============ TYPES ============

export type Vector = number[];

export type EmbeddingProvider = "ollama" | "openai" | "builtin";

interface EmbeddingResult {
    vector: Vector;
    provider: EmbeddingProvider;
    dimensions: number;
    cached: boolean;
    costUsd?: number;
}

// ============ SEMANTIC CACHE ============

const embeddingCache = new Map<string, { vector: Vector; provider: EmbeddingProvider; timestamp: number }>();
const MAX_CACHE_SIZE = 5000;

function getCacheKey(text: string): string {
    return createHash("sha256").update(text.trim().toLowerCase()).digest("hex").slice(0, 16);
}

function getCachedEmbedding(text: string): { vector: Vector; provider: EmbeddingProvider } | null {
    const key = getCacheKey(text);
    const entry = embeddingCache.get(key);
    if (entry) {
        return { vector: entry.vector, provider: entry.provider };
    }
    return null;
}

function setCachedEmbedding(text: string, vector: Vector, provider: EmbeddingProvider): void {
    if (embeddingCache.size >= MAX_CACHE_SIZE) {
        // Evict oldest entries
        const entries = Array.from(embeddingCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        for (let i = 0; i < MAX_CACHE_SIZE / 4; i++) {
            embeddingCache.delete(entries[i][0]);
        }
    }
    embeddingCache.set(getCacheKey(text), { vector, provider, timestamp: Date.now() });
}

// ============ RATE LIMITER ============

interface RateLimiterState {
    requests: number[];
    maxPerMinute: number;
}

const rateLimiters = new Map<string, RateLimiterState>();

function checkRateLimit(provider: string, maxPerMinute: number): boolean {
    const now = Date.now();
    let state = rateLimiters.get(provider);
    if (!state) {
        state = { requests: [], maxPerMinute };
        rateLimiters.set(provider, state);
    }

    // Clean old entries
    state.requests = state.requests.filter(t => now - t < 60000);

    if (state.requests.length >= maxPerMinute) {
        return false; // Rate limited
    }

    state.requests.push(now);
    return true;
}

// ============ COST TRACKING ============

let sessionCostUsd = 0;
let sessionTokens = 0;

export function getEmbeddingCosts(): { costUsd: number; tokens: number } {
    return { costUsd: sessionCostUsd, tokens: sessionTokens };
}

export function resetEmbeddingCosts(): void {
    sessionCostUsd = 0;
    sessionTokens = 0;
}

// ============ SIMPLE EMBED v2 ============

/**
 * Enhanced simpleEmbed with bi-grams, char-ngrams, TF-IDF, positional awareness.
 * Better than v1 bag-of-words. Still offline and zero-dependency.
 */
export function simpleEmbedV2(text: string, dimensions: number = 384): Vector {
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, " ");
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    const vector = new Array(dimensions).fill(0);

    if (words.length === 0) return vector;

    // Word frequencies for TF-IDF weighting
    const wordFreq = new Map<string, number>();
    for (const w of words) {
        wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    }

    // Stable hash function
    function hash(s: string): number {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = ((h << 5) - h) + s.charCodeAt(i);
            h = h & h;
        }
        return Math.abs(h);
    }

    // 1. Unigrams with TF-IDF weight
    for (const [word, freq] of wordFreq) {
        const tf = freq / words.length;
        const idf = Math.log(1 + 1 / (freq + 0.5)); // Simplified IDF
        const weight = tf * idf;

        const idx = hash(word) % dimensions;
        vector[idx] += weight;

        // Secondary hash for better distribution
        const idx2 = hash(word + "_2") % dimensions;
        vector[idx2] += weight * 0.5;
    }

    // 2. Bi-grams
    for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]}_${words[i + 1]}`;
        const idx = hash(bigram) % dimensions;
        vector[idx] += 0.7;
    }

    // 3. Character n-grams (2-3 chars)
    for (const word of words) {
        for (let n = 2; n <= 3 && n <= word.length; n++) {
            for (let i = 0; i <= word.length - n; i++) {
                const ngram = word.slice(i, i + n);
                const idx = hash(`char_${ngram}`) % dimensions;
                vector[idx] += 0.3;
            }
        }
    }

    // 4. Positional encoding
    for (let i = 0; i < words.length; i++) {
        const posWeight = 1.0 - (i / (words.length * 2)); // earlier words weigh more
        const idx = hash(`pos_${words[i]}`) % dimensions;
        vector[idx] += posWeight * 0.4;
    }

    // 5. Text statistics features (dedicated dimensions)
    const statsBase = dimensions - 10;
    if (statsBase > 0) {
        vector[statsBase] = Math.min(words.length / 100, 1);        // length
        vector[statsBase + 1] = wordFreq.size / words.length;        // vocab richness
        vector[statsBase + 2] = text.split(/[.!?]/).length / 10;    // sentence count
        vector[statsBase + 3] = words.filter(w => w.length > 6).length / words.length;  // long words ratio
    }

    // Normalize to unit vector
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
        for (let i = 0; i < dimensions; i++) {
            vector[i] /= norm;
        }
    }

    return vector;
}

// ============ OLLAMA EMBEDDINGS ============

async function ollamaEmbed(text: string, url?: string, model?: string): Promise<Vector | null> {
    const baseUrl = url || process.env.OLLAMA_URL || "http://localhost:11434";
    const modelName = model || process.env.OLLAMA_MODEL || "nomic-embed-text";

    try {
        const response = await fetch(`${baseUrl}/api/embeddings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: modelName, prompt: text }),
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) return null;

        const data = await response.json() as { embedding?: number[] };
        return data.embedding || null;
    } catch {
        return null;
    }
}

// ============ OPENAI EMBEDDINGS ============

async function openaiEmbed(text: string): Promise<{ vector: Vector; tokens: number } | null> {
    const apiKey = getVaultSecret("OPENAI_API_KEY") || process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    if (!checkRateLimit("openai", 3000)) {
        return null; // Rate limited
    }

    try {
        const response = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "text-embedding-3-small",
                input: text,
            }),
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) return null;

        const data = await response.json() as {
            data?: Array<{ embedding: number[] }>;
            usage?: { total_tokens: number };
        };

        const vector = data.data?.[0]?.embedding;
        const tokens = data.usage?.total_tokens || 0;

        if (!vector) return null;

        return { vector, tokens };
    } catch {
        return null;
    }
}

// ============ CASCADE EMBED ============

/**
 * Main embedding function with cascading fallback.
 * Ollama → OpenAI → simpleEmbed v2
 */
export async function cascadeEmbed(
    text: string,
    repoPath?: string,
): Promise<EmbeddingResult> {
    // 1. Check cache first
    const cached = getCachedEmbedding(text);
    if (cached) {
        return {
            vector: cached.vector,
            provider: cached.provider,
            dimensions: cached.vector.length,
            cached: true,
        };
    }

    // Load config for provider preference
    const config = await loadSwarmConfig(repoPath);
    const preferredProvider = config?.vector?.embeddingProvider || "builtin";

    // 2. Try preferred provider first
    if (preferredProvider === "ollama" || !config) {
        const ollamaResult = await ollamaEmbed(
            text,
            config?.vector?.ollamaUrl,
            config?.vector?.ollamaModel,
        );
        if (ollamaResult) {
            setCachedEmbedding(text, ollamaResult, "ollama");
            return {
                vector: ollamaResult,
                provider: "ollama",
                dimensions: ollamaResult.length,
                cached: false,
            };
        }
    }

    // 3. Try OpenAI
    if (preferredProvider === "openai" || preferredProvider === "ollama") {
        const openaiResult = await openaiEmbed(text);
        if (openaiResult) {
            // Track cost: ~$0.02 per 1M tokens
            const cost = (openaiResult.tokens / 1_000_000) * 0.02;
            sessionCostUsd += cost;
            sessionTokens += openaiResult.tokens;

            setCachedEmbedding(text, openaiResult.vector, "openai");
            return {
                vector: openaiResult.vector,
                provider: "openai",
                dimensions: openaiResult.vector.length,
                cached: false,
                costUsd: cost,
            };
        }
    }

    // 4. Fallback: simpleEmbed v2
    const dimensions = config?.vector?.dimensions || 384;
    const vector = simpleEmbedV2(text, dimensions);
    setCachedEmbedding(text, vector, "builtin");

    return {
        vector,
        provider: "builtin",
        dimensions,
        cached: false,
    };
}

/**
 * Batch embed multiple texts efficiently
 */
export async function batchEmbed(
    texts: string[],
    repoPath?: string,
): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    for (const text of texts) {
        results.push(await cascadeEmbed(text, repoPath));
    }
    return results;
}

// ============ HEALTH CHECK ============

export async function checkEmbeddingHealth(repoPath?: string): Promise<{
    ollama: { available: boolean; model?: string; url?: string };
    openai: { available: boolean; hasKey: boolean };
    builtin: { available: true };
    activeProvider: EmbeddingProvider;
}> {
    const config = await loadSwarmConfig(repoPath);

    // Check Ollama
    let ollamaAvailable = false;
    const ollamaUrl = config?.vector?.ollamaUrl || process.env.OLLAMA_URL || "http://localhost:11434";
    try {
        const resp = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
        ollamaAvailable = resp.ok;
    } catch { /* */ }

    // Check OpenAI
    const hasOpenaiKey = !!(getVaultSecret("OPENAI_API_KEY") || process.env.OPENAI_API_KEY);

    // Determine active provider
    let activeProvider: EmbeddingProvider = "builtin";
    if (ollamaAvailable) activeProvider = "ollama";
    else if (hasOpenaiKey) activeProvider = "openai";

    return {
        ollama: {
            available: ollamaAvailable,
            model: config?.vector?.ollamaModel || "nomic-embed-text",
            url: ollamaUrl,
        },
        openai: { available: hasOpenaiKey, hasKey: hasOpenaiKey },
        builtin: { available: true },
        activeProvider,
    };
}
