package com.pokebacon.cubemobile;

import org.junit.Test;
import static org.junit.Assert.*;

public class ExportWriteStateTest {
    @Test public void successfulSessionCannotDeleteNextUnwrittenDestination() {
        ExportWriteState state = new ExportWriteState();
        state.beforeWrite();
        state.committed(1024);
        assertEquals(1024, state.bytesWritten());
        assertTrue(state.mayContainOurBytes());
        state.reset(); // Verified successful export or next picker.
        assertEquals(0, state.bytesWritten());
        assertFalse(state.mayContainOurBytes());
    }

    @Test public void failedProviderWriteMayHavePartiallyModifiedDestination() {
        ExportWriteState state = new ExportWriteState();
        assertFalse(state.mayContainOurBytes());
        state.beforeWrite(); // Provider throws before acknowledging bytes.
        assertEquals(0, state.bytesWritten());
        assertTrue(state.mayContainOurBytes());
        state.reset();
        assertFalse(state.mayContainOurBytes());
    }

    @Test public void committedByteAccountingIsBoundedAndRequiresWriteAttempt() {
        ExportWriteState state = new ExportWriteState();
        try {
            state.committed(1);
            fail("Must not count bytes without a write attempt");
        } catch (IllegalStateException expected) { }
        state.beforeWrite();
        try {
            state.committed(0);
            fail("Zero byte accounting is invalid");
        } catch (IllegalStateException expected) { }
        state.committed(1);
        state.committed(2);
        assertEquals(3, state.bytesWritten());
        state.reset();
        assertEquals(0, state.bytesWritten());
    }
}
