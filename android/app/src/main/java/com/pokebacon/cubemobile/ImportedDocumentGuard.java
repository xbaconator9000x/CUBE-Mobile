package com.pokebacon.cubemobile;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;

/**
 * Bounded, atomic protection of documents imported through Android SAF.
 * The same document can be returned under direct and tree-scoped URIs.
 * State is retained across Activity recreation; malformed restored state
 * disables export rather than silently forgetting protected inputs.
 */
final class ImportedDocumentGuard {
    static final int MAX_DOCUMENTS = 32;
    static final int MAX_URI_LENGTH = 4096;
    private final LinkedHashSet<String> imported = new LinkedHashSet<>();
    private boolean untrusted;

    boolean rememberAll(Collection<String> candidates) {
        if (untrusted || candidates == null || candidates.isEmpty() ||
            candidates.size() > MAX_DOCUMENTS) return false;
        LinkedHashSet<String> next = new LinkedHashSet<>(imported);
        for (String value : candidates) {
            if (value == null || value.length() > MAX_URI_LENGTH ||
                !SafDocumentIdentity.isContentUri(value)) return false;
            next.add(value);
            if (next.size() > MAX_DOCUMENTS) return false;
        }
        imported.clear();
        imported.addAll(next);
        return true;
    }

    /** A missing/invalid restoration must not erase the previous safety claim. */
    void restore(ArrayList<String> saved) {
        if (saved == null || (saved.size() > 0 && !rememberAll(saved))) {
            invalidate();
        }
    }

    void invalidate() {
        imported.clear();
        untrusted = true;
    }

    boolean protects(String destination) {
        if (untrusted || destination == null ||
            !SafDocumentIdentity.isContentUri(destination)) return true;
        for (String value : imported)
            if (SafDocumentIdentity.aliases(value, destination)) return true;
        return false;
    }

    /** A null saved value carries the fail-closed state across recreation. */
    ArrayList<String> snapshot() {
        return untrusted ? null : new ArrayList<>(imported);
    }
}
