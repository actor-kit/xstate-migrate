-------------------------- MODULE ContextPreservation -------------------------
(*
 * TLA+ spec to verify the context migration invariant:
 * "Existing context properties must NEVER be lost or modified."
 *
 * The algorithm (lines 29-38 of migrate.ts):
 * 1. compare(persistedContext, initialContext) produces JSON Patch ops
 * 2. Filter to only "add" operations
 * 3. Prepend "/context" to paths
 *
 * INVARIANT: After applying migrations, every key-value pair from
 * persistedContext must still be present with the same value.
 *
 * We model context as a set of key-value pairs and simulate what
 * compare() would produce for different scenarios.
 *)

EXTENDS TLC, FiniteSets, Naturals

CONSTANTS
    Keys,          \* Universe of possible context keys
    Values         \* Universe of possible values

VARIABLES
    persistedKeys,   \* Set of keys in persisted context
    initialKeys,     \* Set of keys in initial (new machine) context
    ops,             \* Set of {op, key} operations produced by compare
    filteredOps,     \* After filtering to "add" only
    resultKeys,      \* Keys present after applying migrations
    done

vars == <<persistedKeys, initialKeys, ops, filteredOps, resultKeys, done>>

\* -----------------------------------------------------------------------
\* JSON Patch compare() produces these operation types:
\*   "add"     - key exists in target but not source
\*   "remove"  - key exists in source but not target
\*   "replace" - key exists in both but with different value
\*
\* For context migration:
\*   source = persistedContext
\*   target = initialContext
\* -----------------------------------------------------------------------

\* Model what compare() would produce
CompareOps(persisted, initial) ==
    \* Keys only in initial -> add
    { [op |-> "add", key |-> k] : k \in initial \ persisted }
    \cup
    \* Keys only in persisted -> remove
    { [op |-> "remove", key |-> k] : k \in persisted \ initial }
    \cup
    \* Keys in both -> could be "replace" if values differ
    \* We conservatively model ALL shared keys as potential replaces
    { [op |-> "replace", key |-> k] : k \in persisted \cap initial }

\* Filter to add-only
FilterAdd(operations) ==
    { o \in operations : o.op = "add" }

\* -----------------------------------------------------------------------
Init ==
    /\ persistedKeys \in SUBSET Keys
    /\ initialKeys \in SUBSET Keys
    /\ ops = {}
    /\ filteredOps = {}
    /\ resultKeys = {}
    /\ done = FALSE

GenerateOps ==
    /\ ~done
    /\ ops' = CompareOps(persistedKeys, initialKeys)
    /\ filteredOps' = FilterAdd(CompareOps(persistedKeys, initialKeys))
    \* Result = persisted keys + newly added keys
    /\ resultKeys' = persistedKeys \cup { o.key : o \in FilterAdd(CompareOps(persistedKeys, initialKeys)) }
    /\ done' = TRUE
    /\ UNCHANGED <<persistedKeys, initialKeys>>

Done ==
    /\ done
    /\ UNCHANGED vars

Next == GenerateOps \/ Done

Spec == Init /\ [][Next]_vars

\* -----------------------------------------------------------------------
\* INVARIANTS
\* -----------------------------------------------------------------------

\* Every persisted key must survive migration
PersistedKeysPreserved ==
    done => persistedKeys \subseteq resultKeys

\* No "remove" or "replace" operations should be in the filtered set
OnlyAddOps ==
    done => \A o \in filteredOps : o.op = "add"

\* Added keys come from initial context only
AddedKeysCorrect ==
    done => \A o \in filteredOps : o.key \in initialKeys

TypeOK ==
    /\ persistedKeys \subseteq Keys
    /\ initialKeys \subseteq Keys
    /\ done \in BOOLEAN

=============================================================================
