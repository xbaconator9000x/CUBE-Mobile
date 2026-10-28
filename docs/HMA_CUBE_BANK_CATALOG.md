# CUBE explicit bank map catalog

The mobile CUBE bank catalog walks up to **128 explicitly declared** map slots in one metadata-declared bank, reusing the source-grounded CUBE 28-byte map header and custom layout parser. Individual corrupt/unsupported map slots are reported separately instead of hiding valid maps. The catalog shows dimensions, region/layout IDs, raw event and connection availability and **same-bank** header/layout/blockmap aliases.

No dynamic map count is inferred. Other-bank ownership remains unknown; aliases and event counts are not permission to write. ROM and TOML identities, game behavior, emulator and Android acceptance remain unverified. Never interpret a decoded map candidate as authenticated CUBE parity.
