# Explicit vanilla map atlas checkpoint

Source: pinned upstream [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs), `AllMapsModel` and `MapBankModel`.

The **Blockmaps** screen accepts a known vanilla bank pointer-table ROM offset and explicit comma-separated map counts for **every bank**. It reads every declared map pointer, validates vanilla RSE/FRLG header/layout/blockmap bounds, and offers a touch-friendly map selector. Raw warp and connection destinations can open another map only when that bank/map pair exists in the inspected catalog. It never guesses counts from 0xFF sentinels, ROM headers, filenames, or arbitrary pointers.

The atlas is read-only, capped at 4096 maps, and invalidated when ROM bytes, imported metadata or bank inputs change. No write, repoint or CUBE expansion support is enabled. A syntactically plausible pointer chain is **not** an authenticated CUBE layout or verified warp topology. Empty banks and bank-specific expansion formats remain unsupported. This checkpoint does not establish 20% feature parity.
