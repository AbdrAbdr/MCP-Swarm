/* eslint-disable @typescript-eslint/no-explicit-any -- MCP SDK handlers receive Zod-validated input but SDK doesn't propagate inferred types */
/**
 * MCP Swarm v1.1.0 - Smart Tools: intelligence
 * Consolidated:
 *   swarm_vector (unchanged)
 *   swarm_booster (unchanged)
 *   swarm_brainstorm + swarm_debug → swarm_brain
 *   swarm_context + swarm_context_pool + swarm_batch → swarm_context
 */

import { z } from "zod";

import { addContextNote, getContextNotes, searchContextByTag, searchContext, markNoteHelpful, updateContextNote, cleanupStaleNotes, getContextStats } from "../workflows/contextPool.js";
import { handleBatchTool } from "../workflows/batching.js";
import { handleBoosterTool } from "../workflows/agentBooster.js";
import { handleHNSWTool } from "../workflows/hnsw.js";
import { estimateContextSize, compressBriefing, compressMultipleBriefings, getCompressionStats } from "../workflows/contextCompressor.js";
import { startBrainstorm, askBrainstormQuestion, answerBrainstormQuestion, proposeApproaches, presentDesignSection, validateDesignSection, saveDesignDocument, getBrainstormSession, listBrainstormSessions } from "../workflows/brainstorming.js";
import { startDebugSession, logInvestigation, addEvidence, completePhase1, logPatterns, completePhase2, formHypothesis, testHypothesis, implementFix, verifyFix, getDebugSession, listDebugSessions, checkRedFlags } from "../workflows/systematicDebugging.js";

// Helper to wrap results
function wrapResult(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}

/**
 * swarm_vector - HNSW Vector Search (unchanged)
 */
