import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('CUBE rectangle brush queues only bounded viewport cells and preserves originals',async()=>{
 const [app,html,offline]=await Promise.all([
  read('src/app.js'),read('index.html'),read('app/CUBHMA_Mobile_Lab_Offline.html')]);
 for(const page of [html,offline])
  for(const id of ['cube-map-brush-width','cube-map-brush-height','cube-map-batch-brush'])
   assert.ok(page.includes('id="'+id+'"'),id);
 for(const source of [app,offline]){
  assert.match(source,/width\*height>32/);
  assert.match(source,/expectedRaw:cell\.raw/);
  assert.match(source,/appendCubeBatchProposals\(snapshot,changes\)/);
  assert.match(source,/Brush extends outside the rendered viewport/);
  assert.match(source,/cubeBatchProposalInputs\(\)/);
 }
});
