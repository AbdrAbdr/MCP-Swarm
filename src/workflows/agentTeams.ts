/**
 * Agent Teams — Multi-Agent Coordination
 * 
 * MCP Swarm v0.9.19
 * 
 * Inspired by Claude Opus 4.6 agent_teams capability.
 * Enables structured team formation, shared context,
 * role-based task distribution, and consensus mechanisms.
 * 
 * Features:
 * - Team creation with defined roles (lead, developer, reviewer, tester)
 * - Shared memory/context pool per team
 * - Task delegation and claim system
 * - Team-level messaging (broadcast within team)
 * - Auto-balancing: redistribute tasks if agent goes offline
 * - RAC Integration: vector search for code context injection
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

type TeamRole = "lead" | "developer" | "reviewer" | "tester" | "specialist";

interface TeamMember {
    agentId: string;
    role: TeamRole;
    joinedAt: number;
    lastSeen: number;
    status: "active" | "idle" | "offline";
    tasksClaimed: number;
    tasksCompleted: number;
}

interface Team {
    id: string;
    name: string;
    description: string;
    createdAt: number;
    createdBy: string;
    members: TeamMember[];
    sharedContext: string[];    // Paths to shared context files
    activeTaskIds: string[];
    completedTaskIds: string[];
    config: TeamConfig;
}

interface TeamConfig {
    maxMembers: number;
    autoRebalance: boolean;
    offlineThresholdMs: number;  // Mark agent offline after N ms
    requireReview: boolean;      // Require peer review before task completion
    consensusMode: "majority" | "unanimous" | "lead-approves";
}

interface TeamTask {
    id: string;
    teamId: string;
    title: string;
    description: string;
    assignedTo?: string;
    status: "open" | "claimed" | "in_progress" | "review" | "done";
    createdAt: number;
    claimedAt?: number;
    completedAt?: number;
    files: string[];
    priority: "low" | "normal" | "high" | "critical";
    dependencies: string[];
}

interface TeamMessage {
    id: string;
    teamId: string;
    from: string;
    content: string;
    timestamp: number;
    type: "broadcast" | "direct" | "system";
}

interface RacContext {
    query: string;
    results: Array<{
        path: string;
        snippet: string;
        similarity: number;
    }>;
    timestamp: number;
}

interface TeamsStats {
    totalTeams: number;
    totalMembers: number;
    tasksDistributed: number;
    tasksCompleted: number;
    avgCompletionTime: number;
    rebalanceCount: number;
}

// ============ CONSTANTS ============

const TEAMS_DIR = "agent-teams";
const TEAMS_FILE = "teams.json";
const TASKS_FILE = "team-tasks.json";
const MESSAGES_FILE = "team-messages.json";
const RAC_DIR = "rac-cache";
const STATS_FILE = "teams-stats.json";

const DEFAULT_TEAM_CONFIG: TeamConfig = {
    maxMembers: 8,
    autoRebalance: true,
    offlineThresholdMs: 5 * 60 * 1000, // 5 min
    requireReview: true,
    consensusMode: "lead-approves",
};

// ============ STORAGE ============

async function getTeamsDir(repoPath: string): Promise<string> {
    const root = await getRepoRoot(repoPath);
    const dir = path.join(root, ".swarm", TEAMS_DIR);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

async function loadTeams(repoPath: string): Promise<Team[]> {
    const dir = await getTeamsDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, TEAMS_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function saveTeams(repoPath: string, teams: Team[]): Promise<void> {
    const dir = await getTeamsDir(repoPath);
    await fs.writeFile(path.join(dir, TEAMS_FILE), JSON.stringify(teams, null, 2), "utf-8");
}

async function loadTeamTasks(repoPath: string): Promise<TeamTask[]> {
    const dir = await getTeamsDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, TASKS_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function saveTeamTasks(repoPath: string, tasks: TeamTask[]): Promise<void> {
    const dir = await getTeamsDir(repoPath);
    await fs.writeFile(path.join(dir, TASKS_FILE), JSON.stringify(tasks, null, 2), "utf-8");
}

async function loadMessages(repoPath: string): Promise<TeamMessage[]> {
    const dir = await getTeamsDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, MESSAGES_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function saveMessages(repoPath: string, msgs: TeamMessage[]): Promise<void> {
    const dir = await getTeamsDir(repoPath);
    await fs.writeFile(path.join(dir, MESSAGES_FILE), JSON.stringify(msgs, null, 2), "utf-8");
}

async function loadStats(repoPath: string): Promise<TeamsStats> {
    const dir = await getTeamsDir(repoPath);
    try {
        const raw = await fs.readFile(path.join(dir, STATS_FILE), "utf-8");
        return JSON.parse(raw);
    } catch {
        return {
            totalTeams: 0, totalMembers: 0, tasksDistributed: 0,
            tasksCompleted: 0, avgCompletionTime: 0, rebalanceCount: 0,
        };
    }
}

async function saveStats(repoPath: string, stats: TeamsStats): Promise<void> {
    const dir = await getTeamsDir(repoPath);
    await fs.writeFile(path.join(dir, STATS_FILE), JSON.stringify(stats, null, 2), "utf-8");
}

// ============ TEAM OPERATIONS ============

async function createTeam(
    repoPath: string,
    name: string,
    description: string,
    createdBy: string,
    config?: Partial<TeamConfig>
): Promise<Team> {
    const teams = await loadTeams(repoPath);

    const team: Team = {
        id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        description,
        createdAt: Date.now(),
        createdBy,
        members: [{
            agentId: createdBy,
            role: "lead",
            joinedAt: Date.now(),
            lastSeen: Date.now(),
            status: "active",
            tasksClaimed: 0,
            tasksCompleted: 0,
        }],
        sharedContext: [],
        activeTaskIds: [],
        completedTaskIds: [],
        config: { ...DEFAULT_TEAM_CONFIG, ...config },
    };

    teams.push(team);
    await saveTeams(repoPath, teams);
    return team;
}

async function joinTeam(
    repoPath: string,
    teamId: string,
    agentId: string,
    role: TeamRole = "developer"
): Promise<{ joined: boolean; team?: Team; error?: string }> {
    const teams = await loadTeams(repoPath);
    const team = teams.find(t => t.id === teamId);

    if (!team) return { joined: false, error: "Team not found" };
    if (team.members.length >= team.config.maxMembers) {
        return { joined: false, error: `Team full (max ${team.config.maxMembers})` };
    }
    if (team.members.some(m => m.agentId === agentId)) {
        return { joined: false, error: "Already a member" };
    }

    team.members.push({
        agentId,
        role,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        status: "active",
        tasksClaimed: 0,
        tasksCompleted: 0,
    });

    await saveTeams(repoPath, teams);
    return { joined: true, team };
}

async function heartbeat(
    repoPath: string,
    teamId: string,
    agentId: string,
    status?: "active" | "idle"
): Promise<void> {
    const teams = await loadTeams(repoPath);
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const member = team.members.find(m => m.agentId === agentId);
    if (member) {
        member.lastSeen = Date.now();
        if (status) member.status = status;
    }
    await saveTeams(repoPath, teams);
}

/**
 * Auto-rebalance: find offline agents and redistribute their tasks
 */
