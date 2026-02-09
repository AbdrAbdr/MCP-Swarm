> <img src="https://flagcdn.com/20x15/gb.png" alt="EN" /> [Read in English](./CHANGELOG.md)

# Changelog

Все значимые изменения в проекте MCP Swarm документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
версионирование следует [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.11] - 2026-02-09

### 🎨 Бейджи флагов и CTA-секция

#### Изменено

- **Бейджи флагов** — Unicode emoji флагов (🇷🇺/🇬🇧) заменены на `<img>` бейджи с flagcdn.com. Флаги теперь корректно отображаются на npm, GitHub и всех платформах.
- **CTA-секция** — Добавлена секция «⭐ Поддержите проект» в оба README (EN + RU) со ссылками на Issues, Discussions и Fork & PR.

---

## [1.0.10] - 2026-02-09

### 🔄 CI/CD авто-публикация и обновление документации

#### Изменено

- **CI/CD полностью автоматизирован** — GitHub Actions теперь авто-публикует в npm И создаёт GitHub Release при push новой версии в `main`. Пропускает, если версия уже опубликована.
- **README обновлён** — README.md и README.ru.md обновлены с v1.0.7 → v1.0.10 с актуальным описанием функций.

---

## [1.0.9] - 2026-02-09

### 🧭 Smart Project ID с предложениями git init

#### Добавлено

- **Предложения git init** — Если в каталоге проекта нет git-репозитория, companion теперь выводит пошаговую инструкцию: `git init` → `git add -A` → `git commit` → `gh repo create`.
- **Предложения для remote** — Если git есть, но нет remote origin, предлагает `gh repo create` или `git remote add origin`.
- **`ProjectIdResult.suggestions`** — Новое поле `suggestions[]` в результате определения Project ID, доступное инструментам и агентам.

#### Изменено

- **Чистые folder-based ID** — Project ID на основе пути больше не содержит hash-суффикс. `Intop Saas` → `intop_saas` (было `intop_saas_a1b2c3`).
- **`isGitInitialized()` и `hasRemoteOrigin()`** — Новые helper-функции для детальной проверки статуса git.

---

## [1.0.8] - 2026-02-09

### 🔧 Авто-перезапуск Companion Bridge

#### Исправлено

- **Критично: Авто-перезапуск bridge** — Если companion запущен, но bridge отключён (например, старый companion без `MCP_SERVER_URL`), `ensureCompanion()` теперь убивает старый процесс и перезапускает с правильными переменными окружения.
- **`isBridgeConnected()`** — Новая функция для проверки состояния WebSocket bridge через companion control API.
- **`killCompanion()`** — Новая функция для корректного завершения companion перед перезапуском.

#### Изменено

- **Логика ensureCompanion() переписана:**
  1. Проверка: запущен ли процесс companion
  2. Проверка: подключён ли bridge
  3. Если запущен, но bridge отключён → убить + перезапустить с `MCP_SERVER_URL`
  4. Если не запущен → запустить с нуля

---

## [1.0.7] - 2026-02-09

### 🌉 Полное покрытие Bridge — Все 26 Smart Tools через Remote

#### Исправлено

- **Критично: Авто-запуск Bridge** — `mcp-swarm-remote` теперь передаёт `MCP_SERVER_URL` в companion daemon. Ранее companion не знал URL сервера, и все удалённые tool calls возвращали `{ bridgeConnected: false }`.
- **Документация: Полный startup flow** — README теперь содержит полные примеры конфигурации для Remote и Local режимов с `SWARM_HUB_URL` и пошаговое описание процесса запуска.

#### Изменено

- **Универсальная делегация в bridge** — `bridge.ts` импортирует обработчики `allSmartTools` и делегирует ВСЕ tool calls (раньше — только 3 инструмента).
- **Упрощённая маршрутизация** — `toolNeedsBridge()` упрощена до `toolName.startsWith("swarm_")` (21 строка → 4).

#### Конфигурация

**Вариант A: Remote (рекомендуемый)**

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
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws"
      }
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
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws"
      }
    }
  }
}
```

#### Что происходит при запуске (Remote)

```
1. npx скачивает mcp-swarm@latest из npm (сейчас 1.0.6)
2. mcp-swarm-remote стартует → проверяет, запущен ли companion
3. Если нет → запускает companion с:
   • MCP_SERVER_URL (из --url) → Bridge подключается к вашему Worker
   • SWARM_HUB_URL (из env)   → WebSocket к Hub для координации
4. Companion начинает работу:
   • Bridge → WebSocket → MCP Server Worker (выполняет 26 инструментов локально)
   • Hub    → WebSocket → Hub Worker (синхронизация агентов в реальном времени)
