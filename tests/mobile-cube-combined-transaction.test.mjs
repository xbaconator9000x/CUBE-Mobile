import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('combined copy-only transaction is available in modular and offline mobile',async()=>{
 const [app,controller,html,offline,build]=await Promise.all([
  read('src/app.js'),read('src/hma-cube-batch-mobile.js'),read('index.html'),
  read('app/CUBHMA_Mobile_Lab_Offline.html'),read('build-standalone.mjs')
 ]);
 for(const page of [html,offline])for(const id of [
  'cube-batch-combined-verify','cube-batch-combined-status'
 ])assert.ok(page.includes('id="'+id+'"'));
 assert.match(controller,/verifyHmaCubeCombinedTransaction\(/);
 assert.match(controller,/ctx\.cellSnapshot!==ctx\.cellEvidence/);
 assert.match(controller,/r\.inMemoryRollbackVerified/);
 assert.match(app,/cellQueue:cubeCellBatchQueue/);
 assert.match(app,/cellSnapshot:cubeCellBatchSnapshot/);
 assert.match(build,/stripHmaCubeCombinedTransaction/);
 assert.match(offline,/const verifyHmaCubeCombinedTransaction=\(\(\)=>/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
