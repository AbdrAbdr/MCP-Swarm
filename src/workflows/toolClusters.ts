import fs from "node:fs/promises";
import path from "node:path";

import { git } from "./git.js";
import { getRepoRoot } from "./repo.js";

/**
 * Tool Clusters: Group tools by categories for better organization
 * 
 * Instead of 130+ flat tools, organize them into logical clusters:
 * - agent: registration, health, specialization
 * - task: create, assign, status, decompose
 * - file: locks, forecast, conflicts
 * - git: worktree, PR, branch management
 * - collab: chat, review, advice
 * - safety: voting, preemption, snapshot
 * - quality: gate, regression, qa-loop
 * - debug: systematic debugging
 * - plan: brainstorm, writing plans, spec pipeline
 */

export type ToolCluster = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tools: string[];
  subClusters?: ToolCluster[];
  [key: string]: unknown;
};

export type ClusterConfig = {
  version: string;
  clusters: ToolCluster[];
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
};

// Default cluster configuration
const DEFAULT_CLUSTERS: ToolCluster[] = [
  {
    id: "agent",
    name: "Agent Management",
    description: "Register agents, check health, manage specialization",
    icon: "🤖",
    tools: [
      "agent_register",
      "agent_whoami",
      "check_agent_health",
      "get_dead_agents",
      "force_reassign_task",
      "get_swarm_health_summary",
      "record_agent_edit",
      "suggest_agent_advanced",
      "get_top_experts",
      "list_all_agent_expertise",
    ],
  },
  {
    id: "task",
    name: "Task Management",
    description: "Create, assign, and manage tasks",
    icon: "📋",
    tools: [
      "task_create",
      "task_list",
      "task_assign",
      "task_set_status",
      "task_mark_done",
      "task_cancel",
      "task_link",
      "decompose_task",
      "announce_task_for_bidding",
      "bid_for_task",
      "get_auction_winner",
    ],
  },
  {
    id: "file",
    name: "File Locking",
    description: "Manage file locks and prevent conflicts",
    icon: "🔒",
    tools: [
      "file_reserve",
      "file_release",
      "list_file_locks",
      "forecast_file_touches",
      "check_file_conflicts",
      "analyze_conflict_history",
      "get_conflict_hotspots",
      "check_file_safety",
      "record_conflict_event",
    ],
  },
  {
    id: "git",
    name: "Git & GitHub",
    description: "Worktrees, PRs, branch management",
    icon: "🌿",
    tools: [
      "worktree_create",
      "worktree_list",
      "worktree_remove",
      "sync_with_base_branch",
      "create_github_pr",
      "auto_delete_merged_branch",
      "check_main_health",
    ],
  },
  {
    id: "collab",
    name: "Collaboration",
    description: "Chat, reviews, knowledge sharing",
    icon: "💬",
    tools: [
      "broadcast_chat",
      "update_team_dashboard",
      "share_screenshot",
      "log_swarm_thought",
      "request_collective_advice",
      "provide_advice",
      "get_advice_responses",
      "request_cross_agent_review",
      "respond_to_review",
      "list_pending_reviews",
      "archive_finding",
      "search_knowledge",
    ],
  },
  {
    id: "safety",
    name: "Safety & Recovery",
    description: "Voting, snapshots, emergency controls",
    icon: "🛡️",
    tools: [
      "start_voting",
      "cast_vote",
      "list_open_votings",
      "get_voting_result",
      "create_snapshot",
      "trigger_rollback",
      "list_snapshots",
      "trigger_urgent_preemption",
      "report_ci_alert",
      "get_immune_status",
      "swarm_stop",
      "swarm_resume",
      "swarm_stop_status",
    ],
  },
  {
    id: "quality",
    name: "Quality Assurance",
    description: "Quality gates, regression detection, QA loops",
    icon: "✅",
    tools: [
      "run_quality_gate",
      "get_quality_report",
      "set_quality_threshold",
      "check_pr_ready",
      "save_baseline",
      "check_regression",
      "list_regressions",
      "resolve_regression",
      "list_baselines",
      "start_qa_loop",
      "run_qa_iteration",
      "log_qa_fix",
      "get_qa_loop",
      "list_qa_loops",
      "get_qa_fix_suggestions",
      "generate_qa_report",
    ],
  },
  {
    id: "debug",
    name: "Systematic Debugging",
    description: "4-phase debugging with root cause analysis",
    icon: "🔍",
    tools: [
      "start_debug_session",
      "log_investigation",
      "add_evidence",
      "complete_phase_1",
      "log_patterns",
      "complete_phase_2",
      "form_hypothesis",
      "test_hypothesis",
      "implement_fix",
      "verify_fix",
      "get_debug_session",
      "list_debug_sessions",
      "check_red_flags",
    ],
  },
  {
    id: "plan",
    name: "Planning & Design",
    description: "Brainstorming, implementation plans, spec pipelines",
    icon: "📝",
    tools: [
      "start_brainstorm",
      "ask_brainstorm_question",
      "answer_brainstorm_question",
      "propose_approaches",
      "present_design_section",
      "validate_design_section",
      "save_design_document",
      "get_brainstorm_session",
      "list_brainstorm_sessions",
      "create_implementation_plan",
      "add_plan_task",
      "get_next_task",
      "start_plan_task",
      "complete_step",
      "complete_plan_task",
      "generate_subagent_prompt",
      "export_plan_as_markdown",
      "get_plan_status",
      "list_plans",
      "mark_plan_ready",
      "start_spec_pipeline",
      "start_spec_phase",
      "complete_spec_phase",
      "get_spec_pipeline",
      "list_spec_pipelines",
      "export_spec_as_markdown",
    ],
  },
  {
    id: "hooks",
    name: "Guard Hooks",
    description: "Pre-commit and pre-push safety hooks",
    icon: "🪝",
    tools: [
      "install_guard_hooks",
      "uninstall_guard_hooks",
      "run_guard_hooks",
      "get_guard_config",
      "update_guard_hook",
      "list_guard_hooks",
    ],
  },
  {
    id: "session",
    name: "Session Recording",
    description: "Record and replay agent sessions",
    icon: "🎬",
    tools: [
      "start_session_recording",
      "log_session_action",
      "stop_session_recording",
      "list_session_recordings",
      "replay_session",
    ],
  },
  {
    id: "cost",
    name: "Cost & Context",
    description: "Track API costs and compress context",
    icon: "💰",
    tools: [
      "log_api_usage",
      "get_agent_costs",
      "get_project_costs",
      "set_budget_limit",
      "check_budget_remaining",
      "estimate_context_size",
      "compress_briefing",
      "compress_multiple_briefings",
      "get_compression_stats",
    ],
  },
  {
    id: "docs",
    name: "Documentation",
    description: "Auto-generate documentation",
    icon: "📚",
    tools: [
      "generate_task_docs",
      "list_task_docs",
      "get_task_doc",
      "generate_timeline",
      "get_timeline_visualization",
    ],
  },
];

