/**
 * MCP Swarm — File Logger
 * 
 * Writes logs to ~/.mcp-swarm/logs/ with daily rotation.
 * Keeps last 7 days of logs automatically.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const LOG_DIR = path.join(os.homedir(), ".mcp-swarm", "logs");
const MAX_LOG_DAYS = 7;

let logStream: fs.WriteStream | null = null;
let currentLogDate: string = "";

function getDateStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTimestamp(): string {
    return new Date().toISOString();
}

function ensureLogDir(): void {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

function getLogStream(): fs.WriteStream {
    const today = getDateStr();

    if (logStream && currentLogDate === today) {
        return logStream;
    }

    // Close previous stream
    if (logStream) {
        try { logStream.end(); } catch { /* ignore */ }
    }

    ensureLogDir();
    const logFile = path.join(LOG_DIR, `companion-${today}.log`);
    logStream = fs.createWriteStream(logFile, { flags: "a" });
    currentLogDate = today;

    // Cleanup old logs
    cleanupOldLogs();

    return logStream;
}

function cleanupOldLogs(): void {
    try {
        const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith("companion-") && f.endsWith(".log"));
        if (files.length <= MAX_LOG_DAYS) return;

        files.sort();
        const toRemove = files.slice(0, files.length - MAX_LOG_DAYS);
        for (const f of toRemove) {
            try { fs.unlinkSync(path.join(LOG_DIR, f)); } catch { /* ignore */ }
        }
    } catch { /* ignore */ }
}

export type LogLevel = "info" | "warn" | "error" | "success" | "debug";

/**
 * Write a log entry to both console callback and file
 */
export function fileLog(level: LogLevel, message: string): void {
    try {
        const stream = getLogStream();
        const line = `[${getTimestamp()}] [${level.toUpperCase().padEnd(7)}] ${message}\n`;
        stream.write(line);
    } catch {
        // Non-critical — don't crash companion if logging fails
    }
}

/**
 * Close the log stream gracefully
 */
export function closeFileLog(): void {
    if (logStream) {
        try { logStream.end(); } catch { /* ignore */ }
        logStream = null;
    }
}

/**
 * Get the path to today's log file
 */
export function getLogFilePath(): string {
    return path.join(LOG_DIR, `companion-${getDateStr()}.log`);
}

/**
 * Get the log directory path
 */
export function getLogDir(): string {
    return LOG_DIR;
}
