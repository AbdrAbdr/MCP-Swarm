#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile, exec } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

type IdeConfig = {
  name: string;
  configPaths: string[];
  mcpKey: string;
  executableNames: string[]; // исполняемые файлы для проверки
  processNames: string[]; // имена процессов для проверки
};

const IDE_CONFIGS: IdeConfig[] = [
  {
    name: "Windsurf",
    configPaths: getWindsurfPaths(),
    mcpKey: "mcpServers",
    executableNames: ["windsurf", "windsurf.exe", "Windsurf.exe"],
    processNames: ["windsurf", "Windsurf"],
  },
  {
    name: "Cursor",
    configPaths: getCursorPaths(),
    mcpKey: "mcpServers",
    executableNames: ["cursor", "cursor.exe", "Cursor.exe"],
    processNames: ["cursor", "Cursor"],
  },
  {
    name: "Claude Desktop",
    configPaths: getClaudePaths(),
    mcpKey: "mcpServers",
    executableNames: ["claude", "Claude.exe", "Claude Desktop.exe"],
    processNames: ["claude", "Claude"],
  },
  {
    name: "OpenCode",
    configPaths: getOpenCodePaths(),
    mcpKey: "mcpServers", // OpenCode использует mcpServers, не servers
    executableNames: ["opencode", "opencode.exe"],
    processNames: ["opencode"],
  },
  {
    name: "VS Code",
    configPaths: getVSCodePaths(),
    mcpKey: "mcpServers",
    executableNames: ["code", "code.exe", "Code.exe"],
    processNames: ["code", "Code"],
  },
];

function getWindsurfPaths(): string[] {
  const home = os.homedir();
  if (process.platform === "win32") {
    return [
      path.join(home, "AppData", "Roaming", "Windsurf", "mcp_config.json"),
      path.join(home, ".windsurf", "mcp_config.json"),
    ];
  }
  if (process.platform === "darwin") {
    return [
      path.join(home, "Library", "Application Support", "Windsurf", "mcp_config.json"),
      path.join(home, ".windsurf", "mcp_config.json"),
    ];
  }
  return [
    path.join(home, ".config", "Windsurf", "mcp_config.json"),
    path.join(home, ".windsurf", "mcp_config.json"),
  ];
}

function getCursorPaths(): string[] {
  const home = os.homedir();
  if (process.platform === "win32") {
    return [
      path.join(home, "AppData", "Roaming", "Cursor", "User", "globalStorage", "cursor.mcp", "mcp.json"),
      path.join(home, ".cursor", "mcp.json"),
    ];
  }
  if (process.platform === "darwin") {
    return [
      path.join(home, "Library", "Application Support", "Cursor", "User", "globalStorage", "cursor.mcp", "mcp.json"),
      path.join(home, ".cursor", "mcp.json"),
    ];
  }
  return [
    path.join(home, ".config", "Cursor", "User", "globalStorage", "cursor.mcp", "mcp.json"),
    path.join(home, ".cursor", "mcp.json"),
  ];
}

function getClaudePaths(): string[] {
  const home = os.homedir();
  if (process.platform === "win32") {
    return [
      path.join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json"),
    ];
  }
  if (process.platform === "darwin") {
    return [
      path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    ];
  }
  return [
    path.join(home, ".config", "Claude", "claude_desktop_config.json"),
  ];
}

function getOpenCodePaths(): string[] {
  const home = os.homedir();
  if (process.platform === "win32") {
    return [
      path.join(home, "AppData", "Roaming", "opencode", "mcp.json"),
      path.join(home, ".opencode", "mcp.json"),
    ];
  }
  if (process.platform === "darwin") {
    return [
      path.join(home, "Library", "Application Support", "opencode", "mcp.json"),
      path.join(home, ".opencode", "mcp.json"),
    ];
  }
  return [
    path.join(home, ".config", "opencode", "mcp.json"),
    path.join(home, ".opencode", "mcp.json"),
  ];
}

