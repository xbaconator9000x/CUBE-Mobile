import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('touchscreen and offline expose bounded second-hop raw HMA target inspection',async()=>{
 const [app,html,offline,build]=await Promise.all([
  readFile(new URL('../src/app.js',import.meta.url),'utf8'),
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../app/CUBHMA_Mobile_Lab_Offline.html',import.meta.url),'utf8'),
  readFile(new URL('../build-standalone.mjs',import.meta.url),'utf8')
 ]);
 for(const page of [html,offline])
  for(const id of ['map-bank-target-scan','map-bank-target-status','map-bank-target-list'])
   assert.match(page,new RegExp('id="'+id+'"'));
 assert.match(app,/inspectHmaDeclaredBankTargetWindows\(ensureModel\(\),mapBankMetadataReport/);
 assert.match(app,/JSON\.stringify\(now\.rows\)!==JSON\.stringify\(report\.rows\)/);
 assert.match(app,/mapBankTargetEvidence=null/);
 assert.match(app,/drawMapBankTargetEvidence\(\)/);
 assert.match(build,/stripHmaMapTargetWindows/);
 assert.match(offline,/function inspectHmaDeclaredBankTargetWindows/);
 assert.doesNotMatch(offline,/import \{inspectHmaDeclaredBankTargetWindows\}/);
});
