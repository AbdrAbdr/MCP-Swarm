# Changelog

Все значимые изменения в проекте MCP Swarm документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
версионирование следует [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
