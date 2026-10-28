package com.pokebacon.cubemobile;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Verifies each native chunk against the original WebView Blob slice hash. */
final class ExportChunkIntegrity {
    private ExportChunkIntegrity() { }

    static boolean verify(byte[] bytes, String expectedHex) throws NoSuchAlgorithmException {
        if (bytes == null || bytes.length == 0 || bytes.length > 48 * 1024 ||
            expectedHex == null || expectedHex.length() != 64) return false;
        byte[] expected = new byte[32];
        for (int i = 0; i < 32; i++) {
            int high = Character.digit(expectedHex.charAt(i * 2), 16);
            int low = Character.digit(expectedHex.charAt(i * 2 + 1), 16);
            if (high < 0 || low < 0) return false;
            expected[i] = (byte) ((high << 4) | low);
        }
        return MessageDigest.isEqual(expected,
            MessageDigest.getInstance("SHA-256").digest(bytes));
    }
}
