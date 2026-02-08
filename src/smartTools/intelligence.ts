/**
 * MCP Swarm v0.9.17 - Smart Tools: intelligence
 * Auto-generated from smartTools.ts
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
function wrapResult(result: any) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}


/**
 * 51. swarm_vector - HNSW Vector Search (v0.9.7)
 * 
 * Fast approximate nearest neighbor search for semantic memory.
 * 150x-12,500x faster than brute force search.
 */
export const swarmVectorTool = [
  "swarm_vector",
  {
    title: "Swarm Vector",
    description: `HNSW Vector Search - Fast semantic memory and similarity search.
Actions:
- init: Initialize vector index
- add: Add document to index
- add_batch: Add multiple documents
- search: Search for similar documents
- get: Get document by ID
- delete: Delete document
- list: List all documents
- stats: Get index statistics
- config: Get configuration
- set_config: Update configuration
- clear: Clear entire index
- duplicates: Find duplicate documents
- embed: Get embedding for text`,
    inputSchema: z.object({
      action: z.enum([
        "init", "add", "add_batch", "search", "get", "delete",
        "list", "stats", "config", "set_config", "clear", "duplicates", "embed"
      ]).describe("Action to perform"),
      repoPath: z.string().optional().describe("Repository path"),
      // For init/set_config
      config: z.object({
        dimensions: z.number().optional().describe("Vector dimensions (384, 768, 1536)"),
        M: z.number().optional().describe("Max connections per layer"),
        efConstruction: z.number().optional().describe("Construction quality"),
        efSearch: z.number().optional().describe("Search quality"),
        distanceMetric: z.enum(["cosine", "euclidean", "dot"]).optional(),
      }).optional().describe("HNSW configuration"),
      // For add
      id: z.string().optional().describe("Document ID"),
      text: z.string().optional().describe("Text to embed and store"),
      vector: z.array(z.number()).optional().describe("Pre-computed vector"),
      metadata: z.record(z.unknown()).optional().describe("Document metadata"),
      // For add_batch
      documents: z.array(z.object({
        id: z.string(),
        text: z.string().optional(),
        vector: z.array(z.number()).optional(),
        metadata: z.record(z.unknown()).optional(),
      })).optional().describe("Documents to add"),
      // For search
      query: z.string().optional().describe("Search query text"),
      k: z.number().optional().describe("Number of results"),
      filter: z.record(z.unknown()).optional().describe("Metadata filter"),
      // For list
      limit: z.number().optional().describe("Limit results"),
      offset: z.number().optional().describe("Offset for pagination"),
      // For duplicates
      threshold: z.number().optional().describe("Similarity threshold 0-1"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const repoPath = input.repoPath || process.cwd();
    return wrapResult(await handleHNSWTool({ ...input, repoPath }));
  },
] as const;

// ============ TOOL 52: AI DEFENCE ============


/**
 * 50. swarm_booster - Agent Booster for fast local execution (v0.9.6)
 * 
 * Executes trivial tasks locally without LLM API calls:
 * - 352x faster than LLM
 * - $0 cost
 * - Works offline
 * - Deterministic results
 */
export const swarmBoosterTool = [
  "swarm_booster",
  {
    title: "Swarm Booster",
    description: `Agent Booster - Fast local execution for simple tasks (no LLM needed).
Actions:
- execute: Run a booster task
- can_boost: Check if a task can be boosted
- stats: Get booster statistics
- history: Get execution history
- config: Get configuration
- set_config: Update configuration
- types: List supported task types

Supported task types:
- rename_variable: Rename a variable/function
- fix_typo: Fix typo in strings/comments
- find_replace: Simple find and replace
- add_console_log / remove_console_log
- toggle_flag: Toggle boolean flags
- update_version: Update version numbers
- update_import: Update import paths
- format_json / sort_imports
- add_export / extract_constant`,
    inputSchema: z.object({
      action: z.enum([
        "execute", "can_boost", "stats", "history", "config", "set_config", "types"
      ]).describe("Action to perform"),
      repoPath: z.string().optional().describe("Repository path"),
      // For execute
      task: z.object({
        type: z.enum([
          "rename_variable", "rename_file", "fix_typo", "update_import",
          "add_console_log", "remove_console_log", "toggle_flag", "update_version",
          "find_replace", "add_comment", "remove_comment", "format_json",
          "sort_imports", "remove_unused_imports", "add_export", "wrap_try_catch",
          "extract_constant", "inline_variable"
        ]).describe("Task type"),
        filePath: z.string().describe("File to modify"),
        oldName: z.string().optional().describe("Old name (for rename)"),
        newName: z.string().optional().describe("New name (for rename)"),
        searchText: z.string().optional().describe("Text to find"),
        replaceText: z.string().optional().describe("Replacement text"),
        lineNumber: z.number().optional().describe("Line number"),
        variableName: z.string().optional().describe("Variable name"),
        comment: z.string().optional().describe("Comment text"),
      }).optional().describe("Task to execute"),
      dryRun: z.boolean().optional().describe("Preview changes without applying"),
      // For can_boost
      title: z.string().optional().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      // For history
      limit: z.number().optional().describe("Limit results"),
      // For set_config
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
 * 51. swarm_vector - HNSW Vector Search (v0.9.7)
 * 
 * Fast approximate nearest neighbor search for semantic memory.
 * 150x-12,500x faster than brute force search.
 */


/**
 * 48. swarm_batch - Request batching for cost optimization
 */
export const swarmBatchTool = [
  "swarm_batch",
  {
    title: "Swarm Batch",
    description: "Request batching for API cost optimization (50% cheaper). Actions: queue, config, set_config, job, jobs, result, stats, flush",
    inputSchema: z.object({
      action: z.enum([
        "queue", "config", "set_config", "job", "jobs", "result", "stats", "flush"
      ]).describe("Action to perform"),
      repoPath: z.string().optional(),
      // Queue
      provider: z.enum(["anthropic", "openai", "google"]).optional().describe("AI provider"),
      model: z.string().optional().describe("Model name"),
      messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
      })).optional().describe("Messages array"),
      maxTokens: z.number().optional().describe("Max tokens"),
      // Config
      enabled: z.boolean().optional().describe("Enable batching"),
      maxBatchSize: z.number().optional().describe("Max requests per batch"),
      maxWaitMs: z.number().optional().describe("Max wait before sending batch"),
      // Query
      jobId: z.string().optional().describe("Batch job ID"),
      requestId: z.string().optional().describe("Request ID"),
      status: z.enum(["pending", "processing", "completed", "failed", "expired"]).optional().describe("Filter by status"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const repoPath = input.repoPath || process.cwd();
    return wrapResult(await handleBatchTool({ ...input, repoPath }));
  },
] as const;

/**
 * 49. swarm_sona - Self-Optimizing Neural Architecture (v0.9.5)
 * 
 * Self-learning task routing system that:
 * - Records which agents perform best for each task type
 * - Routes new tasks to best-performing agents  
 * - Learns from outcomes (<0.05ms adaptation)
 * - Improves over time with reinforcement learning
 */


/**
 * 22. swarm_brainstorm - Brainstorming sessions
 */
export const swarmBrainstormTool = [
  "swarm_brainstorm",
  {
    title: "Swarm Brainstorm",
    description: "Brainstorming sessions. Actions: start, ask, answer, propose, present, validate, save, get, list",
    inputSchema: z.object({
      action: z.enum(["start", "ask", "answer", "propose", "present", "validate", "save", "get", "list"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      agentId: z.string().optional().describe("Agent ID (for start)"),
      taskId: z.string().optional().describe("Task ID (for start)"),
      taskDescription: z.string().optional().describe("Task description (for start)"),
      sessionId: z.string().optional().describe("Session ID"),
      question: z.string().optional().describe("Question (for ask)"),
      questionType: z.string().optional().describe("Question type (for ask)"),
      options: z.array(z.string()).optional().describe("Options (for ask)"),
      questionCategory: z.string().optional().describe("Question category (for ask)"),
      questionId: z.string().optional().describe("Question ID (for answer)"),
      answer: z.string().optional().describe("Answer (for answer)"),
      approaches: z.array(z.object({
        name: z.string(),
        description: z.string(),
        pros: z.array(z.string()).optional(),
        cons: z.array(z.string()).optional(),
      })).optional().describe("Approaches (for propose)"),
      title: z.string().optional().describe("Title (for present, save)"),
      content: z.string().optional().describe("Content (for present)"),
      category: z.string().optional().describe("Category (for present)"),
      sectionId: z.string().optional().describe("Section ID (for validate)"),
      approved: z.boolean().optional().describe("Approved (for validate)"),
      feedback: z.string().optional().describe("Feedback (for validate)"),
      summary: z.string().optional().describe("Summary (for save)"),
      status: z.string().optional().describe("Status filter (for list)"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "start":
        return wrapResult(await startBrainstorm({
          agentId: input.agentId,
          taskId: input.taskId,
          taskDescription: input.taskDescription,
          repoPath: input.repoPath,
        }));
      case "ask":
        return wrapResult(await askBrainstormQuestion({
          sessionId: input.sessionId,
          question: input.question,
          type: input.questionType,
          options: input.options,
          category: input.questionCategory,
          repoPath: input.repoPath,
        }));
      case "answer":
        return wrapResult(await answerBrainstormQuestion({
          sessionId: input.sessionId,
          questionId: input.questionId,
          answer: input.answer,
          repoPath: input.repoPath,
        }));
      case "propose":
        return wrapResult(await proposeApproaches({
          sessionId: input.sessionId,
          approaches: input.approaches || [],
          repoPath: input.repoPath,
        }));
      case "present":
        return wrapResult(await presentDesignSection({
          sessionId: input.sessionId,
          title: input.title,
          content: input.content,
          category: input.category,
          repoPath: input.repoPath,
        }));
      case "validate":
        return wrapResult(await validateDesignSection({
          sessionId: input.sessionId,
          sectionId: input.sectionId,
          approved: input.approved ?? true,
          feedback: input.feedback,
          repoPath: input.repoPath,
        }));
      case "save":
        return wrapResult(await saveDesignDocument({
          sessionId: input.sessionId,
          title: input.title,
          summary: input.summary,
          repoPath: input.repoPath,
        }));
      case "get":
        return wrapResult(await getBrainstormSession({
          sessionId: input.sessionId,
          repoPath: input.repoPath,
        }));
      case "list":
        return wrapResult(await listBrainstormSessions({
          status: input.status,
          repoPath: input.repoPath,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 24. swarm_debug - Systematic debugging
 */
export const swarmDebugTool = [
  "swarm_debug",
  {
    title: "Swarm Debug",
    description: "Systematic debugging. Actions: start, investigate, evidence, phase1, patterns, phase2, hypothesis, test, fix, verify, get, list, redflags",
    inputSchema: z.object({
      action: z.enum(["start", "investigate", "evidence", "phase1", "patterns", "phase2", "hypothesis", "test", "fix", "verify", "get", "list", "redflags"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      agentId: z.string().optional().describe("Agent ID (for start)"),
      title: z.string().optional().describe("Title (for start)"),
      description: z.string().optional().describe("Description (for start)"),
      errorMessage: z.string().optional().describe("Error message (for start)"),
      stackTrace: z.string().optional().describe("Stack trace (for start)"),
      reproductionSteps: z.array(z.string()).optional().describe("Reproduction steps (for start)"),
      sessionId: z.string().optional().describe("Session ID"),
      errorAnalysis: z.string().optional().describe("Error analysis (for investigate)"),
      canReproduce: z.boolean().optional().describe("Can reproduce (for investigate)"),
      reproductionNotes: z.string().optional().describe("Reproduction notes (for investigate)"),
      recentChanges: z.array(z.string()).optional().describe("Recent changes (for investigate)"),
      component: z.string().optional().describe("Component (for evidence)"),
      input: z.string().optional().describe("Input (for evidence)"),
      output: z.string().optional().describe("Output (for evidence)"),
      expected: z.string().optional().describe("Expected (for evidence)"),
      notes: z.string().optional().describe("Notes (for evidence)"),
      workingExamples: z.array(z.string()).optional().describe("Working examples (for patterns)"),
      referenceImplementations: z.array(z.string()).optional().describe("Reference implementations (for patterns)"),
      differences: z.array(z.string()).optional().describe("Differences (for patterns)"),
      dependencies: z.array(z.string()).optional().describe("Dependencies (for patterns)"),
      statement: z.string().optional().describe("Statement (for hypothesis)"),
      reasoning: z.string().optional().describe("Reasoning (for hypothesis)"),
      testPlan: z.string().optional().describe("Test plan (for hypothesis)"),
      hypothesisId: z.string().optional().describe("Hypothesis ID (for test)"),
      result: z.enum(["confirmed", "refuted", "inconclusive"]).optional().describe("Result (for test)"),
      testNotes: z.string().optional().describe("Test notes (for test)"),
      testCase: z.string().optional().describe("Test case (for fix)"),
      fixDescription: z.string().optional().describe("Fix description (for fix)"),
      testPassed: z.boolean().optional().describe("Test passed (for verify)"),
      noRegressions: z.boolean().optional().describe("No regressions (for verify)"),
      status: z.string().optional().describe("Status filter (for list)"),
      thought: z.string().optional().describe("Thought to check (for redflags)"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "start":
        return wrapResult(await startDebugSession({
          agentId: input.agentId,
          title: input.title,
          description: input.description,
          errorMessage: input.errorMessage,
          stackTrace: input.stackTrace,
          reproductionSteps: input.reproductionSteps,
          repoPath: input.repoPath,
        }));
      case "investigate":
        return wrapResult(await logInvestigation({
          sessionId: input.sessionId,
          errorAnalysis: input.errorAnalysis,
          canReproduce: input.canReproduce,
          reproductionNotes: input.reproductionNotes,
          recentChanges: input.recentChanges,
          repoPath: input.repoPath,
        }));
      case "evidence":
        return wrapResult(await addEvidence({
          sessionId: input.sessionId,
          component: input.component,
          input: input.input,
          output: input.output,
          expected: input.expected,
          notes: input.notes,
          repoPath: input.repoPath,
        }));
      case "phase1":
        return wrapResult(await completePhase1({
          sessionId: input.sessionId,
          repoPath: input.repoPath,
        }));
      case "patterns":
        return wrapResult(await logPatterns({
          sessionId: input.sessionId,
          workingExamples: input.workingExamples,
          referenceImplementations: input.referenceImplementations,
          differences: input.differences,
          dependencies: input.dependencies,
          repoPath: input.repoPath,
        }));
      case "phase2":
        return wrapResult(await completePhase2({
          sessionId: input.sessionId,
          repoPath: input.repoPath,
        }));
      case "hypothesis":
        return wrapResult(await formHypothesis({
          sessionId: input.sessionId,
          statement: input.statement,
          reasoning: input.reasoning,
          testPlan: input.testPlan,
          repoPath: input.repoPath,
        }));
      case "test":
        return wrapResult(await testHypothesis({
          sessionId: input.sessionId,
          hypothesisId: input.hypothesisId,
          result: input.result,
          testNotes: input.testNotes,
          repoPath: input.repoPath,
        }));
      case "fix":
        return wrapResult(await implementFix({
          sessionId: input.sessionId,
          testCase: input.testCase,
          fixDescription: input.fixDescription,
          repoPath: input.repoPath,
        }));
      case "verify":
        return wrapResult(await verifyFix({
          sessionId: input.sessionId,
          testPassed: input.testPassed,
          noRegressions: input.noRegressions,
          notes: input.notes,
          repoPath: input.repoPath,
        }));
      case "get":
        return wrapResult(await getDebugSession({
          sessionId: input.sessionId,
          repoPath: input.repoPath,
        }));
      case "list":
        return wrapResult(await listDebugSessions({
          status: input.status,
          repoPath: input.repoPath,
        }));
      case "redflags":
        return wrapResult(await checkRedFlags({
          thought: input.thought,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 32. swarm_context - Context compression
 */
export const swarmContextTool = [
  "swarm_context",
  {
    title: "Swarm Context",
    description: "Context compression. Actions: estimate, compress, compress_many, stats",
    inputSchema: z.object({
      action: z.enum(["estimate", "compress", "compress_many", "stats"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      text: z.string().optional().describe("Text (for estimate)"),
      model: z.string().optional().describe("Model (for estimate)"),
      briefing: z.any().optional().describe("Briefing (for compress)"),
      maxTokens: z.number().optional().describe("Max tokens (for compress, compress_many)"),
      preserveCode: z.boolean().optional().describe("Preserve code (for compress)"),
      briefings: z.array(z.any()).optional().describe("Briefings (for compress_many)"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "estimate":
        return wrapResult(await estimateContextSize({
          text: input.text,
          model: input.model,
        }));
      case "compress":
        return wrapResult(await compressBriefing({
          repoPath: input.repoPath,
          briefing: input.briefing,
          maxTokens: input.maxTokens,
          preserveCode: input.preserveCode,
        }));
      case "compress_many":
        return wrapResult(await compressMultipleBriefings({
          repoPath: input.repoPath,
          briefings: input.briefings || [],
          maxTokens: input.maxTokens,
        }));
      case "stats":
        return wrapResult(await getCompressionStats({
          repoPath: input.repoPath,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 43. swarm_context_pool - Shared context notes between agents
 */
export const swarmContextPoolTool = [
  "swarm_context_pool",
  {
    title: "Swarm Context Pool",
    description: "Shared context notes between agents. Actions: add, get, search_tag, search, helpful, update, cleanup, stats",
    inputSchema: z.object({
      action: z.enum(["add", "get", "search_tag", "search", "helpful", "update", "cleanup", "stats"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      path: z.string().optional().describe("File/symbol path"),
      agentId: z.string().optional().describe("Agent ID"),
      summary: z.string().optional().describe("Note summary"),
      content: z.string().optional().describe("Note content"),
      tags: z.array(z.string()).optional().describe("Tags"),
      category: z.enum(["architecture", "api", "bug", "performance", "security", "documentation", "other"]).optional().describe("Category"),
      noteId: z.string().optional().describe("Note ID (for helpful, update)"),
      tag: z.string().optional().describe("Tag to search (for search_tag)"),
      query: z.string().optional().describe("Search query (for search)"),
      maxAgeDays: z.number().optional().describe("Max age in days (for cleanup)"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "add":
        return wrapResult(await addContextNote({
          repoPath: input.repoPath,
          targetPath: input.path,
          content: input.content,
          summary: input.summary || input.content?.slice(0, 100) || "",
          tags: input.tags,
          category: input.category,
          author: input.agentId,
        }));
      case "get":
        return wrapResult(await getContextNotes({
          repoPath: input.repoPath,
          targetPath: input.path,
        }));
      case "search_tag":
        return wrapResult(await searchContextByTag({
          repoPath: input.repoPath,
          tag: input.tag,
        }));
      case "search":
        return wrapResult(await searchContext({
          repoPath: input.repoPath,
          query: input.query,
        }));
      case "helpful":
        return wrapResult(await markNoteHelpful({
          repoPath: input.repoPath,
          noteId: input.noteId,
        }));
      case "update":
        return wrapResult(await updateContextNote({
          repoPath: input.repoPath,
          noteId: input.noteId,
          content: input.content,
          tags: input.tags,
        }));
      case "cleanup":
        return wrapResult(await cleanupStaleNotes({
          repoPath: input.repoPath,
          olderThanDays: input.maxAgeDays,
        }));
      case "stats":
        return wrapResult(await getContextStats({ repoPath: input.repoPath }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 44. swarm_autoreview - Automatic code review assignment
 */

