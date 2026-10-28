package com.pokebacon.cubemobile;

import org.junit.Test;
import static org.junit.Assert.*;

public class ExportPickerGateTest {
    @Test public void cancelledWebSessionCannotReuseOutstandingPicker() {
        ExportPickerGate gate = new ExportPickerGate();
        assertTrue(gate.begin("1000000100000001"));
        // WebView cancellation deliberately does not consume Android's picker.
        assertTrue(gate.isInFlight());
        assertFalse(gate.begin("1000000200000002"));
        assertEquals("1000000100000001", gate.consume());
        assertFalse(gate.isInFlight());
        assertTrue(gate.begin("1000000200000002"));
        assertEquals("1000000200000002", gate.consume());
    }

    @Test public void duplicateOrEmptyPickerTicketsFailClosed() {
        ExportPickerGate gate = new ExportPickerGate();
        assertFalse(gate.begin(null));
        assertFalse(gate.begin(""));
        assertNull(gate.consume());
        assertTrue(gate.begin("1"));
        assertFalse(gate.begin("1"));
        assertEquals("1", gate.consume());
        assertNull(gate.consume());
    }
}
