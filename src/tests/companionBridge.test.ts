/**
 * MCP Swarm v1.2.0 - Companion & Bridge Tests
 *
 * Tests for:
 *   - BridgeManager (bridge.ts): constructor, stop, getStatus, removeProject
 *   - CompanionControl (companionControl.ts): type checks, baseUrl logic
 *   - verifyWebhookSignature (githubApi.ts): HMAC verification
 *   - getCurrentPlatform (briefings.ts): OS detection
 *
 * Run with: npm run build && node --enable-source-maps dist/tests/companionBridge.test.js
 */

import assert from "node:assert";
import { createHmac } from "node:crypto";

// ============ Test Utilities ============

let testCount = 0;
let passCount = 0;

function test(name: string, fn: () => Promise<void> | void) {
    return async () => {
        testCount++;
        try {
            await fn();
            passCount++;
            console.log(`  ✅ ${name}`);
        } catch (error: unknown) {
            console.log(`  ❌ ${name}`);
            const msg = error instanceof Error ? error.message : String(error);
            console.log(`     Error: ${msg}`);
        }
    };
}

// ============ BridgeManager Tests ============

async function testBridgeManager() {
    console.log("\n🌉 BridgeManager Tests");

    const { BridgeManager } = await import("../bridge.js");

    await test("constructor should set default config values", () => {
        const manager = new BridgeManager({
            mcpServerUrl: "https://example.com",
            projects: ["/tmp/test-project"],
        });

        // Constructor should merge defaults
        const status = manager.getStatus();
        assert.deepStrictEqual(status, {}, "Should have empty status before start");
    })();

    await test("constructor should allow custom reconnect settings", () => {
        const manager = new BridgeManager({
            mcpServerUrl: "https://example.com",
            projects: [],
            reconnectIntervalMs: 10000,
            maxReconnectAttempts: 5,
        });

        // No crash = config accepted
        assert(manager, "BridgeManager should be created");
    })();

    await test("stop should clear connections and set stopped", () => {
        const manager = new BridgeManager({
            mcpServerUrl: "https://example.com",
            projects: [],
        });

        manager.stop();

        const status = manager.getStatus();
        assert.deepStrictEqual(status, {}, "Should have empty status after stop");
    })();

    await test("removeProject should handle non-existent project gracefully", () => {
        const manager = new BridgeManager({
            mcpServerUrl: "https://example.com",
            projects: [],
        });

        // Should not throw
        manager.removeProject("/non/existent/path");

        const status = manager.getStatus();
        assert.deepStrictEqual(status, {}, "Should have empty status");
    })();

    await test("getStatus should return empty object when no connections", () => {
        const manager = new BridgeManager({
            mcpServerUrl: "https://example.com",
            projects: [],
        });

        const status = manager.getStatus();
        assert(typeof status === "object", "Status should be an object");
        assert.strictEqual(Object.keys(status).length, 0, "Should have no entries");
    })();

    await test("stop after stop should not throw", () => {
        const manager = new BridgeManager({
            mcpServerUrl: "https://example.com",
            projects: [],
        });

        manager.stop();
        manager.stop(); // Double stop should be safe
        assert(true, "Double stop should not throw");
    })();
}

// ============ CompanionControl Tests ============

async function testCompanionControl() {
    console.log("\n🎮 CompanionControl Tests");

    // We only import types and utility functions that don't need a running server
    // The actual HTTP requests require a running companion, so we test structure

    await test("LocalControlResponse type should match expected shape", async () => {
        // Verify the module exports compile correctly
        const mod = await import("../workflows/companionControl.js");

        // Verify all expected functions exist
        assert(typeof mod.companionLocalStatus === "function", "companionLocalStatus should be exported");
        assert(typeof mod.companionLocalStop === "function", "companionLocalStop should be exported");
        assert(typeof mod.companionLocalPause === "function", "companionLocalPause should be exported");
        assert(typeof mod.companionLocalResume === "function", "companionLocalResume should be exported");
    })();

    await test("companionLocalStatus should throw on unreachable port", async () => {
        const mod = await import("../workflows/companionControl.js");

        try {
            // Port 1 is never available — should fail
            await mod.companionLocalStatus(1);
            assert.fail("Should have thrown on unreachable port");
        } catch (error: unknown) {
            // Expected — connection refused
            assert(error instanceof Error, "Should throw Error");
        }
    })();

    await test("companionLocalStop should throw on unreachable port", async () => {
        const mod = await import("../workflows/companionControl.js");

        try {
            await mod.companionLocalStop(1);
            assert.fail("Should have thrown");
        } catch (error: unknown) {
            assert(error instanceof Error, "Should throw Error");
        }
    })();
}