async function loadClusterConfig(repoRoot: string): Promise<ClusterConfig | null> {
  const configPath = path.join(repoRoot, "orchestrator", "tool-clusters.json");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveClusterConfig(repoRoot: string, config: ClusterConfig, commitMode: "none" | "local" | "push"): Promise<void> {
  const dir = path.join(repoRoot, "orchestrator");
  await fs.mkdir(dir, { recursive: true });
  
  const configPath = path.join(dir, "tool-clusters.json");
  config.updatedAt = Date.now();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  
  if (commitMode !== "none") {
    await git(["add", "orchestrator/tool-clusters.json"], { cwd: repoRoot });
    await git(["commit", "-m", "orchestrator: update tool clusters"], { cwd: repoRoot });
    if (commitMode === "push") {
      try {
        await git(["push"], { cwd: repoRoot });
      } catch {
        await git(["push", "-u", "origin", "HEAD"], { cwd: repoRoot });
      }
    }
  }
}

// ==================== TOOL FUNCTIONS ====================

/**
 * Initialize tool clusters with default configuration
 */
export async function initToolClusters(input: {
  repoPath?: string;
  commitMode: "none" | "local" | "push";
}): Promise<{ success: boolean; clusters: number; message: string }> {
  const repoRoot = input.repoPath || process.cwd();
  
  const config: ClusterConfig = {
    version: "1.0.0",
    clusters: DEFAULT_CLUSTERS,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  await saveClusterConfig(repoRoot, config, input.commitMode);
  
  return {
    success: true,
    clusters: DEFAULT_CLUSTERS.length,
    message: `Initialized ${DEFAULT_CLUSTERS.length} tool clusters`,
  };
}

/**
 * List all tool clusters
 */
export async function listToolClusters(input: {
  repoPath?: string;
}): Promise<{ clusters: Array<{ id: string; name: string; icon: string; toolCount: number }> }> {
  const repoRoot = input.repoPath || process.cwd();
  let config = await loadClusterConfig(repoRoot);
  
  if (!config) {
    // Return default clusters if not configured
    config = { version: "1.0.0", clusters: DEFAULT_CLUSTERS, createdAt: 0, updatedAt: 0 };
  }
  
  return {
    clusters: config.clusters.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      toolCount: c.tools.length,
    })),
  };
}

