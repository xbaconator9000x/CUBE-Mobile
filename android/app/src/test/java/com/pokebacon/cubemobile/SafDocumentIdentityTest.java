package com.pokebacon.cubemobile;

import org.junit.Test;
import static org.junit.Assert.*;

public class SafDocumentIdentityTest {
    @Test public void pickerRequiresWellFormedContentUri() {
        assertTrue(SafDocumentIdentity.isContentUri(
            "content://com.example.documents/document/primary%3Agame.gba"));
        assertFalse(SafDocumentIdentity.isContentUri("file:///sdcard/game.gba"));
        assertFalse(SafDocumentIdentity.isContentUri("https://example.com/game.gba"));
        assertFalse(SafDocumentIdentity.isContentUri("content:///document/game.gba"));
        assertFalse(SafDocumentIdentity.isContentUri("content://example.documents"));
        assertFalse(SafDocumentIdentity.isContentUri("content://example.documents/%ZZ"));
        assertFalse(SafDocumentIdentity.isContentUri(null));
    }

    @Test public void exactUriIsProtectedEvenWithoutSafShape() {
        assertTrue(SafDocumentIdentity.aliases("content://other/item/4", "content://other/item/4"));
        assertFalse(SafDocumentIdentity.aliases(null, "content://other/item/4"));
        assertFalse(SafDocumentIdentity.aliases("content://other/item/4", null));
    }

    @Test public void directAndTreeScopedUrisWithSameDocumentIdAreAliases() {
        String direct = "content://com.example.documents/document/primary%3AROM%2Fgame.gba";
        String tree = "content://COM.EXAMPLE.DOCUMENTS/tree/primary%3A/document/primary%3AROM%2Fgame.gba";
        assertTrue(SafDocumentIdentity.aliases(direct, tree));
        assertTrue(SafDocumentIdentity.aliases(tree, direct));
    }

    @Test public void percentEncodingAndQueryDoNotHideSameDocumentId() {
        String first = "content://example.documents/document/primary%3Agame.gba";
        String second = "content://example.documents/document/primary%3agame.gba?mode=read#section";
        assertTrue(SafDocumentIdentity.aliases(first, second));
        assertTrue(SafDocumentIdentity.aliases(
            "content://example.documents/document/a+b",
            "content://example.documents/document/a%2Bb"));
        assertFalse(SafDocumentIdentity.aliases(
            "content://example.documents/document/a+b",
            "content://example.documents/document/a%20b"));
    }

    @Test public void differentAuthoritiesOrDocumentIdsAreNotEquated() {
        String first = "content://one.documents/document/primary%3Agame.gba";
        assertFalse(SafDocumentIdentity.aliases(first,
            "content://two.documents/document/primary%3Agame.gba"));
        assertFalse(SafDocumentIdentity.aliases(first,
            "content://one.documents/document/primary%3Aother.gba"));
    }

    @Test public void malformedAndUnknownProviderUrisNeverInventIdentity() {
        assertFalse(SafDocumentIdentity.aliases(
            "content://example.documents/document/%ZZ",
            "content://example.documents/document/%25ZZ"));
        assertFalse(SafDocumentIdentity.aliases(
            "content://example.documents/unknown/file",
            "content://example.documents/unknown/file?alias=1"));
        assertFalse(SafDocumentIdentity.aliases(
            "https://example.documents/document/file",
            "content://example.documents/document/file"));
        assertFalse(SafDocumentIdentity.aliases(
            "content://example.documents/document/",
            "content://example.documents/document/file"));
    }
}
