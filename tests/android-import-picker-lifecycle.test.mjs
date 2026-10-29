import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL(
 '../android/app/src/main/java/com/pokebacon/cubemobile/MainActivity.java',
 import.meta.url),'utf8');
const gate=readFileSync(new URL(
 '../android/app/src/main/java/com/pokebacon/cubemobile/ImportPickerGate.java',
 import.meta.url),'utf8');

test('native import picker refuses overlapping requests before replacing callbacks',()=>{
 const begin=source.indexOf('if (!importPickerGate.begin())');
 const callback=source.indexOf('fileCallback = callback;',begin);
 const start=source.indexOf('startActivityForResult(intent, PICK_FILE);',callback);
 assert.ok(begin>0&&callback>begin&&start>callback);
 assert.match(source.slice(begin,callback),/callback\.onReceiveValue\(null\)/);
 assert.match(source.slice(start,start+250),/importPickerGate\.consume\(\)/);
});
test('WebView reload invalidates callback without consuming Android picker ticket',()=>{
 const start=source.indexOf('onPageStarted(WebView view, String url');
 const end=source.indexOf('@Override public void onPageFinished',start);
 const handler=source.slice(start,end);
 assert.match(handler,/fileCallback\.onReceiveValue\(null\)/);
 assert.match(handler,/importPickerGate\.invalidate\(\)/);
 assert.doesNotMatch(handler,/importPickerGate\.consume\(\)/);
 assert.match(gate,/void invalidate\(\)\s*\{\s*callbackValid = false/);
});
test('Android picker result consumes outstanding ticket before delivering URI',()=>{
 const start=source.indexOf('if (requestCode != PICK_FILE) return;');
 const end=source.indexOf('Uri\[\] selected',start);
 const handler=source.slice(start,end);
 assert.match(handler,/boolean deliver = importPickerGate\.consume\(\)/);
 assert.match(handler,/if \(!deliver \|\| callback == null\) return/);
});
test('Activity recreation restores pending picker without restoring stale callback',()=>{
 assert.match(source,/state\.getBoolean\(IMPORT_PICKER_STATE, false\)/);
 assert.match(source,/importPickerGate\.restoreOutstanding\(\)/);
 assert.match(source,/outState\.putBoolean\(IMPORT_PICKER_STATE, importPickerGate\.isInFlight\(\)\)/);
 assert.match(gate,/void restoreOutstanding\(\)/);
 assert.match(gate,/callbackValid = false/);
});
