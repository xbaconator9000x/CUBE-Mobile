import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planHmaCubeViewportReplace} from '../src/hma-cube-cell-batch.js';
const view=(raw,width)=>({cells:Array.from({length:raw.length/width},(_,y)=>
 Array.from({length:width},(_,x)=>{
  const word=raw[y*width+x];
  return {x:x+3,y:y+5,raw:word,tileId:word&1023,collision:word>>>10};
 }))});
test('visible replacement includes disconnected matching cells',()=>{
 const image=view([1,2,1,3,4,1,2,1],4);
 const plan=planHmaCubeViewportReplace(image,{seedX:3,seedY:5,
  tileId:600,matchMode:'tile'});
 assert.deepEqual(plan.changes.map(c=>[c.x,c.y,c.expectedRaw]),[
  [3,5,1],[5,5,1],[4,6,1],[6,6,1]]);
 assert.ok(plan.changes.every(c=>!Object.hasOwn(c,'collision')));
 assert.equal(plan.writeAuthorized,false);
 assert.equal(image.cells[0][0].raw,1);
});
test('high-bit and exact modes distinguish raw cell fields',()=>{
 const image=view([1,1025,2,1026],2);
 const base={seedX:3,seedY:5,collision:7};
 assert.deepEqual(planHmaCubeViewportReplace(image,{...base,matchMode:'high'})
  .changes.map(c=>c.expectedRaw),[1,2]);
 assert.deepEqual(planHmaCubeViewportReplace(image,{...base,matchMode:'exact'})
  .changes.map(c=>c.expectedRaw),[1]);
});
test('more than 32 matching cells rejects without partial queue',()=>{
 const image=view(Array(40).fill(1),8);
 assert.throws(()=>planHmaCubeViewportReplace(image,{seedX:3,seedY:5,
  tileId:2}),/exceeds 32-cell budget/);
});
test('invalid grid, selected coordinates and field modes fail closed',()=>{
 const image=view([1,2,3,4],2);
 const base={seedX:3,seedY:5,tileId:2};
 for(const bad of [{seedX:2},{seedY:8},{tileId:1024},
  {collision:64},{matchMode:'diagonal'},{maxCells:0}])
  assert.throws(()=>planHmaCubeViewportReplace(image,{...base,...bad}));
 assert.throws(()=>planHmaCubeViewportReplace(image,{seedX:3,seedY:5}));
 assert.throws(()=>planHmaCubeViewportReplace({cells:[[{
  ...image.cells[0][0],tileId:7}]]},base));
});
test('replace controls and queue preflight exist in mobile and offline builds',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
 const [html,app,offline,build]=await Promise.all([
  read('index.html'),read('src/app.js'),
  read('app/CUBHMA_Mobile_Lab_Offline.html'),read('build-standalone.mjs')]);
 for(const page of [html,offline])assert.match(page,/id="cube-map-batch-replace"/);
 for(const code of [app,offline]){
  assert.match(code,/planHmaCubeViewportReplace/);
  assert.match(code,/appendCubeBatchProposals\(snapshot,plan\.changes\)/);
  assert.match(code,/cube-map-batch-replace'\)\.disabled=true/);
  assert.match(code,/cube-map-batch-replace'\)\.disabled=false/);
 }
 assert.match(build,/planHmaCubeViewportReplace/);
});
