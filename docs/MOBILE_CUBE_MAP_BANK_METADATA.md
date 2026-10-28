# Mobile CUBHMA map-bank metadata provenance

The Named Data screen now shows a **read-only map-bank metadata** summary after importing local TOML files or pinned upstream stock metadata. The report uses the exact `data.maps.banks` named-anchor declaration from the imported files and the conservative format hierarchy and ambiguity checks grounded in pinned upstream CUBHMA `MapModel.cs`.

The report displays the source filename, declaration line, raw ROM offset, format length, identified nested section names and conflicts. It deliberately omits raw format strings and ROM bytes. The **Inspect anchor bytes in hex** button only navigates to a currently in-bounds offset; it does not interpret a CUBE map, follow a custom pointer, or grant write permission. Contradictory overlays and invalid addresses disable navigation.

Import is atomic: failed TOML parsing leaves the previous report and fingerprints unchanged. Replacing the ROM or resetting metadata clears the report; applying a patch also resets imported metadata. The report remains an **unverified claim** even when a supplied digest matches local ROM bytes. Changes to staged ROM bytes never upgrade its trust status.

The modular app and generated offline HTML provide the same controls. No ROM bytes, graphics, private files, ROM hashes or complete TOML documents are committed or uploaded by this feature.

**Not yet accepted:** authenticated CUBE ROM+metadata manifests, custom map decoding, save/reopen transactions, emulator verification and Android hardware tests. Strict CUBHMA/CUBE parity remains **0/30**.
