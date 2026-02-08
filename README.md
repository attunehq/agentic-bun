# agentic-bun

Opinionated starter for Bun + TypeScript projects built with AI coding agents.

Provides a stable set of conventions, tooling, and agent instructions so you can say "start a new project from [this template](https://github.com/attunehq/agentic-bun)" and get consistent results.

## Quick start

```bash
# Clone and rename
git clone https://github.com/attunehq/agentic-bun.git my-project
cd my-project
rm -rf .git && git init

# Search-and-replace REPLACE_ME with your project name
# (in package.json, src/cli.ts, src/logger.ts)

# Install and verify
bun install
bun run check
bun run src/cli.ts hello --name world
```

## What's included

### Runtime & tooling

- **Bun** as runtime, package manager, and test runner
- **TypeScript** with every strict flag enabled (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.)
- **Biome** for linting and formatting, with [`biome-plugin-no-type-assertion`](https://github.com/nickmccurdy/biome-plugin-no-type-assertion) to enforce zero `as`/`!` casts
- **Prettier** for markdown only
- **Zod v4** for all runtime validation

### Libraries

- **[cmd-ts](https://github.com/Schniz/cmd-ts)** for CLI argument parsing with hierarchical subcommands
- **[Pino](https://github.com/pinojs/pino)** + **pino-pretty** for structured logging (pretty in dev, JSON in production)
- **[Chalk](https://github.com/chalk/chalk)** for user-facing terminal output
- **Shared retry utility** (`src/clients/retry.ts`) with exponential backoff for API clients

### Agent instructions

- **`CLAUDE.md`** at the project root with conventions for type safety, code style, module layout, logging, and how to expand the project
- **`.agents/skills/`** with five skills for Claude Code / OpenCode:
  - `typescript-best-practices` -- type-first development, exhaustive handling, Zod patterns
  - `bun` -- runtime APIs and command mappings
  - `bun-test` -- test runner config, mocking, Jest migration (with reference docs)
  - `authoring-claude-md` -- how to write effective CLAUDE.md files
  - `codebase-documenter` -- generating architecture docs
- **`.claude/skills/`** symlinks to `.agents/skills/` for Claude Code discovery

### Docker

Minimal `Dockerfile` using `oven/bun:1` with a `/data` volume for persistent runtime data.

## Project structure

```
src/
  cli.ts              # Entrypoint -- CLI argument parsing and dispatch
  logger.ts           # Pino logger with createLogger("module") factory
  cmd/                # Command definitions (thin -- define args, call library code)
    hello.ts          # Example command (replace with your own)
  clients/            # External API clients with co-located Zod schemas
    retry.ts          # Shared retry with exponential backoff
```

## Key conventions

These are documented in `CLAUDE.md` for agents, summarised here for humans:

**Type safety** -- No `as`, no `!`, no `any`. Parse external data with Zod. Use `satisfies` instead of `as`. Import Zod as `import { z } from "zod/v4"` (the bare `"zod"` import is a v3 compat shim).

**Module layout** -- Each domain is a folder with `index.ts` as the public API. Supporting files (`types.ts`, `schemas.ts`, domain-specific files) sit alongside. External consumers import from `@/module-name`.

**Logging** -- Pino for structured operational logs (stderr). Chalk for user-facing CLI output (stdout). Don't mix them.

**Commands** -- Thin `cmd-ts` commands in `src/cmd/`. Business logic goes in `src/clients/`, `src/lib/`, or domain modules.

**Progressive context** -- As modules grow, add a lowercase `claude.md` alongside the code to give agents localised context. Keep them 15-30 lines.

## Scripts

```bash
bun run cli           # Run the CLI
bun run dev           # Run with --watch
bun run check         # Typecheck + lint
bun run lint          # Biome check
bun run lint:fix      # Biome check --write
bun run format        # Biome format + Prettier for markdown
bun test              # Run tests
```

## Expanding the project

The `CLAUDE.md` includes a table of common additions (Hono server, React frontend, Claude Agent SDK, Slack bot, scheduled tasks) with recommended packages and directory layout. Point your agent at it.