async function rebalance(repoPath: string, teamId: string): Promise<{
    offlineAgents: string[];
    reassignedTasks: number;
}> {
    const teams = await loadTeams(repoPath);
    const team = teams.find(t => t.id === teamId);
    if (!team) return { offlineAgents: [], reassignedTasks: 0 };

    const now = Date.now();
    const offlineAgents: string[] = [];

    // Mark offline agents
    for (const member of team.members) {
        if (now - member.lastSeen > team.config.offlineThresholdMs && member.status !== "offline") {
            member.status = "offline";
            offlineAgents.push(member.agentId);
        }
    }

    if (offlineAgents.length === 0) {
        await saveTeams(repoPath, teams);
        return { offlineAgents: [], reassignedTasks: 0 };
    }

    // Reassign tasks from offline agents
    const tasks = await loadTeamTasks(repoPath);
    const teamTasks = tasks.filter(t =>
        t.teamId === teamId &&
        t.assignedTo &&
        offlineAgents.includes(t.assignedTo) &&
        t.status !== "done"
    );

    const activeMembers = team.members.filter(m => m.status === "active");
    let reassigned = 0;

    for (const task of teamTasks) {
        if (activeMembers.length === 0) break;
        // Round-robin assignment among active members
        const target = activeMembers[reassigned % activeMembers.length];
        task.assignedTo = target.agentId;
        task.status = "open";
        target.tasksClaimed++;
        reassigned++;
    }

    await saveTeams(repoPath, teams);
    await saveTeamTasks(repoPath, tasks);

    const stats = await loadStats(repoPath);
    stats.rebalanceCount++;
    await saveStats(repoPath, stats);

    return { offlineAgents, reassignedTasks: reassigned };
}

