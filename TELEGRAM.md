> <img src="https://flagcdn.com/20x15/ru.png" alt="RU" /> [Читать на русском](#-настройка-telegram-бота)

# 📱 Telegram Bot Setup Guide

MCP Swarm includes a Telegram bot for project monitoring and agent notifications.

## Where Each Credential Goes

> [!IMPORTANT]
> This is the most critical section — it explains where **each** Telegram credential is stored.

| Credential | Where to add | How to get | Required? |
|------------|-------------|------------|-----------|
| **`TELEGRAM_USER_ID`** | `mcp_config.json` → `env` section | Send `/start` to [@userinfobot](https://t.me/userinfobot) | ✅ For notifications |
| **`TELEGRAM_BOT_URL`** | `mcp_config.json` → `env` section | URL of deployed bot worker (e.g. `https://mcp-swarm-telegram.your-subdomain.workers.dev`) | ✅ For notifications |
| **`TELEGRAM_BOT_TOKEN`** | **Cloudflare Secret** via CLI | Create bot via [@BotFather](https://t.me/BotFather) → copy token | ✅ Only for deploying your own bot |
| **Bot Username** | Nowhere in config — Telegram only | Set during creation in @BotFather (e.g. `@MyCFSwarmBot`) | ❌ Info only |

### Where each credential lives:

```
┌─────────────────────────────────────────────────────────────────────┐
│  mcp_config.json (your IDE config)                                  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  "env": {                                                      │ │
│  │    "SWARM_HUB_URL": "wss://...",                              │ │
│  │    "TELEGRAM_USER_ID": "513235861",        ← Your User ID     │ │
│  │    "TELEGRAM_BOT_URL": "https://..."       ← Bot Worker URL   │ │
│  │  }                                                             │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Cloudflare Workers (secret, NOT in any config file)                │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  TELEGRAM_BOT_TOKEN = "123456789:ABCdefGHI..."                │ │
│  │  Set via: npx wrangler secret put TELEGRAM_BOT_TOKEN          │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Telegram (@BotFather)                                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Bot Username: @MyCFSwarmBot                                   │ │
│  │  → Used only to find the bot in Telegram search               │ │
│  │  → NOT stored in any MCP config                               │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

> [!CAUTION]
> **Never** put `TELEGRAM_BOT_TOKEN` in `mcp_config.json` or any config file! It is a secret and must only be stored as a Cloudflare Worker secret.

---

## Step 1: Get Your Telegram User ID

You need your **numeric Telegram User ID** (not your username).

### Option A: Via @userinfobot (Recommended)
1. Open Telegram
2. Search for **@userinfobot** or go to [t.me/userinfobot](https://t.me/userinfobot)
3. Press **Start**
4. The bot will reply with your **User ID** (a number like `513235861`)
5. Copy this number

### Option B: Via MCP Swarm Bot
1. Find the MCP Swarm bot in Telegram (ask the project admin for the bot link)
2. Press **Start** or send `/myid`
3. The bot will display your User ID

---

## Step 2: Add to MCP Configuration

Add **two** environment variables to your MCP config file:

**Remote mode (recommended):**

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": ["-y", "-p", "mcp-swarm", "mcp-swarm-remote", "--url", "https://YOUR-SERVER.workers.dev/mcp"],
      "env": {
        "SWARM_HUB_URL": "wss://YOUR-HUB.workers.dev/ws",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
      }
    }
  }
}
```

**Local mode:**

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/path/to/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://YOUR-HUB.workers.dev/ws",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
      }
    }
  }
}
```

| Variable | Description |
|----------|-------------|
| `TELEGRAM_USER_ID` | Your numeric Telegram User ID from Step 1 |
| `TELEGRAM_BOT_URL` | URL of your deployed Telegram bot worker |

---

## Step 3: Restart IDE

After updating the config, restart your IDE. The companion will automatically register your project with the Telegram bot on startup.

---

## Step 4: Use the Bot

Once configured, you can use these commands in the bot:

| Command | Description |
|---------|-------------|
| `/start` | Show main menu and your User ID |
| `/projects` | List all your registered projects |
| `/status` | Show status of active project |
| `/agents` | List connected agents |
| `/tasks` | Show current tasks |
| `/myid` | Display your Telegram User ID |

---

## How It Works

```
IDE starts → Companion reads TELEGRAM_USER_ID + TELEGRAM_BOT_URL from env
           → Companion calls POST /register on the bot worker
           → Bot links your Telegram account to the project
           → You get notifications and can monitor via bot commands
