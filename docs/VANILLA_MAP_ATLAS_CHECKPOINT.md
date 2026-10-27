# Explicit vanilla map atlas checkpoint

Source: pinned upstream [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs), `AllMapsModel` and `MapBankModel`.

The **Blockmaps** screen accepts a known vanilla bank pointer-table ROM offset and explicit comma-separated map counts for **every bank**. It reads every declared map pointer, validates vanilla RSE/FRLG header/layout/blockmap bounds, and offers a touch-friendly map selector. Raw warp and connection destinations can open another map only when that bank/map pair exists in the inspected catalog. It never guesses counts from 0xFF sentinels, ROM headers, filenames, or arbitrary pointers.

The atlas is read-only, capped at 4096 maps, and invalidated when ROM bytes, imported metadata or bank inputs change. No write, repoint or CUBE expansion support is enabled. A syntactically plausible pointer chain is **not** an authenticated CUBE layout or verified warp topology. Empty banks and bank-specific expansion formats remain unsupported. This checkpoint does not establish 20% feature parity.

## Optional bounded structural candidate probe

If the bank pointer-table offset is unknown, provide a **nearby approximate search start**, a window of at most 4096 bytes, an explicit vanilla family, and **small explicit bank map counts** (at most 16 banks and 128 total maps). The probe tries aligned locations and returns only candidates for which the declared vanilla pointer/layout chain is structurally readable. Tap a candidate to populate the bank-table offset and inspect the atlas. The probe never scans the whole ROM automatically and **does not authenticate stock/CUBE layout**, ROM identity, map counts, runtime behavior, or permission to edit. False positives are possible; a missing candidate does not prove that the ROM lacks maps.
