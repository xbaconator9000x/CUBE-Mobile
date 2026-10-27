# Vanilla object, trigger and signpost coordinate preview

The read-only `previewVanillaEventCoordinateChange` helper produces byte-exact before/after records for explicitly selected vanilla RSE/FRLG object (24-byte), script-trigger (16-byte) and signpost (12-byte) events.

The supported fields are x, y and elevation only. The object/signpost elevation is one byte; the script-trigger elevation is two bytes. All other bytes—including raw script pointers, flags, graphics, trainer IDs, signpost arguments and event identity—are preserved exactly. A caller may provide an expected complete original record to reject stale previews. Bounds are checked against the selected map layout. Staged ROM readers are supported; no source bytes are mutated.

The format is grounded in pinned [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs). This is a *preview*, not a safe editor: CUBE layout identity, event array ownership, relocation, runtime behavior, ROM roundtrip, emulator and Android hardware validation remain unverified. No write authority is granted.
