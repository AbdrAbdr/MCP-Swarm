#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { AGENT_RULES_CONTENT } from "../workflows/constants.js";

const execFileAsync = promisify(execFile);

// All supported IDEs and their rules files
const IDE_RULES_FILES = [
  { name: "Claude Desktop / Claude Code", file: "CLAUDE.md" },
  { name: "Antigravity / Gemini", file: "GEMINI.md" },
  { name: "OpenCode / Generic", file: "AGENT.md" },
  { name: "Multi-agent systems", file: "AGENTS.md" },
  { name: "Cursor", file: ".cursorrules" },
  { name: "Windsurf", file: ".windsurfrules" },
  { name: "VS Code (Roo-Cline)", file: ".clinerules" },
];

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function installAgentRules(fileName: string, projectPath: string): Promise<boolean> {
  const rulesPath = path.join(projectPath, fileName);
  
  // Check if file exists and has content
  let existingContent = "";
  try {
    existingContent = await fs.readFile(rulesPath, "utf8");
  } catch {
    // file doesn't exist
  }

  // Check if MCP Swarm rules already present
  if (existingContent.includes("# MCP Swarm Agent Rules")) {
    return false; // already installed
  }

  // Append or create
  const newContent = existingContent 
    ? existingContent + "\n\n" + AGENT_RULES_CONTENT
    : AGENT_RULES_CONTENT;

  await fs.writeFile(rulesPath, newContent, "utf8");
  return true;
}

function getMcpConfig(projectPath: string): string {
  const normalizedPath = path.normalize(projectPath).replace(/\\/g, "/");
  const serverPath = path.join(normalizedPath, "dist", "serverSmart.js").replace(/\\/g, "/");

  return JSON.stringify({
    "mcp-swarm": {
      command: "node",
      args: [serverPath],
      env: {
        SWARM_HUB_URL: "wss://mcp-swarm-hub.unilife-ch.workers.dev/ws",
        SWARM_PROJECT: "default",
      },
    },
  }, null, 2);
}

async function main() {
  console.log("🐝 MCP Swarm v0.9.0 - Agent Rules Installer");
  console.log("=".repeat(50));

  // Get project path
  const projectPath = path.resolve(process.cwd());
  console.log(`📁 Project path: ${projectPath}`);

  // Check if built
  const serverPath = path.join(projectPath, "dist", "serverSmart.js");
  if (!(await fileExists(serverPath))) {
    console.log("⚠️  Server not built. Running npm run build...");
    try {
      await execFileAsync("npm", ["run", "build"], { cwd: projectPath, windowsHide: true });
      console.log("✅ Build completed");
    } catch (err: any) {
      console.error("❌ Build error:", err?.message);
      process.exit(1);
    }
  }

  // Install agent rules for all IDEs
  console.log("\n📜 Installing agent rules files...");
  const installed: string[] = [];
  const skipped: string[] = [];

  for (const ide of IDE_RULES_FILES) {
    try {
      const wasInstalled = await installAgentRules(ide.file, projectPath);
      if (wasInstalled) {
        installed.push(ide.file);
        console.log(`   ✅ ${ide.file} - created (${ide.name})`);
      } else {
        skipped.push(ide.file);
        console.log(`   ⏭️  ${ide.file} - already has MCP Swarm rules`);
      }
    } catch (err: any) {
      console.log(`   ❌ ${ide.file}: ${err?.message}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("🎉 Agent rules installation complete!");
  console.log(`   Created: ${installed.length} files`);
  console.log(`   Skipped: ${skipped.length} files (already configured)`);

  // Show manual MCP installation instructions
  console.log("\n" + "=".repeat(50));
  console.log("📦 MANUAL MCP SERVER INSTALLATION");
  console.log("=".repeat(50));
  console.log("\nAdd this to your IDE's MCP config file:\n");
  console.log(getMcpConfig(projectPath));

  console.log("\n📍 Config file locations:");
  console.log("   Claude Desktop: %APPDATA%\\Claude\\claude_desktop_config.json");
  console.log("   Cursor:         ~/.cursor/mcp.json");
  console.log("   Windsurf:       ~/.windsurf/mcp_config.json");
  console.log("   Antigravity:    %APPDATA%\\antigravity\\mcp_config.json");
  console.log("   OpenCode:       ~/.config/opencode/opencode.json");
  console.log("   VS Code:        Roo-Cline extension settings");

  console.log("\n📊 MCP Swarm v0.9.0 Statistics:");
  console.log("   - 41 Smart Tools (consolidated from 168+)");
  console.log("   - Each tool has multiple actions via 'action' parameter");
  console.log("   - Supports 50+ agents simultaneously");

  console.log("\n🚀 After adding MCP config, restart your IDE!");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
