# Architecture

## Overview

xstate-migrate exposes two functions via the `XStateMigrate` interface:

1. **`generateMigrations(machine, persistedSnapshot, input?)`** — Compares a persisted snapshot against a new machine version and produces JSON Patch operations.
2. **`applyMigrations(persistedSnapshot, migrations)`** — Deep-clones a snapshot and applies the patch operations.

## Algorithm: generateMigrations

### Phase 1: Context diffing (lines 29-38)

```
persistedContext  ──┐
                    ├── fast-json-patch compare() ──→ filter to "add" only ──→ prepend "/context"
initialContext   ──┘
```

- Compares persisted context against the new machine's initial context
- Only `add` operations pass the filter — existing properties are NEVER removed or replaced
- Each operation path is prefixed with `/context` for the snapshot structure

### Phase 2: State validation (lines 40-78)

```
machine.idMap ──→ getValidStates() ──→ Set of valid paths (dots replaced with /)
                                            │
persistedSnapshot.value ──→ handleStateValue() ──→ recursive walk
                                                      │
                                            ┌─────────┴──────────┐
                                      Object branch         String branch
                                    (nested regions)      (leaf state name)
                                            │                    │
                                    forEach child key     validate path
                                            │             (with dot replacement)
                                    if child is string:
                                      validate path
                                      (with dot replacement)
                                    else:
                                      recurse deeper
```

**Critical detail**: Both branches must apply `.replace(/\./g, '/')` when constructing lookup paths, because `getValidStates` replaces dots in idMap keys. See ADR `2026-03-15-dot-replacement-consistency.md`.

### Phase 3: Combine operations (line 82)

Value operations (state replacements) come first, then context operations (property additions).

## Algorithm: applyMigrations

1. Deep clone via `JSON.parse(JSON.stringify(persistedSnapshot))`
2. Apply all operations via `fast-json-patch.applyPatch()`
3. Return the cloned, patched snapshot

## Internal dependencies

- **`machine.idMap`** — Undocumented XState internal. A `Map<string, StateNode>` where keys are dot-separated state paths (e.g., `"my.app.auth.idle"`). Guarded with runtime type checking (lines 6-15).
- **`fast-json-patch`** — RFC 6902 implementation for compare and apply operations.

## State value shapes

XState snapshots have `.value` in one of these shapes:

| Shape | Example | When |
|-------|---------|------|
| String | `"idle"` | Simple machine, top-level state |
| Object (nested) | `{ parent: "child" }` | Compound state |
| Object (parallel) | `{ regionA: "s1", regionB: "s2" }` | Parallel regions |
| Object (deep) | `{ parent: { child: "grandchild" } }` | Multi-level nesting |