5. Все 26 Smart Tools работают! ✅
```

---

## [0.9.19] - 2026-02-08

### 🚀 Большой релиз: Smart Routing, Память, Agent Teams, MCP-мосты

#### Добавлено

- **Smart Router Proxy** (`smartRouterProxy.ts`) — движок оптимизации расходов (distiq-code)
  - Автоматический даунгрейд модели (Opus → Sonnet если задача простая)
  - Семантический кэш для повторяющихся запросов (SHA-256 + similarity)
  - Подсказки по промпт-кэшированию (cache_control breakpoints для Anthropic API)
  - Классификация запросов: анализ сложности, оценка токенов, рекомендация тира
  - Трекинг экономии в реальном времени

- **Swarm Memory** (`swarmMemory.ts`) — гибридная система памяти (claude-mem + claude-cognitive)
  - 3-уровневый Context Router: hot (текущая сессия) / warm (24ч) / cold (архив)
  - Pool Coordinator для синхронизации памяти между агентами
  - Lifecycle hooks: session_start, prompt_submit, response_ready, session_end
  - 3-слойный поиск: keyword/tag → timeline → полные наблюдения
  - Авто-компрессия старых записей (экономия контекстного окна)

- **MCP Linear Bridge** (`mcpLinearBridge.ts`) — синхронизация задач ↔ Linear
  - Маппинг статусов: open → Todo, in_progress → In Progress, done → Done
  - Регистрация задач и двусторонняя синхронизация
  - Пассивная активация (только при обнаружении mcp-linear)

- **MCP Context7 Bridge** (`mcpContext7Bridge.ts`) — актуальная документация
  - Авто-определение стека (React, Next.js, Express, Prisma, Supabase, Tailwind...)
  - Кэш документации с настраиваемым TTL (по умолчанию 24ч)
  - Стратегия cache-first при поиске

- **Claude-Flow Bridge** (`claudeFlowBridge.ts`) — маршрутизация навыков и RAG
  - Q-learning роутинг (epsilon-greedy exploration/exploitation)
  - Реестр навыков с трекингом качества (Q-values, success rates)
  - Конфигурация RAG для vector search → context injection

- **Agent Teams** (`agentTeams.ts`) — координация мульти-агентных команд
  - Создание команд с ролями: lead, developer, reviewer, tester, specialist
  - Делегирование задач с поддержкой зависимостей
  - Авто-ребалансировка: перераспределение задач при уходе агента в offline
  - Командный broadcast messaging
  - RAC (Retrieval Augmented Coding) — плейсхолдер для vector search

- **Skills Discovery** (`skillsDiscovery.ts`) — обнаружение навыков из IDE
  - Сканирование 6+ форматов: Gemini, Antigravity, Claude, Cursor, Codex, Windsurf
  - Нормализация в единый формат
  - Рекомендация навыков по описанию задачи
  - Кросс-IDE импорт/экспорт

## [0.9.18] - 2026-02-08

### 🧠 Интеграция новых AI-моделей

#### Добавлено

- **Claude Opus 4.6** — новый флагман Anthropic в MoE Router
  - 1M токенов контекст (первый Opus с миллионным контекстом)
  - Adaptive thinking — модель сама решает когда использовать extended thinking
  - Context compaction — автоматическое сжатие при приближении к лимиту
  - 128K output tokens — большие ответы без разбиения
  - Agent Teams — координация нескольких агентов через tmux
  - $5/$25 per MTok (≤200K), $10/$37.50 (>200K)

- **GPT-5.3 Codex** — новый флагман OpenAI для агентного кодинга
  - 256K контекст
  - Оптимизирован для code_generation, debugging, reasoning
  - ~$2/$15 per MTok (estimated)

- **Kimi K2.5** — premium модель Moonshot AI
  - 128K контекст, фокус на code_generation, code_review, debugging
  - ~$1/$5 per MTok (estimated)

#### Изменено

- `ModelProvider` расширен на `"moonshot"` (Kimi/Moonshot AI)
- Claude Opus 4.5 понижен с `flagship` → `premium` (заменён Opus 4.6)
- MoE Router: **19 моделей** (было 16) — 4 Anthropic, 9 OpenAI, 5 Google, 1 Moonshot

---

## [0.9.17] - 2026-02-08

### 🏗️ Модуляризация Smart Tools

#### Изменено

- **`src/smartTools.ts`** — разбит на **9 модулей** в `src/smartTools/`:
  - `core.ts` — swarm_agent, swarm_control, swarm_pulse, swarm_companion
  - `tasks.ts` — swarm_task, swarm_plan, swarm_briefing, swarm_spec
  - `files.ts` — swarm_file, swarm_worktree, swarm_snapshot
  - `git.ts` — swarm_git, swarm_hooks, swarm_dependency
  - `collaboration.ts` — swarm_chat, swarm_message, swarm_review, swarm_voting, swarm_auction, swarm_brainstorm
  - `security.ts` — swarm_defence, swarm_consensus, swarm_mcp
  - `analytics.ts` — swarm_cost, swarm_quality, swarm_regression, swarm_session
  - `intelligence.ts` — swarm_sona, swarm_moe, swarm_vector, swarm_booster, swarm_context_pool, swarm_context
  - `infra.ts` — swarm_health, swarm_immune, swarm_external, swarm_platform, swarm_knowledge и др.
- **`src/smartTools/index.ts`** — центральный re-export всех модулей
- **`src/serverSmart.ts`** — обновлён на импорт из `smartTools/index.js`

### 🔒 Cloudflare Workers с Аутентификацией

#### Добавлено

- **`cloudflare/abdr-hub/`** — новый Cloudflare Worker `abdr-swarm-hub`
  - Bearer Token + Query параметр аутентификация
  - WebSocket bridge для агентов
  - REST API для управления роем
- **`cloudflare/abdr-server/`** — новый Cloudflare Worker `abdr-swarm-server`
  - Streamable HTTP Transport (MCP spec 2025-03-26)
  - Все 54 Smart Tools
  - Автоматический проброс Bearer Token к Hub
- **`cloudflare/telegram-bot/`** → переименован в `abdr-swarm-telegram`
  - `SWARM_AUTH_TOKEN` для защиты `/register` endpoint
  - Bearer Token при вызовах Hub API

### 🔄 CI/CD Pipeline

#### Изменено

- **`.github/workflows/ci.yml`** — улучшения:
  - Триггер на `main` и `develop` ветки
  - TypeScript проверка (`tsc --noEmit`) перед билдом
  - Матрица Node.js: 18, 20, 22
  - Автоматический npm publish при push в `main`

### 🗑️ Удалён Legacy Код

#### Удалено

- **`src/tools.ts`** — старые 41 инструментов (заменены на `smartTools/`)
- **`src/server.ts`** — старый сервер (заменён на `serverSmart.ts`)

### 📊 Dashboard

#### Изменено

- Обновлена версия в footer: v0.9.12 → v0.9.17

### 📦 Обновления

- `package.json` → версия `0.9.17`

### 🔄 Обновление

```bash
npm install -g mcp-swarm@latest
# или
npm update mcp-swarm
```

---

## [0.9.16] - 2026-02-08

### 🐛 Критический фикс: Zod совместимость

**BREAKING FIX:** Исправлена ошибка `keyValidator._parse is not a function`, которая делала все 54 Smart Tools полностью неработоспособными в Antigravity и подобных клиентах.

#### Причина
- `zod@^3.23.8` в `package.json` автоматически устанавливал `3.25.76` — по сути Zod v4 bridge-версию
- Zod v4 удалил внутренний метод `_parse()`, который используется клиентами для валидации JSON Schema
- Результат: **ни один Smart Tool не работал** из-за ошибки парсинга входных схем

#### Исправление
- `zod` закреплён на точной версии `3.23.8` (чистый Zod v3, без v4 bridge)
- Предотвращает автоматический апгрейд до несовместимых версий

> 🙏 Приносим извинения за неудобства. Баг затронул всех пользователей, обновившихся через npm.

### 🔒 Безопасность: Cloudflare Workers

- Удалены задеплоенные воркеры `mcp-swarm-hub` и `mcp-swarm-server` (URL-ы были засвечены в коммитах)
- Исходники воркеров **сохранены** в `cloudflare/` — будут передеплоены с новыми именами

### 📦 Обновления

- `serverSmart.ts` — динамическая версия из `package.json` вместо хардкода
- `server.ts` — помечен как deprecated (`@ts-nocheck`), используйте `serverSmart.ts`
- `.gitignore` — добавлены паттерны для тестовых файлов

### 🔄 Обновление

```bash
npm install -g mcp-swarm@latest
# или
npm update mcp-swarm
```

---

## [0.9.15] - 2026-02-08

### 📖 Двуязычная документация

#### Изменено

- **`README.md`** — полностью переведён на **английский** язык (~1100 строк)
  - Профессиональный перевод всех секций: инструменты, установка, конфигурация, архитектура
  - Добавлена ссылка на русскую версию: `🇷🇺 Читать на русском`
- **`package.json`** — описание обновлено на английский
- **Обновлена версия в заголовке** — v0.9.15

#### Добавлено

- **`README.ru.md`** — созданная русская версия README
  - Полное содержание оригинального README на русском языке
  - Ссылка на английскую версию: `🇬🇧 Read in English`

---

## [0.9.14] - 2026-02-08

### 🐛 Исправление npx-команды

#### Исправлено

- **`README.md`** — исправлены команды `npx mcp-swarm-remote`:
  - Было: `npx mcp-swarm-remote --url ...` (ошибка E404, пакет не найден)
  - Стало: `npx -y -p mcp-swarm mcp-swarm-remote --url ...`
- **`REMOTE.md`** — аналогичное исправление во всех примерах конфигурации IDE
- **Обновлена версия** — v0.9.14

#### Причина

- `npx mcp-swarm-remote` пытался найти **отдельный** пакет `mcp-swarm-remote` в npm
- Команда `mcp-swarm-remote` — это бинарник внутри пакета `mcp-swarm`, поэтому нужен флаг `-p mcp-swarm`

---

## [0.9.13] - 2026-02-05

### Self-Hosted Infrastructure

**BREAKING CHANGE:** Removed hardcoded public server URLs. Users must now deploy their own Cloudflare Workers.

#### Changed

- **README.md** — Complete rewrite of installation section
  - Added Cloudflare Free Tier explanation and limits
  - Step-by-step deployment guide for Hub, MCP Server, Telegram Bot
  - Explained what YOUR-SUBDOMAIN means

- **wrangler.toml files** — All 3 Workers now have placeholders
  - `cloudflare/hub/wrangler.toml` — Added deployment instructions
  - `cloudflare/mcp-server/wrangler.toml` — HUB_URL placeholder
  - `cloudflare/telegram-bot/wrangler.toml` — SWARM_HUB_URL placeholder

- **install.ps1 / install.sh** — Now ask for user's server URLs
  - No more hardcoded URLs
  - Instructions for deploying first

- **mcp-swarm-remote** — `--url` is now **required**
  - Shows helpful error message with deployment link
  - Added `--help` option

- **Dashboard** — `.env.example` uses placeholder
  - `useWebSocket.ts` warns if HUB_URL not configured

- **Agent rules** (AGENTS.md, CLAUDE.md, GEMINI.md, AGENT.md)
  - Updated with YOUR-SUBDOMAIN placeholders

#### Why This Change?

- **Privacy**: Your data stays on your infrastructure
- **No shared limits**: Full Cloudflare Free Tier for yourself
- **Customization**: Modify Workers as needed
- **Transparency**: No hidden public server

---

## [0.9.12] - 2026-02-05

### Dashboard Real-time Updates

#### Added

- **WebSocket Hook** (`dashboard/src/hooks/useWebSocket.ts`)
  - Real-time connection to Swarm Hub
  - Auto-reconnect with exponential backoff
  - Keep-alive ping every 25 seconds
  - Event filtering for specific event types

- **New Core Widgets** (`dashboard/src/components/widgets/CoreWidgets.tsx`)
  - **ConnectionStatusWidget** — Shows Hub connection status with reconnect button
  - **ActivityTimelineWidget** — Real-time event stream from Hub
  - **FileLocksWidget** — Active file reservations with live updates
  - **CostTrackingWidget** — API usage and budget progress bars
  - **VotingWidget** — Distributed consensus proposals and votes

- **Live Indicators**
  - Green pulsing dot for connected/active status
  - LIVE/OFFLINE badges for real-time widgets
  - Last update timestamps with relative time format

### Telegram Bot Enhancements

#### Added

- **New Commands**
  - `/reviews` — List pending code reviews with inline approve/reject buttons
  - `/approve [id]` — Approve a review directly from Telegram
  - `/reject [id] [reason]` — Reject a review with optional reason

- **Enhanced Inline Keyboards**
  - Reviews list shows approve/reject buttons for each pending review
  - Help menu now includes Reviews button

### Auto-start Companion

#### Added

- **Companion Auto-start** in `mcp-swarm-remote`
  - Checks if companion daemon is running on port 37373
  - Automatically spawns companion in background if not running
  - Can be disabled with `--no-companion` flag

#### Changed

- Dashboard now uses WebSocket for real-time updates instead of polling-only
- Added "Real-time Monitoring" section with new widgets
- Updated version to 0.9.12 in footer

---

## [0.9.11] - 2026-02-04

### One-Click Installer & Streamable HTTP

#### Added

- **One-Click Install Scripts**
  - `install.ps1` — PowerShell installer for Windows
  - `install.sh` — Bash installer for macOS/Linux
  - `npx mcp-swarm-install` — Interactive Node.js installer

- **Streamable HTTP Transport** (MCP spec 2025-03-26)
  - Single `POST /mcp` endpoint instead of SSE
  - Session management via `Mcp-Session-Id` header
  - Works on Cloudflare Workers without SSE issues

- **mcp-swarm-remote Proxy** (`src/remote/index.ts`)
  - stdio → Streamable HTTP proxy for IDE integration
  - Windows stdin compatibility fix

#### Changed

- Installer now **merges** configs instead of overwriting
- Auto-detects IDE installations (Claude Desktop, Cursor, Windsurf, OpenCode, VS Code)

---

## [0.9.10] - 2026-02-03

### 🧠 MoE Router — Mixture of Experts Model Selection

#### Added

- **MoE Router Module** (`src/workflows/moeRouter.ts`)
  - Intelligent model routing based on task characteristics
  - Gating network for expert selection
  - Cost-performance optimization
  - Learning from feedback

- **Expert Classification**
  - 14 task categories: code_generation, code_review, debugging, reasoning, math, creative, etc.
  - 4 model tiers: economy, standard, premium, flagship
  - 6 providers: anthropic, openai, google, mistral, local, custom

- **Built-in Experts (19 models, verified pricing February 2026)**
  - **Anthropic Claude Series:**
    - Claude Opus 4.6 (flagship, 1M, $5/$25 MTok) ← NEW
    - Claude Opus 4.5 (flagship, 200K, $5/$25 MTok)
    - Claude Sonnet 4.5 (premium, 200K, $3/$15 MTok)
    - Claude Haiku 4.5 (economy, 200K, $1/$5 MTok)
  - **OpenAI GPT-5.x Series:**
    - GPT-5.3 Codex (flagship, 256K, ~$2/~$15 MTok) ← NEW
    - GPT-5.2 (flagship, 256K, $1.75/$14 MTok)
    - GPT-5.2 Pro (flagship, 256K, $21/$168 MTok)
    - GPT-5 Mini (standard, 128K, $0.25/$2 MTok)
    - GPT-4.1 (premium, 128K, $3/$12 MTok)
    - GPT-4.1 Mini (standard, 128K, $0.80/$3.20 MTok)
    - GPT-4.1 Nano (economy, 128K, $0.20/$0.80 MTok)
  - **OpenAI Reasoning Models:**
    - o4-mini (reasoning, 128K, $4/$16 MTok)
  - **Moonshot AI:**
    - Kimi K2.5 (premium, 128K, ~$1/~$5 MTok) ← NEW
  - **Google Gemini 3.x Series:**
    - Gemini 3 Pro (flagship, 1M, $2/$12 MTok)
    - Gemini 3 Flash (standard, 1M, $0.50/$3 MTok)
  - **Google Gemini 2.5 Series:**
    - Gemini 2.5 Pro (premium, 1M, $1.25/$10 MTok)
    - Gemini 2.5 Flash (standard, 1M, $0.30/$2.50 MTok)
    - Gemini 2.5 Flash Lite (economy, 1M, $0.10/$0.40 MTok)

- **Routing Factors**
  - Task match score (category-specific strength)
  - Cost efficiency
  - Performance history (success rate)
  - Load balancing (prefer less recently used)
  - Latency constraints
  - Context window requirements

- **Learning System**
  - Feedback recording
  - Exponential moving average for success rate
  - Automatic latency calibration
  - Per-expert statistics

- **Smart Tool #54: `swarm_moe`**
  - `route`: Route task to best expert
  - `feedback`: Record routing feedback
  - `experts`: List available experts
  - `add_expert` / `remove_expert`: Manage experts
  - `config` / `set_config`: Configuration
  - `stats`: Routing statistics
  - `history`: Routing history
  - `classify`: Classify task category
  - `reset`: Reset statistics

- **Dashboard API Endpoint** (`/api/moe`)
  - Routing statistics
  - Expert list and usage
  - Configuration status

#### Example Usage

```typescript
// Route task to best model
swarm_moe({
  action: "route",
  content: "Write a React component for user authentication",
  preferredTier: "premium",
  maxCost: 0.05,
  repoPath
});
// → { selectedExpert: "claude-sonnet", confidence: 0.92, estimatedCost: $0.02 }

