## 🌉 v1.0.6 — Full Bridge Coverage (All 26 Smart Tools via Remote)

### Fixed
- **Critical: Bridge auto-start** — `mcp-swarm-remote` now passes `MCP_SERVER_URL` to companion daemon. Previously the companion couldn't know where to connect, so all remote tool calls returned `{ bridgeConnected: false }`.
- **Documentation: Full startup flow** — README now includes complete configuration examples for both Remote and Local modes with `SWARM_HUB_URL`, and step-by-step explanation of what happens at startup.

### Changed
- **Universal bridge delegation** — `bridge.ts` now imports `allSmartTools` handlers and delegates ALL tool calls (was only 3 tools with limited actions).
- **Simplified tool routing** — `toolNeedsBridge()` simplified to `toolName.startsWith("swarm_")` — routes ALL swarm tools through bridge.

### Configuration

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

### What Happens at Startup (Remote)

```
1. npx downloads mcp-swarm@latest from npm (currently 1.0.6)
2. mcp-swarm-remote starts → checks if companion is running
3. If not → starts companion with:
   • MCP_SERVER_URL (from --url) → Bridge auto-connects to your Worker
   • SWARM_HUB_URL (from env)   → WebSocket to Hub for coordination
4. Companion starts:
   • Bridge → WebSocket → MCP Server Worker (executes 26 tools locally)
   • Hub    → WebSocket → Hub Worker (real-time agent sync)
5. All 26 smart tools work! ✅
```

### Stats

| Metric | v1.0.4 | v1.0.6 |
|--------|--------|--------|
| Tools via bridge | 3 | **26** |
| Bridge auto-start | ❌ | ✅ |
| `executeLocalTool()` | 82 lines | **40 lines** |
| `toolNeedsBridge()` | 21 lines | **4 lines** |

### Upgrade

```bash
npm install -g mcp-swarm@latest
```
