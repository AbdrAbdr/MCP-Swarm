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
- **Real-time Sync** — все видят изменения мгновенно

## Как работает система агентов?

### Архитектура: Orchestrator + Executors

```
┌─────────────────────────────────────────────────────┐
│                  ПЕРВЫЙ АГЕНТ                       │
│                 (ORCHESTRATOR)                      │
│  - Автоматически избирается (first-come-first-win) │
│  - Работает в БЕСКОНЕЧНОМ ЦИКЛЕ                    │
│  - Только пользователь может остановить            │
│  - Координирует всех исполнителей                  │
└────────────────────────┬────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ EXECUTOR 1  │  │ EXECUTOR 2  │  │ EXECUTOR N  │
│  (Claude)   │  │  (Cursor)   │  │ (Windsurf)  │
│ Исполнитель │  │ Исполнитель │  │ Исполнитель │
│ Берёт задачи│  │ Берёт задачи│  │ Берёт задачи│
│ Heartbeat   │  │ Heartbeat   │  │ Heartbeat   │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Как ведёт себя каждый агент?

#### 1. ORCHESTRATOR (Координатор)

**Кто становится:** Первый агент, вызвавший `swarm_orchestrator(action: "elect")`

**Что делает:**
- Работает в **бесконечном цикле** (как Ralf Wigum)
- Читает список задач, распределяет их
- Следит за здоровьем всех агентов (heartbeat)
- Переназначает задачи если агент "умер"
- НЕ останавливается по API — только пользователь может сказать "стоп"

**Цикл работы:**
```
1. Poll событий → 2. Проверить inbox → 3. Распределить задачи →
4. Проверить heartbeats → 5. Обновить dashboard → [повторить]
```

#### 2. EXECUTOR (Исполнитель)

**Кто становится:** Все остальные агенты после Orchestrator

**Что делает:**
- Регистрируется у Orchestrator
- Получает задачи через аукцион или прямое назначение
- Блокирует файлы перед редактированием
- Отправляет heartbeat каждые N минут
- Общается с другими агентами через messaging
- Делает PR когда задача готова

**Цикл работы:**
```
1. Проверить inbox → 2. Взять задачу → 3. Заблокировать файлы →
4. Работать → 5. Освободить файлы → 6. Отправить heartbeat → [повторить]
```

#### 3. GHOST MODE (Режим призрака)

**Когда активируется:** Агент выполнил задачу и ждёт новую

**Что делает:**
- Патрулирует код: проверяет lint ошибки
- Оптимизирует импорты
- Ищет проблемы в коде других агентов

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

## Ручная установка по IDE

### 1. Claude Desktop

**Конфиг:** `%APPDATA%\Claude\claude_desktop_config.json` (Windows) | `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac)

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/path/to/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_REPO_PATH": "C:/path/to/your/project"
      }
    }
  }
}
```

**Файл правил:** Создайте `CLAUDE.md` в корне вашего проекта.

---

### 2. Claude Code (CLI)

**Установка через команду:**

```bash
claude mcp add mcp-swarm --transport stdio -- node C:/path/to/Swarm_MCP/dist/serverSmart.js
```

Или добавьте в `~/.claude/.claude.json` в секцию `projects.{path}.mcpServers`:

```json
{
  "projects": {
    "C:/your/project": {
      "mcpServers": {
        "mcp-swarm": {
          "command": "node",
          "args": ["C:/path/to/Swarm_MCP/dist/serverSmart.js"],
          "env": {
            "SWARM_REPO_PATH": "C:/your/project"
          }
        }
      }
    }
  }
}
```

**Файл правил:** Создайте `CLAUDE.md` в корне вашего проекта.

---

### 3. Cursor

**Конфиг:** `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/path/to/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_REPO_PATH": "C:/path/to/your/project"
      }
    }
  }
}
```

**Файл правил:** Создайте `.cursorrules` в корне вашего проекта.

---

### 4. Windsurf

**Конфиг:** `~/.windsurf/mcp_config.json` (Windows/Mac/Linux)

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/path/to/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_REPO_PATH": "C:/path/to/your/project"
      }
    }
  }
}
```