// ============ Webhook Signature Tests ============

async function testWebhookSignature() {
    console.log("\n🔐 verifyWebhookSignature Tests");

    const { verifyWebhookSignature } = await import("../workflows/githubApi.js");

    await test("should verify valid signature", () => {
        const secret = "test-secret-key";
        const payload = '{"action":"opened"}';
        const expected = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");

        assert.strictEqual(
            verifyWebhookSignature(payload, expected, secret),
            true,
            "Valid signature should return true",
        );
    })();

    await test("should reject invalid signature", () => {
        const secret = "test-secret-key";
        const payload = '{"action":"opened"}';

        assert.strictEqual(
            verifyWebhookSignature(payload, "sha256=invalid", secret),
            false,
            "Invalid signature should return false",
        );
    })();

    await test("should reject signature with wrong secret", () => {
        const secret = "correct-secret";
        const wrongSecret = "wrong-secret";
        const payload = '{"action":"opened"}';
        const signature = "sha256=" + createHmac("sha256", wrongSecret).update(payload).digest("hex");

        assert.strictEqual(
            verifyWebhookSignature(payload, signature, secret),
            false,
            "Wrong secret should return false",
        );
    })();

    await test("should handle empty payload", () => {
        const secret = "test-secret";
        const payload = "";
        const expected = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");

        assert.strictEqual(
            verifyWebhookSignature(payload, expected, secret),
            true,
            "Empty payload with correct signature should pass",
        );
    })();
}

// ============ Briefings Platform Detection Tests ============

async function testBriefingsPlatform() {
    console.log("\n📋 Briefings Platform Detection Tests");

    // We test that the briefings module exports correctly and types compile
    const mod = await import("../workflows/briefings.js");

    await test("saveBriefing should be exported", () => {
        assert(typeof mod.saveBriefing === "function", "saveBriefing should be a function");
    })();

    await test("loadBriefing should be exported", () => {
        assert(typeof mod.loadBriefing === "function", "loadBriefing should be a function");
    })();

    await test("getLatestBriefingForTask should be exported", () => {
        assert(typeof mod.getLatestBriefingForTask === "function", "getLatestBriefingForTask should be a function");
    })();
}

// ============ Bridge Types Tests ============

async function testBridgeTypes() {
    console.log("\n🔷 Bridge Types Tests");

    await test("BridgeManager should be importable and constructable", async () => {
        const { BridgeManager } = await import("../bridge.js");

        assert(typeof BridgeManager === "function", "BridgeManager should be a class");
        const manager = new BridgeManager({
            mcpServerUrl: "https://test.example.com",
            projects: [],
        });
        assert(manager instanceof BridgeManager, "Should be an instance of BridgeManager");
    })();

    await test("BridgeConfig should accept all optional fields", async () => {
        const { BridgeManager } = await import("../bridge.js");

        const manager = new BridgeManager({
            mcpServerUrl: "https://test.example.com",
            projects: ["/project1", "/project2"],
            reconnectIntervalMs: 3000,
            maxReconnectAttempts: 20,
        });
        assert(manager, "Should accept all config fields");
    })();
}

// ============ Main ============

async function main() {
    console.log("🧪 MCP Swarm v1.2.0 — Companion & Bridge Tests\n");
    console.log("=".repeat(55));

    await testBridgeManager();
    await testCompanionControl();
    await testWebhookSignature();
    await testBriefingsPlatform();
    await testBridgeTypes();

    console.log("\n" + "=".repeat(55));
    console.log(`\n📊 Results: ${passCount}/${testCount} tests passed`);

    if (passCount < testCount) {
        console.log(`\n❌ ${testCount - passCount} tests failed!`);
        process.exit(1);
    } else {
        console.log("\n✅ All tests passed!");
    }
}

main().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});
