# 🐝 MCP Swarm Hub

Координационный хаб для синхронизации агентов в реальном времени.

## Endpoints

| Endpoint | Описание |
|----------|----------|
| `/ws?project=<uid>` | WebSocket для агентов |
| `/github/webhook` | GitHub webhooks |
| `/api/*` | REST API |

## Деплой

```bash
cd cloudflare/hub
npx wrangler deploy
```

**Уже задеплоен:** `wss://mcp-swarm-hub.unilife-ch.workers.dev/ws`

## Durable Objects

- `SwarmRoom` — состояние проекта (задачи, блокировки, пульс)
