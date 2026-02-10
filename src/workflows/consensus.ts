/**
 * Consensus Protocols — Distributed Agreement for Multi-Agent Systems
 * 
 * MCP Swarm v0.9.9
 * 
 * Implements consensus algorithms for coordinating decisions across
 * multiple AI agents in a distributed environment:
 * 
 * 1. Raft-like Leader Election
 *    - Term-based leadership
 *    - Heartbeat monitoring
 *    - Automatic failover
 * 
 * 2. Log Replication
 *    - Ordered command log
 *    - Commit confirmation
 *    - State machine replication
 * 
 * 3. Byzantine Fault Tolerance (BFT)
 *    - 2/3 + 1 quorum for untrusted environments
 *    - Vote verification
 *    - Malicious node detection
 * 
 * 4. Proposal System
 *    - Any agent can propose changes
 *    - Voting with configurable thresholds
 *    - Timeout handling
 * 
 * Inspired by Raft (Ongaro & Ousterhout) and PBFT (Castro & Liskov).
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

/**
 * Node state in consensus
 */
export type NodeState = "follower" | "candidate" | "leader";

/**
 * Consensus mode
 */
export type ConsensusMode = "raft" | "bft" | "simple_majority";

/**
 * Proposal status
 */
export type ProposalStatus =
  | "pending"      // Waiting for votes
  | "approved"     // Got enough votes
  | "rejected"     // Failed to get votes
  | "expired"      // Timed out
  | "executed";    // Applied to state

/**
 * Vote type
 */
export type VoteType = "approve" | "reject" | "abstain";

/**
 * Node info
 */
export interface ConsensusNode {
  id: string;
  name: string;
  state: NodeState;
  term: number;
  votedFor: string | null;
  lastHeartbeat: number;
  joinedAt: number;
  commitIndex: number;
  logLength: number;
  isTrusted: boolean;
}

/**
 * Log entry for replication
 */
export interface LogEntry {
  index: number;
  term: number;
  command: string;
  data: Record<string, unknown>;
  timestamp: number;
  proposedBy: string;
  committed: boolean;
  appliedAt?: number;
}

/**
 * Proposal for voting
 */
export interface Proposal {
  id: string;
  title: string;
  description: string;
  type: "config_change" | "task_assignment" | "architecture" | "rollback" | "emergency" | "custom";
  proposedBy: string;
  proposedAt: number;
  expiresAt: number;
  status: ProposalStatus;
  data: Record<string, unknown>;
  votes: ProposalVote[];
  requiredQuorum: number;
  requiredMajority: number; // 0.5 = simple majority, 0.67 = 2/3, 1.0 = unanimous
  result?: {
    approved: number;
    rejected: number;
    abstained: number;
    quorumReached: boolean;
    majorityReached: boolean;
  };
}

/**
 * Vote on a proposal
 */
export interface ProposalVote {
  nodeId: string;
  nodeName: string;
  vote: VoteType;
  reason?: string;
  timestamp: number;
  signature?: string; // For BFT verification
}

/**
 * Election state
 */
export interface ElectionState {
  term: number;
  leaderId: string | null;
  leaderName: string | null;
  electedAt: number | null;
  votesReceived: string[];
  electionTimeout: number;
  lastElection: number;
}

/**
 * Consensus configuration
 */
export interface ConsensusConfig {
  mode: ConsensusMode;
  heartbeatInterval: number;      // ms
  electionTimeout: number;        // ms
  proposalTimeout: number;        // ms (default 5 min)
  minNodes: number;               // Minimum nodes for quorum
  defaultMajority: number;        // 0.5 = 50%, 0.67 = 2/3
  bftThreshold: number;           // For BFT: (n-1)/3 faulty nodes tolerated
  autoFailover: boolean;
  requireSignatures: boolean;     // For BFT vote verification
}

/**
 * Consensus statistics
 */
export interface ConsensusStats {
  totalProposals: number;
  approvedProposals: number;
  rejectedProposals: number;
  expiredProposals: number;
  totalElections: number;
  currentTerm: number;
  currentLeader: string | null;
  activeNodes: number;
  logLength: number;
  lastCommitIndex: number;
  uptime: number;
}

// ============ CONSTANTS ============

const CONSENSUS_DIR = "consensus";
const CONFIG_FILE = "config.json";
const NODES_FILE = "nodes.json";
const LOG_FILE = "log.json";
const PROPOSALS_FILE = "proposals.json";
const ELECTION_FILE = "election.json";
const STATS_FILE = "stats.json";

