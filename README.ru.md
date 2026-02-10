> <img src="https://flagcdn.com/20x15/gb.png" alt="EN" /> [Read in English](./README.md) | 📋 [История изменений](./CHANGELOG.ru.md)

[![npm version](https://img.shields.io/npm/v/mcp-swarm.svg)](https://www.npmjs.com/package/mcp-swarm)
[![npm downloads](https://img.shields.io/npm/dm/mcp-swarm.svg)](https://www.npmjs.com/package/mcp-swarm)
[![license](https://img.shields.io/npm/l/mcp-swarm.svg)](https://github.com/AbdrAbdr/MCP-Swarm/blob/main/LICENSE)
[![CI](https://github.com/AbdrAbdr/MCP-Swarm/actions/workflows/ci.yml/badge.svg)](https://github.com/AbdrAbdr/MCP-Swarm/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![MCP Protocol](https://img.shields.io/badge/MCP-Protocol-blueviolet)](https://modelcontextprotocol.io)

<p align="center">
  <img src="./assets/banner.png" alt="MCP Swarm Banner" width="800" />
</p>

# 🐝 MCP Swarm v1.2.0 — Универсальная Платформа Координации AI-Агентов

> 🐝 **v1.2.0 — Расширение платформы:** 35 Smart Tools (9 новых), Vault с аудит-трейлом и авто-блокировкой, Setup Wizard, Analytics Store, Embeddings Cascade (много-провайдерные эмбеддинги), Vector Backends (6 адаптеров: Local, Chroma, Supabase, Qdrant, Pinecone, Turso), Auto-Index, Профили агентов, Планировщик с паузой/возобновлением, Plugin Loader, Doctor CLI (`--json`), 100% ESM, полная типобезопасность. Обновитесь: `npm install -g mcp-swarm@latest`

**MCP Swarm** — это глобальная «нервная система» для ваших AI-помощников. Она превращает разрозненных агентов (Claude, Cursor, Windsurf, OpenCode) в слаженную команду, способную работать над огромными проектами без конфликтов и потери контекста.

---

## 🎬 Быстрое демо

```
┌──────────────────────────────────────────────────────────────┐
│  Claude Code (Агент 1)         Cursor (Агент 2)              │
│  ┌─────────────────────┐        ┌─────────────────────┐     │
│  │ swarm_task create    │        │ swarm_task list      │     │
│  │ "Починить auth"       │───────▶│ → берёт задачу       │     │
│  │                      │        │                      │     │
│  │ swarm_file reserve   │        │ swarm_file reserve   │     │
│  │ auth.ts ✅ заблок.   │        │ utils.ts ✅ заблок.  │     │
│  │                      │        │                      │     │
│  │ swarm_chat broadcast │◄──────▶│ swarm_chat broadcast │     │
│  │ "Auth готов!"        │        │ "Utils готовы!"       │     │
│  └─────────────────────┘        └─────────────────────┘     │
│                                                              │
│  🌐 Hub (Cloudflare)  ←→  🐝 Companion (localhost:37373)   │
│  Синхронизация            Web Dashboard + Bridge            │
└──────────────────────────────────────────────────────────────┘
```

**Откройте `http://localhost:37373` чтобы увидеть дашборд в реальном времени!**

---


## 🧠 Что это такое?

Когда вы используете несколько AI-инструментов одновременно, они часто «сталкиваются лбами»: редактируют одни и те же файлы, переделывают работу друг друга или просто не знают, что сделал коллега пять минут назад.

**MCP Swarm решает это раз и навсегда:**
1.  **Командная работа:** Агенты видят друг друга и общаются.
2.  **Безопасность:** Система блокировки файлов (File Locking) не дает двум агентам писать в один файл одновременно.
3.  **Память:** Всё, что сделано сегодня, сохраняется в папке `swarm/`. Завтра любой агент продолжит с того же места.
4.  **Лидерство:** Система сама выбирает Оркестратора, который раздает задачи и следит за порядком.

---

## 🛠 35 Smart Tools: Инструментарий Swarm

В v1.2.0 мы расширили набор до **35 Smart Tools** (с 26 в v1.1.x) — 9 новых инструментов для секретов, аналитики, эмбеддингов, векторных бэкендов, авто-индексации, профилей агентов, планировщика задач и плагинов. Каждый инструмент использует параметр `action` для доступа к нескольким операциям.

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

### 🆕 Новое в v1.2.0 (8)

| # | Инструмент | Описание | Основные действия |
|---|-----------|----------|-------------------|
| 27 | **swarm_vault** | Управление секретами (AES-256-GCM) | `init`, `unlock`, `set`, `get`, `delete`, `list`, `rotate`, `export`, `import`, `lock`, `status`, `audit` |
| 28 | **swarm_analytics** | Метрики задач/событий | `log_task`, `log_event`, `get_tasks`, `get_events`, `get_metrics`, `summary`, `cleanup` |
| 29 | **swarm_memory** | Авто-индексация и умный контекст | `index_task`, `index_file`, `index_review`, `smart_context`, `find_error_solution`, `record_error_fix` |
| 30 | **swarm_embeddings** | Много-провайдерные эмбеддинги + бэкенды | `embed`, `health`, `costs`, `backend_status`, `backend_migrate`, `backend_switch`, `backend_health` |
| 31 | **swarm_profiles** | Профили агентов и специализация | `get`, `list`, `default`, `instructions` |
| 32 | **swarm_scheduler** | Cron-планировщик задач | `add`, `list`, `check_due`, `check_missed`, `remove` |
| 33 | **swarm_plugins** | Загрузчик и обнаружение плагинов | `discover`, `load`, `load_all`, `init_dir` |
| 34 | **swarm_github** | GitHub Issue ↔ Task синх. | `auth_status`, `list_issues`, `create_issue`, `close_issue`, `sync_from_github` |
| 35 | **swarm_setup** | Мастер настройки и конфиг | `wizard_prompt`, `wizard_run`, `config_get`, `config_exists` |

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
npx mcp-swarm-install --telegram-user-id 123456789 --auto-install --yes
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
        "SWARM_PROJECT": "default",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
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
        "SWARM_PROJECT": "default",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
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
        "SWARM_PROJECT": "default",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
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
        "SWARM_PROJECT": "default",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
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
        "SWARM_PROJECT": "default",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
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

Теперь используется **Streamable HTTP** транспорт вместо SSE для совместимости с Cloudflare Workers!

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

### Шаг 3: Telegram Bot (Опционально, но рекомендуется)

Получайте уведомления в реальном времени о задачах, агентах, ошибках и код-ревью в Telegram.

#### Куда добавлять каждый Telegram-параметр:

| Параметр | Куда добавлять | Как получить |
|----------|---------------|--------------|
| **`TELEGRAM_USER_ID`** | `mcp_config.json` → `env` | Отправьте `/start` боту [@userinfobot](https://t.me/userinfobot) |
| **`TELEGRAM_BOT_URL`** | `mcp_config.json` → `env` | URL вашего задеплоенного worker-а бота |
| **`TELEGRAM_BOT_TOKEN`** | **Cloudflare Secret** (через CLI) | Создайте бота в [@BotFather](https://t.me/BotFather) |
| **Имя бота** | Нигде — только в Telegram | Задаётся при создании в @BotFather |

> ⚠️ **Безопасность:** `TELEGRAM_BOT_TOKEN` — это **секрет**, он хранится в Cloudflare через `npx wrangler secret put`, **НИКОГДА** не добавляйте его в `mcp_config.json` или любой конфиг-файл!

#### 3.1: Получите ваш Telegram User ID

1. Откройте Telegram
2. Найдите **@userinfobot** или перейдите по ссылке [t.me/userinfobot](https://t.me/userinfobot)
3. Нажмите **Start**
4. Скопируйте **User ID** (число, например `123456789`)

#### 3.2: Создайте бота через @BotFather

1. Откройте Telegram, найдите [@BotFather](https://t.me/BotFather)
2. Отправьте `/newbot`
3. Выберите отображаемое имя (например «My Swarm Bot»)
4. Выберите username (например `@MySwarmbotBot`) — это **имя бота**, используется только для поиска в Telegram
5. Скопируйте **токен бота** (выглядит как `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

#### 3.3: Задеплойте Telegram worker

```bash
cd cloudflare/telegram-bot
```

**Установите Hub URL в `wrangler.toml`:**
```toml
[vars]
SWARM_HUB_URL = "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws"
```

**Сохраните токен бота как Cloudflare secret:**
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Вставьте токен из шага 3.2 и нажмите Enter
# ⚠️ Токен хранится БЕЗОПАСНО в Cloudflare, НЕ в файлах
```

**Задеплойте worker:**
```bash
npx wrangler deploy
# ✅ Запишите URL: https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev
```

#### 3.4: Настройте webhook

```bash
# Вариант A: Используйте упрощённый endpoint
curl https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev/setup

# Вариант B: Вручную (замените YOUR_TOKEN)
curl "https://api.telegram.org/botYOUR_TOKEN/setWebhook?url=https://mcp-swarm-telegram.YOUR-SUBDOMAIN.workers.dev/webhook"
```

#### 3.5: Откройте бота в Telegram

Найдите бота по username (например `@MySwarmbotBot`), нажмите **Start** и убедитесь, что он отвечает.

Доступные команды:

| Команда | Описание |
|---------|----------|
| `/start` | Главное меню + ваш User ID |
| `/projects` | Список зарегистрированных проектов |
| `/status` | Статус активного проекта |
| `/agents` | Подключённые агенты |
| `/tasks` | Текущие задачи |
| `/new` | Создать новую задачу |
| `/logs` | Посмотреть последние события |
| `/myid` | Ваш Telegram User ID |

> 📱 Подробнее: [TELEGRAM.md](./TELEGRAM.md).

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
        "-y", "-p", "mcp-swarm",
        "mcp-swarm-remote",
        "--url", "https://mcp-swarm-server.YOUR-SUBDOMAIN.workers.dev/mcp"
      ],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
      }
    }
  }
}
```

> 💡 `npx -y -p mcp-swarm` автоматически скачивает **последнюю версию** из npm.

**Вариант B: Локальный с Hub**

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/path/to/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws",
        "TELEGRAM_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "TELEGRAM_BOT_URL": "https://YOUR-TELEGRAM-BOT.workers.dev"
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
https://mcp-swarm-hub.myaccount.workers.dev
                      ^^^^^^^^^
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

## 📱 Telegram Bot — Краткая справка

MCP Swarm поддерживает Telegram уведомления через **вашего собственного бота**. Полная инструкция по настройке — см. [**Шаг 3**](#шаг-3-telegram-bot-опционально-но-рекомендуется) выше или [TELEGRAM.md](./TELEGRAM.md).

### 🔔 Уведомления

Бот отправляет уведомления о:
- 📋 Создании/завершении задач
- 🤖 Присоединении/отключении агентов
- 🚨 CI/CD ошибках
- 👀 Запросах на review
- 🗳 Голосованиях

### ⌨️ Команды бота

| Команда | Описание |
|---------|-----------|
| `/start` | Главное меню + ваш User ID |
| `/projects` | Список зарегистрированных проектов |
| `/status` | Статус активного проекта |
| `/agents` | Подключённые агенты |
| `/tasks` | Текущие задачи |
| `/myid` | Ваш Telegram User ID |
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

## 🩺 Doctor — CLI диагностики

```bash
# Человекочитаемый вывод
npx mcp-swarm-doctor

# JSON-вывод для CI/CD пайплайнов
npx mcp-swarm-doctor --json
```

**Пример вывода:**
```
🩺 MCP Swarm Doctor
✅ Node.js version: v23.11.1 (>= 18.0.0)
✅ Package installed: mcp-swarm@1.2.0
✅ TypeScript compiled: dist/ exists
✅ Hub URL configured: wss://mcp-swarm-hub.example.workers.dev/ws
⚠️  Telegram not configured: TELEGRAM_USER_ID is missing
```

**JSON-режим** (`--json`) возвращает структурированные результаты:
```json
[
  { "name": "node-version", "status": "pass", "message": "v23.11.1 (>= 18.0.0)" },
  { "name": "package", "status": "pass", "message": "mcp-swarm@1.2.0" },
  { "name": "telegram", "status": "warn", "message": "TELEGRAM_USER_ID is missing" }
]
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

## ⭐ Поддержите проект

Если MCP Swarm помогает вашей команде — **[поставьте звезду на GitHub](https://github.com/AbdrAbdr/MCP-Swarm)!** ⭐

Ваш отзыв формирует будущее проекта:

- 🐛 **Нашли баг?** — [Создайте Issue](https://github.com/AbdrAbdr/MCP-Swarm/issues/new)
- 💡 **Есть идея?** — [Начните обсуждение](https://github.com/AbdrAbdr/MCP-Swarm/discussions)
- 🔧 **Хотите помочь?** — [Fork & PR](https://github.com/AbdrAbdr/MCP-Swarm/fork)

[![Star on GitHub](https://img.shields.io/github/stars/AbdrAbdr/MCP-Swarm?style=social)](https://github.com/AbdrAbdr/MCP-Swarm)

---

## 📜 License

MIT © 2025–2026