// ============ TASK DELEGATION ============

async function delegateTask(
    repoPath: string,
    teamId: string,
    title: string,
    description: string,
    files: string[] = [],
    priority: TeamTask["priority"] = "normal",
    dependencies: string[] = []
): Promise<TeamTask> {
    const tasks = await loadTeamTasks(repoPath);

    const task: TeamTask = {
        id: `ttask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        teamId,
        title,
        description,
        status: "open",
        createdAt: Date.now(),
        files,
        priority,
        dependencies,
    };

    tasks.push(task);
    await saveTeamTasks(repoPath, tasks);

    // Update team
    const teams = await loadTeams(repoPath);
    const team = teams.find(t => t.id === teamId);
    if (team) {
        team.activeTaskIds.push(task.id);
        await saveTeams(repoPath, teams);
    }

    return task;
}

async function claimTask(
    repoPath: string,
    taskId: string,
    agentId: string
): Promise<{ claimed: boolean; task?: TeamTask; error?: string }> {
    const tasks = await loadTeamTasks(repoPath);
    const task = tasks.find(t => t.id === taskId);

    if (!task) return { claimed: false, error: "Task not found" };
    if (task.assignedTo) return { claimed: false, error: `Already claimed by ${task.assignedTo}` };
    if (task.status !== "open") return { claimed: false, error: `Task status: ${task.status}` };

    // Check dependencies
    if (task.dependencies.length > 0) {
        const depTasks = tasks.filter(t => task.dependencies.includes(t.id));
        const unfinished = depTasks.filter(t => t.status !== "done");
        if (unfinished.length > 0) {
            return { claimed: false, error: `Blocked by: ${unfinished.map(t => t.id).join(", ")}` };
        }
    }

    task.assignedTo = agentId;
    task.status = "claimed";
    task.claimedAt = Date.now();
    await saveTeamTasks(repoPath, tasks);

    return { claimed: true, task };
}

async function completeTask(
    repoPath: string,
    taskId: string,
    agentId: string
): Promise<{ completed: boolean; requiresReview: boolean }> {
    const tasks = await loadTeamTasks(repoPath);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { completed: false, requiresReview: false };

    const teams = await loadTeams(repoPath);
    const team = teams.find(t => t.id === task.teamId);

    if (team?.config.requireReview) {
        task.status = "review";
        await saveTeamTasks(repoPath, tasks);
        return { completed: false, requiresReview: true };
    }

    task.status = "done";
    task.completedAt = Date.now();
    await saveTeamTasks(repoPath, tasks);

    // Move to completed in team
    if (team) {
        team.activeTaskIds = team.activeTaskIds.filter(id => id !== taskId);
        team.completedTaskIds.push(taskId);
        const member = team.members.find(m => m.agentId === agentId);
        if (member) member.tasksCompleted++;
        await saveTeams(repoPath, teams);
    }

    return { completed: true, requiresReview: false };
}

// ============ RAC INTEGRATION ============

/**
 * RAC (Retrieval Augmented Coding) — vector search placeholder
 * In full implementation, uses HNSW/FAISS for code embeddings
 */
async function racSearch(
    repoPath: string,
    query: string,
    _topK: number = 5
): Promise<RacContext> {
    // Placeholder: real implementation would use vector store
    const root = await getRepoRoot(repoPath);
    const racDir = path.join(root, ".swarm", TEAMS_DIR, RAC_DIR);
    await fs.mkdir(racDir, { recursive: true });

    return {
        query,
        results: [],
        timestamp: Date.now(),
    };
}

// ============ MESSAGING ============

async function broadcastToTeam(
    repoPath: string,
    teamId: string,
    from: string,
    content: string
): Promise<TeamMessage> {
    const msgs = await loadMessages(repoPath);

    const msg: TeamMessage = {
        id: `tmsg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        teamId,
        from,
        content,
        timestamp: Date.now(),
        type: "broadcast",
    };

    msgs.push(msg);
    // Keep last 200 messages per team
    const teamMsgs = msgs.filter(m => m.teamId === teamId);
    if (teamMsgs.length > 200) {
        const toRemove = teamMsgs.slice(0, teamMsgs.length - 200);
        const removeIds = new Set(toRemove.map(m => m.id));
        const filtered = msgs.filter(m => !(m.teamId === teamId && removeIds.has(m.id)));
        await saveMessages(repoPath, filtered);
    } else {
        await saveMessages(repoPath, msgs);
    }

    return msg;
}

