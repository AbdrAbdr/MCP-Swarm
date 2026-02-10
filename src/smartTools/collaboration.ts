/* eslint-disable @typescript-eslint/no-explicit-any -- MCP SDK handlers receive Zod-validated input but SDK doesn't propagate inferred types */
/**
 * MCP Swarm v1.1.0 - Smart Tools: collaboration
 * Consolidated:
 *   swarm_chat + swarm_review → swarm_chat
 *   swarm_voting + swarm_auction → swarm_voting
 *   swarm_orchestrator (unchanged)
 *   swarm_message + swarm_mcp → swarm_message
 */

import { z } from "zod";

import { appendTeamChat, updateTeamStatus } from "../workflows/teamFiles.js";
import { logSwarmThought, getRecentThoughts } from "../workflows/swarmThoughts.js";
import { requestCrossAgentReview, respondToReview, listPendingReviews } from "../workflows/autoReview.js";
import { startVoting, castVote, getVotingSession, listOpenVotings } from "../workflows/voting.js";
import { announceTaskForBidding, bidForTask, pollSwarmEvents } from "../workflows/auction.js";
import { scanSystemMcps, authorizeMcpsForSwarm, getPolicy } from "../workflows/mcpScanner.js";
import { tryBecomeOrchestrator, getOrchestratorInfo, orchestratorHeartbeat, resignOrchestrator, listExecutors, executorHeartbeat, sendAgentMessage, fetchAgentInbox, acknowledgeMessage, replyToMessage, searchMessages, getThreadMessages } from "../workflows/orchestrator.js";

// Helper to wrap results
function wrapResult(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
}

/**
 * swarm_chat - Team communication & code review
 * Merged: swarm_chat + swarm_review
 */
