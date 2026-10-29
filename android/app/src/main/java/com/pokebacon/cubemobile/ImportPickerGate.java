package com.pokebacon.cubemobile;

/**
 * The Android import picker outlives the WebView that launched it.
 * Invalidating the JS callback must NOT free the Android result ticket:
 * a late result could otherwise be delivered to a newer chooser.
 * Pure Java to make cancellation/recreation races unit-testable.
 */
final class ImportPickerGate {
    private boolean inFlight;
    private boolean callbackValid;

    boolean begin() {
        if (inFlight) return false;
        inFlight = true;
        callbackValid = true;
        return true;
    }

    void restoreOutstanding() {
        inFlight = true;
        callbackValid = false; // Never revive a callback from the old WebView.
    }

    void invalidate() {
        callbackValid = false; // Keep the Android result ticket outstanding.
    }

    boolean consume() {
        boolean deliver = inFlight && callbackValid;
        inFlight = false;
        callbackValid = false;
        return deliver;
    }

    boolean isInFlight() {
        return inFlight;
    }
}