// ============ MAIN HANDLER ============

export type AgentTeamsAction =
    | "create_team"
    | "join_team"
    | "leave_team"
    | "list_teams"
    | "team_info"
    | "heartbeat"
    | "rebalance"
    | "delegate_task"
    | "claim_task"
    | "complete_task"
    | "list_tasks"
    | "broadcast"
    | "messages"
    | "rac_search"
    | "stats";

export async function handleAgentTeams(input: {
    action: AgentTeamsAction;
    repoPath?: string;
    // Common
    teamId?: string;
    agentId?: string;
    // For create_team
    name?: string;
    description?: string;
    config?: Partial<TeamConfig>;
    // For join_team
    role?: TeamRole;
    // For delegate_task
    title?: string;
    taskDescription?: string;
    files?: string[];
    priority?: TeamTask["priority"];
    dependencies?: string[];
    // For claim_task, complete_task
    taskId?: string;
    // For broadcast
    message?: string;
    // For rac_search
    query?: string;
    topK?: number;
    // For heartbeat
    status?: "active" | "idle";
}): Promise<unknown> {
    const repoPath = input.repoPath || process.cwd();

    switch (input.action) {
        case "create_team": {
            if (!input.name || !input.agentId) return { error: "name and agentId required" };
            const team = await createTeam(
                repoPath, input.name, input.description || "", input.agentId, input.config
            );
            return { created: true, team };
        }

        case "join_team": {
            if (!input.teamId || !input.agentId) return { error: "teamId and agentId required" };
            return joinTeam(repoPath, input.teamId, input.agentId, input.role);
        }

        case "leave_team": {
            if (!input.teamId || !input.agentId) return { error: "teamId and agentId required" };
            const teams = await loadTeams(repoPath);
            const team = teams.find(t => t.id === input.teamId);
            if (!team) return { error: "Team not found" };
            team.members = team.members.filter(m => m.agentId !== input.agentId);
            await saveTeams(repoPath, teams);
            return { left: true };
        }

        case "list_teams": {
            const teams = await loadTeams(repoPath);
            return {
                teams: teams.map(t => ({
                    id: t.id,
                    name: t.name,
                    members: t.members.length,
                    activeTasks: t.activeTaskIds.length,
                    completedTasks: t.completedTaskIds.length,
                })),
            };
        }

        case "team_info": {
            if (!input.teamId) return { error: "teamId required" };
            const teams = await loadTeams(repoPath);
            const team = teams.find(t => t.id === input.teamId);
            return team || { error: "Team not found" };
        }

        case "heartbeat": {
            if (!input.teamId || !input.agentId) return { error: "teamId and agentId required" };
            await heartbeat(repoPath, input.teamId, input.agentId, input.status);
            return { ok: true };
        }

        case "rebalance": {
            if (!input.teamId) return { error: "teamId required" };
            return rebalance(repoPath, input.teamId);
        }

        case "delegate_task": {
            if (!input.teamId || !input.title) return { error: "teamId and title required" };
            return delegateTask(
                repoPath, input.teamId, input.title,
                input.taskDescription || "", input.files, input.priority, input.dependencies
            );
        }

        case "claim_task": {
            if (!input.taskId || !input.agentId) return { error: "taskId and agentId required" };
            return claimTask(repoPath, input.taskId, input.agentId);
        }

        case "complete_task": {
            if (!input.taskId || !input.agentId) return { error: "taskId and agentId required" };
            return completeTask(repoPath, input.taskId, input.agentId);
        }

        case "list_tasks": {
            const tasks = await loadTeamTasks(repoPath);
            return input.teamId
                ? tasks.filter(t => t.teamId === input.teamId)
                : tasks;
        }

        case "broadcast": {
            if (!input.teamId || !input.agentId || !input.message) {
                return { error: "teamId, agentId, message required" };
            }
            return broadcastToTeam(repoPath, input.teamId, input.agentId, input.message);
        }

        case "messages": {
            const msgs = await loadMessages(repoPath);
            return input.teamId
                ? msgs.filter(m => m.teamId === input.teamId).slice(-50)
                : msgs.slice(-50);
        }

        case "rac_search": {
            if (!input.query) return { error: "query required" };
            return racSearch(repoPath, input.query, input.topK);
        }

        case "stats": {
            return loadStats(repoPath);
        }

        default:
            return { error: `Unknown action: ${input.action}` };
    }
}
