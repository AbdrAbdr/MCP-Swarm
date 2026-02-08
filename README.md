> 🇷🇺 [Читать на русском](./README.ru.md)

# 🐝 MCP Swarm v0.9.16 — Universal AI Agent Coordination Platform

> ⚠️ **v0.9.16 — Critical Fix:** Previous versions (0.9.14–0.9.15) had a Zod compatibility bug that broke ALL Smart Tools. Update immediately: `npm install -g mcp-swarm@latest`

**MCP Swarm** is a global "nervous system" for your AI assistants. It turns separate agents (Claude, Cursor, Windsurf, OpenCode) into a coordinated team that can work on massive projects without conflicts or context loss.

---

## 🧠 What Is This?

When you use multiple AI tools simultaneously, they often collide: editing the same files, redoing each other's work, or simply not knowing what a colleague did five minutes ago.

**MCP Swarm solves this once and for all:**
1.  **Teamwork:** Agents see each other and communicate.
2.  **Safety:** File Locking prevents two agents from writing to the same file simultaneously.
3.  **Memory:** Everything done today is saved in the `swarm/` folder. Tomorrow, any agent picks up right where it left off.
4.  **Leadership:** The system automatically elects an Orchestrator who assigns tasks and keeps order.

---

## 🛠 54 Smart Tools: The Swarm Toolkit

Instead of hundreds of small commands, we created **54 intelligent tools**. Each represents an entire area of work:

### 🚀 Core System
1.  **swarm_agent** — Registration, identification, and auto-initialization of any project.
2.  **swarm_orchestrator** — Leader election, executor monitoring, task distribution.
3.  **swarm_control** — Global kill switch and swarm state management.
4.  **swarm_pulse** — Live activity map: who's working on what right now.

### 📋 Task & Plan Management
5.  **swarm_task** — Task creation, auction, and tracking.
6.  **swarm_plan** — Building complex multi-step implementation plans.
7.  **swarm_briefing** — "Mental snapshots": context transfer between agent shifts.
8.  **swarm_decompose** — Breaking large tasks into smaller subtasks.

### 🔒 Files & Git
9.  **swarm_file** — Smart file locking and conflict forecasting.
10. **swarm_git** — Sync, branch health checks, and PR creation.
11. **swarm_worktree** — Git worktree management for parallel tasks.
12. **swarm_snapshot** — Instant code snapshots for quick rollback.
13. **swarm_conflict** — Prediction and analysis of code hotspots.

### 💬 Communication & Collaboration
14. **swarm_chat** — Shared agent chat and swarm "thoughts" logging.
15. **swarm_message** — Direct messages between agents with read receipts.
16. **swarm_review** — Requesting and conducting cross-agent code reviews.
17. **swarm_voting** — Voting on dangerous or important architectural decisions.
18. **swarm_brainstorm** — Collective ideation and system design.

### 🛡️ Quality & Health
19. **swarm_health** — Agent liveness checks and reassigning "dead" agents' tasks.
20. **swarm_quality** — Pre-merge code checks (linters, tests, types).
21. **swarm_immune** — Automatic response to CI/CD failures.
22. **swarm_safety** — Security analysis of changes and dependencies.
23. **swarm_qa** — Testing and bug-fixing cycles.
24. **swarm_debug** — Systematic debugging with hypothesis and evidence tracking.

### 📊 Analytics & Documentation
25. **swarm_cost** — API cost tracking per agent and project.
26. **swarm_docs** — Automatic documentation generation during work.
27. **swarm_timeline** — Project development history visualization.
28. **swarm_knowledge** — Knowledge base: saving findings, patterns, and workarounds.

### 🤖 Advanced Features
29. **swarm_mcp** — Scanning and authorizing other MCP servers in the system.
30. **swarm_companion** — Background helper daemon management.
31. **swarm_session** — Recording and replaying agent work sessions.
32. **swarm_expertise** — Specialization analysis: which agent knows which part of the code best.
33. **swarm_regression** — Regression detector: ensures old bugs don't come back.
34. **swarm_context** — Smart context compression to save tokens.
35. **swarm_platform** — Cross-platform compatibility checking.
36. **swarm_urgent** — Emergency interrupt system for critical tasks.
37. **swarm_spec** — Specification and design phase management.
38. **swarm_guard** — Setting up protective file hooks.
39. **swarm_clusters** — Grouping tools into logical clusters.
40. **swarm_patrol** — Autonomous code patrolling mode.
41. **swarm_scan** — Deep project scan for Swarm rules compliance.

