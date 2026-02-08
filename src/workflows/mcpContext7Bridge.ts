/**
 * MCP Context7 Bridge — Auto-documentation from Context7
 * 
 * MCP Swarm v0.9.19
 * 
 * Auto-detects context7 MCP and uses it for up-to-date documentation.
 * Prefetches docs based on project tech stack.
 * Caches results in swarm_knowledge.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

interface Context7Config {
    enabled: boolean;
    autoPrefetch: boolean;
    cacheTtlMs: number;
    maxDocsPerLibrary: number;
    techStack: string[];  // Auto-detected or manually set
    lastDetection: number;
}

interface DocCache {
    libraryId: string;
    libraryName: string;
    query: string;
    content: string;
    cachedAt: number;
    ttlMs: number;
    accessCount: number;
}

interface Context7Stats {
    totalQueries: number;
    cacheHits: number;
    cacheMisses: number;
    librariesDiscovered: number;
    lastQuery: number;
}

// ============ CONSTANTS ============

const C7_DIR = "context7-bridge";
const CONFIG_FILE = "c7-config.json";
const CACHE_FILE = "c7-docs-cache.json";
const STATS_FILE = "c7-stats.json";

/** Default cache: 24 hours */
const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000;

const DEFAULT_CONFIG: Context7Config = {
    enabled: false,
    autoPrefetch: true,
    cacheTtlMs: DEFAULT_CACHE_TTL,
    maxDocsPerLibrary: 5,
    techStack: [],
    lastDetection: 0,
};

/** Common tech stack detection patterns */
const TECH_PATTERNS: Record<string, { files: string[]; libraries: string[] }> = {
    "react": {
        files: ["package.json"],
        libraries: ["/vercel/next.js", "/facebook/react"],
    },
    "nextjs": {
        files: ["next.config.js", "next.config.ts", "next.config.mjs"],
        libraries: ["/vercel/next.js"],
    },
    "express": {
        files: ["package.json"],
        libraries: ["/expressjs/express"],
    },
    "python": {
        files: ["requirements.txt", "pyproject.toml", "setup.py"],
        libraries: [],
    },
    "supabase": {
        files: ["supabase"],
        libraries: ["/supabase/supabase"],
    },
    "tailwind": {
        files: ["tailwind.config.js", "tailwind.config.ts"],
        libraries: ["/tailwindlabs/tailwindcss"],
    },
    "prisma": {
        files: ["prisma"],
        libraries: ["/prisma/prisma"],
    },
};

// ============ STORAGE ============

async function getBridgeDir(repoPath: string): Promise<string> {
    const root = await getRepoRoot(repoPath);
    const dir = path.join(root, ".swarm", C7_DIR);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

async function loadConfig(repoPath: string): Promise<Context7Config> {
    const dir = await getBridgeDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, CONFIG_FILE), "utf-8");
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

async function saveConfig(repoPath: string, config: Context7Config): Promise<void> {
    const dir = await getBridgeDir(repoPath);
    await fs.writeFile(path.join(dir, CONFIG_FILE), JSON.stringify(config, null, 2), "utf-8");
}

async function loadDocCache(repoPath: string): Promise<DocCache[]> {
    const dir = await getBridgeDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, CACHE_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function saveDocCache(repoPath: string, cache: DocCache[]): Promise<void> {
    const dir = await getBridgeDir(repoPath);
    await fs.writeFile(path.join(dir, CACHE_FILE), JSON.stringify(cache, null, 2), "utf-8");
}

async function loadStats(repoPath: string): Promise<Context7Stats> {
    const dir = await getBridgeDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, STATS_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return { totalQueries: 0, cacheHits: 0, cacheMisses: 0, librariesDiscovered: 0, lastQuery: 0 };
    }
}

async function saveStats(repoPath: string, stats: Context7Stats): Promise<void> {
    const dir = await getBridgeDir(repoPath);
    await fs.writeFile(path.join(dir, STATS_FILE), JSON.stringify(stats, null, 2), "utf-8");
}

// ============ DETECTION ============

/**
 * Auto-detect tech stack from project files
 */
async function detectTechStack(repoPath: string): Promise<string[]> {
    const root = await getRepoRoot(repoPath);
    const detected: string[] = [];

    for (const [tech, patterns] of Object.entries(TECH_PATTERNS)) {
        for (const file of patterns.files) {
            try {
                await fs.access(path.join(root, file));
                detected.push(tech);
                break;
            } catch {
                // File not found, continue
            }
        }
    }

    // Also check package.json dependencies
    try {
        const pkgRaw = await fs.readFile(path.join(root, "package.json"), "utf-8");
        const pkg = JSON.parse(pkgRaw);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (allDeps["next"]) detected.push("nextjs");
        if (allDeps["react"]) detected.push("react");
        if (allDeps["express"]) detected.push("express");
        if (allDeps["@supabase/supabase-js"]) detected.push("supabase");
        if (allDeps["tailwindcss"]) detected.push("tailwind");
        if (allDeps["prisma"] || allDeps["@prisma/client"]) detected.push("prisma");
    } catch {
        // No package.json
    }

    return [...new Set(detected)];
}

