/**
 * Auto-Index — Automatic vector indexing + Smart Context + Self-Correction
 * 
 * MCP Swarm v1.2.0
 * 
 * Automatically indexes:
 * - Completed tasks → vector memory
 * - Modified files → vector memory
 * - Code reviews → vector memory
 * - Knowledge archives → vector memory
 * 
 * Smart Context Injection: searches memory before task assignment.
 * Self-Correction: searches for similar errors and their solutions.
 * Conflict Memory: remembers merge conflict resolution patterns.
 */

import { cascadeEmbed } from "./embeddings.js";
import { getActiveBackend, VectorDocument } from "./vectorBackend.js";
import { loadSwarmConfig } from "./setupWizard.js";
import { quickLogEvent } from "./analyticsStore.js";

// ============ AUTO-INDEX ============

/**
 * Index a completed task into vector memory.
 * Skips if a document with the same task ID already exists (deduplication).
 */
export async function indexTask(input: {
    repoPath?: string;
    taskId: string;
    title: string;
    description?: string;
    files?: string[];
    solution?: string;
    assignee?: string;
}): Promise<{ indexed: boolean; docId: string; skipped?: boolean }> {
    const backend = await getActiveBackend(input.repoPath);
    const docId = `task_${input.taskId}`;

    // Deduplication: check if this task is already indexed
    try {
        // Check by listing and filtering by ID — reliable deduplication
        const docs = await backend.list(10000);
        const alreadyExists = docs.some(d => d.id === docId);
        if (alreadyExists) {
            return { indexed: false, docId, skipped: true };
        }
    } catch {
        // If search/list fails, proceed with indexing (safe fallback)
    }

    const text = [
        `Task: ${input.title}`,
        input.description ? `Description: ${input.description}` : "",
        input.solution ? `Solution: ${input.solution}` : "",
        input.files?.length ? `Files: ${input.files.join(", ")}` : "",
        input.assignee ? `Agent: ${input.assignee}` : "",
    ].filter(Boolean).join("\n");

    const result = await cascadeEmbed(text, input.repoPath);

    await backend.add({
        id: docId,
        vector: result.vector,
        text,
        metadata: {
            type: "task",
            taskId: input.taskId,
            title: input.title,
            files: input.files,
            assignee: input.assignee,
        },
        createdAt: new Date().toISOString(),
    });

    await quickLogEvent(input.repoPath || process.cwd(), "auto_index", `Indexed task: ${input.title}`);
    return { indexed: true, docId };
}

/**
 * Index a file change
 */
export async function indexFileChange(input: {
    repoPath?: string;
    filePath: string;
    changeType: "created" | "modified" | "deleted";
    summary?: string;
    agent?: string;
}): Promise<{ indexed: boolean; docId: string }> {
    const text = [
        `File ${input.changeType}: ${input.filePath}`,
        input.summary ? `Summary: ${input.summary}` : "",
        input.agent ? `By: ${input.agent}` : "",
    ].filter(Boolean).join("\n");

    const result = await cascadeEmbed(text, input.repoPath);
    const backend = await getActiveBackend(input.repoPath);

    const docId = `file_${Date.now()}_${input.filePath.replace(/[^a-zA-Z0-9]/g, "_")}`;
    await backend.add({
        id: docId,
        vector: result.vector,
        text,
        metadata: { type: "file_change", filePath: input.filePath, changeType: input.changeType, agent: input.agent },
        createdAt: new Date().toISOString(),
    });

    return { indexed: true, docId };
}

/**
 * Index a code review
 */
export async function indexReview(input: {
    repoPath?: string;
    reviewId: string;
    title: string;
    findings: string;
    files?: string[];
    reviewer?: string;
}): Promise<{ indexed: boolean; docId: string }> {
    const text = [
        `Code Review: ${input.title}`,
        `Findings: ${input.findings}`,
        input.files?.length ? `Files: ${input.files.join(", ")}` : "",
        input.reviewer ? `Reviewer: ${input.reviewer}` : "",
    ].filter(Boolean).join("\n");

    const result = await cascadeEmbed(text, input.repoPath);
    const backend = await getActiveBackend(input.repoPath);

    const docId = `review_${input.reviewId}`;
    await backend.add({
        id: docId,
        vector: result.vector,
        text,
        metadata: { type: "review", reviewId: input.reviewId, files: input.files, reviewer: input.reviewer },
        createdAt: new Date().toISOString(),
    });

    return { indexed: true, docId };
}

// ============ SMART CONTEXT INJECTION ============

/**
 * Search for relevant context before starting a task.
 * Returns past experiences that may help with the current task.
 */
