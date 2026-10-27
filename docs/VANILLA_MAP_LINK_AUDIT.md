# Declared vanilla map-link audit (read only)

This checkpoint extends the manually declared vanilla map atlas from PR #42 and the rendered map selection from PR #43. It is a **structural cross-reference**, not CUBE authentication, runtime warp simulation, script disassembly or safe map editing.

Source structures: pinned [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs) for map headers, events, warps and connections. Map bank counts remain explicitly supplied by the user. No scan or GBA header can establish CUBE expansion layout compatibility.

Select a map from a successfully inspected atlas and press **Audit selected map warp/connection targets**. The tool reports:
- `declared`: target bank/map exists within the supplied catalog, but topology and behavior remain unverified.
- `undeclared`: target is outside supplied bank/map counts; this is not proof that the ROM is invalid.
- `special`: a target bank/map or destination warp index is `0xFF`, so runtime destination semantics remain unresolved.
- `needs-review`: the raw target warp index is outside the target map's raw warp record count. Scripts and engine-specific routing may override naive assumptions.

Every result includes its exact source byte offset for hex inspection, and declared destinations can be opened in the existing map viewer. The audit reads staged ROM bytes through bounded accessors, does not mutate source bytes, rejects malformed event pointers, and is invalidated on ROM/metadata/atlas changes. The standalone offline HTML bundles the same function.

**Not verified:** CUBE ROM identity, custom bank layouts, special warp behavior, reciprocal connections, emulator results, Android hardware, semantic writes, or 20% desktop feature parity. Tests use only synthetic ROM buffers.
