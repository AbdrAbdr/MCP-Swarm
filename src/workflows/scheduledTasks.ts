/**
 * Scheduled Tasks — Cron-like task automation
 * 
 * MCP Swarm v1.2.0
 * 
 * Lightweight cron scheduler for recurring agent tasks.
 * Stores schedule in .swarm/config.json.
 * Checks on agent heartbeat whether any tasks are due.
 */

import { loadSwarmConfig, saveSwarmConfig } from "./setupWizard.js";
import { quickLogEvent } from "./analyticsStore.js";

// ============ TYPES ============

export interface ScheduledTask {
    id: string;
    cron: string;
    title: string;
    action: string;
    enabled: boolean;
    lastRun?: string;
    nextRun?: string;
}

// ============ CRON PARSER ============

/**
 * Parse a cron field into a set of matching values.
 * 
 * Supported syntax:
 * - *         every value
 * - star/N    every N (step)
 * - N         exact value
 * - N,M       list of values
 * - N-M       range (inclusive)
 * - N-M/S     range with step
 * - N,M-O     mixed list and ranges
 */
function parseCronField(field: string, min: number, max: number): Set<number> {
    const result = new Set<number>();

    if (field === "*") {
        for (let i = min; i <= max; i++) result.add(i);
        return result;
    }

    if (field.startsWith("*/")) {
        const step = parseInt(field.slice(2));
        if (step > 0) {
            for (let i = min; i <= max; i += step) result.add(i);
        }
        return result;
    }

    // Split by comma for lists: "1,3,5-7,10-20/3"
    const parts = field.split(",");
    for (const part of parts) {
        const trimmed = part.trim();

        // Range with step: "1-30/5"
        const rangeStepMatch = trimmed.match(/^(\d+)-(\d+)\/(\d+)$/);
        if (rangeStepMatch) {
            const start = parseInt(rangeStepMatch[1]);
            const end = parseInt(rangeStepMatch[2]);
            const step = parseInt(rangeStepMatch[3]);
            if (step > 0) {
                for (let i = start; i <= end; i += step) result.add(i);
            }
            continue;
        }

        // Range: "1-5"
        const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1]);
            const end = parseInt(rangeMatch[2]);
            for (let i = start; i <= end; i++) result.add(i);
            continue;
        }

        // Single value: "5"
        const val = parseInt(trimmed);
        if (!isNaN(val)) result.add(val);
    }

    return result;
}

/**
 * Parse a cron expression: minute hour dayOfMonth month dayOfWeek
 * Returns true if the cron matches the given time.
 * 
 * Supported: *, star/N, N, N-M, N-M/S, N,M-O (see parseCronField)
 */
function cronMatches(cron: string, date: Date = new Date()): boolean {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    const checks: Array<{ value: number; field: string; min: number; max: number }> = [
        { value: date.getMinutes(), field: parts[0], min: 0, max: 59 },
        { value: date.getHours(), field: parts[1], min: 0, max: 23 },
        { value: date.getDate(), field: parts[2], min: 1, max: 31 },
        { value: date.getMonth() + 1, field: parts[3], min: 1, max: 12 },
        { value: date.getDay(), field: parts[4], min: 0, max: 6 },
    ];

    for (const { value, field, min, max } of checks) {
        const allowed = parseCronField(field, min, max);
        if (!allowed.has(value)) return false;
    }

    return true;
}

/**
 * Estimate next run time (approximate)
 */
function estimateNextRun(cron: string): string {
    const now = new Date();
    for (let i = 1; i <= 60 * 24 * 7; i++) { // Check up to 7 days ahead
        const future = new Date(now.getTime() + i * 60000);
        if (cronMatches(cron, future)) {
            return future.toISOString();
        }
    }
    return "unknown";
}

// ============ PUBLIC API ============

/**
 * Add a scheduled task
 */
export async function addScheduledTask(input: {
    repoPath?: string;
    cron: string;
    title: string;
    action: string;
}): Promise<{ success: boolean; task: ScheduledTask }> {
    const config = await loadSwarmConfig(input.repoPath);
    if (!config) throw new Error("Swarm not configured. Run setup wizard first.");

    const task: ScheduledTask = {
        id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        cron: input.cron,
        title: input.title,
        action: input.action,
        enabled: true,
        nextRun: estimateNextRun(input.cron),
    };

    config.scheduledTasks.enabled = true;
    config.scheduledTasks.tasks.push({
        cron: task.cron,
        title: task.title,
        action: task.action,
        lastRun: undefined,
    });

    await saveSwarmConfig(config, input.repoPath);

    return { success: true, task };
}

/**
 * List all scheduled tasks
 */
export async function listScheduledTasks(repoPath?: string): Promise<{
    tasks: ScheduledTask[];
    enabled: boolean;
}> {
    const config = await loadSwarmConfig(repoPath);
    if (!config) return { tasks: [], enabled: false };

    const tasks: ScheduledTask[] = config.scheduledTasks.tasks.map((t, i) => ({
        id: `sched_${i}`,
        cron: t.cron,
        title: t.title,
        action: t.action,
        enabled: t.enabled !== false,
        lastRun: t.lastRun,
        nextRun: estimateNextRun(t.cron),
    }));

    return { tasks, enabled: config.scheduledTasks.enabled };
}

/**
 * Check which tasks are due NOW
 */
