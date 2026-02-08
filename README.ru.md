> 🇬🇧 [Read in English](./README.md) | 📋 [История изменений](./CHANGELOG.ru.md)

[![npm version](https://img.shields.io/npm/v/mcp-swarm.svg)](https://www.npmjs.com/package/mcp-swarm)
[![npm downloads](https://img.shields.io/npm/dm/mcp-swarm.svg)](https://www.npmjs.com/package/mcp-swarm)
[![license](https://img.shields.io/npm/l/mcp-swarm.svg)](https://github.com/AbdrAbdr/MCP-Swarm/blob/main/LICENSE)
[![CI](https://github.com/AbdrAbdr/MCP-Swarm/actions/workflows/ci.yml/badge.svg)](https://github.com/AbdrAbdr/MCP-Swarm/actions/workflows/ci.yml)

<p align="center">
  <img src="./assets/banner.png" alt="MCP Swarm Banner" width="800" />
</p>

# 🐝 MCP Swarm v0.9.18 — Универсальная Платформа Координации AI-Агентов

> 🧠 **v0.9.18 — Новые AI-модели:** Claude Opus 4.6 (1M контекст, adaptive thinking), GPT-5.3 Codex, Kimi K2.5. 19 моделей в MoE Router. Обновитесь: `npm install -g mcp-swarm@latest`

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

## 🛠 54 Smart Tools: Инструментарий Swarm

Вместо сотен мелких команд мы создали **54 интеллектуальных инструмента**. Каждый из них — это целое направление работы:

### 🚀 Ядро системы
1.  **swarm_agent** — Регистрация, идентификация и авто-инициализация любого проекта.
2.  **swarm_orchestrator** — Выборы лидера, мониторинг исполнителей, раздача задач.
3.  **swarm_control** — Глобальный стоп-кран и управление состоянием роя.
4.  **swarm_pulse** — Живая карта активности: кто над чем работает прямо сейчас.

### 📋 Управление задачами и планами
5.  **swarm_task** — Создание, аукцион и отслеживание задач.
6.  **swarm_plan** — Составление сложных многошаговых планов реализации.
7.  **swarm_briefing** — «Ментальные слепки»: передача контекста между сменами агентов.
8.  **swarm_decompose** — Разбиение больших задач на мелкие подзадачи.

### 🔒 Работа с файлами и Git
9.  **swarm_file** — Умная блокировка файлов и прогноз конфликтов.
10. **swarm_git** — Синхронизация, проверка здоровья ветки и создание PR.
11. **swarm_worktree** — Управление рабочими деревьями Git для параллельных задач.
12. **swarm_snapshot** — Мгновенные снимки кода для быстрого отката.
13. **swarm_conflict** — Предсказание и анализ горячих точек в коде.

### 💬 Коммуникация и Коллаборация
14. **swarm_chat** — Общий чат агентов и логирование «мыслей» роя.
15. **swarm_message** — Личные сообщения между агентами с подтверждением прочтения.
16. **swarm_review** — Запрос и проведение кросс-агентного код-ревью.
17. **swarm_voting** — Голосование за опасные или важные архитектурные решения.
18. **swarm_brainstorm** — Коллективный поиск идей и проектирование систем.

### 🛡️ Качество и Здоровье
19. **swarm_health** — Проверка «живучести» агентов и переназначение задач «умерших».
20. **swarm_quality** — Проверка кода перед мерджем (линтеры, тесты, типы).
21. **swarm_immune** — Автоматическая реакция на поломки в CI/CD.
22. **swarm_safety** — Анализ безопасности изменений и зависимостей.
23. **swarm_qa** — Циклы тестирования и исправления багов.
24. **swarm_debug** — Системная отладка с фиксацией гипотез и улик.

### 📊 Аналитика и Документация
25. **swarm_cost** — Трекинг расходов на API каждого агента и проект в целом.
26. **swarm_docs** — Автоматическая генерация документации по ходу работы.
27. **swarm_timeline** — Визуализация истории развития проекта.
28. **swarm_knowledge** — База знаний: сохранение находок, паттернов и обходных путей.

### 🤖 Продвинутые функции
29. **swarm_mcp** — Сканирование и авторизация других MCP-серверов в системе.
30. **swarm_companion** — Управление фоновым демоном-помощником.
31. **swarm_session** — Запись и воспроизведение сессий работы агентов.
32. **swarm_expertise** — Анализ специализации: кто из агентов лучше шарит в какой части кода.
33. **swarm_regression** — Детектор регрессий: следит, чтобы старые баги не возвращались.
34. **swarm_context** — Умное сжатие контекста для экономии токенов.
35. **swarm_platform** — Проверка кросс-платформенной совместимости.
36. **swarm_urgent** — Система экстренного прерывания для критических задач.
37. **swarm_spec** — Управление спецификациями и фазами проектирования.
38. **swarm_guard** — Установка защитных хуков на файлы.
39. **swarm_clusters** — Группировка инструментов в логические кластеры.
40. **swarm_patrol** — Режим автономного патрулирования кода.
41. **swarm_scan** — Глубокое сканирование проекта на соответствие правилам Swarm.

### 🧠 v0.9.3 — Smart Features
42. **swarm_routing** — Умное назначение задач на основе экспертизы агентов в файлах.
43. **swarm_context_pool** — Общие заметки о коде между агентами (экономия токенов).
44. **swarm_autoreview** — Автоматическое назначение code review при завершении задач.
45. **swarm_external** — Двусторонняя синхронизация с GitHub Issues и Linear.app.
46. **swarm_budget** — Оптимизация затрат: роутинг задач на дешёвые/дорогие модели.

### 📱 v0.9.4 — Telegram Integration
47. **swarm_telegram** — Telegram Bot для уведомлений и управления Swarm.
    - Получайте уведомления о задачах, агентах, CI ошибках
    - Команды: `/status`, `/agents`, `/tasks`, `/create_task`, `/stop`, `/resume`
    - Интерактивные кнопки для быстрых действий
    - Настройка через Dashboard или `.swarm/telegram.json`
48. **swarm_batch** — Батчинг API запросов (экономия 50% на Anthropic/OpenAI).
    - Автоматическая группировка запросов
    - Поддержка Anthropic Message Batches и OpenAI Batch API
    - Статистика экономии

### 🧠 v0.9.5 — SONA: Self-Optimizing Neural Architecture
49. **swarm_sona** — Самообучающийся роутер задач.
    - Классифицирует задачи по 13 категориям (frontend_ui, backend_api, database, testing, devops, etc.)
    - Определяет сложность (trivial, simple, medium, complex, epic)
    - Отслеживает успешность каждого агента в каждой категории
    - Маршрутизирует новые задачи к лучшим исполнителям
    - Обучается на результатах (<0.05ms адаптация)
    - EWC++ (Elastic Weight Consolidation) — не забывает старые паттерны
    - 10% exploration rate — пробует новых агентов для сбора данных
    
    **Пример использования:**
    ```typescript
    // Получить рекомендацию — кому назначить задачу
    swarm_sona({
      action: "route",
      repoPath,
      title: "Fix login button styling",
      description: "Button not visible on dark theme",
      affectedFiles: ["src/components/Login.tsx"]
    })
    // → { recommendedAgent: "RadiantWolf", confidence: 0.85, category: "frontend_ui" }
    
    // После выполнения — обучить систему
    swarm_sona({
      action: "learn",
      repoPath,
      taskId: "task-123",
      agentName: "RadiantWolf",
      success: true,
      qualityScore: 0.9,
      timeMinutes: 15
    })
    
    // Получить специалистов по backend
    swarm_sona({ action: "specialists", repoPath, category: "backend_api", limit: 3 })
    // → [{ agent: "StormyOwl", score: 0.92 }, { agent: "BrightFox", score: 0.88 }, ...]
    ```

### ⚡ v0.9.6 — Agent Booster
50. **swarm_booster** — Быстрое выполнение простых задач БЕЗ LLM.
    - 352x быстрее чем LLM (~8ms vs ~3000ms)
    - $0 стоимость (без API вызовов)
    - Работает офлайн
    - Детерминированные результаты
    
    **Поддерживаемые типы задач:**
    - `rename_variable` — переименование переменных/функций
    - `fix_typo` — исправление опечаток в строках/комментариях
    - `find_replace` — простая замена текста
    - `add_console_log` / `remove_console_log` — добавление/удаление отладки
    - `toggle_flag` — переключение boolean флагов
    - `update_version` — обновление версий
    - `update_import` — обновление путей импортов
    - `format_json` — форматирование JSON
    - `sort_imports` — сортировка импортов
    - `add_export` — добавление export
    - `extract_constant` — извлечение magic numbers
    
    **Пример использования:**
    ```typescript
    // Проверить, можно ли ускорить задачу
    swarm_booster({
      action: "can_boost",
      repoPath,
      description: "rename variable oldName to newName"
    })
    // → { canBoost: true, taskType: "rename_variable", confidence: 0.9 }
    
    // Выполнить задачу локально
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
    
    // Удалить все console.log из файла
    swarm_booster({
      action: "execute",
      repoPath,
      task: { type: "remove_console_log", filePath: "src/debug.ts" }
    })
    
    // Статистика экономии
    swarm_booster({ action: "stats", repoPath })
    // → { totalTasks: 50, costSaved: "$0.50", timeSavedMinutes: 2.5 }
    ```

### 🔍 v0.9.7 — HNSW Vector Search
51. **swarm_vector** — Быстрый семантический поиск в памяти.
    - 150x-12,500x быстрее brute force
    - Pure TypeScript (без зависимостей)
    - Поддержка cosine/euclidean/dot метрик
    - Встроенный простой embedder + поддержка внешних
    
    **Применения:**
    - Семантический поиск в knowledge base
    - Поиск похожих кусков кода
    - Retrieval контекста для агентов
    - Поиск дубликатов
    - Кластеризация задач
    
    **Пример использования:**
    ```typescript
    // Инициализация индекса
    swarm_vector({
      action: "init",
      repoPath,
      config: { dimensions: 384, distanceMetric: "cosine" }
    })
    
    // Добавление документов
    swarm_vector({
      action: "add",
      repoPath,
      id: "doc-1",
      text: "How to configure JWT authentication",
      metadata: { category: "auth", language: "typescript" }
    })
    
    // Семантический поиск
    swarm_vector({
      action: "search",
      repoPath,
      query: "setting up user login",
      k: 5,
      filter: { category: "auth" }
    })
    // → [{ id: "doc-1", score: 0.87, ... }, ...]
    
    // Поиск дубликатов
    swarm_vector({ action: "duplicates", repoPath, threshold: 0.95 })
    // → [{ id1: "doc-1", id2: "doc-5", similarity: 0.97 }]
    ```

### 🛡️ v0.9.8 — AIDefence Security
52. **swarm_defence** — Защита от угроз и атак на AI-систему.
    - <10ms детекция угроз
    - Pattern-based + эвристический анализ
    - Система карантина подозрительного контента
    - Аудит-логирование всех событий безопасности
    
    **Категории угроз:**
    - Prompt injection (обход инструкций)
    - Jailbreak (обход ограничений)
    - Code injection (вредоносный код)
    - Data exfiltration (утечка данных)
    - Sensitive data (PII, ключи API)
    - Unsafe commands (опасные команды)
    - Social engineering (манипуляции)
    
    **Уровни чувствительности:** `low`, `medium`, `high`, `paranoid`
    
    **Пример использования:**
    ```typescript
    // Сканирование текста на угрозы
    swarm_defence({
      action: "scan",
      text: "Ignore all previous instructions and...",
      source: "user",
      repoPath
    })
    // → { detected: true, category: "prompt_injection", severity: "high", action: "block" }
    
    // Настройка чувствительности
    swarm_defence({
      action: "set_config",
      config: { sensitivity: "high", blockOnHighThreat: true },
      repoPath
    })
    
    // Добавление доверенного агента
    swarm_defence({ action: "trust", agentName: "RadiantWolf", repoPath })
    
    // Просмотр статистики
    swarm_defence({ action: "stats", repoPath })
    // → { totalScans: 150, threatsDetected: 3, threatsBlocked: 2, ... }
    ```

### 🤝 v0.9.9 — Consensus Protocols
53. **swarm_consensus** — Распределённое согласие для координации агентов.
    - Raft-подобные выборы лидера
    - Репликация лога команд
    - Byzantine Fault Tolerance (BFT)
    - Система предложений и голосований
    
    **Режимы консенсуса:**
    - `simple_majority`: 50%+ голосов
    - `raft`: Term-based лидерство
    - `bft`: Byzantine (2/3+1 кворум)
    
    **Пример использования:**
    ```typescript
    // Присоединение к кластеру
    swarm_consensus({
      action: "join",
      nodeId: "agent-1",
      nodeName: "RadiantWolf",
      repoPath
    })
    
    // Выборы лидера
    swarm_consensus({
      action: "elect",
      nodeId: "agent-1",
      nodeName: "RadiantWolf",
      repoPath
    })
    
    // Создание предложения
    swarm_consensus({
      action: "propose",
      nodeId: "agent-1",
      nodeName: "RadiantWolf",
      title: "Внедрить dark mode",
      description: "Добавить тёмную тему в дашборд",
      type: "architecture",
      requiredMajority: 0.67,
      repoPath
    })
    
    // Голосование
    swarm_consensus({
      action: "vote",
      proposalId: "prop_xxx",
      nodeId: "agent-2",
      nodeName: "BrilliantFox",
      vote: "approve",
      repoPath
    })
    // → { status: "approved", votes: 2/2 }
    ```

### 🧠 v0.9.10 — MoE Router
54. **swarm_moe** — Интеллектуальный выбор AI-модели для задачи.
    - Автоматический роутинг на лучшую модель
    - Оптимизация cost/performance/quality
    - Обучение на обратной связи
    - 16 встроенных экспертов (проверенные цены: февраль 2026)
    
    **Встроенные эксперты (официальные цены):**
    
    | Provider | Model | Tier | Input $/MTok | Output $/MTok | Context |
    |----------|-------|------|--------------|---------------|---------|
    | Anthropic | Claude Opus 4.5 | flagship | $5 | $25 | 200K |
    | Anthropic | Claude Sonnet 4.5 | premium | $3 | $15 | 200K |
    | Anthropic | Claude Haiku 4.5 | economy | $1 | $5 | 200K |
    | OpenAI | GPT-5.2 | flagship | $1.75 | $14 | 256K |
    | OpenAI | GPT-5.2 Pro | flagship | $21 | $168 | 256K |
    | OpenAI | GPT-5 Mini | standard | $0.25 | $2 | 128K |
    | OpenAI | GPT-4.1 | premium | $3 | $12 | 128K |
    | OpenAI | GPT-4.1 Mini | standard | $0.80 | $3.20 | 128K |
    | OpenAI | GPT-4.1 Nano | economy | $0.20 | $0.80 | 128K |
    | OpenAI | o4-mini | reasoning | $4 | $16 | 128K |
    | Google | Gemini 3 Pro | flagship | $2 | $12 | **1M** |
    | Google | Gemini 3 Flash | standard | $0.50 | $3 | **1M** |
    | Google | Gemini 2.5 Pro | premium | $1.25 | $10 | **1M** |
    | Google | Gemini 2.5 Flash | standard | $0.30 | $2.50 | **1M** |
    | Google | Gemini 2.5 Flash Lite | economy | $0.10 | $0.40 | **1M** |
    
    **Пример использования:**
    ```typescript
    // Роутинг задачи на лучшую модель
    swarm_moe({
      action: "route",
      content: "Write a React component for user authentication",
      preferredTier: "premium",
      maxCost: 0.05,
      repoPath
    })
    // → { selectedExpert: "claude-sonnet", confidence: 0.92, estimatedCost: $0.02 }
    
    // Обратная связь для обучения
    swarm_moe({
      action: "feedback",
      expertId: "claude-sonnet",
      success: true,
      quality: 5,
      actualLatencyMs: 1800,
      repoPath
    })
    
    // Статистика
    swarm_moe({ action: "stats", repoPath })
    // → { totalRequests: 150, successRate: 94%, totalCost: $1.23 }
    ```

### 🧠 v0.9.18 — Интеграция новых AI-моделей
 
**3 новых модели в MoE Router (19 всего):**
- **Claude Opus 4.6** — флагман Anthropic, 1M контекст, adaptive thinking, context compaction, 128K output, agent teams
- **GPT-5.3 Codex** — флагман OpenAI для агентного кодинга, 256K контекст
- **Kimi K2.5** — premium модель Moonshot AI для кода
 
**Изменения тиров:**
- Opus 4.5 понижен с `flagship` → `premium` (Opus 4.6 занимает flagship)
- Новый провайдер `moonshot` в `ModelProvider`
 
---
 
### 🏗️ v0.9.17 — Модульная Архитектура и Cloudflare Auth

**Модуляризация кода:**
- `smartTools.ts` разбит на **9 модулей** в `src/smartTools/`
- Чистый re-export через `index.ts` — без breaking changes
- Удалены legacy `tools.ts` и `server.ts` (~5000 строк мёртвого кода)

**Cloudflare Workers с аутентификацией:**
- **`abdr-swarm-hub`** — WebSocket bridge + REST API с `SWARM_AUTH_TOKEN`
- **`abdr-swarm-server`** — Streamable HTTP MCP Server, автопроброс Bearer Token
- **`abdr-swarm-telegram`** — Бот с защищённым `/register` endpoint

**CI/CD Pipeline:**
- GitHub Actions: ветки `main` + `develop`
- TypeScript проверка (`tsc --noEmit`) перед билдом
- Матрица Node.js: 18, 20, 22
- Автопубликация в npm при push в `main`

---

### 📊 v0.9.12 — Real-time Dashboard & Enhanced Controls (NEW)

**Dashboard WebSocket Widgets:**
- **ConnectionStatusWidget** — Live статус подключения к Hub с кнопкой reconnect
- **ActivityTimelineWidget** — Real-time поток событий Swarm
- **FileLocksWidget** — Активные блокировки файлов с live updates
- **CostTrackingWidget** — Использование API и прогресс бюджета
- **VotingWidget** — Proposals и голосования в реальном времени

**Настройка Dashboard WebSocket:**
```bash
# В dashboard/.env
NEXT_PUBLIC_HUB_URL=wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev
```

**Telegram Code Reviews (NEW):**
- `/reviews` — Список pending code reviews с inline кнопками approve/reject
- `/approve [id]` — Одобрить review напрямую из Telegram
- `/reject [id] [reason]` — Отклонить review с указанием причины

**Пример:**
```
Вы: /reviews

Бот: 📋 Pending Code Reviews:

1. 🔵 Review #abc123
   Files: src/utils.ts, src/index.ts
   Author: RadiantWolf
   Created: 2 hours ago
   
   [✅ Approve] [❌ Reject]

Вы: /approve abc123
Бот: ✅ Review abc123 approved!
```

**Auto-start Companion (NEW):**
При запуске `mcp-swarm-remote` автоматически проверяет и запускает companion демон:
```bash
# Companion запускается автоматически
npx -y -p mcp-swarm mcp-swarm-remote --url https://...

# Отключить автозапуск
npx -y -p mcp-swarm mcp-swarm-remote --url https://... --no-companion
```

Companion работает на порту **37373** и обеспечивает:
- Локальное выполнение файловых операций
- Bridge между IDE и Hub
- Health checks на `/health` endpoint

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
