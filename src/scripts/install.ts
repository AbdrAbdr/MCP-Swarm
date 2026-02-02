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
  const serverPath = path.join(normalizedPath, "dist", "server.js");

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

// Agent rules content for each IDE
const AGENT_RULES_CONTENT = `# MCP Swarm Agent Rules

## CRITICAL: Always Start with MCP Swarm

Before ANY coding task, you MUST:

1. **Register yourself** - Call \`agent_register\` to get your unique agent name
2. **Check swarm status** - Call \`swarm_stop_status\` to ensure swarm is active
3. **Check task list** - Call \`task_list\` to see available tasks
4. **Reserve files** - Before editing any file, call \`file_reserve\` with your agent name

## Workflow Rules

### Starting Work
\`\`\`
1. agent_register → Get your name (e.g., "RadiantWolf")
2. task_list → See what needs to be done
3. task_assign → Claim a task with your agent name
4. file_reserve → Lock files you'll edit (exclusive=true)
5. Do your work
6. file_release → Unlock files
7. task_mark_done → Complete the task
8. sync_with_base_branch → Rebase before push
9. create_github_pr → Open PR for review
\`\`\`

### Collaboration Rules
- **Never edit files locked by another agent** - Check \`list_file_locks\` first
- **Broadcast important changes** - Use \`broadcast_chat\` to notify team
- **Request reviews** - Use \`request_cross_agent_review\` before finalizing
- **Share screenshots** - Use \`share_screenshot\` for visual issues
- **Log your reasoning** - Use \`log_swarm_thought\` to explain decisions

### Safety Rules
- **Dangerous actions require voting** - Use \`start_voting\` before deleting files/folders
- **Check main health** - Use \`check_main_health\` before rebasing
- **Signal dependency changes** - Use \`signal_dependency_change\` after adding packages

### Ghost Mode
When no tasks are assigned to you:
- Run \`patrol_mode\` to check for lint errors
- Help review other agents' code
- Optimize imports and formatting

## Available Tools (100+)

### Core
- agent_register, agent_whoami, health_check

### Tasks
- task_create, task_list, task_assign, task_set_status, task_mark_done, task_cancel
- decompose_task, get_decomposition

### Files & Locks
- file_reserve, file_release, list_file_locks
- forecast_file_touches, check_file_conflicts

### Git & GitHub
- worktree_create, worktree_list, worktree_remove
- sync_with_base_branch, create_github_pr
- auto_delete_merged_branch, cleanup_all_merged_branches

### Collaboration
- broadcast_chat, update_team_dashboard
- request_cross_agent_review, respond_to_review, list_pending_reviews
- share_screenshot, list_screenshots
- log_swarm_thought, get_recent_thoughts

### Safety & Voting
- start_voting, cast_vote, list_open_votings
- check_main_health, report_ci_alert, get_immune_status

### Orchestration
- save_briefing, load_briefing
- update_swarm_pulse, get_swarm_pulse
- archive_finding, search_knowledge
- trigger_urgent_preemption, get_active_urgent
- create_snapshot, trigger_rollback

### v0.5 New Features
- check_agent_health, get_dead_agents, force_reassign_task
- start_session_recording, log_session_action, stop_session_recording, replay_session
- run_quality_gate, get_quality_report, check_pr_ready
- log_api_usage, get_agent_costs, get_project_costs, check_budget_remaining
- estimate_context_size, compress_briefing
- save_baseline, check_regression, list_regressions

### v0.6 Brainstorming & Writing Plans
- start_brainstorm, ask_brainstorm_question, answer_brainstorm_question
- propose_approaches, present_design_section, validate_design_section
- create_implementation_plan, add_plan_task, get_next_task, complete_step
- generate_subagent_prompt, export_plan_as_markdown

### v0.6 Systematic Debugging (4 Phases)
- start_debug_session, log_investigation, add_evidence, complete_phase_1
- log_patterns, complete_phase_2, form_hypothesis, test_hypothesis
- implement_fix, verify_fix, check_red_flags

### v0.7 Spec Pipeline & QA Loop
- start_spec_pipeline, start_spec_phase, complete_spec_phase, export_spec_as_markdown
- start_qa_loop, run_qa_iteration, log_qa_fix, get_qa_fix_suggestions, generate_qa_report

### v0.7 Guard Hooks & Tool Clusters
- install_guard_hooks, uninstall_guard_hooks, run_guard_hooks, get_guard_config
- init_tool_clusters, list_tool_clusters, get_cluster_tools, find_tool_cluster
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
  console.log("🔍 MCP Swarm v0.8.0 Installer");
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
  
  console.log("\n📊 Статистика MCP Swarm v0.8.0:");
  console.log("   - 168+ инструментов");
  console.log("   - 14 категорий функционала");
  console.log("   - Поддержка 50+ агентов одновременно");
  
  console.log("\n📖 Основные инструменты:");
  console.log("   Core: agent_register, task_list, file_reserve");
  console.log("   Git: worktree_create, sync_with_base_branch, create_github_pr");
  console.log("   Collab: broadcast_chat, request_cross_agent_review");
  console.log("   Safety: start_voting, check_main_health");
  console.log("   v0.6: start_brainstorm, create_implementation_plan, start_debug_session");
  console.log("   v0.7: start_spec_pipeline, start_qa_loop, install_guard_hooks, init_tool_clusters");
  console.log("   v0.8: orchestrator_elect, agent_message_send, agent_inbox_fetch");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
