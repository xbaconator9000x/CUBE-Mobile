import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('touch event placement uses fresh pixel-validated CUBE selection',async()=>{
 const [app,controller,html,offline]=await Promise.all([
  read('src/app.js'),read('src/hma-cube-batch-mobile.js'),
  read('index.html'),read('app/CUBHMA_Mobile_Lab_Offline.html')
 ]);
 for(const page of [html,offline])
  for(const kind of ['warp','event'])
   assert.ok(page.includes('id="cube-batch-'+kind+'-use-cell"'));
 for(const source of [app,offline]){
  assert.match(source,/function validatedCubeSelectedCell\(/);
  assert.match(source,/JSON\.stringify\(fresh\.cells\)!==snapshot\.cellsJson/);
  assert.match(source,/fresh\.pixels\.every\(\(n,i\)=>n===snapshot\.pixels\[i\]\)/);
  assert.match(source,/cell\.byteOffset!==selection\.cellOffset/);
  assert.match(source,/getSelectedCell:validatedCubeSelectedCell/);
 }
 assert.match(controller,/function fillFromRenderedCell\(kind\)/);
 assert.match(controller,/current\(selection\.snapshot\)/);
 assert.match(controller,/getSelectedCell\(\)/);
 assert.match(controller,/cube-batch-warp-use-cell/);
 assert.match(controller,/cube-batch-event-use-cell/);
 assert.match(controller,/Queue and verify explicitly/);
});