/**
 * Get tools in a specific cluster
 */
export async function getClusterTools(input: {
  repoPath?: string;
  clusterId: string;
}): Promise<{ cluster: ToolCluster | null }> {
  const repoRoot = input.repoPath || process.cwd();
  let config = await loadClusterConfig(repoRoot);
  
  if (!config) {
    config = { version: "1.0.0", clusters: DEFAULT_CLUSTERS, createdAt: 0, updatedAt: 0 };
  }
  
  const cluster = config.clusters.find(c => c.id === input.clusterId);
  return { cluster: cluster || null };
}

/**
 * Search for a tool across all clusters
 */
export async function findToolCluster(input: {
  repoPath?: string;
  toolName: string;
}): Promise<{ clusterId: string | null; clusterName: string | null }> {
  const repoRoot = input.repoPath || process.cwd();
  let config = await loadClusterConfig(repoRoot);
  
  if (!config) {
    config = { version: "1.0.0", clusters: DEFAULT_CLUSTERS, createdAt: 0, updatedAt: 0 };
  }
  
  for (const cluster of config.clusters) {
    if (cluster.tools.includes(input.toolName)) {
      return { clusterId: cluster.id, clusterName: cluster.name };
    }
  }
  
  return { clusterId: null, clusterName: null };
}

/**
 * Add a tool to a cluster
 */
export async function addToolToCluster(input: {
  repoPath?: string;
  clusterId: string;
  toolName: string;
  commitMode: "none" | "local" | "push";
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = input.repoPath || process.cwd();
  let config = await loadClusterConfig(repoRoot);
  
  if (!config) {
    config = { version: "1.0.0", clusters: DEFAULT_CLUSTERS, createdAt: Date.now(), updatedAt: Date.now() };
  }
  
  const clusterIndex = config.clusters.findIndex(c => c.id === input.clusterId);
  if (clusterIndex === -1) {
    return { success: false, message: `Cluster ${input.clusterId} not found` };
  }
  
  if (config.clusters[clusterIndex].tools.includes(input.toolName)) {
    return { success: false, message: `Tool ${input.toolName} already in cluster ${input.clusterId}` };
  }
  
  config.clusters[clusterIndex].tools.push(input.toolName);
  await saveClusterConfig(repoRoot, config, input.commitMode);
  
  return { success: true, message: `Added ${input.toolName} to cluster ${input.clusterId}` };
}

/**
 * Create a new cluster
 */
export async function createToolCluster(input: {
  repoPath?: string;
  id: string;
  name: string;
  description: string;
  icon: string;
  tools?: string[];
  commitMode: "none" | "local" | "push";
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = input.repoPath || process.cwd();
  let config = await loadClusterConfig(repoRoot);
  
  if (!config) {
    config = { version: "1.0.0", clusters: DEFAULT_CLUSTERS, createdAt: Date.now(), updatedAt: Date.now() };
  }
  
  if (config.clusters.find(c => c.id === input.id)) {
    return { success: false, message: `Cluster ${input.id} already exists` };
  }
  
  const newCluster: ToolCluster = {
    id: input.id,
    name: input.name,
    description: input.description,
    icon: input.icon,
    tools: input.tools || [],
  };
  
  config.clusters.push(newCluster);
  await saveClusterConfig(repoRoot, config, input.commitMode);
  
  return { success: true, message: `Created cluster ${input.id}` };
}

/**
 * Get cluster summary with all tools organized by category
 */
export async function getToolClusterSummary(input: {
  repoPath?: string;
}): Promise<{ summary: string; totalTools: number; totalClusters: number }> {
  const repoRoot = input.repoPath || process.cwd();
  let config = await loadClusterConfig(repoRoot);
  
  if (!config) {
    config = { version: "1.0.0", clusters: DEFAULT_CLUSTERS, createdAt: 0, updatedAt: 0 };
  }
  
  let totalTools = 0;
  let summary = "# Tool Clusters\n\n";
  
  for (const cluster of config.clusters) {
    totalTools += cluster.tools.length;
    summary += `## ${cluster.icon} ${cluster.name} (${cluster.tools.length})\n`;
    summary += `${cluster.description}\n\n`;
    summary += cluster.tools.map(t => `- \`${t}\``).join("\n");
    summary += "\n\n";
  }
  
  return {
    summary,
    totalTools,
    totalClusters: config.clusters.length,
  };
}
