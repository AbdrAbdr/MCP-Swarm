/**
 * MCP Swarm v0.9.17 - Smart Tools: core
 * Auto-generated from smartTools.ts
 */

import { z } from "zod";

import { registerAgent, whoami, bootstrapProject } from "../workflows/agentRegistry.js";
import { companionLocalPause, companionLocalResume, companionLocalStatus, companionLocalStop } from "../workflows/companionControl.js";
import { getStopState, setStopState } from "../workflows/stopFlag.js";
import { updateSwarmPulse, getSwarmPulse } from "../workflows/pulse.js";

// Helper to wrap results
function wrapResult(result: any) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}


// ============ SMART TOOLS ============

/**
 * 1. swarm_agent - Agent registration and identity
 */
export const swarmAgentTool = [
  "swarm_agent",
  {
    title: "Swarm Agent",
    description: "Agent registration and identity. Actions: register, whoami, init",
    inputSchema: z.object({
      action: z.enum(["register", "whoami", "init"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: { action: string; repoPath?: string; commitMode?: "none" | "local" | "push" }) => {
    switch (input.action) {
      case "register":
        return wrapResult(await registerAgent({ repoPath: input.repoPath, commitMode: input.commitMode || "push" }));
      case "whoami":
        return wrapResult(await whoami(input.repoPath || process.cwd()));
      case "init":
        return wrapResult(await bootstrapProject(input.repoPath));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 7. swarm_control - Swarm stop/resume control
 */
export const swarmControlTool = [
  "swarm_control",
  {
    title: "Swarm Control",
    description: "Swarm stop/resume control. Actions: stop, resume, status",
    inputSchema: z.object({
      action: z.enum(["stop", "resume", "status"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      reason: z.string().optional().describe("Reason for stop"),
      by: z.string().optional().describe("Agent who stopped"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "stop":
        return wrapResult(await setStopState({
          repoPath: input.repoPath,
          stopped: true,
          reason: input.reason,
          by: input.by,
          commitMode: input.commitMode || "push",
        }));
      case "resume":
        return wrapResult(await setStopState({
          repoPath: input.repoPath,
          stopped: false,
          commitMode: input.commitMode || "push",
        }));
      case "status":
        return wrapResult(await getStopState(input.repoPath));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 16. swarm_pulse - Real-time agent status
 */
export const swarmPulseTool = [
  "swarm_pulse",
  {
    title: "Swarm Pulse",
    description: "Real-time agent status. Actions: update, get",
    inputSchema: z.object({
      action: z.enum(["update", "get"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      agent: z.string().optional().describe("Agent name (for update)"),
      currentFile: z.string().optional().describe("Current file (for update)"),
      currentTask: z.string().optional().describe("Current task (for update)"),
      status: z.enum(["active", "idle", "paused", "offline"]).optional().describe("Status (for update)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "update":
        return wrapResult(await updateSwarmPulse({
          repoPath: input.repoPath,
          agent: input.agent,
          currentFile: input.currentFile,
          currentTask: input.currentTask,
          status: input.status || "active",
          commitMode: input.commitMode || "push",
        }));
      case "get":
        return wrapResult(await getSwarmPulse(input.repoPath));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 6. swarm_companion - Companion daemon control
 */
export const swarmCompanionTool = [
  "swarm_companion",
  {
    title: "Swarm Companion",
    description: "Companion daemon control. Actions: status, stop, pause, resume",
    inputSchema: z.object({
      action: z.enum(["status", "stop", "pause", "resume"]).describe("Action to perform"),
      port: z.number().optional().default(9999).describe("Companion port"),
      token: z.string().optional().describe("Auth token"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: { action: string; port?: number; token?: string }) => {
    const port = input.port || 9999;
    switch (input.action) {
      case "status":
        return wrapResult(await companionLocalStatus(port, input.token));
      case "stop":
        return wrapResult(await companionLocalStop(port, input.token));
      case "pause":
        return wrapResult(await companionLocalPause(port, input.token));
      case "resume":
        return wrapResult(await companionLocalResume(port, input.token));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * 7. swarm_control - Swarm stop/resume control
 */

