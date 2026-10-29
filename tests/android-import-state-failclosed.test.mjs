import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL(
 '../android/app/src/main/java/com/pokebacon/cubemobile/MainActivity.java',
 import.meta.url),'utf8');

test('Activity recreation treats missing imported-document state as untrusted',()=>{
 const start=main.indexOf('if (state != null) {');
 const end=main.indexOf('if (state != null && state.getBoolean(IMPORT_PICKER_STATE',start);
 assert.ok(start>=0&&end>start);
 const restore=main.slice(start,end);
 assert.match(restore,/if \(!state\.containsKey\(IMPORTED_DOCUMENTS_STATE\)\) \{/);
 assert.match(restore,/importedDocuments\.invalidate\(\)/);
 assert.match(restore,/importedDocuments\.restore\(state\.getStringArrayList\(IMPORTED_DOCUMENTS_STATE\)\)/);
 assert.match(restore,/catch \(RuntimeException malformedState\)/);
 assert.match(main,/outState\.putStringArrayList\(IMPORTED_DOCUMENTS_STATE, importedDocuments\.snapshot\(\)\)/);
});

test('malformed Android document picker response cancels rather than crashing import',()=>{
 const start=main.indexOf('if (requestCode != PICK_FILE) return;');
 const end=main.indexOf('@Override public void onBackPressed()',start);
 assert.ok(start>=0&&end>start);
 const result=main.slice(start,end);
 assert.match(result,/boolean deliver = importPickerGate\.consume\(\)/);
 assert.match(result,/try \{[\s\S]*?FileChooserParams\.parseResult\(resultCode, data\)/);
 assert.match(result,/catch \(RuntimeException malformedResult\) \{\s*selected = null;/);
 assert.match(result,/callback\.onReceiveValue\(selected\)/);
 assert.match(result,/importedDocuments\.rememberAll\(picked\)/);
});
