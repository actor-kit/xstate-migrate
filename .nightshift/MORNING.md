# Morning Briefing — 2026-03-15

## Summary
TLA+ formal verification found 1 real bug in xstate-migrate. Fixed and tested. 3 TLA+ specs created, all invariants verified.

## What was done

### BUG FOUND & FIXED: Dotted machine ID breaks object branch state validation
- **Root cause**: `handleStateValue` line 55 constructed validation paths as `${machine.id}${newPath}/${stateValue[key]}` WITHOUT replacing dots, but `getValidStates` (line 12) builds paths WITH dots replaced. For `id: "my.app"`, the lookup was `"my.app/auth/idle"` but the valid set contained `"my/app/auth/idle"`.
- **Impact**: Any machine with dots in its ID (e.g. `"my.app"`, `"a.b.c"`) would have ALL nested object-branch states incorrectly flagged as invalid and reset to initial values. Only top-level string states (string branch, line 68) worked correctly with dotted IDs.
- **Fix**: Added `.replace(/\./g, '/')` to line 55 of `src/migrate.ts`
- **Tests**: 2 new tests added (parallel + deeply nested with dotted IDs). 20/20 passing.

### TLA+ Specs Created
1. `specs/DotReplaceBug.tla` — Path construction consistency. **Found the bug.**
2. `specs/ContextPreservation.tla` — Add-only filter invariant. 512 states, all clean.
3. `specs/StateTraversal.tla` — Nested valid/invalid child handling. 90 states, all clean.

## What needs your attention
- The existing test "should handle machine IDs with dots correctly" (line 521) only tested the **string branch** — it used `value: 'removed'` and `value: 'idle'` (top-level strings). It never exercised the object branch with `value: { region: 'state' }`. That's why this bug wasn't caught earlier.
- Consider whether any users might have hit this bug with dotted machine IDs in production.

## Test results
- Unit: 20 passing (2 new)
- Typecheck: not run (no tsconfig changes)
- TLA+ models: 3 specs, ~870 states explored, 1 invariant violation found
