# Exporting a map change review report

The mobile and standalone workbench can download a **review-only JSON field summary** for up to 64 queued vanilla map record previews. Before generating it, the existing review engine rechecks every original byte against the current staged ROM, enforces the byte limit, rejects overlapping edits and prevents changes to non-editable script pointers, flags and reserved fields.

The report is deterministic, sorted by ROM offset, and contains only record kind, offset, length, changed status and typed field-level before/after values. It intentionally excludes raw original/proposed ROM byte arrays, ROM assets, and executable patch instructions. It is not a format that can be imported or applied to a ROM. No ROM is written or downloaded by this action.

Use **Download review-only JSON** after queueing blockmap, warp or event previews. If the queue changes or original ROM bytes become stale, export revalidates rather than trusting an earlier review. JSON files may still contain identifying filenames in the download name and field values from your work, so share them deliberately.

This is a collaboration/debugging aid, **not** CUBE layout authentication, pointer ownership verification, a transaction, emulator acceptance or a completed editor feature family.
