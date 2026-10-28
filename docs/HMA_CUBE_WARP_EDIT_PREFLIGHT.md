# CUBE warp destination transaction preflight

`src/hma-cube-warp-edit-preview.js` adds a source-grounded, **immutable** preview for one 8-byte CUBE Emerald warp record, using the pinned CUBHMA `MapModel.cs` warp layout.

The caller supplies the selected bank/map with an explicit map count, a warp index, **all six expected raw fields** (X, Y, elevation, warp ID, destination map, destination bank), a partial proposed change, and optional explicit destination-bank map counts. The preview refuses stale expected bytes, unsupported fields, malformed counts and proposed coordinates outside the declared source map. It applies the eight bytes only to a virtual read overlay, re-decodes the complete source warp array and confirms all other warp records remain unchanged.

The result compares raw before/after arrival resolution, distinguishing missing destination-bank declarations, special targets, invalid map indexes and resolved raw warp indexes. A resolved raw arrival **does not prove actual game traversal**, collision/passability, correct script behavior, exclusive ownership or emulator compatibility.

The mobile and offline interfaces now expose a raw warp field loader and a virtual before/after destination comparison, with stale-source revalidation before each preview. The UI **cannot write, export or patch a ROM**. It is a validation building block for a future ownership-checked, authenticated transaction editor. The synthetic fixture tests check stale-byte rejection, raw destination changes and unchanged source bytes. Real CUBE ROM/TOML, emulator, Android and save/reopen acceptance are still missing, so strict verified parity remains unchanged.

## Reversible in-memory warp rehearsal

`verifyHmaCubeWarpRecordDryRun` creates a bounded 1–64 MiB isolated ROM snapshot, checks the source for changes during copying, applies only the selected eight-byte warp record, re-decodes the record and raw destination trace, checks all other bytes, rolls back, and confirms the original ROM remains untouched. This is **not** a file save/reopen, authenticated ROM test, ownership proof or authorization to export patched ROM bytes.

## Mobile/offline copy-only rehearsal

After loading a raw CUBE warp and reviewing the virtual destination comparison, the **Verify isolated apply and rollback** button reruns all input/source checks and rehearses the change against a private in-memory copy. The status reports changed bytes, raw re-decode, full rollback and unchanged source. The button never writes or exports a ROM and cannot prove genuine CUBE game compatibility, real file save/reopen or Android hardware acceptance.
