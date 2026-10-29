# Mobile and Android BPS raw-edit export

The **Patches** screen now exposes **Export BPS diff** alongside IPS. It
encodes staged raw byte edits against the unmodified session base using
`src/bps-export.js`, verifies CRC32 integrity and independently replays
the patch through the existing BPS decoder before a browser blob download.
The Android WebView's existing user-selected document export bridge
handles that same blob with chunk hashing and destination readback.

The export is deliberately restricted to an unpatched source ROM of
192 bytes–64 MiB and 1–65,536 staged byte edits. Unlike IPS, BPS supports
changes beyond 16 MiB. An imported BPS/IPS patch must first be saved
as a separate ROM and reopened before exporting another raw-edit diff.
Neither export modifies the imported ROM on disk.

**No CUBE semantic write authorization is implied.** Raw hex edits are
user-directed bytes; this feature does not authenticate a CUBE ROM/TOML
pair, resolve global pointer ownership, guarantee game behavior or
provide a validated CUBE map/collision/script save. Strict parity remains
0/30 until independently accepted evidence is available.
