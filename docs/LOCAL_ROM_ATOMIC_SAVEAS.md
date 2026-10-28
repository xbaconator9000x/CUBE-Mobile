# Local atomic byte-identical ROM Save As foundation (29 October 2026)

Run `node scripts/local-rom-atomic-saveas.mjs --source /local/input.gba --destination /local/new-copy.gba --expected-sha256 <64-hex-digest>` on a machine holding a user-supplied ROM. No ROMs or metadata are shipped or uploaded.

This is a **byte-identical copy of the original ROM**, NOT a map edit, a patch or CUBE ROM compatibility acceptance. The source must be a regular, non-symlink file between 1 byte and 64 MiB, matching the caller's expected SHA-256. The destination must not exist and must have a non-symlink directory parent. The local utility stages bytes in the destination directory using an exclusive temporary file, flushes and reopens the staged copy, compares exact bytes and hash, verifies the source is unchanged, and uses an exclusive hard link so it cannot overwrite an existing destination. It reopens and verifies the destination and cleans the temporary file. On failure it removes only its own staged file and, when safely identifiable by inode, its own destination.

The JSON result intentionally contains only aggregate booleans and byte count, never local paths, ROM bytes or hashes. Synthetic tests cover byte-for-byte roundtrip, no overwrite, symlink refusal, bad digest, and CLI behavior.

This establishes **local filesystem Save As mechanics only**. Applying edited ROM bytes remains disabled until authentic CUBE ROM/TOML evidence, complete pointer ownership, semantic change validation, emulator and Android-device acceptance exist. No strict feature-parity family is verified by this utility.

## Stage and publication inode validation

The Save As path now reopens staged and published files with `O_NOFOLLOW`, checks that each pathname still refers to the expected regular-file device/inode/size, and compares bytes and SHA-256 across stable file-descriptor snapshots. This prevents a simple staged-path or destination-path symlink substitution from being accepted as a valid saved ROM merely because the target has matching bytes. Publication still uses an exclusive hard link and never overwrites an existing destination. Tests additionally reject preexisting hardlinks/symlinks and symlinked destination directories.

This is defense in depth for the **unmodified-ROM copy** only. It is not a guarantee against arbitrary concurrent hostile filesystem mutation, does not persist semantic edits, and does not establish CUBE ROM authenticity or strict feature parity.
