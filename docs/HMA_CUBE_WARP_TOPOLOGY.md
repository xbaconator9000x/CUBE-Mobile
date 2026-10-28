# CUBE custom warp topology audit — mobile checkpoint

The **Named Data → CUBE custom map → Inspect event/warp records** workflow
now includes a bounded **Audit all raw map warps** action. Enter explicit
destination-bank counts as `bank:map-count`, for example `0:12,1:9`.
The audit checks up to 32 source-map warp records and up to eight declared
destination banks, with a maximum of 1024 declared maps per bank.

The report distinguishes a destination warp that points back to the
**origin map** from one that points to the **same origin warp index**.
It also highlights raw out-of-bounds source/arrival coordinates, duplicate
source coordinates, unresolved or special targets and undeclared destination
counts. Tap a finding to revalidate the entire raw topology against the
current staged ROM and navigate to the exact source record in Hex.

Source: pinned CUBHMA `src/HexManiac.Core/Models/Map/MapModel.cs`,
`BlockCells`, `WarpEventModel`, and CUBE Emerald custom event DSL.
The target map count is **not** inferred from pointer contents. A raw
reciprocal link does not establish collision passability, scripted warp
behavior, emulator traversal, Android acceptance or ROM authentication.

All operations remain read-only. No semantic ROM writes, ROM asset
commits or strict feature-parity credit are authorized by this checkpoint.
