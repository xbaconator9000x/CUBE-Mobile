package com.pokebacon.cubemobile;

/**
 * Tracks the outstanding Android ACTION_CREATE_DOCUMENT activity result.
 * A WebView reload or JS cancellation must not free this ticket: the Android
 * picker can still return later. Only consuming that result permits a new
 * picker. This class contains no Android APIs so the race is unit-testable.
 */
final class ExportPickerGate {
    private String launchedSession;
    private boolean restoredOutstanding;

    boolean begin(String session) {
        if (restoredOutstanding || launchedSession != null || session == null || session.isEmpty())
            return false;
        launchedSession = session;
        return true;
    }

    /** Keep the old Android result ticket after Activity recreation, never its JS session. */
    void restoreOutstanding() {
        launchedSession = null;
        restoredOutstanding = true;
    }

    boolean isInFlight() {
        return restoredOutstanding || launchedSession != null;
    }

    String consume() {
        String previous = launchedSession;
        launchedSession = null;
        restoredOutstanding = false;
        return previous;
    }
}
