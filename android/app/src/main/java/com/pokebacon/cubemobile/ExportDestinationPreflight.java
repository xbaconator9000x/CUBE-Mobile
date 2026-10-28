package com.pokebacon.cubemobile;

import java.io.IOException;
import java.io.InputStream;

/** Conservative preflight before a SAF provider can truncate a destination. */
final class ExportDestinationPreflight {
    private ExportDestinationPreflight() { }

    static boolean isEmpty(InputStream input) throws IOException {
        // Unknown or unreadable destinations are not proven empty.
        return input != null && input.read() == -1;
    }
}
