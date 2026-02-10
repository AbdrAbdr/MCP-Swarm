> <img src="https://flagcdn.com/20x15/ru.png" alt="RU" /> [Читать на русском](./CHANGELOG.ru.md)

# Changelog

All notable changes to the MCP Swarm project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-02-10

### What's New

#### 🔐 Swarm Vault
- **Encrypted secret storage** — AES-256-GCM encryption with PBKDF2 key derivation
- **Session management** — Keys decrypted in memory during process, cleared on exit
- **Cloud backup** — Export/import vault to Telegram, GitHub Gist, Google Drive, S3, or local file
- **New Smart Tool** — `swarm_vault` with actions: init, unlock, get, set, delete, list, export, import, lock, status

#### 🧙 Setup Wizard
- **Interactive first-time setup** — Triggered on `swarm_agent init` if no config exists
- **Multi-lingual** — Auto-detects system locale (Russian/English)
- **Standard mode** — Skip all, v1.1.x compatible out of the box
- **Configured mode** — Choose Vault, Vector DB, Embeddings, GitHub, Profiles, Plugins
- **New Smart Tool** — `swarm_setup` with actions: wizard_prompt, wizard_run, config_get, config_exists

#### 🧠 Embedding Cascade
- **Provider cascade** — Ollama (free/local) → OpenAI (paid) → simpleEmbed v2 (offline)
- **simpleEmbed v2** — Enhanced with bi-grams, char n-grams, TF-IDF weighting, positional encoding
- **Semantic caching** — 5000-entry LRU cache, eliminates redundant API calls
- **Rate limiting** — Per-provider request throttling
- **Cost tracking** — Session-level token and USD tracking for OpenAI
- **New Smart Tool** — `swarm_embeddings` with actions: embed, health, costs, reset_costs, backend_health, backend_migrate, backend_health_all

#### 🗄️ Vector Backends
- **6 adapters** — Local HNSW, ChromaDB, Supabase pgvector, Qdrant Cloud, Pinecone, Turso
- **Backend migration** — Migrate all documents between any two backends
- **Health-check & fallback** — Auto-fallback to local if external backend is unavailable
- **TTL / data retention** — Automatic cleanup of old vectors by configurable TTL

#### 🧲 Auto-Index & Smart Memory
- **Auto-indexing** — Completed tasks, file changes, and code reviews are indexed automatically
- **Smart context injection** — Searches memory before task assignment for relevant past solutions
- **Self-correction loop** — Finds past error fixes and applies them to new similar errors
- **Conflict resolution memory** — Remembers merge conflict resolution patterns for automated resolution
- **New Smart Tool** — `swarm_memory` with 8 actions

#### 📊 Analytics
- **Local persistent storage** — Task history and agent metrics in JSON (`.swarm/analytics.json`)
- **Agent performance** — Tasks completed, avg duration, specializations per agent
- **New Smart Tool** — `swarm_analytics` with actions: log_task, log_event, get_tasks, get_events, get_metrics, summary, cleanup

#### 👤 Agent Profiles
- **6 specialist profiles** — frontend, backend, security, devops, fullstack, custom
- **Context-aware instructions** — Each profile provides priorities and skill lists
- **New Smart Tool** — `swarm_profiles` with actions: get, list, default, instructions

#### ⏰ Scheduled Tasks
- **Cron-like scheduler** — Define recurring tasks with standard cron syntax
- **Due-check system** — Tasks checked on agent heartbeat
- **New Smart Tool** — `swarm_scheduler` with actions: add, list, check_due, remove

#### 🔌 Plugin System
- **User extensions** — Load custom plugins from `~/.swarm/plugins/`
- **Plugin types** — embedding, vectorBackend, hook, command
- **Dynamic import** — Auto-discovers and loads `.js`/`.mjs` plugins
- **New Smart Tool** — `swarm_plugins` with actions: discover, load, load_all, init_dir

#### 🔄 GitHub Sync
- **Auth auto-detection** — gh CLI → git credential → GITHUB_TOKEN env → Vault
- **Two-way sync** — GitHub Issues ↔ Swarm Tasks with label filtering
- **Issue CRUD** — Create, close, and comment on issues directly from agent
- **New Smart Tool** — `swarm_github` with actions: auth_status, list_issues, create_issue, close_issue, sync_from_github

