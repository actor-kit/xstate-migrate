# Testing Strategy

## Philosophy

- **TDD**: Red-green-refactor for all changes
- **Mutation testing**: Stryker validates test quality; dedicated "mutation testing survivors" test suite kills escaped mutants
- **Formal verification**: TLA+ models for algorithm-level invariant checking
- **No mocks**: Tests use real XState machines and actors

## Test structure

All tests in `src/migrate.test.ts`:

| Suite | Tests | Purpose |
|-------|-------|---------|
| XState Migration | 11 | Core behavior: context diffing, state validation, nesting, parallel |
| Mutation testing survivors | 8 | Kill specific Stryker mutants: null guards, typeof branches, dotted IDs |
| Typed input | 1 | Machines with `setup()` and runtime dependency injection |

## Key test patterns

### Real machines over fixtures
Tests create real XState machines with `createMachine()`, start actors, transition states, and snapshot — not hand-crafted JSON. This catches issues with actual XState behavior.

### Cast snapshots for edge cases
For testing invalid/weird states that can't be reached through normal machine transitions, tests cast to `AnyMachineSnapshot`:
```typescript
const snapshot = { context: {}, value: { region: 'removed' }, status: 'active' } as unknown as AnyMachineSnapshot;
```

### Mutation survivor tests
When Stryker finds surviving mutants, a targeted test is added to the "Mutation testing survivors" suite with a comment referencing the specific line/condition being tested.

## TLA+ formal verification

TLA+ specs live in `docs/tlaplus/`. They model algorithm invariants that are hard to test exhaustively:

| Spec | States checked | What it verifies |
|------|---------------|------------------|
| DotReplaceBug.tla | 16 | Path construction consistency between object/string branches |
| ContextPreservation.tla | 512 | Add-only filter preserves all persisted context keys |
| StateTraversal.tla | 90 | Valid states preserved, invalid states replaced, no extras |

### Running TLA+ specs

```bash
java -cp /path/to/tla2tools.jar tlc2.TLC SpecName -config SpecName.cfg -workers auto
```

## Stryker configuration

- **Mutate**: `src/**/*.ts` (excluding tests and index)
- **Thresholds**: high=90, low=80, break=70
- **Runner**: Jest
- **Checker**: TypeScript
