/**
 * MCP Swarm v0.9.17 - Smart Tools: tasks
 * Auto-generated from smartTools.ts
 */

import { z } from "zod";

import { createTaskFile } from "../workflows/taskFile.js";
import { listTasks, updateTask } from "../workflows/taskState.js";
import { decomposeTask, getDecomposition } from "../workflows/decompose.js";
import { saveBriefing, loadBriefing } from "../workflows/briefings.js";
import { createImplementationPlan, addPlanTask, getNextTask, startTask, completeStep, completeTask, generateSubagentPrompt, exportPlanAsMarkdown, getPlanStatus, listPlans, markPlanReady } from "../workflows/writingPlans.js";
import { startSpecPipeline, startSpecPhase, completeSpecPhase, getSpecPipeline, listSpecPipelines, exportSpecAsMarkdown } from "../workflows/specPipeline.js";

// Helper to wrap results
function wrapResult(result: any) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}


/**
 * 2. swarm_task - Task management
 */
export const swarmTaskTool = [
  "swarm_task",
  {
    title: "Swarm Task",
    description: "Task management. Actions: create, list, update, decompose, get_decomposition",
    inputSchema: z.object({
      action: z.enum(["create", "list", "update", "decompose", "get_decomposition"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      // create params
      shortDesc: z.string().optional().describe("Short description (for create)"),
      title: z.string().optional().describe("Task title (for create)"),
      questions: z.array(z.string()).optional().describe("Questions (for create)"),
      answers: z.array(z.string()).optional().describe("Answers (for create)"),
      notes: z.string().optional().describe("Notes (for create)"),
      // update params
      taskId: z.string().optional().describe("Task ID (for update, decompose, get_decomposition)"),
      status: z.enum(["open", "in_progress", "needs_review", "done", "canceled"]).optional().describe("Status (for update)"),
      assignee: z.string().optional().describe("Assignee (for update)"),
      branch: z.string().optional().describe("Branch (for update)"),
      links: z.array(z.string()).optional().describe("Links (for update)"),
      // decompose params
      parentTitle: z.string().optional().describe("Parent title (for decompose)"),
      subtasks: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        estimatedMinutes: z.number().optional(),
        dependencies: z.array(z.string()).optional(),
      })).optional().describe("Subtasks (for decompose)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    const commitMode = input.commitMode || "push";
    
    switch (input.action) {
      case "create":
        return wrapResult(await createTaskFile({
          repoPath: input.repoPath,
          shortDesc: input.shortDesc,
          title: input.title,
          questions: input.questions || [],
          answers: input.answers || [],
          notes: input.notes,
          commitMode,
        }));
      case "list":
        return wrapResult(await listTasks(input.repoPath));
      case "update":
        return wrapResult(await updateTask({
          repoPath: input.repoPath,
          taskId: input.taskId,
          status: input.status,
          assignee: input.assignee,
          branch: input.branch,
          links: input.links,
          commitMode,
        }));
      case "decompose":
        return wrapResult(await decomposeTask({
          repoPath: input.repoPath,
          parentTaskId: input.taskId,
          parentTitle: input.parentTitle,
          subtasks: input.subtasks || [],
          commitMode,
        }));
      case "get_decomposition":
        return wrapResult(await getDecomposition({
          repoPath: input.repoPath,
          parentTaskId: input.taskId,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 23. swarm_plan - Implementation plan management
 */
export const swarmPlanTool = [
  "swarm_plan",
  {
    title: "Swarm Plan",
    description: "Implementation plan management. Actions: create, add, next, start, step, complete, prompt, export, status, list, ready",
    inputSchema: z.object({
      action: z.enum(["create", "add", "next", "start", "step", "complete", "prompt", "export", "status", "list", "ready"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      name: z.string().optional().describe("Plan name (for create)"),
      goal: z.string().optional().describe("Goal (for create)"),
      architecture: z.string().optional().describe("Architecture (for create)"),
      techStack: z.string().optional().describe("Tech stack (for create)"),
      designDocPath: z.string().optional().describe("Design doc path (for create)"),
      createdBy: z.string().optional().describe("Created by (for create)"),
      planId: z.string().optional().describe("Plan ID"),
      taskId: z.string().optional().describe("Task ID"),
      title: z.string().optional().describe("Task title (for add)"),
      description: z.string().optional().describe("Task description (for add)"),
      files: z.array(z.string()).optional().describe("Files (for add)"),
      testCode: z.string().optional().describe("Test code (for add)"),
      implementationCode: z.string().optional().describe("Implementation code (for add)"),
      testCommand: z.string().optional().describe("Test command (for add)"),
      commitMessage: z.string().optional().describe("Commit message (for add)"),
      dependsOn: z.array(z.string()).optional().describe("Dependencies (for add)"),
      assignedTo: z.string().optional().describe("Assigned to (for start)"),
      stepNumber: z.number().optional().describe("Step number (for step)"),
      reviewResult: z.string().optional().describe("Review result (for complete)"),
      contextFiles: z.array(z.string()).optional().describe("Context files (for prompt)"),
      executionMode: z.string().optional().describe("Execution mode (for ready)"),
      statusFilter: z.string().optional().describe("Status filter (for list)"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "create":
        return wrapResult(await createImplementationPlan({
          name: input.name,
          goal: input.goal,
          architecture: input.architecture,
          techStack: input.techStack,
          designDocPath: input.designDocPath,
          createdBy: input.createdBy,
          repoPath: input.repoPath,
        }));
      case "add":
        return wrapResult(await addPlanTask({
          planId: input.planId,
          title: input.title,
          description: input.description,
          files: input.files || [],
          testCode: input.testCode,
          implementationCode: input.implementationCode,
          testCommand: input.testCommand,
          commitMessage: input.commitMessage,
          dependsOn: input.dependsOn,
          repoPath: input.repoPath,
        }));
      case "next":
        return wrapResult(await getNextTask({
          planId: input.planId,
          repoPath: input.repoPath,
        }));
      case "start":
        return wrapResult(await startTask({
          planId: input.planId,
          taskId: input.taskId,
          assignedTo: input.assignedTo,
          repoPath: input.repoPath,
        }));
      case "step":
        return wrapResult(await completeStep({
          planId: input.planId,
          taskId: input.taskId,
          stepNumber: input.stepNumber,
          repoPath: input.repoPath,
        }));
      case "complete":
        return wrapResult(await completeTask({
          planId: input.planId,
          taskId: input.taskId,
          reviewResult: input.reviewResult,
          repoPath: input.repoPath,
        }));
      case "prompt":
        return wrapResult(await generateSubagentPrompt({
          planId: input.planId,
          taskId: input.taskId,
          contextFiles: input.contextFiles,
          repoPath: input.repoPath,
        }));
      case "export":
        return wrapResult(await exportPlanAsMarkdown({
          planId: input.planId,
          repoPath: input.repoPath,
        }));
      case "status":
        return wrapResult(await getPlanStatus({
          planId: input.planId,
          repoPath: input.repoPath,
        }));
      case "list":
        return wrapResult(await listPlans({
          status: input.statusFilter,
          repoPath: input.repoPath,
        }));
      case "ready":
        return wrapResult(await markPlanReady({
          planId: input.planId,
          executionMode: input.executionMode,
          repoPath: input.repoPath,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

// ============ SMART TOOLS 15-27 ============

/**
 * 15. swarm_briefing - Briefing management
 */
export const swarmBriefingTool = [
  "swarm_briefing",
  {
    title: "Swarm Briefing",
    description: "Agent briefing management. Actions: save, load",
    inputSchema: z.object({
      action: z.enum(["save", "load"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      taskId: z.string().optional().describe("Task ID"),
      agent: z.string().optional().describe("Agent name"),
      filesWorkedOn: z.array(z.string()).optional().describe("Files worked on (for save)"),
      currentState: z.string().optional().describe("Current state (for save)"),
      nextSteps: z.array(z.string()).optional().describe("Next steps (for save)"),
      blockers: z.array(z.string()).optional().describe("Blockers (for save)"),
      notes: z.string().optional().describe("Notes (for save)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "save":
        return wrapResult(await saveBriefing({
          repoPath: input.repoPath,
          taskId: input.taskId,
          agent: input.agent,
          filesWorkedOn: input.filesWorkedOn || [],
          currentState: input.currentState,
          nextSteps: input.nextSteps || [],
          blockers: input.blockers,
          notes: input.notes,
          commitMode: input.commitMode || "push",
        }));
      case "load":
        return wrapResult(await loadBriefing({
          repoPath: input.repoPath,
          taskId: input.taskId,
          agent: input.agent,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 25. swarm_spec - Specification pipeline
 */
export const swarmSpecTool = [
  "swarm_spec",
  {
    title: "Swarm Spec",
    description: "Specification pipeline. Actions: start, phase, complete, get, list, export",
    inputSchema: z.object({
      action: z.enum(["start", "phase", "complete", "get", "list", "export"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      title: z.string().optional().describe("Title (for start)"),
      description: z.string().optional().describe("Description (for start)"),
      maxIterations: z.number().optional().describe("Max iterations (for start)"),
      pipelineId: z.string().optional().describe("Pipeline ID"),
      role: z.string().optional().describe("Role (for phase, complete)"),
      output: z.string().optional().describe("Output (for complete)"),
      status: z.string().optional().describe("Status filter (for list)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "start":
        return wrapResult(await startSpecPipeline({
          repoPath: input.repoPath,
          title: input.title,
          description: input.description,
          maxIterations: input.maxIterations,
          commitMode: input.commitMode || "push",
        }));
      case "phase":
        return wrapResult(await startSpecPhase({
          repoPath: input.repoPath,
          pipelineId: input.pipelineId,
          role: input.role,
          commitMode: input.commitMode || "push",
        }));
      case "complete":
        return wrapResult(await completeSpecPhase({
          repoPath: input.repoPath,
          pipelineId: input.pipelineId,
          role: input.role,
          output: input.output,
          commitMode: input.commitMode || "push",
        }));
      case "get":
        return wrapResult(await getSpecPipeline({
          repoPath: input.repoPath,
          pipelineId: input.pipelineId,
        }));
      case "list":
        return wrapResult(await listSpecPipelines({
          repoPath: input.repoPath,
          status: input.status,
        }));
      case "export":
        return wrapResult(await exportSpecAsMarkdown({
          repoPath: input.repoPath,
          pipelineId: input.pipelineId,
          commitMode: input.commitMode || "push",
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 26. swarm_qa - QA loop management
 */

