# Local atomic byte-identical ROM Save As foundation (29 October 2026)

Run `node scripts/local-rom-atomic-saveas.mjs --source /local/input.gba --destination /local/new-copy.gba --expected-sha256 <64-hex-digest>` on a machine holding a user-supplied ROM. No ROMs or metadata are shipped or uploaded.

This is a **byte-identical copy of the original ROM**, NOT a map edit, a patch or CUBE ROM compatibility acceptance. The source must be a regular, non-symlink file between 1 byte and 64 MiB, matching the caller's expected SHA-256. The destination must not exist and must have a non-symlink directory parent. The local utility stages bytes in the destination directory using an exclusive temporary file, flushes and reopens the staged copy, compares exact bytes and hash, verifies the source is unchanged, and uses an exclusive hard link so it cannot overwrite an existing destination. It reopens and verifies the destination and cleans the temporary file. On failure it removes only its own staged file and, when safely identifiable by inode, its own destination.

The JSON result intentionally contains only aggregate booleans and byte count, never local paths, ROM bytes or hashes. Synthetic tests cover byte-for-byte roundtrip, no overwrite, symlink refusal, bad digest, and CLI behavior.

This establishes **local filesystem Save As mechanics only**. Applying edited ROM bytes remains disabled until authentic CUBE ROM/TOML evidence, complete pointer ownership, semantic change validation, emulator and Android-device acceptance exist. No strict feature-parity family is verified by this utility.
