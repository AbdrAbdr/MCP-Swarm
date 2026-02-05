# 🌐 MCP Swarm Server (Remote)

Персональный MCP сервер для удалённого использования MCP Swarm без локальной установки.

## 🚀 Быстрый старт

### 1. Настройка секретов

```bash
cd cloudflare/mcp-server

# Telegram (опционально)
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

### 2. Деплой

```bash
npx wrangler deploy
```

После деплоя вы получите URL вида:
```
https://mcp-swarm-server.YOUR-ACCOUNT.workers.dev
```

### 3. Настройка IDE

**Claude Desktop / Cursor / Windsurf:**
```json
{
  "mcpServers": {
    "mcp-swarm": {
      "url": "https://mcp-swarm-server.YOUR-ACCOUNT.workers.dev/mcp",
      "transport": "sse"
    }
  }
}
```

## 🌉 Auto-Bridge

При первом обращении к проекту MCP автоматически попросит запустить Companion:

```bash
npx mcp-swarm-companion
```

Companion обеспечивает:
- Доступ к локальным файлам
- Поддержку нескольких проектов одновременно
- Работает в фоне

## 📡 Endpoints

| Endpoint | Описание |
|----------|----------|
| `GET /` | Статус сервера |
| `GET /mcp/sse` | SSE stream для MCP |
| `POST /mcp/messages` | Tool calls от IDE |
| `WS /bridge` | WebSocket для Companion |

## 🔐 Секреты

Добавляются через Wrangler CLI:
```bash
npx wrangler secret put <NAME>
```

| Секрет | Описание |
|--------|----------|
| `TELEGRAM_BOT_TOKEN` | Токен вашего Telegram бота |
| `TELEGRAM_CHAT_ID` | Ваш Chat ID для уведомлений |
