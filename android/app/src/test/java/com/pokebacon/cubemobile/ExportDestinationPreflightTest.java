package com.pokebacon.cubemobile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import org.junit.Test;
import static org.junit.Assert.*;

public class ExportDestinationPreflightTest {
    @Test public void acceptsOnlyReadableEmptyDestination() throws Exception {
        assertTrue(ExportDestinationPreflight.isEmpty(new ByteArrayInputStream(new byte[0])));
        assertFalse(ExportDestinationPreflight.isEmpty(new ByteArrayInputStream(new byte[]{1})));
        assertFalse(ExportDestinationPreflight.isEmpty(null));
    }

    @Test public void unreadableProviderIsNotAssumedEmpty() throws Exception {
        InputStream failed = new InputStream() {
            @Override public int read() throws IOException { throw new IOException("provider error"); }
        };
        try {
            ExportDestinationPreflight.isEmpty(failed);
            fail("Expected provider error");
        } catch (IOException expected) { }
    }
}
