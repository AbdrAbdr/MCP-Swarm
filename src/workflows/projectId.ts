/**
 * Smart Project ID Resolution
 * 
 * Каскадная логика:
 * 1. SWARM_PROJECT env → использовать как есть
 * 2. git remote origin → нормализовать в ID
 * 3. Нет git? → предложить git init + gh repo create
 * 4. Fallback: имя папки (без хеша)
 */

import { createHash } from "node:crypto";
import path from "node:path";
import { gitTry } from "./git.js";

export type ProjectIdResult = {
    id: string;
    source: "env" | "git" | "path";
    details: string;
    /** Suggestions for the agent if git is not configured */
    suggestions?: string[];
};

/**
 * Получить уникальный Project ID для репозитория
 */
export async function getProjectId(repoPath: string): Promise<string> {
    // 1. Явно заданный через env
    const envProject = process.env.SWARM_PROJECT;
    if (envProject && envProject !== "default") {
        return envProject;
    }

    // 2. Из git remote origin
    const remoteId = await getGitRemoteId(repoPath);
    if (remoteId) {
        return remoteId;
    }

    // 3. Fallback: имя папки
    return getPathBasedId(repoPath);
}

/**
 * Получить ID из git remote origin
 * 
 * Примеры:
 * - https://github.com/user/repo.git → "github_user_repo"
 * - git@github.com:user/repo.git → "github_user_repo"
 * - https://gitlab.com/org/project → "gitlab_org_project"
 */
async function getGitRemoteId(repoPath: string): Promise<string | null> {
    try {
        const result = await gitTry(["remote", "get-url", "origin"], { cwd: repoPath });
        if (!result.ok || !result.stdout?.trim()) {
            return null;
        }

        const url = result.stdout.trim();
        return normalizeGitRemote(url);
    } catch {
        return null;
    }
}

/**
 * Нормализовать git remote URL в Project ID
 */
export function normalizeGitRemote(url: string): string {
    let normalized = url
        // Убрать протоколы
        .replace(/^(https?:\/\/|git@|ssh:\/\/)/i, "")
        // Убрать .git суффикс
        .replace(/\.git$/i, "")
        // git@github.com:user/repo → github.com/user/repo
        .replace(":", "/")
        // Убрать порты
        .replace(/:\d+\//, "/")
        // Убрать username@ (git@)
        .replace(/^[^@]+@/, "");

    // Разделить на части: host/owner/repo
    const parts = normalized.split("/").filter(Boolean);

    if (parts.length >= 3) {
        // github.com/user/repo → github_user_repo
        const host = parts[0].split(".")[0]; // github.com → github
        const owner = parts[1];
        const repo = parts[parts.length - 1]; // последний элемент (для monorepo путей)
        return sanitizeId(`${host}_${owner}_${repo}`);
    }

    if (parts.length === 2) {
        // user/repo (без хоста) → user_repo
        return sanitizeId(`${parts[0]}_${parts[1]}`);
    }

    // Fallback: хешируем весь URL
    return sanitizeId(`remote_${shortHash(url)}`);
}

/**
 * Получить ID из локального пути (только имя папки, без хеша)
 * 
 * C:\Users\abdr\Desktop\Intop Saas → "intop_saas"
 */
function getPathBasedId(repoPath: string): string {
    const basename = path.basename(repoPath);
    return sanitizeId(basename);
}

/**
 * Короткий хеш строки (6 символов)
 */
function shortHash(input: string): string {
    return createHash("sha256")
        .update(input.toLowerCase())
        .digest("hex")
        .substring(0, 6);
}

/**
 * Очистить ID от недопустимых символов
 */
function sanitizeId(id: string): string {
    return id
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .substring(0, 64); // Ограничить длину
}

/**
 * Проверить наличие git в каталоге
 */
async function isGitInitialized(repoPath: string): Promise<boolean> {
    const result = await gitTry(["rev-parse", "--is-inside-work-tree"], { cwd: repoPath });
    return result.ok && result.stdout?.trim() === "true";
}

/**
 * Проверить наличие remote origin
 */
async function hasRemoteOrigin(repoPath: string): Promise<boolean> {
    const result = await gitTry(["remote", "get-url", "origin"], { cwd: repoPath });
    return result.ok && !!result.stdout?.trim();
}

/**
 * Получить описание источника Project ID + предложения если git не настроен
 */
export async function getProjectIdSource(repoPath: string): Promise<ProjectIdResult> {
    // 1. Из env
    const envProject = process.env.SWARM_PROJECT;
    if (envProject && envProject !== "default") {
        return { id: envProject, source: "env", details: "SWARM_PROJECT" };
    }

    // 2. Проверяем git
    const gitInited = await isGitInitialized(repoPath);

    if (gitInited) {
        const hasRemote = await hasRemoteOrigin(repoPath);

        if (hasRemote) {
            // Git + remote → идеальный случай 
            try {
                const result = await gitTry(["remote", "get-url", "origin"], { cwd: repoPath });
                if (result.ok && result.stdout?.trim()) {
                    const url = result.stdout.trim();
                    const id = normalizeGitRemote(url);
                    return { id, source: "git", details: url };
                }
            } catch {
                // ignore
            }
        }

        // Git есть, но remote нет → предложить добавить remote
        const folderName = path.basename(repoPath);
        const id = getPathBasedId(repoPath);
        return {
            id,
            source: "path",
            details: repoPath,
            suggestions: [
                `⚠️ Git-репозиторий без remote origin. Project ID = "${id}" (имя папки).`,
                `Для лучшей идентификации проекта, добавьте GitHub remote:`,
                `  1. Создайте репозиторий: gh repo create ${folderName} --private --source=. --push`,
                `  2. Или добавьте существующий: git remote add origin https://github.com/YOUR_USER/${folderName}.git`,
                `После этого Project ID будет автоматически определён из GitHub.`,
            ],
        };
    }

    // 3. Git не инициализирован → предложить полную инициализацию
    const folderName = path.basename(repoPath);
    const id = getPathBasedId(repoPath);
    return {
        id,
        source: "path",
        details: repoPath,
        suggestions: [
            `⚠️ Каталог "${folderName}" не является Git-репозиторием. Project ID = "${id}" (имя папки).`,
            `Рекомендуем инициализировать Git + GitHub для надёжной идентификации:`,
            `  1. git init`,
            `  2. git add -A`,
            `  3. git commit -m "Initial commit"`,
            `  4. gh repo create ${folderName} --private --source=. --push`,
            `Это создаст приватный репозиторий на GitHub и автоматически настроит remote.`,
            `Project ID станет "github_YOUR_USER_${sanitizeId(folderName)}".`,
            ``,
            `Если вы хотите работать только локально, текущий Project ID "${id}" будет использован.`,
        ],
    };
}