**Файл правил:** Создайте `.windsurfrules` в корне вашего проекта.

---

### 5. OpenCode

**Конфиг:** `~/.config/opencode/opencode.json`

```json
{
  "mcp": {
    "mcp-swarm": {
      "type": "local",
      "command": [
        "node",
        "C:/path/to/Swarm_MCP/dist/serverSmart.js"
      ],
      "enabled": true,
      "environment": {
        "SWARM_REPO_PATH": "C:/path/to/your/project"
      }
    }
  }
}
```

**Файл правил:** Создайте `AGENT.md` в корне вашего проекта.

---

### 6. Antigravity (Google)

**Конфиг:** `%APPDATA%\antigravity\User\settings.json` (Windows) | `~/Library/Application Support/antigravity/User/settings.json` (Mac)

MCP поддержка в Antigravity - через расширения. Добавьте конфигурацию аналогично VS Code.

**Файл правил:** Создайте `GEMINI.md` в корне вашего проекта.

---

### 7. VS Code (Roo-Cline)

**Конфиг:** `%APPDATA%\Code\User\globalStorage\rooveterinaryinc.roo-cline\settings\mcp_settings.json`

```json
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "node",
      "args": ["C:/path/to/Swarm_MCP/dist/serverSmart.js"],
      "env": {
        "SWARM_REPO_PATH": "C:/path/to/your/project"
      }
    }
  }
}
```

**Файл правил:** Создайте `.clinerules` в корне вашего проекта.

---

## Файлы правил для агентов

После установки MCP, создайте файл правил в корне вашего проекта:

| IDE | Файл правил |
|-----|-------------|
| Claude Desktop | `CLAUDE.md` |
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursorrules` |
| Windsurf | `.windsurfrules` |
| OpenCode | `AGENT.md` |
| Antigravity | `GEMINI.md` |
| VS Code | `.clinerules` |

### Содержимое файла правил

Скопируйте в файл:

```markdown
# MCP Swarm Agent Rules (v0.9.0)

## CRITICAL: Always Start with MCP Swarm

Before ANY coding task, you MUST:

1. **Register yourself** - Call `swarm_agent({ action: "register" })`
2. **Check swarm status** - Call `swarm_control({ action: "status" })`
3. **Check task list** - Call `swarm_task({ action: "list" })`
4. **Reserve files** - Before editing, call `swarm_file({ action: "reserve", filePath: "...", agent: "YourName" })`

## Agent Roles

### ORCHESTRATOR (First Agent)
The first agent that calls `swarm_orchestrator({ action: "elect" })` becomes the Orchestrator.
- Works in **INFINITE LOOP** - only user can stop
- Distributes tasks, monitors agent heartbeats, coordinates work

### EXECUTOR (All Other Agents)
All subsequent agents become Executors.
- Register with `swarm_agent({ action: "register" })`
- Get tasks via auction system
- Lock files before editing, send heartbeat, create PRs

## Workflow

1. `swarm_agent({ action: "register" })` → Get your name (e.g., "RadiantWolf")
2. `swarm_task({ action: "list" })` → See what needs to be done
3. `swarm_file({ action: "reserve", filePath, agent, exclusive: true })` → Lock files
4. Do your work
5. `swarm_file({ action: "release", filePath, agent })` → Unlock files
6. `swarm_git({ action: "sync" })` → Rebase before push
7. `swarm_git({ action: "pr", title, body })` → Open PR
```

---

## 41 Smart Tools (v0.9.0)

Вместо 168+ отдельных tools, теперь есть **41 Smart Tool** с параметром `action`:

### Пример использования

**До (v0.8.x):**
```
task_create, task_list, task_assign, task_set_status, task_mark_done... (9 tools)
```

**После (v0.9.0):**
```javascript
swarm_task({
  action: "create" | "list" | "update" | "decompose" | "get_decomposition"
})
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
/swarm/                  # Данные swarm
├── tasks/               # Файлы задач
├── agents/              # Регистрации агентов
├── locks/               # File locks
├── EVENTS.ndjson        # Event log
└── .swarm/
    ├── ORCHESTRATOR.json    # Состояние оркестратора
    ├── messages/            # Сообщения агентов
    └── inbox/               # Inbox каждого агента