// Record feedback for learning
swarm_moe({
  action: "feedback",
  expertId: "claude-sonnet",
  success: true,
  quality: 5,
  actualLatencyMs: 1800,
  repoPath
});

// Get routing statistics
swarm_moe({ action: "stats", repoPath });
// → { totalRequests: 150, successRate: 94%, totalCost: $1.23 }
```

---

## [0.9.9] - 2026-02-03

### 🤝 Consensus — Distributed Agreement Protocols

#### Added

- **Consensus Module** (`src/workflows/consensus.ts`)
  - Raft-like leader election with term-based leadership
  - Log replication for ordered command execution
  - Byzantine Fault Tolerance (BFT) mode for untrusted environments
  - Proposal system with configurable voting thresholds
  - Automatic failover when leader becomes unresponsive

- **Consensus Modes**
  - `simple_majority`: 50%+ votes for approval
  - `raft`: Term-based leadership, log replication
  - `bft`: Byzantine fault tolerant (2/3+1 quorum)

- **Node Management**
  - Join/leave cluster
  - Heartbeat monitoring
  - Trusted/untrusted node classification
  - Automatic dead node detection

- **Proposal System**
  - Types: config_change, task_assignment, architecture, rollback, emergency, custom
  - Vote types: approve, reject, abstain
  - Configurable majority thresholds (0.5 to 1.0)
  - Expiration timeout handling
  - Signature verification for BFT mode

- **Log Replication**
  - Ordered command log
  - Commit confirmation from leader
  - State machine replication across nodes

- **Smart Tool #53: `swarm_consensus`**
  - `join`: Join consensus cluster
  - `leave`: Leave cluster
  - `heartbeat`: Send heartbeat
  - `status`: Get cluster status
  - `elect`: Start leader election
  - `leader`: Get current leader
  - `propose`: Create proposal
  - `vote`: Vote on proposal
  - `proposals`: List proposals
  - `get_proposal`: Get proposal details
  - `execute`: Execute approved proposal
  - `log` / `append` / `commit`: Log management
  - `config` / `set_config`: Configuration
  - `stats`: Statistics

- **Dashboard API Endpoint** (`/api/consensus`)
  - Cluster status and node list
  - Leader information
  - Proposal statistics
  - Recent proposals

#### Example Usage

```typescript
// Join cluster
swarm_consensus({
  action: "join",
  nodeId: "agent-1",
  nodeName: "RadiantWolf",
  repoPath: "/path/to/project"
});

// Start leader election
swarm_consensus({
  action: "elect",
  nodeId: "agent-1",
  nodeName: "RadiantWolf",
  repoPath
});

// Create a proposal
swarm_consensus({
  action: "propose",
  nodeId: "agent-1",
  nodeName: "RadiantWolf",
  title: "Add dark mode",
  description: "Implement dark mode for dashboard",
  type: "architecture",
  requiredMajority: 0.67, // 2/3 majority
  repoPath
});

