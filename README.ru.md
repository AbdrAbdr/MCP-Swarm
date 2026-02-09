> 🇬🇧 [Read in English](./README.md) | 📋 [История изменений](./CHANGELOG.ru.md)

[![npm version](https://img.shields.io/npm/v/mcp-swarm.svg)](https://www.npmjs.com/package/mcp-swarm)
[![npm downloads](https://img.shields.io/npm/dm/mcp-swarm.svg)](https://www.npmjs.com/package/mcp-swarm)
[![license](https://img.shields.io/npm/l/mcp-swarm.svg)](https://github.com/AbdrAbdr/MCP-Swarm/blob/main/LICENSE)
[![CI](https://github.com/AbdrAbdr/MCP-Swarm/actions/workflows/ci.yml/badge.svg)](https://github.com/AbdrAbdr/MCP-Swarm/actions/workflows/ci.yml)

<p align="center">
  <img src="./assets/banner.png" alt="MCP Swarm Banner" width="800" />
</p>

# 🐝 MCP Swarm v1.0.6 — Универсальная Платформа Координации AI-Агентов

> 🌉 **v1.0.6 — Полный Remote Bridge:** Все **26 Smart Tools** теперь работают через Remote Bridge (было 3). Авто-запуск companion с передачей `MCP_SERVER_URL`. Обновитесь: `npm install -g mcp-swarm@latest`

**MCP Swarm** — это глобальная «нервная система» для ваших AI-помощников. Она превращает разрозненных агентов (Claude, Cursor, Windsurf, OpenCode) в слаженную команду, способную работать над огромными проектами без конфликтов и потери контекста.

---

## 🧠 Что это такое?

Когда вы используете несколько AI-инструментов одновременно, они часто «сталкиваются лбами»: редактируют одни и те же файлы, переделывают работу друг друга или просто не знают, что сделал коллега пять минут назад.

**MCP Swarm решает это раз и навсегда:**
1.  **Командная работа:** Агенты видят друг друга и общаются.
2.  **Безопасность:** Система блокировки файлов (File Locking) не дает двум агентам писать в один файл одновременно.
3.  **Память:** Всё, что сделано сегодня, сохраняется в папке `swarm/`. Завтра любой агент продолжит с того же места.
4.  **Лидерство:** Система сама выбирает Оркестратора, который раздает задачи и следит за порядком.

---

## 🛠 26 Smart Tools: Инструментарий Swarm

В v1.0.2 мы **консолидировали 54 инструмента в 26** — без потери функциональности, IDE загружает в 2× меньше слотов. Каждый инструмент использует параметр `action` для доступа к нескольким операциям.

### 🚀 Ядро системы (2)

| # | Инструмент | Включает | Основные действия |
|---|-----------|----------|-------------------|
| 1 | **swarm_agent** | agent + companion | `register`, `whoami`, `init`, `status`, `stop`, `pause`, `resume` |
| 2 | **swarm_control** | control + pulse | `stop`, `resume`, `status`, `pulse_update`, `pulse_get` |

### 📋 Управление задачами и планами (2)

| # | Инструмент | Включает | Основные действия |
|---|-----------|----------|-------------------|
| 3 | **swarm_task** | task + briefing | `create`, `list`, `update`, `decompose`, `save_briefing`, `load_briefing` |
| 4 | **swarm_plan** | plan + spec | `create`, `add`, `next`, `start`, `complete`, `prompt`, `export`, `spec_start`, `spec_phase` |

### 🔒 Файлы и Git (3)

| # | Инструмент | Включает | Основные действия |
|---|-----------|----------|-------------------|
| 5 | **swarm_file** | file + snapshot | `reserve`, `release`, `list`, `forecast`, `snapshot_create`, `snapshot_rollback` |
| 6 | **swarm_worktree** | worktree + hooks | `create`, `list`, `remove`, `hook_install`, `hook_run` |
| 7 | **swarm_git** | git + dependency | `sync`, `pr`, `health`, `cleanup`, `dep_signal`, `dep_sync` |

### 💬 Коммуникация (4)

| # | Инструмент | Включает | Основные действия |
|---|-----------|----------|-------------------|
| 8 | **swarm_chat** | chat + review | `broadcast`, `dashboard`, `thought`, `request`, `respond` |
| 9 | **swarm_voting** | voting + auction | `start`, `vote`, `list`, `auction_announce`, `auction_bid` |
| 10 | **swarm_orchestrator** | orchestrator | `elect`, `info`, `heartbeat`, `resign`, `executors` |
| 11 | **swarm_message** | message + mcp | `send`, `inbox`, `ack`, `reply`, `mcp_scan`, `mcp_authorize` |

### 🛡️ Безопасность (1)

| # | Инструмент | Включает | Основные действия |
|---|-----------|----------|-------------------|
| 12 | **swarm_defence** | defence + immune + consensus | `scan`, `validate_agent`, `quarantine`, `trust`, `alert`, `join`, `elect`, `propose`, `vote` |

### 📊 Аналитика (3)

| # | Инструмент | Включает | Основные действия |
|---|-----------|----------|-------------------|
| 13 | **swarm_budget** | cost + budget | `log`, `agent`, `project`, `limit`, `analyze`, `recommend`, `route` |
| 14 | **swarm_moe** | moe + sona | `moe_route`, `moe_feedback`, `moe_experts`, `sona_route`, `sona_learn`, `sona_specialists` |
| 15 | **swarm_quality** | quality + regression | `run`, `report`, `threshold`, `pr_ready`, `baseline`, `check_regression` |

### 🧠 Интеллект (4)

| # | Инструмент | Включает | Основные действия |
|---|-----------|----------|-------------------|
| 16 | **swarm_vector** | HNSW поиск | `init`, `add`, `search`, `get`, `delete`, `duplicates`, `embed` |
| 17 | **swarm_booster** | быстрый исполнитель | `execute`, `can_boost`, `stats`, `history`, `types` |
| 18 | **swarm_brain** | brainstorm + debug | `bs_start`, `bs_ask`, `bs_propose`, `dbg_start`, `dbg_hypothesis`, `dbg_fix` |
| 19 | **swarm_context** | context + pool + batch | `estimate`, `compress`, `pool_add`, `pool_search`, `batch_queue`, `batch_result` |

### 🏗️ Инфраструктура (7)

| # | Инструмент | Включает | Основные действия |
|---|-----------|----------|-------------------|
| 20 | **swarm_health** | health + preemption | `check`, `dead`, `reassign`, `trigger`, `resolve_urgent` |
| 21 | **swarm_external** | external + platform | `enable_github`, `sync_all`, `create_issue`, `platform_request` |
| 22 | **swarm_expertise** | expertise + routing | `track`, `suggest`, `experts`, `route_find_agent`, `route_auto_assign` |
| 23 | **swarm_knowledge** | knowledge + docs + advice | `archive`, `search`, `doc_generate`, `advice_request` |
| 24 | **swarm_session** | session + timeline + screenshot | `start`, `log`, `stop`, `replay`, `timeline_generate`, `screenshot_share` |
| 25 | **swarm_clusters** | clusters + conflict | `init`, `list`, `find`, `conflict_predict`, `conflict_hotspots` |
| 26 | **swarm_telegram** | telegram + qa | `setup`, `send`, `notify_*`, `qa_start`, `qa_iterate`, `qa_report` |

---

### Примеры использования

<details>
<summary><strong>🧠 swarm_moe — Маршрутизация AI-моделей (включая SONA)</strong></summary>

```typescript
// Маршрутизация задачи к лучшей модели (21 эксперт)
swarm_moe({
  action: "moe_route",
  content: "Написать React-компонент для авторизации",
  preferredTier: "premium",
  maxCost: 0.05,
  repoPath
})
// → { selectedExpert: "claude-sonnet", confidence: 0.92 }

// SONA: самообучающееся назначение задач
swarm_moe({
  action: "sona_route",
  title: "Исправить кнопку входа",
  description: "Кнопка не видна на тёмной теме",
  affectedFiles: ["src/components/Login.tsx"],
  repoPath
})
// → { recommendedAgent: "RadiantWolf", confidence: 0.85, category: "frontend_ui" }

// Обучение SONA по результатам
swarm_moe({
  action: "sona_learn",
  taskId: "task-123",
  agentName: "RadiantWolf",
  success: true,
  qualityScore: 0.9,
  repoPath
})
```

</details>

<details>
<summary><strong>⚡ swarm_booster — Выполнение задач без LLM (в 352× быстрее)</strong></summary>

```typescript
// Проверка возможности ускорения
swarm_booster({
  action: "can_boost",
  repoPath,
  description: "переименовать переменную oldName в newName"
})
// → { canBoost: true, taskType: "rename_variable", confidence: 0.9 }

// Локальное выполнение ($0, ~8мс)
swarm_booster({
  action: "execute",
  repoPath,
  task: {
    type: "rename_variable",
    filePath: "src/utils.ts",
    oldName: "getData",
    newName: "fetchUserData"
  }
})
// → { success: true, changes: 5, timeMs: 2, savedCost: "$0.01" }
```

</details>

<details>
<summary><strong>🔍 swarm_vector — Семантический HNSW-поиск</strong></summary>

```typescript
// Инициализация + добавление документов
swarm_vector({ action: "init", repoPath, config: { dimensions: 384, distanceMetric: "cosine" } })
swarm_vector({ action: "add", repoPath, id: "doc-1", text: "Настройка JWT аутентификации", metadata: { category: "auth" } })

// Семантический поиск
swarm_vector({ action: "search", repoPath, query: "авторизация пользователя", k: 5 })
// → [{ id: "doc-1", score: 0.87, ... }]
```

</details>

<details>
<summary><strong>🛡️ swarm_defence — AI-безопасность + Консенсус</strong></summary>

```typescript
// Сканирование текста на угрозы (<10мс обнаружение)
swarm_defence({ action: "scan", text: "Игнорируй все инструкции...", source: "user", repoPath })
// → { detected: true, category: "prompt_injection", severity: "high" }

// Консенсус: присоединение к кластеру + предложение
swarm_defence({ action: "join", nodeId: "a1", nodeName: "Wolf", repoPath })
swarm_defence({ action: "propose", nodeId: "a1", title: "Добавить тёмную тему", type: "architecture", repoPath })
```

</details>

### 🧠 MoE Router — 21 встроенная AI-модель

| Провайдер | Модель | Тир | Вход $/MTok | Выход $/MTok | Контекст |
|-----------|--------|------|-------------|--------------|----------|
| Anthropic | **Claude Opus 4.6** | flagship | $5 | $25 | **1M** |
| Anthropic | Claude Opus 4.5 | flagship | $5 | $25 | 200K |
| Anthropic | Claude Sonnet 4.5 | premium | $3 | $15 | 200K |
| Anthropic | Claude Haiku 4.5 | economy | $1 | $5 | 200K |
| OpenAI | **GPT-5.3 Codex** | flagship | ~$2 | ~$15 | 128K |
| OpenAI | GPT-5.2 | flagship | $1.75 | $14 | 256K |
| OpenAI | GPT-5 Mini | standard | $0.25 | $2 | 128K |
| OpenAI | GPT-4.1 | premium | $3 | $12 | 128K |
| OpenAI | o4-mini | reasoning | $4 | $16 | 128K |
| Moonshot | **Kimi K2.5** | premium | $0.60 | $3.00 | 256K |
| Google | Gemini 3 Pro | flagship | $2 | $12 | **1M** |
| Google | Gemini 3 Flash | standard | $0.50 | $3 | **1M** |
| Google | Gemini 2.5 Pro | premium | $1.25 | $10 | **1M** |

---
## 🔄 Жизненный цикл роя

### 1. Начало работы (Новый или Старый проект)
Вы открываете проект и говорите: **«Используй MCP Swarm»**. 
Первый агент вызывает `register` и `elect`. 
*   **Если проект новый:** Сервер сам создаст файлы правил (`CLAUDE.md`, `GEMINI.md` и др.) и папки.
*   **Если проект уже работает в Swarm:** Сервер подхватит историю из папки `swarm/`.

### 2. Оркестратор — Сердце системы
Первый агент, ставший Оркестратором, входит в **бесконечный цикл**. Он:
*   Никогда не замолкает.
*   Постоянно мониторит `PULSE.md`.
*   Распределяет входящие задачи.
*   Спит только тогда, когда человек нажмет «Stop».

### 3. Утро следующего дня
Когда вы выключаете компьютер, состояние сохраняется в Git/Файлах. 
Утром первый запущенный агент проверяет: «Есть ли живой Оркестратор?». Если нет — он сам забирает эту роль, читает вчерашние задачи и продолжает координировать команду. **История никогда не сбрасывается.**

---

## 🔄 Обновление с предыдущих версий

Если MCP Swarm установлен через npm:
```bash
npm install -g mcp-swarm@latest
```

Если вы клонировали репозиторий:
```bash
cd /path/to/Swarm_MCP
git pull
npm install
npm run build
```

> 🙏 Приносим извинения за проблему совместимости Zod в версиях 0.9.14–0.9.15. Диапазон `zod@^3.23.8` автоматически устанавливал v3.25.76 (Zod v4 bridge), который удалил внутренний метод `_parse()`, ломая все 54 Smart Tools.

---

## ⚙️ Установка

### 🚀 One-Click Install (Рекомендуется)

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/AbdrAbdr/MCP-Swarm/main/install.ps1 | iex
```

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/AbdrAbdr/MCP-Swarm/main/install.sh | bash
```

Установщик автоматически:
- ✅ Проверит/установит Node.js
- ✅ Найдёт ваши IDE (Claude Desktop, Cursor, Windsurf, OpenCode, VS Code)
- ✅ Спросит Telegram ID для уведомлений
- ✅ Добавит конфиг (не перезаписывая существующие MCP серверы!)

---

### 📦 Альтернатива: через npx

Если Node.js уже установлен:

```bash
npx mcp-swarm-install
```

Или с параметрами:
```bash
npx mcp-swarm-install --telegram-user-id 513235861 --auto-install --yes
```

---

### 🔧 Ручная установка

<details>
<summary><strong>Клонирование и сборка</strong></summary>

```bash
# Windows
git clone https://github.com/AbdrAbdr/MCP-Swarm.git C:/MCP/Swarm_MCP
cd C:/MCP/Swarm_MCP && npm install && npm run build

# macOS
git clone https://github.com/AbdrAbdr/MCP-Swarm.git ~/Documents/Swarm_MCP
cd ~/Documents/Swarm_MCP && npm install && npm run build

# Linux
git clone https://github.com/AbdrAbdr/MCP-Swarm.git ~/mcp/Swarm_MCP
cd ~/mcp/Swarm_MCP && npm install && npm run build
```
</details>

### Конфигурация для вашей IDE

<details>
<summary><strong>🖥️ Claude Desktop</strong></summary>

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux:** `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/MCP/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "SWARM_PROJECT": "default"
      }
    }
  }
}
```
</details>

<details>
<summary><strong>🎯 Cursor</strong></summary>

**Settings → Features → MCP Servers → Add New**

Или создайте `.cursor/mcp.json` в домашней директории:

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/MCP/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "SWARM_PROJECT": "default"
      }
    }
  }
}
```
</details>

<details>
<summary><strong>🌊 Windsurf</strong></summary>

**Cascade → Settings → MCP Servers → Add Server**

Или создайте `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/MCP/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "SWARM_PROJECT": "default"
      }
    }
  }
}
```
</details>

<details>
<summary><strong>💻 OpenCode CLI</strong></summary>

Создайте `~/.opencode/mcp.json`:

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/MCP/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "SWARM_PROJECT": "default"
      }
    }
  }
}
```
</details>

