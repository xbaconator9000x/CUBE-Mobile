import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Android Activity persists export picker ticket through recreation',()=>{
 const main=read('android/app/src/main/java/com/pokebacon/cubemobile/MainActivity.java');
 const native=read('android/app/src/main/java/com/pokebacon/cubemobile/NativeExport.java');
 const gate=read('android/app/src/main/java/com/pokebacon/cubemobile/ExportPickerGate.java');
 assert.match(main,/EXPORT_PICKER_STATE = "cube\.exportPickerOutstanding"/);
 assert.match(main,/nativeExport\.restoreOutstandingPicker\(\)/);
 assert.match(main,/nativeExport\.hasOutstandingPicker\(\)/);
 assert.match(native,/pickerGate\.restoreOutstanding\(\)/);
 assert.match(native,/return pickerGate\.isInFlight\(\)/);
 assert.match(gate,/restoredOutstanding \|\| launchedSession != null/);
 assert.match(gate,/restoredOutstanding = false;/);
});