### 🧠 v0.9.3 — Smart Features
42. **swarm_routing** — Smart task assignment based on agent file expertise.
43. **swarm_context_pool** — Shared code notes between agents (token savings).
44. **swarm_autoreview** — Automatic code review assignment on task completion.
45. **swarm_external** — Two-way sync with GitHub Issues and Linear.app.
46. **swarm_budget** — Cost optimization: routing tasks to cheap/expensive models.

### 📱 v0.9.4 — Telegram Integration
47. **swarm_telegram** — Telegram Bot for notifications and Swarm management.
    - Get notifications about tasks, agents, CI errors
    - Commands: `/status`, `/agents`, `/tasks`, `/create_task`, `/stop`, `/resume`
    - Interactive buttons for quick actions
    - Configure via Dashboard or `.swarm/telegram.json`
48. **swarm_batch** — API request batching (50% savings on Anthropic/OpenAI).
    - Automatic request grouping
    - Supports Anthropic Message Batches and OpenAI Batch API
    - Savings statistics

### 🧠 v0.9.5 — SONA: Self-Optimizing Neural Architecture
49. **swarm_sona** — Self-learning task router.
    - Classifies tasks into 13 categories (frontend_ui, backend_api, database, testing, devops, etc.)
    - Determines complexity (trivial, simple, medium, complex, epic)
    - Tracks each agent's success rate per category
    - Routes new tasks to the best performers
    - Learns from results (<0.05ms adaptation)
    - EWC++ (Elastic Weight Consolidation) — doesn't forget old patterns
    - 10% exploration rate — tries new agents for data collection
    
    **Usage example:**
    ```typescript
    // Get recommendation — who to assign the task to
    swarm_sona({
      action: "route",
      repoPath,
      title: "Fix login button styling",
      description: "Button not visible on dark theme",
      affectedFiles: ["src/components/Login.tsx"]
    })
    // → { recommendedAgent: "RadiantWolf", confidence: 0.85, category: "frontend_ui" }
    
    // After completion — train the system
    swarm_sona({
      action: "learn",
      repoPath,
      taskId: "task-123",
      agentName: "RadiantWolf",
      success: true,
      qualityScore: 0.9,
      timeMinutes: 15
    })
    
    // Get backend specialists
    swarm_sona({ action: "specialists", repoPath, category: "backend_api", limit: 3 })
    // → [{ agent: "StormyOwl", score: 0.92 }, { agent: "BrightFox", score: 0.88 }, ...]
    ```

### ⚡ v0.9.6 — Agent Booster
50. **swarm_booster** — Fast execution of simple tasks WITHOUT LLM.
    - 352x faster than LLM (~8ms vs ~3000ms)
    - $0 cost (no API calls)
    - Works offline
    - Deterministic results
    
    **Supported task types:**
    - `rename_variable` — rename variables/functions
    - `fix_typo` — fix typos in strings/comments
    - `find_replace` — simple text replacement
    - `add_console_log` / `remove_console_log` — add/remove debugging
    - `toggle_flag` — toggle boolean flags
    - `update_version` — update versions
    - `update_import` — update import paths
    - `format_json` — format JSON
    - `sort_imports` — sort imports
    - `add_export` — add export
    - `extract_constant` — extract magic numbers
    
    **Usage example:**
    ```typescript
    // Check if a task can be boosted
    swarm_booster({
      action: "can_boost",
      repoPath,
      description: "rename variable oldName to newName"
    })
    // → { canBoost: true, taskType: "rename_variable", confidence: 0.9 }
    
    // Execute locally
    swarm_booster({
      action: "execute",
      repoPath,
      task: {
        type: "rename_variable",
        filePath: "src/utils.ts",
        oldName: "getData",
        newName: "fetchUserData"
      }
    })
    // → { success: true, changes: 5, timeMs: 2, savedCost: "$0.01" }
    
    // Remove all console.log from a file
    swarm_booster({
      action: "execute",
      repoPath,
      task: { type: "remove_console_log", filePath: "src/debug.ts" }
    })
    
    // Savings stats
    swarm_booster({ action: "stats", repoPath })
    // → { totalTasks: 50, costSaved: "$0.50", timeSavedMinutes: 2.5 }
    ```

