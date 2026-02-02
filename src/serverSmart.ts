/**
 * MCP Swarm v0.9.0 - Smart Tools Server
 * 
 * Consolidates 168+ individual tools into 41 Smart Tools with `action` parameter.
 * Each Smart Tool groups related functionality for better UX.
 * 
 * Usage: node dist/serverSmart.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { allSmartTools } from "./smartTools.js";

const server = new McpServer({
  name: "mcp-swarm",
  version: "0.9.0",
});

// Register all 41 Smart Tools
for (const tool of allSmartTools) {
  const [name, config, handler] = tool;
  server.tool(name, config, handler as any);
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[MCP Swarm v0.9.0] ${allSmartTools.length} Smart Tools registered`);
  console.error(`[MCP Swarm v0.9.0] Tools: ${allSmartTools.map(t => t[0]).join(", ")}`);
}

main().catch((err) => {
  console.error("[MCP Swarm] Fatal error:", err);
  process.exit(1);
});
