/**
 * GitHub API — Two-way Issue ↔ Task synchronization
 * 
 * MCP Swarm v1.2.0
 * 
 * Features:
 * - Auto-detect GitHub authentication (gh CLI → credential-manager → env → Vault)
 * - Create/update GitHub Issues from Swarm Tasks
 * - Sync GitHub Issues to Swarm Tasks
 * - Webhook verification for real-time updates
 */

import { execSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { getVaultSecret } from "./vault.js";
import { loadSwarmConfig } from "./setupWizard.js";
import { getNormalizedOrigin } from "./repo.js";

// ============ TYPES ============

export interface GitHubIssue {
    number: number;
    title: string;
    body: string;
    state: "open" | "closed";
    labels: string[];
    assignees: string[];
    created_at: string;
    updated_at: string;
    html_url: string;
}

/** Raw GitHub API issue shape (labels/assignees are objects) */
interface RawGitHubIssue {
    number: number;
    title: string;
    body: string | null;
    state: "open" | "closed";
    labels: Array<{ name: string } | string>;
    assignees: Array<{ login: string } | string>;
    created_at: string;
    updated_at: string;
    html_url: string;
}

export interface GitHubAuthResult {
    token: string;
    source: "gh_cli" | "credential_manager" | "env" | "vault" | "none";
    user?: string;
}

// ============ AUTH DETECTION CASCADE ============

/**
 * Auto-detect GitHub authentication.
 * Priority: gh CLI → git credential → GITHUB_TOKEN env → Vault → none
 */
export async function detectGitHubAuth(): Promise<GitHubAuthResult> {
    // 1. Try gh CLI
    try {
        const token = execSync("gh auth token", { encoding: "utf8", timeout: 5000 }).trim();
        if (token && token.length > 10) {
            let user: string | undefined;
            try {
                user = execSync("gh api user --jq .login", { encoding: "utf8", timeout: 5000 }).trim();
            } catch { /* */ }
            return { token, source: "gh_cli", user };
        }
    } catch { /* */ }

    // 2. Try git credential-manager
    try {
        const result = execSync(
            'echo "protocol=https\nhost=github.com\n" | git credential fill',
            { encoding: "utf8", timeout: 5000, shell: "bash" },
        );
        const match = result.match(/password=(.+)/);
        if (match?.[1]) {
            return { token: match[1].trim(), source: "credential_manager" };
        }
    } catch { /* */ }

    // 3. Try environment variable
    const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (envToken) {
        return { token: envToken, source: "env" };
    }

    // 4. Try Vault
    const vaultToken = getVaultSecret("GITHUB_TOKEN");
    if (vaultToken) {
        return { token: vaultToken, source: "vault" };
    }

    // 5. No auth found
    return { token: "", source: "none" };
}

// ============ GITHUB API HELPERS ============

async function githubFetch(
    endpoint: string,
    token: string,
    options: { method?: string; body?: unknown } = {},
): Promise<unknown> {
    const resp = await fetch(`https://api.github.com${endpoint}`, {
        method: options.method || "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "MCP-Swarm/1.2.0",
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
        const error = await resp.text();
        throw new Error(`GitHub API ${resp.status}: ${error}`);
    }

    return resp.json();
}

/**
 * Parse "owner/repo" from git remote URL
 */
export function parseOwnerRepo(remoteUrl: string): { owner: string; repo: string } | null {
    // SSH format: git@github.com:owner/repo.git
    const sshMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

    // HTTPS format: https://github.com/owner/repo.git
    const httpsMatch = remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };

    return null;
}

// ============ PUBLIC API ============

/**
 * Get auth status
 */
export async function getAuthStatus(): Promise<GitHubAuthResult & { authenticated: boolean }> {
    const auth = await detectGitHubAuth();
    return { ...auth, authenticated: auth.source !== "none" };
}

/**
 * List issues from the repository
 */
export async function listIssues(input: {
    repoPath?: string;
    state?: "open" | "closed" | "all";
    labels?: string;
    limit?: number;
}): Promise<{ issues: GitHubIssue[]; total: number; repo: string }> {
    const auth = await detectGitHubAuth();
    if (!auth.token) throw new Error("GitHub not authenticated. Please configure auth first.");

    const origin = await getNormalizedOrigin(input.repoPath || process.cwd());
    const parsed = parseOwnerRepo(origin);
    if (!parsed) throw new Error("Could not determine GitHub repository from git remote.");

    const params = new URLSearchParams({
        state: input.state || "open",
        per_page: String(input.limit || 30),
        sort: "updated",
        direction: "desc",
    });
    if (input.labels) params.set("labels", input.labels);

    const issues = await githubFetch(
        `/repos/${parsed.owner}/${parsed.repo}/issues?${params}`,
        auth.token,
    ) as RawGitHubIssue[];

    return {
        issues: issues.map(i => ({
            number: i.number,
            title: i.title,
            body: i.body || "",
            state: i.state,
            labels: i.labels?.map((l) => typeof l === "string" ? l : l.name) || [],
            assignees: i.assignees?.map((a) => typeof a === "string" ? a : a.login) || [],
            created_at: i.created_at,
            updated_at: i.updated_at,
            html_url: i.html_url,
        })),
        total: issues.length,
        repo: `${parsed.owner}/${parsed.repo}`,
    };
}

/**
 * Create an issue from a Swarm task
 */
export async function createIssueFromTask(input: {
    repoPath?: string;
    title: string;
    body?: string;
    labels?: string[];
    assignees?: string[];
}): Promise<{ issue: GitHubIssue; url: string }> {
    const auth = await detectGitHubAuth();
    if (!auth.token) throw new Error("GitHub not authenticated.");

    const origin = await getNormalizedOrigin(input.repoPath || process.cwd());
    const parsed = parseOwnerRepo(origin);
    if (!parsed) throw new Error("Could not determine GitHub repository.");

    const issue = await githubFetch(
        `/repos/${parsed.owner}/${parsed.repo}/issues`,
        auth.token,
        {
            method: "POST",
            body: {
                title: input.title,
                body: input.body || "",
                labels: input.labels || ["swarm"],
                assignees: input.assignees || [],
            },
        },
    ) as RawGitHubIssue;

    return {
        issue: {
            number: issue.number,
            title: issue.title,
            body: issue.body || "",
            state: issue.state,
            labels: issue.labels?.map((l) => typeof l === "string" ? l : l.name) || [],
            assignees: issue.assignees?.map((a) => typeof a === "string" ? a : a.login) || [],
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            html_url: issue.html_url,
        },
        url: issue.html_url,
    };
}

/**
 * Close an issue (when task is done)
 */
export async function closeIssue(input: {
    repoPath?: string;
    issueNumber: number;
    comment?: string;
}): Promise<{ closed: boolean }> {
    const auth = await detectGitHubAuth();
    if (!auth.token) throw new Error("GitHub not authenticated.");

    const origin = await getNormalizedOrigin(input.repoPath || process.cwd());
    const parsed = parseOwnerRepo(origin);
    if (!parsed) throw new Error("Could not determine GitHub repository.");

    // Add comment if provided
    if (input.comment) {
        await githubFetch(
            `/repos/${parsed.owner}/${parsed.repo}/issues/${input.issueNumber}/comments`,
            auth.token,
            { method: "POST", body: { body: input.comment } },
        );
    }

    // Close the issue
    await githubFetch(
        `/repos/${parsed.owner}/${parsed.repo}/issues/${input.issueNumber}`,
        auth.token,
        { method: "PATCH", body: { state: "closed" } },
    );

    return { closed: true };
}

/**
 * Sync GitHub Issues → Swarm Tasks (returns tasks to create)
 */
export async function syncFromGitHub(input: {
    repoPath?: string;
    label?: string;
}): Promise<{
    newTasks: Array<{ title: string; body: string; issueNumber: number; labels: string[] }>;
    total: number;
}> {
    const result = await listIssues({
        repoPath: input.repoPath,
        state: "open",
        labels: input.label || "swarm",
    });

    const newTasks = result.issues.map(issue => ({
        title: `[GH#${issue.number}] ${issue.title}`,
        body: issue.body,
        issueNumber: issue.number,
        labels: issue.labels,
    }));

    return { newTasks, total: newTasks.length };
}

/**
 * Verify GitHub webhook signature
 */
export function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
): boolean {
    const expected = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
    return signature === expected;
}