<details>
<summary><strong>🤖 VS Code + Copilot/Continue</strong></summary>

Создайте `.vscode/mcp.json` в домашней директории:

```json
{
  "servers": {
    "mcp-swarm": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/MCP/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "SWARM_PROJECT": "default"
      }
    }
  }
}
```
</details>

> **⚠️ Важно:** Замените `C:/MCP/Swarm_MCP` на актуальный путь к клонированному репозиторию!
> - Windows: `C:/MCP/Swarm_MCP`
> - macOS: `/Users/USERNAME/Documents/Swarm_MCP`
> - Linux: `/home/USERNAME/mcp/Swarm_MCP`

---

## ☁️ Установка (Remote — без локальных файлов)

**v0.9.11 NEW:** Теперь используется **Streamable HTTP** транспорт вместо SSE для совместимости с Cloudflare Workers!

### 🆓 Cloudflare Workers — ЭТО БЕСПЛАТНО!

MCP Swarm использует Cloudflare Workers для облачной инфраструктуры. **Вам не нужно ничего платить!**

**Free Tier лимиты (более чем достаточно для личного использования):**

| Ресурс | Бесплатный лимит | Для MCP Swarm |
|--------|------------------|---------------|
| **Workers Requests** | 100,000 / день | ~1000 агентов/день |
| **Durable Objects Requests** | 1,000,000 / месяц | Хватит на большую команду |
| **Durable Objects Storage** | 1 GB | Годы истории сообщений |
| **WebSocket Messages** | Без лимита | ∞ |
| **CPU Time** | 10ms / запрос | Достаточно |

