# Touchscreen combined-edit ownership impact review

The existing CUBE mobile/offline warp/event batch queues now expose a separate
**Audit changed-byte ownership impact** action alongside the copy-only combined
rollback rehearsal. Enter explicit `bank:map-count` pairs, including the
edited bank. The bounded review checks the actual changed cell/warp/event
bytes against map header, layout, blockmap and event-array claims in those
banks, using `auditHmaCubeEditOwnershipImpact`.

The action revalidates the inspected ROM/map snapshot, queue identity,
rendered-cell source, proposed records, and in-memory combined rollback before
displaying an aggregate result. Queue edits invalidate the prior result. It
reports affected bytes, shared-claim conflicts, undecodable maps and event
arrays, but **never returns modified ROM data or enables a save button**.

This is a partial ownership diagnostic, not a global alias proof. It does not
authenticate CUBE ROM/TOML provenance, validate collision/passability, prove
script-pointer safety, or replace real-ROM save/reopen and emulator/Android
acceptance. The strict 30-family parity score remains unchanged.

Source: pinned `kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc`
`MapModel.cs`, and the existing CUBE metadata hierarchy.