```

---

## Deploy Your Own Bot (Optional)

If you want your own Telegram bot instance, follow these steps:

### 1. Create a Bot
1. Open Telegram, find [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a name (e.g. "My Swarm Bot")
4. Choose a username (e.g. `@MySwarmbotBot`) — this is **Bot Username**, used only in Telegram
5. Copy the **bot token** (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Set the Bot Token as Cloudflare Secret

```bash
cd cloudflare/telegram-bot

# This stores the token securely in Cloudflare — it will NOT be in any config file
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Paste the token from step 1 and press Enter
```

> [!WARNING]
> The token is stored **only in Cloudflare**, never in `mcp_config.json`, `wrangler.toml`, or any other file.

### 3. Configure wrangler.toml

Open `cloudflare/telegram-bot/wrangler.toml` and set the Hub URL:

```toml
[vars]
SWARM_HUB_URL = "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws"
```

### 4. Deploy the Worker

```bash
npx wrangler deploy
# ✅ Note the URL: https://YOUR-NAME-telegram.YOUR-SUBDOMAIN.workers.dev
```

### 5. Set up Webhook

```bash
# Replace YOUR_TOKEN with the bot token from step 1
# Replace YOUR-BOT-URL with the worker URL from step 4
curl "https://api.telegram.org/botYOUR_TOKEN/setWebhook?url=https://YOUR-BOT-URL.workers.dev/webhook"
```

Or use the simplified setup endpoint:
```bash
curl https://YOUR-BOT-URL.workers.dev/setup
```

### 6. Add Bot URL to MCP Config

Now add `TELEGRAM_BOT_URL` (the worker URL from step 4) to your `mcp_config.json`:

```json
"TELEGRAM_BOT_URL": "https://YOUR-BOT-URL.workers.dev"
```

---

## Quick Install

Use the installer with Telegram support:

```bash
npx mcp-swarm-install --telegram-user-id YOUR_ID
```

The installer handles `TELEGRAM_USER_ID` and `TELEGRAM_BOT_URL` automatically.

---

---

# 📱 Настройка Telegram-бота

MCP Swarm включает Telegram-бота для мониторинга проектов и уведомлений об агентах.

## Куда добавлять каждый параметр

> [!IMPORTANT]
> Это самый важный раздел — он объясняет, куда именно добавляется **каждый** Telegram-параметр.

| Параметр | Куда добавлять | Как получить | Обязательно? |
|----------|---------------|-------------|-------------|
| **`TELEGRAM_USER_ID`** | `mcp_config.json` → секция `env` | Отправить `/start` боту [@userinfobot](https://t.me/userinfobot) | ✅ Для уведомлений |
| **`TELEGRAM_BOT_URL`** | `mcp_config.json` → секция `env` | URL задеплоенного воркера (напр. `https://mcp-swarm-telegram.your-subdomain.workers.dev`) | ✅ Для уведомлений |
| **`TELEGRAM_BOT_TOKEN`** | **Cloudflare Secret** через CLI | Создать бота в [@BotFather](https://t.me/BotFather) → скопировать токен | ✅ Только для деплоя своего бота |
| **Юзернейм бота** | Нигде в конфигах — только в Telegram | Устанавливается при создании в @BotFather (напр. `@MyCFSwarmBot`) | ❌ Только для информации |

### Схема размещения:

```
┌─────────────────────────────────────────────────────────────────────┐
│  mcp_config.json (конфиг вашей IDE)                                 │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  "env": {                                                      │ │
│  │    "SWARM_HUB_URL": "wss://...",                              │ │
│  │    "TELEGRAM_USER_ID": "513235861",        ← Ваш User ID     │ │
│  │    "TELEGRAM_BOT_URL": "https://..."       ← URL воркера бота│ │
│  │  }                                                             │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Cloudflare Workers (секрет, НЕ в каком-либо конфиг-файле)         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  TELEGRAM_BOT_TOKEN = "123456789:ABCdefGHI..."                │ │
│  │  Установить: npx wrangler secret put TELEGRAM_BOT_TOKEN       │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Telegram (@BotFather)                                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Юзернейм бота: @MyCFSwarmBot                                 │ │
│  │  → Используется только для поиска бота в Telegram              │ │
│  │  → НЕ хранится ни в каком конфиге MCP                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

> [!CAUTION]
> **Никогда** не добавляйте `TELEGRAM_BOT_TOKEN` в `mcp_config.json` или любой конфиг-файл! Это секрет, который должен храниться только как Cloudflare Worker secret.

---

## Шаг 1: Узнайте свой Telegram User ID

Вам нужен **числовой Telegram User ID** (не юзернейм).

### Вариант A: Через @userinfobot (Рекомендуется)
1. Откройте Telegram
2. Найдите **@userinfobot** или перейдите по ссылке [t.me/userinfobot](https://t.me/userinfobot)
3. Нажмите **Start**
4. Бот ответит вашим **User ID** (число вроде `513235861`)
5. Скопируйте это число

### Вариант B: Через бота MCP Swarm
1. Найдите бота MCP Swarm в Telegram (спросите ссылку у администратора проекта)
2. Нажмите **Start** или отправьте `/myid`
3. Бот покажет ваш User ID

---

## Шаг 2: Добавьте в конфигурацию MCP

Добавьте **две** переменные окружения в конфиг MCP:

**Remote-режим (рекомендуемый):**

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": ["-y", "-p", "mcp-swarm", "mcp-swarm-remote", "--url", "https://YOUR-SERVER.workers.dev/mcp"],
      "env": {
        "SWARM_HUB_URL": "wss://YOUR-HUB.workers.dev/ws",
        "TELEGRAM_USER_ID": "ВАШ_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
      }
    }
  }
}
```

**Локальный режим:**

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/path/to/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://YOUR-HUB.workers.dev/ws",
        "TELEGRAM_USER_ID": "ВАШ_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
      }
    }
  }
}
```

| Переменная | Описание |
|------------|----------|
| `TELEGRAM_USER_ID` | Ваш числовой Telegram User ID из Шага 1 |
| `TELEGRAM_BOT_URL` | URL задеплоенного Telegram-бот воркера |

---

## Шаг 3: Перезапустите IDE

После обновления конфигурации перезапустите IDE. Companion автоматически зарегистрирует ваш проект в Telegram-боте при запуске.

---

## Шаг 4: Используйте бота

| Команда | Описание |
|---------|----------|
| `/start` | Главное меню и ваш User ID |
| `/projects` | Список зарегистрированных проектов |
| `/status` | Статус активного проекта |
| `/agents` | Список подключённых агентов |
| `/tasks` | Текущие задачи |
| `/myid` | Показать ваш Telegram User ID |

---

## Как это работает

```
IDE запускается → Companion читает TELEGRAM_USER_ID + TELEGRAM_BOT_URL из env
               → Companion вызывает POST /register на воркере бота
               → Бот привязывает ваш Telegram к проекту
               → Вы получаете уведомления и можете мониторить через команды бота
