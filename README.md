# MCP Swarm v0.7.0

**Multi-Agent Coordination Platform** — система для координации до 50+ AI-агентов, работающих над одним проектом на разных машинах (Windows/Mac/Linux).

## Что нового в v0.7.0 (26 новых tools)

### 1. Spec Pipeline (6 tools)
Структурированный pipeline для создания спецификаций через **4 роли**:
- **Gatherer** — сбор требований, ограничений, контекста
- **Researcher** — исследование prior art, паттернов, tradeoffs
- **Writer** — написание спецификации
- **Critic** — ревью и выявление gaps/issues

```
start_spec_pipeline → start_spec_phase → complete_spec_phase (loop) → export_spec_as_markdown
```

### 2. QA Loop (7 tools)
Итеративные циклы **reviewer → fixer → loop** до прохождения всех проверок:
- `start_qa_loop` — начать QA loop
- `run_qa_iteration` — запустить проверки
- `log_qa_fix` — записать исправление
- `get_qa_fix_suggestions` — получить предложения
- `generate_qa_report` — сгенерировать отчёт

### 3. Guard Hooks (6 tools)
**Pre-commit** и **pre-push** safety hooks:
- Автоматически запускают lint, type check, tests
- Bypass через `[skip-hooks]` в commit message
- Настраиваемые проверки

### 4. Tool Clusters (7 tools)
Организация **156+ tools** по **13 категориям**:

| Кластер | Tools | Описание |
|---------|-------|----------|
| 🤖 agent | 10 | Agent management, health, specialization |
| 📋 task | 11 | Task create, assign, decompose |
| 🔒 file | 9 | File locks, conflict prediction |
| 🌿 git | 7 | Worktrees, PRs, branch management |
| 💬 collab | 12 | Chat, reviews, knowledge sharing |
| 🛡️ safety | 13 | Voting, snapshots, emergency controls |
| ✅ quality | 16 | Quality gates, QA loops, regression |
| 🔍 debug | 13 | Systematic debugging |
| 📝 plan | 26 | Brainstorming, plans, spec pipeline |
| 🪝 hooks | 6 | Guard hooks |
| 🎬 session | 5 | Session recording |
| 💰 cost | 9 | Cost tracking, context compression |
| 📚 docs | 5 | Auto-documentation |

---

## Что было в v0.6.0 (33 tools)

