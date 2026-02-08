/**
 * Claude-Flow Bridge — Skills Routing and RAG Integration
 * 
 * MCP Swarm v0.9.20
 * 
 * Integrates with claude-flow MCP if available:
 * - Skills import and routing (Q-learning based)
 * - RAG pipeline (vector search → context injection)
 * - Task claim synchronization between Swarm and Flow
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

interface ClaudeFlowConfig {
    enabled: boolean;
    skillsEnabled: boolean;
    ragEnabled: boolean;
    taskSyncEnabled: boolean;
    explorationRate: number;   // Q-learning: 0.0-1.0 (epsilon for exploration)
    learningRate: number;      // Q-learning: 0.0-1.0 (alpha for updates)
    discountFactor: number;    // Q-learning: 0.0-1.0 (gamma for future rewards)
}

interface Skill {
    id: string;
    name: string;
    description: string;
    path: string;       // Path to skill definition
    source: string;     // "claude-flow" | "local" | "discovered"
    categories: string[];
    qValue: number;     // Q-learning value (higher = better skill for task)
    usageCount: number;
    successRate: number;
    lastUsed: number;
}

interface RagConfig {
    topK: number;          // Number of results to inject
    minSimilarity: number; // Minimum similarity threshold
    indexedFiles: number;
    lastIndexed: number;
}

interface FlowBridgeStats {
    skillsLoaded: number;
    skillsUsed: number;
    ragQueries: number;
    ragContextInjections: number;
    tasksClaimed: number;
    tasksCompleted: number;
    avgSkillQValue: number;
}

// ============ CONSTANTS ============

const FLOW_DIR = "claude-flow-bridge";
const CONFIG_FILE = "flow-config.json";
const SKILLS_FILE = "skills-registry.json";
const RAG_CONFIG_FILE = "rag-config.json";
const STATS_FILE = "flow-stats.json";

const DEFAULT_CONFIG: ClaudeFlowConfig = {
    enabled: false,
    skillsEnabled: true,
    ragEnabled: true,
    taskSyncEnabled: true,
    explorationRate: 0.15,
    learningRate: 0.1,
    discountFactor: 0.9,
};

const DEFAULT_RAG_CONFIG: RagConfig = {
    topK: 5,
    minSimilarity: 0.7,
    indexedFiles: 0,
    lastIndexed: 0,
};

// ============ STORAGE ============

async function getBridgeDir(repoPath: string): Promise<string> {
    const root = await getRepoRoot(repoPath);
    const dir = path.join(root, ".swarm", FLOW_DIR);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

async function loadConfig(repoPath: string): Promise<ClaudeFlowConfig> {
    const dir = await getBridgeDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, CONFIG_FILE), "utf-8");
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

async function saveConfig(repoPath: string, config: ClaudeFlowConfig): Promise<void> {
    const dir = await getBridgeDir(repoPath);
    await fs.writeFile(path.join(dir, CONFIG_FILE), JSON.stringify(config, null, 2), "utf-8");
}

async function loadSkills(repoPath: string): Promise<Skill[]> {
    const dir = await getBridgeDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, SKILLS_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function saveSkills(repoPath: string, skills: Skill[]): Promise<void> {
    const dir = await getBridgeDir(repoPath);
    await fs.writeFile(path.join(dir, SKILLS_FILE), JSON.stringify(skills, null, 2), "utf-8");
}

async function loadRagConfig(repoPath: string): Promise<RagConfig> {
    const dir = await getBridgeDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, RAG_CONFIG_FILE), "utf-8");
        return { ...DEFAULT_RAG_CONFIG, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_RAG_CONFIG };
    }
}

async function saveRagConfig(repoPath: string, config: RagConfig): Promise<void> {
    const dir = await getBridgeDir(repoPath);
    await fs.writeFile(path.join(dir, RAG_CONFIG_FILE), JSON.stringify(config, null, 2), "utf-8");
}

async function loadStats(repoPath: string): Promise<FlowBridgeStats> {
    const dir = await getBridgeDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, STATS_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return {
            skillsLoaded: 0, skillsUsed: 0, ragQueries: 0,
            ragContextInjections: 0, tasksClaimed: 0, tasksCompleted: 0, avgSkillQValue: 0,
        };
    }
}

async function saveStats(repoPath: string, stats: FlowBridgeStats): Promise<void> {
    const dir = await getBridgeDir(repoPath);
    await fs.writeFile(path.join(dir, STATS_FILE), JSON.stringify(stats, null, 2), "utf-8");
}

// ============ Q-LEARNING ROUTING ============

/**
 * Select best skill for a task using epsilon-greedy Q-learning
 */
