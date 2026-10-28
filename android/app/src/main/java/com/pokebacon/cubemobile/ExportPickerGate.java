package com.pokebacon.cubemobile;

/**
 * Tracks the outstanding Android ACTION_CREATE_DOCUMENT activity result.
 * A WebView reload or JS cancellation must not free this ticket: the Android
 * picker can still return later. Only consuming that result permits a new
 * picker. This class contains no Android APIs so the race is unit-testable.
 */
final class ExportPickerGate {
    private String launchedSession;

    boolean begin(String session) {
        if (launchedSession != null || session == null || session.isEmpty())
            return false;
        launchedSession = session;
        return true;
    }

    boolean isInFlight() {
        return launchedSession != null;
    }

    String consume() {
        String previous = launchedSession;
        launchedSession = null;
        return previous;
    }
}
