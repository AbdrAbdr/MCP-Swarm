/**
 * Setup Wizard — Interactive first-time configuration
 * 
 * MCP Swarm v1.2.0
 * 
 * Triggered on first `swarm_agent init` when no config exists.
 * Multi-language support via system locale detection.
 * 
 * User choices:
 * - Standard mode (skip all, v1.1.6 compatible)
 * - Vault, Vector DB, Embeddings, GitHub, Global Memory, Profiles
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

export interface SwarmConfig {
    version: string;
    mode: "standard" | "configured";
    locale: string;

    // Vault
    vault: {
        enabled: boolean;
        autoBackup: boolean;
        backupTarget?: "telegram" | "gist" | "gdrive" | "s3" | "local";
    };

    // Vector DB
    vector: {
        backend: "local" | "chroma" | "supabase" | "qdrant" | "pinecone" | "turso";
        embeddingProvider: "ollama" | "openai" | "builtin";
        ollamaModel?: string;
        ollamaUrl?: string;
        dimensions: number;
        ttlDays?: number;
        semanticCachingEnabled: boolean;
        globalMemoryEnabled: boolean;
    };

    // GitHub
    github: {
        enabled: boolean;
        autoSync: boolean;
    };

    // Agent Profiles
    profiles: {
        enabled: boolean;
        defaultProfile?: "frontend" | "backend" | "security" | "devops" | "fullstack" | "custom";
        customDescription?: string;
    };

    // Scheduled Tasks
    scheduledTasks: {
        enabled: boolean;
        tasks: Array<{
            cron: string;
            title: string;
            action: string;
            lastRun?: string;
            enabled?: boolean;
        }>;
    };

    // Plugins
    plugins: {
        enabled: boolean;
        directory: string;
    };
}

// ============ i18n ============

type Locale = "ru" | "en";

const i18n: Record<Locale, Record<string, string>> = {
    en: {
        welcome: "🧙 MCP Swarm Setup Wizard",
        modeQuestion: "How would you like to set up MCP Swarm?",
        standard: "⚡ Standard — everything works out of the box (same as v1.1.6)",
        configured: "⚙️ Configure — choose components to enable",
        vaultQuestion: "🔐 Enable Vault? (encrypted API key storage)",
        vectorQuestion: "🧠 Vector database backend?",
        embeddingQuestion: "🔤 Embedding provider?",
        githubQuestion: "🔄 Enable GitHub sync? (two-way Issue ↔ Task sync)",
        globalMemoryQuestion: "🌍 Enable Global Memory? (share knowledge across projects)",
        profileQuestion: "👤 Default agent profile?",
        scheduledQuestion: "⏰ Enable scheduled tasks? (cron-like automation)",
        pluginsQuestion: "🔌 Enable plugins? (custom extensions in ~/.swarm/plugins/)",
        complete: "✅ Setup complete!",
        standardComplete: "✅ Standard mode — no extra configuration needed.",
        ollamaRecommended: "(recommended, free, local)",
        openaiPaid: "(paid, cloud)",
        builtinOffline: "(built-in, offline fallback)",
    },
    ru: {
        welcome: "🧙 Мастер настройки MCP Swarm",
        modeQuestion: "Как настроить MCP Swarm?",
        standard: "⚡ Стандартно — всё работает из коробки (как v1.1.6)",
        configured: "⚙️ Настроить — выбрать компоненты",
        vaultQuestion: "🔐 Включить Vault? (шифрованное хранилище ключей)",
        vectorQuestion: "🧠 Бэкенд векторной базы?",
        embeddingQuestion: "🔤 Провайдер эмбеддингов?",
        githubQuestion: "🔄 Включить GitHub синхронизацию? (Issue ↔ Task)",
        globalMemoryQuestion: "🌍 Включить Global Memory? (обмен знаниями между проектами)",
        profileQuestion: "👤 Профиль агента по умолчанию?",
        scheduledQuestion: "⏰ Включить запланированные задачи? (крон-автоматизация)",
        pluginsQuestion: "🔌 Включить плагины? (пользовательские расширения в ~/.swarm/plugins/)",
        complete: "✅ Настройка завершена!",
        standardComplete: "✅ Стандартный режим — дополнительная настройка не нужна.",
        ollamaRecommended: "(рекомендуется, бесплатно, локально)",
        openaiPaid: "(платно, облако)",
        builtinOffline: "(встроенный, оффлайн)",
    },
};

// ============ LOCALE DETECTION ============

function detectLocale(): Locale {
    try {
        const resolved = Intl.DateTimeFormat().resolvedOptions().locale;
        if (resolved.startsWith("ru")) return "ru";
    } catch {
        // fallback
    }

    const envLang = process.env.LANG || process.env.LC_ALL || process.env.LANGUAGE || "";
    if (envLang.startsWith("ru")) return "ru";

    return "en";
}

function t(key: string, locale?: Locale): string {
    const l = locale || detectLocale();
    return i18n[l]?.[key] || i18n.en[key] || key;
}

// ============ DEFAULT CONFIG ============

function defaultConfig(): SwarmConfig {
    return {
        version: "1.2.0",
        mode: "standard",
        locale: detectLocale(),
        vault: { enabled: false, autoBackup: false },
        vector: {
            backend: "local",
            embeddingProvider: "builtin",
            dimensions: 384,
            semanticCachingEnabled: false,
            globalMemoryEnabled: false,
        },
        github: { enabled: false, autoSync: false },
        profiles: { enabled: false },
        scheduledTasks: { enabled: false, tasks: [] },
        plugins: { enabled: false, directory: "~/.swarm/plugins" },
    };
}

// ============ CONFIG PERSISTENCE ============

const CONFIG_FILE = ".swarm/config.json";

export async function loadSwarmConfig(repoPath?: string): Promise<SwarmConfig | null> {
    const repoRoot = await getRepoRoot(repoPath);
    const configPath = path.join(repoRoot, CONFIG_FILE);
    try {
        const raw = await fs.readFile(configPath, "utf8");
        return JSON.parse(raw) as SwarmConfig;
    } catch {
        return null;
    }
}

export async function saveSwarmConfig(config: SwarmConfig, repoPath?: string): Promise<string> {
    const repoRoot = await getRepoRoot(repoPath);
    const configPath = path.join(repoRoot, CONFIG_FILE);
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
    return configPath;
}

export async function configExists(repoPath?: string): Promise<boolean> {
    const repoRoot = await getRepoRoot(repoPath);
    try {
        await fs.access(path.join(repoRoot, CONFIG_FILE));
        return true;
    } catch {
        return false;
    }
}

// ============ WIZARD (NON-INTERACTIVE for MCP) ============

/**
 * Run wizard with provided choices (MCP is non-interactive).
 * The agent calls this with choices collected from the user.
 */