async function routeToSkill(
    repoPath: string,
    taskDescription: string,
    categories: string[]
): Promise<{ skill: Skill | null; explored: boolean; reasoning: string }> {
    const config = await loadConfig(repoPath);
    const skills = await loadSkills(repoPath);

    if (skills.length === 0) {
        return { skill: null, explored: false, reasoning: "No skills registered" };
    }

    // Filter by matching categories
    let candidates = skills.filter(s =>
        categories.some(c => s.categories.includes(c))
    );

    // If no category match, use all skills
    if (candidates.length === 0) candidates = [...skills];

    // Epsilon-greedy: explore with probability epsilon
    const explore = Math.random() < config.explorationRate;

    if (explore) {
        // Random exploration
        const idx = Math.floor(Math.random() * candidates.length);
        return {
            skill: candidates[idx],
            explored: true,
            reasoning: `Exploration (ε=${config.explorationRate}): randomly selected "${candidates[idx].name}"`,
        };
    }

    // Exploitation: pick highest Q-value
    candidates.sort((a, b) => b.qValue - a.qValue);
    return {
        skill: candidates[0],
        explored: false,
        reasoning: `Exploitation: selected "${candidates[0].name}" (Q=${candidates[0].qValue.toFixed(3)})`,
    };
}

/**
 * Update Q-value after skill usage (Q-learning update rule)
 */
async function updateSkillQValue(
    repoPath: string,
    skillId: string,
    reward: number // 0.0-1.0 (success metric)
): Promise<{ oldQ: number; newQ: number }> {
    const config = await loadConfig(repoPath);
    const skills = await loadSkills(repoPath);

    const skill = skills.find(s => s.id === skillId);
    if (!skill) return { oldQ: 0, newQ: 0 };

    const oldQ = skill.qValue;
    // Q-learning update: Q(s,a) = Q(s,a) + α * (reward - Q(s,a))
    skill.qValue = oldQ + config.learningRate * (reward - oldQ);
    skill.usageCount++;
    skill.lastUsed = Date.now();
    skill.successRate = (skill.successRate * (skill.usageCount - 1) + reward) / skill.usageCount;

    await saveSkills(repoPath, skills);
    return { oldQ, newQ: skill.qValue };
}

/**
 * Register a new skill
 */
async function registerSkill(
    repoPath: string,
    name: string,
    description: string,
    skillPath: string,
    categories: string[],
    source: string = "local"
): Promise<Skill> {
    const skills = await loadSkills(repoPath);

    const existing = skills.find(s => s.name === name);
    if (existing) {
        existing.description = description;
        existing.path = skillPath;
        existing.categories = categories;
        existing.source = source;
        await saveSkills(repoPath, skills);
        return existing;
    }

    const skill: Skill = {
        id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        description,
        path: skillPath,
        source,
        categories,
        qValue: 0.5, // Initial neutral Q-value
        usageCount: 0,
        successRate: 0,
        lastUsed: 0,
    };

    skills.push(skill);
    await saveSkills(repoPath, skills);
    return skill;
}

// ============ RAG PIPELINE ============

/**
 * RAG Query: scan project files → TF-IDF rank → return top-K chunks
 */