function getVSCodePaths(): string[] {
  const home = os.homedir();
  if (process.platform === "win32") {
    return [
      path.join(home, "AppData", "Roaming", "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "mcp_settings.json"),
    ];
  }
  if (process.platform === "darwin") {
    return [
      path.join(home, "Library", "Application Support", "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "mcp_settings.json"),
    ];
  }
  return [
    path.join(home, ".config", "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "mcp_settings.json"),
  ];
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonSafe(p: string): Promise<any> {
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJsonSafe(p: string, data: any): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/**
 * Проверяет, установлена ли IDE по исполняемому файлу
 */
async function isIdeInstalled(ide: IdeConfig): Promise<boolean> {
  // Метод 1: Проверяем существование конфиг файла
  for (const configPath of ide.configPaths) {
    if (await fileExists(configPath)) {
      return true;
    }
  }

  // Метод 2: Проверяем наличие исполняемого файла в PATH
  for (const execName of ide.executableNames) {
    try {
      if (process.platform === "win32") {
        await execAsync(`where ${execName}`, { windowsHide: true });
        return true;
      } else {
        await execAsync(`which ${execName}`);
        return true;
      }
    } catch {
      // Не найден в PATH
    }
  }

  // Метод 3: Проверяем стандартные пути установки
  const installPaths = getStandardInstallPaths(ide.name);
  for (const installPath of installPaths) {
    if (await fileExists(installPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Возвращает стандартные пути установки для IDE
 */
function getStandardInstallPaths(ideName: string): string[] {
  const home = os.homedir();
  const paths: string[] = [];

  if (process.platform === "win32") {
    const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";
    const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");

    switch (ideName) {
      case "Windsurf":
        paths.push(
          path.join(localAppData, "Programs", "Windsurf", "Windsurf.exe"),
          path.join(programFiles, "Windsurf", "Windsurf.exe"),
        );
        break;
      case "Cursor":
        paths.push(
          path.join(localAppData, "Programs", "cursor", "Cursor.exe"),
          path.join(localAppData, "cursor", "Cursor.exe"),
          path.join(programFiles, "Cursor", "Cursor.exe"),
        );
        break;
      case "Claude Desktop":
        paths.push(
          path.join(localAppData, "Programs", "claude-desktop", "Claude.exe"),
          path.join(programFiles, "Claude", "Claude.exe"),
        );
        break;
      case "OpenCode":
        paths.push(
          path.join(localAppData, "Programs", "opencode", "opencode.exe"),
        );
        break;
      case "VS Code":
        paths.push(
          path.join(localAppData, "Programs", "Microsoft VS Code", "Code.exe"),
          path.join(programFiles, "Microsoft VS Code", "Code.exe"),
        );
        break;
    }
  } else if (process.platform === "darwin") {
    switch (ideName) {
      case "Windsurf":
        paths.push("/Applications/Windsurf.app");
        break;
      case "Cursor":
        paths.push("/Applications/Cursor.app");
        break;
      case "Claude Desktop":
        paths.push("/Applications/Claude.app");
        break;
      case "OpenCode":
        paths.push("/usr/local/bin/opencode", path.join(home, ".local", "bin", "opencode"));
        break;
      case "VS Code":
        paths.push("/Applications/Visual Studio Code.app");
        break;
    }
  } else {
    // Linux
    switch (ideName) {
      case "Windsurf":
        paths.push("/usr/bin/windsurf", "/opt/Windsurf/windsurf");
        break;
      case "Cursor":
        paths.push("/usr/bin/cursor", "/opt/cursor/cursor");
        break;
      case "OpenCode":
        paths.push("/usr/local/bin/opencode", path.join(home, ".local", "bin", "opencode"));
        break;
      case "VS Code":
        paths.push("/usr/bin/code", "/usr/share/code/code");
        break;
    }
  }

  return paths;
}

/**
 * Находит первый существующий конфиг-путь или возвращает предпочтительный
 */
async function getPreferredConfigPath(ide: IdeConfig): Promise<string> {
  // Сначала ищем существующий конфиг
  for (const configPath of ide.configPaths) {
    if (await fileExists(configPath)) {
      return configPath;
    }
  }
  
  // Возвращаем первый (предпочтительный) путь
  return ide.configPaths[0];
}

async function detectInstalledIdes(): Promise<{ name: string; configPath: string; mcpKey: string; verified: boolean }[]> {
  const detected: { name: string; configPath: string; mcpKey: string; verified: boolean }[] = [];

  for (const ide of IDE_CONFIGS) {
    const isInstalled = await isIdeInstalled(ide);
    
    if (isInstalled) {
      const configPath = await getPreferredConfigPath(ide);
      const configExists = await fileExists(configPath);
      
      detected.push({
        name: ide.name,
        configPath,
        mcpKey: ide.mcpKey,
        verified: configExists, // Точно установлена если есть конфиг
      });
    }
  }

  return detected;
}

function getMcpSwarmConfig(projectPath: string): any {
  // Нормализуем путь для текущей платформы
  const normalizedPath = path.normalize(projectPath);
  const serverPath = path.join(normalizedPath, "dist", "serverSmart.js");

  return {
    command: "node",
    args: [serverPath],
    env: {
      SWARM_REPO_PATH: normalizedPath,
    },
  };
}

async function installToIde(ide: { name: string; configPath: string; mcpKey: string; verified: boolean }, projectPath: string): Promise<boolean> {
  let config = await readJsonSafe(ide.configPath);
  
  if (!config) {
    // Создаём новый конфиг только если IDE верифицирована
    if (!ide.verified) {
      console.log(`   ⚠️  ${ide.name}: IDE обнаружена, но конфиг не найден. Создаю новый.`);
    }
    config = {};
  }

  if (!config[ide.mcpKey]) {
    config[ide.mcpKey] = {};
  }

  const mcpConfig = getMcpSwarmConfig(projectPath);
  config[ide.mcpKey]["mcp-swarm"] = mcpConfig;

  await writeJsonSafe(ide.configPath, config);
  return true;
}

// Agent rules content for each IDE - v0.9.0 Smart Tools
const AGENT_RULES_CONTENT = `# MCP Swarm Agent Rules (v0.9.0)

## CRITICAL: Always Start with MCP Swarm

Before ANY coding task, you MUST:

1. **Register yourself** - Call \`swarm_agent({ action: "register" })\` to get your unique agent name
2. **Check swarm status** - Call \`swarm_control({ action: "status" })\` to ensure swarm is active
3. **Check task list** - Call \`swarm_task({ action: "list" })\` to see available tasks
4. **Reserve files** - Before editing, call \`swarm_file({ action: "reserve", filePath: "...", agent: "YourName" })\`

## Agent Roles

### ORCHESTRATOR (First Agent)
The first agent that calls \`swarm_orchestrator({ action: "elect" })\` becomes the Orchestrator.
- Works in **INFINITE LOOP** - only user can stop
- Distributes tasks, monitors agent heartbeats, coordinates work
- Uses \`swarm_control({ action: "pulse" })\` to update real-time agent map

### EXECUTOR (All Other Agents)
All subsequent agents become Executors.
- Register with \`swarm_agent({ action: "register" })\`
- Get tasks via auction system
- Lock files before editing, send heartbeat, create PRs

## Workflow Rules

### Starting Work
\`\`\`
1. swarm_agent({ action: "register" }) → Get your name (e.g., "RadiantWolf")
2. swarm_task({ action: "list" }) → See what needs to be done
3. swarm_task({ action: "update", taskId, status: "in_progress", agent: "YourName" }) → Claim task
4. swarm_file({ action: "reserve", filePath: "...", agent: "YourName", exclusive: true }) → Lock files
5. Do your work
6. swarm_file({ action: "release", filePath: "...", agent: "YourName" }) → Unlock files
7. swarm_task({ action: "update", taskId, status: "done" }) → Complete task
8. swarm_git({ action: "sync" }) → Rebase before push
9. swarm_git({ action: "pr", title: "...", body: "..." }) → Open PR
\`\`\`

### Collaboration Rules
- **Never edit files locked by another agent** - Check \`swarm_file({ action: "list" })\` first
- **Broadcast important changes** - Use \`swarm_collab({ action: "broadcast", message: "..." })\`
- **Request reviews** - Use \`swarm_collab({ action: "review_request", ... })\`
- **Log your reasoning** - Use \`swarm_collab({ action: "thought", text: "..." })\`

### Safety Rules
- **Dangerous actions require voting** - Use \`swarm_voting({ action: "start", ... })\`
- **Check main health** - Use \`swarm_safety({ action: "main_health" })\`
- **Signal dependency changes** - Use \`swarm_safety({ action: "dependency_change", ... })\`

### Ghost Mode
When no tasks are assigned:
- Run \`swarm_patrol({ action: "run" })\` to check for lint errors
- Help review other agents' code
- Optimize imports and formatting

## 41 Smart Tools (v0.9.0)

| Tool | Actions |
|------|---------|
| swarm_agent | register, whoami |
| swarm_task | create, list, update, decompose, get_decomposition |
| swarm_file | reserve, release, list, forecast, conflicts, safety |
| swarm_worktree | create, list, remove |
| swarm_git | sync, pr, delete_merged, cleanup_merged |
| swarm_collab | broadcast, dashboard, review_request, review_respond, review_list, screenshot, screenshot_list, thought, thought_list |
| swarm_voting | start, vote, list |
| swarm_safety | main_health, ci_alert, immune_status, dependency_change |
| swarm_control | start, stop, status, pulse, pulse_get |
| swarm_briefing | save, load |
| swarm_knowledge | archive, search |
| swarm_urgent | trigger, get_active |
| swarm_snapshot | create, rollback |
| swarm_health | check, dead_agents, force_reassign |
| swarm_session | start, log, stop, replay |
| swarm_quality | run_gate, get_report, check_pr_ready |
| swarm_cost | log_usage, agent_costs, project_costs, budget_remaining |
| swarm_context | estimate_size, compress_briefing |
| swarm_regression | save_baseline, check, list |
| swarm_brainstorm | start, question, answer |
| swarm_design | propose, present, validate |
| swarm_plan | create, add_task, get_next, complete_step, subagent_prompt, export_markdown |
| swarm_debug | start, log_investigation, add_evidence, complete_phase1, log_patterns, complete_phase2, form_hypothesis, test_hypothesis, implement_fix, verify_fix, check_red_flags |
| swarm_spec | start, start_phase, complete_phase, export_markdown |
| swarm_qa | start, run_iteration, log_fix, get_suggestions, generate_report |
| swarm_guard | install, uninstall, run, get_config |
| swarm_cluster | init, list, get_tools, find |
| swarm_orchestrator | elect, status, dispatch_task, collect_results |
| swarm_message | send, inbox, ack, history |
| swarm_patrol | run |
| swarm_scan | run |
| swarm_platform | check |

## Quick Reference

### Core Operations
\`\`\`typescript
swarm_agent({ action: "register" })                    // Get agent name
swarm_task({ action: "list" })                         // List all tasks
swarm_file({ action: "reserve", filePath, agent })     // Lock file
swarm_git({ action: "pr", title, body })               // Create PR
\`\`\`

### Orchestrator Operations
\`\`\`typescript
swarm_orchestrator({ action: "elect" })                // Become orchestrator
swarm_orchestrator({ action: "dispatch_task", ... })   // Assign task to agent
swarm_control({ action: "pulse" })                     // Update agent map
\`\`\`
`;

function getAgentRulesPath(ideName: string, projectPath: string): string {
  switch (ideName) {
    case "Windsurf":
      return path.join(projectPath, ".windsurfrules");
    case "Cursor":
      return path.join(projectPath, ".cursorrules");
    case "Claude Desktop":
      return path.join(projectPath, "CLAUDE.md");
    case "OpenCode":
      return path.join(projectPath, "CLAUDE.md"); // OpenCode читает CLAUDE.md
    case "VS Code":
      return path.join(projectPath, ".clinerules");
    default:
      return path.join(projectPath, ".agentrules");
  }
}

async function installAgentRules(ideName: string, projectPath: string): Promise<string> {
  const rulesPath = getAgentRulesPath(ideName, projectPath);
  
  // Check if file exists and has content
  let existingContent = "";
  try {
    existingContent = await fs.readFile(rulesPath, "utf8");
  } catch {
    // file doesn't exist
  }

  // Check if MCP Swarm rules already present
  if (existingContent.includes("# MCP Swarm Agent Rules")) {
    return rulesPath; // already installed
  }

  // Append or create
  const newContent = existingContent 
    ? existingContent + "\n\n" + AGENT_RULES_CONTENT
    : AGENT_RULES_CONTENT;

  await fs.writeFile(rulesPath, newContent, "utf8");
  return rulesPath;
}

async function main() {
  console.log("🔍 MCP Swarm v0.9.0 Installer");
  console.log("=".repeat(50));

  // Get project path
  const projectPath = path.resolve(process.cwd());
  console.log(`📁 Путь проекта: ${projectPath}`);
  console.log(`🖥️  Платформа: ${process.platform}`);

  // Check if built
  const serverPath = path.join(projectPath, "dist", "server.js");
  if (!(await fileExists(serverPath))) {
    console.log("⚠️  Сервер не собран. Запускаю npm run build...");
    try {
      await execFileAsync("npm", ["run", "build"], { cwd: projectPath, windowsHide: true });
      console.log("✅ Сборка завершена");
    } catch (err: any) {
      console.error("❌ Ошибка сборки:", err?.message);
      process.exit(1);
    }
  }

  // Detect IDEs
  console.log("\n🔎 Поиск установленных IDE...");
  const ides = await detectInstalledIdes();

  if (ides.length === 0) {
    console.log("❌ Поддерживаемые IDE не найдены.");
    console.log("   Поддерживаются: Windsurf, Cursor, Claude Desktop, OpenCode, VS Code");
    console.log("\n📝 Ручная установка:");
    console.log("   Добавьте в конфиг вашей IDE:");
    console.log(JSON.stringify(getMcpSwarmConfig(projectPath), null, 2));
    process.exit(0);
  }

  console.log(`\n✅ Найдено ${ides.length} IDE:`);
  for (const ide of ides) {
    const status = ide.verified ? "✓ верифицирована" : "? обнаружена";
    console.log(`   - ${ide.name} (${status})`);
    console.log(`     Конфиг: ${ide.configPath}`);
  }

  // Install to each IDE
  console.log("\n📦 Установка MCP Swarm...");
  for (const ide of ides) {
    try {
      await installToIde(ide, projectPath);
      console.log(`   ✅ ${ide.name}: MCP конфиг установлен`);
    } catch (err: any) {
      console.log(`   ❌ ${ide.name}: ${err?.message}`);
    }
  }

  // Install agent rules for each IDE
  console.log("\n📜 Установка правил агентов...");
  const installedRules = new Set<string>();
  for (const ide of ides) {
    try {
      const rulesPath = await installAgentRules(ide.name, projectPath);
      if (!installedRules.has(rulesPath)) {
        installedRules.add(rulesPath);
        console.log(`   ✅ ${path.basename(rulesPath)}: правила установлены`);
      }
    } catch (err: any) {
      console.log(`   ❌ ${ide.name} rules: ${err?.message}`);
    }
  }

  console.log("\n🎉 Установка завершена!");
  console.log("   Перезапустите IDE для загрузки MCP сервера.");
  
  console.log("\n📜 Правила агентов установлены в:");
  for (const rulesPath of installedRules) {
    console.log(`   - ${rulesPath}`);
  }
  
  console.log("\n📊 Статистика MCP Swarm v0.9.0:");
  console.log("   - 41 Smart Tools (consolidated from 168+)");
  console.log("   - Each tool has multiple actions via 'action' parameter");
  console.log("   - Поддержка 50+ агентов одновременно");
  
  console.log("\n📖 Основные инструменты:");
  console.log("   Core: swarm_agent, swarm_task, swarm_file");
  console.log("   Git: swarm_worktree, swarm_git");
  console.log("   Collab: swarm_collab, swarm_voting, swarm_message");
  console.log("   Safety: swarm_safety, swarm_control");
  console.log("   Planning: swarm_brainstorm, swarm_design, swarm_plan");
  console.log("   Quality: swarm_debug, swarm_spec, swarm_qa, swarm_guard");
  console.log("   Orchestrator: swarm_orchestrator (FIRST AGENT = INFINITE LOOP)");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
