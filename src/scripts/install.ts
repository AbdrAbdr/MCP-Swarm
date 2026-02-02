#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Agent rules content for each IDE - v0.9.0 Smart Tools
const AGENT_RULES_CONTENT = `# MCP Swarm Agent Rules (v0.9.0)

## CRITICAL: Always Start with MCP Swarm

Before ANY coding task, you MUST:

1. **Register yourself** - Call \`swarm_agent({ action: "register" })\` to get your unique agent name
2. **Check swarm status** - Call \`swarm_control({ action: "status" })\` to ensure swarm is active
3. **Check task list** - Call \`swarm_task({ action: "list" })\` to see available tasks
4. **Reserve files** - Before editing, call \`swarm_file({ action: "reserve", filePath: "...", agent: "YourName" })\`

## Agent Roles

### ORCHESTRATOR (First Agent)
The first agent that calls \`swarm_orchestrator({ action: "elect" })\` becomes the Orchestrator.
- Works in **INFINITE LOOP** - only user can stop
- Distributes tasks, monitors agent heartbeats, coordinates work
- Uses \`swarm_control({ action: "pulse" })\` to update real-time agent map

### EXECUTOR (All Other Agents)
All subsequent agents become Executors.
- Register with \`swarm_agent({ action: "register" })\`
- Get tasks via auction system
- Lock files before editing, send heartbeat, create PRs

## Workflow Rules

### Starting Work
\`\`\`
1. swarm_agent({ action: "register" }) → Get your name (e.g., "RadiantWolf")
2. swarm_task({ action: "list" }) → See what needs to be done
3. swarm_task({ action: "update", taskId, status: "in_progress", agent: "YourName" }) → Claim task
4. swarm_file({ action: "reserve", filePath: "...", agent: "YourName", exclusive: true }) → Lock files
5. Do your work
6. swarm_file({ action: "release", filePath: "...", agent: "YourName" }) → Unlock files
7. swarm_task({ action: "update", taskId, status: "done" }) → Complete task
8. swarm_git({ action: "sync" }) → Rebase before push
9. swarm_git({ action: "pr", title: "...", body: "..." }) → Open PR
\`\`\`

### Collaboration Rules
- **Never edit files locked by another agent** - Check \`swarm_file({ action: "list" })\` first
- **Broadcast important changes** - Use \`swarm_collab({ action: "broadcast", message: "..." })\`
- **Request reviews** - Use \`swarm_collab({ action: "review_request", ... })\`
- **Log your reasoning** - Use \`swarm_collab({ action: "thought", text: "..." })\`

### Safety Rules
- **Dangerous actions require voting** - Use \`swarm_voting({ action: "start", ... })\`
- **Check main health** - Use \`swarm_safety({ action: "main_health" })\`
- **Signal dependency changes** - Use \`swarm_safety({ action: "dependency_change", ... })\`

### Ghost Mode
When no tasks are assigned:
- Run \`swarm_patrol({ action: "run" })\` to check for lint errors
- Help review other agents' code
- Optimize imports and formatting

## 41 Smart Tools (v0.9.0)

| Tool | Actions |
|------|---------|
| swarm_agent | register, whoami |
| swarm_task | create, list, update, decompose, get_decomposition |
| swarm_file | reserve, release, list, forecast, conflicts, safety |
| swarm_worktree | create, list, remove |
| swarm_git | sync, pr, delete_merged, cleanup_merged |
| swarm_collab | broadcast, dashboard, review_request, review_respond, review_list, screenshot, screenshot_list, thought, thought_list |
| swarm_voting | start, vote, list |
| swarm_safety | main_health, ci_alert, immune_status, dependency_change |
| swarm_control | start, stop, status, pulse, pulse_get |
| swarm_briefing | save, load |
| swarm_knowledge | archive, search |
| swarm_urgent | trigger, get_active |
| swarm_snapshot | create, rollback |
| swarm_health | check, dead_agents, force_reassign |
| swarm_session | start, log, stop, replay |
| swarm_quality | run_gate, get_report, check_pr_ready |
| swarm_cost | log_usage, agent_costs, project_costs, budget_remaining |
| swarm_context | estimate_size, compress_briefing |
| swarm_regression | save_baseline, check, list |
| swarm_brainstorm | start, question, answer |
| swarm_design | propose, present, validate |
| swarm_plan | create, add_task, get_next, complete_step, subagent_prompt, export_markdown |
| swarm_debug | start, log_investigation, add_evidence, complete_phase1, log_patterns, complete_phase2, form_hypothesis, test_hypothesis, implement_fix, verify_fix, check_red_flags |
| swarm_spec | start, start_phase, complete_phase, export_markdown |
| swarm_qa | start, run_iteration, log_fix, get_suggestions, generate_report |
| swarm_guard | install, uninstall, run, get_config |
| swarm_cluster | init, list, get_tools, find |
| swarm_orchestrator | elect, status, dispatch_task, collect_results |
| swarm_message | send, inbox, ack, history |
| swarm_patrol | run |
| swarm_scan | run |
| swarm_platform | check |

## Quick Reference

### Core Operations
\`\`\`typescript
swarm_agent({ action: "register" })                    // Get agent name
swarm_task({ action: "list" })                         // List all tasks
swarm_file({ action: "reserve", filePath, agent })     // Lock file
swarm_git({ action: "pr", title, body })               // Create PR
\`\`\`

### Orchestrator Operations
\`\`\`typescript
swarm_orchestrator({ action: "elect" })                // Become orchestrator
swarm_orchestrator({ action: "dispatch_task", ... })   // Assign task to agent
swarm_control({ action: "pulse" })                     // Update agent map
\`\`\`
`;