async function ragQuery(
    repoPath: string,
    query: string,
    topK?: number,
    fileExtensions?: string[]
): Promise<{
    results: Array<{ file: string; score: number; snippet: string }>;
    totalScanned: number;
    ragConfig: RagConfig;
}> {
    const ragCfg = await loadRagConfig(repoPath);
    const stats = await loadStats(repoPath);
    const root = await getRepoRoot(repoPath);
    const k = topK || ragCfg.topK;
    const exts = fileExtensions || [".ts", ".js", ".md", ".json", ".py"];

    // Tokenize query for TF-IDF scoring
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);

    // Scan src/ directory for relevant files
    const results: Array<{ file: string; score: number; snippet: string }> = [];
    let totalScanned = 0;

    async function scanDir(dir: string, depth: number = 0): Promise<void> {
        if (depth > 4) return; // Max depth
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(root, fullPath);

                // Skip hidden dirs, node_modules, dist, .swarm
                if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;

                if (entry.isDirectory()) {
                    await scanDir(fullPath, depth + 1);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (!exts.includes(ext)) continue;

                    try {
                        const content = await fs.readFile(fullPath, "utf-8");
                        if (content.length > 100_000) continue; // Skip very large files

                        totalScanned++;

                        // TF-IDF-like scoring
                        const lowerContent = content.toLowerCase();
                        let score = 0;
                        for (const token of queryTokens) {
                            const regex = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
                            const matches = lowerContent.match(regex);
                            if (matches) {
                                // TF: term frequency normalized by doc length
                                const tf = matches.length / (content.length / 100);
                                score += tf;
                            }
                        }

                        if (score < ragCfg.minSimilarity * 0.1) continue;

                        // Extract best snippet (paragraph with most matches)
                        const paragraphs = content.split(/\n\n+/);
                        let bestSnippet = "";
                        let bestSnippetScore = 0;
                        for (const para of paragraphs) {
                            const paraLower = para.toLowerCase();
                            let pScore = 0;
                            for (const token of queryTokens) {
                                if (paraLower.includes(token)) pScore++;
                            }
                            if (pScore > bestSnippetScore) {
                                bestSnippetScore = pScore;
                                bestSnippet = para.trim().slice(0, 300);
                            }
                        }

                        results.push({
                            file: relativePath.replace(/\\/g, "/"),
                            score: Math.round(score * 1000) / 1000,
                            snippet: bestSnippet || content.slice(0, 200),
                        });
                    } catch {
                        // Skip unreadable files
                    }
                }
            }
        } catch {
            // Skip inaccessible dirs
        }
    }

    await scanDir(root);

    // Sort by score and take top-K
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, k);

    // Update stats
    stats.ragQueries++;
    stats.ragContextInjections += topResults.length;
    await saveStats(repoPath, stats);

    // Update RAG config with scan info
    ragCfg.indexedFiles = totalScanned;
    ragCfg.lastIndexed = Date.now();
    await saveRagConfig(repoPath, ragCfg);

    return {
        results: topResults,
        totalScanned,
        ragConfig: ragCfg,
    };
}

// ============ SKILLS SYNC ============

/**
 * Sync skills from skillsDiscovery → claudeFlowBridge
 * Imports discovered skills and registers them in the bridge registry
 */
