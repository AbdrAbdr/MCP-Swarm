# Contributing to MCP Swarm

Thank you for your interest in contributing to MCP Swarm! 🐝

## Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/MCP-Swarm.git
   cd MCP-Swarm
   ```
3. **Install** dependencies:
   ```bash
   npm install
   ```
4. **Build** the project:
   ```bash
   npm run build
   ```

## Development

```bash
# Run Smart Tools server (default)
npm run dev

# TypeScript check
npx tsc --noEmit

# Build
npm run build
```

## Project Structure

```
src/
├── smartTools/          # 9 modular Smart Tool files
│   ├── index.ts         # Central re-export
│   ├── core.ts          # Agent, control, pulse, companion
│   ├── tasks.ts         # Task, plan, briefing, spec
│   ├── files.ts         # File locking, worktree, snapshot
│   ├── git.ts           # Git operations, hooks
│   ├── collaboration.ts # Chat, messaging, review, voting
│   ├── security.ts      # Defence, consensus, MCP scanning
│   ├── analytics.ts     # Cost, quality, regression, session
│   ├── intelligence.ts  # SONA, MoE, vector, booster, context
│   └── infra.ts         # Health, immune, external, platform
├── serverSmart.ts       # MCP Server entry point
├── workflows/           # Feature modules (SONA, MoE, HNSW, etc.)
├── integrations/        # Telegram bot
└── remote/              # stdio → HTTP proxy
cloudflare/              # Cloudflare Workers (Hub, Server, Telegram)
dashboard/               # Next.js dashboard
```

## Pull Request Guidelines

1. **Branch** from `main` for features, `develop` for WIP
2. **One PR per feature** — keep changes focused
3. **TypeScript** — ensure `npx tsc --noEmit` passes
4. **Test** your changes locally before submitting
5. **Describe** what your PR does and why

## Adding a New Smart Tool

1. Choose the appropriate module in `src/smartTools/` (or create a new one)
2. Follow the existing pattern: `registerTool()` with `action` enum
3. Add the tool to `src/smartTools/index.ts` exports
4. Update `README.md` and `README.ru.md` tool lists

## Code Style

- TypeScript strict mode
- Meaningful variable/function names
- JSDoc comments for public APIs
- Use `zod` for input validation (pinned to `3.23.8`)

## Reporting Issues

- Use [GitHub Issues](https://github.com/AbdrAbdr/MCP-Swarm/issues)
- Include: Node.js version, OS, reproduction steps
- For security issues, email directly (do not create public issues)

## License

By contributing, you agree that your contributions will be licensed under the project's ISC License.
