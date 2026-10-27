# Mobile full-atlas script target review

The Blockmaps screen now offers **Scan all declared maps for shared script targets**. Unlike the 16-map and 64-map windows, this opt-in read-only audit checks every map in the currently declared vanilla RSE/FRLG atlas, so shared targets separated by any number of scan windows are visible. Results show exact script target offsets and the first eight object/trigger source pointer fields, with touch-to-hex navigation. Navigation reruns the bounded audit against current ROM bytes and revalidates map declarations and selected findings.

The scanner has strict limits of 4096 declared maps, 32768 pointer fields per operation, 32 displayed groups and eight displayed references per group. Over-budget and stale scans fail closed, not as partial results. On large maps this synchronous scan may take time on mobile; it is opt-in. A complete declared atlas is not proof that the declarations match the true ROM layout.

Source: [pinned CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs). This is vanilla structure inspection only. No script execution, editing, CUBE-specific authentication, allocation ownership or strict parity credit. Real-ROM, emulator and Android hardware acceptance remain outstanding.
