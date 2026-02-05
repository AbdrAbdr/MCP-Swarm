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

## Quick Start (Use Public Server)

The fastest way to get started - use the public MCP Swarm server:

### Step 1: Install the package

```bash
npm install -g mcp-swarm
```

### Step 2: Configure your IDE

**OpenCode** (`~/.opencode/config.json`):
```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": [
        "mcp-swarm-remote",
        "--url", "https://mcp-swarm-server.unilife-ch.workers.dev/mcp",
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
        "mcp-swarm-remote",
        "--url", "https://mcp-swarm-server.unilife-ch.workers.dev/mcp"
      ]
    }
  }
}
```

### Step 3: Get your Telegram User ID (optional)

1. Message [@MyCFSwarmBot](https://t.me/MyCFSwarmBot) on Telegram
2. Send `/start` to get your user ID
3. Add `--telegram-user-id YOUR_ID` to receive task notifications

---

## Self-Hosted Setup (Deploy Your Own)

For production use or data privacy, deploy your own MCP Swarm infrastructure.

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Node.js 18+

### Step 1: Clone the repository

```bash
git clone https://github.com/AbdrAbdr/Swarm_MCP.git
cd Swarm_MCP
npm install
```

### Step 2: Deploy the Hub (coordination server)

```bash
cd cloudflare/hub
npx wrangler login  # if not already logged in
npx wrangler deploy
```

Note the deployed URL (e.g., `https://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev`)

### Step 3: Deploy the MCP Server

```bash
cd ../mcp-server
# Edit wrangler.toml to set your hub URL
npx wrangler deploy
```

Note the deployed URL (e.g., `https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev`)

### Step 4: (Optional) Deploy Telegram Bot

```bash
cd ../telegram
# Set environment variables in wrangler.toml or secrets
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler deploy
```

### Step 5: Configure your IDE

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": [
        "mcp-swarm-remote",
        "--url", "https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp"
      ]
    }
  }
}
```

---

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--url` | MCP server URL | `https://mcp-swarm-server.unilife-ch.workers.dev/mcp` |
| `--telegram-user-id` | Your Telegram ID for notifications | (none) |
| `--debug` | Enable debug logging to stderr | false |

---

## Troubleshooting

### Connection refused / timeout

```bash
# Test the server directly
curl -X POST "https://mcp-swarm-server.unilife-ch.workers.dev/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

Expected: JSON response with `result.serverInfo.name = "mcp-swarm"`

### Debug mode

Add `--debug` to see detailed logs:

```json
{
  "args": ["mcp-swarm-remote", "--url", "...", "--debug"]
}
```

### IDE doesn't see the tools

1. Restart your IDE completely
2. Check MCP server logs in IDE developer console
3. Try running `npx mcp-swarm-remote --debug` manually

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
Host: mcp-swarm-server.unilife-ch.workers.dev
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
- Self-hosted option for full data control

---

## Need Help?

- [GitHub Issues](https://github.com/AbdrAbdr/Swarm_MCP/issues)
- [Telegram Bot](https://t.me/MyCFSwarmBot)
