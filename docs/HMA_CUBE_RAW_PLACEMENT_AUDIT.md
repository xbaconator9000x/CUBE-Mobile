# CUBE raw destination-cell placement audit

The mobile/offline warp and event batch previews now inspect each proposed destination against the **original** CUBE Emerald blockmap and decoded event arrays. They report the exact raw 16-bit cell word (10-bit tile ID, six raw high bits), original co-located event records, and multiple proposed placements targeting the same cell.

The raw high bits are **not** established passability, elevation policy or gameplay collision rules. An original object at a destination may move in the same batch; source co-location is an advisory warning, not a guaranteed final collision. This audit never writes or exports ROM bytes, follows script pointers, or grants ownership authority. It is bounded to 64 placements and refuses invalid identities, duplicates, out-of-map coordinates or malformed event arrays.

Genuine CUBE ROM/TOML compatibility, saved-ROM reopen, emulator and Android hardware acceptance remain necessary before strict feature parity can advance.
