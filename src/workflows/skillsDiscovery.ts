/**
 * Skills Discovery — IDE-Agnostic Skill Detection & Activation
 * 
 * MCP Swarm v0.9.20
 * 
 * Scans workspace for skill definitions across IDEs:
 * - Gemini (GEMINI.md, .gemini/**) 
 * - Antigravity (.agent/workflows/*)
 * - Claude (.claude/*, CLAUDE.md)
 * - Cursor (.cursor/*, .cursorrules)
 * - Codex (AGENTS.md)
 * - Windsurf (.windsurfrules)
 * 
 * Features:
 * - Auto-detect skills from workspace files
 * - Normalize to unified Skill format
 * - Recommend skills based on task description
 * - Cross-IDE skill import/export
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

interface DiscoveredSkill {
    id: string;
    name: string;
    description: string;
    source: SkillSource;
    filePath: string;
    format: "markdown" | "json" | "yaml" | "text";
    categories: string[];
    confidence: number;   // 0-1 detection confidence
    discoveredAt: number;
    content?: string;      // Raw content (loaded on demand)
}

type SkillSource =
    | "gemini"
    | "antigravity"
    | "claude"
    | "claude-flow"
    | "cursor"
    | "codex"
    | "windsurf"
    | "custom";

interface SkillPattern {
    source: SkillSource;
    patterns: string[];          // Glob-like path patterns
    descriptionField?: string;   // YAML/JSON field for description
    nameExtractor: "filename" | "frontmatter" | "heading";
}

interface SkillsConfig {
    enabled: boolean;
    autoscan: boolean;
    scanIntervalMs: number;
    importCrossIde: boolean;     // Import skills from other IDEs
    exportFormat: SkillSource;   // Export format
    lastScan: number;
}

interface SkillsStats {
    totalDiscovered: number;
    bySource: Record<string, number>;
    lastScan: number;
    scanDurationMs: number;
}

// ============ CONSTANTS ============

const SKILLS_DIR = "skills-discovery";
const REGISTRY_FILE = "skills-registry.json";
const CONFIG_FILE = "skills-config.json";
const STATS_FILE = "skills-stats.json";

const DEFAULT_CONFIG: SkillsConfig = {
    enabled: true,
    autoscan: true,
    scanIntervalMs: 10 * 60 * 1000, // 10 min
    importCrossIde: true,
    exportFormat: "antigravity",
    lastScan: 0,
};

/** IDE skill file patterns */
const SKILL_PATTERNS: SkillPattern[] = [
    {
        source: "gemini",
        patterns: ["GEMINI.md", ".gemini/**/*.md"],
        nameExtractor: "heading",
    },
    {
        source: "antigravity",
        patterns: [".agent/workflows/*.md"],
        nameExtractor: "frontmatter",
        descriptionField: "description",
    },
    {
        source: "claude",
        patterns: ["CLAUDE.md", ".claude/**/*.md"],
        nameExtractor: "heading",
    },
    {
        source: "cursor",
        patterns: [".cursorrules", ".cursor/**/*.md"],
        nameExtractor: "filename",
    },
    {
        source: "codex",
        patterns: ["AGENTS.md", "codex/**/*.md"],
        nameExtractor: "heading",
    },
    {
        source: "windsurf",
        patterns: [".windsurfrules"],
        nameExtractor: "filename",
    },
    {
        source: "claude-flow",
        patterns: [".claude-flow/**/*.md", ".claude-flow/skills/*.json"],
        nameExtractor: "frontmatter",
        descriptionField: "description",
    },
];

// ============ STORAGE ============

async function getSkillsDir(repoPath: string): Promise<string> {
    const root = await getRepoRoot(repoPath);
    const dir = path.join(root, ".swarm", SKILLS_DIR);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

async function loadRegistry(repoPath: string): Promise<DiscoveredSkill[]> {
    const dir = await getSkillsDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, REGISTRY_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function saveRegistry(repoPath: string, skills: DiscoveredSkill[]): Promise<void> {
    const dir = await getSkillsDir(repoPath);
    await fs.writeFile(path.join(dir, REGISTRY_FILE), JSON.stringify(skills, null, 2), "utf-8");
}

async function loadConfig(repoPath: string): Promise<SkillsConfig> {
    const dir = await getSkillsDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, CONFIG_FILE), "utf-8");
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

async function saveConfig(repoPath: string, config: SkillsConfig): Promise<void> {
    const dir = await getSkillsDir(repoPath);
    await fs.writeFile(path.join(dir, CONFIG_FILE), JSON.stringify(config, null, 2), "utf-8");
}

async function loadStats(repoPath: string): Promise<SkillsStats> {
    const dir = await getSkillsDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, STATS_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return { totalDiscovered: 0, bySource: {}, lastScan: 0, scanDurationMs: 0 };
    }
}

