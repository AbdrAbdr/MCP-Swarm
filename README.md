> <img src="https://flagcdn.com/20x15/ru.png" alt="RU" /> [Читать на русском](./README.ru.md) | 📋 [Changelog](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/mcp-swarm.svg)](https://www.npmjs.com/package/mcp-swarm)
[![npm downloads](https://img.shields.io/npm/dm/mcp-swarm.svg)](https://www.npmjs.com/package/mcp-swarm)
[![license](https://img.shields.io/npm/l/mcp-swarm.svg)](https://github.com/AbdrAbdr/MCP-Swarm/blob/main/LICENSE)
[![CI](https://github.com/AbdrAbdr/MCP-Swarm/actions/workflows/ci.yml/badge.svg)](https://github.com/AbdrAbdr/MCP-Swarm/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![MCP Protocol](https://img.shields.io/badge/MCP-Protocol-blueviolet)](https://modelcontextprotocol.io)

<p align="center">
  <img src="./assets/banner.png" alt="MCP Swarm Banner" width="800" />
</p>

# 🐝 MCP Swarm v1.1.4 — Universal AI Agent Coordination Platform

> 🐝 **v1.1.4 — Telegram Bot + Full Documentation:** Real-time Telegram notifications for tasks, agents, and errors. Web Dashboard at `localhost:37373`. All **26 Smart Tools** via Remote Bridge. Update: `npm install -g mcp-swarm@latest`

**MCP Swarm** is a global "nervous system" for your AI assistants. It turns separate agents (Claude, Cursor, Windsurf, OpenCode) into a coordinated team that can work on massive projects without conflicts or context loss.

---

## 🎬 Quick Demo

```
┌──────────────────────────────────────────────────────────────┐
│  Claude Code (Agent 1)          Cursor (Agent 2)            │
│  ┌─────────────────────┐        ┌─────────────────────┐     │
│  │ swarm_task create    │        │ swarm_task list      │     │
│  │ "Fix auth module"    │───────▶│ → picks up task      │     │
│  │                      │        │                      │     │
│  │ swarm_file reserve   │        │ swarm_file reserve   │     │
│  │ auth.ts ✅ locked    │        │ utils.ts ✅ locked   │     │
│  │                      │        │                      │     │
│  │ swarm_chat broadcast │◄──────▶│ swarm_chat broadcast │     │
│  │ "Auth fixed!"        │        │ "Utils updated!"     │     │
│  └─────────────────────┘        └─────────────────────┘     │
│                                                              │
│  🌐 Hub (Cloudflare)  ←→  🐝 Companion (localhost:37373)   │
│  Real-time sync            Web Dashboard + Bridge            │
└──────────────────────────────────────────────────────────────┘
```

**Open `http://localhost:37373` to see the live dashboard!**

---

## 🧠 What Is This?

When you use multiple AI tools simultaneously, they often collide: editing the same files, redoing each other's work, or simply not knowing what a colleague did five minutes ago.

**MCP Swarm solves this once and for all:**
1.  **Teamwork:** Agents see each other and communicate.
2.  **Safety:** File Locking prevents two agents from writing to the same file simultaneously.
3.  **Memory:** Everything done today is saved in the `swarm/` folder. Tomorrow, any agent picks up right where it left off.
4.  **Leadership:** The system automatically elects an Orchestrator who assigns tasks and keeps order.

---

## 🛠 26 Smart Tools: The Swarm Toolkit

In v1.0.2, we **consolidated 54 tools into 26** — zero feature loss, 2× fewer IDE tool slots used. Each tool uses an `action` parameter to expose multiple operations.

### 🚀 Core System (2)

| # | Tool | Includes | Key Actions |
|---|------|----------|-------------|
| 1 | **swarm_agent** | agent + companion | `register`, `whoami`, `init`, `status`, `stop`, `pause`, `resume` |
| 2 | **swarm_control** | control + pulse | `stop`, `resume`, `status`, `pulse_update`, `pulse_get` |

### 📋 Task & Plan Management (2)

| # | Tool | Includes | Key Actions |
|---|------|----------|-------------|
| 3 | **swarm_task** | task + briefing | `create`, `list`, `update`, `decompose`, `save_briefing`, `load_briefing` |
| 4 | **swarm_plan** | plan + spec | `create`, `add`, `next`, `start`, `complete`, `prompt`, `export`, `spec_start`, `spec_phase` |

### 🔒 Files & Git (3)

| # | Tool | Includes | Key Actions |
|---|------|----------|-------------|
| 5 | **swarm_file** | file + snapshot | `reserve`, `release`, `list`, `forecast`, `snapshot_create`, `snapshot_rollback` |
| 6 | **swarm_worktree** | worktree + hooks | `create`, `list`, `remove`, `hook_install`, `hook_run` |
| 7 | **swarm_git** | git + dependency | `sync`, `pr`, `health`, `cleanup`, `dep_signal`, `dep_sync` |

### 💬 Collaboration (4)

| # | Tool | Includes | Key Actions |
|---|------|----------|-------------|
| 8 | **swarm_chat** | chat + review | `broadcast`, `dashboard`, `thought`, `request`, `respond` |
| 9 | **swarm_voting** | voting + auction | `start`, `vote`, `list`, `auction_announce`, `auction_bid` |
| 10 | **swarm_orchestrator** | orchestrator | `elect`, `info`, `heartbeat`, `resign`, `executors` |
| 11 | **swarm_message** | message + mcp | `send`, `inbox`, `ack`, `reply`, `mcp_scan`, `mcp_authorize` |

### 🛡️ Security (1)

| # | Tool | Includes | Key Actions |
|---|------|----------|-------------|
| 12 | **swarm_defence** | defence + immune + consensus | `scan`, `validate_agent`, `quarantine`, `trust`, `alert`, `join`, `elect`, `propose`, `vote` |

### 📊 Analytics (3)

| # | Tool | Includes | Key Actions |
|---|------|----------|-------------|
| 13 | **swarm_budget** | cost + budget | `log`, `agent`, `project`, `limit`, `analyze`, `recommend`, `route` |
| 14 | **swarm_moe** | moe + sona | `moe_route`, `moe_feedback`, `moe_experts`, `sona_route`, `sona_learn`, `sona_specialists` |
| 15 | **swarm_quality** | quality + regression | `run`, `report`, `threshold`, `pr_ready`, `baseline`, `check_regression` |

### 🧠 Intelligence (4)

| # | Tool | Includes | Key Actions |
|---|------|----------|-------------|
| 16 | **swarm_vector** | HNSW search | `init`, `add`, `search`, `get`, `delete`, `duplicates`, `embed` |
| 17 | **swarm_booster** | fast executor | `execute`, `can_boost`, `stats`, `history`, `types` |
| 18 | **swarm_brain** | brainstorm + debug | `bs_start`, `bs_ask`, `bs_propose`, `dbg_start`, `dbg_hypothesis`, `dbg_fix` |
| 19 | **swarm_context** | context + pool + batch | `estimate`, `compress`, `pool_add`, `pool_search`, `batch_queue`, `batch_result` |

### 🏗️ Infra (7)

| # | Tool | Includes | Key Actions |
|---|------|----------|-------------|
| 20 | **swarm_health** | health + preemption | `check`, `dead`, `reassign`, `trigger`, `resolve_urgent` |
| 21 | **swarm_external** | external + platform | `enable_github`, `sync_all`, `create_issue`, `platform_request` |
| 22 | **swarm_expertise** | expertise + routing | `track`, `suggest`, `experts`, `route_find_agent`, `route_auto_assign` |
| 23 | **swarm_knowledge** | knowledge + docs + advice | `archive`, `search`, `doc_generate`, `advice_request` |
| 24 | **swarm_session** | session + timeline + screenshot | `start`, `log`, `stop`, `replay`, `timeline_generate`, `screenshot_share` |
| 25 | **swarm_clusters** | clusters + conflict | `init`, `list`, `find`, `conflict_predict`, `conflict_hotspots` |
| 26 | **swarm_telegram** | telegram + qa | `setup`, `send`, `notify_*`, `qa_start`, `qa_iterate`, `qa_report` |

---

### Usage Examples

<details>
<summary><strong>🧠 swarm_moe — AI Model Routing (includes SONA)</strong></summary>

```typescript
// Route a task to the best model (21 experts)
swarm_moe({
  action: "moe_route",
  content: "Write a React component for user auth",
  preferredTier: "premium",
  maxCost: 0.05,
  repoPath
})
// → { selectedExpert: "claude-sonnet", confidence: 0.92 }

// SONA: Self-learning task assignment
swarm_moe({
  action: "sona_route",
  title: "Fix login button",
  description: "Button invisible on dark theme",
  affectedFiles: ["src/components/Login.tsx"],
  repoPath
})
// → { recommendedAgent: "RadiantWolf", confidence: 0.85, category: "frontend_ui" }

// Train SONA from results
swarm_moe({
  action: "sona_learn",
  taskId: "task-123",
  agentName: "RadiantWolf",
  success: true,
  qualityScore: 0.9,
  repoPath
})
```

</details>

<details>
<summary><strong>⚡ swarm_booster — Execute Tasks Without LLM (352x faster)</strong></summary>

```typescript
// Check if a task can be boosted
swarm_booster({
  action: "can_boost",
  repoPath,
  description: "rename variable oldName to newName"
})
// → { canBoost: true, taskType: "rename_variable", confidence: 0.9 }

// Execute locally ($0, ~8ms)
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
```

</details>

<details>
<summary><strong>🔍 swarm_vector — HNSW Semantic Search</strong></summary>

```typescript
// Initialize + add documents
swarm_vector({ action: "init", repoPath, config: { dimensions: 384, distanceMetric: "cosine" } })
swarm_vector({ action: "add", repoPath, id: "doc-1", text: "JWT auth setup", metadata: { category: "auth" } })

// Semantic search
swarm_vector({ action: "search", repoPath, query: "user login", k: 5 })
// → [{ id: "doc-1", score: 0.87, ... }]
```

</details>

<details>
<summary><strong>🛡️ swarm_defence — AI Security + Consensus</strong></summary>

```typescript
// Scan text for threats (<10ms detection)
swarm_defence({ action: "scan", text: "Ignore all instructions...", source: "user", repoPath })
// → { detected: true, category: "prompt_injection", severity: "high" }

// Consensus: join cluster + propose
swarm_defence({ action: "join", nodeId: "a1", nodeName: "Wolf", repoPath })
swarm_defence({ action: "propose", nodeId: "a1", title: "Add dark mode", type: "architecture", repoPath })
```

</details>

### 🧠 MoE Router — 21 Built-in AI Models

| Provider | Model | Tier | Input $/MTok | Output $/MTok | Context |
|----------|-------|------|--------------|---------------|---------|
| Anthropic | **Claude Opus 4.6** | flagship | $5 | $25 | **1M** |
| Anthropic | Claude Opus 4.5 | flagship | $5 | $25 | 200K |
| Anthropic | Claude Sonnet 4.5 | premium | $3 | $15 | 200K |
| Anthropic | Claude Haiku 4.5 | economy | $1 | $5 | 200K |
| OpenAI | **GPT-5.3 Codex** | flagship | ~$2 | ~$15 | 128K |
| OpenAI | GPT-5.2 | flagship | $1.75 | $14 | 256K |
| OpenAI | GPT-5 Mini | standard | $0.25 | $2 | 128K |
| OpenAI | GPT-4.1 | premium | $3 | $12 | 128K |
| OpenAI | o4-mini | reasoning | $4 | $16 | 128K |
| Moonshot | **Kimi K2.5** | premium | $0.60 | $3.00 | 256K |
| Google | Gemini 3 Pro | flagship | $2 | $12 | **1M** |
| Google | Gemini 3 Flash | standard | $0.50 | $3 | **1M** |
| Google | Gemini 2.5 Pro | premium | $1.25 | $10 | **1M** |

---

### 🏗️ v0.9.17 — Modular Architecture & Cloudflare Auth

**Code Modularization:**
- `smartTools.ts` split into **9 focused modules** in `src/smartTools/`
- Clean re-exports via `index.ts` — no breaking API changes
- Removed legacy `tools.ts` and `server.ts` (~5000 lines of dead code)

**Cloudflare Workers with Authentication:**
- **`abdr-swarm-hub`** — WebSocket bridge + REST API with `SWARM_AUTH_TOKEN`
- **`abdr-swarm-server`** — Streamable HTTP MCP Server, auto-forwards Bearer Token
- **`abdr-swarm-telegram`** — Bot with protected `/register` endpoint

**CI/CD Pipeline:**
- GitHub Actions: `main` + `develop` branches
- TypeScript check (`tsc --noEmit`) before build
- Node.js matrix: 18, 20, 22
- Auto npm publish on `main` push

---

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

**Auto-start Companion + Bridge (v1.0.5):**
When launching `mcp-swarm-remote`, it automatically:
1. Starts the companion daemon
2. Passes `MCP_SERVER_URL` so the bridge auto-connects
3. All **26 smart tools** work through the bridge (was only 3 in v1.0.4)

```bash
# Everything starts automatically — bridge included!
npx -y -p mcp-swarm mcp-swarm-remote --url https://your-server.workers.dev/mcp

# Disable auto-start if needed
npx -y -p mcp-swarm mcp-swarm-remote --url https://... --no-companion
```

**How the Remote Bridge works (v1.0.5):**
```
IDE → mcp-swarm-remote → HTTP POST → Cloudflare Worker
                                          ↓ toolNeedsBridge("swarm_*") = true
                                     WebSocket → Companion (local)
                                          ↓ executeLocalTool()
                                     allSmartTools handler(args)
                                          ↓ result
                                     WebSocket ← Companion
                                          ↓
IDE ← mcp-swarm-remote ← HTTP response ← Cloudflare Worker
```

Companion runs on port **37373** and provides:
- **Full bridge** — all 26 tools × all actions via local filesystem
- Auto-reconnect on disconnect
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
irm https://raw.githubusercontent.com/AbdrAbdr/MCP-Swarm/main/install.ps1 | iex
```

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/AbdrAbdr/MCP-Swarm/main/install.sh | bash
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
git clone https://github.com/AbdrAbdr/MCP-Swarm.git C:/MCP/Swarm_MCP
cd C:/MCP/Swarm_MCP && npm install && npm run build

# macOS
git clone https://github.com/AbdrAbdr/MCP-Swarm.git ~/Documents/Swarm_MCP
cd ~/Documents/Swarm_MCP && npm install && npm run build

# Linux
git clone https://github.com/AbdrAbdr/MCP-Swarm.git ~/mcp/Swarm_MCP
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
        "SWARM_PROJECT": "default",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
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
        "SWARM_PROJECT": "default",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
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
        "SWARM_PROJECT": "default",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
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
        "SWARM_PROJECT": "default",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
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
        "SWARM_PROJECT": "default",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
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

Now uses **Streamable HTTP** transport instead of SSE for Cloudflare Workers compatibility!

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
git clone https://github.com/AbdrAbdr/MCP-Swarm.git
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

### Step 3: Telegram Bot (Optional but Recommended)

Get real-time notifications about tasks, agents, errors, and code reviews in Telegram.

#### Where each Telegram credential goes:

| Credential | Where to store | How to get |
|------------|---------------|------------|
| **`TELEGRAM_USER_ID`** | `mcp_config.json` → `env` | Send `/start` to [@userinfobot](https://t.me/userinfobot) |
| **`TELEGRAM_BOT_URL`** | `mcp_config.json` → `env` | URL of your deployed bot worker |
| **`TELEGRAM_BOT_TOKEN`** | **Cloudflare Secret** (via CLI) | Create bot in [@BotFather](https://t.me/BotFather) |
| **Bot Username** | Nowhere — Telegram only | Set during creation in @BotFather |

> ⚠️ **Security:** `TELEGRAM_BOT_TOKEN` is a **secret** — it goes into Cloudflare via `npx wrangler secret put`, **never** into `mcp_config.json` or any config file!

#### 3.1: Get your Telegram User ID

1. Open Telegram
2. Search for **@userinfobot** or go to [t.me/userinfobot](https://t.me/userinfobot)
3. Press **Start**
4. Copy the **User ID** (a number like `513235861`)

#### 3.2: Create a bot via @BotFather

1. Open Telegram, find [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a display name (e.g. "My Swarm Bot")
4. Choose a username (e.g. `@MySwarmbotBot`) — this is the **bot username**, used only to find the bot in Telegram
5. Copy the **bot token** (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

#### 3.3: Deploy the Telegram bot worker

```bash
cd cloudflare/telegram-bot
```

**Set the Hub URL in `wrangler.toml`:**
```toml
[vars]
SWARM_HUB_URL = "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws"
```

**Store the bot token as a Cloudflare secret:**
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Paste the token from step 3.2 and press Enter
# ⚠️ This stores the token SECURELY in Cloudflare, NOT in any file
```

**Deploy the worker:**
```bash
npx wrangler deploy
# ✅ Note the URL: https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev
```

#### 3.4: Set up the webhook

```bash
# Option A: Use the simplified setup endpoint
curl https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev/setup

# Option B: Manual webhook (replace YOUR_TOKEN)
curl "https://api.telegram.org/botYOUR_TOKEN/setWebhook?url=https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev/webhook"
```

#### 3.5: Open the bot in Telegram

Find your bot by username (e.g. `@MySwarmbotBot`), press **Start**, and verify it responds.

Available commands:

| Command | Description |
|---------|-------------|
| `/start` | Main menu + your User ID |
| `/projects` | List registered projects |
| `/status` | Active project status |
| `/agents` | Connected agents |
| `/tasks` | Current tasks |
| `/myid` | Your Telegram User ID |

> 📱 For more details, see [TELEGRAM.md](./TELEGRAM.md).

### Step 4: Configure Your IDE

**Option A: Remote (recommended)**

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": [
        "-y", "-p", "mcp-swarm",
        "mcp-swarm-remote",
        "--url", "https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp"
      ],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
      }
    }
  }
}
```

> 💡 `npx -y -p mcp-swarm` automatically downloads the **latest version** from npm (currently 1.0.5).

**What happens when Remote starts:**

```
1. npx downloads mcp-swarm@latest from npm
2. mcp-swarm-remote starts → checks if companion is running
3. If not → starts companion with:
   • MCP_SERVER_URL (from --url) → Bridge auto-connects to your Worker
   • SWARM_HUB_URL (from env)   → WebSocket to Hub for coordination
4. Companion starts:
   • Bridge → WebSocket → MCP Server Worker (executes 26 tools locally)
   • Hub    → WebSocket → Hub Worker (real-time agent sync)
5. All 26 smart tools work! ✅
```

---

**Option B: Local with Hub**

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/path/to/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
      }
    }
  }
}
```

**What happens when Local starts:**

```
1. Node.js runs serverSmart.js directly (no npm download)
2. MCP server starts as stdio process → IDE connects via stdin/stdout
3. All 26 tools execute locally — no bridge needed
4. Hub connection (optional) → real-time sync between agents
```

---

### 🔄 Comparison

| Feature | Remote (A) | Local (B) |
|---------|------------|-----------|
| Install | `npx` auto-downloads latest | `git clone && npm build` |
| Tools | 26 via Bridge | 26 directly |
| Multi-PC | ✅ Works from any machine | ❌ Only where installed |
| Updates | ✅ Auto (npx latest) | Manual (`git pull && build`) |
| Offline | ❌ Needs internet | ✅ Works offline |
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

## ⭐ Support the Project

If MCP Swarm helps your team — **[give us a star on GitHub](https://github.com/AbdrAbdr/MCP-Swarm)!** ⭐

Your feedback shapes the future of the project:

- 🐛 **Found a bug?** — [Open an Issue](https://github.com/AbdrAbdr/MCP-Swarm/issues/new)
- 💡 **Have an idea?** — [Start a Discussion](https://github.com/AbdrAbdr/MCP-Swarm/discussions)
- 🔧 **Want to contribute?** — [Fork & PR](https://github.com/AbdrAbdr/MCP-Swarm/fork)

[![Star on GitHub](https://img.shields.io/github/stars/AbdrAbdr/MCP-Swarm?style=social)](https://github.com/AbdrAbdr/MCP-Swarm)

---

## 📜 License

MIT © 2025