### 🔍 v0.9.7 — HNSW Vector Search
51. **swarm_vector** — Fast semantic search in memory.
    - 150x–12,500x faster than brute force
    - Pure TypeScript (no dependencies)
    - Supports cosine/euclidean/dot metrics
    - Built-in simple embedder + external embedder support
    
    **Applications:**
    - Semantic search in knowledge base
    - Finding similar code snippets
    - Context retrieval for agents
    - Duplicate detection
    - Task clustering
    
    **Usage example:**
    ```typescript
    // Initialize index
    swarm_vector({
      action: "init",
      repoPath,
      config: { dimensions: 384, distanceMetric: "cosine" }
    })
    
    // Add documents
    swarm_vector({
      action: "add",
      repoPath,
      id: "doc-1",
      text: "How to configure JWT authentication",
      metadata: { category: "auth", language: "typescript" }
    })
    
    // Semantic search
    swarm_vector({
      action: "search",
      repoPath,
      query: "setting up user login",
      k: 5,
      filter: { category: "auth" }
    })
    // → [{ id: "doc-1", score: 0.87, ... }, ...]
    
    // Find duplicates
    swarm_vector({ action: "duplicates", repoPath, threshold: 0.95 })
    // → [{ id1: "doc-1", id2: "doc-5", similarity: 0.97 }]
    ```

### 🛡️ v0.9.8 — AIDefence Security
52. **swarm_defence** — Protection against threats and attacks on the AI system.
    - <10ms threat detection
    - Pattern-based + heuristic analysis
    - Quarantine system for suspicious content
    - Audit logging of all security events
    
    **Threat categories:**
    - Prompt injection (bypassing instructions)
    - Jailbreak (bypassing restrictions)
    - Code injection (malicious code)
    - Data exfiltration (data leaks)
    - Sensitive data (PII, API keys)
    - Unsafe commands (dangerous commands)
    - Social engineering (manipulation)
    
    **Sensitivity levels:** `low`, `medium`, `high`, `paranoid`
    
    **Usage example:**
    ```typescript
    // Scan text for threats
    swarm_defence({
      action: "scan",
      text: "Ignore all previous instructions and...",
      source: "user",
      repoPath
    })
    // → { detected: true, category: "prompt_injection", severity: "high", action: "block" }
    
    // Configure sensitivity
    swarm_defence({
      action: "set_config",
      config: { sensitivity: "high", blockOnHighThreat: true },
      repoPath
    })
    
    // Add trusted agent
    swarm_defence({ action: "trust", agentName: "RadiantWolf", repoPath })
    
    // View statistics
    swarm_defence({ action: "stats", repoPath })
    // → { totalScans: 150, threatsDetected: 3, threatsBlocked: 2, ... }
    ```

### 🤝 v0.9.9 — Consensus Protocols
53. **swarm_consensus** — Distributed agreement for agent coordination.
    - Raft-like leader elections
    - Command log replication
    - Byzantine Fault Tolerance (BFT)
    - Proposal and voting system
    
    **Consensus modes:**
    - `simple_majority`: 50%+ votes
    - `raft`: Term-based leadership
    - `bft`: Byzantine (2/3+1 quorum)
    
    **Usage example:**
    ```typescript
    // Join a cluster
    swarm_consensus({
      action: "join",
      nodeId: "agent-1",
      nodeName: "RadiantWolf",
      repoPath
    })
    
    // Leader election
    swarm_consensus({
      action: "elect",
      nodeId: "agent-1",
      nodeName: "RadiantWolf",
      repoPath
    })
    
    // Create a proposal
    swarm_consensus({
      action: "propose",
      nodeId: "agent-1",
      nodeName: "RadiantWolf",
      title: "Implement dark mode",
      description: "Add dark theme to dashboard",
      type: "architecture",
      requiredMajority: 0.67,
      repoPath
    })
    
    // Vote
    swarm_consensus({
      action: "vote",
      proposalId: "prop_xxx",
      nodeId: "agent-2",
      nodeName: "BrilliantFox",
      vote: "approve",
      repoPath
    })
    // → { status: "approved", votes: 2/2 }
    ```

