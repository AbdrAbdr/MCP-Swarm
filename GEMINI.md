# MCP Swarm Agent Rules (v1.1.3) - Antigravity/Gemini Edition

## CRITICAL: repoPath Parameter

**EVERY MCP Swarm tool call MUST include `repoPath` parameter!**

The `repoPath` is the absolute path to the project you're working on. Without it, MCP Swarm cannot know which project to coordinate.

```typescript
// CORRECT - always include repoPath
swarm_agent({ action: "register", repoPath: "C:/Users/abdr/Desktop/Intop Saas/intop-saas" })

// WRONG - missing repoPath
swarm_agent({ action: "register" })
```

**How to determine repoPath:**
- Use the current working directory of your project
- On Windows: `C:/Users/username/projects/my-app`
- On macOS/Linux: `/home/username/projects/my-app`

## CRITICAL: Always Start with MCP Swarm

Before ANY coding task, you MUST:

1. **Register yourself** - Call `swarm_agent({ action: "register", repoPath: "/path/to/project" })`
2. **Try to become Orchestrator** - Call `swarm_orchestrator({ action: "elect", repoPath: "/path/to/project" })`
3. **Check task list** - Call `swarm_task({ action: "list", repoPath: "/path/to/project" })`
4. **Reserve files** - Before editing, call `swarm_file({ action: "reserve", repoPath: "/path/to/project", filePath: "...", agent: "YourName" })`

## Agent Roles

### ORCHESTRATOR (First Agent)
The first agent that calls `swarm_orchestrator({ action: "elect", repoPath })` becomes the Orchestrator.
- Works in **INFINITE LOOP** - only user can stop
- Distributes tasks, monitors agent heartbeats, coordinates work
- Uses `swarm_control({ action: "pulse_update", repoPath })` to update real-time agent map

### EXECUTOR (All Other Agents)
All subsequent agents become Executors.
- Register with `swarm_agent({ action: "register", repoPath })`
- Get tasks via auction system
- Lock files before editing, send heartbeat, create PRs

## Workflow Rules

### Starting Work
```typescript
// Step 1: Get your project path (this is your working directory)
const repoPath = "C:/Users/abdr/Desktop/Intop Saas/intop-saas";

// Step 2: Register and become orchestrator (if first agent)
swarm_agent({ action: "register", repoPath })           // Get your name (e.g., "RadiantWolf")
swarm_orchestrator({ action: "elect", repoPath })       // Try to become orchestrator

// Step 3: Work on tasks
swarm_task({ action: "list", repoPath })                // See what needs to be done
swarm_task({ action: "update", repoPath, taskId, status: "in_progress", assignee: "YourName" })

// Step 4: Lock files before editing
swarm_file({ action: "reserve", repoPath, filePath: "src/index.ts", agent: "YourName", exclusive: true })

// Step 5: Do your work...

// Step 6: Release files and complete task
swarm_file({ action: "release", repoPath, filePath: "src/index.ts", agent: "YourName" })
swarm_task({ action: "update", repoPath, taskId, status: "done" })

// Step 7: Sync and create PR
swarm_git({ action: "sync", repoPath })
swarm_git({ action: "pr", repoPath, title: "...", body: "..." })
```

### Collaboration Rules
- **Never edit files locked by another agent** - Check `swarm_file({ action: "list", repoPath })` first
- **Broadcast important changes** - Use `swarm_chat({ action: "broadcast", repoPath, message: "..." })`
- **Log your reasoning** - Use `swarm_chat({ action: "thought", repoPath, message: "..." })`
- **Request code reviews** - Use `swarm_chat({ action: "review_request", repoPath, ... })`

### Safety Rules
- **Dangerous actions require voting** - Use `swarm_voting({ action: "start", repoPath, ... })`
- **Check main health** - Use `swarm_git({ action: "health", repoPath })`
- **Scan for threats** - Use `swarm_defence({ action: "scan", repoPath, text: "..." })`

### Ghost Mode
When no tasks are assigned:
- Run `swarm_quality({ action: "run", repoPath })` to check code quality
- Help review other agents' code
- Optimize imports and formatting

