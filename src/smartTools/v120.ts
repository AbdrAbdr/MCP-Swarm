/**
 * MCP Swarm v1.2.0 - Smart Tools: v1.2.0 additions
 * 
 * New tools:
 *   swarm_analytics  — Task/event analytics & agent metrics
 *   swarm_memory     — Auto-index, smart context, self-correction, conflict memory
 *   swarm_embeddings — Embedding cascade, health check, cost tracking
 *   swarm_profiles   — Agent profiles & specialization
 *   swarm_scheduler  — Scheduled tasks (cron-like)
 *   swarm_plugins    — Plugin system (custom extensions)
 *   swarm_github     — GitHub Issue ↔ Task sync
 *   swarm_setup      — Setup wizard & config
 */

import { z } from "zod";

import { handleAnalyticsTool } from "../workflows/analyticsStore.js";
import {
    indexTask, indexFileChange, indexReview,
    getSmartContext, findErrorSolution, recordErrorFix,
    recordConflictResolution, findConflictResolution,
} from "../workflows/autoIndex.js";
import { cascadeEmbed, checkEmbeddingHealth, getEmbeddingCosts, resetEmbeddingCosts } from "../workflows/embeddings.js";
import { getActiveBackend, migrateBackend, checkAllBackends, switchVectorBackend } from "../workflows/vectorBackend.js";
import { getProfile, listProfiles, getDefaultProfile, getProfileInstructions } from "../workflows/agentProfiles.js";
import { addScheduledTask, listScheduledTasks, checkDueTasks, checkMissedTasks, removeScheduledTask, pauseScheduledTask, resumeScheduledTask } from "../workflows/scheduledTasks.js";
import { discoverPlugins, loadPlugin, loadAllPlugins, ensurePluginDir } from "../workflows/pluginLoader.js";
import { getAuthStatus, listIssues, createIssueFromTask, closeIssue, syncFromGitHub } from "../workflows/githubApi.js";
import { runSetupWizard, getWizardPrompt, loadSwarmConfig, configExists } from "../workflows/setupWizard.js";

// Helper
function wrapResult(result: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}

// ================================================================
// 1. swarm_analytics — Task/event analytics & agent metrics
// ================================================================
const analyticsInputSchema = z.object({
    action: z.enum([
        "log_task", "log_event",
        "get_tasks", "get_events",
        "get_metrics", "get_agent_stats",
        "summary", "cleanup",
    ]).describe("Action to perform"),
    repoPath: z.string().optional(),
    taskId: z.string().optional().describe("Task ID"),
    title: z.string().optional().describe("Task title"),
    status: z.string().optional().describe("Task status"),
    assignee: z.string().optional().describe("Assignee agent"),
    durationMs: z.number().optional().describe("Duration in ms"),
    files: z.array(z.string()).optional().describe("Affected files"),
    tags: z.array(z.string()).optional().describe("Tags"),
    eventType: z.string().optional().describe("Event type"),
    agent: z.string().optional().describe("Agent name"),
    message: z.string().optional().describe("Event message"),
    data: z.record(z.unknown()).optional().describe("Extra data"),
    limit: z.number().optional().describe("Max results"),
    olderThanDays: z.number().optional().describe("Cleanup threshold (days)"),
}).strict();

export const swarmAnalyticsTool = [
    "swarm_analytics",
    {
        title: "Swarm Analytics",
        description: "Task history, event tracking & agent metrics. Actions: log_task, log_event, get_tasks, get_events, get_metrics, get_agent_stats, summary, cleanup",
        inputSchema: analyticsInputSchema,
        outputSchema: z.any(),
    },
    async (input: z.infer<typeof analyticsInputSchema>) => {
        return wrapResult(await handleAnalyticsTool(input));
    },
] as const;

// ================================================================
// 2. swarm_memory — Auto-index, smart context, self-correction
// ================================================================
const memoryInputSchema = z.object({
    action: z.enum([
        "index_task", "index_file", "index_review",
        "smart_context", "find_error_solution", "find_conflict_resolution",
        "record_error_fix", "record_conflict_resolution",
    ]).describe("Action to perform"),
    repoPath: z.string().optional(),
    taskId: z.string().optional().describe("Task ID"),
    title: z.string().optional().describe("Task title"),
    description: z.string().optional().describe("Description"),
    solution: z.string().optional().describe("Solution applied"),
    files: z.array(z.string()).optional().describe("Files involved"),
    assignee: z.string().optional().describe("Agent name"),
    filePath: z.string().optional().describe("File path"),
    changeType: z.enum(["created", "modified", "deleted"]).optional().describe("Change type"),
    summary: z.string().optional().describe("Change summary"),
    agent: z.string().optional().describe("Agent who made the change"),
    reviewId: z.string().optional().describe("Review ID"),
    findings: z.string().optional().describe("Review findings"),
    reviewer: z.string().optional().describe("Reviewer agent"),
    errorMessage: z.string().optional().describe("Error message"),
    errorCode: z.string().optional().describe("Error code"),
    conflictDescription: z.string().optional().describe("Conflict description"),
    resolution: z.string().optional().describe("Resolution applied"),
    chosenSide: z.enum(["ours", "theirs", "manual"]).optional().describe("Chosen side"),
    taskTitle: z.string().optional().describe("Task title for context search"),
    taskDescription: z.string().optional().describe("Task description for context search"),
    maxResults: z.number().optional().describe("Max results"),
}).strict();

