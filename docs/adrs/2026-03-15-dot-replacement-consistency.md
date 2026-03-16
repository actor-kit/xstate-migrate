# Dot Replacement Consistency in State Path Lookups

**Date:** 2026-03-15
**Status:** Accepted

## Context

The `handleStateValue` function has two code paths for validating persisted state values:

1. **Object branch** (line 55): Handles nested state objects where children are strings
2. **String branch** (line 68): Handles top-level string state values

Both construct a lookup path and check it against `validStates`, which is built from `machine.idMap` keys with dots replaced by slashes (line 12).

The string branch applied `.replace(/\./g, '/')` to its lookup path, but the object branch did not. This meant that for machines with dotted IDs (e.g., `id: "my.app"`), the object branch constructed `"my.app/auth/idle"` while the valid set contained `"my/app/auth/idle"`. The lookup failed, causing **valid states to be incorrectly replaced**.

## Decision

Add `.replace(/\./g, '/')` to the object branch path construction (line 55) to match the string branch and `getValidStates`.

## Discovery

Found via TLA+ formal verification (`DotReplaceBug.tla`). The model explored 16 states and flagged the invariant violation. Confirmed with a failing TypeScript test using `id: "my.app"` with parallel regions.

## Consequences

- Machines with dotted IDs now work correctly for nested/parallel state validation
- Both code paths are consistent with the valid states set construction
- The existing test for dotted IDs (line 521) only covered the string branch — two new tests added for object branch coverage at multiple nesting depths
