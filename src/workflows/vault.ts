/**
 * Swarm Vault — Encrypted Secret Storage
 * 
 * MCP Swarm v1.2.0
 * 
 * AES-256-GCM encrypted local vault for API keys and secrets.
 * Uses PBKDF2 for key derivation from user password.
 * Zero external dependencies — uses only node:crypto.
 * 
 * Storage: .swarm/vault.enc
 * 
 * Features:
 * - AES-256-GCM encryption
 * - PBKDF2 key derivation (100,000 iterations)
 * - Session-based: password once → key in memory → cleared on exit
 * - Backup/Restore for machine migration
 * - Version-stable format (survives updates)
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

export interface VaultData {
    [key: string]: string;
}

interface VaultFile {
    version: number;
    salt: string;       // hex, for PBKDF2
    iv: string;         // hex, for AES-256-GCM
    authTag: string;    // hex, integrity check
    data: string;       // base64, encrypted JSON
}

export type VaultAction =
    | "init"
    | "set"
    | "get"
    | "list"
    | "delete"
    | "has"
    | "status"
    | "lock"
    | "rotate"
    | "export"
    | "import"
    | "destroy"
    | "audit";

/** Audit log entry for vault operations */
interface VaultAuditEntry {
    ts: string;
    action: string;
    key?: string;
    success: boolean;
    message?: string;
}

// ============ CONSTANTS ============

const VAULT_DIR = ".swarm";
const VAULT_FILE = "vault.enc";
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 32; // 256 bits
const PBKDF2_DIGEST = "sha512";
const AES_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const VAULT_VERSION = 1;

// ============ SESSION STATE ============

/** In-memory session: derived key + decrypted data */
let sessionKey: Buffer | null = null;
let sessionData: VaultData | null = null;

/** Audit log (in-memory, cleared on process restart) */
const auditLog: VaultAuditEntry[] = [];
const MAX_AUDIT_LOG = 500;

function logAudit(action: string, success: boolean, key?: string, message?: string): void {
    auditLog.push({ ts: new Date().toISOString(), action, key, success, message });
    if (auditLog.length > MAX_AUDIT_LOG) auditLog.splice(0, auditLog.length - MAX_AUDIT_LOG);
}

/** Auto-lock timer */
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_LOCK_MS = Number(process.env.SWARM_VAULT_TIMEOUT || 30 * 60 * 1000); // 30 min default

function resetAutoLock(): void {
    if (autoLockTimer) clearTimeout(autoLockTimer);
    if (sessionKey) {
        autoLockTimer = setTimeout(() => {
            sessionKey = null;
            sessionData = null;
            autoLockTimer = null;
            logAudit("auto_lock", true, undefined, "Vault auto-locked due to inactivity");
        }, AUTO_LOCK_MS);
    }
}

// Clear session on process exit
process.on("exit", () => {
    sessionKey = null;
    sessionData = null;
    if (autoLockTimer) clearTimeout(autoLockTimer);
});

// ============ CRYPTO HELPERS ============

function deriveKey(password: string, salt: Buffer): Buffer {
    return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST);
}

