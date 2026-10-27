# Bounded vanilla trainerbattle decoding

Pinned upstream: [CUBHMA scriptReference.txt](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Code/scriptReference.txt), command **5C**. Unlike fixed-width commands, the length of trainerbattle depends on the first subtype byte.

The conservative RSE/FRLG prefix inspector recognizes vanilla subtypes **00–08**. Every decoded record has a one-byte subtype, two-byte trainer ID, two-byte argument and the following pointer counts: 00=2, 01=3, 02=3, 03=1, 04=3, 05=2, 06=4, 07=3, 08=4. Pointer offsets are byte-exact; no target is followed. Subtypes **09 and above** stop with `unsupported-trainerbattle` because game variants and extensions have different formats. Incomplete subtype/operand bytes stop without consuming a partial command.

The mobile and standalone script inspectors display decoded arguments and allow stale-checked navigation to conventional in-ROM raw targets. The map script audit and local SHA-256-checked smoke tool aggregate trainerbattle operands only as **unverified trainer-battle data**; they do not assert text or executable ownership.

This does not authenticate CUBE grammar, script length, game-specific subtype 09+, ROM editing, save/reopen, emulator or Android behavior. No strict parity credit is earned from synthetic coverage.
