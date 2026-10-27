# Raw vanilla warp arrival trace

Pinned upstream: [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs), vanilla events/warps. `traceVanillaWarpArrival` follows a **user-declared** source bank/map/warp to a raw target bank/map/warp and reads the target's recorded arrival cell, byte offsets, tile ID and six high bits.

Every source and target map header/layout is revalidated against the declared atlas; missing targets, special 0xFF IDs, invalid destination warp indexes and out-of-bounds coordinates are distinct outcomes. No pointers or scripts are executed, and no ROM bytes are modified. A raw target record is **not proof of actual engine teleport behavior**, a valid CUBE layout or a safe editing capability. Android, emulator and authentic ROM acceptance remain pending.
