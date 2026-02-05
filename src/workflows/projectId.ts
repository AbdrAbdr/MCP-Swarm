/**
 * Smart Project ID Resolution
 * 
 * Каскадная логика:
 * 1. SWARM_PROJECT env → использовать как есть
 * 2. git remote origin → нормализовать в ID
 * 3. Имя папки + короткий хеш пути
 */

import { createHash } from "node:crypto";
import path from "node:path";
import { gitTry } from "./git.js";

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

    // 3. Fallback: имя папки + хеш пути
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
 * Получить ID из локального пути
 * 
 * C:\Users\abdr\Desktop\MCP\MCP0 → "MCP0_a1b2c3"
 */
function getPathBasedId(repoPath: string): string {
    const basename = path.basename(repoPath);
    const hash = shortHash(repoPath);
    return sanitizeId(`${basename}_${hash}`);
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
 * Получить описание источника Project ID (для логирования)
 */
export async function getProjectIdSource(repoPath: string): Promise<{
    id: string;
    source: "env" | "git" | "path";
    details: string;
}> {
    const envProject = process.env.SWARM_PROJECT;
    if (envProject && envProject !== "default") {
        return { id: envProject, source: "env", details: "SWARM_PROJECT" };
    }

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

    const id = getPathBasedId(repoPath);
    return { id, source: "path", details: repoPath };
}