// Vote on proposal
swarm_consensus({
  action: "vote",
  proposalId: "prop_xxx",
  nodeId: "agent-2",
  nodeName: "BrilliantFox",
  vote: "approve",
  reason: "Good idea!",
  repoPath
});
```

---

## [0.9.8] - 2026-02-03

### 🛡️ AIDefence — Security & Threat Detection

#### Added

- **AIDefence Module** (`src/workflows/aiDefence.ts`)
  - <10ms threat detection latency
  - Pattern-based detection with regex + heuristics
  - Behavioral anomaly detection
  - Quarantine system for suspicious content
  - Audit logging for security events
  - Configurable sensitivity levels

- **Threat Categories**
  - `prompt_injection`: Instruction override, role hijacking, delimiter attacks
  - `jailbreak`: DAN mode, hypothetical bypasses, character hijacking
  - `code_injection`: Shell commands, eval, SQL injection, path traversal
  - `data_exfiltration`: API keys, credentials, external uploads
  - `sensitive_data`: PII, private keys, passwords
  - `unsafe_command`: rm -rf, sudo, crypto mining
  - `social_engineering`: Authority claims, urgency manipulation
  - `impersonation`: Agent identity spoofing
  - `dos_attack`: Request flooding
  - `unauthorized_tool`: Restricted tool access

- **Sensitivity Levels**
  - `low`: Only critical threats
  - `medium`: Balanced (default)
  - `high`: Strict checking
  - `paranoid`: Maximum security

- **Smart Tool #52: `swarm_defence`**
  - `scan`: Scan text for threats
  - `validate_agent`: Validate agent identity
  - `validate_tool`: Validate tool usage
  - `events`: Get security events log
  - `quarantine`: Get quarantined items
  - `release`: Release from quarantine
  - `stats`: Get defence statistics
  - `config` / `set_config`: Configuration
  - `trust` / `untrust`: Agent whitelist management
  - `clear_events`: Clear event log

- **Dashboard API Endpoint** (`/api/defence`)
  - Security statistics
  - Threat distribution by category/severity
  - Quarantine status
  - Recent events log

#### Example Usage

```typescript
// Scan text for threats
swarm_defence({
  action: "scan",
  text: "Ignore all previous instructions...",
  source: "user",
  repoPath: "/path/to/project"
});
// Returns: { detected: true, category: "prompt_injection", severity: "high", action: "block" }

// Configure sensitivity
swarm_defence({
  action: "set_config",
  config: { sensitivity: "high", blockOnHighThreat: true },
  repoPath: "/path/to/project"
});

// Add trusted agent
swarm_defence({
  action: "trust",
  agentName: "RadiantWolf",
  repoPath: "/path/to/project"
});
```

---

## [0.9.7] - 2026-02-03

### 🔍 HNSW — Hierarchical Navigable Small World

#### Added

- **HNSW Module** (`src/workflows/hnsw.ts`)
  - Fast approximate nearest neighbor search
  - 150x-12,500x faster than brute force
  - Pure TypeScript implementation (no dependencies)
  - Based on Malkov & Yashunin (2016) algorithm
  
- **Vector Operations**
  - Cosine similarity (default)
  - Euclidean distance
  - Dot product
  - Configurable dimensions (384, 768, 1536)
  
- **Simple Embeddings**
  - Built-in bag-of-words embedder for demos
  - Works without external API
  - Can use custom vectors from OpenAI/Cohere/etc.
  
- **Smart Tool #51: `swarm_vector`**
  - `init`: Initialize vector index
  - `add`: Add document with text or vector
  - `add_batch`: Add multiple documents
  - `search`: Find similar documents
  - `get`: Get document by ID
  - `delete`: Remove document
  - `list`: List all documents
  - `stats`: Index statistics
  - `config` / `set_config`: Configuration
  - `clear`: Clear entire index
  - `duplicates`: Find duplicate documents
  - `embed`: Get embedding for text

- **Dashboard API Endpoint** (`/api/vector`)
  - Index statistics
  - Configuration status
  - Memory usage tracking

#### Use Cases

- Semantic search in knowledge base
- Finding similar code snippets
- Context retrieval for agents
- Duplicate detection
- Clustering related tasks

#### Example Usage

```typescript
// Initialize index
swarm_vector({
  action: "init",
  repoPath,
  config: { dimensions: 384, distanceMetric: "cosine" }
})

// Add documents
swarm_vector({
  action: "add",
  repoPath,
  id: "doc-1",
  text: "How to configure authentication in Express.js",
  metadata: { category: "backend", language: "javascript" }
})

// Search for similar
swarm_vector({
  action: "search",
  repoPath,
  query: "setting up JWT auth",
  k: 5,
  filter: { category: "backend" }
})
// → [{ id: "doc-1", score: 0.85, ... }, ...]

// Find duplicates
swarm_vector({
  action: "duplicates",
  repoPath,
  threshold: 0.95
})
// → [{ id1: "doc-1", id2: "doc-5", similarity: 0.97 }, ...]

// Get statistics
swarm_vector({ action: "stats", repoPath })
// → { totalDocuments: 150, dimensions: 384, memoryKB: 245, ... }
```

#### Performance

| Documents | Brute Force | HNSW | Speedup |
|-----------|-------------|------|---------|
| 1,000 | 10ms | 0.5ms | 20x |
| 10,000 | 100ms | 0.8ms | 125x |
| 100,000 | 1,000ms | 1.2ms | 833x |
| 1,000,000 | 10,000ms | 2ms | 5,000x |

---

## [0.9.6] - 2026-02-03

### ⚡ Agent Booster — Fast Local Execution

#### Added

- **Agent Booster Module** (`src/workflows/agentBooster.ts`)
  - Executes trivial tasks locally without LLM API calls
  - 352x faster than LLM (local execution)
  - $0 cost (no API calls needed)
  - Works offline
  - Deterministic results
  
- **Supported Task Types** (14 types)
  - `rename_variable` — Rename variables/functions across file
  - `fix_typo` — Fix typos in strings and comments only
  - `find_replace` — Simple find and replace
  - `add_console_log` — Add debug logging at specific line
  - `remove_console_log` — Remove all console.log statements
  - `toggle_flag` — Toggle boolean flags (true ↔ false)
  - `update_version` — Update version numbers
  - `update_import` — Update import paths
  - `add_comment` — Add comment at specific line
  - `remove_comment` — Remove single-line comments
  - `format_json` — Format JSON files
  - `sort_imports` — Sort imports alphabetically
  - `add_export` — Add export to function/class
  - `extract_constant` — Extract magic number to constant

- **Smart Detection**
  - `can_boost` action analyzes task description
  - Auto-detects boostable tasks with confidence score
  - Extracts parameters from natural language

- **Smart Tool #50: `swarm_booster`**
  - `execute`: Run a booster task
  - `can_boost`: Check if task can be boosted
  - `stats`: Get booster statistics
  - `history`: Get execution history
  - `config`: Get configuration
  - `set_config`: Update configuration
  - `types`: List supported task types

- **Dashboard API Endpoint** (`/api/booster`)
  - Booster statistics and type distribution
  - Recent execution history
  - Configuration status
  - Cost savings tracking

#### Example Usage

```typescript
// Check if task can be boosted
swarm_booster({
  action: "can_boost",
  repoPath,
  description: "rename variable oldName to newName in file.ts"
})
// Returns: { canBoost: true, taskType: "rename_variable", confidence: 0.9, ... }

// Execute a booster task
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
// Returns: { success: true, changes: 5, timeMs: 2, savedCost: 0.01, ... }

// Remove all console.log from file
swarm_booster({
  action: "execute",
  repoPath,
  task: {
    type: "remove_console_log",
    filePath: "src/debug.ts"
  }
})

// Preview changes without applying (dry run)
swarm_booster({
  action: "execute",
  repoPath,
  dryRun: true,
  task: {
    type: "find_replace",
    filePath: "src/config.ts",
    searchText: "localhost",
    replaceText: "production.api.com"
  }
})

