# MCP Swarm v0.9.0

**Multi-Agent Coordination Platform** — MCP-сервер для координации до 50+ AI-агентов, работающих над одним проектом на разных машинах (Windows/Mac/Linux).

## Что это такое?

MCP Swarm — это система, которая позволяет нескольким AI-агентам (Claude, Cursor, Windsurf, OpenCode и др.) работать **одновременно** над одним проектом без конфликтов.

## Зачем это нужно?

**Проблема:** Когда несколько агентов работают над одним репозиторием:
- Они редактируют одни и те же файлы → конфликты
- Они не знают, что делают другие → дублирование работы
- Нет координации → хаос

**Решение:** MCP Swarm обеспечивает:
- **Orchestrator** — первый агент становится координатором
- **File Locking** — только один может редактировать файл
- **Messaging** — агенты общаются между собой
- **Task Distribution** — аукцион задач
- **Real-time Sync** — все видят изменения мгновенно (через Cloudflare Hub)

## Как работает система агентов?

### Архитектура: Orchestrator + Executors

```
┌─────────────────────────────────────────────────────┐
│              CLOUDFLARE HUB (Deployed)              │
│   https://mcp-swarm-hub.unilife-ch.workers.dev      │
│   - WebSocket real-time sync                        │
│   - Task claiming                                   │
│   - File locking                                    │
└────────────────────────┬────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ ORCHESTRATOR│  │ EXECUTOR 1  │  │ EXECUTOR N  │
│  (First)    │  │  (Cursor)   │  │ (Windsurf)  │
│ Координатор │  │ Исполнитель │  │ Исполнитель │
│ Бесконечный │  │ Берёт задачи│  │ Берёт задачи│
│ цикл        │  │ Heartbeat   │  │ Heartbeat   │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Как ведёт себя каждый агент?

#### 1. ORCHESTRATOR (Координатор)

**Кто становится:** Первый агент, вызвавший `swarm_orchestrator({ action: "elect", repoPath })`

**Что делает:**
- Работает в **бесконечном цикле**
- Читает список задач, распределяет их
- Следит за здоровьем всех агентов (heartbeat)
- Переназначает задачи если агент "умер"
- НЕ останавливается по API — только пользователь может сказать "стоп"

#### 2. EXECUTOR (Исполнитель)

**Кто становится:** Все остальные агенты после Orchestrator

**Что делает:**
- Регистрируется у Orchestrator
- Получает задачи через аукцион или прямое назначение
- Блокирует файлы перед редактированием
- Отправляет heartbeat каждые N минут
- Делает PR когда задача готова

#### 3. GHOST MODE (Режим призрака)

**Когда активируется:** Агент выполнил задачу и ждёт новую

**Что делает:**
- Патрулирует код: проверяет lint ошибки
- Оптимизирует импорты
- Ищет проблемы в коде других агентов

---

## CRITICAL: repoPath Parameter

> **КАЖДЫЙ вызов MCP Swarm ДОЛЖЕН включать параметр `repoPath`!**

`repoPath` — это абсолютный путь к проекту, над которым вы работаете. Без него MCP Swarm не знает, какой проект координировать.

```typescript
// ПРАВИЛЬНО - всегда включайте repoPath
swarm_agent({ action: "register", repoPath: "C:/Users/me/projects/my-app" })

// НЕПРАВИЛЬНО - отсутствует repoPath
swarm_agent({ action: "register" })
```

---

## Установка

### Быстрый старт

```bash
# 1. Клонировать репозиторий
git clone https://github.com/AbdrAbdr/Swarm_MCP.git
cd Swarm_MCP

# 2. Установить зависимости
npm install

# 3. Собрать проект
npm run build

# 4. Настроить IDE вручную (см. ниже)
```

---

## Ручная установка MCP

### Формат конфига (для всех IDE)

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/path/to/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.unilife-ch.workers.dev/ws",
        "SWARM_PROJECT": "default"
      }
    }
  }
}
```

> **ВАЖНО:** НЕ устанавливайте `SWARM_REPO_PATH` в env! Агенты должны передавать `repoPath` динамически в каждом вызове.

### Пути к конфигам

