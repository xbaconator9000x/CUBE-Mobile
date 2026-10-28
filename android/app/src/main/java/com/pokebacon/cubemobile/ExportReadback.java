package com.pokebacon.cubemobile;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Bounded streaming verification of a reopened SAF document. */
final class ExportReadback {
    private ExportReadback() { }

    static boolean verify(InputStream input, long expectedBytes, byte[] expectedSha256)
        throws IOException, NoSuchAlgorithmException {
        if (input == null || expectedBytes < 0 ||
            expectedBytes > 128L * 1024 * 1024 ||
            expectedSha256 == null || expectedSha256.length != 32)
            return false;
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] buffer = new byte[32768];
        long readTotal = 0;
        int count;
        while ((count = input.read(buffer)) != -1) {
            if (count <= 0 || count > expectedBytes - readTotal)
                return false;
            readTotal += count;
            digest.update(buffer, 0, count);
        }
        return readTotal == expectedBytes &&
            MessageDigest.isEqual(expectedSha256, digest.digest());
    }
}