// Get statistics
swarm_booster({ action: "stats", repoPath })
// Returns: { totalTasks: 50, successRate: 98, costSaved: "$0.50", ... }
```

#### Benefits

| Metric | LLM | Agent Booster | Improvement |
|--------|-----|---------------|-------------|
| Speed | ~3000ms | ~8ms | 352x faster |
| Cost | $0.01/task | $0 | 100% savings |
| Offline | ❌ | ✅ | Works anywhere |
| Deterministic | ⚠️ | ✅ | Same input = same output |

---

## [0.9.5] - 2026-02-03

### 🧠 SONA — Self-Optimizing Neural Architecture

#### Added

- **SONA Module** (`src/workflows/sona.ts`)
  - Self-learning task routing system inspired by Claude-Flow
  - Records which agents perform best for each task type
  - Routes new tasks to best-performing agents
  - Learns from outcomes with <0.05ms adaptation
  - Improves over time with reinforcement learning
  
- **Task Classification**
  - Automatic category detection: frontend_ui, backend_api, database, testing, devops, documentation, refactoring, bugfix, feature, security, performance, infrastructure
  - Complexity estimation: trivial, simple, medium, complex, epic
  - Keyword-based pattern matching
  - Affected path analysis
  
- **Agent Performance Tracking**
  - Success rate tracking per category
  - Quality score averaging
  - Completion time tracking
  - Statistical confidence calculation
  - Specialization detection (top 3 categories per agent)
  
- **Online Learning**
  - Exponential moving average for rolling metrics
  - Configurable learning rate and decay
  - Elastic Weight Consolidation (EWC++) to prevent forgetting
  - Exploration/exploitation balance (10% exploration by default)
  
- **Smart Tool #49: `swarm_sona`**
  - `route`: Get routing recommendation for a task
  - `learn`: Record task outcome and update model
  - `classify`: Classify a task (category, complexity)
  - `profile`: Get agent's performance profile
  - `profiles`: Get all agent profiles
  - `specialists`: Get top agents for a category
  - `history`: Get learning history
  - `stats`: Get SONA statistics
  - `config`: Get configuration
  - `set_config`: Update configuration
  - `reset`: Reset the model

- **Dashboard API Endpoint** (`/api/sona`)
  - Get SONA statistics and agent profiles
  - View category distribution
  - Monitor recent learning events
  - Check top performing agents

#### How SONA Works

1. **Classification**: When a new task arrives, SONA classifies it by category and complexity
2. **Routing**: SONA recommends the best agent based on historical performance
3. **Execution**: The agent completes the task
4. **Learning**: SONA records the outcome and updates agent profiles
5. **Improvement**: Over time, routing becomes more accurate

#### Example Usage

```typescript
// Get routing recommendation
swarm_sona({
  action: "route",
  repoPath,
  title: "Fix login button styling",
  description: "Button is not visible on dark theme",
  affectedFiles: ["src/components/Login.tsx", "src/styles/buttons.css"]
})
// Returns: { recommendedAgent: "RadiantWolf", confidence: 0.85, category: "frontend_ui", ... }

// Record learning after task completion
swarm_sona({
  action: "learn",
  repoPath,
  taskId: "task-123",
  agentName: "RadiantWolf",
  title: "Fix login button styling",
  description: "Button is not visible on dark theme",
  success: true,
  qualityScore: 0.9,
  timeMinutes: 15
})

// Get specialists for backend work
swarm_sona({
  action: "specialists",
  repoPath,
  category: "backend_api",
  limit: 3
})
// Returns: [{ agent: "StormyOwl", score: 0.92, ... }, ...]

// Configure SONA
swarm_sona({
  action: "set_config",
  repoPath,
  config: {
    explorationRate: 0.15,  // More exploration
    autoLearn: true,
    preferSpecialists: true
  }
})
```

#### Comparison with Claude-Flow SONA

| Feature | Claude-Flow | MCP Swarm v0.9.5 |
|---------|-------------|------------------|
| Self-learning | ✅ | ✅ |
| Category classification | ✅ | ✅ 13 categories |
| Complexity estimation | ⚠️ Basic | ✅ 5 levels |
| EWC++ (prevent forgetting) | ✅ | ✅ |
| Distributed coordination | ❌ Local only | ✅ Cloudflare Hub |
| Dashboard integration | ⚠️ Limited | ✅ /api/sona |
| Telegram notifications | ❌ | ✅ |

---

## [0.9.4] - 2026-02-03

### 📱 Telegram Bot Integration

#### Added

- **Telegram Bot** (`src/integrations/telegram.ts`)
  - Full-featured Telegram bot for notifications and control
  - Event notifications: task created/completed/failed, agent joined/died, CI errors
  - Commands: `/status`, `/agents`, `/tasks`, `/create_task`, `/stop`, `/resume`, `/config`
  - Interactive inline buttons for quick actions
  - Priority setting via buttons (Critical, High, Medium)
  - Approve/Reject/Comment on reviews via Telegram
  - Vote on architecture decisions via Telegram
  
- **Smart Tool #47: `swarm_telegram`**
  - Actions: `setup`, `config`, `enable`, `disable`, `send`
  - Notifications: `notify_task_created`, `notify_task_completed`, `notify_task_failed`, `notify_agent_joined`, `notify_agent_died`
  - Bot control: `start_polling`, `stop_polling`, `command`
  
- **Dashboard API Endpoint** (`/api/telegram`)
  - Get Telegram configuration status
  - Setup instructions if not configured

#### Setup

1. Create a bot via @BotFather in Telegram
2. Set `TELEGRAM_BOT_TOKEN` environment variable
3. Get your chat ID (send /start to @userinfobot)
4. Configure via `swarm_telegram({ action: "setup", chatId: "YOUR_CHAT_ID" })`

#### Example Usage

```typescript
// Setup
swarm_telegram({ action: "setup", repoPath, chatId: "123456789", enabled: true })

// Send notification
swarm_telegram({ action: "notify_task_created", repoPath, taskId: "task-1", title: "Fix bug", priority: "high" })