async function saveStats(repoPath: string, stats: SkillsStats): Promise<void> {
    const dir = await getSkillsDir(repoPath);
    await fs.writeFile(path.join(dir, STATS_FILE), JSON.stringify(stats, null, 2), "utf-8");
}

// ============ SCANNING ============

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Extract name from markdown heading
 */
function extractHeadingName(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : "";
}

/**
 * Extract description from YAML frontmatter
 */
function extractFrontmatter(content: string): { name?: string; description?: string } {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return {};

    const result: Record<string, string> = {};
    for (const line of fmMatch[1].split("\n")) {
        const [key, ...valueParts] = line.split(":");
        if (key && valueParts.length > 0) {
            result[key.trim()] = valueParts.join(":").trim();
        }
    }

    return {
        name: result.name || result.title,
        description: result.description,
    };
}

/**
 * Scan a single file and extract skill info
 */
async function scanFile(
    root: string,
    relativePath: string,
    pattern: SkillPattern
): Promise<DiscoveredSkill | null> {
    const fullPath = path.join(root, relativePath);
    if (!(await fileExists(fullPath))) return null;

    try {
        const content = await fs.readFile(fullPath, "utf-8");
        let name = "";
        let description = "";

        switch (pattern.nameExtractor) {
            case "heading":
                name = extractHeadingName(content);
                break;
            case "frontmatter": {
                const fm = extractFrontmatter(content);
                name = fm.name || "";
                description = fm.description || "";
                break;
            }
            case "filename":
                name = path.basename(relativePath, path.extname(relativePath));
                break;
        }

        if (!name) name = path.basename(relativePath, path.extname(relativePath));

        // Extract first paragraph as description if not set
        if (!description) {
            const lines = content.split("\n").filter(l => l.trim() && !l.startsWith("#") && !l.startsWith("---"));
            description = lines.slice(0, 2).join(" ").slice(0, 200);
        }

        // Detect categories from content keywords
        const categories: string[] = [];
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes("deploy") || lowerContent.includes("ci/cd")) categories.push("devops");
        if (lowerContent.includes("test")) categories.push("testing");
        if (lowerContent.includes("api") || lowerContent.includes("endpoint")) categories.push("api");
        if (lowerContent.includes("database") || lowerContent.includes("sql")) categories.push("database");
        if (lowerContent.includes("auth")) categories.push("auth");
        if (lowerContent.includes("workflow")) categories.push("workflow");

        return {
            id: `skill-${pattern.source}-${relativePath.replace(/[^a-zA-Z0-9]/g, "-")}`,
            name,
            description,
            source: pattern.source,
            filePath: relativePath,
            format: relativePath.endsWith(".json") ? "json"
                : relativePath.endsWith(".yaml") || relativePath.endsWith(".yml") ? "yaml"
                    : relativePath.endsWith(".md") ? "markdown"
                        : "text",
            categories,
            confidence: 0.8,
            discoveredAt: Date.now(),
        };
    } catch {
        return null;
    }
}

/**
 * Full workspace scan for skills
 */
async function scanWorkspace(repoPath: string): Promise<DiscoveredSkill[]> {
    const root = await getRepoRoot(repoPath);
    const discovered: DiscoveredSkill[] = [];

    for (const pattern of SKILL_PATTERNS) {
        for (const globPattern of pattern.patterns) {
            // Handle simple file patterns (no glob needed for basic cases)
            if (!globPattern.includes("*")) {
                const skill = await scanFile(root, globPattern, pattern);
                if (skill) discovered.push(skill);
                continue;
            }

            // Handle directory patterns like ".agent/workflows/*.md"
            const dirPart = globPattern.split("*")[0].replace(/\/$/, "");
            const ext = globPattern.split(".").pop();

            try {
                const dirPath = path.join(root, dirPart);
                const entries = await fs.readdir(dirPath, { withFileTypes: true });

                for (const entry of entries) {
                    if (!entry.isFile()) continue;
                    if (ext && !entry.name.endsWith(`.${ext}`)) continue;

                    const relativePath = path.join(dirPart, entry.name);
                    const skill = await scanFile(root, relativePath, pattern);
                    if (skill) discovered.push(skill);
                }
            } catch {
                // Directory doesn't exist, skip
            }
        }
    }

    return discovered;
}

/**
 * Recommend skills for a task description
 */
