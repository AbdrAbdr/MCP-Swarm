# MCP Swarm Remote Setup Guide

This guide explains how to use MCP Swarm remotely via Cloudflare Workers, without running any local servers.

## Architecture

```
┌──────────────┐    stdio    ┌─────────────────┐   HTTPS   ┌────────────────┐
│   Your IDE   │◄──────────►│ mcp-swarm-remote │◄────────►│ Cloudflare MCP │
│ (OpenCode,   │             │   (local proxy)  │           │    Worker      │
│ Claude, etc) │             └─────────────────┘           └───────┬────────┘
└──────────────┘                                                    │ WebSocket
                                                                    ▼
                                                           ┌────────────────┐
                                                           │  Cloudflare    │
                                                           │     Hub        │
                                                           └────────────────┘
```

## 🆓 Cloudflare Workers — IT'S FREE!

MCP Swarm runs on Cloudflare Workers. **You don't need to pay anything!**

**Free Tier Limits (more than enough for personal use):**

| Resource | Free Limit | For MCP Swarm |
|----------|------------|---------------|
| **Workers Requests** | 100,000 / day | ~1000 agents/day |
| **Durable Objects Requests** | 1,000,000 / month | Enough for a large team |
| **Durable Objects Storage** | 1 GB | Years of message history |
| **WebSocket Messages** | Unlimited | ∞ |
| **CPU Time** | 10ms / request | Sufficient |

---

## Quick Start: Deploy Your Own Infrastructure

### Step 1: Create Cloudflare Account (free)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign up (email + password)
3. Verify email
4. **Done!** No credit card required.

### Step 2: Install the package

```bash
npm install -g mcp-swarm
```

### Step 3: Clone and deploy

```bash
# Clone the repository
git clone https://github.com/AbdrAbdr/Swarm_MCP.git
cd Swarm_MCP

# Login to Cloudflare (opens browser)
npx wrangler login

# Deploy Hub (coordination server)
cd cloudflare/hub
npx wrangler deploy
# ✅ Note the URL: wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws

# Deploy MCP Server
cd ../mcp-server
# Edit wrangler.toml - replace HUB_URL with your Hub URL from above
npx wrangler deploy
# ✅ Note the URL: https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp
```

### Step 4: Configure your IDE

**OpenCode** (`~/.opencode/config.json`):
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

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": [
        "-y",
        "-p", "mcp-swarm",
        "mcp-swarm-remote",
        "--url", "https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp"
      ]
    }
  }
}
```

---

## (Optional) Deploy Telegram Bot

1. Open Telegram, find **@BotFather**
2. Send `/newbot` and follow instructions
3. Copy the token (looks like `123456789:ABCdef...`)

```bash
cd cloudflare/telegram-bot
# Edit wrangler.toml - replace SWARM_HUB_URL with your Hub URL

# Add token as secret
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Paste your token and press Enter

npx wrangler deploy
# ✅ Note the URL: https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev

# Set webhook (replace YOUR_TOKEN and YOUR-SUBDOMAIN)
curl "https://api.telegram.org/botYOUR_TOKEN/setWebhook?url=https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev/webhook"
```

### Get your Telegram User ID

1. Open **your bot** in Telegram
2. Send `/start`
3. Bot will show your **User ID**
4. Add `--telegram-user-id YOUR_ID` to your IDE config

---

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--url` | MCP server URL | (required) |
| `--telegram-user-id` | Your Telegram ID for notifications | (none) |
| `--no-companion` | Don't auto-start companion | false |
| `--debug` | Enable debug logging to stderr | false |

---

## Troubleshooting

### Connection refused / timeout

```bash
# Test your server directly (replace YOUR-SUBDOMAIN)
curl -X POST "https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

Expected: JSON response with `result.serverInfo.name = "mcp-swarm"`

### Debug mode

Add `--debug` to see detailed logs:

```json
{
  "args": ["-y", "-p", "mcp-swarm", "mcp-swarm-remote", "--url", "...", "--debug"]
}
```

### IDE doesn't see the tools

1. Restart your IDE completely
2. Check MCP server logs in IDE developer console
3. Try running `npx -y -p mcp-swarm mcp-swarm-remote --debug` manually

---

## What is YOUR-SUBDOMAIN?

When you deploy a Worker, Cloudflare automatically creates a URL:
```
https://mcp-swarm-hub.abdr.workers.dev
                      ^^^^
                      This is your subdomain (account name)
```

You will see it in the output of `npx wrangler deploy`.

---

## Protocol Details

MCP Swarm uses the **Streamable HTTP** transport (MCP spec 2025-03-26):

- All requests are `POST /mcp` with `Content-Type: application/json`
- Session management via `Mcp-Session-Id` header
- Responses are immediate JSON (no streaming/SSE)
- Compatible with Cloudflare Workers (no buffering issues)

### Request example

```http
POST /mcp HTTP/1.1
Host: mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev
Content-Type: application/json
Mcp-Session-Id: abc123

{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

### Response example

```http
HTTP/1.1 200 OK
Content-Type: application/json
Mcp-Session-Id: abc123

{"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}
```

---

## Comparison: Local vs Remote

| Feature | Local (`mcp-swarm`) | Remote (`mcp-swarm-remote`) |
|---------|---------------------|----------------------------|
| Setup | More complex | Just configure URL |
| Latency | Faster | ~50-100ms per request |
| Works offline | Yes | No |
| Multi-device | No | Yes (same Hub) |
| Updates | Manual | Automatic (server-side) |

---

## Security

- All traffic is HTTPS encrypted
- Session IDs are randomly generated UUIDs
- Optional Telegram authentication via user ID
- Self-hosted = full data control

---

## Need Help?

- [GitHub Issues](https://github.com/AbdrAbdr/Swarm_MCP/issues)
