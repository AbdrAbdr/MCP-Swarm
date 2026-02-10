/* eslint-disable @typescript-eslint/no-explicit-any -- MCP SDK handlers receive Zod-validated input but SDK doesn't propagate inferred types */
/**
 * MCP Swarm v1.1.0 - Smart Tools: core
 * Consolidated: swarm_agent + swarm_companion → swarm_agent
 *               swarm_control + swarm_pulse → swarm_control
 */

import { z } from "zod";

import { registerAgent, whoami, bootstrapProject } from "../workflows/agentRegistry.js";
import { companionLocalPause, companionLocalResume, companionLocalStatus, companionLocalStop } from "../workflows/companionControl.js";
import { getStopState, setStopState } from "../workflows/stopFlag.js";
import { updateSwarmPulse, getSwarmPulse } from "../workflows/pulse.js";

// Helper to wrap results
function wrapResult(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}

// ============ SMART TOOLS ============

/**
 * swarm_agent - Agent registration, identity & companion control
 * Merged: swarm_agent + swarm_companion
 */
export const swarmAgentTool = [
  "swarm_agent",
  {
    title: "Swarm Agent",
    description: "Agent registration, identity & companion control. Actions: register, whoami, init, companion_status, companion_stop, companion_pause, companion_resume",
    inputSchema: z.object({
      action: z.enum(["register", "whoami", "init", "companion_status", "companion_stop", "companion_pause", "companion_resume"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
      // companion params
      port: z.number().optional().default(9999).describe("Companion port"),
      token: z.string().optional().describe("Auth token"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "register":
        return wrapResult(await registerAgent({ repoPath: input.repoPath, commitMode: input.commitMode || "push" }));
      case "whoami":
        return wrapResult(await whoami(input.repoPath || process.cwd()));
      case "init":
        return wrapResult(await bootstrapProject(input.repoPath));
      // --- Companion actions ---
      case "companion_status":
        return wrapResult(await companionLocalStatus(input.port || 9999, input.token));
      case "companion_stop":
        return wrapResult(await companionLocalStop(input.port || 9999, input.token));
      case "companion_pause":
        return wrapResult(await companionLocalPause(input.port || 9999, input.token));
      case "companion_resume":
        return wrapResult(await companionLocalResume(input.port || 9999, input.token));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * swarm_control - Swarm stop/resume control & real-time pulse
 * Merged: swarm_control + swarm_pulse
 */
export const swarmControlTool = [
  "swarm_control",
  {
    title: "Swarm Control",
    description: "Swarm stop/resume control & real-time agent pulse. Actions: stop, resume, status, pulse_update, pulse_get",
    inputSchema: z.object({
      action: z.enum(["stop", "resume", "status", "pulse_update", "pulse_get"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      reason: z.string().optional().describe("Reason for stop"),
      by: z.string().optional().describe("Agent who stopped"),
      // pulse params
      agent: z.string().optional().describe("Agent name (for pulse_update)"),
      currentFile: z.string().optional().describe("Current file (for pulse_update)"),
      currentTask: z.string().optional().describe("Current task (for pulse_update)"),
      pulseStatus: z.enum(["active", "idle", "paused", "offline"]).optional().describe("Status (for pulse_update)"),
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
      // --- Pulse actions ---
      case "pulse_update":
        return wrapResult(await updateSwarmPulse({
          repoPath: input.repoPath,
          agent: input.agent,
          currentFile: input.currentFile,
          currentTask: input.currentTask,
          status: input.pulseStatus || "active",
          commitMode: input.commitMode || "push",
        }));
      case "pulse_get":
        return wrapResult(await getSwarmPulse(input.repoPath));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;
