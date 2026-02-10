/**
 * MCP Swarm - Telegram Bot Integration
 * 
 * Full-featured Telegram bot for:
 * - Event notifications (tasks, completions, CI errors)
 * - Status viewing (/tasks, /agents, /status)
 * - Task creation (/create_task)
 * - Review approval (/approve, /reject)
 * - Swarm control (/stop, /resume)
 * - Interactive inline buttons
 * 
 * Setup:
 * 1. Create bot via @BotFather
 * 2. Set TELEGRAM_BOT_TOKEN in environment
 * 3. Set TELEGRAM_CHAT_ID for notifications
 * 
 * @version 0.9.12
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// ============================================================================
// TYPES
// ============================================================================

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  notifyOn: {
    taskCreated: boolean;
    taskCompleted: boolean;
    taskFailed: boolean;
    agentJoined: boolean;
    agentDied: boolean;
    ciError: boolean;
    reviewRequested: boolean;
    votingStarted: boolean;
  };
}

export interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: InlineKeyboard;
}

export interface InlineKeyboard {
  inline_keyboard: InlineButton[][];
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string };
    message: { chat: { id: number }; message_id: number };
    data: string;
  };
}

// ============================================================================
// CONFIG MANAGEMENT
// ============================================================================

const DEFAULT_CONFIG: TelegramConfig = {
  botToken: '',
  chatId: '',
  enabled: false,
  notifyOn: {
    taskCreated: true,
    taskCompleted: true,
    taskFailed: true,
    agentJoined: true,
    agentDied: true,
    ciError: true,
    reviewRequested: true,
    votingStarted: true,
  },
};

function getConfigPath(repoPath: string): string {
  return path.join(repoPath, '.swarm', 'telegram.json');
}

export function loadTelegramConfig(repoPath: string): TelegramConfig {
  const configPath = getConfigPath(repoPath);

  // Check environment variables first
  const envToken = process.env.TELEGRAM_BOT_TOKEN;
  const envChatId = process.env.TELEGRAM_CHAT_ID;

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return {
        ...DEFAULT_CONFIG,
        ...config,
        botToken: envToken || config.botToken,
        chatId: envChatId || config.chatId,
      };
    } catch {
      return { ...DEFAULT_CONFIG, botToken: envToken || '', chatId: envChatId || '' };
    }
  }

  return { ...DEFAULT_CONFIG, botToken: envToken || '', chatId: envChatId || '' };
}

export function saveTelegramConfig(repoPath: string, config: Partial<TelegramConfig>): TelegramConfig {
  const configPath = getConfigPath(repoPath);
  const swarmDir = path.dirname(configPath);

  if (!fs.existsSync(swarmDir)) {
    fs.mkdirSync(swarmDir, { recursive: true });
  }

  const currentConfig = loadTelegramConfig(repoPath);
  const newConfig = { ...currentConfig, ...config };

  // Don't save token to file for security - use env vars
  const configToSave = { ...newConfig };
  delete (configToSave as Partial<TelegramConfig>).botToken; // Keep token in env only

  fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2));
  return newConfig;
}

// ============================================================================
// TELEGRAM API
// ============================================================================

async function callTelegramApi(
  botToken: string,
  method: string,
  params: Record<string, any>
): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(params);

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.ok) {
            resolve(result.result);
          } else {
            reject(new Error(result.description || 'Telegram API error'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ============================================================================
// SEND MESSAGES
// ============================================================================

export async function sendMessage(
  repoPath: string,
  text: string,
  keyboard?: InlineButton[][]
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const config = loadTelegramConfig(repoPath);

  if (!config.enabled || !config.botToken || !config.chatId) {
    return { success: false, error: 'Telegram not configured or disabled' };
  }

  try {
    const message: TelegramMessage = {
      chat_id: config.chatId,
      text,
      parse_mode: 'HTML',
    };

    if (keyboard) {
      message.reply_markup = { inline_keyboard: keyboard };
    }

    const result = await callTelegramApi(config.botToken, 'sendMessage', message);
    return { success: true, messageId: result.message_id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// NOTIFICATION FUNCTIONS
// ============================================================================

export async function notifyTaskCreated(
  repoPath: string,
  taskId: string,
  title: string,
  priority: string,
  creator?: string
): Promise<void> {
  const config = loadTelegramConfig(repoPath);
  if (!config.notifyOn.taskCreated) return;

  const priorityEmoji = priority === 'critical' ? '🔴' : priority === 'high' ? '🟠' : priority === 'medium' ? '🟡' : '🟢';

  await sendMessage(
    repoPath,
    `📋 <b>New Task Created</b>\n\n` +
    `${priorityEmoji} <b>${title}</b>\n` +
    `ID: <code>${taskId}</code>\n` +
    (creator ? `Created by: ${creator}` : ''),
    [
      [
        { text: '👁 View', callback_data: `view_task:${taskId}` },
        { text: '✋ Claim', callback_data: `claim_task:${taskId}` },
      ],
    ]
  );
}

export async function notifyTaskCompleted(
  repoPath: string,
  taskId: string,
  title: string,
  agent: string,
  duration?: string
): Promise<void> {
  const config = loadTelegramConfig(repoPath);
  if (!config.notifyOn.taskCompleted) return;

  await sendMessage(
    repoPath,
    `✅ <b>Task Completed</b>\n\n` +
    `<b>${title}</b>\n` +
    `ID: <code>${taskId}</code>\n` +
    `Completed by: ${agent}\n` +
    (duration ? `Duration: ${duration}` : ''),
    [
      [{ text: '📊 View Details', callback_data: `view_task:${taskId}` }],
    ]
  );
}

export async function notifyTaskFailed(
  repoPath: string,
  taskId: string,
  title: string,
  agent: string,
  reason?: string
): Promise<void> {
  const config = loadTelegramConfig(repoPath);
  if (!config.notifyOn.taskFailed) return;

  await sendMessage(
    repoPath,
    `❌ <b>Task Failed</b>\n\n` +
    `<b>${title}</b>\n` +
    `ID: <code>${taskId}</code>\n` +
    `Agent: ${agent}\n` +
    (reason ? `Reason: ${reason}` : ''),
    [
      [
        { text: '🔄 Reassign', callback_data: `reassign_task:${taskId}` },
        { text: '📋 Details', callback_data: `view_task:${taskId}` },
      ],
    ]
  );
}

export async function notifyAgentJoined(
  repoPath: string,
  agentName: string,
  agentType: string
): Promise<void> {
  const config = loadTelegramConfig(repoPath);
  if (!config.notifyOn.agentJoined) return;

  await sendMessage(
    repoPath,
    `🤖 <b>Agent Joined</b>\n\n` +
    `<b>${agentName}</b> (${agentType})\n` +
    `Status: Ready`,
    [
      [{ text: '📊 View Agents', callback_data: 'list_agents' }],
    ]
  );
}

export async function notifyAgentDied(
  repoPath: string,
  agentName: string,
  lastSeen: string,
  pendingTasks: number
): Promise<void> {
  const config = loadTelegramConfig(repoPath);
  if (!config.notifyOn.agentDied) return;

  await sendMessage(
    repoPath,
    `💀 <b>Agent Dead</b>\n\n` +
    `<b>${agentName}</b>\n` +
    `Last seen: ${lastSeen}\n` +
    `Pending tasks: ${pendingTasks}`,
    [
      [
        { text: '🔄 Reassign Tasks', callback_data: `reassign_agent:${agentName}` },
        { text: '📊 Status', callback_data: 'swarm_status' },
      ],
    ]
  );
}

export async function notifyCIError(
  repoPath: string,
  branch: string,
  commit: string,
  error: string
): Promise<void> {
  const config = loadTelegramConfig(repoPath);
  if (!config.notifyOn.ciError) return;

  await sendMessage(
    repoPath,
    `🚨 <b>CI/CD Error</b>\n\n` +
    `Branch: <code>${branch}</code>\n` +
    `Commit: <code>${commit.substring(0, 7)}</code>\n` +
    `Error: ${error.substring(0, 200)}`,
    [
      [
        { text: '🔍 Investigate', callback_data: `investigate_ci:${commit}` },
        { text: '🔙 Rollback', callback_data: `rollback:${commit}` },
      ],
    ]
  );
}

export async function notifyReviewRequested(
  repoPath: string,
  reviewId: string,
  taskTitle: string,
  author: string,
  filesCount: number
): Promise<void> {
  const config = loadTelegramConfig(repoPath);
  if (!config.notifyOn.reviewRequested) return;

  await sendMessage(
    repoPath,
    `👀 <b>Review Requested</b>\n\n` +
    `<b>${taskTitle}</b>\n` +
    `Author: ${author}\n` +
    `Files: ${filesCount}`,
    [
      [
        { text: '✅ Approve', callback_data: `approve_review:${reviewId}` },
        { text: '💬 Comment', callback_data: `comment_review:${reviewId}` },
        { text: '❌ Reject', callback_data: `reject_review:${reviewId}` },
      ],
    ]
  );
}

export async function notifyVotingStarted(
  repoPath: string,
  votingId: string,
  topic: string,
  options: string[]
): Promise<void> {
  const config = loadTelegramConfig(repoPath);
  if (!config.notifyOn.votingStarted) return;

  const buttons: InlineButton[][] = options.map((opt, i) => [
    { text: opt, callback_data: `vote:${votingId}:${i}` },
  ]);

  await sendMessage(
    repoPath,
    `🗳 <b>Voting Started</b>\n\n` +
    `<b>${topic}</b>\n\n` +
    `Choose your option:`,
    buttons
  );
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

export interface CommandResult {
  text: string;
  keyboard?: InlineButton[][];
}

export async function handleCommand(
  repoPath: string,
  command: string,
  args: string[]
): Promise<CommandResult> {
  switch (command) {
    case '/start':
    case '/help':
      return {
        text:
          `🐝 <b>MCP Swarm Bot</b>\n\n` +
          `<b>Commands:</b>\n` +
          `/status - Swarm status\n` +
          `/agents - List agents\n` +
          `/tasks - List tasks\n` +
          `/reviews - List pending reviews\n` +
          `/create_task - Create task\n` +
          `/approve [id] - Approve review\n` +
          `/reject [id] - Reject review\n` +
          `/stop - Stop swarm\n` +
          `/resume - Resume swarm\n` +
          `/config - Bot settings`,
        keyboard: [
          [
            { text: '📊 Status', callback_data: 'swarm_status' },
            { text: '🤖 Agents', callback_data: 'list_agents' },
          ],
          [
            { text: '📋 Tasks', callback_data: 'list_tasks' },
            { text: '👀 Reviews', callback_data: 'list_reviews' },
          ],
          [
            { text: '➕ New Task', callback_data: 'create_task' },
          ],
        ],
      };

    case '/status':
      return await getSwarmStatus(repoPath);

    case '/agents':
      return await getAgentsList(repoPath);

    case '/tasks':
      return await getTasksList(repoPath);

    case '/create_task':
      if (args.length < 1) {
        return {
          text: '📋 <b>Create Task</b>\n\nUsage: /create_task [title]\n\nExample:\n<code>/create_task Fix login bug</code>',
        };
      }
      return await createTask(repoPath, args.join(' '));

    case '/stop':
      return await stopSwarm(repoPath);

    case '/resume':
      return await resumeSwarm(repoPath);

    case '/config':
      return await getConfig(repoPath);

    case '/reviews':
      return await getReviewsList(repoPath);

    case '/approve':
      if (args.length < 1) {
        return {
          text: '✅ <b>Approve Review</b>\n\nUsage: /approve [review_id]\n\nExample:\n<code>/approve rev-123</code>',
        };
      }
      return await approveReview(repoPath, args[0]);

    case '/reject':
      if (args.length < 1) {
        return {
          text: '❌ <b>Reject Review</b>\n\nUsage: /reject [review_id] [reason]\n\nExample:\n<code>/reject rev-123 Needs more tests</code>',
        };
      }
      return await rejectReview(repoPath, args[0], args.slice(1).join(' '));

    default:
      return { text: `Unknown command: ${command}\n\nUse /help for available commands.` };
  }
}

// ============================================================================
// STATUS & DATA FUNCTIONS
// ============================================================================

async function getSwarmStatus(repoPath: string): Promise<CommandResult> {
  try {
    const orchestratorPath = path.join(repoPath, '.swarm', 'ORCHESTRATOR.json');
    const controlPath = path.join(repoPath, '.swarm', 'CONTROL.json');

    let orchestrator = null;
    let control = { stopped: false };

    if (fs.existsSync(orchestratorPath)) {
      orchestrator = JSON.parse(fs.readFileSync(orchestratorPath, 'utf-8'));
    }
    if (fs.existsSync(controlPath)) {
      control = JSON.parse(fs.readFileSync(controlPath, 'utf-8'));
    }

    const status = control.stopped ? '🔴 Stopped' : '🟢 Running';
    const orch = orchestrator ? `${orchestrator.agent} (${orchestrator.client || 'unknown'})` : 'None';

    // Count agents
    const agentsDir = path.join(repoPath, 'swarm', 'agents');
    let agentCount = 0;
    if (fs.existsSync(agentsDir)) {
      agentCount = fs.readdirSync(agentsDir).filter(f => f.endsWith('.json')).length;
    }

    // Count tasks
    const tasksPath = path.join(repoPath, 'swarm', 'TASKS.json');
    let taskStats = { total: 0, pending: 0, inProgress: 0, done: 0 };
    if (fs.existsSync(tasksPath)) {
      const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
      taskStats.total = tasks.length;
      taskStats.pending = tasks.filter((t: any) => t.status === 'pending').length;
      taskStats.inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
      taskStats.done = tasks.filter((t: any) => t.status === 'done').length;
    }

    return {
      text:
        `📊 <b>Swarm Status</b>\n\n` +
        `Status: ${status}\n` +
        `Orchestrator: ${orch}\n` +
        `Agents: ${agentCount}\n\n` +
        `<b>Tasks:</b>\n` +
        `• Total: ${taskStats.total}\n` +
        `• Pending: ${taskStats.pending}\n` +
        `• In Progress: ${taskStats.inProgress}\n` +
        `• Done: ${taskStats.done}`,
      keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'swarm_status' },
          { text: '📋 Tasks', callback_data: 'list_tasks' },
        ],
        control.stopped
          ? [{ text: '▶️ Resume', callback_data: 'resume_swarm' }]
          : [{ text: '⏹ Stop', callback_data: 'stop_swarm' }],
      ],
    };
  } catch (error: any) {
    return { text: `Error getting status: ${error.message}` };
  }
}

async function getAgentsList(repoPath: string): Promise<CommandResult> {
  try {
    const agentsDir = path.join(repoPath, 'swarm', 'agents');

    if (!fs.existsSync(agentsDir)) {
      return { text: '🤖 <b>Agents</b>\n\nNo agents registered yet.' };
    }

    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'));

    if (files.length === 0) {
      return { text: '🤖 <b>Agents</b>\n\nNo agents registered yet.' };
    }

    const now = Date.now();
    let text = '🤖 <b>Agents</b>\n\n';

    for (const file of files.slice(0, 10)) {
      const agent = JSON.parse(fs.readFileSync(path.join(agentsDir, file), 'utf-8'));
      const lastSeen = now - (agent.lastHeartbeat || agent.registeredAt || 0);
      const isAlive = lastSeen < 120000; // 2 minutes
      const status = isAlive ? '🟢' : '🔴';
      const lastSeenStr = lastSeen < 60000 ? 'now' : `${Math.floor(lastSeen / 60000)}m ago`;

      text += `${status} <b>${agent.name}</b>\n`;
      text += `   ${agent.client || 'unknown'} • ${lastSeenStr}\n`;
    }

    if (files.length > 10) {
      text += `\n... and ${files.length - 10} more`;
    }

    return {
      text,
      keyboard: [[{ text: '🔄 Refresh', callback_data: 'list_agents' }]],
    };
  } catch (error: any) {
    return { text: `Error listing agents: ${error.message}` };
  }
}

async function getTasksList(repoPath: string): Promise<CommandResult> {
  try {
    const tasksPath = path.join(repoPath, 'swarm', 'TASKS.json');

    if (!fs.existsSync(tasksPath)) {
      return { text: '📋 <b>Tasks</b>\n\nNo tasks yet.' };
    }

    const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));

    if (tasks.length === 0) {
      return {
        text: '📋 <b>Tasks</b>\n\nNo tasks yet.',
        keyboard: [[{ text: '➕ Create Task', callback_data: 'create_task' }]],
      };
    }

    // Group by status
    const pending = tasks.filter((t: any) => t.status === 'pending');
    const inProgress = tasks.filter((t: any) => t.status === 'in_progress');

    let text = '📋 <b>Tasks</b>\n\n';

    if (inProgress.length > 0) {
      text += '<b>🔄 In Progress:</b>\n';
      for (const task of inProgress.slice(0, 5)) {
        text += `• ${task.title} (${task.agent || 'unassigned'})\n`;
      }
      text += '\n';
    }

    if (pending.length > 0) {
      text += '<b>⏳ Pending:</b>\n';
      for (const task of pending.slice(0, 5)) {
        const priority = task.priority === 'critical' ? '🔴' : task.priority === 'high' ? '🟠' : '🟡';
        text += `${priority} ${task.title}\n`;
      }
    }

    const buttons: InlineButton[][] = pending.slice(0, 3).map((task: any) => [
      { text: `✋ Claim: ${task.title.substring(0, 20)}`, callback_data: `claim_task:${task.id}` },
    ]);

    buttons.push([
      { text: '🔄 Refresh', callback_data: 'list_tasks' },
      { text: '➕ New', callback_data: 'create_task' },
    ]);

    return { text, keyboard: buttons };
  } catch (error: any) {
    return { text: `Error listing tasks: ${error.message}` };
  }
}

async function createTask(repoPath: string, title: string): Promise<CommandResult> {
  try {
    const tasksPath = path.join(repoPath, 'swarm', 'TASKS.json');
    const swarmDir = path.dirname(tasksPath);

    if (!fs.existsSync(swarmDir)) {
      fs.mkdirSync(swarmDir, { recursive: true });
    }

    let tasks: any[] = [];
    if (fs.existsSync(tasksPath)) {
      tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    const newTask = {
      id: taskId,
      title,
      status: 'pending',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      createdBy: 'telegram',
    };

    tasks.push(newTask);
    fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));

    return {
      text:
        `✅ <b>Task Created</b>\n\n` +
        `<b>${title}</b>\n` +
        `ID: <code>${taskId}</code>\n` +
        `Priority: Medium`,
      keyboard: [
        [
          { text: '🔴 Critical', callback_data: `set_priority:${taskId}:critical` },
          { text: '🟠 High', callback_data: `set_priority:${taskId}:high` },
        ],
        [{ text: '📋 View Tasks', callback_data: 'list_tasks' }],
      ],
    };
  } catch (error: any) {
    return { text: `Error creating task: ${error.message}` };
  }
}

async function stopSwarm(repoPath: string): Promise<CommandResult> {
  try {
    const controlPath = path.join(repoPath, '.swarm', 'CONTROL.json');
    const swarmDir = path.dirname(controlPath);

    if (!fs.existsSync(swarmDir)) {
      fs.mkdirSync(swarmDir, { recursive: true });
    }

    fs.writeFileSync(controlPath, JSON.stringify({ stopped: true, stoppedAt: new Date().toISOString(), stoppedBy: 'telegram' }, null, 2));

    return {
      text: '⏹ <b>Swarm Stopped</b>\n\nAll agents will pause their work.',
      keyboard: [[{ text: '▶️ Resume', callback_data: 'resume_swarm' }]],
    };
  } catch (error: any) {
    return { text: `Error stopping swarm: ${error.message}` };
  }
}

async function resumeSwarm(repoPath: string): Promise<CommandResult> {
  try {
    const controlPath = path.join(repoPath, '.swarm', 'CONTROL.json');

    if (fs.existsSync(controlPath)) {
      fs.writeFileSync(controlPath, JSON.stringify({ stopped: false, resumedAt: new Date().toISOString(), resumedBy: 'telegram' }, null, 2));
    }

    return {
      text: '▶️ <b>Swarm Resumed</b>\n\nAgents will continue their work.',
      keyboard: [[{ text: '📊 Status', callback_data: 'swarm_status' }]],
    };
  } catch (error: any) {
    return { text: `Error resuming swarm: ${error.message}` };
  }
}

async function getConfig(repoPath: string): Promise<CommandResult> {
  const config = loadTelegramConfig(repoPath);

  const notifyList = Object.entries(config.notifyOn)
    .map(([key, value]) => `${value ? '✅' : '❌'} ${key}`)
    .join('\n');

  return {
    text:
      `⚙️ <b>Telegram Bot Config</b>\n\n` +
      `Status: ${config.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
      `Chat ID: ${config.chatId ? '✅ Set' : '❌ Not set'}\n` +
      `Bot Token: ${config.botToken ? '✅ Set' : '❌ Not set'}\n\n` +
      `<b>Notifications:</b>\n${notifyList}`,
    keyboard: [
      [
        { text: config.enabled ? '❌ Disable' : '✅ Enable', callback_data: 'toggle_enabled' },
      ],
      [
        { text: '🔔 All On', callback_data: 'notify_all_on' },
        { text: '🔕 All Off', callback_data: 'notify_all_off' },
      ],
    ],
  };
}

async function getReviewsList(repoPath: string): Promise<CommandResult> {
  try {
    const reviewsPath = path.join(repoPath, '.swarm', 'reviews', 'INDEX.json');

    if (!fs.existsSync(reviewsPath)) {
      return {
        text: '👀 <b>Reviews</b>\n\nNo reviews yet.',
        keyboard: [[{ text: '📊 Status', callback_data: 'swarm_status' }]],
      };
    }

    const index = JSON.parse(fs.readFileSync(reviewsPath, 'utf-8'));
    const reviews = Object.values(index.reviews || {}) as Array<Record<string, unknown>>;

    if (reviews.length === 0) {
      return {
        text: '👀 <b>Reviews</b>\n\nNo reviews yet.',
        keyboard: [[{ text: '📊 Status', callback_data: 'swarm_status' }]],
      };
    }

    // Filter pending reviews
    const pending = reviews.filter((r: any) => r.status === 'pending' || r.status === 'in_progress');
    const approved = reviews.filter((r: any) => r.status === 'approved').length;
    const rejected = reviews.filter((r: any) => r.status === 'rejected').length;

    let text = '👀 <b>Reviews</b>\n\n';
    text += `📊 Total: ${reviews.length} | ✅ ${approved} | ❌ ${rejected}\n\n`;

    if (pending.length > 0) {
      text += '<b>⏳ Pending Reviews:</b>\n';
      for (const review of pending.slice(0, 5)) {
        text += `• <code>${review.id}</code>\n`;
        text += `  ${review.taskTitle || 'Untitled'}\n`;
        text += `  By: ${review.codeAuthor} | Files: ${Array.isArray(review.changedFiles) ? review.changedFiles.length : 0}\n\n`;
      }
    } else {
      text += 'No pending reviews.\n';
    }

    // Create buttons for pending reviews
    const buttons: InlineButton[][] = pending.slice(0, 3).map((review: any) => [
      { text: `✅ Approve ${review.id.substring(0, 10)}`, callback_data: `approve_review:${review.id}` },
      { text: `❌ Reject`, callback_data: `reject_review:${review.id}` },
    ]);

    buttons.push([{ text: '🔄 Refresh', callback_data: 'list_reviews' }]);

    return { text, keyboard: buttons };
  } catch (error: any) {
    return { text: `Error listing reviews: ${error.message}` };
  }
}

async function approveReview(repoPath: string, reviewId: string): Promise<CommandResult> {
  try {
    const reviewsPath = path.join(repoPath, '.swarm', 'reviews', 'INDEX.json');

    if (!fs.existsSync(reviewsPath)) {
      return { text: `Review ${reviewId} not found` };
    }

    const index = JSON.parse(fs.readFileSync(reviewsPath, 'utf-8'));
    const review = index.reviews?.[reviewId];

    if (!review) {
      return { text: `Review ${reviewId} not found` };
    }

    review.status = 'approved';
    review.approvedAt = new Date().toISOString();
    review.approvedBy = 'telegram';

    fs.writeFileSync(reviewsPath, JSON.stringify(index, null, 2));

    return {
      text:
        `✅ <b>Review Approved</b>\n\n` +
        `ID: <code>${reviewId}</code>\n` +
        `Task: ${review.taskTitle || 'Untitled'}\n` +
        `Author: ${review.codeAuthor}`,
      keyboard: [[{ text: '👀 View Reviews', callback_data: 'list_reviews' }]],
    };
  } catch (error: any) {
    return { text: `Error approving review: ${error.message}` };
  }
}

async function rejectReview(repoPath: string, reviewId: string, reason?: string): Promise<CommandResult> {
  try {
    const reviewsPath = path.join(repoPath, '.swarm', 'reviews', 'INDEX.json');

    if (!fs.existsSync(reviewsPath)) {
      return { text: `Review ${reviewId} not found` };
    }

    const index = JSON.parse(fs.readFileSync(reviewsPath, 'utf-8'));
    const review = index.reviews?.[reviewId];

    if (!review) {
      return { text: `Review ${reviewId} not found` };
    }

    review.status = 'rejected';
    review.rejectedAt = new Date().toISOString();
    review.rejectedBy = 'telegram';
    review.rejectionReason = reason || 'Rejected via Telegram';

    fs.writeFileSync(reviewsPath, JSON.stringify(index, null, 2));

    return {
      text:
        `❌ <b>Review Rejected</b>\n\n` +
        `ID: <code>${reviewId}</code>\n` +
        `Task: ${review.taskTitle || 'Untitled'}\n` +
        `Reason: ${reason || 'No reason provided'}`,
      keyboard: [[{ text: '👀 View Reviews', callback_data: 'list_reviews' }]],
    };
  } catch (error: any) {
    return { text: `Error rejecting review: ${error.message}` };
  }
}

// ============================================================================
// CALLBACK HANDLER
// ============================================================================

export async function handleCallback(
  repoPath: string,
  callbackData: string
): Promise<CommandResult> {
  const [action, ...params] = callbackData.split(':');

  switch (action) {
    case 'swarm_status':
      return await getSwarmStatus(repoPath);

    case 'list_agents':
      return await getAgentsList(repoPath);

    case 'list_tasks':
      return await getTasksList(repoPath);

    case 'list_reviews':
      return await getReviewsList(repoPath);

    case 'approve_review':
      return await approveReview(repoPath, params[0]);

    case 'reject_review':
      return await rejectReview(repoPath, params[0]);

    case 'create_task':
      return {
        text: '📋 <b>Create Task</b>\n\nSend a message with the task title:\n\n<code>/create_task Fix the login bug</code>',
      };

    case 'stop_swarm':
      return await stopSwarm(repoPath);

    case 'resume_swarm':
      return await resumeSwarm(repoPath);

    case 'claim_task':
      return {
        text: `✋ Task ${params[0]} claimed!\n\nNote: This needs to be assigned to an actual agent via MCP Swarm tools.`,
      };

    case 'view_task':
      return { text: `📋 Task details for ${params[0]}\n\n(Task view coming soon)` };

    case 'set_priority':
      return await setPriority(repoPath, params[0], params[1]);

    case 'toggle_enabled':
      const config = loadTelegramConfig(repoPath);
      saveTelegramConfig(repoPath, { enabled: !config.enabled });
      return await getConfig(repoPath);

    case 'notify_all_on':
      saveTelegramConfig(repoPath, {
        notifyOn: {
          taskCreated: true,
          taskCompleted: true,
          taskFailed: true,
          agentJoined: true,
          agentDied: true,
          ciError: true,
          reviewRequested: true,
          votingStarted: true,
        },
      });
      return await getConfig(repoPath);

    case 'notify_all_off':
      saveTelegramConfig(repoPath, {
        notifyOn: {
          taskCreated: false,
          taskCompleted: false,
          taskFailed: false,
          agentJoined: false,
          agentDied: false,
          ciError: false,
          reviewRequested: false,
          votingStarted: false,
        },
      });
      return await getConfig(repoPath);

    default:
      return { text: `Unknown action: ${action}` };
  }
}

async function setPriority(repoPath: string, taskId: string, priority: string): Promise<CommandResult> {
  try {
    const tasksPath = path.join(repoPath, 'swarm', 'TASKS.json');

    if (!fs.existsSync(tasksPath)) {
      return { text: 'No tasks file found' };
    }

    const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
    const task = tasks.find((t: any) => t.id === taskId);

    if (!task) {
      return { text: `Task ${taskId} not found` };
    }

    task.priority = priority;
    fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));

    const emoji = priority === 'critical' ? '🔴' : priority === 'high' ? '🟠' : '🟡';

    return {
      text: `${emoji} Priority set to <b>${priority}</b>\n\nTask: ${task.title}`,
      keyboard: [[{ text: '📋 View Tasks', callback_data: 'list_tasks' }]],
    };
  } catch (error: any) {
    return { text: `Error: ${error.message}` };
  }
}

// ============================================================================
// WEBHOOK & POLLING
// ============================================================================

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let lastUpdateId = 0;

export async function startPolling(repoPath: string, intervalMs: number = 2000): Promise<void> {
  const config = loadTelegramConfig(repoPath);

  if (!config.botToken) {
    console.error('Telegram bot token not set');
    return;
  }

  console.log('Starting Telegram bot polling...');

  pollingInterval = setInterval(async () => {
    try {
      const updates = await callTelegramApi(config.botToken, 'getUpdates', {
        offset: lastUpdateId + 1,
        timeout: 1,
      });

      for (const update of updates as TelegramUpdate[]) {
        lastUpdateId = update.update_id;

        if (update.message?.text) {
          const text = update.message.text;
          const [command, ...args] = text.split(' ');

          if (command.startsWith('/')) {
            const result = await handleCommand(repoPath, command, args);
            await callTelegramApi(config.botToken, 'sendMessage', {
              chat_id: update.message.chat.id,
              text: result.text,
              parse_mode: 'HTML',
              reply_markup: result.keyboard ? { inline_keyboard: result.keyboard } : undefined,
            });
          }
        }

        if (update.callback_query) {
          const result = await handleCallback(repoPath, update.callback_query.data);

          // Answer callback query
          await callTelegramApi(config.botToken, 'answerCallbackQuery', {
            callback_query_id: update.callback_query.id,
          });

          // Edit message
          await callTelegramApi(config.botToken, 'editMessageText', {
            chat_id: update.callback_query.message.chat.id,
            message_id: update.callback_query.message.message_id,
            text: result.text,
            parse_mode: 'HTML',
            reply_markup: result.keyboard ? { inline_keyboard: result.keyboard } : undefined,
          });
        }
      }
    } catch (error) {
      // Ignore polling errors
    }
  }, intervalMs);
}

export function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('Telegram bot polling stopped');
  }
}

// ============================================================================
// SMART TOOL INTERFACE
// ============================================================================

export interface TelegramToolParams {
  action: string;
  repoPath: string;
  // Config
  botToken?: string;
  chatId?: string;
  enabled?: boolean;
  // Notifications
  event?: string;
  taskId?: string;
  title?: string;
  priority?: string;
  agent?: string;
  message?: string;
  // Command
  command?: string;
  args?: string[];
}

export async function handleTelegramTool(params: TelegramToolParams): Promise<any> {
  const { action, repoPath } = params;

  switch (action) {
    // Config
    case 'setup':
      return saveTelegramConfig(repoPath, {
        botToken: params.botToken,
        chatId: params.chatId,
        enabled: params.enabled ?? true,
      });

    case 'config':
      return loadTelegramConfig(repoPath);

    case 'enable':
      return saveTelegramConfig(repoPath, { enabled: true });

    case 'disable':
      return saveTelegramConfig(repoPath, { enabled: false });

    // Send
    case 'send':
      return await sendMessage(repoPath, params.message || '');

    // Notify
    case 'notify_task_created':
      await notifyTaskCreated(repoPath, params.taskId!, params.title!, params.priority || 'medium', params.agent);
      return { success: true };

    case 'notify_task_completed':
      await notifyTaskCompleted(repoPath, params.taskId!, params.title!, params.agent!);
      return { success: true };

    case 'notify_task_failed':
      await notifyTaskFailed(repoPath, params.taskId!, params.title!, params.agent!);
      return { success: true };

    case 'notify_agent_joined':
      await notifyAgentJoined(repoPath, params.agent!, params.message || 'unknown');
      return { success: true };

    case 'notify_agent_died':
      await notifyAgentDied(repoPath, params.agent!, 'recently', 0);
      return { success: true };

    // Polling
    case 'start_polling':
      await startPolling(repoPath);
      return { success: true, message: 'Polling started' };

    case 'stop_polling':
      stopPolling();
      return { success: true, message: 'Polling stopped' };

    // Command
    case 'command':
      return await handleCommand(repoPath, params.command!, params.args || []);

    default:
      return { error: `Unknown action: ${action}` };
  }
}
