#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Agent rules content for each IDE - v0.9.0 Smart Tools
const AGENT_RULES_CONTENT = `# MCP Swarm Agent Rules (v0.9.0)

## CRITICAL: repoPath Parameter

**EVERY MCP Swarm tool call MUST include \`repoPath\` parameter!**

The \`repoPath\` is the absolute path to the project you're working on. Without it, MCP Swarm cannot know which project to coordinate.

\`\`\`typescript
// CORRECT - always include repoPath
swarm_agent({ action: "register", repoPath: "/path/to/your/project" })

// WRONG - missing repoPath
swarm_agent({ action: "register" })
\`\`\`

**How to determine repoPath:**
- Use the current working directory of your project
- On Windows: \`C:/Users/username/projects/my-app\`
- On macOS/Linux: \`/home/username/projects/my-app\`

## CRITICAL: Always Start with MCP Swarm

Before ANY coding task, you MUST:

1. **Register yourself** - Call \`swarm_agent({ action: "register", repoPath })\`
2. **Try to become Orchestrator** - Call \`swarm_orchestrator({ action: "elect", repoPath })\`
3. **Check task list** - Call \`swarm_task({ action: "list", repoPath })\`
4. **Reserve files** - Before editing, call \`swarm_file({ action: "reserve", repoPath, filePath: "...", agent: "YourName" })\`

## Agent Roles

### ORCHESTRATOR (First Agent)
The first agent that calls \`swarm_orchestrator({ action: "elect", repoPath })\` becomes the Orchestrator.
- Works in **INFINITE LOOP** - only user can stop
- Distributes tasks, monitors agent heartbeats, coordinates work
- Uses \`swarm_pulse({ action: "update", repoPath })\` to update real-time agent map

### EXECUTOR (All Other Agents)
All subsequent agents become Executors.
- Register with \`swarm_agent({ action: "register", repoPath })\`
- Get tasks via auction system
- Lock files before editing, send heartbeat, create PRs

## Workflow Rules

### Starting Work
\`\`\`typescript
// Step 1: Get your project path (this is your working directory)
const repoPath = "/path/to/your/project";

// Step 2: Register and become orchestrator (if first agent)
swarm_agent({ action: "register", repoPath })           // Get your name (e.g., "RadiantWolf")
swarm_orchestrator({ action: "elect", repoPath })       // Try to become orchestrator

// Step 3: Work on tasks
swarm_task({ action: "list", repoPath })                // See what needs to be done
swarm_task({ action: "update", repoPath, taskId, status: "in_progress", agent: "YourName" })

// Step 4: Lock files before editing
swarm_file({ action: "reserve", repoPath, filePath: "src/index.ts", agent: "YourName", exclusive: true })

// Step 5: Do your work...

// Step 6: Release files and complete task
swarm_file({ action: "release", repoPath, filePath: "src/index.ts", agent: "YourName" })
swarm_task({ action: "update", repoPath, taskId, status: "done" })

// Step 7: Sync and create PR
swarm_git({ action: "sync", repoPath })
swarm_git({ action: "pr", repoPath, title: "...", body: "..." })
\`\`\`

### Collaboration Rules
- **Never edit files locked by another agent** - Check \`swarm_file({ action: "list", repoPath })\` first
- **Broadcast important changes** - Use \`swarm_chat({ action: "broadcast", repoPath, message: "..." })\`
- **Log your reasoning** - Use \`swarm_chat({ action: "thought", repoPath, message: "..." })\`

### Safety Rules
- **Dangerous actions require voting** - Use \`swarm_voting({ action: "start", repoPath, ... })\`
- **Check main health** - Use \`swarm_git({ action: "health", repoPath })\`

### Ghost Mode
When no tasks are assigned:
- Run \`swarm_patrol({ action: "run", repoPath })\` to check for lint errors
- Help review other agents' code
- Optimize imports and formatting

## 41 Smart Tools (v0.9.0)

| Tool | Actions |
|------|---------|
| swarm_agent | register, whoami |
| swarm_task | create, list, update, decompose, get_decomposition |
| swarm_file | reserve, release, list, forecast, conflicts, safety |
| swarm_worktree | create, list, remove |
| swarm_git | sync, pr, health, cleanup, cleanup_all |
| swarm_chat | broadcast, dashboard, thought, thoughts |
| swarm_review | request, respond, list |
| swarm_voting | start, vote, list, get |
| swarm_auction | announce, bid, poll |
| swarm_mcp | scan, authorize, policy |
| swarm_orchestrator | elect, info, heartbeat, resign, executors, executor_heartbeat |
| swarm_message | send, inbox, ack, reply, search, thread |
| swarm_briefing | save, load |
| swarm_pulse | update, get |
| swarm_knowledge | archive, search |
| swarm_snapshot | create, rollback, list |
| swarm_health | check, dead, reassign, summary |
| swarm_quality | run, report, threshold, pr_ready |
| swarm_cost | log, agent, project, limit, remaining |
| swarm_brainstorm | start, ask, answer, propose, present, validate, save, get, list |
| swarm_plan | create, add_task, get_next, start_task, complete_step, complete_task, subagent_prompt, export_markdown, status, list, ready |
| swarm_debug | start, log_investigation, add_evidence, complete_phase1, log_patterns, complete_phase2, form_hypothesis, test_hypothesis, implement_fix, verify_fix, get, list, check_red_flags |
| swarm_spec | start, start_phase, complete_phase, get, list, export_markdown |
| swarm_qa | start, run_iteration, log_fix, get, list, get_suggestions, generate_report |
| swarm_guard | install, uninstall, run, get_config |
| swarm_cluster | init, list, get_tools, find |
| swarm_patrol | run |
| swarm_companion | status, stop, pause, resume |
| swarm_control | stop, resume, status |

## Quick Reference

### Core Operations (ALWAYS include repoPath!)
\`\`\`typescript
const repoPath = "/path/to/your/project";

swarm_agent({ action: "register", repoPath })                    // Get agent name
swarm_orchestrator({ action: "elect", repoPath })                // Become orchestrator  
swarm_task({ action: "list", repoPath })                         // List all tasks
swarm_file({ action: "reserve", repoPath, filePath, agent })     // Lock file
swarm_git({ action: "pr", repoPath, title, body })               // Create PR
\`\`\`

### Orchestrator Operations
\`\`\`typescript
swarm_orchestrator({ action: "elect", repoPath })                // Become orchestrator
swarm_orchestrator({ action: "info", repoPath })                 // Get orchestrator info
swarm_pulse({ action: "update", repoPath, agent, status })       // Update agent status
swarm_pulse({ action: "get", repoPath })                         // Get all agent statuses
\`\`\`
`;

// All supported IDEs and their rules files
const IDE_RULES_FILES = [
  { name: "Claude Desktop / Claude Code", file: "CLAUDE.md" },
  { name: "Antigravity / Gemini", file: "GEMINI.md" },
  { name: "OpenCode / Generic", file: "AGENT.md" },
  { name: "Multi-agent systems", file: "AGENTS.md" },
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
        SWARM_HUB_URL: "wss://mcp-swarm-hub.unilife-ch.workers.dev/ws",
        SWARM_PROJECT: "default",
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