> 💡 **Для сравнения:** Если вы работаете 8 часов в день с 5 агентами, вы используете ~5% от бесплатного лимита.

### Шаг 1: Создайте аккаунт Cloudflare (бесплатно)

1. Перейдите на [dash.cloudflare.com](https://dash.cloudflare.com)
2. Зарегистрируйтесь (email + пароль)
3. Подтвердите email
4. **Готово!** Карта не нужна.

### Шаг 2: Задеплойте свою инфраструктуру

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/AbdrAbdr/MCP-Swarm.git
cd Swarm_MCP

# 2. Залогиньтесь в Cloudflare (откроется браузер)
npx wrangler login

# 3. Задеплойте Hub (координация агентов)
cd cloudflare/hub
npx wrangler deploy
# ✅ Запишите URL: wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws

# 4. Задеплойте MCP Server
cd ../mcp-server
# Откройте wrangler.toml и замените HUB_URL на ваш Hub URL из шага 3
npx wrangler deploy
# ✅ Запишите URL: https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp
```

### Шаг 3: (Опционально) Telegram Bot

```bash
# 1. Откройте Telegram, найдите @BotFather
# 2. Отправьте /newbot, следуйте инструкциям
# 3. Скопируйте токен (выглядит как: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz)

cd cloudflare/telegram-bot
# Откройте wrangler.toml и замените SWARM_HUB_URL на ваш Hub URL

# Добавьте токен как секрет
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Вставьте токен и нажмите Enter

npx wrangler deploy
# ✅ Запишите URL: https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev

# 4. Установите webhook (замените YOUR_TOKEN и YOUR-SUBDOMAIN)
curl "https://api.telegram.org/botYOUR_TOKEN/setWebhook?url=https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev/webhook"
```

### Шаг 4: Настройте IDE

**Вариант A: Remote (рекомендуется)**

```bash
npm install -g mcp-swarm
```

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": [
        "-y",
        "-p", "mcp-swarm",
        "mcp-swarm-remote",
        "--url", "https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp",
        "--telegram-user-id", "YOUR_TELEGRAM_ID"
      ]
    }
  }
}
```

**Вариант B: Локальный с Hub**

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/path/to/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_ID"
      }
    }
  }
}
```

### 🔄 Сравнение вариантов

| Функция | Remote | Local+Hub |
|---------|--------|-----------|
| Установка | `npm i -g mcp-swarm` | `git clone && npm build` |
| Конфиг | Короткий | Длинный |
| Данные | Ваш Worker | Локально |
| Offline | ❌ | ✅ (с Hub fallback) |
| Latency | ~50-100ms | <10ms |

### ❓ Что такое YOUR-SUBDOMAIN?

Когда вы деплоите Worker, Cloudflare автоматически создаёт URL:
```
https://mcp-swarm-hub.abdr.workers.dev
                      ^^^^
                      Это ваш subdomain (имя аккаунта)