### Changed
- **Smart Tools: 27 → 35** — Eight new tools added for v1.2.0 features
- **Tool index** — New `v120.ts` module houses all v1.2.0 tool definitions
- **Full type safety in v120.ts** — All `any` types replaced with `z.infer` schemas and explicit type assertions

### Improved (Round 2)

#### 🔐 Vault Password Rotation
- **`swarm_vault rotate`** — Re-encrypts vault with new password, preserves all keys
- **Fresh salt** — New PBKDF2 salt generated on each rotation for maximum security

#### ⏰ Scheduled Tasks Persistence
- **`lastRun` persistence** — Task execution timestamps saved to `config.json`, survive restarts
- **`check_missed` action** — Detects tasks that were due while Companion was offline
- **Trailing space fix** — Generated task IDs no longer contain trailing spaces

#### 🔌 Plugin Lifecycle
- **`onUnload` hook** — Plugins can now clean up resources (timers, connections) on unload
- **Cross-platform imports** — Fixed path normalization using `pathToFileURL` for safe dynamic imports

#### 🗄️ Vector Backend Switch
- **`backend_switch` action** — Change active backend via `swarm_embeddings`
- **Migration suggestion** — Warns if old backend has data and suggests migration to prevent data loss

### Improved (Round 3 — Type Safety & Code Quality)

#### 🛡️ Full Type Safety
- **`err: any` → `err: unknown`** — All ~15 catch blocks migrated to safe `unknown` error handling
- **`getErrorMessage()` utility** — Centralized error-to-string conversion with stack trace support (`utils/errors.ts`)
- **`as any` elimination** — 12 typed interfaces for vector backends (Qdrant, Supabase, Pinecone, Chroma, Turso, HNSW) replace all `as any` in `vectorBackend.ts`
- **`wrapResult(unknown)`** — Changed from `any` to `unknown` in all 9 smartTools files
- **Zod schema extraction** — Smart tool schemas moved to `const` objects for reuse and IDE autocomplete

#### 🔐 Vault Audit & Auto-Lock
- **Audit trail** — `swarm_vault({ action: "audit" })` returns last 500 operations with timestamps, agent names, and details
- **Auto-lock timer** — Vault auto-locks after configurable idle timeout (`SWARM_VAULT_TIMEOUT`, default 30 min)
- **`VaultAuditEntry` type** — Fully typed audit log entries

#### ⏰ Scheduled Task Pause/Resume
- **`pauseScheduledTask()`** — Pause individual scheduled tasks without removing them
- **`resumeScheduledTask()`** — Resume paused tasks, preserving next execution time
- **Per-task `enabled` field** — Tasks can be selectively disabled/enabled

#### 🩺 Doctor JSON Output
- **`mcp-swarm-doctor --json`** — Machine-readable diagnostic output for CI/CD pipelines
- **`DoctorResult` type** — Structured check results: `{ name, status, message, details }`
- **`runDoctorChecks()` export** — Programmatic access to all health checks

#### 🔄 100% ESM Migration
- **`require("node:crypto")` → `import { createHmac }`** — in `githubApi.ts`
- **`require("node:os")` → `import os`** — in `briefings.ts`
- **`require("ws")` → `import WebSocket`** — in `companion.ts` with safe `wsState` wrapper
- **Zero `require()` calls remaining** — Project is now fully ESM-only

#### 🧪 New Tests
- **`companionBridge.test.ts`** — 18 tests covering BridgeManager, CompanionControl, verifyWebhookSignature, Briefings exports, and Bridge type safety
- **HMAC verification tests** — Valid/invalid/wrong-secret/empty-payload scenarios

#### 📝 Code Quality
- **File-level `eslint-disable`** — Clean annotation for MCP SDK `input: any` limitation (10 smartTools files)
- **Debug log cleanup** — Removed `console.log` artifacts from test files
- **`companion.ts` WebSocket safety** — Extracted `wsState` object to prevent null-reference errors

---

## [1.1.6] - 2026-02-10

### What's New

#### 🏗️ Hub Architecture Refactoring
- **Modular services** — Hub refactored from 846-line monolith into clean modules: `types.ts`, `services/events.ts`, `services/tasks.ts`, `services/agents.ts`
- **Thin entrypoint** — `index.ts` now delegates to services, making the codebase maintainable
- **Legacy cleanup** — Removed `smartTools.legacy.ts` (144KB dead code)

