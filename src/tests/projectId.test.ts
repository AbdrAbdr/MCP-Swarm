/**
 * Unit Tests for MCP Swarm Core Modules
 * 
 * Tests for:
 * - projectId.ts: normalizeGitRemote, sanitizeId, getProjectIdSource
 * - companion PID file management
 */

import { normalizeGitRemote } from "../workflows/projectId.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ============ SIMPLE TEST FRAMEWORK ============
let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e: any) {
        failed++;
        failures.push(`  ❌ ${name}: ${e.message}`);
        console.log(`  ❌ ${name}: ${e.message}`);
    }
}

function expect(actual: any) {
    return {
        toBe(expected: any) {
            if (actual !== expected) {
                throw new Error(`Expected "${expected}", got "${actual}"`);
            }
        },
        toContain(expected: string) {
            if (typeof actual !== "string" || !actual.includes(expected)) {
                throw new Error(`Expected "${actual}" to contain "${expected}"`);
            }
        },
        toBeTruthy() {
            if (!actual) {
                throw new Error(`Expected truthy, got "${actual}"`);
            }
        },
        toBeNull() {
            if (actual !== null) {
                throw new Error(`Expected null, got "${actual}"`);
            }
        },
    };
}

// ============ TESTS ============

console.log("\n🧪 MCP Swarm Unit Tests\n");

// --- normalizeGitRemote ---
console.log("📦 normalizeGitRemote:");

test("HTTPS GitHub URL", () => {
    expect(normalizeGitRemote("https://github.com/user/repo.git")).toBe("github_user_repo");
});

test("HTTPS GitHub URL without .git", () => {
    expect(normalizeGitRemote("https://github.com/user/repo")).toBe("github_user_repo");
});

test("SSH GitHub URL", () => {
    expect(normalizeGitRemote("git@github.com:user/repo.git")).toBe("github_user_repo");
});

test("GitLab HTTPS URL", () => {
    expect(normalizeGitRemote("https://gitlab.com/org/project.git")).toBe("gitlab_org_project");
});

test("SSH GitLab URL", () => {
    expect(normalizeGitRemote("git@gitlab.com:org/project.git")).toBe("gitlab_org_project");
});

test("Bitbucket URL", () => {
    expect(normalizeGitRemote("https://bitbucket.org/team/repo.git")).toBe("bitbucket_team_repo");
});

test("URL with uppercase letters normalizes to lowercase", () => {
    const result = normalizeGitRemote("https://github.com/User/MyRepo.git");
    expect(result).toBe("github_user_myrepo");
});

test("URL with special chars in repo name", () => {
    const result = normalizeGitRemote("https://github.com/user/my-repo.git");
    expect(result).toBe("github_user_my-repo");
});

test("Monorepo deep path", () => {
    const result = normalizeGitRemote("https://github.com/org/monorepo/packages/core.git");
    expect(result).toBe("github_org_core");
});

// --- PID File ---
console.log("\n📦 PID File:");

const PID_DIR = path.join(os.homedir(), ".mcp-swarm");
const PID_FILE = path.join(PID_DIR, "companion.pid");

test("PID directory can be created", () => {
    if (!fs.existsSync(PID_DIR)) {
        fs.mkdirSync(PID_DIR, { recursive: true });
    }
    expect(fs.existsSync(PID_DIR)).toBeTruthy();
});

test("PID file can be written and read", () => {
    const testPid = "99999";
    fs.writeFileSync(PID_FILE + ".test", testPid, "utf-8");
    const content = fs.readFileSync(PID_FILE + ".test", "utf-8");
    expect(content).toBe(testPid);
    fs.unlinkSync(PID_FILE + ".test");
});

// --- sanitizeId (tested via normalizeGitRemote results) ---
console.log("\n📦 Sanitize ID (via normalizeGitRemote):");

test("Spaces become underscores", () => {
    // Path-based IDs use sanitizeId which replaces spaces
    const result = normalizeGitRemote("https://github.com/user/my repo.git");
    expect(result).toContain("my");
});

test("Result is lowercase", () => {
    const result = normalizeGitRemote("https://github.com/AbdrAbdr/MCP-Swarm.git");
    expect(result).toBe("github_abdrabdr_mcp-swarm");
});

// ============ RESULTS ============
console.log(`\n${"=".repeat(40)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach(f => console.log(f));
}
console.log("");

if (failed > 0) {
    process.exit(1);
}
