package com.pokebacon.cubemobile;

import org.junit.Test;
import static org.junit.Assert.*;

public class ImportPickerGateTest {
    @Test public void cancelledWebViewCannotGiveOldPickerResultToNewCallback() {
        ImportPickerGate gate = new ImportPickerGate();
        assertTrue(gate.begin());
        gate.invalidate(); // WebView reload while Android picker is still open.
        assertTrue(gate.isInFlight());
        assertFalse(gate.begin()); // New chooser cannot claim the old result.
        assertFalse(gate.consume()); // Late result is dropped.
        assertFalse(gate.isInFlight());
        assertTrue(gate.begin());
        assertTrue(gate.consume()); // Only the new chooser receives its result.
    }

    @Test public void activityRecreationPreservesTicketButNotJavascriptCallback() {
        ImportPickerGate previous = new ImportPickerGate();
        assertTrue(previous.begin());
        assertTrue(previous.isInFlight());
        ImportPickerGate restored = new ImportPickerGate();
        restored.restoreOutstanding();
        assertTrue(restored.isInFlight());
        assertFalse(restored.begin());
        assertFalse(restored.consume());
        assertTrue(restored.begin());
        assertTrue(restored.consume());
    }

    @Test public void duplicateOrUnsolicitedResultsNeverBecomeValidImports() {
        ImportPickerGate gate = new ImportPickerGate();
        assertFalse(gate.consume());
        assertTrue(gate.begin());
        assertFalse(gate.begin());
        assertTrue(gate.consume());
        assertFalse(gate.consume());
        gate.invalidate();
        assertFalse(gate.consume());
    }
}