| IDE | Путь к конфигу |
|-----|----------------|
| **Claude Desktop** | Windows: `%APPDATA%\Claude\claude_desktop_config.json`<br>Mac: `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Cursor** | `~/.cursor/mcp.json` |
| **Windsurf** | Windows: `~/.codeium/windsurf/mcp_config.json`<br>Mac: `~/.windsurf/mcp_config.json` |
| **Antigravity** | Windows: `%APPDATA%\antigravity\mcp_config.json`<br>Mac: `~/Library/Application Support/antigravity/mcp_config.json` |
| **OpenCode** | `~/.config/opencode/opencode.json` (формат отличается, см. ниже) |
| **VS Code (Roo-Cline)** | `%APPDATA%\Code\User\globalStorage\rooveterinaryinc.roo-cline\settings\mcp_settings.json` |

### OpenCode (особый формат)

```json
{
  "mcp": {
    "mcp-swarm": {
      "type": "local",
      "command": ["node", "C:/path/to/Swarm_MCP/dist/serverSmart.js"],
      "enabled": true,
      "environment": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.unilife-ch.workers.dev/ws",
        "SWARM_PROJECT": "default"
      }
    }
  }
}
```

---

## Файлы правил для агентов

Создайте файл правил в корне вашего проекта:

| IDE | Файл правил |
|-----|-------------|
| Claude Desktop / Claude Code | `CLAUDE.md` |
| Cursor | `.cursorrules` |
| Windsurf | `.windsurfrules` |
| OpenCode | `AGENT.md` |
| Antigravity | `GEMINI.md` |
| Multi-agent | `AGENTS.md` |
| VS Code (Roo-Cline) | `.clinerules` |

### Содержимое файла правил

```markdown
# MCP Swarm Agent Rules (v0.9.0)

## CRITICAL: repoPath Parameter

**EVERY MCP Swarm tool call MUST include `repoPath` parameter!**

```typescript
// CORRECT
swarm_agent({ action: "register", repoPath: "/path/to/project" })

// WRONG
swarm_agent({ action: "register" })
```

## Before ANY coding task:

1. `swarm_agent({ action: "register", repoPath })` — получить имя агента
2. `swarm_orchestrator({ action: "elect", repoPath })` — стать оркестратором
3. `swarm_task({ action: "list", repoPath })` — посмотреть задачи
4. `swarm_file({ action: "reserve", repoPath, filePath, agent })` — заблокировать файлы

## Workflow

1. Register → 2. Elect Orchestrator → 3. Get Task → 4. Lock Files → 5. Work → 6. Unlock → 7. PR
```

---

## 41 Smart Tools (v0.9.0)

Вместо 168+ отдельных tools, теперь есть **41 Smart Tool** с параметром `action`:

### Пример использования

```javascript
// Все инструменты требуют repoPath!
const repoPath = "C:/Users/me/projects/my-app";

swarm_agent({ action: "register", repoPath })
swarm_orchestrator({ action: "elect", repoPath })
swarm_task({ action: "list", repoPath })
swarm_file({ action: "reserve", repoPath, filePath: "src/index.ts", agent: "MyName" })
```

### Полный список Smart Tools

| # | Tool | Actions | Описание |
|---|------|---------|----------|
| 1 | `swarm_agent` | register, whoami | Идентификация агента |
| 2 | `swarm_task` | create, list, update, decompose, get_decomposition | Управление задачами |
| 3 | `swarm_file` | reserve, release, list, forecast, conflicts, safety | Блокировка файлов |
| 4 | `swarm_git` | sync, pr, health, cleanup, cleanup_all | Git операции |
| 5 | `swarm_worktree` | create, list, remove | Git worktrees |
| 6 | `swarm_companion` | status, stop, pause, resume | Companion daemon |
| 7 | `swarm_control` | stop, resume, status | Управление swarm |
| 8 | `swarm_chat` | broadcast, dashboard, thought, thoughts | Командный чат |
| 9 | `swarm_review` | request, respond, list | Code review |
| 10 | `swarm_voting` | start, vote, list, get | Голосование |
| 11 | `swarm_auction` | announce, bid, poll | Аукцион задач |
| 12 | `swarm_mcp` | scan, authorize, policy | Сканирование MCP |
| 13 | `swarm_orchestrator` | elect, info, heartbeat, resign, executors, executor_heartbeat | Оркестратор |
| 14 | `swarm_message` | send, inbox, ack, reply, search, thread | Сообщения |
| 15 | `swarm_briefing` | save, load | Брифинги |
| 16 | `swarm_pulse` | update, get | Real-time статус |
| 17 | `swarm_knowledge` | archive, search | База знаний |
| 18 | `swarm_snapshot` | create, rollback, list | Снапшоты |
| 19 | `swarm_health` | check, dead, reassign, summary | Здоровье агентов |
| 20 | `swarm_quality` | run, report, threshold, pr_ready | Quality gate |
| 21 | `swarm_cost` | log, agent, project, limit, remaining | Трекинг расходов |
| 22 | `swarm_brainstorm` | start, ask, answer, propose, present, validate, save, get, list | Brainstorming |
| 23 | `swarm_plan` | create, add, next, start, step, complete, prompt, export, status, list, ready | Планы |
| 24 | `swarm_debug` | start, investigate, evidence, phase1, patterns, phase2, hypothesis, test, fix, verify, get, list, redflags | Дебаг |
| 25 | `swarm_spec` | start, phase, complete, get, list, export | Spec pipeline |
| 26 | `swarm_qa` | start, iterate, fix, get, list, suggest, report | QA loop |
| 27 | `swarm_hooks` | install, uninstall, run, config, update, list | Git hooks |
| 28 | `swarm_screenshot` | share, list | Скриншоты |
| 29 | `swarm_dependency` | signal, sync | Зависимости |
| 30 | `swarm_platform` | request, respond, list | Cross-platform |
| 31 | `swarm_immune` | alert, resolve, status, test, patrol | Иммунная система |
| 32 | `swarm_context` | estimate, compress, compress_many, stats | Сжатие контекста |
| 33 | `swarm_regression` | baseline, check, list, resolve, baselines | Регрессии |
| 34 | `swarm_expertise` | track, suggest, record, experts, list | Экспертиза |
| 35 | `swarm_conflict` | predict, analyze, hotspots, record | Конфликты |
| 36 | `swarm_timeline` | generate, visualize | Таймлайн |
| 37 | `swarm_docs` | generate, task_docs, list, get | Документация |
| 38 | `swarm_advice` | request, provide, list | Советы |
| 39 | `swarm_preemption` | trigger, resolve, active | Preemption |
| 40 | `swarm_clusters` | init, list, tools, find, add, create, summary | Tool clusters |
| 41 | `swarm_session` | start, log, stop, list, replay | Записи сессий |

---

## Структура проекта

```
/swarm/                  # Данные swarm (создаётся в вашем проекте)
├── tasks/               # Файлы задач
├── agents/              # Регистрации агентов
├── locks/               # File locks
├── EVENTS.ndjson        # Event log
└── .swarm/
    ├── ORCHESTRATOR.json    # Состояние оркестратора
    ├── messages/            # Сообщения агентов
    └── inbox/               # Inbox каждого агента