export async function getSmartContext(input: {
    repoPath?: string;
    taskTitle: string;
    taskDescription?: string;
    maxResults?: number;
}): Promise<{
    context: Array<{ text: string; score: number; type: string }>;
    hasRelevantContext: boolean;
}> {
    const query = `${input.taskTitle} ${input.taskDescription || ""}`;
    const result = await cascadeEmbed(query, input.repoPath);
    const backend = await getActiveBackend(input.repoPath);

    const searchResults = await backend.search(result.vector, input.maxResults || 5);

    const context = searchResults
        .filter(r => r.score > 0.3) // Only relevant results
        .map(r => ({
            text: r.text || "",
            score: r.score,
            type: (r.metadata?.type as string) || "unknown",
        }));

    return {
        context,
        hasRelevantContext: context.length > 0,
    };
}

// ============ SELF-CORRECTION LOOP ============

/**
 * Search for past solutions to similar errors
 */
export async function findErrorSolution(input: {
    repoPath?: string;
    errorMessage: string;
    errorCode?: string;
    filePath?: string;
}): Promise<{
    found: boolean;
    solutions: Array<{ text: string; score: number; appliedAt?: string }>;
}> {
    const query = [
        `Error: ${input.errorMessage}`,
        input.errorCode ? `Code: ${input.errorCode}` : "",
        input.filePath ? `File: ${input.filePath}` : "",
    ].filter(Boolean).join("\n");

    const result = await cascadeEmbed(query, input.repoPath);
    const backend = await getActiveBackend(input.repoPath);

    const searchResults = await backend.search(result.vector, 5);

    const solutions = searchResults
        .filter(r => r.score > 0.5 && r.metadata?.type === "error_fix")
        .map(r => ({
            text: r.text || "",
            score: r.score,
            appliedAt: (r.metadata?.appliedAt as string) || undefined,
        }));

    return { found: solutions.length > 0, solutions };
}

/**
 * Record an error fix for future reference
 */
export async function recordErrorFix(input: {
    repoPath?: string;
    errorMessage: string;
    errorCode?: string;
    filePath?: string;
    solution: string;
    agent?: string;
}): Promise<{ indexed: boolean; docId: string }> {
    const text = [
        `Error: ${input.errorMessage}`,
        input.errorCode ? `Code: ${input.errorCode}` : "",
        input.filePath ? `File: ${input.filePath}` : "",
        `Solution: ${input.solution}`,
        input.agent ? `Fixed by: ${input.agent}` : "",
    ].filter(Boolean).join("\n");

    const result = await cascadeEmbed(text, input.repoPath);
    const backend = await getActiveBackend(input.repoPath);

    const docId = `error_fix_${Date.now()}`;
    await backend.add({
        id: docId,
        vector: result.vector,
        text,
        metadata: {
            type: "error_fix",
            errorCode: input.errorCode,
            filePath: input.filePath,
            agent: input.agent,
            appliedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
    });

    return { indexed: true, docId };
}

// ============ CONFLICT MEMORY ============

/**
 * Record a merge conflict resolution
 */
export async function recordConflictResolution(input: {
    repoPath?: string;
    filePath: string;
    conflictDescription: string;
    resolution: string;
    chosenSide?: "ours" | "theirs" | "manual";
    agent?: string;
}): Promise<{ indexed: boolean; docId: string }> {
    const text = [
        `Merge Conflict: ${input.filePath}`,
        `Conflict: ${input.conflictDescription}`,
        `Resolution: ${input.resolution}`,
        input.chosenSide ? `Chosen: ${input.chosenSide}` : "",
        input.agent ? `Resolved by: ${input.agent}` : "",
    ].filter(Boolean).join("\n");

    const result = await cascadeEmbed(text, input.repoPath);
    const backend = await getActiveBackend(input.repoPath);

    const docId = `conflict_${Date.now()}_${input.filePath.replace(/[^a-zA-Z0-9]/g, "_")}`;
    await backend.add({
        id: docId,
        vector: result.vector,
        text,
        metadata: {
            type: "conflict_resolution",
            filePath: input.filePath,
            chosenSide: input.chosenSide,
            agent: input.agent,
        },
        createdAt: new Date().toISOString(),
    });

    return { indexed: true, docId };
}

/**
 * Search for similar conflict resolutions
 */
export async function findConflictResolution(input: {
    repoPath?: string;
    filePath: string;
    conflictDescription: string;
}): Promise<{
    found: boolean;
    resolutions: Array<{ text: string; score: number; chosenSide?: string }>;
}> {
    const query = `Merge conflict in ${input.filePath}: ${input.conflictDescription}`;
    const result = await cascadeEmbed(query, input.repoPath);
    const backend = await getActiveBackend(input.repoPath);

    const searchResults = await backend.search(result.vector, 5);

    const resolutions = searchResults
        .filter(r => r.score > 0.4 && r.metadata?.type === "conflict_resolution")
        .map(r => ({
            text: r.text || "",
            score: r.score,
            chosenSide: (r.metadata?.chosenSide as string) || undefined,
        }));

    return { found: resolutions.length > 0, resolutions };
}
