# Nightshift: TLA+ Formal Verification — 2026-03-15

## Backlog
1. [x] Model handleStateValue recursive state validation in TLA+
2. [x] Model path construction and verify dot-replacement consistency
3. [x] Model context migration with add-only filter invariant
4. [x] Model parallel state region handling
5. [x] Report all bugs/invariant violations found

## Progress

### Task 1+2: DotReplaceBug.tla — Path construction consistency
- **BUG FOUND**: Object branch (line 55) did NOT replace dots in machine ID
- TLC counterexample: `hasDottedId=TRUE`, objectResult=3 segments, validResult=4 segments
- Confirmed with failing test: machine `id: "my.app"` with `{auth: "idle", nav: "home"}` generates spurious replace operations
- **Fix**: Added `.replace(/\./g, '/')` to line 55

### Task 3: ContextPreservation.tla — Add-only filter invariant
- 512 states checked across all combinations of 4 keys
- All invariants hold: PersistedKeysPreserved, OnlyAddOps, AddedKeysCorrect
- **No bugs found** — context preservation logic is correct

### Task 4: StateTraversal.tla — Nested state correctness
- 90 states checked across depths 1-3 with 0-3 valid/invalid children
- All invariants hold: AllInvalidReplaced, AllValidPreserved, NoExtraOps
- **No bugs found** — traversal logic is correct

### Additional verification
- Added test for deeply nested states with dotted machine IDs
- Confirmed fix works at all nesting depths (depth 2+)
- All 20 tests passing
