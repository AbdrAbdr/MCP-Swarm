# MCP Swarm Agent Rules (v0.9.0) - Antigravity Edition

## CRITICAL: Always Start with MCP Swarm

Before ANY coding task, you MUST:

1. **Register yourself** - Call `swarm_agent({ action: "register" })` to get your unique agent name
2. **Check swarm status** - Call `swarm_control({ action: "status" })` to ensure swarm is active
3. **Check task list** - Call `swarm_task({ action: "list" })` to see available tasks
4. **Reserve files** - Before editing, call `swarm_file({ action: "reserve", filePath: "...", agent: "YourName" })`

## Agent Roles

### ORCHESTRATOR (First Agent)
The first agent that calls `swarm_orchestrator({ action: "elect" })` becomes the Orchestrator.
- Works in **INFINITE LOOP** - only user can stop
- Distributes tasks, monitors agent heartbeats, coordinates work
- Uses `swarm_control({ action: "pulse" })` to update real-time agent map

### EXECUTOR (All Other Agents)
All subsequent agents become Executors.
- Register with `swarm_agent({ action: "register" })`
- Get tasks via auction system
- Lock files before editing, send heartbeat, create PRs

## Workflow Rules

### Starting Work
```
1. swarm_agent({ action: "register" }) → Get your name (e.g., "RadiantWolf")
2. swarm_task({ action: "list" }) → See what needs to be done
3. swarm_task({ action: "update", taskId, status: "in_progress", agent: "YourName" }) → Claim task
4. swarm_file({ action: "reserve", filePath: "...", agent: "YourName", exclusive: true }) → Lock files
5. Do your work
6. swarm_file({ action: "release", filePath: "...", agent: "YourName" }) → Unlock files
7. swarm_task({ action: "update", taskId, status: "done" }) → Complete task
8. swarm_git({ action: "sync" }) → Rebase before push
9. swarm_git({ action: "pr", title: "...", body: "..." }) → Open PR
```

### Collaboration Rules
- **Never edit files locked by another agent** - Check `swarm_file({ action: "list" })` first
- **Broadcast important changes** - Use `swarm_collab({ action: "broadcast", message: "..." })`
- **Request reviews** - Use `swarm_collab({ action: "review_request", ... })`
- **Log your reasoning** - Use `swarm_collab({ action: "thought", text: "..." })`

### Safety Rules
- **Dangerous actions require voting** - Use `swarm_voting({ action: "start", ... })`
- **Check main health** - Use `swarm_safety({ action: "main_health" })`
- **Signal dependency changes** - Use `swarm_safety({ action: "dependency_change", ... })`

### Ghost Mode
When no tasks are assigned:
- Run `swarm_patrol({ action: "run" })` to check for lint errors
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
```typescript
swarm_agent({ action: "register" })                    // Get agent name
swarm_task({ action: "list" })                         // List all tasks
swarm_file({ action: "reserve", filePath, agent })     // Lock file
swarm_git({ action: "pr", title, body })               // Create PR
```

### Orchestrator Operations
```typescript
swarm_orchestrator({ action: "elect" })                // Become orchestrator
swarm_orchestrator({ action: "dispatch_task", ... })   // Assign task to agent
swarm_control({ action: "pulse" })                     // Update agent map
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
        "SWARM_REPO_PATH": "C:/path/to/MCP0"
      }
    }
  }
}
```

Then copy this `GEMINI.md` file to your project root.