async function recommendSkills(
    repoPath: string,
    taskDescription: string,
    maxResults: number = 5
): Promise<DiscoveredSkill[]> {
    const registry = await loadRegistry(repoPath);
    const keywords = taskDescription.toLowerCase().split(/\s+/);

    // Score skills by keyword match
    const scored = registry.map(skill => {
        let score = 0;
        const skillText = `${skill.name} ${skill.description} ${skill.categories.join(" ")}`.toLowerCase();

        for (const kw of keywords) {
            if (kw.length < 3) continue;
            if (skillText.includes(kw)) score += 1;
        }

        // Boost by confidence
        score *= skill.confidence;

        return { skill, score };
    });

    return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(s => s.skill);
}

// ============ MAIN HANDLER ============

export type SkillsAction =
    | "scan"            // Full workspace scan
    | "list"            // List discovered skills
    | "get"             // Get skill details
    | "recommend"       // Recommend skills for task
    | "import"          // Import skill from another format
    | "config"          // Get config
    | "set_config"      // Update config
    | "stats";          // Get stats

export async function handleSkillsDiscovery(input: {
    action: SkillsAction;
    repoPath?: string;
    // For get
    skillId?: string;
    // For recommend
    taskDescription?: string;
    maxResults?: number;
    // For import
    sourcePath?: string;
    targetFormat?: SkillSource;
    // For set_config
    config?: Partial<SkillsConfig>;
}): Promise<unknown> {
    const repoPath = input.repoPath || process.cwd();

    switch (input.action) {
        case "scan": {
            const startTime = Date.now();
            const discovered = await scanWorkspace(repoPath);

            // Update registry
            await saveRegistry(repoPath, discovered);

            // Update stats
            const bySource: Record<string, number> = {};
            for (const s of discovered) {
                bySource[s.source] = (bySource[s.source] || 0) + 1;
            }

            const stats: SkillsStats = {
                totalDiscovered: discovered.length,
                bySource,
                lastScan: Date.now(),
                scanDurationMs: Date.now() - startTime,
            };
            await saveStats(repoPath, stats);

            // Update config lastScan
            const config = await loadConfig(repoPath);
            config.lastScan = Date.now();
            await saveConfig(repoPath, config);

            return {
                discovered: discovered.length,
                bySource,
                skills: discovered.map(s => ({
                    id: s.id,
                    name: s.name,
                    source: s.source,
                    categories: s.categories,
                })),
            };
        }

        case "list": {
            const skills = await loadRegistry(repoPath);
            return {
                skills: skills.map(s => ({
                    id: s.id,
                    name: s.name,
                    source: s.source,
                    filePath: s.filePath,
                    categories: s.categories,
                    confidence: s.confidence,
                })),
                total: skills.length,
            };
        }

        case "get": {
            if (!input.skillId) return { error: "skillId required" };
            const skills = await loadRegistry(repoPath);
            const skill = skills.find(s => s.id === input.skillId);
            if (!skill) return { error: "Skill not found" };

            // Load content on demand
            const root = await getRepoRoot(repoPath);
            try {
                skill.content = await fs.readFile(path.join(root, skill.filePath), "utf-8");
            } catch {
                skill.content = "[file not accessible]";
            }

            return skill;
        }

        case "recommend": {
            if (!input.taskDescription) return { error: "taskDescription required" };
            const recommended = await recommendSkills(repoPath, input.taskDescription, input.maxResults);
            return {
                recommended: recommended.map(s => ({
                    id: s.id,
                    name: s.name,
                    source: s.source,
                    description: s.description,
                    categories: s.categories,
                })),
            };
        }

        case "import": {
            if (!input.sourcePath) return { error: "sourcePath required" };
            // Read source file and register as custom skill
            const root = await getRepoRoot(repoPath);
            try {
                const content = await fs.readFile(path.join(root, input.sourcePath), "utf-8");
                const name = extractHeadingName(content) || path.basename(input.sourcePath, path.extname(input.sourcePath));
                const fm = extractFrontmatter(content);

                const skill: DiscoveredSkill = {
                    id: `skill-imported-${Date.now()}`,
                    name,
                    description: fm.description || "",
                    source: input.targetFormat || "custom",
                    filePath: input.sourcePath,
                    format: "markdown",
                    categories: [],
                    confidence: 1.0,
                    discoveredAt: Date.now(),
                };

                const skills = await loadRegistry(repoPath);
                skills.push(skill);
                await saveRegistry(repoPath, skills);
                return { imported: true, skill };
            } catch {
                return { error: "Failed to read source file" };
            }
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