export async function checkDueTasks(repoPath?: string): Promise<{
    dueTasks: ScheduledTask[];
    checked: boolean;
}> {
    const config = await loadSwarmConfig(repoPath);
    if (!config || !config.scheduledTasks.enabled) {
        return { dueTasks: [], checked: false };
    }

    const now = new Date();
    const dueTasks: ScheduledTask[] = [];
    let configUpdated = false;

    for (let i = 0; i < config.scheduledTasks.tasks.length; i++) {
        const task = config.scheduledTasks.tasks[i];
        if (task.enabled === false) continue; // Skip paused tasks
        if (cronMatches(task.cron, now)) {
            dueTasks.push({
                id: `sched_${i}`,
                cron: task.cron,
                title: task.title,
                action: task.action,
                enabled: true,
                lastRun: now.toISOString(),
            });

            // Persist lastRun in config
            config.scheduledTasks.tasks[i].lastRun = now.toISOString();
            configUpdated = true;

            await quickLogEvent(
                repoPath || process.cwd(),
                "scheduled_task",
                `Due: ${task.title} (${task.action})`,
            );
        }
    }

    if (configUpdated) {
        await saveSwarmConfig(config, repoPath);
    }

    return { dueTasks, checked: true };
}

/**
 * Check for missed tasks (tasks that were due while Companion was offline)
 * Call this on startup to catch up on missed executions.
 */
export async function checkMissedTasks(repoPath?: string): Promise<{
    missedTasks: ScheduledTask[];
    checked: boolean;
}> {
    const config = await loadSwarmConfig(repoPath);
    if (!config || !config.scheduledTasks.enabled) {
        return { missedTasks: [], checked: false };
    }

    const now = new Date();
    const missedTasks: ScheduledTask[] = [];

    for (let i = 0; i < config.scheduledTasks.tasks.length; i++) {
        const task = config.scheduledTasks.tasks[i];
        if (!task.lastRun) continue;

        const lastRunDate = new Date(task.lastRun);
        const minutesSinceLast = (now.getTime() - lastRunDate.getTime()) / 60000;

        // If more than 2 minutes have passed since lastRun and cron matches
        // any minute in the gap, it was likely missed
        if (minutesSinceLast > 2) {
            // Check if cron would have matched at any point since lastRun
            // Check every minute to ensure we catch all cron schedules
            // (even specific minutes like 5, 10, etc.)
            for (let m = 1; m < minutesSinceLast; m++) {
                const checkTime = new Date(lastRunDate.getTime() + m * 60000);
                if (cronMatches(task.cron, checkTime)) {
                    missedTasks.push({
                        id: `sched_${i}`,
                        cron: task.cron,
                        title: task.title,
                        action: task.action,
                        enabled: task.enabled !== false,
                        lastRun: task.lastRun,
                        nextRun: estimateNextRun(task.cron),
                    });

                    await quickLogEvent(
                        repoPath || process.cwd(),
                        "missed_scheduled_task",
                        `Missed: ${task.title} (${task.action}) — last run: ${task.lastRun}`,
                    );
                    break; // One miss per task is enough
                }
            }
        }
    }

    return { missedTasks, checked: true };
}

/**
 * Remove a scheduled task by index
 */
export async function removeScheduledTask(input: {
    repoPath?: string;
    index: number;
}): Promise<{ success: boolean; message: string }> {
    const config = await loadSwarmConfig(input.repoPath);
    if (!config) throw new Error("Swarm not configured.");

    if (input.index < 0 || input.index >= config.scheduledTasks.tasks.length) {
        return { success: false, message: "Invalid task index" };
    }

    const removed = config.scheduledTasks.tasks.splice(input.index, 1);
    await saveSwarmConfig(config, input.repoPath);

    return { success: true, message: `Removed: ${removed[0]?.title}` };
}

/**
 * Pause a scheduled task by index
 */
export async function pauseScheduledTask(input: {
    repoPath?: string;
    index: number;
}): Promise<{ success: boolean; message: string }> {
    const config = await loadSwarmConfig(input.repoPath);
    if (!config) throw new Error("Swarm not configured.");

    if (input.index < 0 || input.index >= config.scheduledTasks.tasks.length) {
        return { success: false, message: "Invalid task index" };
    }

    const task = config.scheduledTasks.tasks[input.index];
    if (task.enabled === false) {
        return { success: false, message: `Task '${task.title}' is already paused.` };
    }

    task.enabled = false;
    await saveSwarmConfig(config, input.repoPath);

    return { success: true, message: `Paused: ${task.title}` };
}

/**
 * Resume a scheduled task by index
 */
export async function resumeScheduledTask(input: {
    repoPath?: string;
    index: number;
}): Promise<{ success: boolean; message: string }> {
    const config = await loadSwarmConfig(input.repoPath);
    if (!config) throw new Error("Swarm not configured.");

    if (input.index < 0 || input.index >= config.scheduledTasks.tasks.length) {
        return { success: false, message: "Invalid task index" };
    }

    const task = config.scheduledTasks.tasks[input.index];
    if (task.enabled !== false) {
        return { success: false, message: `Task '${task.title}' is already active.` };
    }

    task.enabled = true;
    await saveSwarmConfig(config, input.repoPath);

    return { success: true, message: `Resumed: ${task.title}` };
}
