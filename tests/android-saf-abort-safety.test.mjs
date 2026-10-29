import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/**
 * Source-level safety contract only. The Android build separately compiles
 * NativeExport; physical SAF provider behavior still requires device testing.
 */
test('SAF export abort never deletes an unproven provider-owned document',()=>{
  const source=readFileSync(new URL(
    '../android/app/src/main/java/com/pokebacon/cubemobile/NativeExport.java',
    import.meta.url),'utf8');
  const start=source.indexOf('    void abort(String message) {');
  const end=source.indexOf('    void close() {',start);
  assert.ok(start>=0&&end>start,'NativeExport abort boundary must exist');
  const abort=source.slice(start,end);
  assert.doesNotMatch(abort,/getContentResolver\(\)\.delete\s*\(/,
    'A picker result and attempted write are not ownership proof');
  assert.match(abort,/mayContainOurBytes/);
  assert.match(abort,/partial document may remain, please delete it/);
  assert.match(abort,/destination = null;/);
  assert.match(source,/void close\(\) \{[\s\S]*?abort\("Export cancelled"\)/);
  assert.match(source,/void dispose\(\) \{[\s\S]*?close\(\)/);
});