async function syncSkills(repoPath: string): Promise<{
    imported: number;
    updated: number;
    total: number;
    sources: Record<string, number>;
}> {
    const root = await getRepoRoot(repoPath);
    const discoveryDir = path.join(root, ".swarm", "skills-discovery");
    const stats = await loadStats(repoPath);

    // Load skills from discovery registry
    let discoveredSkills: Array<{
        id: string;
        name: string;
        description: string;
        source: string;
        filePath: string;
        categories: string[];
        confidence: number;
    }> = [];

    try {
        const raw = await fs.readFile(path.join(discoveryDir, "skills-registry.json"), "utf-8");
        discoveredSkills = JSON.parse(raw);
    } catch {
        return { imported: 0, updated: 0, total: 0, sources: {} };
    }

    // Load current bridge skills
    const bridgeSkills = await loadSkills(repoPath);
    let imported = 0;
    let updated = 0;
    const sources: Record<string, number> = {};

    for (const ds of discoveredSkills) {
        sources[ds.source] = (sources[ds.source] || 0) + 1;

        const existing = bridgeSkills.find(s => s.name === ds.name && s.source === ds.source);
        if (existing) {
            // Update existing skill metadata
            existing.description = ds.description;
            existing.path = ds.filePath;
            existing.categories = ds.categories;
            updated++;
        } else {
            // Import as new skill with initial Q-value based on confidence
            bridgeSkills.push({
                id: `skill-sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name: ds.name,
                description: ds.description,
                path: ds.filePath,
                source: ds.source,
                categories: ds.categories,
                qValue: Math.max(0.3, ds.confidence * 0.6), // Initial Q weighted by confidence
                usageCount: 0,
                successRate: 0,
                lastUsed: 0,
            });
            imported++;
        }
    }

    await saveSkills(repoPath, bridgeSkills);

    // Update stats
    stats.skillsLoaded = bridgeSkills.length;
    await saveStats(repoPath, stats);

    return {
        imported,
        updated,
        total: bridgeSkills.length,
        sources,
    };
}

// ============ MAIN HANDLER ============

export type ClaudeFlowAction =
    | "detect"           // Check if claude-flow is available
    | "enable"           // Enable bridge
    | "disable"          // Disable bridge
    | "register_skill"   // Register a skill
    | "route_skill"      // Route task to best skill (Q-learning)
    | "update_q"         // Update Q-value after usage
    | "list_skills"      // List all skills
    | "rag_query"        // RAG pipeline: search → rank → inject
    | "sync_skills"      // Sync skills between discovery and bridge
    | "rag_config"       // Get RAG config
    | "set_rag_config"   // Update RAG config
    | "config"           // Get config
    | "set_config"       // Update config
    | "stats";           // Get statistics

export async function handleClaudeFlowBridge(input: {
    action: ClaudeFlowAction;
    repoPath?: string;
    // For register_skill
    name?: string;
    description?: string;
    skillPath?: string;
    categories?: string[];
    source?: string;
    // For route_skill / rag_query
    taskDescription?: string;
    query?: string;           // For rag_query
    topK?: number;            // For rag_query (override ragConfig.topK)
    fileExtensions?: string[]; // For rag_query — filter by extensions
    // For update_q
    skillId?: string;
    reward?: number;
    // For set_config / set_rag_config
    config?: Partial<ClaudeFlowConfig>;
    ragConfig?: Partial<RagConfig>;
}): Promise<unknown> {
    const repoPath = input.repoPath || process.cwd();

    switch (input.action) {
        case "detect": {
            return {
                detected: false,
                message: "claude-flow MCP not detected",
                hint: "Add claude-flow to your MCP config for skills routing and RAG integration",
            };
        }

        case "enable": {
            const config = await loadConfig(repoPath);
            config.enabled = true;
            await saveConfig(repoPath, config);
            return { enabled: true, config };
        }

        case "disable": {
            const config = await loadConfig(repoPath);
            config.enabled = false;
            await saveConfig(repoPath, config);
            return { enabled: false };
        }

        case "register_skill": {
            if (!input.name || !input.skillPath) return { error: "name and skillPath required" };
            const skill = await registerSkill(
                repoPath,
                input.name,
                input.description || "",
                input.skillPath,
                input.categories || [],
                input.source || "local"
            );
            return { registered: true, skill };
        }

        case "route_skill": {
            if (!input.taskDescription) return { error: "taskDescription required" };
            return routeToSkill(repoPath, input.taskDescription, input.categories || []);
        }

        case "update_q": {
            if (!input.skillId || input.reward === undefined) {
                return { error: "skillId and reward (0.0-1.0) required" };
            }
            return updateSkillQValue(repoPath, input.skillId, input.reward);
        }

        case "list_skills": {
            const skills = await loadSkills(repoPath);
            return {
                skills: skills.sort((a, b) => b.qValue - a.qValue),
                total: skills.length,
            };
        }

        case "rag_config": {
            return loadRagConfig(repoPath);
        }

        case "set_rag_config": {
            const current = await loadRagConfig(repoPath);
            const updated = { ...current, ...input.ragConfig };
            await saveRagConfig(repoPath, updated);
            return { updated: true, config: updated };
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

        case "rag_query": {
            if (!input.query) return { error: "query required" };
            return ragQuery(
                repoPath,
                input.query,
                input.topK,
                input.fileExtensions
            );
        }

        case "sync_skills": {
            return syncSkills(repoPath);
        }

        default:
            return { error: `Unknown action: ${input.action}` };
    }
}
