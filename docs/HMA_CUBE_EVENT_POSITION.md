# CUBE object, trigger and signpost position preflight

Source: pinned [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/HexManiac.Core/Models/MapModel.cs) event formats. This implementation uses the CUBE Emerald fixed-width event arrays already decoded by `src/hma-cube-map-events.js`: objects (24 bytes), script triggers (16 bytes), and signposts (12 bytes).

`previewHmaCubeEventPositionChange` accepts an exact x/y/elevation original, verifies the current raw source, and previews only the selected record's coordinate and elevation bytes. Objects store coordinates at +4/+6 and an 8-bit elevation at +8; triggers store coordinates at +0/+2 and a 16-bit elevation at +4; signposts store coordinates at +0/+2 and an 8-bit elevation at +4. The whole event table is re-decoded, every unrelated record is compared, and events occupying the destination cell are reported without asserting collision or walkability.

`verifyHmaCubeEventPositionDryRun` rehearses the same move on an isolated bounded ROM copy, verifies changed-byte ownership within the selected fields, re-decodes, rolls back, and checks source preservation. Tests cover each of the three record types, 16-bit trigger elevation, stale source, unsupported fields, out-of-map coordinates and snapshot mutation.

This is **not a ROM writer**: unknown fields, script pointers, flags and movement behavior are not interpreted or changed. No ROM or patch bytes are exported. Authentic CUBE ROM/TOML compatibility, full ownership, emulator behavior, Android hardware and save/reopen acceptance remain outstanding; strict parity stays 0/30.