```

Вы увидите его в выводе команды `npx wrangler deploy`.

> 📖 Подробная документация: [REMOTE.md](./REMOTE.md)

---

## 🆔 Smart Project ID

MCP Swarm автоматически определяет уникальный ID для каждого проекта:

```
┌─────────────────────────────────────────────────────────────┐
│                    getProjectId(repoPath)                    │
├─────────────────────────────────────────────────────────────┤
│  1. SWARM_PROJECT env?  ──────► Использовать явно заданный  │
│           ↓ нет                                              │
│  2. git remote origin?  ──────► "github_user_repo"          │
│           ↓ нет                                              │
│  3. Имя папки + хеш     ──────► "MCP0_a1b2c3"               │
└─────────────────────────────────────────────────────────────┘
```

**Примеры:**
- `https://github.com/user/my-repo.git` → `github_user_my-repo`
- `C:\Users\abdr\Desktop\MCP\MCP0` → `MCP0_a1b2c3`
- `SWARM_PROJECT="custom-id"` → `custom-id`

Это гарантирует, что агенты из разных проектов не попадут в один Hub room.

---

## 🚀 Как начать?
Просто напишите любому агенту в любом проекте: 
> **"Используй MCP Swarm. Зарегистрируйся и стань оркестратором, если ты первый."**

