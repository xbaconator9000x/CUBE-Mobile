# Vanilla queued-change structural impact audit

This is a **read-only** preflight for the existing queued blockmap, warp and event record previews. It follows the explicitly declared vanilla RSE/FRLG map-bank table using the current staged ROM reader, checks each queued original byte, and re-resolves all declared map pointers before reporting impact.

For every proposed record it reports the total number of maps whose known structures own the same bytes, a bounded list of bank/map references, and intersections with other known map structures (headers, layouts, blockmaps, event arrays and map-pointer tables). Shared pointers are not inherently corrupt; they are warnings that a future edit would affect more than one map. Cross-structure overlaps are more serious and must block semantic editing until independently resolved.

The audit is grounded in pinned CUBHMA `MapModel.cs` vanilla map and event format declarations. It deliberately does **not** authenticate CUBE layout variants, complete free-space ownership, script reachability, ROM identity, or runtime collision behavior. A clean report is not a write permit. No bytes are applied or exported.

API: `auditVanillaChangeImpact(source,atlas,previews,{maxChanges,maxBytes,maxOwners,maxConflicts})`. Synthetic tests cover independent and shared owners, cross-map overlap, stale bank pointers, forged provenance, bounded output and immutable staged-reader behavior. A separate mobile UI integration is required before this can be used from the offline app.
