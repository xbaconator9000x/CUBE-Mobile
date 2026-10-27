# Mobile shared script operand explorer

In the Blockmaps screen, first inspect an explicitly declared vanilla RSE/FRLG
map atlas. Then choose **Scan declared maps for shared script operand
targets** to review in-ROM pointers from decoded object/trigger script
prefixes. Results show the target ROM offset, distinct pointer-source count,
source command role and script-root offset. Tapping a result opens the hex
inspector; before navigation the atlas declaration and the full bounded
scan are revalidated against current staged ROM bytes.

To protect the touch UI from very large synchronous scans, this control
accepts at most 512 declared maps, 8192 event script fields, 1024 distinct
script roots and 8192 operand fields. Oversized scans fail closed rather than
showing partial results as if complete. For larger atlases, use the opt-in
local-ROM CLI with independently supplied SHA-256 and declared map counts.

This is a read-only structural alias hint, **not** proof of shared allocation,
valid message/movement data, CUBE script grammar, or safe editing. It follows
no control-flow branches, does not mutate ROM bytes and cannot count toward
strict parity without authentic ROM/emulator/Android acceptance.

Targets with different decoded pointer roles are labelled **mixed operand
roles: review**. They may be intentional. The local smoke JSON exposes
only the aggregate `mixedRoleTargets` count, not ROM pointer addresses.
