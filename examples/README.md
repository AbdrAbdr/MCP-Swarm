# Examples

Ready-to-use MCP Swarm configurations for popular IDEs.

## Remote Mode (Recommended)

Each folder contains a `mcp_config.json` you can copy to your IDE:

| IDE | Config Path | Example |
|-----|-------------|---------|
| **Claude Code** | `~/.claude/mcp_config.json` | [claude-code/](./claude-code/) |
| **Cursor** | `.cursor/mcp.json` | [cursor/](./cursor/) |
| **Windsurf** | `.windsurf/mcp.json` | [windsurf/](./windsurf/) |
| **OpenCode** | `opencode.json` | [opencode/](./opencode/) |
| **Antigravity** | `~/.gemini/antigravity/mcp_config.json` | Same as Claude Code |

## Local Mode

If you don't want to use Cloudflare Workers:

| Mode | Example |
|------|---------|
| **Local + Hub** | [local-mode/](./local-mode/) |

## Setup

1. Replace `YOUR-SUBDOMAIN` with your actual Cloudflare subdomain
2. Copy the config file to the appropriate location for your IDE
3. Restart your IDE

See the [main README](../README.md) for full setup instructions.
