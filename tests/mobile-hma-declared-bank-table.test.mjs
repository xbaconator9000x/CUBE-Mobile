import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('mobile and offline expose bounded declared CUBE pointer slots and safe navigation',async()=>{
 const [app,html,offline,build]=await Promise.all([
  readFile(new URL('../src/app.js',import.meta.url),'utf8'),
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../app/CUBHMA_Mobile_Lab_Offline.html',import.meta.url),'utf8'),
  readFile(new URL('../build-standalone.mjs',import.meta.url),'utf8')
 ]);
 for(const source of [html,offline]){
  for(const id of ['map-bank-declared-scan','map-bank-declared-status','map-bank-declared-list'])
   assert.match(source,new RegExp('id="'+id+'"'));
 }
 assert.match(app,/inspectHmaDeclaredBankPointerTable\(ensureModel\(\),mapBankMetadataReport\)/);
 assert.match(app,/now\.rows\.some\(\(r,i\)=>r\.rawWord!==report\.rows\[i\]\.rawWord/);
 assert.match(app,/mapBankDeclaredEvidence!==report/);
 assert.match(app,/mapBankDeclaredEvidence=null/);
 assert.match(app,/drawMapBankDeclaredEvidence\(\)/);
 assert.match(app,/report\.declaredBankCount/);
 assert.match(build,/hma-map-bank-declared-table\.js/);
 assert.match(offline,/function inspectHmaDeclaredBankPointerTable/);
 assert.doesNotMatch(offline,/import \{inspectHmaDeclaredBankPointerTable\}/);
});
