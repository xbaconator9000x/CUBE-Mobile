import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('inspected CUBE records offer touch-to-edit with source revalidation',async()=>{
 const [app,offline,html]=await Promise.all([
  read('src/app.js'),read('app/CUBHMA_Mobile_Lab_Offline.html'),read('index.html')
 ]);
 for(const source of [app,offline]){
  assert.match(source,/Edit '\+labels\[kind\]\.toLowerCase\(\)/);
  assert.match(source,/CUBE event inspection expired/);
  assert.match(source,/JSON\.stringify\(now\)!==JSON\.stringify\(snapshot\.report\)/);
  assert.match(source,/\$\('cube-batch-warp-index'\)\.value=String\(record\.index\)/);
  assert.match(source,/\$\('cube-batch-warp-load'\)\.click\(\)/);
  assert.match(source,/\$\('cube-batch-event-kind'\)\.value=kind/);
  assert.match(source,/\$\('cube-batch-event-load'\)\.click\(\)/);
 }
 assert.match(html,/id="cube-batch-warp-load"/);
 assert.match(html,/id="cube-batch-event-load"/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
