export const AGENT_RULES_CONTENT = `# MCP Swarm Agent Rules (v0.9.0)

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
`;
