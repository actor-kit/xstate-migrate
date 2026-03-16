--------------------------- MODULE DotReplaceBug -----------------------------
(*
 * TLA+ spec: path construction consistency in xstate-migrate.
 *
 * handleStateValue has TWO code paths:
 *
 * OBJECT BRANCH (line 55):
 *   `${machine.id}${newPath}/${stateValue[key]}`
 *   NO dot replacement on machine.id
 *
 * STRING BRANCH (line 68):
 *   `${machine.id}${path}/${stateValue}`.replace(/\./g, '/')
 *   Dots replaced with slashes
 *
 * getValidStates (line 12) builds valid set via:
 *   key.replace(/\./g, '/')    (dots replaced)
 *
 * HYPOTHESIS: For dotted machine IDs, object branch produces paths
 * that don't match the valid states set.
 *)

EXTENDS TLC, Sequences, FiniteSets, Naturals

CONSTANTS
    RegionKeys,    \* e.g. {"auth", "nav"}
    StateNames     \* e.g. {"idle", "active"}

VARIABLES
    hasDottedId,   \* Whether machine ID contains dots
    region,
    state,
    objectResult,  \* Path built by object branch
    validResult,   \* Path in valid states set
    bugFound,
    done

vars == <<hasDottedId, region, state, objectResult, validResult, bugFound, done>>

\* -----------------------------------------------------------------------
\* For a simple ID like "app":
\*   idMap key: "app.auth.idle"  ->  replace dots  ->  "app/auth/idle"
\*   Object branch: "app" + "/auth" + "/idle"  =  "app/auth/idle"
\*   These MATCH.
\*
\* For a dotted ID like "my.app":
\*   idMap key: "my.app.auth.idle"  ->  replace dots  ->  "my/app/auth/idle"
\*   Object branch: "my.app" + "/auth" + "/idle"  =  "my.app/auth/idle"
\*   These DON'T MATCH! The dot in "my.app" is preserved.
\*
\* We model as path segment counts:
\*   Simple ID "app" = 1 segment
\*   Dotted ID "my.app" after dot-replace = 2 segments
\*   Object branch with dotted ID = 1 segment (dots NOT split)
\* -----------------------------------------------------------------------

\* Number of segments in the path
\* validPath: id_segments + 1 (region) + 1 (state)
\* objectPath: 1 (raw id, even if dotted) + 1 (region) + 1 (state)

SimpleIdSegments == 1
DottedIdSegments == 2   \* "my.app" -> "my" + "app" after dot replacement

ValidSegmentCount(isDotted) ==
    IF isDotted THEN DottedIdSegments + 2
    ELSE SimpleIdSegments + 2

ObjectSegmentCount == 1 + 2   \* Always 3: raw_id/region/state (dots preserved)

\* -----------------------------------------------------------------------
Init ==
    /\ hasDottedId \in BOOLEAN
    /\ region \in RegionKeys
    /\ state \in StateNames
    /\ objectResult = 0
    /\ validResult = 0
    /\ bugFound = FALSE
    /\ done = FALSE

Check ==
    /\ ~done
    /\ validResult' = ValidSegmentCount(hasDottedId)
    /\ objectResult' = ObjectSegmentCount
    /\ bugFound' = (ObjectSegmentCount /= ValidSegmentCount(hasDottedId))
    /\ done' = TRUE
    /\ UNCHANGED <<hasDottedId, region, state>>

Next == Check

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

\* -----------------------------------------------------------------------
\* INVARIANT: object branch path must match valid states set path
\* -----------------------------------------------------------------------
NoBug == done => ~bugFound

TypeOK ==
    /\ hasDottedId \in BOOLEAN
    /\ region \in RegionKeys
    /\ state \in StateNames
    /\ bugFound \in BOOLEAN
    /\ done \in BOOLEAN

=============================================================================
