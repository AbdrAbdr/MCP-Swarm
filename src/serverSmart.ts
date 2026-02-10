/**
 * MCP Swarm v1.1.0 - Smart Tools Server (Modular)
 * 
 * 26 Consolidated Smart Tools organized into 9 modular categories:
 * core (2), tasks (2), files (2), git (1), collaboration (4),
 * security (1), analytics (3), intelligence (4), infra (7)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MCP SDK server.tool() has 6 overloads; readonly tuples can't match mutable params
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