Дальше магия произойдет сама. 🐝

---

## 📱 Telegram Bot — Настройка

MCP Swarm поддерживает Telegram уведомления через **вашего собственного бота**.

### Создание бота

1. Откройте Telegram и найдите **@BotFather**
2. Отправьте `/newbot` и следуйте инструкциям
3. Скопируйте токен (выглядит как `123456789:ABCdef...`)
4. Задеплойте `cloudflare/telegram-bot` (см. инструкции выше)

### Получение User ID

1. Откройте **вашего бота** в Telegram
2. Отправьте `/start`
3. Бот покажет ваш **User ID** (число, например `987654321`)

### Добавьте User ID в конфигурацию

**Для локального MCP:**

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

```powershell
$env:TELEGRAM_USER_ID = "987654321"
```
</details>

<details>
<summary><strong>macOS / Linux</strong></summary>

```bash
export TELEGRAM_USER_ID="987654321"
```
</details>

<details>
<summary><strong>В конфиге MCP</strong></summary>

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/MCP/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "TELEGRAM_USER_ID": "987654321"
      }
    }
  }
}
```
</details>

**Для Remote MCP:**

Добавьте `telegram_user_id` в URL:
```json
{
  "mcpServers": {
    "mcp-swarm": {
      "url": "https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp/sse?telegram_user_id=YOUR_USER_ID",
      "transport": "sse"
    }
  }
}
```

### Шаг 3: Запустите MCP и проверьте

1. Откройте проект в IDE
2. Зарегистрируйте агента: `swarm_agent({ action: "register", repoPath })`
3. Проект автоматически появится в Telegram боте
4. В боте нажмите "📂 Мои проекты" или отправьте `/projects`
5. Выберите проект для просмотра статуса

### 🔔 Уведомления

Бот отправляет уведомления о:
- 📋 Создании/завершении задач
- 🤖 Присоединении/отключении агентов
- 🚨 CI/CD ошибках
- 👀 Запросах на review
- 🗳 Голосованиях

### ⌨️ Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Показать User ID и инструкции |
| `/projects` или `/link` | Список ваших проектов |
| `/status` | Статус текущего проекта |
| `/agents` | Список агентов |
| `/tasks` | Список задач |
| `/reviews` | Список pending code reviews (v0.9.12) |
| `/approve [id]` | Одобрить code review (v0.9.12) |
| `/reject [id] [reason]` | Отклонить code review (v0.9.12) |
| `/stop` | Остановить Swarm |
| `/resume` | Возобновить |

### 🔘 Inline кнопки

Все уведомления приходят с **интерактивными кнопками**:
- **Claim** — взять задачу
- **View** — посмотреть детали
- **Approve/Reject** — одобрить/отклонить review
- **Vote** — проголосовать за решение
- **Priority** — установить приоритет (🔴Critical, 🟠High, 🟡Medium)

---

## 🔧 Troubleshooting / Решение проблем

<details>
<summary><strong>❌ "Cannot find module" или "Error: ENOENT"</strong></summary>

1. Проверьте, что проект собран:
   ```bash
   cd /path/to/Swarm_MCP
   npm run build
   ```
2. Убедитесь, что путь в конфигурации правильный и ведёт к `dist/serverSmart.js`
3. Используйте абсолютный путь (не `./` или `~`)

</details>

<details>
<summary><strong>❌ Агент не становится оркестратором</strong></summary>

Оркестратор может быть уже активен. Проверьте:
```bash
cat .swarm/ORCHESTRATOR.json
```

Если `lastHeartbeat` устарел более чем на 60 секунд, следующий агент автоматически возьмёт роль.

Чтобы форсировать смену: удалите файл `.swarm/ORCHESTRATOR.json` или вызовите `swarm_orchestrator({ action: "resign", repoPath })`.

</details>

<details>
<summary><strong>❌ "repoPath is required" ошибка</strong></summary>

**КАЖДЫЙ** вызов MCP Swarm должен содержать `repoPath`:
```typescript
// ✅ Правильно
swarm_agent({ action: "register", repoPath: "C:/projects/my-app" })