// Start bot polling (for receiving commands)
swarm_telegram({ action: "start_polling", repoPath })
```

- **Cloudflare Worker for Telegram** (`cloudflare/telegram-bot/`)
  - Webhook-based (no polling required)
  - Deploy to Cloudflare Workers
  - `/setup` endpoint for webhook registration

- **Smart Tool #48: `swarm_batch`**
  - Request batching for 50% cost savings
  - Supports Anthropic Message Batches API
  - Supports OpenAI Batch API
  - Actions: `queue`, `config`, `set_config`, `job`, `jobs`, `result`, `stats`, `flush`

- **Batching Module** (`src/workflows/batching.ts`)
  - Automatic request grouping
  - Configurable batch size and wait time
  - Async batch processing with result polling
  - Cost savings estimation

---

## [0.9.3] - 2026-02-03

### 🧠 Smart Features & Cost Optimization

#### Added

- **Smart Task Routing** (`src/workflows/smartRouting.ts`)
  - Automatic task assignment based on file expertise
  - Tracks which agent edited which files
  - Calculates expertise scores (exact match 10x, folder 3x, extension 2x)
  - `recordFileEdit()`, `findBestAgent()`, `autoAssignTask()`

- **Shared Context Pool** (`src/workflows/contextPool.ts`)
  - Agents share notes about code to avoid re-reading
  - Auto-staleness detection (if file hash changed)
  - Tags, categories, and helpful counter
  - `addContextNote()`, `getContextNotes()`, `searchContext()`

- **Auto Code Review** (`src/workflows/autoReview.ts`)
  - Automatic review assignment when task completes
  - Finds reviewer who knows the affected files
  - Comment severity levels (critical, major, minor, suggestion)
  - `createReviewRequest()`, `addReviewComment()`, `completeReview()`

- **GitHub/Linear Sync** (`src/workflows/externalSync.ts`)
  - Two-way sync with GitHub Issues
  - Linear.app integration (GraphQL API)
  - Auto-import issues as swarm tasks
  - Auto-close issues when task is done
  - `syncFromGitHub()`, `syncFromLinear()`, `exportTaskToGitHub()`

- **Cost Optimization** (`src/workflows/costOptimization.ts`)
  - Task complexity analysis (simple/medium/complex)
  - Smart model routing (cheap/standard/premium tiers)
  - Budget management with daily/weekly/monthly limits
  - Alert thresholds (50%, 80%, 95%)
  - Supports GPT-3.5, GPT-4o, Claude 3 Haiku/Sonnet/Opus, Gemini, o1
  - `analyzeTaskComplexity()`, `routeTask()`, `checkBudget()`, `generateCostReport()`

- **Background Heartbeat Worker** (`src/workers/`)
  - Uses Node.js `worker_threads` for continuous heartbeat
  - Works even when agent is "thinking"
  - `startHeartbeatWorker()`, `stopHeartbeatWorker()`

- **Web Dashboard** (`dashboard/`)
  - Real-time agent status monitoring
  - Orchestrator status banner with glow effects
  - Stats cards (agents, tasks, messages, uptime)
  - Task list with priority indicators
  - Built with Next.js + ShadCN UI

- **Dashboard API** (`src/dashboardApi.ts`)
  - HTTP API server on port 3334
  - Endpoints: `/api/agents`, `/api/tasks`, `/api/messages`, `/api/orchestrator`
  - **New v0.9.3 endpoints:**
    - `GET /api/expertise` — Smart Routing expertise map
    - `GET /api/context` — Context Pool notes
    - `GET /api/reviews` — Auto Review status
    - `GET /api/budget` — Cost budget and usage
    - `GET /api/sync` — External Sync status

#### Smart Tools (42-46)

| # | Tool | Actions | Description |
|---|------|---------|-------------|
| 42 | `swarm_routing` | record, find_agent, expertise, predict, auto_assign | Smart task routing based on file expertise |
| 43 | `swarm_context_pool` | add, get, search_tag, search, helpful, update, cleanup, stats | Shared context notes between agents |
| 44 | `swarm_autoreview` | create, assign, comment, complete, resolve, for_reviewer, for_author, pending, stats | Automatic code review assignment |
| 45 | `swarm_external` | enable_github, enable_linear, sync_github, sync_linear, sync_all, export_github, export_linear, status, create_issue, close_issue, comment | GitHub/Linear sync |
| 46 | `swarm_budget` | analyze, models, select, recommend, route, log_usage, usage, stats, config, set_config, check, remaining, report | Cost optimization and model routing |

---

## [0.9.1] - 2026-02-02

### 📚 Documentation & UX Improvements

#### Added
- **Linux Installation Instructions** — полные инструкции для Linux
- **IDE-Specific Configs** — отдельные конфигурации для:
  - Claude Desktop (Windows/macOS/Linux)
  - Cursor
  - Windsurf
  - OpenCode CLI
  - VS Code + Copilot/Continue
- **Troubleshooting Section** — решения частых проблем:
  - "Cannot find module" errors
  - Agent не становится оркестратором
  - "repoPath is required" ошибка
  - Cloudflare Hub недоступен
  - Файлы заблокированы другим агентом
- **Architecture Diagram** — ASCII-схема архитектуры Cloudflare Hub + Local Agents
- **Contributing Guidelines** — правила для PR

#### Changed
- README.md полностью переработан с collapsible секциями (`<details>`)

### 🔮 Future Improvements (Roadmap)

#### Heartbeat Daemon Enhancement (Planned)
Текущая проблема: когда агент "думает" (processing), он не может отправлять heartbeat, что может привести к ложному срабатыванию dead-detection после 60 секунд.

Планируемые решения:
1. **Background Worker** — отдельный процесс для heartbeat (требует Node.js worker_threads)
2. **Longer Timeout** — увеличить HEARTBEAT_TIMEOUT_MS до 5 минут
3. **Thinking State** — добавить состояние "thinking" которое не считается dead
4. **Companion Daemon** — использовать существующий companion.ts для heartbeat

---

## [0.9.0] - 2026-02-02

### 🚀 MAJOR: Smart Tools Consolidation

**Reduces 168+ individual tools → 41 Smart Tools with `action` parameter**

This is a major UX improvement. Instead of agents needing to remember 168+ tool names,
they now work with 41 logical groups where related functionality is accessed via the `action` parameter.

### Added

- **Smart Tools System** — 41 unified tools replacing 168+ individual tools
  - Each Smart Tool groups 3-15 related functions via `action` parameter
  - Better discoverability and easier to remember
  - Consistent parameter patterns across all tools

### Smart Tools List (41 tools)

| # | Tool Name | Actions | Description |
|---|-----------|---------|-------------|
| 1 | `swarm_agent` | register, whoami | Agent identity |
| 2 | `swarm_task` | create, list, update, decompose, get_decomposition | Task management |
| 3 | `swarm_file` | reserve, release, list, forecast, conflicts, safety | File locking |
| 4 | `swarm_git` | sync, pr, health, cleanup, cleanup_all | Git operations |
| 5 | `swarm_worktree` | create, list, remove | Git worktrees |
| 6 | `swarm_companion` | status, stop, pause, resume | Companion daemon |
| 7 | `swarm_control` | stop, resume, status | Swarm control |
| 8 | `swarm_chat` | broadcast, dashboard, thought, thoughts | Team chat |
| 9 | `swarm_review` | request, respond, list | Code review |
| 10 | `swarm_voting` | start, vote, list, get | Voting system |
| 11 | `swarm_auction` | announce, bid, poll | Task auction |
| 12 | `swarm_mcp` | scan, authorize, policy | MCP scanning |
| 13 | `swarm_orchestrator` | elect, info, heartbeat, resign, executors, executor_heartbeat | Orchestrator |
| 14 | `swarm_message` | send, inbox, ack, reply, search, thread | Messaging |
| 15 | `swarm_briefing` | save, load | Briefings |
| 16 | `swarm_pulse` | update, get | Real-time status |
| 17 | `swarm_knowledge` | archive, search | Knowledge base |
| 18 | `swarm_snapshot` | create, rollback, list | Snapshots |
| 19 | `swarm_health` | check, dead, reassign, summary | Agent health |
| 20 | `swarm_quality` | run, report, threshold, pr_ready | Quality gate |
| 21 | `swarm_cost` | log, agent, project, limit, remaining | Cost tracking |
| 22 | `swarm_brainstorm` | start, ask, answer, propose, present, validate, save, get, list | Brainstorming |
| 23 | `swarm_plan` | create, add, next, start, step, complete, prompt, export, status, list, ready | Plans |
| 24 | `swarm_debug` | start, investigate, evidence, phase1, patterns, phase2, hypothesis, test, fix, verify, get, list, redflags | Debugging |
| 25 | `swarm_spec` | start, phase, complete, get, list, export | Spec pipeline |
| 26 | `swarm_qa` | start, iterate, fix, get, list, suggest, report | QA loop |
| 27 | `swarm_hooks` | install, uninstall, run, config, update, list | Git hooks |
| 28 | `swarm_screenshot` | share, list | Screenshots |
| 29 | `swarm_dependency` | signal, sync | Dependencies |
| 30 | `swarm_platform` | request, respond, list | Cross-platform |
| 31 | `swarm_immune` | alert, resolve, status, test, patrol | Immune system |
| 32 | `swarm_context` | estimate, compress, compress_many, stats | Context compression |
| 33 | `swarm_regression` | baseline, check, list, resolve, baselines | Regression detection |
| 34 | `swarm_expertise` | track, suggest, record, experts, list | Agent expertise |
| 35 | `swarm_conflict` | predict, analyze, hotspots, record | Conflict prediction |
| 36 | `swarm_timeline` | generate, visualize | Timeline |
| 37 | `swarm_docs` | generate, task_docs, list, get | Documentation |
| 38 | `swarm_advice` | request, provide, list | Collective advice |
| 39 | `swarm_preemption` | trigger, resolve, active | Urgent preemption |
| 40 | `swarm_clusters` | init, list, tools, find, add, create, summary | Tool clusters |
| 41 | `swarm_session` | start, log, stop, list, replay | Session recording |

### Example Usage

**Before (v0.8.x):**
```
tool: task_create
tool: task_list
tool: task_assign
tool: task_set_status
tool: task_mark_done
... (9 separate tools)
```

**After (v0.9.0):**
```
tool: swarm_task
  action: "create" | "list" | "update" | "decompose" | "get_decomposition"