/orchestrator/           # Центр управления (создаётся в вашем проекте)
├── PULSE.md             # Живая карта агентов
├── KNOWLEDGE_BASE.md    # База знаний
├── briefings/           # Ментальные слепки
├── snapshots/           # Снапшоты для отката
└── ...
```

---

## Ключевые возможности

| Функция | Описание |
|---------|----------|
| **Orchestrator Election** | Первый агент становится координатором |
| **File Locking** | Только один агент редактирует файл |
| **Agent Messaging** | Агенты общаются через inbox/outbox |
| **Task Auction** | Задачи выставляются на аукцион |
| **Cloudflare Hub** | Real-time синхронизация через WebSocket |
| **Ghost Mode** | Свободный агент патрулирует код |
| **Briefing Handover** | Агент оставляет "ментальный слепок" |
| **Quality Gate** | Автоматические проверки перед PR |
| **Cost Tracking** | Отслеживание расходов на API |

---

## Environment Variables

```bash
SWARM_HUB_URL=wss://mcp-swarm-hub.unilife-ch.workers.dev/ws   # Cloudflare Hub
SWARM_PROJECT=default                                          # Имя проекта
SWARM_HYBRID_MODE=true                                         # WS + Git fallback
```

> **НЕ используйте `SWARM_REPO_PATH`!** Агенты передают `repoPath` в каждом вызове.

---

## Команды

```bash
# Запустить Smart Tools сервер (v0.9.0)
npm run dev

# Запустить Legacy сервер (168+ tools)
npm run dev:legacy

# Запустить Companion daemon
npm run companion

# Установить правила агентов
npm run install-mcp

# Собрать проект
npm run build
```

---

## Cloudflare Hub

MCP Swarm использует Cloudflare Durable Objects для real-time синхронизации:

- **URL:** `https://mcp-swarm-hub.unilife-ch.workers.dev`
- **WebSocket:** `wss://mcp-swarm-hub.unilife-ch.workers.dev/ws`

Функции:
- Real-time синхронизация между агентами
- Task claiming и file locking
- Auction system
- Agent heartbeats

---

## Security

- Токены GitHub/Cloudflare **НЕ** коммитить — используйте env vars
- Voting для опасных действий (delete folder, change core)
- File locks предотвращают конфликты
- Quality Gate проверяет код перед merge

---

## License

MIT

---

# CHANGELOG

## [0.9.0] - 2026-02-02

### MAJOR: Smart Tools + repoPath

- **41 Smart Tools** (consolidated from 168+)
- **repoPath parameter required** in every tool call
- **Cloudflare Hub deployed** for real-time sync
- **No more SWARM_REPO_PATH** in env - agents pass repoPath dynamically

### Files Changed

- `src/smartTools.ts` — All 41 Smart Tools
- `src/serverSmart.ts` — New server entry point
- `src/workflows/repo.ts` — Graceful handling of non-git repos
- `src/scripts/install.ts` — Updated with repoPath instructions
- `CLAUDE.md`, `GEMINI.md`, `AGENT.md`, `AGENTS.md` — Agent rules

---

## [0.8.x] - 2026-02-02

- Orchestrator Election
- Agent Messaging
- Infinite Loop Mode

---

## [0.7.0] - [0.1.0]

- Core functionality
- Task management
- File locking
- Git worktrees
- Team chat
- Voting system
