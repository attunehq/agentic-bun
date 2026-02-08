Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## Type Safety

This project enforces maximal type safety:

- **Parse, don't validate**: Always use zod schemas to parse external data. Never trust data at runtime without parsing it through a schema first.
- **No type assertions**: Never use `as`, `!`, or `<Type>` casts. The biome plugin `biome-plugin-no-type-assertion` enforces this. Use `satisfies` when you need to check a value matches a type without widening it.
- **No `any`**: Never use `any` type. Use `unknown` and parse with zod instead.
- **Strict tsconfig**: All strict flags are enabled, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Fix type errors properly, don't suppress them.
- **Zod v4 import**: Always `import { z } from "zod/v4"`, not `from "zod"`. The bare `"zod"` import resolves to a v3 compatibility shim.
- **Optional fields with `exactOptionalPropertyTypes`**: Use conditional spreading to build objects with optional fields: `...(value !== undefined ? { key: value } : {})`. This avoids assigning `undefined` to optional properties, which `exactOptionalPropertyTypes` forbids.

## Module-Level `claude.md` Files

This project uses progressive context loading via `claude.md` files at multiple directory levels. The root `CLAUDE.md` (this file) covers project-wide concerns. As modules grow, add a lowercase `claude.md` alongside the code it describes.

**When to create one**: When a directory has conventions, design decisions, or gotchas that an agent working in that area needs to know -- but that would be noise for every other part of the codebase.

**What goes in them**:

- The module's role and design constraints (e.g., "the harness is plumbing, not policy")
- Patterns specific to that module (e.g., "each tool is an atomic API primitive, one action per tool")
- Which docs to update when changing code in this module

**What stays in the root CLAUDE.md**: Project-wide tooling, type safety rules, project structure overview, and the expansion table. If it applies everywhere, it belongs here.

**Naming**: Root file is uppercase `CLAUDE.md`. Module files are lowercase `claude.md`. Both Claude Code and OpenCode discover them automatically when navigating into a directory.

**Keep them small**: A module `claude.md` should be 15-30 lines. If it's getting long, the module itself may need splitting.

## Code Style

- **Tabs** for indentation, **double quotes**, **semicolons always**.
- Biome handles formatting and linting. Run `bun run check` before committing.
- Prettier is only used for markdown files.
- Use `Reflect.get()` for dynamic property access on `unknown` values instead of type assertions.

## Logging and CLI Output

Two separate concerns -- don't mix them:

- **Structured logging** (`src/logger.ts`): Use Pino for operational logs (startup, errors, diagnostics). Call `createLogger("module-name")` for a child logger scoped to your module. Logs go to stderr as pretty-printed lines in dev, JSON in production. Control verbosity with `LOG_LEVEL` env var.
- **User-facing output** (`chalk`): Use chalk for CLI output that humans read -- command results, status messages, formatted reports. Write to stdout with `console.log`. Use `chalk.bold` for emphasis, `chalk.dim` for secondary info, `chalk.red`/`chalk.yellow`/`chalk.green` for severity.

## Project Structure

```
src/
  cli.ts              # Entrypoint. CLI argument parsing and dispatch.
  cmd/                # Command definitions (thin -- args + handler, delegate to library code)
  clients/            # External API clients (each with its own Zod schemas)
    retry.ts          # Shared retry with exponential backoff for all API clients
```

## Module Layout

Each domain gets a folder under `src/`. Inside a module:

- **`index.ts`** is the public API. It exports the module's primary callable (a class, function, or factory) plus any types other modules need. External consumers import from `@/module-name`, never from internal files.
- **Supporting files** split out distinct concerns alongside `index.ts`: `types.ts` for interfaces, `schemas.ts` for Zod schemas, domain-specific files for groups of related functionality (e.g., `messages.ts`, `channels.ts`).
- **`index.ts` wires things together.** It imports from siblings, composes them, and exposes a minimal surface. Don't re-export internal helpers or implementation details.

When another module needs a specific internal function (not the primary entrypoint), import by full path (`@/agent/summarizer.ts`) rather than re-exporting through `index.ts`. Keep the public surface small; use direct paths for the exceptions.

## CLI

Uses `cmd-ts` for argument parsing with hierarchical subcommands. Commands in `src/cmd/` should be thin: define arguments and call library code. Business logic belongs in `src/clients/`, `src/lib/`, or domain-specific modules.

## Adding a New Command

1. Create `src/cmd/my-command.ts` exporting a `command({...})` from `cmd-ts`.
2. Import and register it in `src/cli.ts` under the appropriate subcommand group.

## Adding an API Client

1. Create `src/clients/my-service.ts`.
2. Define Zod schemas for all API responses in the same file.
3. Use `withRetry()` from `src/clients/retry.ts` for all HTTP calls.
4. Read API keys from `process.env` (Bun auto-loads `.env`).
5. Add the env var to `.env.example`.

## Expanding the Project

Common additions and where they go:

| Addition | Package | Location |
|---|---|---|
| HTTP server (Hono) | `hono` | `src/server/` with `index.ts` entry, `routes/` for route modules |
| React frontend | `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite` | Consider a `packages/` monorepo split or `src/web/` with its own `vite.config.ts` |
| Claude Agent SDK | `@anthropic-ai/claude-agent-sdk` | `src/agent/` for agent loop, prompt, sub-agents |
| Slack bot | `@slack/bolt`, `@slack/web-api` | `src/harness/` for connection management, `src/tools/` for MCP tool servers |
| Scheduled tasks | `croner` | `src/events/` with Zod schemas for event types |
