# Touchscreen CUBE raw connection editing queue

The CUBE mobile and generated offline interfaces now expose a separate
**raw connection record** queue. After inspecting a CUBE map, load a connection
index, review its five exact raw fields, optionally edit direction (u32),
displacement (u32), target bank/map (u8 each) and unused (u16), then queue
up to 32 distinct records. The queue uses the pinned CUBHMA 12-byte format,
requires stale-original validation, and offers atomic virtual preview and
isolated full-ROM rollback verification.

Destination bank:map-count declarations are explicit and informational.
The UI does not assert that a direction or offset is traversable, that a
destination landing tile exists, or that the ROM is authenticated.

The new queue is deliberately **separate** from the existing cell/warp/event
combined rehearsal. It is not included in a persisted ROM transaction and
does not expose save-as or patch bytes. Shared connection-array ownership
can be inspected through the separate cross-bank ownership controls.
Future work must unify all kinds under a globally ownership-checked,
authenticated transaction and verify save/reopen in an emulator and Android
device before enabling semantic ROM writing.

Pinned source: `kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc`
`MapModel.cs`.
