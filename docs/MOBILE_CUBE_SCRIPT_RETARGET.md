# Touch-first CUBE script-reference queue

The mobile and offline editors now support source-validated script-reference retargeting. Select an object, trigger or script-bearing signpost, load its expected raw pointer, and choose a destination from an existing same-map event. The queue permits up to 32 distinct references, with per-kind preview, copy-only rollback, and inclusion in the five-kind combined map transaction and partial ownership audit.

The original source snapshot is revalidated before actions. Hidden-item signpost unions are rejected. Stale source pointers, invalid targets and duplicate changes fail closed in the core preview. This is **not** a script compiler or persisted ROM editor; no global pointer ownership, ROM identity, emulator behavior or Android hardware acceptance has been established.

Upstream: pinned `kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc`, `Models/Map/MapModel.cs` object, script and signpost formats. Run `npm test` and `npm run build:standalone`; the generated offline checkpoint must remain byte-identical to the checked-in HTML.