export async function runSetupWizard(input: {
    repoPath?: string;
    mode?: "standard" | "configured";
    // Only used if mode is "configured"
    vaultEnabled?: boolean;
    vaultAutoBackup?: boolean;
    vaultBackupTarget?: "telegram" | "gist" | "gdrive" | "s3" | "local";
    vectorBackend?: "local" | "chroma" | "supabase" | "qdrant" | "pinecone" | "turso";
    embeddingProvider?: "ollama" | "openai" | "builtin";
    ollamaModel?: string;
    ollamaUrl?: string;
    ttlDays?: number;
    semanticCaching?: boolean;
    globalMemory?: boolean;
    githubEnabled?: boolean;
    githubAutoSync?: boolean;
    profileEnabled?: boolean;
    defaultProfile?: "frontend" | "backend" | "security" | "devops" | "fullstack" | "custom";
    customProfileDescription?: string;
    scheduledTasksEnabled?: boolean;
    pluginsEnabled?: boolean;
}): Promise<{
    success: boolean;
    message: string;
    config: SwarmConfig;
    configPath: string;
    locale: Locale;
}> {
    const locale = detectLocale();
    const config = defaultConfig();
    config.locale = locale;

    if (input.mode === "standard" || !input.mode) {
        config.mode = "standard";
        const configPath = await saveSwarmConfig(config, input.repoPath);
        return {
            success: true,
            message: t("standardComplete", locale),
            config,
            configPath,
            locale,
        };
    }

    // Configured mode
    config.mode = "configured";

    // Vault
    if (input.vaultEnabled) {
        config.vault.enabled = true;
        config.vault.autoBackup = input.vaultAutoBackup || false;
        config.vault.backupTarget = input.vaultBackupTarget;
    }

    // Vector
    config.vector.backend = input.vectorBackend || "local";
    config.vector.embeddingProvider = input.embeddingProvider || "builtin";
    config.vector.ollamaModel = input.ollamaModel || "nomic-embed-text";
    config.vector.ollamaUrl = input.ollamaUrl || "http://localhost:11434";
    config.vector.ttlDays = input.ttlDays;
    config.vector.semanticCachingEnabled = input.semanticCaching || false;
    config.vector.globalMemoryEnabled = input.globalMemory || false;

    // Set dimensions based on provider
    switch (config.vector.embeddingProvider) {
        case "ollama": config.vector.dimensions = 768; break;
        case "openai": config.vector.dimensions = 1536; break;
        case "builtin": config.vector.dimensions = 384; break;
    }

    // GitHub
    if (input.githubEnabled) {
        config.github.enabled = true;
        config.github.autoSync = input.githubAutoSync || false;
    }

    // Profiles
    if (input.profileEnabled) {
        config.profiles.enabled = true;
        config.profiles.defaultProfile = input.defaultProfile;
        config.profiles.customDescription = input.customProfileDescription;
    }

    // Scheduled Tasks
    if (input.scheduledTasksEnabled) {
        config.scheduledTasks.enabled = true;
        // Default tasks
        config.scheduledTasks.tasks = [
            { cron: "0 9 * * 1", title: "Weekly code quality check", action: "quality_run" },
            { cron: "0 0 * * *", title: "Daily memory cleanup", action: "vector_cleanup" },
        ];
    }

    // Plugins
    if (input.pluginsEnabled) {
        config.plugins.enabled = true;
    }

    const configPath = await saveSwarmConfig(config, input.repoPath);

    return {
        success: true,
        message: t("complete", locale),
        config,
        configPath,
        locale,
    };
}

