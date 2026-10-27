# Mobile reviewed-warp raw-route comparison

The map change review panel now includes **Compare raw route before/after queued warps (no writes)**. Queue between 1 and 16 vanilla warp-record previews, inspect a declared RSE/FRLG atlas, and choose the route origin and destination in the atlas selectors. The control compares the shortest raw directed route through original ROM bytes against the same route through the proposed typed warp overlay.

The display reports original and proposed hop counts, whether the raw route changes, typed owner checks, and per-step buttons to inspect original ROM offsets. Each tap revalidates the queue identity, atlas inputs, selected endpoints, decoded typed preview and both routes. Changes to the queue or atlas invalidate prior results.

This is not an editor commit, patch, ROM export or real save/reopen test. It does not verify gameplay travel, collision, scripted warps, CUBE layouts, emulator behavior or Android hardware. Unsupported/non-warp queue entries are rejected. The standalone offline application includes the same workflow.

See [the typed route preflight engine](VANILLA_ROUTE_CHANGE_PREVIEW.md) for implementation and safety limits. Strict feature parity remains unchanged pending independently authenticated acceptance.
