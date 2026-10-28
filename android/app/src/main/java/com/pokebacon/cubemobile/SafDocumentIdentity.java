package com.pokebacon.cubemobile;

import java.net.URI;
import java.net.URLDecoder;
import java.util.Locale;

/**
 * Conservative comparison of Android Storage Access Framework document URIs.
 * A provider may return a tree-scoped and a direct URI for the same document;
 * URI.equals() alone does not catch that case. This is a guard, not proof that
 * different provider identities refer to different underlying storage.
 */
final class SafDocumentIdentity {
    private SafDocumentIdentity() { }

    static boolean aliases(String imported, String destination) {
        if (imported == null || destination == null) return false;
        if (imported.equals(destination)) return true;
        Identity source = identify(imported);
        Identity target = identify(destination);
        return source != null && target != null &&
            source.authority.equals(target.authority) &&
            source.documentId.equals(target.documentId);
    }

    private static Identity identify(String value) {
        try {
            URI uri = new URI(value);
            if (!"content".equalsIgnoreCase(uri.getScheme()) ||
                uri.getRawAuthority() == null || uri.getRawAuthority().isEmpty() ||
                uri.getRawPath() == null) return null;
            String[] parts = uri.getRawPath().split("/", -1);
            // SAF direct URIs use /document/<id>; tree-scoped URIs use
            // /tree/<tree-id>/document/<id>. Compare the final document ID.
            for (int i = parts.length - 2; i >= 0; i--) {
                if (!"document".equals(parts[i])) continue;
                if (parts[i + 1].isEmpty() || i + 2 != parts.length) return null;
                // URLDecoder treats '+' as space, unlike a URI path. Escape it
                // first so literal plus signs remain part of the document ID.
                String id = URLDecoder.decode(parts[i + 1].replace("+", "%2B"), "UTF-8");
                if (id.isEmpty()) return null;
                return new Identity(uri.getRawAuthority().toLowerCase(Locale.ROOT), id);
            }
        } catch (Exception ignored) {
            // Malformed/unknown URIs only get exact-string protection.
        }
        return null;
    }

    private static final class Identity {
        final String authority;
        final String documentId;
        Identity(String authority, String documentId) {
            this.authority = authority;
            this.documentId = documentId;
        }
    }
}
