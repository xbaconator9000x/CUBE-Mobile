# Mobile raw-cell census

After loading a ROM, supply an independently established vanilla RSE/FRLG
bank-table offset and exact bank map counts. Inspect the declared atlas, then
tap **Count raw map-cell high bits across declared maps**.

The mobile scan is bounded to 128 maps and 65,536 unique physical cells.
It validates the current canonical map pointers and layout dimensions,
counts exact shared blockmaps once physically, and reports raw six-bit values
across the entire declared atlas. If the budget is exceeded, the operation
fails instead of presenting partial totals. The list shows the first 32
maps; aggregate totals remain complete. Tap a map to inspect its blockmap
bytes in the hex viewer; the scan and declarations are revalidated first.

The same control is included in the standalone offline HTML. These are
**raw collision/elevation high bits**, not validated walkability or
authenticated CUBE collision behavior. No ROM writing is enabled. For larger
declarations, use the local SHA-256-checked smoke CLI with
`"scanRawCellCensus": true`, which emits aggregate counts without raw ROM
bytes or pointer offsets. Authentic CUBE and Android acceptance are pending.