/orchestrator/           # Центр управления
├── PULSE.md             # Живая карта агентов
├── KNOWLEDGE_BASE.md    # База знаний
├── briefings/           # Ментальные слепки
├── snapshots/           # Снапшоты для отката
├── docs/                # Авто-документация
├── sessions/            # Записи сессий
├── quality/             # Отчёты качества
├── costs/               # Логи расходов
├── brainstorm/          # Brainstorm сессии
├── plans/               # Implementation планы
├── debug/               # Debug сессии
├── specs/               # Spec pipelines
└── qa-loops/            # QA loop сессии
```

---

## Ключевые возможности

### 1. Orchestrator Election
Первый агент автоматически становится координатором. Все остальные — исполнители.

### 2. File Locking
Только один агент может редактировать файл. Остальные могут читать.

### 3. Agent Messaging
Агенты общаются между собой через inbox/outbox систему.

### 4. Task Auction
Задачи выставляются на аукцион. Агенты "торгуются" за них.

### 5. Collective Advice
Агент может запросить совет у всех остальных.

### 6. Ghost Mode
Свободный агент патрулирует код, ищет ошибки.

### 7. Briefing Handover
Агент оставляет "ментальный слепок" для следующего.

### 8. Quality Gate
Автоматические проверки перед PR.

### 9. Cost Tracking
Отслеживание расходов на API каждого агента.

### 10. Session Recording
Запись действий для replay и обучения.

---

## Environment Variables

```bash
SWARM_REPO_PATH=        # Путь к репозиторию
SWARM_HUB_URL=          # URL Cloudflare Hub (ws://...)
SWARM_PROJECT=default   # Имя проекта
SWARM_HYBRID_MODE=true  # WS + Git fallback
```

---

## Команды

```bash
# Запустить Smart Tools сервер (v0.9.0)
npm run dev

# Запустить Legacy сервер (168+ tools)
npm run dev:legacy

# Запустить Companion daemon
npm run companion

# Установить MCP во все IDE
npm run install-mcp

# Собрать проект
npm run build
```

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

### MAJOR: Smart Tools Consolidation

**Reduces 168+ individual tools → 41 Smart Tools with `action` parameter**

- Each Smart Tool groups 3-15 related functions via `action` parameter
- Better discoverability and easier to remember
- Consistent parameter patterns across all tools

### Files Changed

- `src/smartTools.ts` — All 41 Smart Tools
- `src/serverSmart.ts` — New server entry point
- `package.json` — v0.9.0, `npm run dev` uses Smart Tools

---

## [0.8.1] - 2026-02-02

### Added
- Smart Tools draft prototypes

---

## [0.8.0] - 2026-02-02

### Added
- **Orchestrator Election** (6 tools)
- **Agent Messaging** (6 tools)
- **Infinite Loop Mode**

---

## [0.7.0] - 2026-02-02

### Added
- **Spec Pipeline** (6 tools)
- **QA Loop** (7 tools)
- **Guard Hooks** (6 tools)
- **Tool Clusters** (7 tools)

---

## [0.6.0] - 2026-02-01

### Added
- **Brainstorming Skill** (9 tools)
- **Writing Plans Skill** (11 tools)
- **Systematic Debugging** (13 tools)

---

## [0.5.0] - 2026-01-31

### Added
- Agent Health Monitor
- Session Recording
- Quality Gate
- Cost Tracker
- Context Compressor
- Regression Detector

---

## [0.4.x]

- Timeline Visualization
- Auto-Documentation
- Agent Specialization
- Conflict Prediction

---

## [0.3.0] - [0.1.0]

- Core functionality
- Task management
- File locking
- Git worktrees
- Team chat
- Voting system