## 26 Smart Tools (v1.1.3)

Consolidated from 54 tools — zero feature loss, 2× fewer IDE slots. Each tool uses an `action` parameter.

| Tool | Key Actions |
|------|-------------|
| **swarm_agent** | register, whoami, init, companion_status, companion_stop |
| **swarm_control** | stop, resume, status, pulse_update, pulse_get |
| **swarm_task** | create, list, update, decompose, briefing_save, briefing_load |
| **swarm_plan** | create, add, next, start, complete, prompt, export, spec_start, spec_phase |
| **swarm_file** | reserve, release, list, forecast, snapshot_create, snapshot_rollback |
| **swarm_worktree** | create, list, remove, hooks_install, hooks_run |
| **swarm_git** | sync, pr, health, cleanup, dep_signal, dep_sync |
| **swarm_chat** | broadcast, dashboard, thought, review_request, review_respond |
| **swarm_voting** | start, vote, list, auction_announce, auction_bid |
| **swarm_orchestrator** | elect, info, heartbeat, resign, executors |
| **swarm_message** | send, inbox, ack, reply, mcp_scan, mcp_authorize |
| **swarm_defence** | scan, validate_agent, quarantine, trust, immune_alert, consensus_* |
| **swarm_brain** | start, ask, answer, propose, debug_start, debug_hypothesis, debug_fix |
| **swarm_health** | check, dead, reassign, summary, preempt_trigger |
| **swarm_session** | start, log, stop, replay, timeline_generate, screenshot_share |
| **swarm_quality** | run, report, threshold, pr_ready, regression_check |
| **swarm_budget** | analyze, route, log_usage, usage, stats, cost_limit |
| **swarm_knowledge** | archive, search, docs_generate, advice_request |
| **swarm_context** | estimate, compress, pool_add, pool_search, batch_queue |
| **swarm_expertise** | track, suggest, record, route_find_agent, route_auto_assign |
| **swarm_moe** | route, feedback, experts, sona_route, sona_classify |
| **swarm_external** | sync_github, sync_linear, create_issue, platform_request |
| **swarm_telegram** | setup, send, notify_*, qa_start, qa_iterate |
| **swarm_vector** | init, add, search, delete, stats, duplicates |
| **swarm_clusters** | init, list, tools, find, conflict_predict, conflict_analyze |
| **swarm_booster** | execute, can_boost, stats, history |

## Quick Reference

### Core Operations (ALWAYS include repoPath!)
```typescript
const repoPath = "C:/Users/abdr/Desktop/Intop Saas/intop-saas";

swarm_agent({ action: "register", repoPath })                    // Get agent name
swarm_orchestrator({ action: "elect", repoPath })                // Become orchestrator  
swarm_task({ action: "list", repoPath })                         // List all tasks
swarm_file({ action: "reserve", repoPath, filePath, agent })     // Lock file
swarm_git({ action: "pr", repoPath, title, body })               // Create PR
```

### Orchestrator Operations
```typescript
swarm_orchestrator({ action: "elect", repoPath })                // Become orchestrator
swarm_orchestrator({ action: "info", repoPath })                 // Get orchestrator info
swarm_control({ action: "pulse_update", repoPath, agent, status }) // Update agent status
swarm_control({ action: "pulse_get", repoPath })                 // Get all agent statuses
```

### Telegram Notifications
```typescript
swarm_telegram({ action: "send", repoPath, message: "Deploy complete!" })
swarm_telegram({ action: "notify_task_completed", repoPath })
```

## Manual Installation for Antigravity

Add to your MCP config file:

**Windows:** `%APPDATA%\antigravity\mcp_config.json`
**macOS:** `~/Library/Application Support/antigravity/mcp_config.json`
**Linux:** `~/.config/antigravity/mcp_config.json`

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/path/to/MCP0/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "SWARM_PROJECT": "default",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
      }
    }
  }
}
```

**Note:** Do NOT set `SWARM_REPO_PATH` in env - agents must pass `repoPath` dynamically!

> 📱 See [TELEGRAM.md](./TELEGRAM.md) for full Telegram setup instructions.

Then copy this `GEMINI.md` file to your project root.