### 🧠 v0.9.10 — MoE Router
54. **swarm_moe** — Intelligent AI model selection for tasks.
    - Automatic routing to the best model
    - Cost/performance/quality optimization
    - Learning from feedback
    - 16 built-in experts (verified prices: February 2026)
    
    **Built-in experts (official prices):**
    
    | Provider | Model | Tier | Input $/MTok | Output $/MTok | Context |
    |----------|-------|------|--------------|---------------|---------|
    | Anthropic | Claude Opus 4.5 | flagship | $5 | $25 | 200K |
    | Anthropic | Claude Sonnet 4.5 | premium | $3 | $15 | 200K |
    | Anthropic | Claude Haiku 4.5 | economy | $1 | $5 | 200K |
    | OpenAI | GPT-5.2 | flagship | $1.75 | $14 | 256K |
    | OpenAI | GPT-5.2 Pro | flagship | $21 | $168 | 256K |
    | OpenAI | GPT-5 Mini | standard | $0.25 | $2 | 128K |
    | OpenAI | GPT-4.1 | premium | $3 | $12 | 128K |
    | OpenAI | GPT-4.1 Mini | standard | $0.80 | $3.20 | 128K |
    | OpenAI | GPT-4.1 Nano | economy | $0.20 | $0.80 | 128K |
    | OpenAI | o4-mini | reasoning | $4 | $16 | 128K |
    | Google | Gemini 3 Pro | flagship | $2 | $12 | **1M** |
    | Google | Gemini 3 Flash | standard | $0.50 | $3 | **1M** |
    | Google | Gemini 2.5 Pro | premium | $1.25 | $10 | **1M** |
    | Google | Gemini 2.5 Flash | standard | $0.30 | $2.50 | **1M** |
    | Google | Gemini 2.5 Flash Lite | economy | $0.10 | $0.40 | **1M** |
    
    **Usage example:**
    ```typescript
    // Route a task to the best model
    swarm_moe({
      action: "route",
      content: "Write a React component for user authentication",
      preferredTier: "premium",
      maxCost: 0.05,
      repoPath
    })
    // → { selectedExpert: "claude-sonnet", confidence: 0.92, estimatedCost: $0.02 }
    
    // Feedback for learning
    swarm_moe({
      action: "feedback",
      expertId: "claude-sonnet",
      success: true,
      quality: 5,
      actualLatencyMs: 1800,
      repoPath
    })
    
    // Statistics
    swarm_moe({ action: "stats", repoPath })
    // → { totalRequests: 150, successRate: 94%, totalCost: $1.23 }
    ```

### 📊 v0.9.12 — Real-time Dashboard & Enhanced Controls

**Dashboard WebSocket Widgets:**
- **ConnectionStatusWidget** — Live Hub connection status with reconnect button
- **ActivityTimelineWidget** — Real-time Swarm event stream
- **FileLocksWidget** — Active file locks with live updates
- **CostTrackingWidget** — API usage and budget progress
- **VotingWidget** — Real-time proposals and voting

**Dashboard WebSocket Setup:**
```bash
# In dashboard/.env
NEXT_PUBLIC_HUB_URL=wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev
```

**Telegram Code Reviews (NEW):**
- `/reviews` — List pending code reviews with inline approve/reject buttons
- `/approve [id]` — Approve a review directly from Telegram
- `/reject [id] [reason]` — Reject a review with a reason

**Example:**
```
You: /reviews

Bot: 📋 Pending Code Reviews:

1. 🔵 Review #abc123
   Files: src/utils.ts, src/index.ts
   Author: RadiantWolf
   Created: 2 hours ago
   
   [✅ Approve] [❌ Reject]

You: /approve abc123
Bot: ✅ Review abc123 approved!
```

