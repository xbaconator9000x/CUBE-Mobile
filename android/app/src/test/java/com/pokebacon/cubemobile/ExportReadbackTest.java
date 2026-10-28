package com.pokebacon.cubemobile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.Arrays;
import org.junit.Test;
import static org.junit.Assert.*;

public class ExportReadbackTest {
    private byte[] digest(byte[] bytes) throws Exception {
        return MessageDigest.getInstance("SHA-256").digest(bytes);
    }

    @Test public void verifiesExactReopenedDocument() throws Exception {
        byte[] bytes = new byte[102400];
        for (int i = 0; i < bytes.length; i++) bytes[i] = (byte) (i * 31);
        assertTrue(ExportReadback.verify(new ByteArrayInputStream(bytes),
            bytes.length, digest(bytes)));
    }

    @Test public void rejectsTruncatedOversizedAndCorruptedDocuments() throws Exception {
        byte[] bytes = {1, 2, 3, 4, 5};
        byte[] hash = digest(bytes);
        assertFalse(ExportReadback.verify(new ByteArrayInputStream(bytes), 6, hash));
        assertFalse(ExportReadback.verify(new ByteArrayInputStream(bytes), 4, hash));
        byte[] changed = Arrays.copyOf(bytes, bytes.length);
        changed[2] = 99;
        assertFalse(ExportReadback.verify(new ByteArrayInputStream(changed), 5, hash));
    }

    @Test public void emptyDocumentAndInvalidParametersFailClosed() throws Exception {
        byte[] empty = new byte[0];
        assertTrue(ExportReadback.verify(new ByteArrayInputStream(empty), 0, digest(empty)));
        assertFalse(ExportReadback.verify(null, 0, digest(empty)));
        assertFalse(ExportReadback.verify(new ByteArrayInputStream(empty), -1, digest(empty)));
        assertFalse(ExportReadback.verify(new ByteArrayInputStream(empty), 0, new byte[3]));
        assertFalse(ExportReadback.verify(new ByteArrayInputStream(empty),
            128L * 1024 * 1024 + 1, digest(empty)));
    }

    @Test public void providerReadFailureDoesNotVerify() throws Exception {
        InputStream broken = new InputStream() {
            @Override public int read() throws IOException { throw new IOException("provider failed"); }
        };
        try {
            ExportReadback.verify(broken, 1, digest(new byte[]{7}));
            fail("Expected provider failure");
        } catch (IOException expected) { }
    }
}