export const swarmChatTool = [
  "swarm_chat",
  {
    title: "Swarm Chat",
    description: "Team communication & code review. Actions: broadcast, dashboard, thought, thoughts, review_request, review_respond, review_list",
    inputSchema: z.object({
      action: z.enum(["broadcast", "dashboard", "thought", "thoughts", "review_request", "review_respond", "review_list"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      message: z.string().optional().describe("Message (for broadcast, thought)"),
      statusLine: z.string().optional().describe("Status line (for dashboard)"),
      agent: z.string().optional().describe("Agent name (for thought)"),
      taskId: z.string().optional().describe("Task ID (for thought)"),
      context: z.string().optional().describe("Context (for thought)"),
      limit: z.number().optional().describe("Limit (for thoughts)"),
      // review params
      fromAgent: z.string().optional().describe("Requesting agent (for review_request)"),
      toAgent: z.string().optional().describe("Target agent (for review_request)"),
      reviewId: z.string().optional().describe("Review ID (for review_respond)"),
      status: z.enum(["approved", "rejected"]).optional().describe("Review status (for review_respond)"),
      comment: z.string().optional().describe("Comment (for review_respond)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "broadcast":
        return wrapResult(await appendTeamChat({
          repoPath: input.repoPath,
          message: input.message,
          commitMode: input.commitMode || "push",
        }));
      case "dashboard":
        return wrapResult(await updateTeamStatus({
          repoPath: input.repoPath,
          statusLine: input.statusLine,
          commitMode: input.commitMode || "push",
        }));
      case "thought":
        return wrapResult(await logSwarmThought({
          repoPath: input.repoPath,
          agent: input.agent,
          taskId: input.taskId,
          thought: input.message,
          context: input.context,
          commitMode: input.commitMode || "push",
        }));
      case "thoughts":
        return wrapResult(await getRecentThoughts({
          repoPath: input.repoPath,
          limit: input.limit,
        }));
      // --- Review actions ---
      case "review_request":
        return wrapResult(await requestCrossAgentReview({
          repoPath: input.repoPath,
          fromAgent: input.fromAgent,
          toAgent: input.toAgent,
          commitMode: input.commitMode || "push",
        }));
      case "review_respond":
        return wrapResult(await respondToReview({
          repoPath: input.repoPath,
          reviewId: input.reviewId,
          status: input.status,
          comment: input.comment,
          commitMode: input.commitMode || "push",
        }));
      case "review_list":
        return wrapResult(await listPendingReviews(input.repoPath));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * swarm_voting - Voting & task auction system
 * Merged: swarm_voting + swarm_auction
 */
export const swarmVotingTool = [
  "swarm_voting",
  {
    title: "Swarm Voting",
    description: "Voting & task auction system. Actions: start, vote, list, get, auction_announce, auction_bid, auction_poll",
    inputSchema: z.object({
      action: z.enum(["start", "vote", "list", "get", "auction_announce", "auction_bid", "auction_poll"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      votingId: z.string().optional().describe("Voting ID (for vote, get)"),
      initiator: z.string().optional().describe("Initiator (for start)"),
      actionDesc: z.string().optional().describe("Action description (for start)"),
      description: z.string().optional().describe("Description (for start)"),
      dangerLevel: z.enum(["low", "medium", "high", "critical"]).optional().describe("Danger level (for start)"),
      ttlMinutes: z.number().optional().describe("TTL minutes (for start)"),
      agent: z.string().optional().describe("Agent name (for vote, auction_bid)"),
      decision: z.enum(["approve", "reject"]).optional().describe("Decision (for vote)"),
      reason: z.string().optional().describe("Reason (for vote)"),
      // auction params
      taskId: z.string().optional().describe("Task ID (for auction_*)"),
      title: z.string().optional().describe("Task title (for auction_announce)"),
      requiredCapabilities: z.array(z.string()).optional().describe("Required capabilities (for auction_announce)"),
      capabilities: z.array(z.string()).optional().describe("Agent capabilities (for auction_bid)"),
      since: z.number().optional().describe("Timestamp (for auction_poll)"),
      types: z.array(z.string()).optional().describe("Event types (for auction_poll)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "start":
        return wrapResult(await startVoting({
          repoPath: input.repoPath,
          initiator: input.initiator,
          action: input.actionDesc,
          description: input.description,
          dangerLevel: input.dangerLevel,
          ttlMinutes: input.ttlMinutes,
          commitMode: input.commitMode || "push",
        }));
      case "vote":
        return wrapResult(await castVote({
          repoPath: input.repoPath,
          votingId: input.votingId,
          agent: input.agent,
          decision: input.decision,
          reason: input.reason,
          commitMode: input.commitMode || "push",
        }));
      case "list":
        return wrapResult(await listOpenVotings(input.repoPath));
      case "get":
        return wrapResult(await getVotingSession({
          repoPath: input.repoPath,
          votingId: input.votingId,
        }));
      // --- Auction actions ---
      case "auction_announce":
        return wrapResult(await announceTaskForBidding({
          repoPath: input.repoPath,
          taskId: input.taskId,
          title: input.title,
          requiredCapabilities: input.requiredCapabilities,
          commitMode: input.commitMode || "push",
        }));
      case "auction_bid":
        return wrapResult(await bidForTask({
          repoPath: input.repoPath,
          taskId: input.taskId,
          agent: input.agent,
          capabilities: input.capabilities || [],
          commitMode: input.commitMode || "push",
        }));
      case "auction_poll":
        return wrapResult(await pollSwarmEvents({
          repoPath: input.repoPath,
          since: input.since,
          types: input.types,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * swarm_orchestrator - Orchestrator election and management (unchanged)
 */
export const swarmOrchestratorTool = [
  "swarm_orchestrator",
  {
    title: "Swarm Orchestrator",
    description: "Orchestrator election and management. Actions: elect, info, heartbeat, resign, executors, executor_heartbeat",
    inputSchema: z.object({
      action: z.enum(["elect", "info", "heartbeat", "resign", "executors", "executor_heartbeat"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      agentId: z.string().optional().describe("Agent ID"),
      agentName: z.string().optional().describe("Agent name (for elect)"),
      platform: z.string().optional().describe("Platform (for elect)"),
      currentTask: z.string().optional().describe("Current task (for executor_heartbeat)"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "elect":
        return wrapResult(await tryBecomeOrchestrator({
          repoPath: input.repoPath,
          agentId: input.agentId,
          agentName: input.agentName,
          platform: input.platform,
        }));
      case "info":
        return wrapResult(await getOrchestratorInfo({ repoPath: input.repoPath }));
      case "heartbeat":
        return wrapResult(await orchestratorHeartbeat({
          repoPath: input.repoPath,
          agentId: input.agentId,
        }));
      case "resign":
        return wrapResult(await resignOrchestrator({
          repoPath: input.repoPath,
          agentId: input.agentId,
        }));
      case "executors":
        return wrapResult(await listExecutors({ repoPath: input.repoPath }));
      case "executor_heartbeat":
        return wrapResult(await executorHeartbeat({
          repoPath: input.repoPath,
          agentId: input.agentId,
          currentTask: input.currentTask,
        }));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;

/**
 * swarm_message - Agent messaging & MCP scanner
 * Merged: swarm_message + swarm_mcp
 */
export const swarmMessageTool = [
  "swarm_message",
  {
    title: "Swarm Message",
    description: "Agent messaging & MCP scanner. Actions: send, inbox, ack, reply, search, thread, mcp_scan, mcp_authorize, mcp_policy",
    inputSchema: z.object({
      action: z.enum(["send", "inbox", "ack", "reply", "search", "thread", "mcp_scan", "mcp_authorize", "mcp_policy"]).describe("Action to perform"),
      repoPath: z.string().optional(),
      from: z.string().optional().describe("Sender (for send, reply)"),
      to: z.union([z.string(), z.array(z.string())]).optional().describe("Recipients (for send)"),
      subject: z.string().optional().describe("Subject (for send)"),
      body: z.string().optional().describe("Body (for send, reply)"),
      importance: z.enum(["low", "normal", "high", "urgent"]).optional(),
      threadId: z.string().optional().describe("Thread ID"),
      replyTo: z.string().optional().describe("Reply to message ID"),
      ackRequired: z.boolean().optional(),
      agentName: z.string().optional().describe("Agent name (for inbox, ack)"),
      messageId: z.string().optional().describe("Message ID (for ack, reply)"),
      query: z.string().optional().describe("Search query"),
      limit: z.number().optional(),
      urgentOnly: z.boolean().optional(),
      sinceTs: z.number().optional(),
      // mcp params
      authorizedMcps: z.array(z.string()).optional().describe("MCPs to authorize (for mcp_authorize)"),
      commitMode: z.enum(["none", "local", "push"]).optional().default("push"),
    }).strict(),
    outputSchema: z.any(),
  },
  async (input: any) => {
    switch (input.action) {
      case "send":
        return wrapResult(await sendAgentMessage({
          repoPath: input.repoPath,
          from: input.from,
          to: input.to,
          subject: input.subject,
          body: input.body,
          importance: input.importance,
          threadId: input.threadId,
          replyTo: input.replyTo,
          ackRequired: input.ackRequired,
        }));
      case "inbox":
        return wrapResult(await fetchAgentInbox({
          repoPath: input.repoPath,
          agentName: input.agentName,
          limit: input.limit,
          urgentOnly: input.urgentOnly,
          sinceTs: input.sinceTs,
        }));
      case "ack":
        return wrapResult(await acknowledgeMessage({
          repoPath: input.repoPath,
          agentName: input.agentName,
          messageId: input.messageId,
        }));
      case "reply":
        return wrapResult(await replyToMessage({
          repoPath: input.repoPath,
          from: input.from,
          messageId: input.messageId,
          body: input.body,
        }));
      case "search":
        return wrapResult(await searchMessages({
          repoPath: input.repoPath,
          query: input.query,
          limit: input.limit,
        }));
      case "thread":
        return wrapResult(await getThreadMessages({
          repoPath: input.repoPath,
          threadId: input.threadId,
        }));
      // --- MCP actions ---
      case "mcp_scan":
        return wrapResult(await scanSystemMcps());
      case "mcp_authorize":
        return wrapResult(await authorizeMcpsForSwarm({
          repoPath: input.repoPath,
          authorizedMcps: input.authorizedMcps || [],
          commitMode: input.commitMode || "push",
        }));
      case "mcp_policy":
        return wrapResult(await getPolicy(input.repoPath));
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  },
] as const;