export const swarmMemoryTool = [
    "swarm_memory",
    {
        title: "Swarm Memory",
        description: `Auto-index tasks/files/reviews into vector memory, smart context injection, self-correction & conflict resolution memory.

Index Actions: index_task, index_file, index_review
Query Actions: smart_context, find_error_solution, find_conflict_resolution
Record Actions: record_error_fix, record_conflict_resolution`,
        inputSchema: memoryInputSchema,
        outputSchema: z.any(),
    },
    async (input: z.infer<typeof memoryInputSchema>) => {
        switch (input.action) {
            case "index_task":
                return wrapResult(await indexTask(input as Parameters<typeof indexTask>[0]));
            case "index_file":
                return wrapResult(await indexFileChange(input as Parameters<typeof indexFileChange>[0]));
            case "index_review":
                return wrapResult(await indexReview(input as Parameters<typeof indexReview>[0]));
            case "smart_context":
                return wrapResult(await getSmartContext({
                    repoPath: input.repoPath,
                    taskTitle: input.taskTitle || input.title || "",
                    taskDescription: input.taskDescription || input.description,
                    maxResults: input.maxResults,
                }));
            case "find_error_solution":
                return wrapResult(await findErrorSolution(input as Parameters<typeof findErrorSolution>[0]));
            case "find_conflict_resolution":
                return wrapResult(await findConflictResolution(input as Parameters<typeof findConflictResolution>[0]));
            case "record_error_fix":
                return wrapResult(await recordErrorFix(input as Parameters<typeof recordErrorFix>[0]));
            case "record_conflict_resolution":
                return wrapResult(await recordConflictResolution(input as Parameters<typeof recordConflictResolution>[0]));
            default:
                throw new Error(`Unknown action: ${input.action}`);
        }
    },
] as const;

// ================================================================
// 3. swarm_embeddings — Embedding cascade & backends health
// ================================================================
const embeddingsInputSchema = z.object({
    action: z.enum([
        "embed", "health", "costs", "reset_costs",
        "backend_health", "backend_migrate", "backend_switch", "backend_health_all",
    ]).describe("Action to perform"),
    repoPath: z.string().optional(),
    text: z.string().optional().describe("Text to embed"),
    from: z.enum(["local", "chroma", "supabase", "qdrant", "pinecone", "turso"]).optional(),
    to: z.enum(["local", "chroma", "supabase", "qdrant", "pinecone", "turso"]).optional(),
}).strict();

export const swarmEmbeddingsTool = [
    "swarm_embeddings",
    {
        title: "Swarm Embeddings",
        description: `Embedding cascade (Ollama→OpenAI→simpleEmbed v2), vector backend management.

Embedding Actions: embed, health, costs, reset_costs
Backend Actions: backend_health, backend_migrate, backend_switch, backend_health_all`,
        inputSchema: embeddingsInputSchema,
        outputSchema: z.any(),
    },
    async (input: z.infer<typeof embeddingsInputSchema>) => {
        switch (input.action) {
            case "embed": {
                if (!input.text) throw new Error("text is required for embed action");
                const result = await cascadeEmbed(input.text, input.repoPath);
                return wrapResult({
                    provider: result.provider,
                    dimensions: result.dimensions,
                    cached: result.cached,
                    costUsd: result.costUsd,
                    vectorPreview: result.vector.slice(0, 5),
                });
            }
            case "health":
                return wrapResult(await checkEmbeddingHealth(input.repoPath));
            case "costs":
                return wrapResult(getEmbeddingCosts());
            case "reset_costs": {
                resetEmbeddingCosts();
                return wrapResult({ success: true, message: "Embedding costs reset" });
            }
            case "backend_health": {
                const backend = await getActiveBackend(input.repoPath);
                const health = await backend.healthCheck();
                return wrapResult({ backend: backend.name, ...health });
            }
            case "backend_migrate": {
                if (!input.from || !input.to) throw new Error("from and to are required for migrate");
                return wrapResult(await migrateBackend({ from: input.from, to: input.to, repoPath: input.repoPath }));
            }
            case "backend_health_all":
                return wrapResult(await checkAllBackends());
            case "backend_switch": {
                if (!input.to) throw new Error("'to' backend is required for switch");
                return wrapResult(await switchVectorBackend({ to: input.to, repoPath: input.repoPath }));
            }
            default:
                throw new Error(`Unknown action: ${input.action}`);
        }
    },
] as const;