#### 📊 Dashboard 2.0
- **Chart.js graphs** — Bar chart for tasks over 24h, doughnut chart for agent activity
- **Pulse Timeline** — Live heartbeat visualization of all connected agents
- **WebSocket updates** — Replaced `meta http-equiv="refresh"` with WebSocket for real-time updates
- **Global Swarm Control** — Stop/Resume entire swarm directly from dashboard via Hub API

#### 🔒 API Security
- **X-Swarm-Secret middleware** — All `/api/*` endpoints validate `X-Swarm-Secret` header when `SWARM_AUTH_TOKEN` is set
- **Rate Limiting** — Built-in 100 requests/IP/minute limiter with `429 Too Many Requests` response

#### 🧪 E2E Testing
- **Full lifecycle test** — Hub → Task → Claim → Release → Lock → Unlock → Stop → Resume
- **Rate limit test** — Validates the 429 protection works correctly
- **Vitest-based** — Consistent with existing test suite

#### 🦙 Optional Ollama Integration
- **Local LLM support** — `swarm_booster` now supports `ollama_generate` task type for complex operations
- **Cost savings** — Use local Ollama models (codellama:7b) instead of expensive API calls
- **Fully optional** — Without `ollamaUrl` in config, everything works exactly as before
- **Smart detection** — `can_boost` detects refactoring/optimization tasks when Ollama is available

---

## [1.1.5] - 2026-02-09

### What's New

#### 📱 Interactive Telegram Bot
- **Task creation from chat** — Send `/new` or just type a task description; the bot confirms and creates it via Hub API.
- **AI Intent Matching** — Natural language recognition for Russian and English. Type "статус", "задачи", "agents", "stop", "logs" — no slash commands needed.
- **Push notifications from Hub** — Hub automatically sends real-time events (task created/completed, agent died, swarm stopped/resumed) to your Telegram via `POST /notify`.
- **Inline task management** — View details, mark as done, cancel, or change priority using inline buttons directly in chat.
- **Stop/Resume from Telegram** — Control the swarm with buttons, no need to open IDE.
- **Event logs** — `/logs` command to view recent swarm events.

#### 📊 Mini App Dashboard
- **Telegram Web App** — Real-time dashboard accessible via `/app` endpoint inside Telegram.
- **WebSocket connection** — Live updates of agents, tasks, and events from Hub.
- **Dark theme** — Adapts to Telegram's theme variables (`--tg-theme-*`).
- **Control buttons** — Refresh status and stop swarm directly from the Mini App.

#### ⚡ Performance & Reliability
- **Notification batching** — Uses Durable Object Alarm API to batch multiple events into a single message (2s debounce).
- **Hub response caching** — Cached responses in Durable Object with 30s TTL to reduce Hub load.
- **Cron heartbeat** — Scheduled handler runs every 10 minutes; sends status digest if agents are active.

#### 🏗️ Hub Enhancements
- **Task CRUD API** — `POST /api/create_task`, `POST /api/update_task`, `GET /api/task/:id`, `GET /api/logs` endpoints.
- **Telegram webhook integration** — Hub calls `notifyTelegram()` on key events via `appendEvent()` hook.
- **Simplified config** — Only `TELEGRAM_BOT_URL` needed in Hub (no more `TELEGRAM_CHAT_ID`); chatId comes from Telegram updates.

#### 🔧 Deploy Your Own Telegram Bot

