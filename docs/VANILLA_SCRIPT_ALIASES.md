# Shared vanilla event-script pointer hints

`auditVanillaAtlasScriptAliases` in `src/vanilla-script-aliases.js`
reviews a **bounded page** of a previously declared vanilla RSE/FRLG
map atlas. It reports in-ROM object/trigger script targets referenced
by two or more event pointer fields, including their exact ROM source
offsets and map bank/index. A page covers at most 32 maps, with
bounded alias groups and references. Results are local to the page;
aliases across different pages are not counted together.

Before inspecting events, the function rechecks each declared map
pointer and header/layout dimensions against the current ROM accessor.
Stale declarations fail closed. It never follows scripts, interprets
unknown CUBE formats, or modifies bytes.

**Important:** Shared target offsets are *hints*, not a complete
allocation/ownership graph. Different map records may intentionally
share scripts. No copy-on-write, repointing, script editing or semantic
write permission is established. A declared vanilla atlas is not proof
of CUBE compatibility or independently verified feature parity.
