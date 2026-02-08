/**
 * MCP Swarm v0.9.17 - Smart Tools Server (Modular)
 * 
 * 54 Smart Tools organized into 9 modular categories:
 * core, tasks, files, git, collaboration, security, analytics, intelligence, infra
 * 
 * Usage: node dist/serverSmart.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { allSmartTools } from "./smartTools/index.js";
import { readFileSync } from "fs";

// Dynamic version from package.json
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const server = new McpServer({
  name: "mcp-swarm",
  version: pkg.version,
});

// Register all Smart Tools
for (const tool of allSmartTools) {
  const [name, config, handler] = tool;
  server.tool(name, config, handler as any);
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[MCP Swarm v${pkg.version}] ${allSmartTools.length} Smart Tools registered`);
}

main().catch((err) => {
  console.error("[MCP Swarm] Fatal error:", err);
  process.exit(1);
});