// ❌ Неправильно
swarm_agent({ action: "register" })
```

</details>

<details>
<summary><strong>❌ Cloudflare Hub недоступен</strong></summary>

1. Проверьте интернет-соединение
2. Убедитесь что ваш Hub задеплоен и URL правильный
3. При проблемах система автоматически использует локальный Git-fallback

</details>

<details>
<summary><strong>❌ Папка swarm/ не создаётся автоматически</strong></summary>

При первом вызове `swarm_agent({ action: "register", repoPath })` папка `swarm/` и все файлы правил должны создаться автоматически.

Если не работает — вызовите вручную:
```typescript
swarm_agent({ action: "init", repoPath: "/path/to/project" })
```

</details>

<details>
<summary><strong>❌ Файлы заблокированы другим агентом</strong></summary>

Проверьте кто держит блокировку:
```typescript
swarm_file({ action: "list", repoPath: "/path/to/project" })
```

Если агент «мёртв» (heartbeat > 60 сек), система автоматически освободит файлы.

</details>

---

## 📊 Архитектура

### Cloudflare Workers (Ваши endpoints после деплоя)

| Worker | URL (пример) | Назначение |
|--------|-----|------------|
| **Hub** | `wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws` | Координация агентов |
| **MCP Server** | `https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp` | Remote MCP (HTTP) |
| **Telegram Bot** | `https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev` | Уведомления |

### Схема

```
┌─────────────────────────────────────────────────────────────┐
│                  CLOUDFLARE WORKERS                         │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │   Hub (DO)      │  │  MCP Server     │  │  Telegram   │  │
│  │   /ws           │◄─│  /mcp (HTTP)    │  │  /webhook   │  │
│  │   /api/*        │  │  (Streamable)   │  │             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│                               │                             │
└───────────────────────────────┼─────────────────────────────┘
                                │ WebSocket
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
    ┌──────────┐          ┌──────────┐          ┌──────────┐
    │ Windows  │          │   Mac    │          │  Linux   │
    │ (Cursor) │          │(Windsurf)│          │(OpenCode)│
    │          │          │          │          │          │
    │ Companion│          │ Companion│          │ Companion│
    │ + Bridge │          │ + Bridge │          │ + Bridge │
    └──────────┘          └──────────┘          └──────────┘
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                ▼
                    ┌─────────────────────┐
                    │   YOUR PROJECT      │
                    │   /path/to/project  │
                    │                     │
                    │   .swarm/           │ ← State & messages
                    │   swarm/            │ ← Tasks & agents
                    │   orchestrator/     │ ← Plans & specs
                    │   CLAUDE.md         │ ← Agent rules
                    │   GEMINI.md         │
                    └─────────────────────┘
```

### cloudflare/ структура

```
cloudflare/
├── hub/              # Координационный Hub (Durable Objects)
│   ├── src/index.ts  # SwarmRoom - задачи, чат, locks
│   └── wrangler.toml
│
├── mcp-server/       # Remote MCP Server (Streamable HTTP)
│   ├── src/index.ts  # MCP-over-HTTP (v0.9.11)
│   └── wrangler.toml
│
└── telegram-bot/     # Telegram Bot (Webhook)
    ├── worker.ts     # Команды: /status, /agents, /tasks
    └── wrangler.toml
```

---

## 📝 Changelog

См. [CHANGELOG.md](./CHANGELOG.md)

---

## 🤝 Contributing

PRs welcome! Основные принципы:
1. Все tool'ы должны принимать `repoPath`
2. Состояние сохраняется в файлы (не в память)
3. Тесты перед мерджем

---

## 📜 License

MIT © 2025