**Auto-start Companion (NEW):**
When launching `mcp-swarm-remote`, it automatically checks and starts the companion daemon:
```bash
# Companion starts automatically
npx -y -p mcp-swarm mcp-swarm-remote --url https://...

# Disable auto-start
npx -y -p mcp-swarm mcp-swarm-remote --url https://... --no-companion
```

Companion runs on port **37373** and provides:
- Local file operations execution
- Bridge between IDE and Hub
- Health checks on `/health` endpoint

---

## 🔄 Swarm Lifecycle

### 1. Getting Started (New or Existing Project)
Open your project and say: **"Use MCP Swarm. Register and become the orchestrator if you're first."**
The first agent calls `register` and `elect`.
*   **New project:** The server auto-creates rule files (`CLAUDE.md`, `GEMINI.md`, etc.) and folders.
*   **Existing Swarm project:** The server picks up history from the `swarm/` folder.

### 2. Orchestrator — The Heart of the System
The first agent that becomes Orchestrator enters an **infinite loop**. It:
*   Never goes silent.
*   Constantly monitors `PULSE.md`.
*   Distributes incoming tasks.
*   Only sleeps when a human hits "Stop."

### 3. The Next Morning
When you shut down your computer, the state is saved in Git/Files.
In the morning, the first launched agent checks: "Is there a live Orchestrator?" If not — it takes the role, reads yesterday's tasks, and continues coordinating the team. **History is never reset.**

---

## 🔄 Upgrading from Previous Versions

If you installed MCP Swarm via npm:
```bash
npm install -g mcp-swarm@latest
```

If you cloned the repository:
```bash
cd /path/to/Swarm_MCP
git pull
npm install
npm run build
```

> 🙏 We apologize for the Zod compatibility issue in v0.9.14–0.9.15. The `zod@^3.23.8` semver range resolved to v3.25.76 (Zod v4 bridge), which removed the internal `_parse()` method used by IDE clients for schema validation, breaking all 54 Smart Tools.

---

## ⚙️ Installation

### 🚀 One-Click Install (Recommended)

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/AbdrAbdr/Swarm_MCP/main/install.ps1 | iex
```

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/AbdrAbdr/Swarm_MCP/main/install.sh | bash
```

The installer automatically:
- ✅ Checks/installs Node.js
- ✅ Finds your IDEs (Claude Desktop, Cursor, Windsurf, OpenCode, VS Code)
- ✅ Asks for your Telegram ID for notifications
- ✅ Adds config (without overwriting existing MCP servers!)

---

### 📦 Alternative: via npx

If Node.js is already installed:

```bash
npx mcp-swarm-install
```

Or with parameters:
```bash
npx mcp-swarm-install --telegram-user-id YOUR_TELEGRAM_ID --auto-install --yes
```

---

### 🔧 Manual Installation

<details>
<summary><strong>Clone and build</strong></summary>

```bash
# Windows
git clone https://github.com/AbdrAbdr/Swarm_MCP.git C:/MCP/Swarm_MCP
cd C:/MCP/Swarm_MCP && npm install && npm run build

# macOS
git clone https://github.com/AbdrAbdr/Swarm_MCP.git ~/Documents/Swarm_MCP
cd ~/Documents/Swarm_MCP && npm install && npm run build

# Linux
git clone https://github.com/AbdrAbdr/Swarm_MCP.git ~/mcp/Swarm_MCP
cd ~/mcp/Swarm_MCP && npm install && npm run build
```
</details>

### IDE Configuration

<details>
<summary><strong>🖥️ Claude Desktop</strong></summary>

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux:** `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/MCP/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "SWARM_PROJECT": "default"
      }
    }
  }
}
```
</details>

<details>
<summary><strong>🎯 Cursor</strong></summary>

**Settings → Features → MCP Servers → Add New**