```

---

## Деплой своего бота (Опционально)

Если вы хотите свой экземпляр Telegram-бота:

### 1. Создайте бота
1. Откройте Telegram, найдите [@BotFather](https://t.me/BotFather)
2. Отправьте `/newbot`
3. Выберите имя (напр. "My Swarm Bot")
4. Выберите юзернейм (напр. `@MySwarmbotBot`) — это **юзернейм бота**, используется только в Telegram
5. Скопируйте **токен бота** (выглядит как `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Сохраните токен как Cloudflare Secret

```bash
cd cloudflare/telegram-bot

# Токен хранится безопасно в Cloudflare — его НЕ будет ни в каком конфиг-файле
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Вставьте токен из шага 1 и нажмите Enter
```

> [!WARNING]
> Токен хранится **только в Cloudflare**, никогда в `mcp_config.json`, `wrangler.toml` или любом другом файле.

### 3. Настройте wrangler.toml

Откройте `cloudflare/telegram-bot/wrangler.toml` и укажите Hub URL:

```toml
[vars]
SWARM_HUB_URL = "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws"
```

### 4. Задеплойте воркер

```bash
npx wrangler deploy
# ✅ Запишите URL: https://YOUR-NAME-telegram.YOUR-SUBDOMAIN.workers.dev
```

### 5. Настройте вебхук

```bash
# Замените YOUR_TOKEN на токен бота из шага 1
# Замените YOUR-BOT-URL на URL воркера из шага 4
curl "https://api.telegram.org/botYOUR_TOKEN/setWebhook?url=https://YOUR-BOT-URL.workers.dev/webhook"
```

Или используйте упрощённый setup-endpoint:
```bash
curl https://YOUR-BOT-URL.workers.dev/setup
```

### 6. Добавьте URL бота в конфиг MCP

Теперь добавьте `TELEGRAM_BOT_URL` (URL воркера из шага 4) в ваш `mcp_config.json`:

```json
"TELEGRAM_BOT_URL": "https://YOUR-BOT-URL.workers.dev"
```

---

## Быстрая установка

```bash
npx mcp-swarm-install --telegram-user-id ВАШ_ID
```

Инсталлер автоматически настроит `TELEGRAM_USER_ID` и `TELEGRAM_BOT_URL`.