/**
 * Get wizard prompt (what to ask the user)
 */
export function getWizardPrompt(locale?: Locale): {
    locale: Locale;
    prompt: string;
    choices: Record<string, any>;
} {
    const l = locale || detectLocale();

    return {
        locale: l,
        prompt: t("welcome", l) + "\n\n" + t("modeQuestion", l),
        choices: {
            mode: {
                question: t("modeQuestion", l),
                options: [
                    { value: "standard", label: t("standard", l) },
                    { value: "configured", label: t("configured", l) },
                ],
            },
            vault: { question: t("vaultQuestion", l), type: "boolean" },
            vectorBackend: {
                question: t("vectorQuestion", l),
                options: ["local", "chroma", "supabase", "qdrant", "pinecone", "turso"],
            },
            embeddingProvider: {
                question: t("embeddingQuestion", l),
                options: [
                    { value: "ollama", label: `Ollama ${t("ollamaRecommended", l)}` },
                    { value: "openai", label: `OpenAI ${t("openaiPaid", l)}` },
                    { value: "builtin", label: `simpleEmbed v2 ${t("builtinOffline", l)}` },
                ],
            },
            github: { question: t("githubQuestion", l), type: "boolean" },
            globalMemory: { question: t("globalMemoryQuestion", l), type: "boolean" },
            profile: {
                question: t("profileQuestion", l),
                options: ["frontend", "backend", "security", "devops", "fullstack", "custom"],
            },
            scheduledTasks: { question: t("scheduledQuestion", l), type: "boolean" },
            plugins: { question: t("pluginsQuestion", l), type: "boolean" },
        },
    };
}
