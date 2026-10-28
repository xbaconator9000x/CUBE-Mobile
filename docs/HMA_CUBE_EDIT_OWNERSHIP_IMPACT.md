# CUBE combined-edit ownership impact preflight

`auditHmaCubeEditOwnershipImpact` in `src/hma-cube-edit-ownership-impact.js`
correlates **actually changed bytes** from an independently validated, in-memory
combined CUBE map transaction against the explicitly counted cross-bank map
header/layout/blockmap and event-group/array claims.

This is a conservative diagnostic for edits that could unexpectedly affect
other maps. It is **not a ROM writer** or an exclusive-ownership proof.

## Source and scope

- Pinned upstream: `kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc`,
  `src/HexManiac.Core/Models/Map/MapModel.cs` and the CUBE Emerald metadata DSL.
- Calls the existing source-grounded cell, warp and event preflights and the
  full combined in-memory re-decode/rollback verifier before evaluating claims.
- Requires an explicit 1–8 bank, 256-map maximum census including the source
  bank and its exact map count. Event-array inspection is mandatory.
- Checks each changed byte, rather than treating an unchanged field in an
  eight-byte warp record as a modification.
- Reports source-map claim intersections with other maps, including the kind
  of edited field and the number of affected bytes. Reports invalid map
  slots and event-array failures as incomplete evidence.
- Does not return a modified ROM, raw byte patches, or ROM data. A report
  with no intersections means **only** that none were found within the
  bounded declared subset.

## Important safety boundary

The census does **not** enumerate all ROM pointers, dynamic/undeclared banks,
script references, engine extensions or metadata aliases. Consequently,
`partialCoverage` is always true and `exclusiveOwnershipProven`,
`globalPointerOwnershipProven`, `independentRomIdentityVerified`,
`authenticSaveReopenVerified`, and `writeAuthorized` remain false.

Do not use this report as a boolean gate to enable save-as. Real CUBE ROM/TOML
provenance, complete alias graph, collision semantics, transactional save/reopen,
emulator verification and Android device acceptance are still required.

The synthetic tests cover disjoint claims, a second map sharing a warp array,
invalid maps, unsupported event arrays, stale proposals and immutable source
bytes. They do not count as genuine CUBE compatibility evidence.
