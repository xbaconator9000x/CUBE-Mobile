import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('CUBE multi-cell preview queue is wired into modular and offline apps',async()=>{
 const [html,app,build,offline]=await Promise.all([
  read('index.html'),read('src/app.js'),read('build-standalone.mjs'),
  read('app/CUBHMA_Mobile_Lab_Offline.html')]);
 for(const page of [html,offline])
  for(const id of ['cube-map-batch-add','cube-map-batch-preview',
   'cube-map-batch-clear','cube-map-batch-status','cube-map-batch-list'])
   assert.ok(page.includes('id="'+id+'"'),id);
 for(const source of [app,offline]){
  assert.match(source,/previewHmaCubeCellBatch\(model,mapBankCustomSummary/);
  assert.match(source,/clearCubeBatchQueue\(\)/);
  assert.match(source,/expectedRaw:selected\.raw/);
  assert.match(source,/partial census cannot prove exclusivity/);
 }
 assert.match(build,/stripHmaCubeCellBatch/);
 assert.match(offline,/const \{previewHmaCubeCellBatch,planHmaCubeViewportFloodFill\}=\(\(\)=>/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
