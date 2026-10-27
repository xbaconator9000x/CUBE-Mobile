# Mobile vanilla script operand pointer review

The Blockmaps screen's raw object/trigger script pointer inspector now offers **Review vanilla script operand pointer roles** for an individually selected in-ROM event script. It uses the pinned CUBHMA [script reference](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Code/scriptReference.txt) and the bounded vanilla command-prefix decoder.

The mobile and standalone views show each pointer operand's source ROM offset, conventional ROM status, and unverified role hint (branch, message text, movement data, generic data, ASM/code, or trainerbattle data). Touch controls navigate to source and in-ROM target bytes only after checking that the selected map, event pointer and decoded operand still match current staged ROM bytes. No target is dereferenced, interpreted, followed, executed or modified.

The view caps inspection at 128 script bytes, 32 commands and 32 returned findings; totals and status counts survive truncation. Unknown or unsupported commands stop decoding. The report is **not** a script-length proof, ownership map, CUBE grammar validation or permission to write. Genuine ROM/emulator/Android acceptance and strict parity credit remain outstanding.
