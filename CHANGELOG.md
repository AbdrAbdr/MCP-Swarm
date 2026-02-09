> <img src="https://flagcdn.com/20x15/ru.png" alt="RU" /> [Читать на русском](./CHANGELOG.ru.md)

# Changelog

All notable changes to the MCP Swarm project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
