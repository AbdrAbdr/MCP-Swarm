/**
 * MCP Swarm - Telegram Bot Cloudflare Worker
 * 
 * SECURITY MODEL:
 * - User gets their unique USER ID when they /start the bot
 * - User adds this USER ID to MCP settings (TELEGRAM_USER_ID)
 * - Project ID is auto-generated from folder path (in companion/local MCP)
 * - When MCP starts, it registers the project under this user
 * - User can switch between their projects via inline buttons
 * 
 * Flow:
 * 1. User sends /start → gets their Telegram USER ID
 * 2. User adds TELEGRAM_USER_ID=xxx to MCP settings
 * 3. MCP auto-registers projects when user opens folders
 * 4. User clicks "Projects" → sees all their projects
 * 5. User clicks a project → sees status/agents/tasks for that project
 */

// Cloudflare Workers ambient types (provided by wrangler at build time)
declare class DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}
declare interface DurableObjectId { }
declare interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}
declare class DurableObjectState {
  storage: DurableObjectStorage;
  blockConcurrencyWhile(callback: () => Promise<void>): void;
}
declare interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: any): Promise<void>;
}

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  SWARM_HUB_URL: string;
  SWARM_AUTH_TOKEN?: string;
  USER_PROJECTS: DurableObjectNamespace;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string };
    message: { chat: { id: number }; message_id: number };
    data: string;
  };
}

interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

interface ProjectInfo {
  projectId: string;
  name: string;
  lastSeen: number;
}

// Telegram API helper
async function callTelegram(token: string, method: string, params: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return response.json();
}

// Send message
async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  keyboard?: InlineButton[][]
) {
  const params: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };

  if (keyboard) {
    params.reply_markup = { inline_keyboard: keyboard };
  }

  return callTelegram(token, "sendMessage", params);
}

// Answer callback
async function answerCallback(token: string, callbackId: string, text?: string) {
  return callTelegram(token, "answerCallbackQuery", {
    callback_query_id: callbackId,
    text,
  });
}

// Edit message
async function editMessage(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: InlineButton[][]
) {
  const params: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  };

  if (keyboard) {
    params.reply_markup = { inline_keyboard: keyboard };
  }

  return callTelegram(token, "editMessageText", params);
}