Or create `.cursor/mcp.json` in your home directory:

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/MCP/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "SWARM_PROJECT": "default"
      }
    }
  }
}
```
</details>

<details>
<summary><strong>🌊 Windsurf</strong></summary>

**Cascade → Settings → MCP Servers → Add Server**

Or create `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/MCP/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "SWARM_PROJECT": "default"
      }
    }
  }
}
```
</details>

<details>
<summary><strong>💻 OpenCode CLI</strong></summary>

Create `~/.opencode/mcp.json`:

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/MCP/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "SWARM_PROJECT": "default"
      }
    }
  }
}
```
</details>

<details>
<summary><strong>🤖 VS Code + Copilot/Continue</strong></summary>

Create `.vscode/mcp.json` in your home directory:

```json
{
  "servers": {
    "mcp-swarm": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/MCP/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "SWARM_PROJECT": "default"
      }
    }
  }
}
```
</details>

> **⚠️ Important:** Replace `C:/MCP/Swarm_MCP` with the actual path to your cloned repository!
> - Windows: `C:/MCP/Swarm_MCP`
> - macOS: `/Users/USERNAME/Documents/Swarm_MCP`
> - Linux: `/home/USERNAME/mcp/Swarm_MCP`

---

## ☁️ Installation (Remote — No Local Files)

**v0.9.11 NEW:** Now uses **Streamable HTTP** transport instead of SSE for Cloudflare Workers compatibility!

### 🆓 Cloudflare Workers — IT'S FREE!

MCP Swarm uses Cloudflare Workers for cloud infrastructure. **You don't need to pay anything!**

**Free Tier limits (more than enough for personal use):**

| Resource | Free Limit | For MCP Swarm |
|----------|------------|---------------|
| **Workers Requests** | 100,000 / day | ~1000 agents/day |
| **Durable Objects Requests** | 1,000,000 / month | Enough for a large team |
| **Durable Objects Storage** | 1 GB | Years of message history |
| **WebSocket Messages** | Unlimited | ∞ |
| **CPU Time** | 10ms / request | Sufficient |

> 💡 **For reference:** If you work 8 hours a day with 5 agents, you use ~5% of the free limit.

### Step 1: Create a Cloudflare Account (free)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign up (email + password)
3. Verify your email
4. **Done!** No credit card needed.

### Step 2: Deploy Your Infrastructure

```bash
# 1. Clone the repository
git clone https://github.com/AbdrAbdr/Swarm_MCP.git
cd Swarm_MCP

# 2. Log in to Cloudflare (opens browser)
npx wrangler login

# 3. Deploy the Hub (agent coordination)
cd cloudflare/hub
npx wrangler deploy
# ✅ Note the URL: wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws

# 4. Deploy the MCP Server
cd ../mcp-server
# Open wrangler.toml and replace HUB_URL with your Hub URL from step 3
npx wrangler deploy
# ✅ Note the URL: https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp
```

### Step 3: (Optional) Telegram Bot

```bash
# 1. Open Telegram, find @BotFather
# 2. Send /newbot, follow the instructions
# 3. Copy the token (looks like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz)

cd cloudflare/telegram-bot
# Open wrangler.toml and replace SWARM_HUB_URL with your Hub URL

# Add the token as a secret
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Paste the token and press Enter

npx wrangler deploy
# ✅ Note the URL: https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev

# 4. Set the webhook (replace YOUR_TOKEN and YOUR-SUBDOMAIN)
curl "https://api.telegram.org/botYOUR_TOKEN/setWebhook?url=https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev/webhook"
```

### Step 4: Configure Your IDE

**Option A: Remote (recommended)**

```bash
npm install -g mcp-swarm
```

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": [
        "-y",
        "-p", "mcp-swarm",
        "mcp-swarm-remote",
        "--url", "https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp",
        "--telegram-user-id", "YOUR_TELEGRAM_ID"
      ]
    }
  }
}
```

**Option B: Local with Hub**

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/path/to/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_ID"
      }
    }
  }
}
```

### 🔄 Comparison

| Feature | Remote | Local+Hub |
|---------|--------|-----------|
| Setup | `npm i -g mcp-swarm` | `git clone && npm build` |
| Config | Short | Longer |
| Data | Your Worker | Local |
| Offline | ❌ | ✅ (with Hub fallback) |
| Latency | ~50–100ms | <10ms |

### ❓ What is YOUR-SUBDOMAIN?

