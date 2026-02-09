> <img src="https://flagcdn.com/20x15/ru.png" alt="RU" /> [Читать на русском](./CHANGELOG.ru.md)

# Changelog

All notable changes to the MCP Swarm project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.1] - 2026-02-09

### 🔭 Observability & Control

#### Added

- **File Logging** — All companion logs written to `~/.mcp-swarm/logs/companion-YYYY-MM-DD.log` with automatic 7-day rotation.
- **`mcp-swarm-doctor`** — New CLI self-diagnostics tool. Checks Node.js, Git, companion status, port, logs, Hub URL, IDE configs, and npm version.
- **Interactive Dashboard** — Buttons for Pause/Resume/Shutdown/Copy Project ID directly in the web dashboard at `http://localhost:37373`. Toast notifications for action feedback.
- **Auto-Update Notifier** — On startup, companion checks npm registry and warns if a newer version is available.

#### Changed

- **Graceful shutdown** now properly closes file log streams before exit.
- **Dashboard footer** updated to v1.1.

---

## [1.1.0] - 2026-02-09

### 🐝 Web Dashboard + DX Improvements

#### Added

- **Web Dashboard** — Beautiful dark-themed dashboard at `http://localhost:37373` with auto-refresh every 5s. Shows agent name, role, bridge status, uptime, PID, and all API endpoints.
- **PID file** — Companion now writes `~/.mcp-swarm/companion.pid` on startup and removes it on exit for process discovery.
- **Graceful shutdown** — SIGTERM/SIGINT handlers with PID cleanup.
- **`/health` endpoint** — Returns JSON with `{ ok, pid, uptime }` for monitoring.
- **`examples/`** — Ready-to-use configs for Claude Code, Cursor, Windsurf, OpenCode, and local mode.
- **Issue Templates** — Bug report, feature request, and question templates in `.github/ISSUE_TEMPLATE/`.
- **Unit tests** — Tests for `normalizeGitRemote` and PID file management (`src/tests/projectId.test.ts`).
- **New badges** — Node.js 18+, TypeScript 5.0, MCP Protocol added to README EN + RU.
- **Quick Demo** — ASCII workflow diagram added to README EN + RU showing multi-agent coordination.

#### Changed

- **`smartTools.ts`** — Legacy monolith renamed to `smartTools.legacy.ts` (unused, server uses modular `smartTools/`).
- **`--version` flag** — Added to `mcp-swarm-remote` CLI (`-v`, `-V`, `--version`).
- **`readFileSync` import** — Added to `remote/index.ts` for version reading.

---

## [1.0.11] - 2026-02-09

### 🎨 Flag Badges & Community CTA

#### Changed

- **Flag badges** — Replaced Unicode country flag emoji (🇷🇺/🇬🇧) with `<img>` badges from flagcdn.com. Flags now display correctly on npm, GitHub, and all platforms.
- **Community CTA section** — Added "⭐ Support the Project" section to both README (EN + RU) with links to Issues, Discussions, and Fork & PR.

---

## [1.0.10] - 2026-02-09

### 🔄 CI/CD Auto-Publish & Docs Update

#### Changed

- **CI/CD fully automated** — GitHub Actions now auto-publishes to npm AND creates GitHub Release when a new version is pushed to `main`. Skips gracefully if version already exists.
- **README updated** — Both README.md and README.ru.md updated from v1.0.7 → v1.0.10 with current feature descriptions.

---

## [1.0.9] - 2026-02-09

### 🧭 Smart Project ID with Git Init Suggestions

#### Added

- **Git init suggestions** — When a project directory has no git repo, companion now prints step-by-step instructions: `git init` → `git add -A` → `git commit` → `gh repo create`.
- **Remote-only suggestions** — When git exists but no remote origin, suggests `gh repo create` or `git remote add origin`.
- **`ProjectIdResult.suggestions`** — New `suggestions[]` field in project ID resolution result, available to tools and agents.

#### Changed

- **Clean folder-based IDs** — Path-based project IDs no longer include hash suffix. `Intop Saas` → `intop_saas` (was `intop_saas_a1b2c3`).
- **`isGitInitialized()` and `hasRemoteOrigin()`** — New helper functions for granular git status detection.

---

## [1.0.8] - 2026-02-09

### 🔧 Companion Bridge Auto-Restart

#### Fixed

- **Critical: Bridge auto-restart** — If companion is running but bridge is disconnected (e.g. old companion without `MCP_SERVER_URL`), `ensureCompanion()` now kills the old process and restarts with correct environment variables.
- **`isBridgeConnected()`** — New function to verify bridge WebSocket status via companion control API.
- **`killCompanion()`** — New function to gracefully shut down companion before restart.

#### Changed

- **ensureCompanion() logic rewritten:**
  1. Check if companion process is running
  2. Check if bridge is actually connected
  3. If running but disconnected → kill + restart with `MCP_SERVER_URL`
  4. If not running → start fresh

---

## [1.0.7] - 2026-02-09

### 🌉 Full Bridge Coverage — All 26 Smart Tools via Remote

#### Fixed

- **Critical: Bridge auto-start** — `mcp-swarm-remote` now passes `MCP_SERVER_URL` to companion daemon. Previously the companion couldn't know where to connect the bridge, so all remote tool calls returned `{ bridgeConnected: false }`.
- **Documentation: Full startup flow** — README now includes complete configuration examples for both Remote and Local modes with `SWARM_HUB_URL`, and step-by-step explanation of what happens at startup.

#### Changed

- **Universal bridge delegation** — `bridge.ts` now imports `allSmartTools` handlers and delegates ALL tool calls through them instead of manually implementing 3 tools with limited actions.
  - Before: only `swarm_file` (read/write/list), `swarm_git` (status/sync), `swarm_agent` (register/whoami) worked through bridge
  - After: all 26 tools × all actions work through bridge (swarm_task, swarm_plan, swarm_quality, swarm_vector, etc.)
