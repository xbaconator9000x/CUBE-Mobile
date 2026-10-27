# CUBHMA map-bank TOML provenance gate

The upstream [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs) uses `model.GetTable("data.maps.banks")` and derives its custom map format from that table's `FormatString`. The prior format extractor accepted arbitrary supplied format strings; `src/hma-map-bank-metadata.js` now resolves the actual `[[NamedAnchors]]` declaration in one or more locally supplied TOML texts.

The read-only inspection retains source name, declaration line, exact address and format, counts identical declarations, rejects conflicting overlays instead of assuming CUBHMA precedence, and rejects unaligned or out-of-ROM anchor addresses when a ROM length is supplied. It then invokes the existing bounded custom format hierarchy extractor. Results distinguish missing, conflicting, invalid-address, malformed-format, unresolved-format, vanilla-marker and custom-candidate cases.

**No ROM bytes are read or written.** The anchor address and format are metadata claims, not proof that a ROM uses those structures. Even a custom-candidate result does not authorize decoding, repointing, saving, collision interpretation or script execution. The implementation does not resolve HMA's full metadata overlay precedence, custom format grammar, actual map pointers or CUBE ROM fingerprints. The API is available for later mobile UI integration; it is not yet a visible app control.

Synthetic tests cover identical and contradictory overlays, bounds, source provenance, unsupported formats, malformed syntax, missing anchors and input budgets. Genuine CUBE ROM and metadata digest authentication, emulator save/reopen and Android hardware acceptance remain prerequisites to strict feature-parity credit.

## Repeated named pointer fields

The map metadata gate now audits the number of `map<`, `layout<`, `events<`, `connections<`, `objects<`, `warps<`, `scripts<`, `signposts<` and blockset pointer fields within their respective extracted format scopes. Repeated same-name fields are classified as `ambiguous-format` instead of silently choosing the first match. This is intentionally conservative; genuine HMA aliases may need an authenticated parser before they can be accepted. It does not attempt to parse the complete HMA DSL or grant ROM write authority.
