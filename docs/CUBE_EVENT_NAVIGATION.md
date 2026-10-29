# CUBE event record navigation (Q019 partial)

The inspected custom CUBE event list now has a type selector (all, object, warp, trigger, signpost) and an optional exact record-index filter. Both controls are labelled and keyboard operable. The matching count is announced in a polite live region. Reset restores the complete list without changing the ROM or any queued proposals.

Filtering occurs **after** the existing exact source reinspection, and every rendered record action retains its original stale-snapshot and raw-byte revalidation. Selecting a record's copy-only position action moves focus to the corresponding batch editor's Load control, so keyboard and screen-reader users are not stranded at an event-list button after the page scrolls.

The modular web app and generated offline Android page contain the same controls and filter implementation. Unit tests cover kind/index matching, malformed indexes, read-only behavior, stale-source checks and offline parity.

This is not a complete accessible event editor. It does not parse or compile scripts, authenticate CUBE layouts, authorize semantic ROM writes, or replace physical Android TalkBack/touch/keyboard acceptance.