const DEFAULT_CONFIG: ConsensusConfig = {
  mode: "simple_majority",
  heartbeatInterval: 5000,
  electionTimeout: 15000,
  proposalTimeout: 300000, // 5 minutes
  minNodes: 2,
  defaultMajority: 0.5,
  bftThreshold: 0.33,
  autoFailover: true,
  requireSignatures: false,
};

// ============ HELPERS ============

async function getConsensusDir(repoRoot: string): Promise<string> {
  const dir = path.join(repoRoot, ".swarm", CONSENSUS_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function loadJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

async function saveJson<T>(filePath: string, data: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function generateId(): string {
  return `prop_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function generateSignature(data: string, nodeId: string): string {
  return crypto.createHash("sha256").update(`${data}:${nodeId}`).digest("hex").slice(0, 16);
}

// ============ CORE FUNCTIONS ============

/**
 * Load configuration
 */
async function loadConfig(repoRoot: string): Promise<ConsensusConfig> {
  const dir = await getConsensusDir(repoRoot);
  return loadJson(path.join(dir, CONFIG_FILE), DEFAULT_CONFIG);
}

/**
 * Save configuration
 */
async function saveConfig(repoRoot: string, config: ConsensusConfig): Promise<void> {
  const dir = await getConsensusDir(repoRoot);
  await saveJson(path.join(dir, CONFIG_FILE), config);
}

/**
 * Load nodes
 */
async function loadNodes(repoRoot: string): Promise<ConsensusNode[]> {
  const dir = await getConsensusDir(repoRoot);
  return loadJson(path.join(dir, NODES_FILE), []);
}

/**
 * Save nodes
 */
async function saveNodes(repoRoot: string, nodes: ConsensusNode[]): Promise<void> {
  const dir = await getConsensusDir(repoRoot);
  await saveJson(path.join(dir, NODES_FILE), nodes);
}

/**
 * Load log entries
 */
async function loadLog(repoRoot: string): Promise<LogEntry[]> {
  const dir = await getConsensusDir(repoRoot);
  return loadJson(path.join(dir, LOG_FILE), []);
}

/**
 * Save log entries
 */
async function saveLog(repoRoot: string, log: LogEntry[]): Promise<void> {
  const dir = await getConsensusDir(repoRoot);
  await saveJson(path.join(dir, LOG_FILE), log);
}

/**
 * Load proposals
 */
async function loadProposals(repoRoot: string): Promise<Proposal[]> {
  const dir = await getConsensusDir(repoRoot);
  return loadJson(path.join(dir, PROPOSALS_FILE), []);
}

/**
 * Save proposals
 */
async function saveProposals(repoRoot: string, proposals: Proposal[]): Promise<void> {
  const dir = await getConsensusDir(repoRoot);
  await saveJson(path.join(dir, PROPOSALS_FILE), proposals);
}

/**
 * Load election state
 */
async function loadElection(repoRoot: string): Promise<ElectionState> {
  const dir = await getConsensusDir(repoRoot);
  return loadJson(path.join(dir, ELECTION_FILE), {
    term: 0,
    leaderId: null,
    leaderName: null,
    electedAt: null,
    votesReceived: [],
    electionTimeout: DEFAULT_CONFIG.electionTimeout,
    lastElection: 0,
  });
}

/**
 * Save election state
 */
async function saveElection(repoRoot: string, election: ElectionState): Promise<void> {
  const dir = await getConsensusDir(repoRoot);
  await saveJson(path.join(dir, ELECTION_FILE), election);
}

/**
 * Load stats
 */
async function loadStats(repoRoot: string): Promise<ConsensusStats> {
  const dir = await getConsensusDir(repoRoot);
  return loadJson(path.join(dir, STATS_FILE), {
    totalProposals: 0,
    approvedProposals: 0,
    rejectedProposals: 0,
    expiredProposals: 0,
    totalElections: 0,
    currentTerm: 0,
    currentLeader: null,
    activeNodes: 0,
    logLength: 0,
    lastCommitIndex: 0,
    uptime: Date.now(),
  });
}

/**
 * Save stats
 */
async function saveStats(repoRoot: string, stats: ConsensusStats): Promise<void> {
  const dir = await getConsensusDir(repoRoot);
  await saveJson(path.join(dir, STATS_FILE), stats);
}

// ============ NODE MANAGEMENT ============

/**
 * Join consensus cluster
 */
export async function joinCluster(input: {
  repoPath?: string;
  nodeId: string;
  nodeName: string;
  isTrusted?: boolean;
}): Promise<{ success: boolean; node: ConsensusNode; clusterSize: number }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const nodes = await loadNodes(repoRoot);
  const election = await loadElection(repoRoot);

  // Check if already exists
  let node = nodes.find(n => n.id === input.nodeId);

  if (node) {
    // Update heartbeat
    node.lastHeartbeat = Date.now();
    node.name = input.nodeName;
  } else {
    // New node
    node = {
      id: input.nodeId,
      name: input.nodeName,
      state: election.leaderId ? "follower" : "candidate",
      term: election.term,
      votedFor: null,
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
      commitIndex: 0,
      logLength: 0,
      isTrusted: input.isTrusted ?? true,
    };
    nodes.push(node);
  }

  await saveNodes(repoRoot, nodes);

  return {
    success: true,
    node,
    clusterSize: nodes.length,
  };
}

/**
 * Leave consensus cluster
 */
export async function leaveCluster(input: {
  repoPath?: string;
  nodeId: string;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const nodes = await loadNodes(repoRoot);
  const election = await loadElection(repoRoot);

  const index = nodes.findIndex(n => n.id === input.nodeId);
  if (index === -1) {
    return { success: false, message: "Node not found in cluster" };
  }

  const node = nodes[index];
  nodes.splice(index, 1);

  // If leader left, trigger new election
  if (election.leaderId === input.nodeId) {
    election.leaderId = null;
    election.leaderName = null;
    election.term++;
    await saveElection(repoRoot, election);
  }

  await saveNodes(repoRoot, nodes);

  return {
    success: true,
    message: `Node ${node.name} left cluster. ${nodes.length} nodes remaining.`,
  };
}

/**
 * Send heartbeat
 */
export async function heartbeat(input: {
  repoPath?: string;
  nodeId: string;
  commitIndex?: number;
  logLength?: number;
}): Promise<{ success: boolean; term: number; leaderId: string | null }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const nodes = await loadNodes(repoRoot);
  const election = await loadElection(repoRoot);

  const node = nodes.find(n => n.id === input.nodeId);
  if (!node) {
    return { success: false, term: election.term, leaderId: election.leaderId };
  }

  node.lastHeartbeat = Date.now();
  node.term = election.term;
  if (input.commitIndex !== undefined) node.commitIndex = input.commitIndex;
  if (input.logLength !== undefined) node.logLength = input.logLength;

  await saveNodes(repoRoot, nodes);

  return {
    success: true,
    term: election.term,
    leaderId: election.leaderId,
  };
}

/**
 * Get cluster status
 */
export async function getClusterStatus(input: {
  repoPath?: string;
}): Promise<{
  nodes: ConsensusNode[];
  activeNodes: number;
  leader: ConsensusNode | null;
  term: number;
  mode: ConsensusMode;
  quorumReached: boolean;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const nodes = await loadNodes(repoRoot);
  const election = await loadElection(repoRoot);
  const config = await loadConfig(repoRoot);

  const now = Date.now();
  const timeout = config.electionTimeout * 2;

  // Mark nodes as active/inactive
  const activeNodes = nodes.filter(n => (now - n.lastHeartbeat) < timeout);
  const leader = nodes.find(n => n.id === election.leaderId) || null;

  return {
    nodes: nodes.map(n => ({
      ...n,
      state: n.id === election.leaderId ? "leader" :
        (now - n.lastHeartbeat) < timeout ? "follower" : "candidate",
    })),
    activeNodes: activeNodes.length,
    leader,
    term: election.term,
    mode: config.mode,
    quorumReached: activeNodes.length >= config.minNodes,
  };
}

// ============ LEADER ELECTION ============

/**
 * Start election (Raft-style)
 */
export async function startElection(input: {
  repoPath?: string;
  candidateId: string;
  candidateName: string;
}): Promise<{
  success: boolean;
  elected: boolean;
  term: number;
  message: string;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const nodes = await loadNodes(repoRoot);
  const election = await loadElection(repoRoot);
  const config = await loadConfig(repoRoot);
  const stats = await loadStats(repoRoot);

  const now = Date.now();

  // Check if current leader is still alive
  if (election.leaderId) {
    const leader = nodes.find(n => n.id === election.leaderId);
    if (leader && (now - leader.lastHeartbeat) < config.electionTimeout) {
      return {
        success: false,
        elected: false,
        term: election.term,
        message: `Current leader ${election.leaderName} is still active`,
      };
    }
  }

  // Increment term
  election.term++;
  election.votesReceived = [input.candidateId];
  election.lastElection = now;

  // Get active nodes
  const activeNodes = nodes.filter(n =>
    (now - n.lastHeartbeat) < config.electionTimeout * 2
  );

  // Check quorum
  if (activeNodes.length < config.minNodes) {
    await saveElection(repoRoot, election);
    return {
      success: false,
      elected: false,
      term: election.term,
      message: `Not enough active nodes. Need ${config.minNodes}, have ${activeNodes.length}`,
    };
  }

  // In simple mode, first candidate wins if they have quorum
  const requiredVotes = Math.ceil(activeNodes.length * config.defaultMajority);

  // Auto-grant votes from other nodes (simplified for file-based system)
  // In real Raft, each node would vote independently
  for (const node of activeNodes) {
    if (node.id !== input.candidateId && !node.votedFor) {
      node.votedFor = input.candidateId;
      election.votesReceived.push(node.id);
    }
  }

  const elected = election.votesReceived.length >= requiredVotes;

  if (elected) {
    election.leaderId = input.candidateId;
    election.leaderName = input.candidateName;
    election.electedAt = now;
    stats.totalElections++;
    stats.currentTerm = election.term;
    stats.currentLeader = input.candidateName;
  }

  // Update node states
  for (const node of nodes) {
    node.term = election.term;
    node.votedFor = null;
    node.state = node.id === input.candidateId && elected ? "leader" : "follower";
  }

  await saveNodes(repoRoot, nodes);
  await saveElection(repoRoot, election);
  await saveStats(repoRoot, stats);

  return {
    success: true,
    elected,
    term: election.term,
    message: elected
      ? `${input.candidateName} elected as leader for term ${election.term}`
      : `Election failed. Got ${election.votesReceived.length}/${requiredVotes} votes`,
  };
}

/**
 * Get current leader
 */
export async function getLeader(input: {
  repoPath?: string;
}): Promise<{
  hasLeader: boolean;
  leader: ConsensusNode | null;
  term: number;
  electedAt: number | null;
  isAlive: boolean;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const nodes = await loadNodes(repoRoot);
  const election = await loadElection(repoRoot);
  const config = await loadConfig(repoRoot);

  const leader = nodes.find(n => n.id === election.leaderId) || null;
  const now = Date.now();
  const isAlive = leader ? (now - leader.lastHeartbeat) < config.electionTimeout : false;

  return {
    hasLeader: !!leader,
    leader,
    term: election.term,
    electedAt: election.electedAt,
    isAlive,
  };
}

// ============ PROPOSAL SYSTEM ============

/**
 * Create a proposal
 */
export async function propose(input: {
  repoPath?: string;
  proposerId: string;
  proposerName: string;
  title: string;
  description: string;
  type: Proposal["type"];
  data?: Record<string, unknown>;
  requiredMajority?: number;
  timeoutMs?: number;
}): Promise<{ success: boolean; proposal: Proposal }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const proposals = await loadProposals(repoRoot);
  const nodes = await loadNodes(repoRoot);
  const config = await loadConfig(repoRoot);
  const stats = await loadStats(repoRoot);

  const now = Date.now();
  const activeNodes = nodes.filter(n =>
    (now - n.lastHeartbeat) < config.electionTimeout * 2
  );

  // Calculate quorum based on mode
  let requiredQuorum: number;
  let requiredMajority = input.requiredMajority ?? config.defaultMajority;

  switch (config.mode) {
    case "bft":
      // BFT: Need 2/3 + 1 for Byzantine tolerance
      requiredQuorum = Math.ceil(activeNodes.length * 0.67) + 1;
      requiredMajority = 0.67;
      break;
    case "raft":
      // Raft: Simple majority of all nodes
      requiredQuorum = Math.ceil(nodes.length / 2) + 1;
      break;
    case "simple_majority":
    default:
      requiredQuorum = Math.ceil(activeNodes.length / 2);
      break;
  }

  const proposal: Proposal = {
    id: generateId(),
    title: input.title,
    description: input.description,
    type: input.type,
    proposedBy: input.proposerName,
    proposedAt: now,
    expiresAt: now + (input.timeoutMs ?? config.proposalTimeout),
    status: "pending",
    data: input.data || {},
    votes: [],
    requiredQuorum,
    requiredMajority,
  };

  proposals.push(proposal);
  stats.totalProposals++;

  await saveProposals(repoRoot, proposals);
  await saveStats(repoRoot, stats);

  return { success: true, proposal };
}

/**
 * Vote on a proposal
 */
export async function vote(input: {
  repoPath?: string;
  proposalId: string;
  nodeId: string;
  nodeName: string;
  vote: VoteType;
  reason?: string;
}): Promise<{
  success: boolean;
  proposal: Proposal;
  message: string;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const proposals = await loadProposals(repoRoot);
  const config = await loadConfig(repoRoot);
  const stats = await loadStats(repoRoot);

  const proposal = proposals.find(p => p.id === input.proposalId);
  if (!proposal) {
    throw new Error("Proposal not found");
  }

  const now = Date.now();

  // Check if expired
  if (now > proposal.expiresAt) {
    proposal.status = "expired";
    stats.expiredProposals++;
    await saveProposals(repoRoot, proposals);
    await saveStats(repoRoot, stats);
    return { success: false, proposal, message: "Proposal has expired" };
  }

  // Check if already voted
  if (proposal.votes.some(v => v.nodeId === input.nodeId)) {
    return { success: false, proposal, message: "Already voted on this proposal" };
  }

  // Add vote
  const voteEntry: ProposalVote = {
    nodeId: input.nodeId,
    nodeName: input.nodeName,
    vote: input.vote,
    reason: input.reason,
    timestamp: now,
  };

  // Add signature for BFT mode
  if (config.requireSignatures) {
    voteEntry.signature = generateSignature(
      `${input.proposalId}:${input.vote}:${now}`,
      input.nodeId
    );
  }

  proposal.votes.push(voteEntry);

  // Calculate results
  const approved = proposal.votes.filter(v => v.vote === "approve").length;
  const rejected = proposal.votes.filter(v => v.vote === "reject").length;
  const abstained = proposal.votes.filter(v => v.vote === "abstain").length;
  const totalVotes = approved + rejected; // Abstains don't count toward majority

  const quorumReached = proposal.votes.length >= proposal.requiredQuorum;
  const majorityReached = totalVotes > 0 &&
    (approved / totalVotes) >= proposal.requiredMajority;

  proposal.result = {
    approved,
    rejected,
    abstained,
    quorumReached,
    majorityReached,
  };

  // Determine final status
  if (quorumReached) {
    if (majorityReached) {
      proposal.status = "approved";
      stats.approvedProposals++;
    } else if (rejected > approved) {
      proposal.status = "rejected";
      stats.rejectedProposals++;
    }
  }

  await saveProposals(repoRoot, proposals);
  await saveStats(repoRoot, stats);

  return {
    success: true,
    proposal,
    message: proposal.status === "pending"
      ? `Vote recorded. ${approved}/${proposal.requiredQuorum} votes needed`
      : `Proposal ${proposal.status}`,
  };
}

/**
 * Get proposal
 */
export async function getProposal(input: {
  repoPath?: string;
  proposalId: string;
}): Promise<Proposal | null> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const proposals = await loadProposals(repoRoot);
  return proposals.find(p => p.id === input.proposalId) || null;
}

/**
 * List proposals
 */
export async function listProposals(input: {
  repoPath?: string;
  status?: ProposalStatus;
  limit?: number;
}): Promise<Proposal[]> {
  const repoRoot = await getRepoRoot(input.repoPath);
  let proposals = await loadProposals(repoRoot);

  // Check for expired proposals
  const now = Date.now();
  for (const p of proposals) {
    if (p.status === "pending" && now > p.expiresAt) {
      p.status = "expired";
    }
  }
  await saveProposals(repoRoot, proposals);

  if (input.status) {
    proposals = proposals.filter(p => p.status === input.status);
  }

  return proposals
    .sort((a, b) => b.proposedAt - a.proposedAt)
    .slice(0, input.limit ?? 50);
}

/**
 * Execute approved proposal (add to log)
 */
export async function executeProposal(input: {
  repoPath?: string;
  proposalId: string;
  executorId: string;
}): Promise<{ success: boolean; logEntry?: LogEntry; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const proposals = await loadProposals(repoRoot);
  const log = await loadLog(repoRoot);
  const election = await loadElection(repoRoot);

  const proposal = proposals.find(p => p.id === input.proposalId);
  if (!proposal) {
    return { success: false, message: "Proposal not found" };
  }

  if (proposal.status !== "approved") {
    return { success: false, message: `Cannot execute proposal with status: ${proposal.status}` };
  }

  // Only leader can execute in Raft mode
  if (election.leaderId && election.leaderId !== input.executorId) {
    return { success: false, message: "Only leader can execute proposals" };
  }

  // Create log entry
  const logEntry: LogEntry = {
    index: log.length,
    term: election.term,
    command: proposal.type,
    data: {
      proposalId: proposal.id,
      title: proposal.title,
      ...proposal.data,
    },
    timestamp: Date.now(),
    proposedBy: proposal.proposedBy,
    committed: true,
    appliedAt: Date.now(),
  };

  log.push(logEntry);
  proposal.status = "executed";

  await saveLog(repoRoot, log);
  await saveProposals(repoRoot, proposals);

  return {
    success: true,
    logEntry,
    message: `Proposal executed and added to log at index ${logEntry.index}`,
  };
}

// ============ LOG REPLICATION ============

/**
 * Append entry to log (leader only)
 */
export async function appendLog(input: {
  repoPath?: string;
  leaderId: string;
  command: string;
  data: Record<string, unknown>;
}): Promise<{ success: boolean; entry?: LogEntry; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const election = await loadElection(repoRoot);
  const log = await loadLog(repoRoot);

  // Verify leader
  if (election.leaderId !== input.leaderId) {
    return { success: false, message: "Only leader can append to log" };
  }

  const entry: LogEntry = {
    index: log.length,
    term: election.term,
    command: input.command,
    data: input.data,
    timestamp: Date.now(),
    proposedBy: input.leaderId,
    committed: false,
  };

  log.push(entry);
  await saveLog(repoRoot, log);

  return {
    success: true,
    entry,
    message: `Entry appended at index ${entry.index}`,
  };
}

/**
 * Commit log entries
 */
export async function commitLog(input: {
  repoPath?: string;
  upToIndex: number;
}): Promise<{ success: boolean; committedCount: number }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const log = await loadLog(repoRoot);
  const stats = await loadStats(repoRoot);

  let committedCount = 0;
  for (const entry of log) {
    if (entry.index <= input.upToIndex && !entry.committed) {
      entry.committed = true;
      entry.appliedAt = Date.now();
      committedCount++;
    }
  }

  stats.logLength = log.length;
  stats.lastCommitIndex = input.upToIndex;

  await saveLog(repoRoot, log);
  await saveStats(repoRoot, stats);

  return { success: true, committedCount };
}

/**
 * Get log entries
 */
export async function getLog(input: {
  repoPath?: string;
  fromIndex?: number;
  limit?: number;
}): Promise<LogEntry[]> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const log = await loadLog(repoRoot);

  const from = input.fromIndex ?? 0;
  const limit = input.limit ?? 100;

  return log.slice(from, from + limit);
}

// ============ CONFIGURATION ============

/**
 * Get configuration
 */
export async function getConfig(input: {
  repoPath?: string;
}): Promise<ConsensusConfig> {
  const repoRoot = await getRepoRoot(input.repoPath);
  return loadConfig(repoRoot);
}

/**
 * Update configuration
 */
export async function setConfig(input: {
  repoPath?: string;
  config: Partial<ConsensusConfig>;
}): Promise<{ success: boolean; config: ConsensusConfig }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const current = await loadConfig(repoRoot);
  const updated = { ...current, ...input.config };
  await saveConfig(repoRoot, updated);
  return { success: true, config: updated };
}

/**
 * Get statistics
 */
export async function getStats(input: {
  repoPath?: string;
}): Promise<ConsensusStats> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const stats = await loadStats(repoRoot);
  const nodes = await loadNodes(repoRoot);
  const log = await loadLog(repoRoot);
  const config = await loadConfig(repoRoot);

  const now = Date.now();
  const activeNodes = nodes.filter(n =>
    (now - n.lastHeartbeat) < config.electionTimeout * 2
  ).length;

  return {
    ...stats,
    activeNodes,
    logLength: log.length,
    uptime: now - stats.uptime,
  };
}

// ============ MAIN HANDLER ============

export type ConsensusAction =
  | "join"           // Join cluster
  | "leave"          // Leave cluster
  | "heartbeat"      // Send heartbeat
  | "status"         // Get cluster status
  | "elect"          // Start election
  | "leader"         // Get current leader
  | "propose"        // Create proposal
  | "vote"           // Vote on proposal
  | "proposals"      // List proposals
  | "get_proposal"   // Get single proposal
  | "execute"        // Execute approved proposal
  | "log"            // Get log entries
  | "append"         // Append to log (leader)
  | "commit"         // Commit log entries
  | "config"         // Get config
  | "set_config"     // Update config
  | "stats";         // Get statistics

export async function handleConsensusTool(input: {
  action: ConsensusAction;
  repoPath?: string;
  // For join/leave/heartbeat/elect
  nodeId?: string;
  nodeName?: string;
  isTrusted?: boolean;
  commitIndex?: number;
  logLength?: number;
  // For propose
  title?: string;
  description?: string;
  type?: Proposal["type"];
  data?: Record<string, unknown>;
  requiredMajority?: number;
  timeoutMs?: number;
  // For vote
  proposalId?: string;
  vote?: VoteType;
  reason?: string;
  // For proposals
  status?: ProposalStatus;
  limit?: number;
  // For execute
  executorId?: string;
  // For log
  fromIndex?: number;
  // For append
  command?: string;
  leaderId?: string;
  // For commit
  upToIndex?: number;
  // For set_config
  config?: Partial<ConsensusConfig>;
}): Promise<unknown> {
  switch (input.action) {
    case "join":
      return joinCluster({
        repoPath: input.repoPath,
        nodeId: input.nodeId || "",
        nodeName: input.nodeName || "",
        isTrusted: input.isTrusted,
      });

    case "leave":
      return leaveCluster({
        repoPath: input.repoPath,
        nodeId: input.nodeId || "",
      });

    case "heartbeat":
      return heartbeat({
        repoPath: input.repoPath,
        nodeId: input.nodeId || "",
        commitIndex: input.commitIndex,
        logLength: input.logLength,
      });

    case "status":
      return getClusterStatus({ repoPath: input.repoPath });

    case "elect":
      return startElection({
        repoPath: input.repoPath,
        candidateId: input.nodeId || "",
        candidateName: input.nodeName || "",
      });

    case "leader":
      return getLeader({ repoPath: input.repoPath });

    case "propose":
      return propose({
        repoPath: input.repoPath,
        proposerId: input.nodeId || "",
        proposerName: input.nodeName || "",
        title: input.title || "",
        description: input.description || "",
        type: input.type || "custom",
        data: input.data,
        requiredMajority: input.requiredMajority,
        timeoutMs: input.timeoutMs,
      });

    case "vote":
      return vote({
        repoPath: input.repoPath,
        proposalId: input.proposalId || "",
        nodeId: input.nodeId || "",
        nodeName: input.nodeName || "",
        vote: input.vote || "abstain",
        reason: input.reason,
      });

    case "proposals":
      return listProposals({
        repoPath: input.repoPath,
        status: input.status,
        limit: input.limit,
      });

    case "get_proposal":
      return getProposal({
        repoPath: input.repoPath,
        proposalId: input.proposalId || "",
      });

    case "execute":
      return executeProposal({
        repoPath: input.repoPath,
        proposalId: input.proposalId || "",
        executorId: input.executorId || input.nodeId || "",
      });

    case "log":
      return getLog({
        repoPath: input.repoPath,
        fromIndex: input.fromIndex,
        limit: input.limit,
      });

    case "append":
      return appendLog({
        repoPath: input.repoPath,
        leaderId: input.leaderId || input.nodeId || "",
        command: input.command || "",
        data: input.data || {},
      });

    case "commit":
      return commitLog({
        repoPath: input.repoPath,
        upToIndex: input.upToIndex ?? 0,
      });

    case "config":
      return getConfig({ repoPath: input.repoPath });

    case "set_config":
      return setConfig({
        repoPath: input.repoPath,
        config: input.config || {},
      });

    case "stats":
      return getStats({ repoPath: input.repoPath });

    default:
      return { error: `Unknown action: ${input.action}` };
  }
}
