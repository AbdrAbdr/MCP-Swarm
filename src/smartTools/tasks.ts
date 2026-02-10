/* eslint-disable @typescript-eslint/no-explicit-any -- MCP SDK handlers receive Zod-validated input but SDK doesn't propagate inferred types */
/**
 * MCP Swarm v1.1.0 - Smart Tools: tasks
 * Consolidated: swarm_task + swarm_briefing → swarm_task
 *               swarm_plan + swarm_spec → swarm_plan
 */

import { z } from "zod";

import { createTaskFile } from "../workflows/taskFile.js";
import { listTasks, updateTask } from "../workflows/taskState.js";
import { decomposeTask, getDecomposition } from "../workflows/decompose.js";
import { saveBriefing, loadBriefing } from "../workflows/briefings.js";
import { createImplementationPlan, addPlanTask, getNextTask, startTask, completeStep, completeTask, generateSubagentPrompt, exportPlanAsMarkdown, getPlanStatus, listPlans, markPlanReady } from "../workflows/writingPlans.js";
import { startSpecPipeline, startSpecPhase, completeSpecPhase, getSpecPipeline, listSpecPipelines, exportSpecAsMarkdown } from "../workflows/specPipeline.js";

// Helper to wrap results
function wrapResult(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}

// ===== schemas =====

const swarmTaskInput = z.object({
  action: z.enum(["create", "list", "update", "decompose", "get_decomposition", "brief_save", "brief_load"]).describe("Action to perform"),
  repoPath: z.string().optional(),
  shortDesc: z.string().optional().describe("Short description (for create)"),
  title: z.string().optional().describe("Task title (for create)"),
  questions: z.array(z.string()).optional().describe("Questions (for create)"),
  answers: z.array(z.string()).optional().describe("Answers (for create)"),
  notes: z.string().optional().describe("Notes (for create, brief_save)"),
  taskId: z.string().optional().describe("Task ID (for update, decompose, get_decomposition, brief_save, brief_load)"),
  status: z.enum(["open", "in_progress", "needs_review", "done", "canceled"]).optional().describe("Status (for update)"),
  assignee: z.string().optional().describe("Assignee (for update)"),
  branch: z.string().optional().describe("Branch (for update)"),
  links: z.array(z.string()).optional().describe("Links (for update)"),
  parentTitle: z.string().optional().describe("Parent title (for decompose)"),
  subtasks: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    estimatedMinutes: z.number().optional(),
    dependencies: z.array(z.string()).optional(),
  })).optional().describe("Subtasks (for decompose)"),
  agent: z.string().optional().describe("Agent name (for brief_save, brief_load)"),
  filesWorkedOn: z.array(z.string()).optional().describe("Files worked on (for brief_save)"),
  currentState: z.string().optional().describe("Current state (for brief_save)"),
  nextSteps: z.array(z.string()).optional().describe("Next steps (for brief_save)"),
  blockers: z.array(z.string()).optional().describe("Blockers (for brief_save)"),
  commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
}).strict();


const swarmPlanInput = z.object({
  action: z.enum(["create", "add", "next", "start", "step", "complete", "prompt", "export", "status", "list", "ready", "spec_start", "spec_phase", "spec_complete", "spec_get", "spec_list", "spec_export"]).describe("Action to perform"),
  repoPath: z.string().optional(),
  name: z.string().optional().describe("Plan name (for create)"),
  goal: z.string().optional().describe("Goal (for create)"),
  architecture: z.string().optional().describe("Architecture (for create)"),
  techStack: z.string().optional().describe("Tech stack (for create)"),
  designDocPath: z.string().optional().describe("Design doc path (for create)"),
  createdBy: z.string().optional().describe("Created by (for create)"),
  planId: z.string().optional().describe("Plan ID"),
  taskId: z.string().optional().describe("Task ID"),
  title: z.string().optional().describe("Task title (for add, spec_start)"),
  description: z.string().optional().describe("Task description (for add, spec_start)"),
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
  statusFilter: z.string().optional().describe("Status filter (for list, spec_list)"),
  pipelineId: z.string().optional().describe("Pipeline ID (for spec_*)"),
  maxIterations: z.number().optional().describe("Max iterations (for spec_start)"),
  role: z.string().optional().describe("Role (for spec_phase, spec_complete)"),
  output: z.string().optional().describe("Output (for spec_complete)"),
  commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
}).strict();


/**
 * swarm_task - Task management & briefings
 * Merged: swarm_task + swarm_briefing
 */
export const swarmTaskTool = [
  "swarm_task",
  {
    title: "Swarm Task",
    description: "Task management & briefings. Actions: create, list, update, decompose, get_decomposition, brief_save, brief_load",
    inputSchema: swarmTaskInput,
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
      // --- Briefing actions ---
      case "brief_save":
        return wrapResult(await saveBriefing({
          repoPath: input.repoPath,
          taskId: input.taskId,
          agent: input.agent,
          filesWorkedOn: input.filesWorkedOn || [],
          currentState: input.currentState,
          nextSteps: input.nextSteps || [],
          blockers: input.blockers,
          notes: input.notes,
          commitMode,
        }));
      case "brief_load":
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
 * swarm_plan - Implementation plans & specification pipeline
 * Merged: swarm_plan + swarm_spec
 */
export const swarmPlanTool = [
  "swarm_plan",
  {
    title: "Swarm Plan",
    description: "Implementation plans & specification pipeline. Actions: create, add, next, start, step, complete, prompt, export, status, list, ready, spec_start, spec_phase, spec_complete, spec_get, spec_list, spec_export",
    inputSchema: swarmPlanInput,
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
      // --- Spec pipeline actions ---
      case "spec_start":
        return wrapResult(await startSpecPipeline({
          repoPath: input.repoPath,
          title: input.title,
          description: input.description,
          maxIterations: input.maxIterations,
          commitMode: input.commitMode || "push",
        }));
      case "spec_phase":
        return wrapResult(await startSpecPhase({
          repoPath: input.repoPath,
          pipelineId: input.pipelineId,
          role: input.role,
          commitMode: input.commitMode || "push",
        }));
      case "spec_complete":
        return wrapResult(await completeSpecPhase({
          repoPath: input.repoPath,
          pipelineId: input.pipelineId,
          role: input.role,
          output: input.output,
          commitMode: input.commitMode || "push",
        }));
      case "spec_get":
        return wrapResult(await getSpecPipeline({
          repoPath: input.repoPath,
          pipelineId: input.pipelineId,
        }));
      case "spec_list":
        return wrapResult(await listSpecPipelines({
          repoPath: input.repoPath,
          status: input.statusFilter,
        }));
      case "spec_export":
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
