# xstate-migrate

Migration library for persisted XState v5 state machine snapshots. Generates and applies JSON Patch (RFC 6902) operations to evolve snapshots from one machine version to another.

## Stack

TypeScript, XState v5 (peer dep), fast-json-patch, Jest, Stryker, TLA+

## Feedback commands

Run in order; all must pass before committing:

1. `pnpm test` — Jest unit tests
2. `pnpm test:coverage` — Jest with 80% coverage threshold
3. `pnpm test:mutate` — Stryker mutation testing (break at 70%)

## Knowledge base

Do NOT load all docs upfront. Read this file, then load the specific doc relevant to your current task.

| Topic | Location | Load when |
|-------|----------|-----------|
| Architecture & algorithm | [docs/architecture.md](docs/architecture.md) | Understanding how migration works |
| Testing strategy | [docs/testing-strategy.md](docs/testing-strategy.md) | Writing or modifying tests |
| TLA+ formal verification | [docs/tlaplus/](docs/tlaplus/) | Running or writing TLA+ specs |
| ADRs | [docs/adrs/](docs/adrs/) | Making structural decisions; check precedent |

## Core principles

1. **Context preservation** — Never remove or modify existing context properties. Only `add` operations are generated.
2. **State validity** — Invalid states (removed in new machine version) are replaced with initial values. Valid states are never touched.
3. **Path consistency** — All state path lookups must use the same dot-replacement strategy as `getValidStates` (idMap keys with dots replaced by slashes).
4. **Snapshot immutability** — `applyMigrations` deep-clones before patching. The original snapshot is never mutated.

## Key conventions

- **Single source file**: Core logic lives in `src/migrate.ts` (~92 lines). Keep it small.
- **Types**: `src/types.ts` defines the `XStateMigrate` interface.
- **Tests**: `src/migrate.test.ts` — 3 describe blocks: core migrations, mutation testing survivors, typed input.
- **Internal API access**: Uses `machine.idMap` (undocumented XState internal). Guarded with runtime type check.
- **Peer dependency**: XState `^5.28.0` is a peer dep — consumers provide it.

## Keeping docs current

| If you change... | Then update... |
|------------------|----------------|
| Migration algorithm in `migrate.ts` | `docs/architecture.md` |
| Test strategy or test structure | `docs/testing-strategy.md` |
| A structural decision | Add an ADR in `docs/adrs/` |
| Stack, conventions, or principles | This file (`CLAUDE.md`) |

## Off-limits

- Do NOT use `--no-verify` on git hooks
- Do NOT commit credentials or API keys
- Do NOT modify `machine.idMap` access pattern without understanding XState internals

## Git

- Main branch: `main`
- Remote: `git@github.com:actor-kit/xstate-migrate.git`