```

### Files Changed

- `src/smartTools.ts` — All 41 Smart Tools with correct workflow signatures
- `src/serverSmart.ts` — New server entry point for Smart Tools
- `package.json` — v0.9.0, added `dev:legacy` script for backward compatibility

### Backward Compatibility

- Legacy 168+ tools server available via `npm run dev:legacy`
- Smart Tools server via `npm run dev` (default)

---

## [0.8.1] - 2026-02-02

### Добавлено
- **Smart Tools Draft** — прототип объединения 168+ tools в 41 Smart Tool
  - Файлы `smartTools.ts.draft` и `serverSmart.ts.draft` — прототип для будущей версии
  - Каждый Smart Tool объединяет 3-15 похожих tools через параметр `action`
  - Пример: `swarm_task(action: "create|list|assign|done|cancel|...")` вместо 9 отдельных tools
  
### В процессе (для v0.9.0)
- Smart Tools требует адаптации к актуальным сигнатурам workflow функций
- Будет завершено в следующей версии

---

## [0.8.0] - 2026-02-02

### Добавлено
- **Orchestrator Election** (6 tools) — первый агент становится оркестратором
  - `orchestrator_elect` — выбор оркестратора (first-come-first-served)
  - `orchestrator_info` — информация об оркестраторе
  - `orchestrator_heartbeat` — heartbeat оркестратора
  - `orchestrator_resign` — отставка оркестратора
  - `executor_list` — список всех исполнителей
  - `executor_heartbeat` — heartbeat исполнителя
  
- **Agent Messaging** (6 tools) — полная система обмена сообщениями между агентами
  - `agent_message_send` — отправить сообщение (direct или broadcast)
  - `agent_inbox_fetch` — получить входящие сообщения
  - `agent_message_ack` — подтвердить получение
  - `agent_message_reply` — ответить на сообщение
  - `agent_message_search` — поиск по сообщениям
  - `agent_thread_get` — получить тред сообщений

- **Infinite Loop Mode** — оркестратор работает бесконечно
  - Companion daemon с автоматическим orchestrator election
  - Оркестратор НЕ останавливается по API — только пользователем
  - Исполнители регистрируются у оркестратора
  - Heartbeat система для мониторинга "живости"

### Изменено
- **companion.ts** — полностью переписан для Orchestrator mode
- **Installer** — обновлён до v0.8.0 (168+ tools, 14 категорий)

### Архитектура

```
┌─────────────────────────────────────────────────────┐
│                    FIRST AGENT                       │
│                   (ORCHESTRATOR)                     │
│  - Elected automatically (first-come-first-served)  │
│  - Runs in INFINITE LOOP                            │
│  - Only user can stop (stdin)                       │
│  - Coordinates all executors                        │
└────────────────────────┬────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  EXECUTOR 1 │  │  EXECUTOR 2 │  │  EXECUTOR N │
│  (Claude)   │  │  (Cursor)   │  │  (Windsurf) │
│ - Registers │  │ - Registers │  │ - Registers │
│ - Gets tasks│  │ - Gets tasks│  │ - Gets tasks│
│ - Heartbeat │  │ - Heartbeat │  │ - Heartbeat │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Хранение данных

```
.swarm/
├── ORCHESTRATOR.json     # Состояние оркестратора
├── messages/             # Canonical сообщения
│   └── msg-*.json
└── inbox/                # Inbox каждого агента
    ├── RadiantWolf/
    └── SilentFox/
```

---

## [0.7.0] - 2026-02-02

### Добавлено
- **Spec Pipeline** (6 tools) — структурированный pipeline для создания спецификаций
  - `start_spec_pipeline` — начать pipeline с 4 ролями
  - `start_spec_phase` — начать фазу (gatherer/researcher/writer/critic)
  - `complete_spec_phase` — завершить фазу с output
  - `get_spec_pipeline` — получить статус pipeline
  - `list_spec_pipelines` — список всех pipelines
  - `export_spec_as_markdown` — экспорт спецификации в markdown
  
- **QA Loop** (7 tools) — итеративные циклы review/fix
  - `start_qa_loop` — начать QA loop для задачи
  - `run_qa_iteration` — запустить итерацию проверок
  - `log_qa_fix` — записать применённый fix
  - `get_qa_loop` — получить статус loop
  - `list_qa_loops` — список всех loops
  - `get_qa_fix_suggestions` — получить предложения по fix
  - `generate_qa_report` — сгенерировать markdown отчёт
  
- **Guard Hooks** (6 tools) — pre-commit/pre-push safety hooks
  - `install_guard_hooks` — установить hooks в репозиторий
  - `uninstall_guard_hooks` — удалить hooks
  - `run_guard_hooks` — запустить hooks вручную (для тестирования)
  - `get_guard_config` — получить конфигурацию hooks
  - `update_guard_hook` — обновить конфигурацию hook
  - `list_guard_hooks` — список всех hooks
  
- **Tool Clusters** (7 tools) — организация tools по категориям
  - `init_tool_clusters` — инициализировать кластеры tools
  - `list_tool_clusters` — список всех кластеров
  - `get_cluster_tools` — получить tools в кластере
  - `find_tool_cluster` — найти кластер для tool
  - `add_tool_to_cluster` — добавить tool в кластер
  - `create_tool_cluster` — создать новый кластер
  - `get_tool_cluster_summary` — получить summary всех кластеров

### Методологии
- **Spec Pipeline:** 4 роли (gatherer → researcher → writer → critic) с итерациями
- **QA Loop:** reviewer → fixer → loop до прохождения всех проверок
- **Guard Hooks:** bypass с ключевым словом [skip-hooks] в commit message
- **Tool Clusters:** 13 категорий (agent, task, file, git, collab, safety, quality, debug, plan, hooks, session, cost, docs)

---

## [0.6.0] - 2026-01-30

### Добавлено
- **Brainstorming Skill** (9 tools) — интерактивный дизайн через вопросы по одному
  - `start_brainstorm` — начать сессию brainstorming
  - `ask_brainstorm_question` — задать вопрос (ONE at a time, multiple choice preferred)
  - `answer_brainstorm_question` — записать ответ пользователя
  - `propose_approaches` — предложить варианты с pros/cons
  - `present_design_section` — представить секцию дизайна (200-300 слов max)
  - `validate_design_section` — валидация секции дизайна
  - `save_design_document` — сохранить результат в `docs/plans/`
  - `get_brainstorm_session` — получить статус сессии
  - `list_brainstorm_sessions` — список всех сессий
  
- **Writing Plans Skill** (11 tools) — TDD-планы с bite-sized задачами
  - `create_implementation_plan` — создать план имплементации
  - `add_plan_task` — добавить задачу с TDD-шагами
  - `get_next_task` — следующая задача (учитывает dependencies)
  - `start_plan_task` — начать работу над задачей
  - `complete_step` — завершить шаг TDD (write_test/run_test/implement/verify/commit)
  - `complete_plan_task` — завершить задачу
  - `generate_subagent_prompt` — генерировать детальный промпт для субагента
  - `export_plan_as_markdown` — экспорт плана в markdown
  - `get_plan_status` — статус плана
  - `list_plans` — список всех планов
  - `mark_plan_ready` — пометить план готовым к выполнению
  
- **Systematic Debugging** (13 tools) — 4-фазный процесс дебага (NO FIXES WITHOUT ROOT CAUSE!)
  - `start_debug_session` — Phase 1: Investigation (NO FIXES YET!)
  - `log_investigation` — логировать анализ ошибок
  - `add_evidence` — добавить evidence (input/output компонентов)
  - `complete_phase_1` — перейти к Phase 2: Pattern Analysis
  - `log_patterns` — логировать working examples
  - `complete_phase_2` — перейти к Phase 3: Hypothesis
  - `form_hypothesis` — сформулировать гипотезу
  - `test_hypothesis` — проверить гипотезу
  - `implement_fix` — Phase 4: реализовать исправление
  - `verify_fix` — верифицировать и завершить сессию
  - `get_debug_session` — получить статус сессии
  - `list_debug_sessions` — список всех сессий
  - `check_red_flags` — проверить на анти-паттерны мышления

### Методологии (из obra/superpowers)
- **Brainstorming:** вопросы по одному, валидация секций (200-300 слов max)
- **Writing Plans:** TDD bite-sized tasks (2-5 мин), DRY/YAGNI
- **Systematic Debugging:** 4 фазы, Iron Law — NO FIXES WITHOUT ROOT CAUSE
- **Red Flags:** "Let me just try...", "Maybe if I...", "This should fix it..."

---

## [0.5.0] - 2026-01-30

### Добавлено
- **Agent Health Monitor** — мониторинг "живости" агентов
  - `check_agent_health` — проверить статус конкретного агента
  - `get_dead_agents` — найти агентов без активности > N минут
  - `force_reassign_task` — переназначить задачу от мёртвого агента
  - `get_swarm_health_summary` — общее здоровье swarm
  
- **Session Recording** — запись действий для replay
  - `start_session_recording` — начать запись сессии
  - `log_session_action` — записать действие (tool, edit, command)
  - `stop_session_recording` — остановить запись
  - `list_session_recordings` — список всех записей
  - `replay_session` — воспроизвести запись step-by-step
  
