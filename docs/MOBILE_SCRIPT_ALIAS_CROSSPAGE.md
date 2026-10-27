# Mobile cross-page shared vanilla script targets

The Blockmaps atlas now provides **Scan shared script targets across next 64 maps**. It uses the bounded core cross-page alias audit to find identical object/trigger script destinations even when the references span two of the smaller 16-map inspection pages. The mobile and standalone interfaces show each shared target, source pointer fields, bank/map/event references, and an explicit page-boundary indicator.

The scanner reads up to 64 declared maps and 4096 pointer fields per tap, with at most 32 displayed groups and 8 references per group. Each navigation rechecks the selected ROM, atlas declarations, map pointers/layouts and shared target findings against current bytes. Results cover only the scanned window; a target shared with another 64-map window remains unknown. Over-budget scans fail closed.

The UI is **read-only** and uses vanilla RSE/FRLG structures, not authenticated CUBE metadata. Shared script targets may be intentional. This does not grant script editing, pointer relocation, execution, ownership authentication or independent feature parity credit. Genuine ROM/emulator/Android acceptance is still required.

See [cross-page core audit](VANILLA_SCRIPT_ALIAS_CROSSPAGE.md) and pinned [CUBHMA map model](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs).