// Fetch from Hub API (GET)
async function fetchFromHub(hubUrl: string, project: string, endpoint: string, authToken?: string): Promise<any> {
  try {
    const apiUrl = hubUrl.replace("wss://", "https://").replace("/ws", "");
    const headers: Record<string, string> = { "Accept": "application/json" };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    const response = await fetch(`${apiUrl}/api/${endpoint}?project=${project}`, { headers });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (e) {
    console.error("Hub fetch error:", e);
    return null;
  }
}

// Post to Hub API (POST)
async function postToHub(hubUrl: string, project: string, endpoint: string, body?: Record<string, unknown>, authToken?: string): Promise<any> {
  try {
    const apiUrl = hubUrl.replace("wss://", "https://").replace("/ws", "");
    const headers: Record<string, string> = {
      "Accept": "application/json",
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    const response = await fetch(`${apiUrl}/api/${endpoint}?project=${project}`, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (e) {
    console.error("Hub post error:", e);
    return null;
  }
}

// Get user data from Durable Object
async function getUserData(env: Env, userId: number): Promise<{
  projects: ProjectInfo[];
  activeProject: string | null;
}> {
  try {
    const doId = env.USER_PROJECTS.idFromName("users");
    const stub = env.USER_PROJECTS.get(doId);
    const response = await stub.fetch(new Request(`http://internal/user/${userId}`));
    if (response.ok) {
      return await response.json() as { projects: ProjectInfo[]; activeProject: string | null };
    }
  } catch (e) {
    console.error("Get user data error:", e);
  }
  return { projects: [], activeProject: null };
}

// Set active project
async function setActiveProject(env: Env, userId: number, projectId: string): Promise<void> {
  const doId = env.USER_PROJECTS.idFromName("users");
  const stub = env.USER_PROJECTS.get(doId);
  await stub.fetch(new Request("http://internal/set-active", {
    method: "POST",
    body: JSON.stringify({ userId: String(userId), projectId }),
  }));
}

// Register project for user (called from MCP)
async function registerProject(env: Env, userId: number, projectId: string, name: string): Promise<void> {
  const doId = env.USER_PROJECTS.idFromName("users");
  const stub = env.USER_PROJECTS.get(doId);
  await stub.fetch(new Request("http://internal/register", {
    method: "POST",
    body: JSON.stringify({ userId: String(userId), projectId, name }),
  }));
}

// Handle /start command
async function handleStart(userId: number, firstName: string, activeProject: string | null): Promise<{ text: string; keyboard?: InlineButton[][] }> {
  return {
    text:
      `🐝 <b>MCP Swarm Bot</b>\n\n` +
      `Привет, ${firstName}!\n\n` +
      `🔑 <b>Твой User ID:</b>\n<code>${userId}</code>\n\n` +
      `📋 <b>Настройка:</b>\n` +
      `1. Скопируй свой User ID\n` +
      `2. Добавь в настройки MCP:\n` +
      `<code>TELEGRAM_USER_ID=${userId}</code>\n\n` +
      `3. Запусти MCP в любой папке проекта\n` +
      `4. Проект автоматически появится здесь!\n\n` +
      (activeProject
        ? `✅ Активный проект:\n<code>${activeProject}</code>`
        : `⏳ Проектов пока нет. Запусти MCP!`),
    keyboard: [
      [
        { text: "📂 Мои проекты", callback_data: "projects" },
      ],
      activeProject ? [
        { text: "📊 Статус", callback_data: "status" },
        { text: "🤖 Агенты", callback_data: "agents" },
        { text: "📋 Задачи", callback_data: "tasks" },
      ] : [],
      [
        { text: "❓ Помощь", callback_data: "help" },
      ],
    ].filter(row => row.length > 0),
  };
}

// Handle projects list
async function handleProjects(
  projects: ProjectInfo[],
  activeProject: string | null
): Promise<{ text: string; keyboard?: InlineButton[][] }> {
  if (projects.length === 0) {
    return {
      text:
        `📂 <b>Мои проекты</b>\n\n` +
        `У тебя пока нет проектов.\n\n` +
        `Чтобы добавить проект:\n` +
        `1. Добавь TELEGRAM_USER_ID в MCP\n` +
        `2. Открой папку проекта в IDE\n` +
        `3. MCP автоматически зарегистрирует проект`,
      keyboard: [
        [{ text: "🔙 Назад", callback_data: "start" }],
      ],
    };
  }

  let text = `📂 <b>Мои проекты</b> (${projects.length})\n\n`;
  text += `Нажми на проект для переключения:\n\n`;

  const keyboard: InlineButton[][] = [];

  for (const project of projects.slice(0, 10)) {
    const isActive = project.projectId === activeProject;
    const icon = isActive ? "✅" : "📁";
    const lastSeen = new Date(project.lastSeen).toLocaleDateString();

    text += `${icon} <b>${project.name}</b>\n`;
    text += `   <code>${project.projectId}</code>\n`;
    text += `   Последняя активность: ${lastSeen}\n\n`;

    keyboard.push([
      {
        text: `${icon} ${project.name}`,
        callback_data: `select:${project.projectId}`,
      },
    ]);
  }

  if (projects.length > 10) {
    text += `\n... и ещё ${projects.length - 10} проектов`;
  }

  keyboard.push([{ text: "🔙 Назад", callback_data: "start" }]);

  return { text, keyboard };
}

// Handle status
async function handleStatus(
  env: Env,
  activeProject: string | null
): Promise<{ text: string; keyboard?: InlineButton[][] }> {
  if (!activeProject) {
    return {
      text: `⚠️ <b>Проект не выбран</b>\n\nВыбери проект в /projects`,
      keyboard: [[{ text: "📂 Проекты", callback_data: "projects" }]],
    };
  }

  const data = await fetchFromHub(env.SWARM_HUB_URL, activeProject, "stats", env.SWARM_AUTH_TOKEN);

  if (!data) {
    return {
      text:
        `📊 <b>Статус</b>\n\n` +
        `Проект: <code>${activeProject}</code>\n\n` +
        `⚠️ Нет данных с Hub.\n` +
        `Возможно, MCP не запущен или нет подключения.`,
      keyboard: [
        [{ text: "🔄 Обновить", callback_data: "status" }],
        [{ text: "📂 Проекты", callback_data: "projects" }],
      ],
    };
  }

  const status = data.stopped ? "🔴 Остановлен" : "🟢 Работает";

  return {
    text:
      `📊 <b>Статус Swarm</b>\n\n` +
      `Проект: <code>${activeProject}</code>\n\n` +
      `Состояние: ${status}\n` +
      `Оркестратор: ${data.orchestratorName || "—"}\n` +
      `Агентов: ${data.agentCount || 0}\n` +
      `Задач: ${data.taskCount || 0}\n` +
      `Сообщений: ${data.messageCount || 0}`,
    keyboard: [
      [
        { text: "🔄 Обновить", callback_data: "status" },
      ],
      [
        { text: "🤖 Агенты", callback_data: "agents" },
        { text: "📋 Задачи", callback_data: "tasks" },
      ],
      data.stopped
        ? [{ text: "▶️ Возобновить", callback_data: "action:resume" }]
        : [{ text: "⏹ Остановить", callback_data: "action:stop" }],
      [{ text: "📂 Проекты", callback_data: "projects" }],
    ],
  };
}

// Handle agents
async function handleAgents(
  env: Env,
  activeProject: string | null
): Promise<{ text: string; keyboard?: InlineButton[][] }> {
  if (!activeProject) {
    return {
      text: `⚠️ <b>Проект не выбран</b>`,
      keyboard: [[{ text: "📂 Проекты", callback_data: "projects" }]],
    };
  }

  const data = await fetchFromHub(env.SWARM_HUB_URL, activeProject, "agents", env.SWARM_AUTH_TOKEN);

  if (!data || !data.agents || data.agents.length === 0) {
    return {
      text:
        `🤖 <b>Агенты</b>\n\n` +
        `Проект: <code>${activeProject}</code>\n\n` +
        `Нет подключенных агентов.`,
      keyboard: [
        [{ text: "🔄 Обновить", callback_data: "agents" }],
        [{ text: "🔙 Назад", callback_data: "status" }],
      ],
    };
  }

  let text = `🤖 <b>Агенты</b> (${data.agents.length})\n\n`;
  text += `Проект: <code>${activeProject}</code>\n\n`;

  for (const agent of data.agents.slice(0, 10)) {
    const statusIcon = agent.status === "active" ? "🟢" : "🔴";
    text += `${statusIcon} <b>${agent.name}</b>\n`;
    text += `   ${agent.platform || "?"} • ${agent.role || "executor"}\n`;
    if (agent.currentTask) {
      text += `   📋 ${agent.currentTask}\n`;
    }
    text += `\n`;
  }

  if (data.agents.length > 10) {
    text += `... и ещё ${data.agents.length - 10}`;
  }

  return {
    text,
    keyboard: [
      [{ text: "🔄 Обновить", callback_data: "agents" }],
      [{ text: "🔙 Назад", callback_data: "status" }],
    ],
  };
}

// Handle tasks
async function handleTasks(
  env: Env,
  activeProject: string | null
): Promise<{ text: string; keyboard?: InlineButton[][] }> {
  if (!activeProject) {
    return {
      text: `⚠️ <b>Проект не выбран</b>`,
      keyboard: [[{ text: "📂 Проекты", callback_data: "projects" }]],
    };
  }

  const data = await fetchFromHub(env.SWARM_HUB_URL, activeProject, "tasks", env.SWARM_AUTH_TOKEN);

  if (!data || !data.tasks || data.tasks.length === 0) {
    return {
      text:
        `📋 <b>Задачи</b>\n\n` +
        `Проект: <code>${activeProject}</code>\n\n` +
        `Нет задач.`,
      keyboard: [
        [{ text: "🔄 Обновить", callback_data: "tasks" }],
        [{ text: "🔙 Назад", callback_data: "status" }],
      ],
    };
  }

  const inProgress = data.tasks.filter((t: any) => t.status === "in_progress");
  const pending = data.tasks.filter((t: any) => t.status === "pending" || t.status === "open");
  const done = data.tasks.filter((t: any) => t.status === "done");

  let text = `📋 <b>Задачи</b>\n\n`;
  text += `Проект: <code>${activeProject}</code>\n\n`;

  const keyboard: InlineButton[][] = [];

  if (inProgress.length > 0) {
    text += `<b>🔄 В работе (${inProgress.length}):</b>\n`;
    for (const task of inProgress.slice(0, 5)) {
      text += `• ${task.title}\n`;
      if (task.assignee) text += `  👤 ${task.assignee}\n`;
      if (task.id) {
        keyboard.push([
          { text: `🔍 ${(task.title || "").substring(0, 20)}`, callback_data: `view_task:${task.id}` },
          { text: `✅`, callback_data: `task_done:${task.id}` },
        ]);
      }
    }
    text += `\n`;
  }

  if (pending.length > 0) {
    text += `<b>⏳ Ожидают (${pending.length}):</b>\n`;
    for (const task of pending.slice(0, 5)) {
      text += `• ${task.title}\n`;
      if (task.id) {
        keyboard.push([
          { text: `🔍 ${(task.title || "").substring(0, 20)}`, callback_data: `view_task:${task.id}` },
          { text: `✅`, callback_data: `task_done:${task.id}` },
          { text: `🗑`, callback_data: `task_cancel:${task.id}` },
        ]);
      }
    }
    text += `\n`;
  }

  if (done.length > 0) {
    text += `<b>✅ Готово: ${done.length}</b>\n`;
  }

  keyboard.push([{ text: "➕ Создать задачу", callback_data: "new_task_prompt" }]);
  keyboard.push([
    { text: "🔄 Обновить", callback_data: "tasks" },
    { text: "🔙 Назад", callback_data: "status" },
  ]);

  return { text, keyboard };
}

// Handle help
function handleHelp(): { text: string; keyboard?: InlineButton[][] } {
  return {
    text:
      `❓ <b>Помощь</b>\n\n` +
      `<b>Как начать:</b>\n` +
      `1. Добавь свой User ID в MCP настройки\n` +
      `2. Открой проект в IDE - он авто-регистрируется\n` +
      `3. Переключайся между проектами\n\n` +
      `<b>Команды:</b>\n` +
      `/start - Главное меню\n` +
      `/status - Статус проекта\n` +
      `/tasks - Список задач\n` +
      `/agents - Актевные агенты\n` +
      `/new <текст> - Создать задачу\n` +
      `/logs - Последние события\n` +
      `/projects - Переключить проект\n` +
      `/myid - Показать User ID\n\n` +
      `<b>💡 Совет:</b> Просто отправь текст без команды — бот создаст задачу автоматически!\n\n` +
      `<b>Поддержка:</b>\n` +
      `github.com/AbdrAbdr/MCP-Swarm`,
    keyboard: [
      [{ text: "🔙 Назад", callback_data: "start" }],
    ],
  };
}

// Main handler for commands
async function handleCommand(
  env: Env,
  userId: number,
  firstName: string,
  command: string,
  args: string[]
): Promise<{ text: string; keyboard?: InlineButton[][] }> {
  const userData = await getUserData(env, userId);

  switch (command) {
    case "/start":
    case "/help":
      if (command === "/help") return handleHelp();
      return handleStart(userId, firstName, userData.activeProject);

    case "/projects":
    case "/link":
      return handleProjects(userData.projects, userData.activeProject);

    case "/status":
      return handleStatus(env, userData.activeProject);

    case "/agents":
      return handleAgents(env, userData.activeProject);

    case "/tasks":
      return handleTasks(env, userData.activeProject);

    case "/new":
      if (args.length < 1) {
        return {
          text:
            `➕ <b>Создать задачу</b>\n\n` +
            `Использование: <code>/new название задачи</code>\n\n` +
            `Пример:\n<code>/new Добавить dark mode в настройки</code>\n\n` +
            `Или просто отправь текст без команды!`,
          keyboard: [[{ text: "🔙 Назад", callback_data: "start" }]],
        };
      }
      return handleCreateTask(env, userId, userData.activeProject, args.join(" "));

    case "/logs":
      return handleLogs(env, userData.activeProject);

    case "/myid":
      return {
        text:
          `🆔 <b>Твой Telegram User ID:</b>\n\n` +
          `<code>${userId}</code>\n\n` +
          `Добавь в настройки MCP:\n` +
          `<code>TELEGRAM_USER_ID=${userId}</code>`,
        keyboard: [[{ text: "🔙 Назад", callback_data: "start" }]],
      };

    default:
      return {
        text: `❓ Неизвестная команда.\n\nИспользуй /start для начала.\nИли просто напиши текст для создания задачи!`,
        keyboard: [[{ text: "🏠 Главная", callback_data: "start" }]],
      };
  }
}

// Handle task creation from Telegram
async function handleCreateTask(
  env: Env,
  userId: number,
  activeProject: string | null,
  title: string
): Promise<{ text: string; keyboard?: InlineButton[][] }> {
  if (!activeProject) {
    return {
      text: `⚠️ <b>Проект не выбран</b>\n\nСначала выбери проект в /projects`,
      keyboard: [[{ text: "📂 Проекты", callback_data: "projects" }]],
    };
  }

  const result = await postToHub(
    env.SWARM_HUB_URL,
    activeProject,
    "create_task",
    { title, creator: `telegram:${userId}` },
    env.SWARM_AUTH_TOKEN
  );

  if (result?.ok && result.task) {
    const taskId = result.task.id;
    return {
      text:
        `✅ <b>Задача создана!</b>\n\n` +
        `📋 <b>${title}</b>\n` +
        `ID: <code>${taskId}</code>\n` +
        `Приоритет: 🟡 Medium\n\n` +
        `Задача отправлена агентам на выполнение.`,
      keyboard: [
        [
          { text: "🔴 Critical", callback_data: `task_priority:${taskId}:critical` },
          { text: "🟠 High", callback_data: `task_priority:${taskId}:high` },
        ],
        [
          { text: "📋 Задачи", callback_data: "tasks" },
          { text: "📊 Статус", callback_data: "status" },
        ],
      ],
    };
  }

  return {
    text: `❌ <b>Ошибка</b>\n\nНе удалось создать задачу.\nПроверьте подключение к Hub.`,
    keyboard: [
      [{ text: "🔄 Повторить", callback_data: "start" }],
    ],
  };
}

// Handle /logs command
async function handleLogs(
  env: Env,
  activeProject: string | null
): Promise<{ text: string; keyboard?: InlineButton[][] }> {
  if (!activeProject) {
    return {
      text: `⚠️ <b>Проект не выбран</b>`,
      keyboard: [[{ text: "📂 Проекты", callback_data: "projects" }]],
    };
  }

  const data = await fetchFromHub(env.SWARM_HUB_URL, activeProject, "logs?limit=10", env.SWARM_AUTH_TOKEN);

  if (!data || !data.events || data.events.length === 0) {
    return {
      text:
        `📜 <b>Логи</b>\n\n` +
        `Проект: <code>${activeProject}</code>\n\n` +
        `Нет событий за последние 24 часа.`,
      keyboard: [
        [{ text: "🔄 Обновить", callback_data: "logs" }],
        [{ text: "🔙 Назад", callback_data: "status" }],
      ],
    };
  }

  const eventIcons: Record<string, string> = {
    "task_created": "📋",
    "task_updated": "🔄",
    "task_claimed": "✋",
    "task_released": "🔓",
    "leader_changed": "🎯",
    "file_locked": "🔒",
    "file_unlocked": "🔓",
    "agent_frozen": "❄️",
    "agent_unfrozen": "🔥",
    "swarm_stopped": "⏹",
    "swarm_resumed": "▶️",
  };

  let text = `📜 <b>Логи</b> (последние 10)\n\n`;
  text += `Проект: <code>${activeProject}</code>\n\n`;

  for (const event of data.events.slice(-10).reverse()) {
    const icon = eventIcons[event.type] || "•";
    const time = new Date(event.ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const payload = event.payload as any;
    let desc = event.type;

    if (event.type === "task_created" && payload?.title) {
      desc = `Задача: ${payload.title}`;
    } else if (event.type === "task_updated" && payload?.taskId) {
      desc = `Обновлена: ${payload.taskId.substring(0, 15)}...`;
    } else if (event.type.startsWith("chat.")) {
      desc = `Чат: ${(payload?.message || "").substring(0, 30)}`;
    }

    text += `${icon} <code>${time}</code> ${desc}\n`;
  }

  return {
    text,
    keyboard: [
      [{ text: "🔄 Обновить", callback_data: "logs" }],
      [{ text: "🔙 Назад", callback_data: "status" }],
    ],
  };
}

// AI Intent Matching - determine what user wants from free text
async function handleFreeText(
  env: Env,
  userId: number,
  firstName: string,
  text: string
): Promise<{ text: string; keyboard?: InlineButton[][] }> {
  const userData = await getUserData(env, userId);
  const lower = text.toLowerCase().trim();

  // Intent patterns (Russian + English)
  const intents: { patterns: RegExp[]; handler: () => Promise<{ text: string; keyboard?: InlineButton[][] }> }[] = [
    {
      // Status intent
      patterns: [
        /^(статус|как дела|что происходит|status|state|как там|обзор)/,
        /^(покажи статус|дай статус|show status)/,
      ],
      handler: () => handleStatus(env, userData.activeProject),
    },
    {
      // Tasks intent
      patterns: [
        /^(задач[и]?|таск[и]?|tasks?|что делать|список задач|todo)/,
        /^(покажи задачи|дай задачи|show tasks)/,
      ],
      handler: () => handleTasks(env, userData.activeProject),
    },
    {
      // Agents intent
      patterns: [
        /^(агент[ы]?|кто работает|кто онлайн|agents?|who)/,
        /^(покажи агент|дай агент|show agents)/,
      ],
      handler: () => handleAgents(env, userData.activeProject),
    },
    {
      // Stop intent
      patterns: [
        /^(стоп|останов|пауза|stop|pause|halt|замри|тихо)/,
      ],
      handler: async () => {
        if (!userData.activeProject) {
          return { text: `⚠️ Проект не выбран`, keyboard: [[{ text: "📂 Проекты", callback_data: "projects" }]] };
        }
        const result = await postToHub(env.SWARM_HUB_URL, userData.activeProject, "stop", {}, env.SWARM_AUTH_TOKEN);
        return result?.ok
          ? { text: `⏹ <b>Swarm остановлен</b>`, keyboard: [[{ text: "▶️ Возобновить", callback_data: "action:resume" }]] }
          : { text: `❌ Ошибка при остановке` };
      },
    },
    {
      // Resume intent
      patterns: [
        /^(продолж|возобнов|resume|continue|го|поехали|запуск)/,
      ],
      handler: async () => {
        if (!userData.activeProject) {
          return { text: `⚠️ Проект не выбран`, keyboard: [[{ text: "📂 Проекты", callback_data: "projects" }]] };
        }
        const result = await postToHub(env.SWARM_HUB_URL, userData.activeProject, "resume", {}, env.SWARM_AUTH_TOKEN);
        return result?.ok
          ? { text: `▶️ <b>Swarm возобновлён</b>`, keyboard: [[{ text: "📊 Статус", callback_data: "status" }]] }
          : { text: `❌ Ошибка при возобновлении` };
      },
    },
    {
      // Logs intent
      patterns: [
        /^(лог[и]?|событи[яе]|history|logs?|что было|что произошло)/,
      ],
      handler: () => handleLogs(env, userData.activeProject),
    },
    {
      // Help intent
      patterns: [
        /^(помо[щг]|help|как пользовать|что умеешь|команд)/,
      ],
      handler: async () => handleHelp(),
    },
    {
      // Explicit create task intent
      patterns: [
        /^(создай|добавь|сделай|нужно|надо|create|add|make|fix|implement|build)/,
        /^(починить|исправить|оптимизировать|обновить|улучшить|рефакторить)/,
      ],
      handler: async () => {
        if (!userData.activeProject) {
          return { text: `⚠️ Проект не выбран`, keyboard: [[{ text: "📂 Проекты", callback_data: "projects" }]] };
        }
        return handleCreateTask(env, userId, userData.activeProject, text);
      },
    },
  ];

  // Try to match intent
  for (const intent of intents) {
    for (const pattern of intent.patterns) {
      if (pattern.test(lower)) {
        return intent.handler();
      }
    }
  }

  // Fallback: ask to confirm task creation
  if (!userData.activeProject) {
    return {
      text: `⚠️ <b>Проект не выбран</b>\n\nСначала выбери проект.`,
      keyboard: [[{ text: "📂 Проекты", callback_data: "projects" }]],
    };
  }

  // If text looks like a task description (long enough), create task with confirmation
  if (text.length > 3) {
    return {
      text:
        `🤔 <b>Создать задачу?</b>\n\n` +
        `📋 <i>${text}</i>\n\n` +
        `Нажми кнопку ниже для подтверждения:`,
      keyboard: [
        [{ text: `✅ Да, создать задачу`, callback_data: `confirm_task:${text.substring(0, 60)}` }],
        [{ text: "❌ Нет", callback_data: "start" }],
      ],
    };
  }

  return {
    text: `❓ Не понял. Попробуй:\n• Написать текст задачи\n• /status - статус\n• /tasks - задачи\n• /help - помощь`,
    keyboard: [[{ text: "🏠 Главная", callback_data: "start" }]],
  };
}

// Handle callback queries (button clicks)
async function handleCallback(
  env: Env,
  userId: number,
  firstName: string,
  callbackData: string
): Promise<{ text: string; keyboard?: InlineButton[][] }> {
  const userData = await getUserData(env, userId);

  // Handle project selection
  if (callbackData.startsWith("select:")) {
    const projectId = callbackData.slice(7);
    await setActiveProject(env, userId, projectId);

    // Refresh user data after setting
    const newUserData = await getUserData(env, userId);

    return {
      text: `✅ Проект выбран:\n<code>${projectId}</code>`,
      keyboard: [
        [
          { text: "📊 Статус", callback_data: "status" },
          { text: "🤖 Агенты", callback_data: "agents" },
        ],
        [
          { text: "📋 Задачи", callback_data: "tasks" },
        ],
        [{ text: "📂 Все проекты", callback_data: "projects" }],
      ],
    };
  }

  // Handle actions
  if (callbackData.startsWith("action:")) {
    const action = callbackData.slice(7);
    if (!userData.activeProject) {
      return {
        text: `⚠️ Проект не выбран`,
        keyboard: [[{ text: "📂 Проекты", callback_data: "projects" }]],
      };
    }

    if (action === "stop") {
      const result = await postToHub(env.SWARM_HUB_URL, userData.activeProject, "stop", {}, env.SWARM_AUTH_TOKEN);
      if (result?.ok) {
        return {
          text: `⏹ <b>Swarm остановлен</b>\n\nПроект: <code>${userData.activeProject}</code>\n\nВсе агенты приостановят работу.`,
          keyboard: [
            [{ text: "▶️ Возобновить", callback_data: "action:resume" }],
            [{ text: "📊 Статус", callback_data: "status" }],
          ],
        };
      }
      return {
        text: `❌ <b>Ошибка</b>\n\nНе удалось остановить Swarm.\nПроверьте подключение к Hub.`,
        keyboard: [
          [{ text: "🔄 Повторить", callback_data: "action:stop" }],
          [{ text: "📊 Статус", callback_data: "status" }],
        ],
      };
    }
    if (action === "resume") {
      const result = await postToHub(env.SWARM_HUB_URL, userData.activeProject, "resume", {}, env.SWARM_AUTH_TOKEN);
      if (result?.ok) {
        return {
          text: `▶️ <b>Swarm возобновлён</b>\n\nПроект: <code>${userData.activeProject}</code>\n\nАгенты продолжат работу.`,
          keyboard: [
            [{ text: "📊 Статус", callback_data: "status" }],
            [{ text: "🤖 Агенты", callback_data: "agents" }],
          ],
        };
      }
      return {
        text: `❌ <b>Ошибка</b>\n\nНе удалось возобновить Swarm.\nПроверьте подключение к Hub.`,
        keyboard: [
          [{ text: "🔄 Повторить", callback_data: "action:resume" }],
          [{ text: "📊 Статус", callback_data: "status" }],
        ],
      };
    }
  }

  // Handle navigation
  switch (callbackData) {
    case "start":
      return handleStart(userId, firstName, userData.activeProject);
    case "projects":
      return handleProjects(userData.projects, userData.activeProject);
    case "status":
      return handleStatus(env, userData.activeProject);
    case "agents":
      return handleAgents(env, userData.activeProject);
    case "tasks":
      return handleTasks(env, userData.activeProject);
    case "logs":
      return handleLogs(env, userData.activeProject);
    case "help":
      return handleHelp();
    default:
      // Handle dynamic callbacks
      if (callbackData.startsWith("task_priority:")) {
        const parts = callbackData.split(":");
        const taskId = parts[1];
        const priority = parts[2];
        if (!userData.activeProject) {
          return { text: `⚠️ Проект не выбран` };
        }
        const result = await postToHub(env.SWARM_HUB_URL, userData.activeProject, "update_task", { taskId, priority }, env.SWARM_AUTH_TOKEN);
        if (result?.ok) {
          const priorityIcons: Record<string, string> = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" };
          return {
            text: `${priorityIcons[priority] || "⬜"} Приоритет изменён на <b>${priority}</b>`,
            keyboard: [
              [{ text: "📋 Задачи", callback_data: "tasks" }],
              [{ text: "📊 Статус", callback_data: "status" }],
            ],
          };
        }
        return { text: `❌ Ошибка при изменении приоритета` };
      }

      if (callbackData.startsWith("task_done:")) {
        const taskId = callbackData.slice("task_done:".length);
        if (!userData.activeProject) {
          return { text: `⚠️ Проект не выбран` };
        }
        const result = await postToHub(env.SWARM_HUB_URL, userData.activeProject, "update_task", { taskId, status: "done" }, env.SWARM_AUTH_TOKEN);
        if (result?.ok) {
          return {
            text: `✅ Задача <code>${taskId.substring(0, 15)}</code> завершена!`,
            keyboard: [[{ text: "📋 Задачи", callback_data: "tasks" }]],
          };
        }
        return { text: `❌ Ошибка при завершении задачи` };
      }

      if (callbackData.startsWith("task_cancel:")) {
        const taskId = callbackData.slice("task_cancel:".length);
        if (!userData.activeProject) {
          return { text: `⚠️ Проект не выбран` };
        }
        const result = await postToHub(env.SWARM_HUB_URL, userData.activeProject, "update_task", { taskId, status: "canceled" }, env.SWARM_AUTH_TOKEN);
        if (result?.ok) {
          return {
            text: `🗑 Задача <code>${taskId.substring(0, 15)}</code> отменена.`,
            keyboard: [[{ text: "📋 Задачи", callback_data: "tasks" }]],
          };
        }
        return { text: `❌ Ошибка при отмене задачи` };
      }

      if (callbackData.startsWith("view_task:")) {
        const taskId = callbackData.slice("view_task:".length);
        if (!userData.activeProject) {
          return { text: `⚠️ Проект не выбран` };
        }
        const data = await fetchFromHub(env.SWARM_HUB_URL, userData.activeProject, `task/${taskId}`, env.SWARM_AUTH_TOKEN);
        if (data?.task) {
          const t = data.task;
          const statusIcons: Record<string, string> = { open: "⬜", in_progress: "🔄", done: "✅", canceled: "🗑" };
          const priorityIcons: Record<string, string> = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" };
          const created = new Date(t.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
          let text =
            `📋 <b>Задача</b>\n\n` +
            `<b>${t.title}</b>\n` +
            `ID: <code>${t.id}</code>\n` +
            `Статус: ${statusIcons[t.status] || "⬜"} ${t.status}\n` +
            `Приоритет: ${priorityIcons[t.priority] || "⬜"} ${t.priority}\n` +
            `Создана: ${created}\n`;
          if (t.assignee) text += `Исполнитель: <code>${t.assignee}</code>\n`;
          if (t.creator) text += `Создатель: <code>${t.creator}</code>\n`;

          const keyboard: InlineButton[][] = [];
          if (t.status !== "done" && t.status !== "canceled") {
            keyboard.push([
              { text: "✅ Завершить", callback_data: `task_done:${taskId}` },
              { text: "🗑 Отменить", callback_data: `task_cancel:${taskId}` },
            ]);
            keyboard.push([
              { text: "🔴 Critical", callback_data: `task_priority:${taskId}:critical` },
              { text: "🟠 High", callback_data: `task_priority:${taskId}:high` },
            ]);
          }
          keyboard.push([{ text: "📋 Задачи", callback_data: "tasks" }]);

          return { text, keyboard };
        }
        return { text: `❌ Задача не найдена` };
      }

      if (callbackData === "new_task_prompt") {
        return {
          text:
            `➕ <b>Создать задачу</b>\n\n` +
            `Просто отправь текст сообщением — бот создаст задачу!\n\n` +
            `Примеры:\n` +
            `• <i>Добавить dark mode</i>\n` +
            `• <i>Исправить баг в авторизации</i>\n` +
            `• <i>Оптимизировать SQL-запросы</i>\n\n` +
            `Или: <code>/new название задачи</code>`,
          keyboard: [
            [{ text: "🔙 Назад", callback_data: "tasks" }],
          ],
        };
      }

      if (callbackData.startsWith("confirm_task:")) {
        const title = callbackData.slice("confirm_task:".length);
        const userData = await getUserData(env, userId);
        if (!userData.activeProject) {
          return { text: `⚠️ Проект не выбран`, keyboard: [[{ text: "📂 Проекты", callback_data: "projects" }]] };
        }
        return handleCreateTask(env, userId, userData.activeProject, title);
      }

      return { text: `Неизвестное действие: ${callbackData}` };
  }
}

// Mini App HTML Dashboard (P2-8)
function getMiniAppHtml(hubWsUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MCP Swarm Dashboard</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, system-ui, sans-serif;
    background: var(--tg-theme-bg-color, #1a1a2e);
    color: var(--tg-theme-text-color, #e0e0e0);
    min-height: 100vh;
    padding: 12px;
  }
  .header {
    display: flex; align-items: center; gap: 8px;
    padding: 12px; border-radius: 12px;
    background: linear-gradient(135deg, #667eea22, #764ba222);
    margin-bottom: 12px;
  }
  .header h1 { font-size: 18px; }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #4caf50; animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .card {
    border-radius: 12px; padding: 14px; margin-bottom: 10px;
    background: var(--tg-theme-secondary-bg-color, #16213e);
    border: 1px solid #ffffff10;
  }
  .card h3 { font-size: 14px; opacity: 0.7; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .metric { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #ffffff08; }
  .metric:last-child { border: 0; }
  .metric .label { opacity: 0.6; font-size: 13px; }
  .metric .value { font-weight: 600; font-size: 14px; }
  .agent-badge {
    display: inline-flex; align-items: center; gap: 4px;
    background: #667eea22; border-radius: 8px; padding: 4px 10px; margin: 3px; font-size: 13px;
  }
  .agent-badge .dot { width: 6px; height: 6px; border-radius: 50%; }
  .dot-active { background: #4caf50; } .dot-idle { background: #ff9800; } .dot-offline { background: #666; }
  .task-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 13px; }
  .task-status { font-size: 11px; padding: 2px 6px; border-radius: 4px; }
  .st-open { background: #2196f322; color: #64b5f6; }
  .st-progress { background: #ff980022; color: #ffb74d; }
  .st-done { background: #4caf5022; color: #81c784; }
  .events { max-height: 200px; overflow-y: auto; font-size: 12px; }
  .event-line { padding: 3px 0; opacity: 0.7; border-bottom: 1px solid #ffffff05; }
  .event-time { opacity: 0.5; }
  .btn-row { display: flex; gap: 8px; margin-top: 12px; }
  .btn {
    flex: 1; padding: 10px; border: none; border-radius: 10px;
    font-size: 14px; cursor: pointer; font-weight: 500;
    background: var(--tg-theme-button-color, #667eea);
    color: var(--tg-theme-button-text-color, #fff);
  }
  .btn-danger { background: #ef5350; }
  #connection-status { font-size: 11px; opacity: 0.5; text-align: center; margin-top: 8px; }
</style>
</head>
<body>
<div class="header">
  <div class="status-dot" id="ws-dot"></div>
  <h1>🐝 MCP Swarm</h1>
</div>

<div class="card">
  <h3>📊 Статус</h3>
  <div class="metric"><span class="label">Агенты</span><span class="value" id="agent-count">-</span></div>
  <div class="metric"><span class="label">Задачи</span><span class="value" id="task-count">-</span></div>
  <div class="metric"><span class="label">Swarm</span><span class="value" id="swarm-state">-</span></div>
</div>

<div class="card">
  <h3>🤖 Агенты</h3>
  <div id="agents-list"><span style="opacity:0.4">Загрузка...</span></div>
</div>

<div class="card">
  <h3>📋 Задачи</h3>
  <div id="tasks-list"><span style="opacity:0.4">Загрузка...</span></div>
</div>

<div class="card">
  <h3>📡 События</h3>
  <div class="events" id="events-list"></div>
</div>

<div class="btn-row">
  <button class="btn" onclick="sendCmd('status')">📊 Обновить</button>
  <button class="btn btn-danger" onclick="sendCmd('stop')">⏹ Стоп</button>
</div>
<div id="connection-status">Подключение...</div>

<script>
  const tg = window.Telegram?.WebApp;
  if (tg) { tg.ready(); tg.expand(); }

  const HUB = "${hubWsUrl}";
  let ws = null;
  let events = [];

  function connect() {
    ws = new WebSocket(HUB + "/ws?agent=telegram-miniapp");
    ws.onopen = () => {
      document.getElementById("ws-dot").style.background = "#4caf50";
      document.getElementById("connection-status").textContent = "Подключён";
      sendCmd("status");
    };
    ws.onmessage = (e) => {
      try { handleMsg(JSON.parse(e.data)); } catch {}
    };
    ws.onclose = () => {
      document.getElementById("ws-dot").style.background = "#ef5350";
      document.getElementById("connection-status").textContent = "Отключён. Переподключение...";
      setTimeout(connect, 3000);
    };
  }

  function sendCmd(type) {
    if (ws?.readyState === 1) ws.send(JSON.stringify({ type }));
  }

  function handleMsg(msg) {
    const kind = msg.kind || msg.type || "";
    const ts = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    events.unshift({ kind, ts, data: msg });
    if (events.length > 50) events = events.slice(0, 50);

    // Update events
    const el = document.getElementById("events-list");
    el.innerHTML = events.slice(0, 15).map(e =>
      '<div class="event-line"><span class="event-time">' + e.ts + '</span> ' + e.kind + '</div>'
    ).join("");

    // Update specific UI
    if (msg.agents) {
      document.getElementById("agent-count").textContent = msg.agents.length;
      document.getElementById("agents-list").innerHTML = msg.agents.map(a => {
        const st = a.status || "unknown";
        const dotClass = st === "active" ? "dot-active" : st === "idle" ? "dot-idle" : "dot-offline";
        return '<span class="agent-badge"><span class="dot ' + dotClass + '"></span>' + (a.name || a.agent) + '</span>';
      }).join("") || '<span style="opacity:0.4">Нет</span>';
    }
    if (msg.tasks) {
      document.getElementById("task-count").textContent = msg.tasks.length;
      document.getElementById("tasks-list").innerHTML = msg.tasks.slice(0, 8).map(t => {
        const stClass = t.status === "done" ? "st-done" : t.status === "in_progress" ? "st-progress" : "st-open";
        return '<div class="task-row"><span>' + (t.title || t.id || "?").substring(0, 35) + '</span><span class="task-status ' + stClass + '">' + (t.status || "open") + '</span></div>';
      }).join("") || '<span style="opacity:0.4">Нет</span>';
    }
    if (kind === "status" || kind === "state") {
      document.getElementById("swarm-state").textContent = msg.stopped ? "⏹ Остановлен" : "▶️ Активен";
    }
  }

  connect();
</script>
</body>
</html>`;
}

// Main Worker
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // GET endpoints
    if (request.method === "GET") {
      if (url.pathname === "/setup") {
        const webhookUrl = `${url.origin}/webhook`;
        const result = await callTelegram(env.TELEGRAM_BOT_TOKEN, "setWebhook", {
          url: webhookUrl,
        });
        return Response.json(result);
      }

      if (url.pathname === "/info") {
        const result = await callTelegram(env.TELEGRAM_BOT_TOKEN, "getWebhookInfo", {});
        return Response.json(result);
      }

      // Health check
      if (url.pathname === "/health") {
        return Response.json({ ok: true, version: "1.1.5", timestamp: Date.now() });
      }

      // Mini App - Telegram Web App dashboard (P2-8)
      if (url.pathname === "/app") {
        const hubUrl = env.SWARM_HUB_URL.replace("https://", "wss://").replace("http://", "ws://");
        const html = getMiniAppHtml(hubUrl);
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }

      return new Response(
        `🐝 MCP Swarm Telegram Bot\n\n` +
        `Логика:\n` +
        `  1. /start → получи свой User ID\n` +
        `  2. Добавь TELEGRAM_USER_ID в MCP\n` +
        `  3. MCP авто-регистрирует проекты\n` +
        `  4. Переключайся между проектами\n\n` +
        `Endpoints:\n` +
        `  GET  /setup  - Установить webhook\n` +
        `  GET  /info   - Информация о webhook\n` +
        `  GET  /health - Health check\n` +
        `  POST /webhook - Telegram updates\n` +
        `  POST /register - Регистрация проекта (от MCP)\n`,
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    // POST /register - Called from MCP to register a project
    if (request.method === "POST" && url.pathname === "/register") {
      // Authenticate register endpoint
      if (env.SWARM_AUTH_TOKEN) {
        const auth = request.headers.get("Authorization");
        if (!auth || auth !== `Bearer ${env.SWARM_AUTH_TOKEN}`) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
      }
      try {
        const body = await request.json() as {
          userId: number;
          projectId: string;
          name: string;
        };

        if (!body.userId || !body.projectId) {
          return Response.json({ error: "Missing userId or projectId" }, { status: 400 });
        }

        await registerProject(env, body.userId, body.projectId, body.name || body.projectId);
        return Response.json({ ok: true });
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
      }
    }

    // POST /notify - Webhook from Hub for push notifications
    if (request.method === "POST" && url.pathname === "/notify") {
      try {
        const body = await request.json() as {
          chatId?: number;
          userId?: number;
          event: string;
          payload: any;
          project?: string;
        };

        const eventIcons: Record<string, string> = {
          "task_created": "📋",
          "task_completed": "✅",
          "task_failed": "❌",
          "agent_joined": "🤖",
          "agent_died": "💀",
          "swarm_stopped": "⏹",
          "swarm_resumed": "▶️",
          "urgent": "🚨",
          "build_failed": "🛠",
          "pr_created": "🔀",
        };

        const icon = eventIcons[body.event] || "🔔";
        let text = `${icon} <b>${body.event}</b>`;
        if (body.project) text += `\nПроект: <code>${body.project}</code>`;

        // Format payload
        if (body.payload) {
          if (body.payload.title) text += `\n📋 ${body.payload.title}`;
          if (body.payload.agent) text += `\n🤖 ${body.payload.agent}`;
          if (body.payload.reason) text += `\n💬 ${body.payload.reason}`;
          if (body.payload.files && Array.isArray(body.payload.files)) {
            text += `\n📁 Файлы: ${body.payload.files.slice(0, 5).join(", ")}`;
          }
          if (body.payload.message) text += `\n${body.payload.message}`;
        }

        const chatId = body.chatId || body.userId;
        if (chatId) {
          await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, [
            [{ text: "📊 Статус", callback_data: "status" }],
            [{ text: "📋 Задачи", callback_data: "tasks" }],
          ]);
        }

        return Response.json({ ok: true });
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
      }
    }

    // POST /webhook - Telegram updates
    if (request.method === "POST" && url.pathname === "/webhook") {
      try {
        const update: TelegramUpdate = await request.json();

        // Handle message
        if (update.message?.text) {
          const text = update.message.text;
          const chatId = update.message.chat.id;
          const userId = update.message.from.id;
          const firstName = update.message.from.first_name;
          const [command, ...args] = text.split(" ");

          if (command.startsWith("/")) {
            const result = await handleCommand(env, userId, firstName, command, args);
            await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, result.text, result.keyboard);
          } else {
            // AI Intent Matching for free text
            const result = await handleFreeText(env, userId, firstName, text);
            await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, result.text, result.keyboard);
          }
        }

        // Handle callback query
        if (update.callback_query) {
          const chatId = update.callback_query.message.chat.id;
          const messageId = update.callback_query.message.message_id;
          const userId = update.callback_query.from.id;
          const firstName = update.callback_query.from.first_name;
          const callbackData = update.callback_query.data;

          await answerCallback(env.TELEGRAM_BOT_TOKEN, update.callback_query.id);

          const result = await handleCallback(env, userId, firstName, callbackData);
          await editMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            messageId,
            result.text,
            result.keyboard
          );
        }

        return new Response("OK");
      } catch (error) {
        console.error("Webhook error:", error);
        return new Response("Error", { status: 500 });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  },

  // Scheduled handler for cron tasks (P3-11)
  async scheduled(event: any, env: Env, ctx: any): Promise<void> {
    try {
      // Heartbeat check - ping Hub and notify about status
      const statusData = await fetchFromHub(env.SWARM_HUB_URL, "default", "status");

      if (statusData?.agents?.length > 0) {
        const activeCount = statusData.agents.filter((a: any) => a.status === "active").length;
        const taskCount = statusData.tasks?.filter((t: any) => t.status !== "done").length || 0;

        // Only notify if there are active agents
        if (activeCount > 0) {
          // Queue notification through DO for batching
          const doId = env.USER_PROJECTS.idFromName("global");
          const doStub = env.USER_PROJECTS.get(doId);

          await doStub.fetch(new Request("https://do/queue-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chatId: "broadcast",
              event: "cron_heartbeat",
              payload: {
                agents: activeCount,
                tasks: taskCount,
                uptime: statusData.uptime || "unknown",
              },
            }),
          }));
        }
      }
    } catch (e) {
      console.error("Scheduled handler error:", e);
    }
  },
};

// ============ DURABLE OBJECT FOR USER DATA ============

interface UserRecord {
  projects: Map<string, ProjectInfo>;  // projectId -> ProjectInfo
  activeProject: string | null;
}

interface CachedResponse {
  data: any;
  cachedAt: number;
}

interface PendingNotification {
  event: string;
  payload: any;
  project?: string;
  ts: number;
}

export class UserProjects {
  private state: DurableObjectState;
  private env: Env;
  private users: Map<string, UserRecord> = new Map();
  private cache: Map<string, CachedResponse> = new Map();
  private pendingNotifications: Map<string, PendingNotification[]> = new Map(); // chatId -> notifications

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Record<string, any>>("users");
      if (stored) {
        for (const [userId, record] of Object.entries(stored)) {
          const r = record as any;
          this.users.set(userId, {
            projects: new Map(Object.entries(r.projects || {})),
            activeProject: r.activeProject || null,
          });
        }
      }
      // Load pending notifications
      const pending = await this.state.storage.get<Record<string, PendingNotification[]>>("pending_notifications");
      if (pending) {
        for (const [chatId, notifs] of Object.entries(pending)) {
          this.pendingNotifications.set(chatId, notifs);
        }
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // GET /user/:userId - Get user data
    if (url.pathname.startsWith("/user/")) {
      const userId = url.pathname.slice(6);
      const record = this.users.get(userId);

      if (!record) {
        return Response.json({ projects: [], activeProject: null });
      }

      return Response.json({
        projects: Array.from(record.projects.values()),
        activeProject: record.activeProject,
      });
    }

    // POST /register - Register a project for user
    if (url.pathname === "/register" && request.method === "POST") {
      const body = await request.json() as {
        userId: string;
        projectId: string;
        name: string;
      };

      let record = this.users.get(body.userId);
      if (!record) {
        record = { projects: new Map(), activeProject: null };
        this.users.set(body.userId, record);
      }

      record.projects.set(body.projectId, {
        projectId: body.projectId,
        name: body.name,
        lastSeen: Date.now(),
      });

      // Auto-set as active if first project
      if (!record.activeProject) {
        record.activeProject = body.projectId;
      }

      await this.save();
      return Response.json({ ok: true });
    }

    // POST /set-active - Set active project
    if (url.pathname === "/set-active" && request.method === "POST") {
      const body = await request.json() as { userId: string; projectId: string };

      const record = this.users.get(body.userId);
      if (record) {
        record.activeProject = body.projectId;

        // Update lastSeen
        const project = record.projects.get(body.projectId);
        if (project) {
          project.lastSeen = Date.now();
        }

        await this.save();
      }

      return Response.json({ ok: true });
    }

    // GET /list - List all users (debug)
    if (url.pathname === "/list") {
      const result: Record<string, any> = {};
      for (const [userId, record] of this.users) {
        result[userId] = {
          projects: Array.from(record.projects.values()),
          activeProject: record.activeProject,
        };
      }
      return Response.json(result);
    }

    // POST /queue-notification - Queue notification for batching
    if (url.pathname === "/queue-notification" && request.method === "POST") {
      const body = await request.json() as {
        chatId: string;
        event: string;
        payload: any;
        project?: string;
      };

      const chatId = body.chatId;
      if (!this.pendingNotifications.has(chatId)) {
        this.pendingNotifications.set(chatId, []);
      }
      this.pendingNotifications.get(chatId)!.push({
        event: body.event,
        payload: body.payload,
        project: body.project,
        ts: Date.now(),
      });

      // Save and set alarm for 2s debounce
      await this.savePendingNotifications();
      const currentAlarm = await (this.state.storage as any).getAlarm();
      if (!currentAlarm) {
        await (this.state.storage as any).setAlarm(Date.now() + 2000);
      }

      return Response.json({ ok: true, queued: true });
    }

    // GET /cached-hub - Get cached Hub response
    if (url.pathname === "/cached-hub") {
      const cacheKey = url.searchParams.get("key") || "";
      const ttl = Number(url.searchParams.get("ttl") || "30000");
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.cachedAt < ttl) {
        return Response.json({ hit: true, data: cached.data });
      }
      return Response.json({ hit: false });
    }

    // POST /cache-hub - Store cached Hub response
    if (url.pathname === "/cache-hub" && request.method === "POST") {
      const body = await request.json() as { key: string; data: any };
      this.cache.set(body.key, { data: body.data, cachedAt: Date.now() });

      // Limit cache size to 50 entries
      if (this.cache.size > 50) {
        const oldest = [...this.cache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt);
        this.cache.delete(oldest[0][0]);
      }

      return Response.json({ ok: true });
    }

    return new Response("Not Found", { status: 404 });
  }

  // Alarm handler - flush batched notifications
  async alarm() {
    const botToken = this.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    const eventIcons: Record<string, string> = {
      "task_created": "📋",
      "task_completed": "✅",
      "task_failed": "❌",
      "agent_joined": "🤖",
      "agent_died": "💀",
      "swarm_stopped": "⏹",
      "swarm_resumed": "▶️",
      "urgent": "🚨",
    };

    for (const [chatId, notifications] of this.pendingNotifications) {
      if (notifications.length === 0) continue;

      let text = "";
      if (notifications.length === 1) {
        const n = notifications[0];
        const icon = eventIcons[n.event] || "🔔";
        text = `${icon} <b>${n.event}</b>`;
        if (n.project) text += `\nПроект: <code>${n.project}</code>`;
        if (n.payload?.title) text += `\n📋 ${n.payload.title}`;
        if (n.payload?.agent) text += `\n🤖 ${n.payload.agent}`;
      } else {
        text = `🔔 <b>События (${notifications.length})</b>\n\n`;
        for (const n of notifications.slice(-10)) {
          const icon = eventIcons[n.event] || "•";
          const time = new Date(n.ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
          text += `${icon} <code>${time}</code> ${n.event}`;
          if (n.payload?.title) text += `: ${n.payload.title}`;
          text += `\n`;
        }
        if (notifications.length > 10) {
          text += `\n... и ещё ${notifications.length - 10} событий`;
        }
      }

      try {
        await callTelegram(botToken, "sendMessage", {
          chat_id: Number(chatId),
          text,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📊 Статус", callback_data: "status" }, { text: "📋 Задачи", callback_data: "tasks" }],
            ],
          },
        });
      } catch (e) {
        console.error("Alarm send error:", e);
      }
    }

    this.pendingNotifications.clear();
    await this.savePendingNotifications();
  }

  private async save() {
    const data: Record<string, any> = {};
    for (const [userId, record] of this.users) {
      data[userId] = {
        projects: Object.fromEntries(record.projects),
        activeProject: record.activeProject,
      };
    }
    await this.state.storage.put("users", data);
  }

  private async savePendingNotifications() {
    const data: Record<string, PendingNotification[]> = {};
    for (const [chatId, notifs] of this.pendingNotifications) {
      data[chatId] = notifs;
    }
    await this.state.storage.put("pending_notifications", data);
  }
}