function encrypt(data: string, key: Buffer): { iv: string; authTag: string; encrypted: string } {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(AES_ALGORITHM, key, iv);

    let encrypted = cipher.update(data, "utf8", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    return {
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
        encrypted,
    };
}

function decrypt(encrypted: string, key: Buffer, iv: string, authTag: string): string {
    const decipher = createDecipheriv(AES_ALGORITHM, key, Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(authTag, "hex"));

    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

// ============ FILE HELPERS ============

async function getVaultPath(repoRoot: string): Promise<string> {
    const dir = path.join(repoRoot, VAULT_DIR);
    await fs.mkdir(dir, { recursive: true });
    return path.join(dir, VAULT_FILE);
}

async function vaultExists(repoRoot: string): Promise<boolean> {
    const vaultPath = path.join(repoRoot, VAULT_DIR, VAULT_FILE);
    try {
        await fs.access(vaultPath);
        return true;
    } catch {
        return false;
    }
}

async function loadVaultFile(repoRoot: string): Promise<VaultFile | null> {
    try {
        const vaultPath = path.join(repoRoot, VAULT_DIR, VAULT_FILE);
        const raw = await fs.readFile(vaultPath, "utf8");
        return JSON.parse(raw) as VaultFile;
    } catch {
        return null;
    }
}

async function saveVaultFile(repoRoot: string, vaultFile: VaultFile): Promise<void> {
    const vaultPath = await getVaultPath(repoRoot);
    await fs.writeFile(vaultPath, JSON.stringify(vaultFile, null, 2), "utf8");
}

// ============ SESSION MANAGEMENT ============

function ensureSession(): void {
    if (!sessionKey || !sessionData) {
        throw new Error(
            "Vault is locked. Call swarm_vault({ action: 'init', password: '...' }) first to unlock."
        );
    }
    resetAutoLock();
}

async function persistSession(repoRoot: string): Promise<void> {
    if (!sessionKey || !sessionData) return;

    const vaultFile = await loadVaultFile(repoRoot);
    if (!vaultFile) return;

    const plaintext = JSON.stringify(sessionData);
    const { iv, authTag, encrypted } = encrypt(plaintext, sessionKey);

    vaultFile.iv = iv;
    vaultFile.authTag = authTag;
    vaultFile.data = encrypted;

    await saveVaultFile(repoRoot, vaultFile);
}

// ============ PUBLIC API ============

/**
 * Initialize or unlock the vault
 */
export async function initVault(input: {
    repoPath?: string;
    password?: string;
}): Promise<{ success: boolean; message: string; isNew: boolean }> {
    const repoRoot = await getRepoRoot(input.repoPath);

    // Try env password first
    const password = input.password || process.env.SWARM_VAULT_PASSWORD;
    if (!password) {
        return {
            success: false,
            message: "Password required. Provide via 'password' parameter or SWARM_VAULT_PASSWORD env.",
            isNew: false,
        };
    }

    const exists = await vaultExists(repoRoot);

    if (exists) {
        // Unlock existing vault
        const vaultFile = await loadVaultFile(repoRoot);
        if (!vaultFile) {
            return { success: false, message: "Vault file corrupted. Use 'import' to restore from backup.", isNew: false };
        }

        const salt = Buffer.from(vaultFile.salt, "hex");
        const key = deriveKey(password, salt);

        try {
            const plaintext = decrypt(vaultFile.data, key, vaultFile.iv, vaultFile.authTag);
            sessionKey = key;
            sessionData = JSON.parse(plaintext);

            const keyCount = Object.keys(sessionData!).length;
            logAudit("init", true, undefined, `Unlocked with ${keyCount} key(s)`);
            resetAutoLock();
            return {
                success: true,
                message: `Vault unlocked. ${keyCount} key(s) loaded.`,
                isNew: false,
            };
        } catch {
            logAudit("init", false, undefined, "Wrong password");
            return { success: false, message: "Wrong password.", isNew: false };
        }
    } else {
        // Create new vault
        const salt = randomBytes(SALT_LENGTH);
        const key = deriveKey(password, salt);

        const emptyData: VaultData = {};
        const plaintext = JSON.stringify(emptyData);
        const { iv, authTag, encrypted } = encrypt(plaintext, key);

        const vaultFile: VaultFile = {
            version: VAULT_VERSION,
            salt: salt.toString("hex"),
            iv,
            authTag,
            data: encrypted,
        };

        await saveVaultFile(repoRoot, vaultFile);

        sessionKey = key;
        sessionData = emptyData;
        logAudit("init", true, undefined, "New vault created");
        resetAutoLock();

        return {
            success: true,
            message: "New vault created and unlocked.",
            isNew: true,
        };
    }
}

/**
 * Set a secret in the vault
 */
export async function setSecret(input: {
    repoPath?: string;
    key: string;
    value: string;
}): Promise<{ success: boolean; message: string }> {
    ensureSession();
    const repoRoot = await getRepoRoot(input.repoPath);

    if (!input.key || !input.value) {
        return { success: false, message: "Both 'key' and 'value' are required." };
    }

    const isUpdate = input.key in sessionData!;
    sessionData![input.key] = input.value;

    await persistSession(repoRoot);

    const masked = input.value.slice(0, 4) + "..." + input.value.slice(-4);
    logAudit("set", true, input.key, isUpdate ? "updated" : "added");
    return {
        success: true,
        message: `${isUpdate ? "Updated" : "Added"}: ${input.key} = ${masked}`,
    };
}

/**
 * Get a secret from the vault
 */
export function getSecret(input: {
    key: string;
}): { success: boolean; key: string; value?: string; message?: string } {
    ensureSession();

    if (input.key in sessionData!) {
        logAudit("get", true, input.key);
        return {
            success: true,
            key: input.key,
            value: sessionData![input.key],
        };
    }

    logAudit("get", false, input.key, "not found");
    return {
        success: false,
        key: input.key,
        message: `Key '${input.key}' not found in vault.`,
    };
}

/**
 * List all keys (without values)
 */
export function listKeys(): { success: boolean; keys: string[]; count: number } {
    ensureSession();

    const keys = Object.keys(sessionData!);
    return {
        success: true,
        keys,
        count: keys.length,
    };
}

/**
 * Delete a secret
 */
export async function deleteSecret(input: {
    repoPath?: string;
    key: string;
}): Promise<{ success: boolean; message: string }> {
    ensureSession();
    const repoRoot = await getRepoRoot(input.repoPath);

    if (!(input.key in sessionData!)) {
        return { success: false, message: `Key '${input.key}' not found.` };
    }

    delete sessionData![input.key];
    await persistSession(repoRoot);
    logAudit("delete", true, input.key);

    return { success: true, message: `Deleted: ${input.key}` };
}

/**
 * Check if a key exists
 */
export function hasKey(input: { key: string }): { exists: boolean; key: string } {
    ensureSession();
    return {
        exists: input.key in sessionData!,
        key: input.key,
    };
}

/**
 * Get vault status
 */
export async function getStatus(input: {
    repoPath?: string;
}): Promise<{
    exists: boolean;
    locked: boolean;
    keyCount: number;
    vaultPath: string;
}> {
    const repoRoot = await getRepoRoot(input.repoPath);
    const exists = await vaultExists(repoRoot);

    return {
        exists,
        locked: !sessionKey || !sessionData,
        keyCount: sessionData ? Object.keys(sessionData).length : 0,
        vaultPath: path.join(repoRoot, VAULT_DIR, VAULT_FILE),
    };
}

/**
 * Lock the vault (clear session)
 */
export function lockVault(): { success: boolean; message: string } {
    sessionKey = null;
    sessionData = null;
    if (autoLockTimer) { clearTimeout(autoLockTimer); autoLockTimer = null; }
    logAudit("lock", true);

    return { success: true, message: "Vault locked. Session cleared." };
}

/**
 * Export vault for backup (still encrypted)
 */
export async function exportVault(input: {
    repoPath?: string;
    outputPath?: string;
}): Promise<{ success: boolean; message: string; path?: string }> {
    const repoRoot = await getRepoRoot(input.repoPath);

    const exists = await vaultExists(repoRoot);
    if (!exists) {
        return { success: false, message: "No vault to export." };
    }

    const vaultFile = await loadVaultFile(repoRoot);
    if (!vaultFile) {
        return { success: false, message: "Vault file corrupted." };
    }

    const date = new Date().toISOString().slice(0, 10);
    const defaultOutput = path.join(repoRoot, VAULT_DIR, `vault-backup-${date}.enc`);
    const outputPath = input.outputPath || defaultOutput;

    await fs.writeFile(outputPath, JSON.stringify(vaultFile, null, 2), "utf8");

    return {
        success: true,
        message: `Vault exported to: ${outputPath}`,
        path: outputPath,
    };
}

/**
 * Import vault from backup
 */
export async function importVault(input: {
    repoPath?: string;
    file: string;
    password?: string;
}): Promise<{ success: boolean; message: string }> {
    const repoRoot = await getRepoRoot(input.repoPath);

    try {
        const raw = await fs.readFile(input.file, "utf8");
        const vaultFile = JSON.parse(raw) as VaultFile;

        // Validate format
        if (!vaultFile.version || !vaultFile.salt || !vaultFile.iv || !vaultFile.data) {
            return { success: false, message: "Invalid vault backup file format." };
        }

        // Test password if provided
        const password = input.password || process.env.SWARM_VAULT_PASSWORD;
        if (password) {
            const salt = Buffer.from(vaultFile.salt, "hex");
            const key = deriveKey(password, salt);
            try {
                const plaintext = decrypt(vaultFile.data, key, vaultFile.iv, vaultFile.authTag);
                const data = JSON.parse(plaintext);
                sessionKey = key;
                sessionData = data;
            } catch {
                return { success: false, message: "Wrong password for this backup." };
            }
        }

        // Save to vault location
        await saveVaultFile(repoRoot, vaultFile);

        return {
            success: true,
            message: `Vault imported from: ${input.file}${password ? " and unlocked." : ". Use 'init' with password to unlock."}`,
        };
    } catch (err) {
        return { success: false, message: `Import failed: ${err}` };
    }
}

/**
 * Rotate vault password (re-encrypt with new password)
 */
export async function rotatePassword(input: {
    repoPath?: string;
    oldPassword: string;
    newPassword: string;
}): Promise<{ success: boolean; message: string }> {
    const repoRoot = await getRepoRoot(input.repoPath);

    const vaultFile = await loadVaultFile(repoRoot);
    if (!vaultFile) {
        return { success: false, message: "No vault found. Create one with 'init' first." };
    }

    // Verify old password
    const oldSalt = Buffer.from(vaultFile.salt, "hex");
    const oldKey = deriveKey(input.oldPassword, oldSalt);

    let plaintext: string;
    try {
        plaintext = decrypt(vaultFile.data, oldKey, vaultFile.iv, vaultFile.authTag);
    } catch {
        return { success: false, message: "Old password is incorrect." };
    }

    // Re-encrypt with new password and fresh salt
    const newSalt = randomBytes(SALT_LENGTH);
    const newKey = deriveKey(input.newPassword, newSalt);
    const { iv, authTag, encrypted } = encrypt(plaintext, newKey);

    const updatedVault: VaultFile = {
        version: VAULT_VERSION,
        salt: newSalt.toString("hex"),
        iv,
        authTag,
        data: encrypted,
    };

    await saveVaultFile(repoRoot, updatedVault);

    // Update session with new key
    sessionKey = newKey;
    sessionData = JSON.parse(plaintext);

    const keyCount = Object.keys(sessionData!).length;
    logAudit("rotate", true, undefined, `Re-encrypted with new salt, ${keyCount} key(s)`);
    return {
        success: true,
        message: `Password rotated successfully. Vault re-encrypted with new salt. ${keyCount} key(s) preserved.`,
    };
}

/**
 * Destroy vault permanently
 */
export async function destroyVault(input: {
    repoPath?: string;
}): Promise<{ success: boolean; message: string }> {
    const repoRoot = await getRepoRoot(input.repoPath);
    const vaultPath = path.join(repoRoot, VAULT_DIR, VAULT_FILE);

    try {
        await fs.unlink(vaultPath);
    } catch {
        // Already gone
    }

    sessionKey = null;
    sessionData = null;
    if (autoLockTimer) { clearTimeout(autoLockTimer); autoLockTimer = null; }
    logAudit("destroy", true);

    return { success: true, message: "Vault destroyed. All secrets permanently deleted." };
}

// ============ UTILITY: Get secret for other modules ============

/**
 * Get a secret value silently (for other modules to use)
 * Returns undefined if vault is locked or key not found
 */
export function getVaultSecret(key: string): string | undefined {
    if (!sessionData) return undefined;
    return sessionData[key];
}

/**
 * Check if vault session is active
 */
export function isVaultUnlocked(): boolean {
    return sessionKey !== null && sessionData !== null;
}

// ============ TOOL HANDLER ============

export async function handleVaultTool(input: {
    action: VaultAction;
    repoPath?: string;
    password?: string;
    key?: string;
    value?: string;
    file?: string;
    outputPath?: string;
}): Promise<unknown> {
    switch (input.action) {
        case "init":
            return initVault({ repoPath: input.repoPath, password: input.password });

        case "set":
            if (!input.key || !input.value) {
                throw new Error("'key' and 'value' are required for 'set' action.");
            }
            return setSecret({ repoPath: input.repoPath, key: input.key, value: input.value });

        case "get":
            if (!input.key) {
                throw new Error("'key' is required for 'get' action.");
            }
            return getSecret({ key: input.key });

        case "list":
            return listKeys();

        case "delete":
            if (!input.key) {
                throw new Error("'key' is required for 'delete' action.");
            }
            return deleteSecret({ repoPath: input.repoPath, key: input.key });

        case "has":
            if (!input.key) {
                throw new Error("'key' is required for 'has' action.");
            }
            return hasKey({ key: input.key });

        case "status":
            return getStatus({ repoPath: input.repoPath });

        case "lock":
            return lockVault();

        case "rotate":
            if (!input.password) {
                throw new Error("'password' (old) is required for 'rotate' action. Also provide 'value' as the new password.");
            }
            if (!input.value) {
                throw new Error("'value' (new password) is required for 'rotate' action.");
            }
            return rotatePassword({ repoPath: input.repoPath, oldPassword: input.password, newPassword: input.value });

        case "export":
            return exportVault({ repoPath: input.repoPath, outputPath: input.outputPath });

        case "import":
            if (!input.file) {
                throw new Error("'file' is required for 'import' action.");
            }
            return importVault({ repoPath: input.repoPath, file: input.file, password: input.password });

        case "destroy":
            return destroyVault({ repoPath: input.repoPath });

        case "audit":
            return { success: true, entries: auditLog, count: auditLog.length };

        default:
            throw new Error(`Unknown vault action: ${input.action}`);
    }
}
