# CUBE cross-bank ownership census

Inspects at most 256 explicitly enumerated CUBE maps across at most eight banks. Reports exact and partial byte-range overlap for map headers, layouts and blockmaps, including across banks. Invalid maps remain visible instead of being silently omitted.

This is a **partial read-only census**: a non-overlap finding cannot prove exclusive ownership, because other map banks, dynamic references and editor metadata may point at the same bytes. No write permission is granted. Source grounding: pinned CUBHMA MapModel.cs and cube_emerald.toml. Genuine ROM authentication, emulator, Android and save/reopen tests are still required.
