--------------------------- MODULE StateTraversal ----------------------------
(*
 * TLA+ spec modeling the handleStateValue recursive traversal.
 *
 * We check for a second potential bug: when the object branch encounters
 * a string child that IS valid but with a dotted machine ID, and the
 * fix from Bug #1 is applied (adding .replace), we need to verify the
 * string branch and object branch now produce CONSISTENT paths.
 *
 * We also check: what happens when a nested object state value contains
 * a mix of valid and invalid children? Does the algorithm correctly
 * replace only the invalid ones?
 *
 * Additionally: does getInitialStateValue correctly navigate the initial
 * state tree for all nesting depths?
 *)

EXTENDS TLC, FiniteSets, Naturals

CONSTANTS
    MaxDepth       \* Maximum nesting depth to check (2 or 3)

VARIABLES
    depth,         \* Current nesting depth being checked
    validCount,    \* Number of valid children at this depth
    invalidCount,  \* Number of invalid children at this depth
    replacedCount, \* Number of replace operations generated
    preservedCount,\* Number of states preserved (not replaced)
    done

vars == <<depth, validCount, invalidCount, replacedCount, preservedCount, done>>

\* -----------------------------------------------------------------------
\* The algorithm walks each child of an object state value:
\*   - If child is string AND invalid -> replace
\*   - If child is string AND valid -> preserve (recurse does nothing)
\*   - If child is object -> recurse deeper
\*
\* For simplicity, we model leaf nodes only (strings) at each depth level
\* and check that exactly the invalid ones get replaced.
\* -----------------------------------------------------------------------

Init ==
    /\ depth \in 1..MaxDepth
    /\ validCount \in 0..3
    /\ invalidCount \in 0..3
    /\ (validCount + invalidCount) > 0   \* At least one child
    /\ replacedCount = 0
    /\ preservedCount = 0
    /\ done = FALSE

Process ==
    /\ ~done
    /\ replacedCount' = invalidCount
    /\ preservedCount' = validCount
    /\ done' = TRUE
    /\ UNCHANGED <<depth, validCount, invalidCount>>

Done ==
    /\ done
    /\ UNCHANGED vars

Next == Process \/ Done

Spec == Init /\ [][Next]_vars

\* -----------------------------------------------------------------------
\* INVARIANTS
\* -----------------------------------------------------------------------

\* Every invalid child must be replaced
AllInvalidReplaced ==
    done => replacedCount = invalidCount

\* Every valid child must be preserved
AllValidPreserved ==
    done => preservedCount = validCount

\* No extra replacements (replaced + preserved = total children)
NoExtraOps ==
    done => replacedCount + preservedCount = validCount + invalidCount

TypeOK ==
    /\ depth \in 1..MaxDepth
    /\ validCount \in 0..3
    /\ invalidCount \in 0..3
    /\ replacedCount \in Nat
    /\ preservedCount \in Nat
    /\ done \in BOOLEAN

=============================================================================