export const swarmVectorTool = [
  "swarm_vector",
  {
    title: "Swarm Vector",
    description: `HNSW Vector Search - Fast semantic memory and similarity search.
Actions: init, add, add_batch, search, get, delete, list, stats, config, set_config, clear, duplicates, embed`,
    inputSchema: z.object({
      action: z.enum([
        "init", "add", "add_batch", "search", "get", "delete",
        "list", "stats", "config", "set_config", "clear", "duplicates", "embed"
      ]).describe("Action to perform"),
      repoPath: z.string().optional().describe("Repository path"),
      config: z.object({
        dimensions: z.number().optional().describe("Vector dimensions (384, 768, 1536)"),
        M: z.number().optional().describe("Max connections per layer"),
        efConstruction: z.number().optional().describe("Construction quality"),
        efSearch: z.number().optional().describe("Search quality"),
        distanceMetric: z.enum(["cosine", "euclidean", "dot"]).optional(),
      }).optional().describe("HNSW configuration"),
      id: z.string().optional().describe("Document ID"),
      text: z.string().optional().describe("Text to embed and store"),
      vector: z.array(z.number()).optional().describe("Pre-computed vector"),
      metadata: z.record(z.unknown()).optional().describe("Document metadata"),
      documents: z.array(z.object({
        id: z.string(),
        text: z.string().optional(),
        vector: z.array(z.number()).optional(),
        metadata: z.record(z.unknown()).optional(),
      })).optional().describe("Documents to add"),
      query: z.string().optional().describe("Search query text"),
      k: z.number().optional().describe("Number of results"),
      filter: z.record(z.unknown()).optional().describe("Metadata filter"),
      limit: z.number().optional().describe("Limit results"),
      offset: z.number().optional().describe("Offset for pagination"),
      threshold: z.number().optional().describe("Similarity threshold 0-1"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const repoPath = input.repoPath || process.cwd();
    return wrapResult(await handleHNSWTool({ ...input, repoPath }));
  },
] as const;

/**
 * swarm_booster - Agent Booster for fast local execution (unchanged)
 */
export const swarmBoosterTool = [
  "swarm_booster",
  {
    title: "Swarm Booster",
    description: `Agent Booster - Fast local execution for simple tasks (no LLM needed).
Actions: execute, can_boost, stats, history, config, set_config, types`,
    inputSchema: z.object({
      action: z.enum([
        "execute", "can_boost", "stats", "history", "config", "set_config", "types"
      ]).describe("Action to perform"),
      repoPath: z.string().optional().describe("Repository path"),
      task: z.object({
        type: z.enum([
          "rename_variable", "rename_file", "fix_typo", "update_import",
          "add_console_log", "remove_console_log", "toggle_flag", "update_version",
          "find_replace", "add_comment", "remove_comment", "format_json",
          "sort_imports", "remove_unused_imports", "add_export", "wrap_try_catch",
          "extract_constant", "inline_variable"
        ]).describe("Task type"),
        filePath: z.string().describe("File to modify"),
        oldName: z.string().optional(),
        newName: z.string().optional(),
        searchText: z.string().optional(),
        replaceText: z.string().optional(),
        lineNumber: z.number().optional(),
        variableName: z.string().optional(),
        comment: z.string().optional(),
      }).optional().describe("Task to execute"),
      dryRun: z.boolean().optional().describe("Preview changes without applying"),
      title: z.string().optional().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      limit: z.number().optional().describe("Limit results"),
      config: z.object({
        enabled: z.boolean().optional(),
        autoDetect: z.boolean().optional(),
        maxFileSize: z.number().optional(),
        backupBeforeChange: z.boolean().optional(),
        dryRun: z.boolean().optional(),
        estimatedLLMCostPerTask: z.number().optional(),
      }).optional().describe("Booster configuration"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const repoPath = input.repoPath || process.cwd();
    return wrapResult(await handleBoosterTool({ ...input, repoPath }));
  },
] as const;

/**
 * swarm_brain - Brainstorming & systematic debugging
 * Merged: swarm_brainstorm + swarm_debug
 */
export const swarmBrainTool = [
  "swarm_brain",
  {
    title: "Swarm Brain",
    description: `Brainstorming & systematic debugging.

Brainstorm Actions: bs_start, bs_ask, bs_answer, bs_propose, bs_present, bs_validate, bs_save, bs_get, bs_list
Debug Actions: dbg_start, dbg_investigate, dbg_evidence, dbg_phase1, dbg_patterns, dbg_phase2, dbg_hypothesis, dbg_test, dbg_fix, dbg_verify, dbg_get, dbg_list, dbg_redflags`,
    inputSchema: z.object({
      action: z.enum([
        // Brainstorm actions
        "bs_start", "bs_ask", "bs_answer", "bs_propose", "bs_present",
        "bs_validate", "bs_save", "bs_get", "bs_list",
        // Debug actions
        "dbg_start", "dbg_investigate", "dbg_evidence", "dbg_phase1",
        "dbg_patterns", "dbg_phase2", "dbg_hypothesis", "dbg_test",
        "dbg_fix", "dbg_verify", "dbg_get", "dbg_list", "dbg_redflags"
      ]).describe("Action to perform"),
      repoPath: z.string().optional(),
      // Brainstorm params
      agentId: z.string().optional().describe("Agent ID"),
      taskId: z.string().optional().describe("Task ID"),
      taskDescription: z.string().optional().describe("Task description"),
      sessionId: z.string().optional().describe("Session ID"),
      question: z.string().optional().describe("Question"),
      questionType: z.string().optional().describe("Question type"),
      options: z.array(z.string()).optional().describe("Options"),
      questionCategory: z.string().optional().describe("Question category"),
      questionId: z.string().optional().describe("Question ID"),
      answer: z.string().optional().describe("Answer"),
      approaches: z.array(z.object({
        name: z.string(),
        description: z.string(),
        pros: z.array(z.string()).optional(),
        cons: z.array(z.string()).optional(),
      })).optional().describe("Approaches"),
      title: z.string().optional().describe("Title"),
      content: z.string().optional().describe("Content"),
      category: z.string().optional().describe("Category"),
      sectionId: z.string().optional().describe("Section ID"),
      approved: z.boolean().optional().describe("Approved"),
      feedback: z.string().optional().describe("Feedback"),
      summary: z.string().optional().describe("Summary"),
      status: z.string().optional().describe("Status filter"),
      // Debug params
      description: z.string().optional().describe("Description"),
      errorMessage: z.string().optional().describe("Error message"),
      stackTrace: z.string().optional().describe("Stack trace"),
      reproductionSteps: z.array(z.string()).optional().describe("Reproduction steps"),
      errorAnalysis: z.string().optional().describe("Error analysis"),
      canReproduce: z.boolean().optional().describe("Can reproduce"),
      reproductionNotes: z.string().optional().describe("Reproduction notes"),
      recentChanges: z.array(z.string()).optional().describe("Recent changes"),
      component: z.string().optional().describe("Component"),
      input: z.string().optional().describe("Input"),
      output: z.string().optional().describe("Output"),
      expected: z.string().optional().describe("Expected"),
      notes: z.string().optional().describe("Notes"),
      workingExamples: z.array(z.string()).optional().describe("Working examples"),
      referenceImplementations: z.array(z.string()).optional().describe("Reference implementations"),
      differences: z.array(z.string()).optional().describe("Differences"),
      dependencies: z.array(z.string()).optional().describe("Dependencies"),
      statement: z.string().optional().describe("Statement"),
      reasoning: z.string().optional().describe("Reasoning"),
      testPlan: z.string().optional().describe("Test plan"),
      hypothesisId: z.string().optional().describe("Hypothesis ID"),
      result: z.enum(["confirmed", "refuted", "inconclusive"]).optional().describe("Result"),
      testNotes: z.string().optional().describe("Test notes"),
      testCase: z.string().optional().describe("Test case"),
      fixDescription: z.string().optional().describe("Fix description"),
      testPassed: z.boolean().optional().describe("Test passed"),
      noRegressions: z.boolean().optional().describe("No regressions"),
      thought: z.string().optional().describe("Thought to check"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    // Brainstorm actions
    switch (input.action) {
      case "bs_start":
        return wrapResult(await startBrainstorm({ agentId: input.agentId, taskId: input.taskId, taskDescription: input.taskDescription, repoPath: input.repoPath }));
      case "bs_ask":
        return wrapResult(await askBrainstormQuestion({ sessionId: input.sessionId, question: input.question, type: input.questionType, options: input.options, category: input.questionCategory, repoPath: input.repoPath }));
      case "bs_answer":
        return wrapResult(await answerBrainstormQuestion({ sessionId: input.sessionId, questionId: input.questionId, answer: input.answer, repoPath: input.repoPath }));
      case "bs_propose":
        return wrapResult(await proposeApproaches({ sessionId: input.sessionId, approaches: input.approaches || [], repoPath: input.repoPath }));
      case "bs_present":
        return wrapResult(await presentDesignSection({ sessionId: input.sessionId, title: input.title, content: input.content, category: input.category, repoPath: input.repoPath }));
      case "bs_validate":
        return wrapResult(await validateDesignSection({ sessionId: input.sessionId, sectionId: input.sectionId, approved: input.approved ?? true, feedback: input.feedback, repoPath: input.repoPath }));
      case "bs_save":
        return wrapResult(await saveDesignDocument({ sessionId: input.sessionId, title: input.title, summary: input.summary, repoPath: input.repoPath }));
      case "bs_get":
        return wrapResult(await getBrainstormSession({ sessionId: input.sessionId, repoPath: input.repoPath }));
      case "bs_list":
        return wrapResult(await listBrainstormSessions({ status: input.status, repoPath: input.repoPath }));
      // Debug actions
      case "dbg_start":
        return wrapResult(await startDebugSession({ agentId: input.agentId, title: input.title, description: input.description, errorMessage: input.errorMessage, stackTrace: input.stackTrace, reproductionSteps: input.reproductionSteps, repoPath: input.repoPath }));
      case "dbg_investigate":
        return wrapResult(await logInvestigation({ sessionId: input.sessionId, errorAnalysis: input.errorAnalysis, canReproduce: input.canReproduce, reproductionNotes: input.reproductionNotes, recentChanges: input.recentChanges, repoPath: input.repoPath }));
      case "dbg_evidence":
        return wrapResult(await addEvidence({ sessionId: input.sessionId, component: input.component, input: input.input, output: input.output, expected: input.expected, notes: input.notes, repoPath: input.repoPath }));
      case "dbg_phase1":
        return wrapResult(await completePhase1({ sessionId: input.sessionId, repoPath: input.repoPath }));
      case "dbg_patterns":
        return wrapResult(await logPatterns({ sessionId: input.sessionId, workingExamples: input.workingExamples, referenceImplementations: input.referenceImplementations, differences: input.differences, dependencies: input.dependencies, repoPath: input.repoPath }));
      case "dbg_phase2":
        return wrapResult(await completePhase2({ sessionId: input.sessionId, repoPath: input.repoPath }));
      case "dbg_hypothesis":
        return wrapResult(await formHypothesis({ sessionId: input.sessionId, statement: input.statement, reasoning: input.reasoning, testPlan: input.testPlan, repoPath: input.repoPath }));
      case "dbg_test":
        return wrapResult(await testHypothesis({ sessionId: input.sessionId, hypothesisId: input.hypothesisId, result: input.result, testNotes: input.testNotes, repoPath: input.repoPath }));
      case "dbg_fix":
        return wrapResult(await implementFix({ sessionId: input.sessionId, testCase: input.testCase, fixDescription: input.fixDescription, repoPath: input.repoPath }));
      case "dbg_verify":
        return wrapResult(await verifyFix({ sessionId: input.sessionId, testPassed: input.testPassed, noRegressions: input.noRegressions, notes: input.notes, repoPath: input.repoPath }));
      case "dbg_get":
        return wrapResult(await getDebugSession({ sessionId: input.sessionId, repoPath: input.repoPath }));
      case "dbg_list":
        return wrapResult(await listDebugSessions({ status: input.status, repoPath: input.repoPath }));
      case "dbg_redflags":
        return wrapResult(await checkRedFlags({ thought: input.thought }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * swarm_context - Context compression, shared notes & request batching
 * Merged: swarm_context + swarm_context_pool + swarm_batch
 */
export const swarmContextTool = [
  "swarm_context",
  {
    title: "Swarm Context",
    description: `Context compression, shared notes & request batching.

Context Actions: estimate, compress, compress_many, ctx_stats
Pool Actions: pool_add, pool_get, pool_search_tag, pool_search, pool_helpful, pool_update, pool_cleanup, pool_stats
Batch Actions: batch_queue, batch_config, batch_set_config, batch_job, batch_jobs, batch_result, batch_stats, batch_flush`,
    inputSchema: z.object({
      action: z.enum([
        // Context actions
        "estimate", "compress", "compress_many", "ctx_stats",
        // Pool actions
        "pool_add", "pool_get", "pool_search_tag", "pool_search",
        "pool_helpful", "pool_update", "pool_cleanup", "pool_stats",
        // Batch actions
        "batch_queue", "batch_config", "batch_set_config",
        "batch_job", "batch_jobs", "batch_result", "batch_stats", "batch_flush"
      ]).describe("Action to perform"),
      repoPath: z.string().optional(),
      // Context params
      text: z.string().optional().describe("Text (for estimate)"),
      model: z.string().optional().describe("Model (for estimate)"),
      briefing: z.any().optional().describe("Briefing (for compress)"),
      maxTokens: z.number().optional().describe("Max tokens"),
      preserveCode: z.boolean().optional().describe("Preserve code (for compress)"),
      briefings: z.array(z.any()).optional().describe("Briefings (for compress_many)"),
      // Pool params
      path: z.string().optional().describe("File/symbol path"),
      agentId: z.string().optional().describe("Agent ID"),
      summary: z.string().optional().describe("Note summary"),
      content: z.string().optional().describe("Note content"),
      tags: z.array(z.string()).optional().describe("Tags"),
      category: z.enum(["architecture", "api", "bug", "performance", "security", "documentation", "other"]).optional().describe("Category"),
      noteId: z.string().optional().describe("Note ID"),
      tag: z.string().optional().describe("Tag to search"),
      query: z.string().optional().describe("Search query"),
      maxAgeDays: z.number().optional().describe("Max age in days (for cleanup)"),
      // Batch params
      provider: z.enum(["anthropic", "openai", "google"]).optional().describe("AI provider"),
      messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
      })).optional().describe("Messages array"),
      enabled: z.boolean().optional().describe("Enable batching"),
      maxBatchSize: z.number().optional().describe("Max requests per batch"),
      maxWaitMs: z.number().optional().describe("Max wait before sending batch"),
      jobId: z.string().optional().describe("Batch job ID"),
      requestId: z.string().optional().describe("Request ID"),
      status: z.enum(["pending", "processing", "completed", "failed", "expired"]).optional().describe("Filter by status"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const repoPath = input.repoPath || process.cwd();

    switch (input.action) {
      // --- Context compression ---
      case "estimate":
        return wrapResult(await estimateContextSize({ text: input.text, model: input.model }));
      case "compress":
        return wrapResult(await compressBriefing({ repoPath, briefing: input.briefing, maxTokens: input.maxTokens, preserveCode: input.preserveCode }));
      case "compress_many":
        return wrapResult(await compressMultipleBriefings({ repoPath, briefings: input.briefings || [], maxTokens: input.maxTokens }));
      case "ctx_stats":
        return wrapResult(await getCompressionStats({ repoPath }));
      // --- Pool actions ---
      case "pool_add":
        return wrapResult(await addContextNote({ repoPath, targetPath: input.path, content: input.content, summary: input.summary || input.content?.slice(0, 100) || "", tags: input.tags, category: input.category, author: input.agentId }));
      case "pool_get":
        return wrapResult(await getContextNotes({ repoPath, targetPath: input.path }));
      case "pool_search_tag":
        return wrapResult(await searchContextByTag({ repoPath, tag: input.tag }));
      case "pool_search":
        return wrapResult(await searchContext({ repoPath, query: input.query }));
      case "pool_helpful":
        return wrapResult(await markNoteHelpful({ repoPath, noteId: input.noteId }));
      case "pool_update":
        return wrapResult(await updateContextNote({ repoPath, noteId: input.noteId, content: input.content, tags: input.tags }));
      case "pool_cleanup":
        return wrapResult(await cleanupStaleNotes({ repoPath, olderThanDays: input.maxAgeDays }));
      case "pool_stats":
        return wrapResult(await getContextStats({ repoPath }));
      // --- Batch actions ---
      case "batch_queue":
      case "batch_config":
      case "batch_set_config":
      case "batch_job":
      case "batch_jobs":
      case "batch_result":
      case "batch_stats":
      case "batch_flush": {
        const batchAction = input.action.replace("batch_", "");
        return wrapResult(await handleBatchTool({ ...input, action: batchAction, repoPath }));
      }
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;