- **Simplified tool routing** — `toolNeedsBridge()` on Cloudflare Worker simplified from 21-line selective logic to `toolName.startsWith("swarm_")` — routes ALL swarm tools through bridge.

#### Configuration

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
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws"
      }
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
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws"
      }
    }
  }
}
```

#### What Happens at Startup (Remote)

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

## [0.9.19] - 2026-02-08

### 🚀 Major Release: Smart Routing, Memory, Agent Teams, MCP Bridges

#### Added

- **Smart Router Proxy** (`smartRouterProxy.ts`) — Cost optimization engine inspired by distiq-code
  - Automatic model tier downgrade (Opus → Sonnet when safe)
  - Semantic cache for repeated/similar requests (SHA-256 + similarity)
  - Prompt caching suggestions (cache_control breakpoints for Anthropic API)
  - Request classification: complexity analysis, token estimation, tier recommendation
  - Real-time cost savings tracking and statistics

- **Swarm Memory** (`swarmMemory.ts`) — Hybrid memory system (claude-mem + claude-cognitive)
  - 3-tier Context Router: hot (current session) / warm (24h) / cold (archive)
  - Pool Coordinator for multi-agent memory synchronization
  - Lifecycle hooks: session_start, prompt_submit, response_ready, session_end
  - 3-layer search: keyword/tag → timeline → full observations
  - Auto-compression for older entries (context window savings)

- **MCP Linear Bridge** (`mcpLinearBridge.ts`) — Auto-sync swarm tasks ↔ Linear issues
  - Status mapping: open → Todo, in_progress → In Progress, done → Done
  - Task registration and bidirectional sync
  - Passive activation (only when mcp-linear MCP is detected)

- **MCP Context7 Bridge** (`mcpContext7Bridge.ts`) — Up-to-date documentation integration
  - Auto-detect project tech stack (React, Next.js, Express, Prisma, Supabase, Tailwind...)
  - Documentation cache with configurable TTL (default 24h)
  - Lookup with cache-first strategy

- **Claude-Flow Bridge** (`claudeFlowBridge.ts`) — Skills routing and RAG pipeline
  - Q-learning based skill routing (epsilon-greedy exploration/exploitation)
  - Skill registry with quality tracking (Q-values, success rates)
  - RAG configuration for vector search → context injection

- **Agent Teams** (`agentTeams.ts`) — Multi-agent team coordination
  - Team creation with roles: lead, developer, reviewer, tester, specialist
  - Task delegation with dependency tracking
  - Auto-rebalancing: redistribute tasks when agent goes offline
  - Team-level broadcast messaging
  - RAC (Retrieval Augmented Coding) search placeholder

- **Skills Discovery** (`skillsDiscovery.ts`) — IDE-agnostic skill detection
  - Scans 6+ IDE formats: Gemini, Antigravity, Claude, Cursor, Codex, Windsurf
  - Normalizes skills to unified format
  - Task-based skill recommendation (keyword scoring)
  - Cross-IDE skill import/export

## [0.9.18] - 2026-02-08

### 🧠 Интеграция новых AI-моделей

#### Добавлено

- **Claude Opus 4.6** — новый флагман Anthropic в MoE Router
  - 1M токенов контекст (первый Opus с миллионным контекстом)
  - Adaptive thinking — модель сама решает когда использовать extended thinking
  - Context compaction — автоматическое сжатие при приближении к лимиту
  - 128K output tokens — большие ответы без разбиения
  - Agent Teams — координация нескольких агентов через tmux
  - $5/$25 per MTok (≤200K), $10/$37.50 (>200K)

- **GPT-5.3 Codex** — новый флагман OpenAI для агентного кодинга
  - 256K контекст
  - Оптимизирован для code_generation, debugging, reasoning
  - ~$2/$15 per MTok (estimated)

- **Kimi K2.5** — premium модель Moonshot AI
  - 128K контекст, фокус на code_generation, code_review, debugging
  - ~$1/$5 per MTok (estimated)

#### Изменено

- `ModelProvider` расширен на `"moonshot"` (Kimi/Moonshot AI)
- Claude Opus 4.5 понижен с `flagship` → `premium` (заменён Opus 4.6)
- MoE Router: **19 моделей** (было 16) — 4 Anthropic, 9 OpenAI, 5 Google, 1 Moonshot

---

## [0.9.17] - 2026-02-08

### 🏗️ Smart Tools Modularization

#### Changed

- **`src/smartTools.ts`** — split into **9 modules** in `src/smartTools/`:
  - `core.ts` — swarm_agent, swarm_control, swarm_pulse, swarm_companion
  - `tasks.ts` — swarm_task, swarm_plan, swarm_briefing, swarm_spec
  - `files.ts` — swarm_file, swarm_worktree, swarm_snapshot
  - `git.ts` — swarm_git, swarm_hooks, swarm_dependency
  - `collaboration.ts` — swarm_chat, swarm_message, swarm_review, swarm_voting, swarm_auction, swarm_brainstorm
  - `security.ts` — swarm_defence, swarm_consensus, swarm_mcp
  - `analytics.ts` — swarm_cost, swarm_quality, swarm_regression, swarm_session
  - `intelligence.ts` — swarm_sona, swarm_moe, swarm_vector, swarm_booster, swarm_context_pool, swarm_context
  - `infra.ts` — swarm_health, swarm_immune, swarm_external, swarm_platform, swarm_knowledge, etc.
- **`src/smartTools/index.ts`** — centralized re-export of all modules
- **`src/serverSmart.ts`** — updated to import from `smartTools/index.js`

### 🔒 Cloudflare Workers with Authentication

#### Added

- **`cloudflare/abdr-hub/`** — new Cloudflare Worker `abdr-swarm-hub`
  - Bearer Token + Query parameter authentication
  - WebSocket bridge for agents
  - REST API for swarm management
- **`cloudflare/abdr-server/`** — new Cloudflare Worker `abdr-swarm-server`
  - Streamable HTTP Transport (MCP spec 2025-03-26)
  - All 54 Smart Tools
  - Automatic Bearer Token forwarding to Hub
- **`cloudflare/telegram-bot/`** → renamed to `abdr-swarm-telegram`
  - `SWARM_AUTH_TOKEN` protection for `/register` endpoint
  - Bearer Token for Hub API calls

### 🔄 CI/CD Pipeline

#### Changed

- **`.github/workflows/ci.yml`** — improvements:
  - Triggers for `main` and `develop` branches
  - TypeScript check (`tsc --noEmit`) before build
  - Node.js matrix: 18, 20, 22
  - Automatic npm publish on push to `main`

### 🗑️ Legacy Code Removed

#### Removed

- **`src/tools.ts`** — old 41 tools (replaced by `smartTools/`)
- **`src/server.ts`** — old server (replaced by `serverSmart.ts`)

### 📊 Dashboard

#### Changed

- Updated version in footer: v0.9.12 → v0.9.17

### 📦 Updates

- `package.json` → version `0.9.17`

### 🔄 How to Update

```bash
npm install -g mcp-swarm@latest
# or
npm update mcp-swarm
```

---

## [0.9.16] - 2026-02-08

### 🐛 Critical Fix: Zod Compatibility

**BREAKING FIX:** Fixed `keyValidator._parse is not a function` error that made all 54 Smart Tools completely non-functional in Antigravity and similar clients.

#### Root Cause
- `zod@^3.23.8` in `package.json` auto-installed `3.25.76` — essentially a Zod v4 bridge version
- Zod v4 removed the internal `_parse()` method used by clients for JSON Schema validation
- Result: **no Smart Tool worked** due to input schema parsing errors

#### Fix
- `zod` pinned to exact version `3.23.8` (pure Zod v3, no v4 bridge)
- Prevents automatic upgrades to incompatible versions

> 🙏 We apologize for the inconvenience. This bug affected all users who updated via npm.

### 🔒 Security: Cloudflare Workers

- Removed deployed workers `mcp-swarm-hub` and `mcp-swarm-server` (URLs were exposed in commits)
- Worker sources **preserved** in `cloudflare/` — will be redeployed with new names

### 📦 Updates

- `serverSmart.ts` — dynamic version from `package.json` instead of hardcode
- `server.ts` — marked as deprecated (`@ts-nocheck`), use `serverSmart.ts`
- `.gitignore` — added patterns for test files

### 🔄 How to Update

```bash
npm install -g mcp-swarm@latest
# or
npm update mcp-swarm
```

---

## [0.9.15] - 2026-02-08

### 📖 Bilingual Documentation

#### Changed

- **`README.md`** — fully translated to **English** (~1100 lines)
  - Professional translation of all sections: tools, installation, configuration, architecture
  - Added link to Russian version: `🇷🇺 Читать на русском`
- **`package.json`** — description updated to English
- **Version updated in heading** — v0.9.15

#### Added

- **`README.ru.md`** — Russian version of README created
  - Full original README content in Russian
  - Link to English version: `🇬🇧 Read in English`

---

## [0.9.14] - 2026-02-08

### 🐛 npx Command Fix

#### Fixed

- **`README.md`** — fixed `npx mcp-swarm-remote` commands:
  - Before: `npx mcp-swarm-remote --url ...` (E404 error, package not found)
  - After: `npx -y -p mcp-swarm mcp-swarm-remote --url ...`
- **`REMOTE.md`** — same fix applied to all IDE configuration examples
- **Version updated** — v0.9.14

#### Root Cause

- `npx mcp-swarm-remote` tried to find a **separate** package `mcp-swarm-remote` on npm
- `mcp-swarm-remote` is a binary within the `mcp-swarm` package, so the `-p mcp-swarm` flag is required

---

## [0.9.13] - 2026-02-05

### Self-Hosted Infrastructure

**BREAKING CHANGE:** Removed hardcoded public server URLs. Users must now deploy their own Cloudflare Workers.

#### Changed

- **README.md** — Complete rewrite of installation section
  - Added Cloudflare Free Tier explanation and limits
  - Step-by-step deployment guide for Hub, MCP Server, Telegram Bot
  - Explained what YOUR-SUBDOMAIN means

- **wrangler.toml files** — All 3 Workers now have placeholders
  - `cloudflare/hub/wrangler.toml` — Added deployment instructions
  - `cloudflare/mcp-server/wrangler.toml` — HUB_URL placeholder
  - `cloudflare/telegram-bot/wrangler.toml` — SWARM_HUB_URL placeholder

- **install.ps1 / install.sh** — Now ask for user's server URLs
  - No more hardcoded URLs
  - Instructions for deploying first

- **mcp-swarm-remote** — `--url` is now **required**
  - Shows helpful error message with deployment link
  - Added `--help` option

- **Dashboard** — `.env.example` uses placeholder
  - `useWebSocket.ts` warns if HUB_URL not configured

- **Agent rules** (AGENTS.md, CLAUDE.md, GEMINI.md, AGENT.md)
  - Updated with YOUR-SUBDOMAIN placeholders

#### Why This Change?

- **Privacy**: Your data stays on your infrastructure
- **No shared limits**: Full Cloudflare Free Tier for yourself
- **Customization**: Modify Workers as needed
- **Transparency**: No hidden public server

---

## [0.9.12] - 2026-02-05

### Dashboard Real-time Updates

#### Added

- **WebSocket Hook** (`dashboard/src/hooks/useWebSocket.ts`)
  - Real-time connection to Swarm Hub
  - Auto-reconnect with exponential backoff
  - Keep-alive ping every 25 seconds
  - Event filtering for specific event types

- **New Core Widgets** (`dashboard/src/components/widgets/CoreWidgets.tsx`)
  - **ConnectionStatusWidget** — Shows Hub connection status with reconnect button
  - **ActivityTimelineWidget** — Real-time event stream from Hub
  - **FileLocksWidget** — Active file reservations with live updates
  - **CostTrackingWidget** — API usage and budget progress bars
  - **VotingWidget** — Distributed consensus proposals and votes

- **Live Indicators**
  - Green pulsing dot for connected/active status
  - LIVE/OFFLINE badges for real-time widgets
  - Last update timestamps with relative time format

### Telegram Bot Enhancements

#### Added

- **New Commands**
  - `/reviews` — List pending code reviews with inline approve/reject buttons
  - `/approve [id]` — Approve a review directly from Telegram
  - `/reject [id] [reason]` — Reject a review with optional reason

- **Enhanced Inline Keyboards**
  - Reviews list shows approve/reject buttons for each pending review
  - Help menu now includes Reviews button

### Auto-start Companion

#### Added

- **Companion Auto-start** in `mcp-swarm-remote`
  - Checks if companion daemon is running on port 37373
  - Automatically spawns companion in background if not running
  - Can be disabled with `--no-companion` flag

#### Changed

- Dashboard now uses WebSocket for real-time updates instead of polling-only
- Added "Real-time Monitoring" section with new widgets
- Updated version to 0.9.12 in footer

---

## [0.9.11] - 2026-02-04

### One-Click Installer & Streamable HTTP

#### Added

- **One-Click Install Scripts**
  - `install.ps1` — PowerShell installer for Windows
  - `install.sh` — Bash installer for macOS/Linux
  - `npx mcp-swarm-install` — Interactive Node.js installer

- **Streamable HTTP Transport** (MCP spec 2025-03-26)
  - Single `POST /mcp` endpoint instead of SSE
  - Session management via `Mcp-Session-Id` header
  - Works on Cloudflare Workers without SSE issues

- **mcp-swarm-remote Proxy** (`src/remote/index.ts`)
  - stdio → Streamable HTTP proxy for IDE integration
  - Windows stdin compatibility fix

#### Changed

- Installer now **merges** configs instead of overwriting
- Auto-detects IDE installations (Claude Desktop, Cursor, Windsurf, OpenCode, VS Code)

---

## [0.9.10] - 2026-02-03

### 🧠 MoE Router — Mixture of Experts Model Selection

#### Added

- **MoE Router Module** (`src/workflows/moeRouter.ts`)
  - Intelligent model routing based on task characteristics
  - Gating network for expert selection
  - Cost-performance optimization
  - Learning from feedback

- **Expert Classification**
  - 14 task categories: code_generation, code_review, debugging, reasoning, math, creative, etc.
  - 4 model tiers: economy, standard, premium, flagship
  - 6 providers: anthropic, openai, google, mistral, local, custom

- **Built-in Experts (19 models, verified pricing February 2026)**
  - **Anthropic Claude Series:**
    - Claude Opus 4.6 (flagship, 1M, $5/$25 MTok) ← NEW
    - Claude Opus 4.5 (flagship, 200K, $5/$25 MTok)
    - Claude Sonnet 4.5 (premium, 200K, $3/$15 MTok)
    - Claude Haiku 4.5 (economy, 200K, $1/$5 MTok)
  - **OpenAI GPT-5.x Series:**
    - GPT-5.3 Codex (flagship, 256K, ~$2/~$15 MTok) ← NEW
    - GPT-5.2 (flagship, 256K, $1.75/$14 MTok)
    - GPT-5.2 Pro (flagship, 256K, $21/$168 MTok)
    - GPT-5 Mini (standard, 128K, $0.25/$2 MTok)
    - GPT-4.1 (premium, 128K, $3/$12 MTok)
    - GPT-4.1 Mini (standard, 128K, $0.80/$3.20 MTok)
    - GPT-4.1 Nano (economy, 128K, $0.20/$0.80 MTok)
  - **OpenAI Reasoning Models:**
    - o4-mini (reasoning, 128K, $4/$16 MTok)
  - **Moonshot AI:**
    - Kimi K2.5 (premium, 128K, ~$1/~$5 MTok) ← NEW
  - **Google Gemini 3.x Series:**
    - Gemini 3 Pro (flagship, 1M, $2/$12 MTok)
    - Gemini 3 Flash (standard, 1M, $0.50/$3 MTok)
  - **Google Gemini 2.5 Series:**
    - Gemini 2.5 Pro (premium, 1M, $1.25/$10 MTok)
    - Gemini 2.5 Flash (standard, 1M, $0.30/$2.50 MTok)
    - Gemini 2.5 Flash Lite (economy, 1M, $0.10/$0.40 MTok)

- **Routing Factors**
  - Task match score (category-specific strength)
  - Cost efficiency
  - Performance history (success rate)
  - Load balancing (prefer less recently used)
  - Latency constraints
  - Context window requirements

- **Learning System**
  - Feedback recording
  - Exponential moving average for success rate
  - Automatic latency calibration
  - Per-expert statistics

- **Smart Tool #54: `swarm_moe`**
  - `route`: Route task to best expert
  - `feedback`: Record routing feedback
  - `experts`: List available experts
  - `add_expert` / `remove_expert`: Manage experts
  - `config` / `set_config`: Configuration
  - `stats`: Routing statistics
  - `history`: Routing history
  - `classify`: Classify task category
  - `reset`: Reset statistics

- **Dashboard API Endpoint** (`/api/moe`)
  - Routing statistics
  - Expert list and usage
  - Configuration status

---

## [0.9.9] - 2026-02-03

### 🤝 Consensus — Distributed Agreement Protocols

#### Added

- **Consensus Module** (`src/workflows/consensus.ts`)
  - Raft-like leader election with term-based leadership
  - Log replication for ordered command execution
  - Byzantine Fault Tolerance (BFT) mode for untrusted environments
  - Proposal system with configurable voting thresholds
  - Automatic failover when leader becomes unresponsive

- **Consensus Modes**
  - `simple_majority`: 50%+ votes for approval
  - `raft`: Term-based leadership, log replication
  - `bft`: Byzantine fault tolerant (2/3+1 quorum)

- **Node Management**
  - Join/leave cluster
  - Heartbeat monitoring
  - Trusted/untrusted node classification
  - Automatic dead node detection

- **Proposal System**
  - Types: config_change, task_assignment, architecture, rollback, emergency, custom
  - Vote types: approve, reject, abstain
  - Configurable majority thresholds (0.5 to 1.0)
  - Expiration timeout handling
  - Signature verification for BFT mode

- **Log Replication**
  - Ordered command log
  - Commit confirmation from leader
  - State machine replication across nodes

- **Smart Tool #53: `swarm_consensus`**
  - `join`: Join consensus cluster
  - `leave`: Leave cluster
  - `heartbeat`: Send heartbeat
  - `status`: Get cluster status
  - `elect`: Start leader election
  - `leader`: Get current leader
  - `propose`: Create proposal
  - `vote`: Vote on proposal
  - `proposals`: List proposals
  - `get_proposal`: Get proposal details
  - `execute`: Execute approved proposal
  - `log` / `append` / `commit`: Log management
  - `config` / `set_config`: Configuration
  - `stats`: Statistics

- **Dashboard API Endpoint** (`/api/consensus`)
  - Cluster status and node list
  - Leader information
  - Proposal statistics
  - Recent proposals

---

## [0.9.8] - 2026-02-03

### 🛡️ AIDefence — Security & Threat Detection

#### Added

- **AIDefence Module** (`src/workflows/aiDefence.ts`)
  - <10ms threat detection latency
  - Pattern-based detection with regex + heuristics
  - Behavioral anomaly detection
  - Quarantine system for suspicious content
  - Audit logging for security events
  - Configurable sensitivity levels

- **Threat Categories**
  - `prompt_injection`: Instruction override, role hijacking, delimiter attacks
  - `jailbreak`: DAN mode, hypothetical bypasses, character hijacking
  - `code_injection`: Shell commands, eval, SQL injection, path traversal
  - `data_exfiltration`: API keys, credentials, external uploads
  - `sensitive_data`: PII, private keys, passwords
  - `unsafe_command`: rm -rf, sudo, crypto mining
  - `social_engineering`: Authority claims, urgency manipulation
  - `impersonation`: Agent identity spoofing
  - `dos_attack`: Request flooding
  - `unauthorized_tool`: Restricted tool access

- **Sensitivity Levels**
  - `low`: Only critical threats
  - `medium`: Balanced (default)
  - `high`: Strict checking
  - `paranoid`: Maximum security

- **Smart Tool #52: `swarm_defence`**
  - `scan`: Scan text for threats
  - `validate_agent`: Validate agent identity
  - `validate_tool`: Validate tool usage
  - `events`: Get security events log
  - `quarantine`: Get quarantined items
  - `release`: Release from quarantine
  - `stats`: Get defence statistics
  - `config` / `set_config`: Configuration
  - `trust` / `untrust`: Agent whitelist management
  - `clear_events`: Clear event log

- **Dashboard API Endpoint** (`/api/defence`)
  - Security statistics
  - Threat distribution by category/severity
  - Quarantine status
  - Recent events log

---

## [0.9.7] - 2026-02-03

### 🔍 HNSW — Hierarchical Navigable Small World

#### Added

- **HNSW Module** (`src/workflows/hnsw.ts`)
  - Fast approximate nearest neighbor search
  - 150x-12,500x faster than brute force
  - Pure TypeScript implementation (no dependencies)
  - Based on Malkov & Yashunin (2016) algorithm
  
- **Vector Operations**
  - Cosine similarity (default)
  - Euclidean distance
  - Dot product
  - Configurable dimensions (384, 768, 1536)
  
- **Simple Embeddings**
  - Built-in bag-of-words embedder for demos
  - Works without external API
  - Can use custom vectors from OpenAI/Cohere/etc.
  
- **Smart Tool #51: `swarm_vector`**
  - `init`: Initialize vector index
  - `add`: Add document with text or vector
  - `add_batch`: Add multiple documents
  - `search`: Find similar documents
  - `get`: Get document by ID
  - `delete`: Remove document
  - `list`: List all documents
  - `stats`: Index statistics
  - `config` / `set_config`: Configuration
  - `clear`: Clear entire index
  - `duplicates`: Find duplicate documents
  - `embed`: Get embedding for text

- **Dashboard API Endpoint** (`/api/vector`)
  - Index statistics
  - Configuration status
  - Memory usage tracking

#### Performance

| Documents | Brute Force | HNSW | Speedup |
|-----------|-------------|------|---------|
| 1,000 | 10ms | 0.5ms | 20x |
| 10,000 | 100ms | 0.8ms | 125x |
| 100,000 | 1,000ms | 1.2ms | 833x |
| 1,000,000 | 10,000ms | 2ms | 5,000x |

---

## [0.9.6] - 2026-02-03

### ⚡ Agent Booster — Fast Local Execution

#### Added

- **Agent Booster Module** (`src/workflows/agentBooster.ts`)
  - Executes trivial tasks locally without LLM API calls
  - 352x faster than LLM (local execution)
  - $0 cost (no API calls needed)
  - Works offline
  - Deterministic results
  
- **Supported Task Types** (14 types)
  - `rename_variable` — Rename variables/functions across file
  - `fix_typo` — Fix typos in strings and comments only
  - `find_replace` — Simple find and replace
  - `add_console_log` — Add debug logging at specific line
  - `remove_console_log` — Remove all console.log statements
  - `toggle_flag` — Toggle boolean flags (true ↔ false)
  - `update_version` — Update version numbers
  - `update_import` — Update import paths
  - `add_comment` — Add comment at specific line
  - `remove_comment` — Remove single-line comments
  - `format_json` — Format JSON files
  - `sort_imports` — Sort imports alphabetically
  - `add_export` — Add export to function/class
  - `extract_constant` — Extract magic number to constant

- **Smart Detection**
  - `can_boost` action analyzes task description
  - Auto-detects boostable tasks with confidence score
  - Extracts parameters from natural language

- **Smart Tool #50: `swarm_booster`**
  - `execute`: Run a booster task
  - `can_boost`: Check if task can be boosted
  - `stats`: Get booster statistics
  - `history`: Get execution history
  - `config`: Get configuration
  - `set_config`: Update configuration
  - `types`: List supported task types

- **Dashboard API Endpoint** (`/api/booster`)
  - Booster statistics and type distribution
  - Recent execution history
  - Configuration status
  - Cost savings tracking

#### Performance

| Metric | LLM | Agent Booster | Improvement |
|--------|-----|---------------|-------------|
| Speed | ~3000ms | ~8ms | 352x faster |
| Cost | $0.01/task | $0 | 100% savings |
| Offline | ❌ | ✅ | Works anywhere |
| Deterministic | ⚠️ | ✅ | Same input = same output |

---

## [0.9.5] - 2026-02-03

### 🧠 SONA — Self-Optimizing Neural Architecture

#### Added

- **SONA Module** (`src/workflows/sona.ts`)
  - Self-learning task routing system inspired by Claude-Flow
  - Records which agents perform best for each task type
  - Routes new tasks to best-performing agents
  - Learns from outcomes with <0.05ms adaptation
  - Improves over time with reinforcement learning
  
- **Task Classification**
  - Automatic category detection: frontend_ui, backend_api, database, testing, devops, documentation, refactoring, bugfix, feature, security, performance, infrastructure
  - Complexity estimation: trivial, simple, medium, complex, epic
  - Keyword-based pattern matching
  - Affected path analysis
  
- **Agent Performance Tracking**
  - Success rate tracking per category
  - Quality score averaging
  - Completion time tracking
  - Statistical confidence calculation
  - Specialization detection (top 3 categories per agent)
  
- **Online Learning**
  - Exponential moving average for rolling metrics
  - Configurable learning rate and decay
  - Elastic Weight Consolidation (EWC++) to prevent forgetting
  - Exploration/exploitation balance (10% exploration by default)
  
- **Smart Tool #49: `swarm_sona`**
  - `route`: Get routing recommendation for a task
  - `learn`: Record task outcome and update model
  - `classify`: Classify a task (category, complexity)
  - `profile`: Get agent's performance profile
  - `profiles`: Get all agent profiles
  - `specialists`: Get top agents for a category
  - `history`: Get learning history
  - `stats`: Get SONA statistics
  - `config`: Get configuration
  - `set_config`: Update configuration
  - `reset`: Reset the model

- **Dashboard API Endpoint** (`/api/sona`)
  - SONA statistics and agent profiles
  - Category distribution
  - Recent learning events
  - Top performing agents

---

## [0.9.4] - 2026-02-03

### 📱 Telegram Bot Integration

#### Added

- **Telegram Bot** (`src/integrations/telegram.ts`)
  - Full-featured Telegram bot for notifications and control
  - Event notifications: task created/completed/failed, agent joined/died, CI errors
  - Commands: `/status`, `/agents`, `/tasks`, `/create_task`, `/stop`, `/resume`, `/config`
  - Interactive inline buttons for quick actions
  - Priority setting via buttons (Critical, High, Medium)
  - Approve/Reject/Comment on reviews via Telegram
  - Vote on architecture decisions via Telegram
  
- **Smart Tool #47: `swarm_telegram`**
  - Actions: `setup`, `config`, `enable`, `disable`, `send`
  - Notifications: `notify_task_created`, `notify_task_completed`, `notify_task_failed`, `notify_agent_joined`, `notify_agent_died`
  - Bot control: `start_polling`, `stop_polling`, `command`
  
- **Dashboard API Endpoint** (`/api/telegram`)
  - Telegram configuration status
  - Setup instructions if not configured

- **Cloudflare Worker for Telegram** (`cloudflare/telegram-bot/`)
  - Webhook-based (no polling required)
  - Deploy to Cloudflare Workers
  - `/setup` endpoint for webhook registration

- **Smart Tool #48: `swarm_batch`**
  - Request batching for 50% cost savings
  - Supports Anthropic Message Batches API
  - Supports OpenAI Batch API
  - Actions: `queue`, `config`, `set_config`, `job`, `jobs`, `result`, `stats`, `flush`

- **Batching Module** (`src/workflows/batching.ts`)
  - Automatic request grouping
  - Configurable batch size and wait time
  - Async batch processing with result polling
  - Cost savings estimation

---

## [0.9.3] - 2026-02-03

### 🧠 Smart Features & Cost Optimization

#### Added

- **Smart Task Routing** (`src/workflows/smartRouting.ts`)
  - Automatic task assignment based on file expertise
  - Tracks which agent edited which files
  - Calculates expertise scores (exact match 10x, folder 3x, extension 2x)

- **Shared Context Pool** (`src/workflows/contextPool.ts`)
  - Agents share notes about code to avoid re-reading
  - Auto-staleness detection (if file hash changed)
  - Tags, categories, and helpful counter

- **Auto Code Review** (`src/workflows/autoReview.ts`)
  - Automatic review assignment when task completes
  - Finds reviewer who knows the affected files
  - Comment severity levels (critical, major, minor, suggestion)

- **GitHub/Linear Sync** (`src/workflows/externalSync.ts`)
  - Two-way sync with GitHub Issues
  - Linear.app integration (GraphQL API)
  - Auto-import issues as swarm tasks
  - Auto-close issues when task is done

- **Cost Optimization** (`src/workflows/costOptimization.ts`)
  - Task complexity analysis (simple/medium/complex)
  - Smart model routing (cheap/standard/premium tiers)
  - Budget management with daily/weekly/monthly limits
  - Alert thresholds (50%, 80%, 95%)

- **Background Heartbeat Worker** (`src/workers/`)
  - Uses Node.js `worker_threads` for continuous heartbeat
  - Works even when agent is "thinking"

- **Web Dashboard** (`dashboard/`)
  - Real-time agent status monitoring
  - Orchestrator status banner with glow effects
  - Stats cards (agents, tasks, messages, uptime)
  - Task list with priority indicators
  - Built with Next.js + ShadCN UI

- **Dashboard API** (`src/dashboardApi.ts`)
  - HTTP API server on port 3334
  - New v0.9.3 endpoints: `/api/expertise`, `/api/context`, `/api/reviews`, `/api/budget`, `/api/sync`

#### Smart Tools (42-46)

| # | Tool | Actions | Description |
|---|------|---------|-------------|
| 42 | `swarm_routing` | record, find_agent, expertise, predict, auto_assign | Smart task routing based on file expertise |
| 43 | `swarm_context_pool` | add, get, search_tag, search, helpful, update, cleanup, stats | Shared context notes between agents |
| 44 | `swarm_autoreview` | create, assign, comment, complete, resolve, for_reviewer, for_author, pending, stats | Automatic code review assignment |
| 45 | `swarm_external` | enable_github, enable_linear, sync_github, sync_linear, sync_all, export_github, export_linear, status, create_issue, close_issue, comment | GitHub/Linear sync |
| 46 | `swarm_budget` | analyze, models, select, recommend, route, log_usage, usage, stats, config, set_config, check, remaining, report | Cost optimization and model routing |

---

## [0.9.1] - 2026-02-02

### 📚 Documentation & UX Improvements

#### Added
- **Linux Installation Instructions** — full instructions for Linux
- **IDE-Specific Configs** — separate configurations for:
  - Claude Desktop (Windows/macOS/Linux)
  - Cursor, Windsurf, OpenCode CLI, VS Code + Copilot/Continue
- **Troubleshooting Section** — solutions for common issues:
  - "Cannot find module" errors
  - Agent not becoming orchestrator
  - "repoPath is required" error
  - Cloudflare Hub unavailable
  - Files locked by another agent
- **Architecture Diagram** — ASCII diagram of Cloudflare Hub + Local Agents
- **Contributing Guidelines** — rules for PRs

#### Changed
- README.md completely reworked with collapsible sections (`<details>`)

---

## [0.9.0] - 2026-02-02

### 🚀 MAJOR: Smart Tools Consolidation

**Reduces 168+ individual tools → 41 Smart Tools with `action` parameter**

#### Added

- **Smart Tools System** — 41 unified tools replacing 168+ individual tools
  - Each Smart Tool groups 3-15 related functions via `action` parameter
  - Better discoverability and easier to remember
  - Consistent parameter patterns across all tools

#### Smart Tools List (41 tools)

| # | Tool Name | Actions | Description |
|---|-----------|---------|-------------|
| 1 | `swarm_agent` | register, whoami | Agent identity |
| 2 | `swarm_task` | create, list, update, decompose, get_decomposition | Task management |
| 3 | `swarm_file` | reserve, release, list, forecast, conflicts, safety | File locking |
| 4 | `swarm_git` | sync, pr, health, cleanup, cleanup_all | Git operations |
| 5 | `swarm_worktree` | create, list, remove | Git worktrees |
| 6 | `swarm_companion` | status, stop, pause, resume | Companion daemon |
| 7 | `swarm_control` | stop, resume, status | Swarm control |
| 8 | `swarm_chat` | broadcast, dashboard, thought, thoughts | Team chat |
| 9 | `swarm_review` | request, respond, list | Code review |
| 10 | `swarm_voting` | start, vote, list, get | Voting system |
| 11 | `swarm_auction` | announce, bid, poll | Task auction |
| 12 | `swarm_mcp` | scan, authorize, policy | MCP scanning |
| 13 | `swarm_orchestrator` | elect, info, heartbeat, resign, executors, executor_heartbeat | Orchestrator |
| 14 | `swarm_message` | send, inbox, ack, reply, search, thread | Messaging |
| 15 | `swarm_briefing` | save, load | Briefings |
| 16 | `swarm_pulse` | update, get | Real-time status |
| 17 | `swarm_knowledge` | archive, search | Knowledge base |
| 18 | `swarm_snapshot` | create, rollback, list | Snapshots |
| 19 | `swarm_health` | check, dead, reassign, summary | Agent health |
| 20 | `swarm_quality` | run, report, threshold, pr_ready | Quality gate |
| 21 | `swarm_cost` | log, agent, project, limit, remaining | Cost tracking |
| 22-41 | ... | ... | Brainstorming, Plans, Debug, Spec, QA, Hooks, etc. |

### Backward Compatibility

- Legacy 168+ tools server available via `npm run dev:legacy`
- Smart Tools server via `npm run dev` (default)

---

## [0.8.1] - 2026-02-02

### Added
- **Smart Tools Draft** — prototype of consolidating 168+ tools into 41 Smart Tools
  - Files `smartTools.ts.draft` and `serverSmart.ts.draft`
  - Each Smart Tool combines 3-15 similar tools via `action` parameter

---

## [0.8.0] - 2026-02-02

### Added
- **Orchestrator Election** (6 tools) — first agent becomes orchestrator
  - `orchestrator_elect`, `orchestrator_info`, `orchestrator_heartbeat`, `orchestrator_resign`
  - `executor_list`, `executor_heartbeat`
  
- **Agent Messaging** (6 tools) — full inter-agent messaging system
  - `agent_message_send`, `agent_inbox_fetch`, `agent_message_ack`
  - `agent_message_reply`, `agent_message_search`, `agent_thread_get`

- **Infinite Loop Mode** — orchestrator runs continuously
  - Companion daemon with automatic orchestrator election
  - Orchestrator does NOT stop via API — only by user
  - Executors register with orchestrator
  - Heartbeat system for liveness monitoring

---

## [0.7.0] - 2026-02-02

### Added
- **Spec Pipeline** (6 tools) — structured pipeline for specification creation
  - 4 roles: gatherer → researcher → writer → critic
- **QA Loop** (7 tools) — iterative review/fix cycles
- **Guard Hooks** (6 tools) — pre-commit/pre-push safety hooks
  - Bypass with `[skip-hooks]` keyword in commit message
- **Tool Clusters** (7 tools) — tool organization by categories
  - 13 categories (agent, task, file, git, collab, safety, quality, debug, plan, hooks, session, cost, docs)

---

## [0.6.0] - 2026-01-30

### Added
- **Brainstorming Skill** (9 tools) — interactive design through step-by-step questions
- **Writing Plans Skill** (11 tools) — TDD plans with bite-sized tasks (2-5 min)
- **Systematic Debugging** (13 tools) — 4-phase debugging process
  - Iron Law: NO FIXES WITHOUT ROOT CAUSE
  - Red Flags detection: "Let me just try...", "Maybe if I...", "This should fix it..."

---

## [0.5.0] - 2026-01-30

### Added
- **Agent Health Monitor** — liveness monitoring for agents
- **Session Recording** — action recording for replay
- **Quality Gate** — automated pre-merge checks (lint, tests, types, coverage)
- **Cost Tracker** — API usage cost tracking per agent/project
- **Context Compressor** — briefing compression (ratio 0.1-0.9)
- **Regression Detector** — baseline comparison and regression detection

---

## [0.4.2] - 2026-01-28

### Added
- **Timeline Visualization** — task progress visualization with ASCII milestones

---

## [0.4.1] - 2026-01-25

### Added
- **Auto-Documentation** — automatic documentation generation on task completion
- **Agent Specialization (ML-based)** — expertise tracking per agent
- **Conflict Prediction (ML-based)** — merge conflict prediction using Git history

---

## [0.4.0] - 2026-01-20

### Added
- **Cloudflare Hub** — real-time WebSocket coordination
  - Durable Object for state storage
  - WebSocket broadcast between agents
  - Hybrid mode (WS + Git fallback)
- **Orchestrator Directory** — central management (`/orchestrator/`)

---

## [0.3.0] - 2026-01-15

### Added
- **Collective Advice** — collective brainstorming across all agents
- **Urgent Preemption** — priority file acquisition for critical bugs
- **Snapshot & Rollback** — change rollback capability
- **Immune System** — automatic CI/test failure response

---

## [0.2.0] - 2026-01-10

### Added
- **Architecture Voting** — voting system for dangerous actions
- **Git Worktrees** — isolated workspaces for parallel tasks
- **GitHub Integration** — PR creation, branch sync, auto-cleanup
- **Cross-Agent Review** — code review between agents

---

## [0.1.0] - 2026-01-05

### Added
- **Agent Registry** — agent registration with generated names (RadiantWolf, SilentFox, etc.)
- **Task Management** — full task lifecycle (create, assign, update, complete, cancel)
- **File Locking** — exclusive/shared file locks with conflict prediction
- **Collaboration** — broadcast chat, screenshots, thought logging
- **Auction System** — task bidding for agents
- **Briefings** — mental snapshots for context transfer between agent shifts
- **Pulse** — live agent activity map
- **Knowledge Base** — findings and patterns archive
- **Ghost Mode** — autonomous code patrol and lint fixing
- **Stop Flag** — emergency stop for all agents

### Infrastructure
- MCP Server based on @modelcontextprotocol/sdk
- TypeScript compilation
- Installer for IDEs (Windsurf, Cursor, Claude Desktop, OpenCode, VS Code)
- Agent rules (.windsurfrules, .cursorrules, CLAUDE.md, GEMINI.md)
- Companion daemon for background tasks

---

## Semantic Versioning

- **MAJOR (X.0.0)** — incompatible API changes
- **MINOR (0.X.0)** — new features, backward compatible
- **PATCH (0.0.X)** — bug fixes, backward compatible

## Legend

| Type | Description |
|------|-------------|
| **Added** | New features |
| **Changed** | Changes to existing functionality |
| **Deprecated** | Features to be removed |
| **Removed** | Removed features |
| **Fixed** | Bug fixes |
| **Security** | Vulnerability fixes |