/**
 * Get Context7 library IDs for detected tech stack
 */
function getLibraryIds(techStack: string[]): string[] {
    const ids: string[] = [];
    for (const tech of techStack) {
        const pattern = TECH_PATTERNS[tech];
        if (pattern) {
            ids.push(...pattern.libraries);
        }
    }
    return [...new Set(ids)];
}

/**
 * Check cached docs
 */
async function checkCache(
    repoPath: string,
    libraryId: string,
    query: string
): Promise<DocCache | null> {
    const cache = await loadDocCache(repoPath);
    const now = Date.now();

    const entry = cache.find(e =>
        e.libraryId === libraryId &&
        e.query === query &&
        (now - e.cachedAt) < e.ttlMs
    );

    if (entry) {
        entry.accessCount++;
        await saveDocCache(repoPath, cache);
        return entry;
    }

    return null;
}

/**
 * Store docs in cache
 */
async function storeInCache(
    repoPath: string,
    libraryId: string,
    libraryName: string,
    query: string,
    content: string,
    ttlMs: number
): Promise<void> {
    const cache = await loadDocCache(repoPath);

    // Remove old entry for same library+query
    const filtered = cache.filter(e => !(e.libraryId === libraryId && e.query === query));

    filtered.push({
        libraryId,
        libraryName,
        query,
        content,
        cachedAt: Date.now(),
        ttlMs,
        accessCount: 0,
    });

    await saveDocCache(repoPath, filtered);
}

// ============ MAIN HANDLER ============

export type Context7BridgeAction =
    | "detect"         // Check if context7 is available
    | "detect_stack"   // Auto-detect tech stack
    | "enable"         // Enable context7 bridge
    | "disable"        // Disable
    | "lookup"         // Look up docs (checks cache first)
    | "cache_status"   // Cache statistics
    | "clear_cache"    // Clear doc cache
    | "config"         // Get config
    | "set_config"     // Update config
    | "stats";         // Get statistics

export async function handleContext7Bridge(input: {
    action: Context7BridgeAction;
    repoPath?: string;
    // For lookup
    libraryId?: string;
    libraryName?: string;
    query?: string;
    // For set_config
    config?: Partial<Context7Config>;
    // For enable
    techStack?: string[];
}): Promise<unknown> {
    const repoPath = input.repoPath || process.cwd();

    switch (input.action) {
        case "detect": {
            return {
                detected: false,
                message: "context7 MCP detection — check your IDE MCP config",
                hint: "Add context7 MCP server to enable auto-documentation",
            };
        }

        case "detect_stack": {
            const techStack = await detectTechStack(repoPath);
            const libraryIds = getLibraryIds(techStack);

            // Save detected tech stack
            const config = await loadConfig(repoPath);
            config.techStack = techStack;
            config.lastDetection = Date.now();
            await saveConfig(repoPath, config);

            return {
                techStack,
                libraryIds,
                message: techStack.length > 0
                    ? `Detected: ${techStack.join(", ")}`
                    : "No known tech stack detected",
            };
        }

        case "enable": {
            const config = await loadConfig(repoPath);
            config.enabled = true;
            if (input.techStack) config.techStack = input.techStack;
            await saveConfig(repoPath, config);
            return { enabled: true, config };
        }

        case "disable": {
            const config = await loadConfig(repoPath);
            config.enabled = false;
            await saveConfig(repoPath, config);
            return { enabled: false };
        }

        case "lookup": {
            if (!input.libraryId || !input.query) {
                return { error: "libraryId and query required" };
            }

            // Check cache first
            const cached = await checkCache(repoPath, input.libraryId, input.query);
            if (cached) {
                const stats = await loadStats(repoPath);
                stats.cacheHits++;
                stats.totalQueries++;
                stats.lastQuery = Date.now();
                await saveStats(repoPath, stats);

                return {
                    source: "cache",
                    libraryId: cached.libraryId,
                    content: cached.content,
                    cachedAt: cached.cachedAt,
                    accessCount: cached.accessCount,
                };
            }

            // Cache miss — need to call context7 MCP
            const stats = await loadStats(repoPath);
            stats.cacheMisses++;
            stats.totalQueries++;
            stats.lastQuery = Date.now();
            await saveStats(repoPath, stats);

            return {
                source: "miss",
                libraryId: input.libraryId,
                query: input.query,
                message: "Cache miss. Use context7 MCP to fetch docs, then call cache_store.",
                hint: `Call context7.query-docs with libraryId="${input.libraryId}" query="${input.query}"`,
            };
        }

        case "cache_status": {
            const cache = await loadDocCache(repoPath);
            const now = Date.now();
            const active = cache.filter(e => (now - e.cachedAt) < e.ttlMs);

            return {
                totalEntries: cache.length,
                activeEntries: active.length,
                libraries: [...new Set(active.map(e => e.libraryId))],
                totalAccesses: active.reduce((sum, e) => sum + e.accessCount, 0),
            };
        }

        case "clear_cache": {
            await saveDocCache(repoPath, []);
            return { cleared: true };
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
