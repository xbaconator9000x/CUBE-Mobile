# CUBE cell transaction rehearsal — copy only

The CUBE map preview queue now offers **Verify reversible in-memory transaction**.
It stages up to 32 validated raw cell proposals on an isolated ROM byte copy
(maximum 64 MiB), checks the exact changed bytes, re-decodes and re-renders
the map from the modified copy, and rolls the copy back to its original
bytes. The user-loaded ROM is never written by this operation. No patched
ROM, patch bytes or private ROM assets are returned or exported.

The UI invalidates previous rehearsal feedback whenever the proposal queue
changes. The modular web app and offline HTML share this functionality.

This is **not** a genuine ROM save/reopen test: it does not authenticate the
CUBE build or TOML provenance, prove full cross-bank ownership, exercise an
emulator or Android hardware, or authorize any semantic ROM write. The
strict parity baseline remains unchanged until independent acceptance
evidence is supplied.
