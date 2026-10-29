# Local ordered TOML profile cross-source acceptance

The local-only `npm run smoke:cube-manifest -- --rom /path/to/legal.gba --manifest /path/to/manifest.json --profile /path/to/profile.json --metadata /path/to/base.toml --metadata /path/to/overlay.toml` checks exact ROM bytes and ordered TOML overlays without committing, exporting or printing them. File order matters.

The original single-file ROM profile format remains valid. For a ROM with several TOML overlays, a caller may **optionally** add `metadataFiles` to their local profile JSON:

```json
{
  "sha256": "<64 hex ROM digest>",
  "length": 33554432,
  "gameCode": "BPEE",
  "revision": 0,
  "layout": "custom",
  "metadataSha256": "<first TOML SHA-256>",
  "sourceCommit": "<40 hex source commit>",
  "evidenceUrl": "https://github.com/owner/repository/commit/<40 hex source commit>",
  "metadataFiles": [
    {"name": "base.toml", "length": 123, "sha256": "<first TOML SHA-256>"},
    {"name": "overlay.toml", "length": 456, "sha256": "<second TOML SHA-256>"}
  ]
}
```

The legacy `metadataSha256` must match the first entry. The manifest must independently declare the same ROM identity, layout, source revision and exact ordered file names, sizes and digests. The CLI reports `consistent-ordered-byte-claims` only if all provided bytes agree. Reordering, omissions, contradictory hashes and malformed claims fail closed. A legacy single-file profile applied to multiple TOML files remains `multi-file-profile-unbound`.

**Important:** Both JSON inputs are user-supplied claims, not independent authentication. Matching them never proves CUBE provenance, pointer ownership, gameplay compatibility or safe semantic writes. No ROMs, metadata bytes, file paths, SHA-256 digests or private keys are included in CLI output or Git. Authentic ROM and Android/emulator acceptance remain blocked.
