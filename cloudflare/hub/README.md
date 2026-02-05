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
npx wrangler login
npx wrangler deploy
```

После деплоя вы получите URL вида: `wss://mcp-swarm-hub.YOUR-SUBDOMAIN.workers.dev/ws`

Этот URL нужно будет указать в:
- `cloudflare/mcp-server/wrangler.toml` → `HUB_URL`
- `cloudflare/telegram-bot/wrangler.toml` → `SWARM_HUB_URL`
- `dashboard/.env` → `NEXT_PUBLIC_HUB_URL`

## Durable Objects

- `SwarmRoom` — состояние проекта (задачи, блокировки, пульс)