1. Create a bot via [@BotFather](https://t.me/BotFather) and copy the token
2. Deploy the worker:
   ```bash
   cd cloudflare/telegram-bot
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler deploy
   ```
3. Set up the webhook:
   ```bash
   curl https://YOUR-TELEGRAM-BOT.workers.dev/setup
   ```
4. Add to your MCP config:
   ```json
   "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
   "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
   ```

> 📱 See [TELEGRAM.md](./TELEGRAM.md) for detailed instructions (English + Russian).

---

## [1.1.3] - 2026-02-09

### What's New

#### 📱 Telegram Bot Integration
- **Full Telegram notifications** — Task events, agent status, CI errors, code reviews — all delivered to your Telegram.
- **Bilingual setup guide** — Complete `TELEGRAM.md` with step-by-step instructions in English and Russian.
- **@userinfobot support** — Easy way to discover your Telegram User ID.
- **Bot commands** — `/start`, `/projects`, `/status`, `/agents`, `/tasks`, `/myid`, `/reviews`, `/approve`, `/reject`.
- **Environment variables** — `TELEGRAM_USER_ID` and `TELEGRAM_BOT_URL` for all MCP configurations.

#### 🏗️ Code Quality & Security
- **ESLint + Prettier** — Full linting and formatting setup with `typescript-eslint`. Scripts: `lint`, `lint:fix`, `format`, `format:check`.
- **fs-sandbox** — File system sandbox (`src/fsSandbox.ts`) prevents path-traversal attacks by restricting agent file operations to the project boundary.
- **Dashboard refactoring** — Extracted 133-line inline HTML from `companion.ts` into `dashboard.ts` module.

#### 🔭 Observability & Control
- **File Logging** — Companion logs to `~/.mcp-swarm/logs/companion-YYYY-MM-DD.log` with 7-day rotation.
- **`mcp-swarm-doctor`** — CLI diagnostics: Node.js, Git, companion status, ports, logs, Hub URL, IDE configs.
- **Interactive Dashboard** — Pause/Resume/Shutdown buttons + Toast notifications at `http://localhost:37373`.
- **Auto-Update Notifier** — Warns on startup if a newer npm version is available.

#### 🐝 Web Dashboard
- **Dark-themed dashboard** at `http://localhost:37373` with auto-refresh every 5s.
- **PID file** + **Graceful shutdown** — `~/.mcp-swarm/companion.pid` with SIGTERM/SIGINT handlers.
- **`/health` endpoint** — `{ ok, pid, uptime }` for monitoring.
- **Unit tests** — Tests for `normalizeGitRemote` and PID file management.

---

### Configuration

**Option A: Remote (Recommended)**

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

| Variable | Required | Description |
|----------|----------|-------------|
| `SWARM_HUB_URL` | ✅ | WebSocket URL of your deployed Hub worker |
| `TELEGRAM_USER_ID` | Optional | Your Telegram User ID (get it via [@userinfobot](https://t.me/userinfobot)) |
| `TELEGRAM_BOT_URL` | Optional | URL of your deployed Telegram bot worker |

> 📱 See [TELEGRAM.md](./TELEGRAM.md) for full Telegram setup instructions.

---

### Platform Highlights

These are the key capabilities built into MCP Swarm across all versions:

#### 🛠 26 Smart Tools
Consolidated from 54 tools — zero feature loss, 2× fewer IDE slots. Each tool uses an `action` parameter for multiple operations.

#### 🧠 MoE Router — 19 AI Models
Intelligent model routing with cost optimization. Supports Anthropic (Claude Opus 4.6), OpenAI (GPT-5.3 Codex), Google (Gemini 3), and Moonshot (Kimi K2.5).

#### 🛡️ AIDefence
<10ms threat detection: prompt injection, jailbreak, code injection, data exfiltration, social engineering. Configurable sensitivity levels.

#### 🤝 Distributed Consensus
Raft-like leader election, BFT mode, proposal system with configurable voting thresholds.

#### 🔍 HNSW Vector Search
150×–12,500× faster than brute force. Pure TypeScript, cosine/euclidean/dot product.

#### 🌐 Cloudflare Workers
Self-hosted infrastructure: Hub, MCP Server, Telegram Bot — all on Cloudflare Free Tier.

#### 🔄 Full Bridge Coverage
All 26 Smart Tools work through Remote Bridge. Universal delegation via `toolName.startsWith("swarm_")`.

#### 📦 One-Click Installer
`npx mcp-swarm-install` — auto-detects IDEs, merges configs, supports `--telegram-user-id`.

#### 🚀 Smart Router & Memory
Cost optimization (Opus → Sonnet downgrade), semantic cache, 3-tier hybrid memory system.

#### 👥 Agent Teams & Skills
Multi-agent coordination with roles. Cross-IDE skill discovery (Gemini, Claude, Cursor, Windsurf, Codex).

---

### Full Changelog

For the complete version-by-version changelog, see the [GitHub Releases](https://github.com/AbdrAbdr/MCP-Swarm/releases).