When you deploy a Worker, Cloudflare automatically creates a URL:
```
https://mcp-swarm-hub.myaccount.workers.dev
                      ^^^^^^^^^
                      This is your subdomain (account name)
```

You'll see it in the output of `npx wrangler deploy`.

> 📖 Detailed documentation: [REMOTE.md](./REMOTE.md)

---

## 🆔 Smart Project ID

MCP Swarm automatically determines a unique ID for each project:

```
┌─────────────────────────────────────────────────────────────┐
│                    getProjectId(repoPath)                    │
├─────────────────────────────────────────────────────────────┤
│  1. SWARM_PROJECT env?  ──────► Use explicitly set value    │
│           ↓ no                                               │
│  2. git remote origin?  ──────► "github_user_repo"          │
│           ↓ no                                               │
│  3. Folder name + hash  ──────► "MCP0_a1b2c3"               │
└─────────────────────────────────────────────────────────────┘
```

**Examples:**
- `https://github.com/user/my-repo.git` → `github_user_my-repo`
- `C:\Users\user\Desktop\MCP\MCP0` → `MCP0_a1b2c3`
- `SWARM_PROJECT="custom-id"` → `custom-id`

This ensures agents from different projects don't end up in the same Hub room.

---

## 🚀 How to Get Started?
Simply tell any agent in any project:
> **"Use MCP Swarm. Register and become the orchestrator if you're first."**

The magic happens from there. 🐝

---

## 📱 Telegram Bot — Setup

MCP Swarm supports Telegram notifications via **your own bot**.

### Creating a Bot

1. Open Telegram and find **@BotFather**
2. Send `/newbot` and follow the instructions
3. Copy the token (looks like `123456789:ABCdef...`)
4. Deploy `cloudflare/telegram-bot` (see instructions above)

### Getting Your User ID

1. Open **your bot** in Telegram
2. Send `/start`
3. The bot will show your **User ID** (a number, e.g. `987654321`)

### Add User ID to Configuration

**For local MCP:**

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

```powershell
$env:TELEGRAM_USER_ID = "987654321"
```
</details>

<details>
<summary><strong>macOS / Linux</strong></summary>

```bash
export TELEGRAM_USER_ID="987654321"
```
</details>

<details>
<summary><strong>In MCP config</strong></summary>

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/MCP/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "TELEGRAM_USER_ID": "987654321"
      }
    }
  }
}
```
</details>

**For Remote MCP:**

Add `telegram_user_id` to the URL:
```json
{
  "mcpServers": {
    "mcp-swarm": {
      "url": "https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp/sse?telegram_user_id=YOUR_USER_ID",
      "transport": "sse"
    }
  }
}
```

### Step 3: Launch MCP and Verify

1. Open your project in your IDE
2. Register an agent: `swarm_agent({ action: "register", repoPath })`
3. The project will automatically appear in the Telegram bot
4. In the bot, press "📂 My Projects" or send `/projects`
5. Select a project to view its status

### 🔔 Notifications

The bot sends notifications about:
- 📋 Task creation/completion
- 🤖 Agent joining/disconnection
- 🚨 CI/CD errors
- 👀 Review requests
- 🗳 Votes

### ⌨️ Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Show User ID and instructions |
| `/projects` or `/link` | List your projects |
| `/status` | Current project status |
| `/agents` | List of agents |
| `/tasks` | List of tasks |
| `/reviews` | List pending code reviews (v0.9.12) |
| `/approve [id]` | Approve code review (v0.9.12) |
| `/reject [id] [reason]` | Reject code review (v0.9.12) |
| `/stop` | Stop Swarm |
| `/resume` | Resume |

### 🔘 Inline Buttons

All notifications come with **interactive buttons**:
- **Claim** — take a task
- **View** — see details
- **Approve/Reject** — approve/reject a review
- **Vote** — vote on a decision
- **Priority** — set priority (🔴Critical, 🟠High, 🟡Medium)

---

## 🔧 Troubleshooting

<details>
<summary><strong>❌ "Cannot find module" or "Error: ENOENT"</strong></summary>

1. Make sure the project is built:
   ```bash
   cd /path/to/Swarm_MCP
   npm run build
   ```
2. Verify the path in your config points to `dist/serverSmart.js`
3. Use an absolute path (not `./` or `~`)

</details>

<details>
<summary><strong>❌ Agent doesn't become orchestrator</strong></summary>

An orchestrator may already be active. Check:
```bash
cat .swarm/ORCHESTRATOR.json
```

If `lastHeartbeat` is older than 60 seconds, the next agent will automatically take the role.

To force a change: delete `.swarm/ORCHESTRATOR.json` or call `swarm_orchestrator({ action: "resign", repoPath })`.

</details>

<details>
<summary><strong>❌ "repoPath is required" error</strong></summary>

**EVERY** MCP Swarm call must include `repoPath`:
```typescript
// ✅ Correct
swarm_agent({ action: "register", repoPath: "C:/projects/my-app" })

