package com.pokebacon.cubemobile;

/**
 * Per-export byte-write ownership. A previous successful session must never
 * make a new, unwritten SAF destination eligible for destructive cleanup.
 * A provider can partially write before throwing, so mark before write().
 */
final class ExportWriteState {
    private boolean attempted;
    private long committed;

    void reset() {
        attempted = false;
        committed = 0;
    }

    void beforeWrite() { attempted = true; }

    void committed(int byteCount) {
        if (!attempted || byteCount < 1 || committed > Long.MAX_VALUE - byteCount)
            throw new IllegalStateException("Invalid export write accounting");
        committed += byteCount;
    }

    long bytesWritten() { return committed; }

    boolean mayContainOurBytes() { return attempted || committed > 0; }
}
