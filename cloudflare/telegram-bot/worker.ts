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

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  SWARM_HUB_URL: string;
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

// Fetch from Hub API
async function fetchFromHub(hubUrl: string, project: string, endpoint: string) {
  try {
    const apiUrl = hubUrl.replace("wss://", "https://").replace("/ws", "");
    const response = await fetch(`${apiUrl}/api/${endpoint}?project=${project}`, {
      headers: { "Accept": "application/json" },
    });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (e) {
    console.error("Hub fetch error:", e);
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

  const data = await fetchFromHub(env.SWARM_HUB_URL, activeProject, "stats");
  
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

  const data = await fetchFromHub(env.SWARM_HUB_URL, activeProject, "agents");
  
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

  const data = await fetchFromHub(env.SWARM_HUB_URL, activeProject, "tasks");
  
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

  if (inProgress.length > 0) {
    text += `<b>🔄 В работе (${inProgress.length}):</b>\n`;
    for (const task of inProgress.slice(0, 3)) {
      text += `• ${task.title}\n`;
      if (task.assignee) text += `  👤 ${task.assignee}\n`;
    }
    text += `\n`;
  }

  if (pending.length > 0) {
    text += `<b>⏳ Ожидают (${pending.length}):</b>\n`;
    for (const task of pending.slice(0, 3)) {
      text += `• ${task.title}\n`;
    }
    text += `\n`;
  }

  if (done.length > 0) {
    text += `<b>✅ Готово: ${done.length}</b>\n`;
  }

  return {
    text,
    keyboard: [
      [{ text: "🔄 Обновить", callback_data: "tasks" }],
      [{ text: "🔙 Назад", callback_data: "status" }],
    ],
  };
}

// Handle help
function handleHelp(): { text: string; keyboard?: InlineButton[][] } {
  return {
    text:
      `❓ <b>Помощь</b>\n\n` +
      `<b>Как начать:</b>\n` +
      `1. Скопируй свой User ID из /start\n` +
      `2. Добавь в настройки IDE:\n` +
      `<code>TELEGRAM_USER_ID=твой_id</code>\n\n` +
      `3. Запусти MCP в папке проекта\n` +
      `4. Проект появится в "Мои проекты"\n\n` +
      `<b>Команды:</b>\n` +
      `/start - Главное меню\n` +
      `/projects - Список проектов\n` +
      `/status - Статус активного проекта\n` +
      `/agents - Список агентов\n` +
      `/tasks - Список задач\n` +
      `/myid - Показать User ID\n\n` +
      `<b>Поддержка:</b>\n` +
      `github.com/AbrAbdr/Swarm_MCP`,
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
        text: `❓ Неизвестная команда.\n\nИспользуй /start для начала.`,
        keyboard: [[{ text: "🏠 Главная", callback_data: "start" }]],
      };
  }
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

    // TODO: Actually call Hub API to stop/resume
    if (action === "stop") {
      return {
        text: `⏹ <b>Swarm остановлен</b>\n\nПроект: ${userData.activeProject}`,
        keyboard: [[{ text: "▶️ Возобновить", callback_data: "action:resume" }]],
      };
    }
    if (action === "resume") {
      return {
        text: `▶️ <b>Swarm возобновлён</b>\n\nПроект: ${userData.activeProject}`,
        keyboard: [[{ text: "📊 Статус", callback_data: "status" }]],
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
    case "help":
      return handleHelp();
    default:
      return { text: `Неизвестное действие: ${callbackData}` };
  }
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
        return Response.json({ ok: true, timestamp: Date.now() });
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
};

// ============ DURABLE OBJECT FOR USER DATA ============

interface UserRecord {
  projects: Map<string, ProjectInfo>;  // projectId -> ProjectInfo
  activeProject: string | null;
}

export class UserProjects {
  private state: DurableObjectState;
  private users: Map<string, UserRecord> = new Map(); // oderId -> UserRecord

  constructor(state: DurableObjectState) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Record<string, any>>("users");
      if (stored) {
        for (const [userId, record] of Object.entries(stored)) {
          this.users.set(userId, {
            projects: new Map(Object.entries(record.projects || {})),
            activeProject: record.activeProject || null,
          });
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

    return new Response("Not Found", { status: 404 });
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
}