// ================================================================
// 4. swarm_profiles — Agent profiles & specialization
// ================================================================
const profilesInputSchema = z.object({
    action: z.enum(["get", "list", "default", "instructions"]).describe("Action to perform"),
    repoPath: z.string().optional(),
    profileType: z.enum(["frontend", "backend", "security", "devops", "fullstack", "custom"]).optional(),
}).strict();

export const swarmProfilesTool = [
    "swarm_profiles",
    {
        title: "Swarm Profiles",
        description: "Agent profiles & specialization. Actions: get, list, default, instructions",
        inputSchema: profilesInputSchema,
        outputSchema: z.any(),
    },
    async (input: z.infer<typeof profilesInputSchema>) => {
        switch (input.action) {
            case "get":
                return wrapResult(getProfile(input.profileType || "fullstack"));
            case "list":
                return wrapResult(listProfiles());
            case "default":
                return wrapResult(await getDefaultProfile(input.repoPath));
            case "instructions":
                return wrapResult({ instructions: await getProfileInstructions(input.repoPath, input.profileType) });
            default:
                throw new Error(`Unknown action: ${input.action}`);
        }
    },
] as const;

// ================================================================
// 5. swarm_scheduler — Scheduled tasks
// ================================================================
const schedulerInputSchema = z.object({
    action: z.enum(["add", "list", "check_due", "check_missed", "remove", "pause", "resume"]).describe("Action to perform"),
    repoPath: z.string().optional(),
    cron: z.string().optional().describe("Cron expression (min hour dom mon dow)"),
    title: z.string().optional().describe("Task title"),
    taskAction: z.string().optional().describe("Action to execute"),
    index: z.number().optional().describe("Task index (for remove)"),
}).strict();

export const swarmSchedulerTool = [
    "swarm_scheduler",
    {
        title: "Swarm Scheduler",
        description: "Cron-like scheduled tasks. Actions: add, list, check_due, check_missed, remove, pause, resume",
        inputSchema: schedulerInputSchema,
        outputSchema: z.any(),
    },
    async (input: z.infer<typeof schedulerInputSchema>) => {
        switch (input.action) {
            case "add":
                return wrapResult(await addScheduledTask({
                    repoPath: input.repoPath,
                    cron: input.cron || "0 9 * * 1",
                    title: input.title || "Scheduled task",
                    action: input.taskAction || "quality_run",
                }));
            case "list":
                return wrapResult(await listScheduledTasks(input.repoPath));
            case "check_due":
                return wrapResult(await checkDueTasks(input.repoPath));
            case "check_missed":
                return wrapResult(await checkMissedTasks(input.repoPath));
            case "remove":
                return wrapResult(await removeScheduledTask({ repoPath: input.repoPath, index: input.index || 0 }));
            case "pause":
                return wrapResult(await pauseScheduledTask({ repoPath: input.repoPath, index: input.index || 0 }));
            case "resume":
                return wrapResult(await resumeScheduledTask({ repoPath: input.repoPath, index: input.index || 0 }));
            default:
                throw new Error(`Unknown action: ${input.action}`);
        }
    },
] as const;

// ================================================================
// 6. swarm_plugins — Plugin system
// ================================================================
const pluginsInputSchema = z.object({
    action: z.enum(["discover", "load", "load_all", "init_dir"]).describe("Action to perform"),
    repoPath: z.string().optional(),
    pluginName: z.string().optional().describe("Plugin name to load"),
}).strict();

export const swarmPluginsTool = [
    "swarm_plugins",
    {
        title: "Swarm Plugins",
        description: "Plugin system for custom extensions. Actions: discover, load, load_all, init_dir",
        inputSchema: pluginsInputSchema,
        outputSchema: z.any(),
    },
    async (input: z.infer<typeof pluginsInputSchema>) => {
        switch (input.action) {
            case "discover":
                return wrapResult(await discoverPlugins());
            case "load":
                if (!input.pluginName) throw new Error("pluginName is required");
                return wrapResult(await loadPlugin(input.pluginName));
            case "load_all":
                return wrapResult(await loadAllPlugins(input.repoPath));
            case "init_dir": {
                const dir = await ensurePluginDir();
                return wrapResult({ success: true, pluginDir: dir });
            }
            default:
                throw new Error(`Unknown action: ${input.action}`);
        }
    },
] as const;

