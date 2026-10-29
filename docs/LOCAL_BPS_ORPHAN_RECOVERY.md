# Local BPS Save As — pre-publication orphan recovery

This is an **explicit, opt-in, local-only** companion to `scripts/local-bps-apply-saveas.mjs`. It addresses a crash **after** a verified new ROM was staged but **before** the destination hardlink was created. The existing `scripts/local-bps-recovery.mjs` handles the different case where the published destination already exists and the redundant stage link remains.

Use only with a legally held local source ROM, an independently checked BPS patch, and **both** independently supplied expected SHA-256 digests. Do not put ROMs, patches derived from copyrighted data, local paths or credentials in Git.

```sh
node scripts/local-bps-orphan-recovery.mjs \
  --rom /private/source.gba \
  --patch /private/changes.bps \
  --out /private/new.gba \
  --expected-sha256 <exact-source-sha256> \
  --expected-target-sha256 <exact-target-sha256>
```

The destination **must not exist**. Its parent must be a private owner-controlled, non-symlinked directory. Exactly one correctly named `.new.gba.cube-rom-stage-<24-lowercase-hex>` file must exist in that directory, be a private single-link regular file owned by the current user, and match an independently replayed BPS patch byte-for-byte. The tool also reopens the source and patch before publication, rechecks the stage and directory, creates the destination via atomic no-overwrite hardlink, durably removes the stage, and reopens the destination to compare the entire ROM.

If any condition is ambiguous, it **refuses** to publish or clean up. If a failure occurs after the hardlink is created, the two names are left for the separate published-stage recovery tool and manual review; an existing destination is never overwritten or intentionally deleted. A malformed stage, symlink, extra hardlink, conflicting stage, wrong digest or nonprivate directory cannot be treated as proof of ownership.

Output is an aggregate JSON status only; no ROM bytes, paths or hashes are printed. This proves a raw BPS source-to-target file operation, **not** authenticated CUBE layout compatibility, semantic edit ownership, emulator gameplay or Android hardware acceptance. It does not change strict feature parity.