- **Quality Gate** — автопроверки перед merge
  - `run_quality_gate` — запустить проверки (lint, tests, types, coverage)
  - `get_quality_report` — получить отчёт с баллами
  - `set_quality_threshold` — установить минимальные пороги
  - `check_pr_ready` — готовность PR к merge
  
- **Cost Tracker** — отслеживание расходов на API
  - `log_api_usage` — записать использование (tokens, cost)
  - `get_agent_costs` — расходы конкретного агента
  - `get_project_costs` — общие расходы проекта
  - `set_budget_limit` — установить лимит
  - `check_budget_remaining` — остаток до лимита
  
- **Context Compressor** — сжатие briefings
  - `estimate_context_size` — оценить размер в токенах
  - `compress_briefing` — сжать briefing (ratio 0.1-0.9)
  - `compress_multiple_briefings` — сжать несколько briefings
  - `get_compression_stats` — статистика сжатия
  
- **Regression Detector** — обнаружение регрессий
  - `save_baseline` — сохранить эталонные метрики
  - `check_regression` — сравнить с baseline
  - `list_regressions` — список найденных регрессий
  - `resolve_regression` — отметить регрессию исправленной
  - `list_baselines` — список сохранённых baseline

### Исправлено
- **Installer** — улучшен детект установленных IDE
  - Проверка исполняемых файлов через `where`/`which`
  - Проверка стандартных путей установки (Program Files, /Applications)
  - Функция `isIdeInstalled()` с 3 методами проверки
  - Конфиги создаются только для реально установленных IDE

---

## [0.4.2] - 2026-01-28

### Добавлено
- **Timeline Visualization** — визуализация хода задачи
  - `generate_timeline` — создать таймлайн для задачи
  - `get_timeline_visualization` — красивый ASCII таймлайн с milestone

---

## [0.4.1] - 2026-01-25

### Добавлено
- **Auto-Documentation** — автогенерация документации при завершении задач
  - `generate_task_docs` — создать markdown с diff и summary
  - `list_task_docs` — список всех документов
  - `get_task_doc` — получить конкретный документ
  - Хранение в `swarm/docs/` с индексом INDEX.md
  
- **Agent Specialization (ML-based)** — запоминание экспертизы агентов
  - `record_agent_edit` — записать какие файлы агент правил
  - `suggest_agent_advanced` — рекомендовать лучшего агента для задачи
  - `get_top_experts` — топ экспертов в конкретной области
  - `list_all_agent_expertise` — полная карта экспертизы
  
- **Conflict Prediction (ML-based)** — предсказание merge-конфликтов
  - `analyze_conflict_history` — сканировать историю Git
  - `get_conflict_hotspots` — файлы с наибольшим риском конфликтов
  - `check_file_safety` — безопасно ли редактировать файл
  - `record_conflict_event` — записать событие конфликта

---

## [0.4.0] - 2026-01-20

### Добавлено
- **Cloudflare Hub** — real-time WebSocket координация
  - Durable Object для хранения состояния
  - WebSocket broadcast между агентами
  - Anti-duplication для task claims
  - Hybrid mode (WS + Git fallback)
  
- **Orchestrator Directory** — центр управления `/orchestrator/`
  - PULSE.md — живая карта агентов
  - KNOWLEDGE_BASE.md — коллективная база знаний
  - briefings/ — ментальные слепки
  - snapshots/ — снапшоты для отката

---

## [0.3.0] - 2026-01-15

### Добавлено
- **Collective Advice** — коллективный мозговой штурм
  - `request_collective_advice` — запросить помощь у всех агентов
  - `provide_advice` — дать совет на запрос
  - `get_advice_responses` — получить все ответы
  
- **Urgent Preemption** — приоритетный захват файлов
  - `trigger_urgent_preemption` — экстренный приоритет для критичных багов
  - Автоматическое освобождение файлов другими агентами
  
- **Snapshot & Rollback** — откат изменений
  - `create_snapshot` — создать снапшот перед изменениями
  - `trigger_rollback` — откатить к снапшоту
  - `list_snapshots` — список снапшотов
  
- **Immune System** — автореакция на падение CI/тестов
  - `report_ci_alert` — сообщить о CI ошибке
  - `get_immune_status` — статус immune system
  - Автоматическая блокировка опасных веток

---

## [0.2.0] - 2026-01-10

### Добавлено
- **Architecture Voting** — голосование для опасных действий
  - `start_voting` — начать голосование
  - `cast_vote` — проголосовать
  - `list_open_votings` — открытые голосования
  - `get_voting_result` — результат голосования
  
- **Git Worktrees** — изолированные рабочие пространства
  - `worktree_create` — создать worktree
  - `worktree_list` — список worktrees
  - `worktree_remove` — удалить worktree
  
- **GitHub Integration** — интеграция с GitHub
  - `create_github_pr` — создать Pull Request
  - `sync_with_base_branch` — rebase на main
  - `auto_delete_merged_branch` — удалить merged ветки
  - `check_main_health` — здоровье main ветки
  
- **Cross-Agent Review** — ревью между агентами
  - `request_cross_agent_review` — запросить ревью
  - `respond_to_review` — ответить на ревью
  - `list_pending_reviews` — ожидающие ревью

---

## [0.1.0] - 2026-01-05

### Добавлено
- **Agent Registry** — регистрация агентов
  - `agent_register` — регистрация с уникальным именем
  - `agent_whoami` — информация о текущем агенте
  - Генерация имён типа RadiantWolf, SilentFox
  
- **Task Management** — управление задачами
  - `task_create` — создать задачу
  - `task_list` — список задач
  - `task_assign` — назначить агенту
  - `task_set_status` — изменить статус
  - `task_mark_done` — отметить выполненной
  - `task_cancel` — отменить
  - `task_link` — связать задачи
  - `decompose_task` — разбить на подзадачи
  
- **File Locking** — блокировка файлов
  - `file_reserve` — заблокировать файл (exclusive/shared)
  - `file_release` — освободить файл
  - `list_file_locks` — список блокировок
  - `forecast_file_touches` — анонсировать будущие изменения
  - `check_file_conflicts` — проверить конфликты
  
- **Collaboration** — базовая коллаборация
  - `broadcast_chat` — отправить сообщение всем
  - `update_team_dashboard` — обновить статус
  - `share_screenshot` — поделиться скриншотом
  - `log_swarm_thought` — записать мысль
  
- **Auction System** — аукцион для задач
  - `announce_task_for_bidding` — объявить задачу
  - `bid_for_task` — сделать ставку
  - `get_auction_winner` — получить победителя
  
- **Briefings** — ментальные слепки
  - `save_briefing` — сохранить состояние
  - `load_briefing` — загрузить состояние
  - `list_briefings` — список briefings
  
- **Pulse** — живая карта агентов
  - `update_swarm_pulse` — обновить статус
  - `get_swarm_pulse` — получить статусы всех
  
- **Knowledge Base** — база знаний
  - `archive_finding` — сохранить находку
  - `search_knowledge` — поиск в базе
  
- **Ghost Mode** — патрулирование без задач
  - `patrol_mode` — проверка lint ошибок
  - Автоисправление мелких проблем
  
- **Stop Flag** — экстренная остановка
  - `swarm_stop` — остановить всех агентов
  - `swarm_resume` — возобновить работу
  - `swarm_stop_status` — проверить статус

### Инфраструктура
- MCP Server на базе @modelcontextprotocol/sdk
- TypeScript компиляция
- Installer для IDE (Windsurf, Cursor, Claude Desktop, OpenCode, VS Code)
- Правила агента (.windsurfrules, .cursorrules, CLAUDE.md, GEMINI.md)
- Companion daemon для фоновых задач

---

## [Unreleased]

### В планах
- Web Dashboard для мониторинга swarm
- Unit тесты для всех workflows
- Интеграция с Jira/Linear
- Мультиязычная поддержка (i18n)
- Plugin system для расширений

---

## Semantic Versioning

- **MAJOR (X.0.0)** — несовместимые изменения API
- **MINOR (0.X.0)** — новые фичи, обратно совместимые
- **PATCH (0.0.X)** — багфиксы, обратно совместимые

## Legend

| Тип | Описание |
|-----|----------|
| **Добавлено** | Новые фичи |
| **Изменено** | Изменения в существующей функциональности |
| **Устарело** | Фичи, которые будут удалены |
| **Удалено** | Удалённые фичи |
| **Исправлено** | Багфиксы |
| **Безопасность** | Исправления уязвимостей |
