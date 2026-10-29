package com.pokebacon.cubemobile;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import org.junit.Test;
import static org.junit.Assert.*;

public class ImportedDocumentGuardTest {
    private static final String DIRECT =
        "content://docs.example/document/primary%3AROM%2Fgame.gba";
    private static final String TREE =
        "content://docs.example/tree/primary%3A/document/primary%3AROM%2Fgame.gba";

    @Test public void importedDirectAndTreeScopedAliasesAreProtected() {
        ImportedDocumentGuard guard = new ImportedDocumentGuard();
        assertTrue(guard.rememberAll(Arrays.asList(DIRECT)));
        assertTrue(guard.protects(DIRECT));
        assertTrue(guard.protects(TREE));
        assertFalse(guard.protects("content://docs.example/document/another.gba"));
        assertTrue(guard.protects("file:///sdcard/game.gba"));
        assertTrue(guard.protects(null));
    }

    @Test public void invalidMultiSelectionNeverPartiallyMutatesGuard() {
        ImportedDocumentGuard guard = new ImportedDocumentGuard();
        assertTrue(guard.rememberAll(Arrays.asList(DIRECT)));
        ArrayList<String> before = guard.snapshot();
        assertFalse(guard.rememberAll(Arrays.asList(
            "content://docs.example/document/other", "file:///unsafe")));
        assertEquals(before, guard.snapshot());
        assertFalse(guard.rememberAll(Collections.emptyList()));
        assertEquals(before, guard.snapshot());
    }

    @Test public void importedDocumentIdentitySurvivesActivityStateRoundtrip() {
        ImportedDocumentGuard first = new ImportedDocumentGuard();
        assertTrue(first.rememberAll(Arrays.asList(DIRECT)));
        ImportedDocumentGuard restored = new ImportedDocumentGuard();
        restored.restore(first.snapshot());
        assertTrue(restored.protects(TREE));
        assertTrue(restored.rememberAll(Arrays.asList(
            "content://docs.example/document/second.gba")));
        assertEquals(2, restored.snapshot().size());
    }

    @Test public void malformedRestorationFailsClosedAcrossAnotherRecreation() {
        ImportedDocumentGuard guard = new ImportedDocumentGuard();
        guard.restore(new ArrayList<>(Arrays.asList("file:///unsafe")));
        assertTrue(guard.protects("content://docs.example/document/anything"));
        assertFalse(guard.rememberAll(Arrays.asList(DIRECT)));
        assertNull(guard.snapshot());
        ImportedDocumentGuard again = new ImportedDocumentGuard();
        again.restore(guard.snapshot());
        assertTrue(again.protects(TREE));
        assertNull(again.snapshot());
    }

    @Test public void maximumCountAndUriLengthAreBoundedAtomically() {
        ImportedDocumentGuard guard = new ImportedDocumentGuard();
        ArrayList<String> thirtyTwo = new ArrayList<>();
        for (int i = 0; i < ImportedDocumentGuard.MAX_DOCUMENTS; i++)
            thirtyTwo.add("content://docs.example/document/" + i);
        assertTrue(guard.rememberAll(thirtyTwo));
        assertFalse(guard.rememberAll(Arrays.asList(
            "content://docs.example/document/overflow")));
        assertEquals(ImportedDocumentGuard.MAX_DOCUMENTS, guard.snapshot().size());
        assertFalse(guard.rememberAll(Arrays.asList(
            "content://docs.example/document/" +
            "x".repeat(ImportedDocumentGuard.MAX_URI_LENGTH))));
        assertEquals(ImportedDocumentGuard.MAX_DOCUMENTS, guard.snapshot().size());
    }

    @Test public void emptyRestorationDoesNotInvalidateFreshActivity() {
        ImportedDocumentGuard guard = new ImportedDocumentGuard();
        guard.restore(new ArrayList<>());
        assertTrue(guard.rememberAll(Arrays.asList(DIRECT)));
        assertTrue(guard.protects(TREE));
    }
}