### 1. Brainstorming Skill (9 tools)
Интерактивный дизайн через **вопросы по одному** (из [obra/superpowers](https://github.com/obra/superpowers)):
- `start_brainstorm` — начать сессию brainstorming
- `ask_brainstorm_question` — задать вопрос (ONE at a time, multiple choice preferred)
- `answer_brainstorm_question` — записать ответ пользователя
- `propose_approaches` — предложить варианты с pros/cons
- `present_design_section` — представить секцию дизайна (200-300 слов max!)
- `validate_design_section` — валидация секции
- `save_design_document` — сохранить в `docs/plans/`
- `get_brainstorm_session` — статус сессии
- `list_brainstorm_sessions` — список сессий

### 2. Writing Plans Skill (11 tools)
TDD-планы с **bite-sized задачами** (2-5 минут каждая):
- `create_implementation_plan` — создать план
- `add_plan_task` — добавить задачу с TDD-шагами
- `get_next_task` — следующая задача (учитывает dependencies)
- `start_plan_task` — начать работу
- `complete_step` — завершить TDD-шаг (write_test → run_test → implement → verify → commit)
- `complete_plan_task` — завершить задачу
- `generate_subagent_prompt` — генерировать промпт для субагента
- `export_plan_as_markdown` — экспорт в markdown
- `get_plan_status` — статус плана
- `list_plans` — список планов
- `mark_plan_ready` — пометить готовым к выполнению

### 3. Systematic Debugging (13 tools)
4-фазный процесс дебага — **NO FIXES WITHOUT ROOT CAUSE!**
- **Phase 1: Investigation** — `start_debug_session`, `log_investigation`, `add_evidence`, `complete_phase_1`
- **Phase 2: Pattern Analysis** — `log_patterns`, `complete_phase_2`
- **Phase 3: Hypothesis** — `form_hypothesis`, `test_hypothesis`
- **Phase 4: Implementation** — `implement_fix`, `verify_fix`
- **Utility** — `get_debug_session`, `list_debug_sessions`, `check_red_flags`

**Red Flags (если думаете так — STOP!):**
- "Let me just try..."
- "Maybe if I..."
- "This should fix it..."
- "I'll just add a check..."

---

## Что было в v0.5.0

### Agent Health Monitor
- `check_agent_health`, `get_dead_agents`, `force_reassign_task`, `get_swarm_health_summary`

### Session Recording
- `start_session_recording`, `log_session_action`, `stop_session_recording`, `list_session_recordings`, `replay_session`

### Quality Gate
- `run_quality_gate`, `get_quality_report`, `set_quality_threshold`, `check_pr_ready`

### Cost Tracker
- `log_api_usage`, `get_agent_costs`, `get_project_costs`, `set_budget_limit`, `check_budget_remaining`

### Context Compressor
- `estimate_context_size`, `compress_briefing`, `compress_multiple_briefings`, `get_compression_stats`

### Regression Detector
- `save_baseline`, `check_regression`, `list_regressions`, `resolve_regression`, `list_baselines`

---

## Что было в v0.4.x

### v0.4.2: Timeline Visualization
- `generate_timeline`, `get_timeline_visualization`

### v0.4.1: Auto-Documentation & ML Features
- **Auto-Documentation** — автогенерация docs при завершении задач
- **Agent Specialization** — ML-подбор агента по экспертизе
- **Conflict Prediction** — предсказание merge-конфликтов

---

## Возможности

### 🎯 Orchestrator (Центр Управления)
Все файлы координации хранятся в `/orchestrator/`:
- **PULSE.md** — живая карта агентов в реальном времени
- **KNOWLEDGE_BASE.md** — коллективная база знаний
- **briefings/** — ментальные слепки для передачи контекста
- **snapshots/** — снапшоты для отката изменений
- **docs/** — авто-документация
- **sessions/** — записи сессий (v0.5)
- **quality/** — отчёты качества (v0.5)
- **costs/** — логи расходов (v0.5)
- **baselines/** — эталонные метрики (v0.5)
- **specs/** — spec pipelines (v0.7)
- **qa-loops/** — QA loop сессии (v0.7)

### 🤖 Agent Features
- **Уникальные имена** — RadiantWolf, SilentFox и т.д.
- **Специализация** — система запоминает экспертизу каждого агента
- **Ghost Mode** — патрулирование кода когда нет задач
- **Health Monitor** — автоматическое обнаружение "мёртвых" агентов (v0.5)

### 🔄 Collaboration
- **Task Decomposition** — разбиение больших задач на подзадачи
- **Architecture Voting** — голосование для опасных действий
- **Collective Advice** — коллективный мозговой штурм
- **Cross-Platform Check** — проверка UI на разных платформах
- **Session Recording** — запись и replay действий (v0.5)

### 🛡️ Safety
- **Snapshot & Rollback** — откат изменений при ошибках
- **Urgent Preemption** — приоритетный захват файлов для критичных багов
- **Immune System** — автоматическая реакция на падение CI/тестов
- **Conflict Prediction** — предсказание merge-конфликтов
- **Quality Gate** — автопроверки перед merge (v0.5)
- **Regression Detector** — обнаружение ухудшений метрик (v0.5)

### 💰 Observability (v0.5)
- **Cost Tracker** — отслеживание расходов на API
- **Context Compressor** — сжатие контекста для экономии токенов
- **Health Summary** — общее состояние swarm

### 🌐 Real-time (Cloudflare Hub)
- WebSocket broadcast между агентами
- Task claim с anti-duplication
- File locks (1 writer, many readers)
- Auction system для задач

---

## 🚀 Quick Start

```bash
# 1. Установка
npm install
npm run build

# 2. Установка в IDE (Windsurf/Cursor/Claude/OpenCode)
npm run install-mcp

# 3. Запуск companion daemon (опционально)
npm run companion
```

---

## 📦 Tools (156+)

### Brainstorming (v0.6)
| Tool | Description |
|------|-------------|
| `start_brainstorm` | Начать сессию brainstorming |
| `ask_brainstorm_question` | Задать вопрос (ONE at a time!) |
| `answer_brainstorm_question` | Записать ответ пользователя |
| `propose_approaches` | Предложить варианты с pros/cons |
| `present_design_section` | Представить секцию (200-300 слов) |
| `validate_design_section` | Валидация секции |
| `save_design_document` | Сохранить в docs/plans/ |
| `get_brainstorm_session` | Статус сессии |
| `list_brainstorm_sessions` | Список сессий |

### Writing Plans (v0.6)
| Tool | Description |
|------|-------------|
| `create_implementation_plan` | Создать TDD план |
| `add_plan_task` | Добавить задачу |
| `get_next_task` | Следующая задача |
| `start_plan_task` | Начать задачу |
| `complete_step` | Завершить TDD шаг |
| `complete_plan_task` | Завершить задачу |
| `generate_subagent_prompt` | Промпт для субагента |
| `export_plan_as_markdown` | Экспорт в MD |
| `get_plan_status` | Статус плана |
| `list_plans` | Список планов |
| `mark_plan_ready` | Готов к выполнению |

### Systematic Debugging (v0.6)
| Tool | Description |
|------|-------------|
| `start_debug_session` | Phase 1: Investigation |
| `log_investigation` | Логировать анализ |
| `add_evidence` | Добавить evidence |
| `complete_phase_1` | → Phase 2 |
| `log_patterns` | Working examples |
| `complete_phase_2` | → Phase 3 |
| `form_hypothesis` | Сформулировать гипотезу |
| `test_hypothesis` | Проверить гипотезу |
| `implement_fix` | Phase 4: Fix |
| `verify_fix` | Верифицировать |
| `get_debug_session` | Статус сессии |
| `list_debug_sessions` | Список сессий |
| `check_red_flags` | Анти-паттерны |

### Agent & Health
| Tool | Description |
|------|-------------|
| `agent_register` | Регистрация агента с уникальным именем |
| `agent_whoami` | Получить информацию о текущем агенте |
| `check_agent_health` | Проверить здоровье агента |
| `get_dead_agents` | Найти "мёртвых" агентов |
| `force_reassign_task` | Переназначить задачу |
| `get_swarm_health_summary` | Общее здоровье swarm |

### Tasks
| Tool | Description |
|------|-------------|
| `task_create` | Создать задачу |
| `task_list` | Список задач |
| `task_assign` | Назначить задачу агенту |
| `task_set_status` | Изменить статус задачи |
| `task_mark_done` | Отметить задачу выполненной |
| `decompose_task` | Разбить задачу на подзадачи |

### Files
| Tool | Description |
|------|-------------|
| `file_reserve` | Заблокировать файл для редактирования |
| `file_release` | Освободить файл |
| `forecast_file_touches` | Анонсировать будущие изменения |
| `check_file_conflicts` | Проверить конфликты |

### Session Recording (v0.5)
| Tool | Description |
|------|-------------|
| `start_session_recording` | Начать запись сессии |
| `log_session_action` | Записать действие |
| `stop_session_recording` | Остановить запись |
| `list_session_recordings` | Список записей |
| `replay_session` | Воспроизвести запись |

### Quality Gate (v0.5)
| Tool | Description |
|------|-------------|
| `run_quality_gate` | Запустить проверки качества |
| `get_quality_report` | Получить отчёт |
| `set_quality_threshold` | Установить пороги |
| `check_pr_ready` | Готовность к merge |

### Cost Tracker (v0.5)
| Tool | Description |
|------|-------------|
| `log_api_usage` | Записать использование API |
| `get_agent_costs` | Расходы агента |
| `get_project_costs` | Расходы проекта |
| `set_budget_limit` | Установить лимит |
| `check_budget_remaining` | Остаток бюджета |

### Context Compressor (v0.5)
| Tool | Description |
|------|-------------|
| `estimate_context_size` | Оценить размер в токенах |
| `compress_briefing` | Сжать briefing |
| `compress_multiple_briefings` | Сжать несколько |
| `get_compression_stats` | Статистика сжатия |

### Regression Detector (v0.5)
| Tool | Description |
|------|-------------|
| `save_baseline` | Сохранить эталон |
| `check_regression` | Проверить регрессии |
| `list_regressions` | Список регрессий |
| `resolve_regression` | Исправить регрессию |
| `list_baselines` | Список эталонов |

### Collaboration
| Tool | Description |
|------|-------------|
| `update_swarm_pulse` | Обновить статус в PULSE.md |
| `save_briefing` | Сохранить ментальный слепок |
| `archive_finding` | Добавить в базу знаний |
| `request_collective_advice` | Запросить помощь |
| `broadcast_chat` | Отправить сообщение всем |
| `request_cross_agent_review` | Запросить ревью |

### Safety
| Tool | Description |
|------|-------------|
| `create_snapshot` | Создать снапшот |
| `trigger_rollback` | Откатить к снапшоту |
| `start_voting` | Начать голосование |
| `trigger_urgent_preemption` | URGENT режим |
| `check_main_health` | Здоровье main ветки |

### Git & GitHub
| Tool | Description |
|------|-------------|
| `worktree_create` | Создать Git worktree |
| `worktree_list` | Список worktrees |
| `sync_with_base_branch` | Rebase на main |
| `create_github_pr` | Создать Pull Request |
| `auto_delete_merged_branch` | Удалить merged ветку |

### Auto-Documentation
| Tool | Description |
|------|-------------|
| `generate_task_docs` | Создать документацию |
| `list_task_docs` | Список документов |
| `get_task_doc` | Получить документ |

### Agent Specialization
| Tool | Description |
|------|-------------|
| `record_agent_edit` | Записать экспертизу |
| `suggest_agent_advanced` | Рекомендовать агента |
| `get_top_experts` | Топ экспертов |

### Conflict Prediction
| Tool | Description |
|------|-------------|
| `analyze_conflict_history` | Анализ истории |
| `get_conflict_hotspots` | Горячие точки |
| `check_file_safety` | Безопасность файла |

---

## 📁 Project Structure

```
/orchestrator/           # Центр управления
  ├── PULSE.md           # Живая карта агентов
  ├── KNOWLEDGE_BASE.md  # База знаний
  ├── EXPERTISE.json     # Специализация агентов
  ├── briefings/         # Ментальные слепки
  ├── snapshots/         # Снапшоты для отката
  ├── advice/            # Запросы на помощь
  ├── docs/              # Авто-документация
  ├── sessions/          # Записи сессий (v0.5)
  ├── quality/           # Отчёты качества (v0.5)
  ├── costs/             # Логи расходов (v0.5)
  ├── baselines/         # Эталонные метрики (v0.5)
  ├── regressions/       # Обнаруженные регрессии (v0.5)
  ├── brainstorm/        # Brainstorm сессии (v0.6)
  ├── plans/             # Implementation планы (v0.6)
  └── debug/             # Debug сессии (v0.6)

/docs/
  └── plans/             # Сохранённые design documents (v0.6)

/swarm/                  # Legacy (совместимость)
  ├── tasks/             # Файлы задач
  ├── agents/            # Регистрации агентов
  ├── locks/             # File locks
  └── EVENTS.ndjson      # Event log

/cloudflare/             # Real-time Hub
  └── src/index.ts       # Durable Object
```

---

## ⚙️ Environment Variables

```bash
SWARM_REPO_PATH=        # Путь к репозиторию
SWARM_HUB_URL=          # URL Cloudflare Hub (ws://...)
SWARM_PROJECT=default   # Имя проекта
SWARM_HYBRID_MODE=true  # WS + Git fallback
```

---

## 🔧 IDE Integration

При запуске `npm run install-mcp` автоматически:
1. Проверяется наличие IDE (исполняемые файлы + стандартные пути)
2. Добавляется MCP конфиг только для установленных IDE
3. Создаются правила агента:
   - `.windsurfrules` (Windsurf)
   - `.cursorrules` (Cursor)
   - `CLAUDE.md` (Claude Desktop)
   - `GEMINI.md` (OpenCode)

**Поддерживаемые IDE:**
- Windsurf
- Cursor
- Claude Desktop
- OpenCode
- VS Code

---

## 📝 Agent Rules

Агенты обязаны:
1. **Сначала** вызвать `agent_register`
2. **Проверить** `task_list` и `get_swarm_pulse`
3. **Заблокировать** файлы через `file_reserve`
4. **Обновлять** статус через `update_swarm_pulse`
5. **Записывать** сессию через `start_session_recording` (рекомендуется)
6. **Сохранить** briefing перед завершением

---

## 🔒 Security

- Токены GitHub/Cloudflare **НЕ** коммитить — используйте env vars
- Voting для опасных действий (delete folder, change core)
- File locks предотвращают конфликты
- Quality Gate проверяет код перед merge

---

## 📊 Metrics (v0.5)

### Cost Tracking
```typescript
// Логирование расходов
log_api_usage({
  agentId: "RadiantWolf",
  model: "claude-3-opus",
  inputTokens: 5000,
  outputTokens: 2000,
  cost: 0.15
});

// Проверка бюджета
check_budget_remaining(); // { remaining: 45.50, limit: 100, used: 54.50 }
```

### Quality Gate
```typescript
// Проверка качества
run_quality_gate({ taskId: "task-123" });
// { score: 85, passed: true, checks: [...] }

// Готовность к PR
check_pr_ready({ taskId: "task-123" });
// { ready: true, blockers: [] }
```

### Regression Detection
```typescript
// Сохранить baseline
save_baseline({
  name: "v0.5.0-release",
  metrics: { bundleSize: 1024000, testCount: 150, coverage: 85 }
});

// Проверить регрессии
check_regression();
// { regressions: [{ metric: "bundleSize", baseline: 1024000, current: 1200000, delta: 17.2% }] }
```

---

## 🧠 Методологии v0.6 (из obra/superpowers)

### Brainstorming
```
1. Вопросы по ОДНОМУ (не списком!)
2. Multiple choice preferred
3. Категории: purpose, constraints, success_criteria, approach, tradeoffs
4. Секции дизайна: 200-300 слов MAX
5. Валидация каждой секции перед следующей
```

### Writing Plans (TDD)
```
1. Bite-sized tasks (2-5 минут каждая)
2. TDD шаги: write_test → run_test (fail) → implement → verify (pass) → commit
3. DRY — не повторяйся
4. YAGNI — не добавляй лишнего
5. Subagent prompts для параллельного выполнения
```

### Systematic Debugging (4 фазы)
```
Phase 1: ROOT CAUSE INVESTIGATION (NO FIXES YET!)
  - Воспроизвести ошибку
  - Собрать evidence (input/output компонентов)
  
Phase 2: PATTERN ANALYSIS
  - Найти working examples
  - Сравнить broken vs working
  
Phase 3: HYPOTHESIS & TESTING
  - Сформулировать конкретную гипотезу
  - Протестировать minimal reproduction
  
Phase 4: IMPLEMENTATION
  - Исправить root cause
  - Верифицировать fix
```

**Iron Law:** NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST

---

## License

MIT
