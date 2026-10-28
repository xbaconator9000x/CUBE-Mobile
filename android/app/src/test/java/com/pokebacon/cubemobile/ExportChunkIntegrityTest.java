package com.pokebacon.cubemobile;

import java.security.MessageDigest;
import org.junit.Test;
import static org.junit.Assert.*;

public class ExportChunkIntegrityTest {
    private String sha(byte[] bytes) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
        StringBuilder result = new StringBuilder();
        for (byte b : digest) result.append(String.format("%02x", b & 255));
        return result.toString();
    }

    @Test public void acceptsOriginalBlobSliceAndRejectsChangedBytes() throws Exception {
        byte[] bytes = new byte[48 * 1024];
        for (int i = 0; i < bytes.length; i++) bytes[i] = (byte) (i * 13);
        String original = sha(bytes);
        assertTrue(ExportChunkIntegrity.verify(bytes, original));
        bytes[123] ^= 1;
        assertFalse(ExportChunkIntegrity.verify(bytes, original));
    }

    @Test public void rejectsMissingMalformedAndOversizedDigests() throws Exception {
        byte[] bytes = {1, 2, 3};
        assertFalse(ExportChunkIntegrity.verify(bytes, null));
        assertFalse(ExportChunkIntegrity.verify(bytes, "x".repeat(64)));
        assertFalse(ExportChunkIntegrity.verify(bytes, "0"));
        assertFalse(ExportChunkIntegrity.verify(new byte[0], sha(new byte[0])));
        assertFalse(ExportChunkIntegrity.verify(new byte[48 * 1024 + 1], sha(bytes)));
    }
}