// All supported IDEs and their rules files
const IDE_RULES_FILES = [
  { name: "Claude Desktop / Claude Code", file: "CLAUDE.md" },
  { name: "Antigravity", file: "GEMINI.md" },
  { name: "OpenCode", file: "AGENT.md" },
  { name: "Cursor", file: ".cursorrules" },
  { name: "Windsurf", file: ".windsurfrules" },
  { name: "VS Code (Roo-Cline)", file: ".clinerules" },
];

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function installAgentRules(fileName: string, projectPath: string): Promise<boolean> {
  const rulesPath = path.join(projectPath, fileName);
  
  // Check if file exists and has content
  let existingContent = "";
  try {
    existingContent = await fs.readFile(rulesPath, "utf8");
  } catch {
    // file doesn't exist
  }

  // Check if MCP Swarm rules already present
  if (existingContent.includes("# MCP Swarm Agent Rules")) {
    return false; // already installed
  }

  // Append or create
  const newContent = existingContent 
    ? existingContent + "\n\n" + AGENT_RULES_CONTENT
    : AGENT_RULES_CONTENT;

  await fs.writeFile(rulesPath, newContent, "utf8");
  return true;
}

function getMcpConfig(projectPath: string): string {
  const normalizedPath = path.normalize(projectPath).replace(/\\/g, "/");
  const serverPath = path.join(normalizedPath, "dist", "serverSmart.js").replace(/\\/g, "/");

  return JSON.stringify({
    "mcp-swarm": {
      command: "node",
      args: [serverPath],
      env: {
        SWARM_REPO_PATH: normalizedPath,
      },
    },
  }, null, 2);
}

async function main() {
  console.log("🐝 MCP Swarm v0.9.0 - Agent Rules Installer");
  console.log("=".repeat(50));

  // Get project path
  const projectPath = path.resolve(process.cwd());
  console.log(`📁 Project path: ${projectPath}`);

  // Check if built
  const serverPath = path.join(projectPath, "dist", "serverSmart.js");
  if (!(await fileExists(serverPath))) {
    console.log("⚠️  Server not built. Running npm run build...");
    try {
      await execFileAsync("npm", ["run", "build"], { cwd: projectPath, windowsHide: true });
      console.log("✅ Build completed");
    } catch (err: any) {
      console.error("❌ Build error:", err?.message);
      process.exit(1);
    }
  }

  // Install agent rules for all IDEs
  console.log("\n📜 Installing agent rules files...");
  const installed: string[] = [];
  const skipped: string[] = [];

  for (const ide of IDE_RULES_FILES) {
    try {
      const wasInstalled = await installAgentRules(ide.file, projectPath);
      if (wasInstalled) {
        installed.push(ide.file);
        console.log(`   ✅ ${ide.file} - created (${ide.name})`);
      } else {
        skipped.push(ide.file);
        console.log(`   ⏭️  ${ide.file} - already has MCP Swarm rules`);
      }
    } catch (err: any) {
      console.log(`   ❌ ${ide.file}: ${err?.message}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("🎉 Agent rules installation complete!");
  console.log(`   Created: ${installed.length} files`);
  console.log(`   Skipped: ${skipped.length} files (already configured)`);

  // Show manual MCP installation instructions
  console.log("\n" + "=".repeat(50));
  console.log("📦 MANUAL MCP SERVER INSTALLATION");
  console.log("=".repeat(50));
  console.log("\nAdd this to your IDE's MCP config file:\n");
  console.log(getMcpConfig(projectPath));

  console.log("\n📍 Config file locations:");
  console.log("   Claude Desktop: %APPDATA%\\Claude\\claude_desktop_config.json");
  console.log("   Cursor:         ~/.cursor/mcp.json");
  console.log("   Windsurf:       ~/.windsurf/mcp_config.json");
  console.log("   Antigravity:    %APPDATA%\\antigravity\\mcp_config.json");
  console.log("   OpenCode:       ~/.config/opencode/opencode.json");
  console.log("   VS Code:        Roo-Cline extension settings");

  console.log("\n📊 MCP Swarm v0.9.0 Statistics:");
  console.log("   - 41 Smart Tools (consolidated from 168+)");
  console.log("   - Each tool has multiple actions via 'action' parameter");
  console.log("   - Supports 50+ agents simultaneously");

  console.log("\n🚀 After adding MCP config, restart your IDE!");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