// ❌ Wrong
swarm_agent({ action: "register" })
```

</details>

<details>
<summary><strong>❌ Cloudflare Hub unavailable</strong></summary>

1. Check your internet connection
2. Make sure your Hub is deployed and the URL is correct
3. The system automatically falls back to local Git when Hub is unavailable

</details>

<details>
<summary><strong>❌ swarm/ folder not created automatically</strong></summary>

On first call to `swarm_agent({ action: "register", repoPath })`, the `swarm/` folder and all rule files should be created automatically.

If it doesn't work — call manually:
```typescript
swarm_agent({ action: "init", repoPath: "/path/to/project" })
```

</details>

<details>
<summary><strong>❌ Files locked by another agent</strong></summary>

Check who holds the lock:
```typescript
swarm_file({ action: "list", repoPath: "/path/to/project" })
```

If an agent is "dead" (heartbeat > 60 sec), the system will automatically release the files.

</details>

---

## 📊 Architecture

### Cloudflare Workers (Your endpoints after deployment)

| Worker | URL (example) | Purpose |
|--------|---------------|---------|
| **Hub** | `wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws` | Agent coordination |
| **MCP Server** | `https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp` | Remote MCP (HTTP) |
| **Telegram Bot** | `https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev` | Notifications |

### Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  CLOUDFLARE WORKERS                         │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │   Hub (DO)      │  │  MCP Server     │  │  Telegram   │  │
│  │   /ws           │◄─│  /mcp (HTTP)    │  │  /webhook   │  │
│  │   /api/*        │  │  (Streamable)   │  │             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│                               │                             │
└───────────────────────────────┼─────────────────────────────┘
                                │ WebSocket
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
    ┌──────────┐          ┌──────────┐          ┌──────────┐
    │ Windows  │          │   Mac    │          │  Linux   │
    │ (Cursor) │          │(Windsurf)│          │(OpenCode)│
    │          │          │          │          │          │
    │ Companion│          │ Companion│          │ Companion│
    │ + Bridge │          │ + Bridge │          │ + Bridge │
    └──────────┘          └──────────┘          └──────────┘
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                ▼
                    ┌─────────────────────┐
                    │   YOUR PROJECT      │
                    │   /path/to/project  │
                    │                     │
                    │   .swarm/           │ ← State & messages
                    │   swarm/            │ ← Tasks & agents
                    │   orchestrator/     │ ← Plans & specs
                    │   CLAUDE.md         │ ← Agent rules
                    │   GEMINI.md         │
                    └─────────────────────┘
```

### cloudflare/ structure

```
cloudflare/
├── hub/              # Coordination Hub (Durable Objects)
│   ├── src/index.ts  # SwarmRoom — tasks, chat, locks
│   └── wrangler.toml
│
├── mcp-server/       # Remote MCP Server (Streamable HTTP)
│   ├── src/index.ts  # MCP-over-HTTP (v0.9.11)
│   └── wrangler.toml
│
└── telegram-bot/     # Telegram Bot (Webhook)
    ├── worker.ts     # Commands: /status, /agents, /tasks
    └── wrangler.toml
```

---

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md)

---

## 🤝 Contributing

PRs welcome! Core principles:
1. All tools must accept `repoPath`
2. State is saved to files (not memory)
3. Tests before merging

---

## 📜 License

MIT © 2025
