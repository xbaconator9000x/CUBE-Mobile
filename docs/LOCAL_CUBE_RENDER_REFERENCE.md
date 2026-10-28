# Local CUBE RGBA rendering reference check

The opt-in `smoke:cube-banks` CLI can now compare a **bounded, locally rendered CUBE Emerald viewport** against a separately obtained expected RGBA fingerprint. This adds an explicit visual acceptance *measurement* to the previous aggregate render smoke, without exporting ROM pixels, tile graphics, map bytes, paths or digests. It remains a **local diagnostic, not independent authentication**.

Example, using local inputs only (replace placeholders; never commit the files):

```sh
npm run smoke:cube-banks -- --rom /private/game.gba --metadata /private/cube_emerald.toml \
  --expected-sha256 <sha256-of-rom> --bank-index 0 --map-index 0 --map-count 1 \
  --render-map 1 --viewport-x 0 --viewport-y 0 --viewport-width 10 \
  --viewport-height 8 --expected-render-sha256 <reference-rgba-sha256>
```

Reference algorithm: SHA-256 over UTF-8 domain prefix `cube-mobile-rgba-v1\\0` (NUL terminator), followed by unsigned little-endian 32-bit pixel width and height, followed by RGBA8 bytes in row-major order. It is *not* a hash of the ROM or a PNG. The comparison fails closed if pixels or dimensions differ. The CLI reports only whether a supplied reference matched, never the reference digest or pixels.

A trustworthy reference must be produced independently from the **same exact CUBE build, ROM and metadata version, bank/map and viewport**, preferably a pinned desktop CUBHMA rendering capture converted to exact RGBA8. Merely supplying a digest computed by this mobile renderer tests determinism, not parity. A matching user-supplied digest does not satisfy the six independent parity gates or authorize semantic ROM writing. The conservative RSE renderer still rejects unsupported CUBE lighting/FRLG modes; emulator, Android hardware, ownership and save/reopen acceptance remain unverified.

Only synthetic fixtures are committed in tests. No copyrighted ROM data, source screenshots, or user paths are committed.