// ================================================================
// 7. swarm_github — GitHub Issue ↔ Task sync
// ================================================================
const githubInputSchema = z.object({
    action: z.enum([
        "auth_status", "list_issues",
        "create_issue", "close_issue",
        "sync_from_github",
    ]).describe("Action to perform"),
    repoPath: z.string().optional(),
    state: z.enum(["open", "closed", "all"]).optional().describe("Issue state filter"),
    labels: z.string().optional().describe("Label filter (comma-separated)"),
    limit: z.number().optional().describe("Max results"),
    title: z.string().optional().describe("Issue title"),
    body: z.string().optional().describe("Issue body"),
    issueLabels: z.array(z.string()).optional().describe("Labels for new issue"),
    assignees: z.array(z.string()).optional().describe("Assignees for new issue"),
    issueNumber: z.number().optional().describe("Issue number to close"),
    comment: z.string().optional().describe("Comment when closing"),
    label: z.string().optional().describe("Label to sync (default: swarm)"),
}).strict();

export const swarmGitHubTool = [
    "swarm_github",
    {
        title: "Swarm GitHub",
        description: `GitHub Issue ↔ Task synchronization with auto-detected authentication.

Actions: auth_status, list_issues, create_issue, close_issue, sync_from_github`,
        inputSchema: githubInputSchema,
        outputSchema: z.any(),
    },
    async (input: z.infer<typeof githubInputSchema>) => {
        switch (input.action) {
            case "auth_status":
                return wrapResult(await getAuthStatus());
            case "list_issues":
                return wrapResult(await listIssues(input));
            case "create_issue":
                return wrapResult(await createIssueFromTask({
                    repoPath: input.repoPath,
                    title: input.title || "Untitled",
                    body: input.body,
                    labels: input.issueLabels,
                    assignees: input.assignees,
                }));
            case "close_issue":
                if (!input.issueNumber) throw new Error("issueNumber is required");
                return wrapResult(await closeIssue(input as Parameters<typeof closeIssue>[0]));
            case "sync_from_github":
                return wrapResult(await syncFromGitHub(input));
            default:
                throw new Error(`Unknown action: ${input.action}`);
        }
    },
] as const;

// ================================================================
// 8. swarm_setup — Setup wizard & config management
// ================================================================
const setupInputSchema = z.object({
    action: z.enum(["wizard_prompt", "wizard_run", "config_get", "config_exists"]).describe("Action to perform"),
    repoPath: z.string().optional(),
    mode: z.enum(["standard", "configured"]).optional(),
    vaultEnabled: z.boolean().optional(),
    vaultAutoBackup: z.boolean().optional(),
    vaultBackupTarget: z.enum(["telegram", "gist", "gdrive", "s3", "local"]).optional(),
    vectorBackend: z.enum(["local", "chroma", "supabase", "qdrant", "pinecone", "turso"]).optional(),
    embeddingProvider: z.enum(["ollama", "openai", "builtin"]).optional(),
    ollamaModel: z.string().optional(),
    ollamaUrl: z.string().optional(),
    ttlDays: z.number().optional(),
    semanticCaching: z.boolean().optional(),
    globalMemory: z.boolean().optional(),
    githubEnabled: z.boolean().optional(),
    githubAutoSync: z.boolean().optional(),
    profileEnabled: z.boolean().optional(),
    defaultProfile: z.enum(["frontend", "backend", "security", "devops", "fullstack", "custom"]).optional(),
    customProfileDescription: z.string().optional(),
    scheduledTasksEnabled: z.boolean().optional(),
    pluginsEnabled: z.boolean().optional(),
}).strict();

export const swarmSetupTool = [
    "swarm_setup",
    {
        title: "Swarm Setup",
        description: `Setup wizard, configuration management.

Actions: wizard_prompt, wizard_run, config_get, config_exists`,
        inputSchema: setupInputSchema,
        outputSchema: z.any(),
    },
    async (input: z.infer<typeof setupInputSchema>) => {
        switch (input.action) {
            case "wizard_prompt":
                return wrapResult(getWizardPrompt());
            case "wizard_run":
                return wrapResult(await runSetupWizard(input));
            case "config_get":
                return wrapResult(await loadSwarmConfig(input.repoPath));
            case "config_exists":
                return wrapResult({ exists: await configExists(input.repoPath) });
            default:
                throw new Error(`Unknown action: ${input.action}`);
        }
    },
] as const;
