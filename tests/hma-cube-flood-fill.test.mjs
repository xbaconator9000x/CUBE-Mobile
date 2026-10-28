import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planHmaCubeViewportFloodFill} from '../src/hma-cube-cell-batch.js';

const grid=(words,width)=>({cells:Array.from({length:words.length/width},(_,y)=>
  Array.from({length:width},(_,x)=>{
    const raw=words[y*width+x];
    return {x:x+4,y:y+7,raw,tileId:raw&1023,collision:raw>>>10};
  }))});
test('tile matching floods four-neighbor cells but not diagonals, preserving original words',()=>{
 const image=grid([1,1,2,1,2,2,3,2,1],3);
 const plan=planHmaCubeViewportFloodFill(image,{seedX:4,seedY:7,
  tileId:512,collision:15});
 assert.deepEqual(plan.changes.map(c=>[c.x,c.y,c.expectedRaw]),[
  [4,7,1],[5,7,1],[4,8,1]]);
 assert.equal(plan.matchedCells,3);
 assert.equal(plan.touchesViewportEdge,true);
 assert.equal(plan.writeAuthorized,false);
 assert.ok(Object.isFrozen(plan.changes));
 assert.equal(image.cells[0][0].raw,1);
});
test('exact matching distinguishes raw high bits; tile matching does not',()=>{
 const image=grid([1,1025,1,2],2);
 const args={seedX:4,seedY:7,tileId:2,collision:7};
 assert.equal(planHmaCubeViewportFloodFill(image,{...args,matchMode:'exact'}).matchedCells,2);
 assert.equal(planHmaCubeViewportFloodFill(image,{...args,matchMode:'tile'}).matchedCells,3);
});
test('large flood fails atomically instead of returning truncated changes',()=>{
 const image=grid(Array(40).fill(1),8);
 assert.throws(()=>planHmaCubeViewportFloodFill(image,{
  seedX:4,seedY:7,tileId:3,collision:0}),/exceeds 32-cell budget/);
});
test('invalid grid, seed, proposal and match mode fail closed',()=>{
 const image=grid([1,2,3,4],2);
 const args={seedX:4,seedY:7,tileId:2,collision:0};
 for(const invalid of [{seedX:3},{seedY:10},{tileId:1024},
  {collision:64},{matchMode:'walkable'},{maxCells:0}])
  assert.throws(()=>planHmaCubeViewportFloodFill(image,{...args,...invalid}));
 assert.throws(()=>planHmaCubeViewportFloodFill({cells:[[image.cells[0][0],image.cells[0][0]]]},args));
 assert.throws(()=>planHmaCubeViewportFloodFill({cells:[[{
  ...image.cells[0][0],tileId:7}]]},args));
});
test('touch UI and standalone include flood controls and fail-closed queue preflight',async()=>{
 const root=new URL('../',import.meta.url);
 const read=p=>readFile(new URL(p,root),'utf8');
 const [app,html,offline,builder]=await Promise.all([
  read('src/app.js'),read('index.html'),
  read('app/CUBHMA_Mobile_Lab_Offline.html'),read('build-standalone.mjs')]);
 for(const page of [html,offline])
  for(const id of ['cube-map-flood-match','cube-map-batch-flood'])
   assert.ok(page.includes('id="'+id+'"'),id);
 for(const code of [app,offline]){
  assert.match(code,/planHmaCubeViewportFloodFill/);
  assert.match(code,/appendCubeBatchProposals\(snapshot,plan\.changes\)/);
  assert.match(code,/cube-map-batch-flood'\)\.disabled=true/);
  assert.match(code,/cube-map-batch-flood'\)\.disabled=false/);
 }
 assert.match(builder,/planHmaCubeViewportFloodFill/);
});

test('high-bit matching and collision-only painting preserve individual metatile IDs',()=>{
 const image=grid([1,1025,2,1026],2);
 const plan=planHmaCubeViewportFloodFill(image,{seedX:4,seedY:7,
  collision:19,matchMode:'high'});
 assert.deepEqual(plan.changes.map(c=>[c.x,c.y,c.expectedRaw]),[
  [4,7,1],[4,8,2]]);
 assert.ok(plan.changes.every(c=>!Object.hasOwn(c,'tileId')&&c.collision===19));
 const tileOnly=planHmaCubeViewportFloodFill(image,{
  seedX:4,seedY:7,tileId:100,matchMode:'tile'});
 assert.ok(tileOnly.changes.every(c=>!Object.hasOwn(c,'collision')));
 assert.throws(()=>planHmaCubeViewportFloodFill(image,{
  seedX:4,seedY:7,matchMode:'high'}),/Specify a tile ID/);
});
test('collision-only controls are available in both mobile builds',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
 const [html,app,offline]=await Promise.all([
  read('index.html'),read('src/app.js'),read('app/CUBHMA_Mobile_Lab_Offline.html')]);
 for(const page of [html,offline]){
  assert.match(page,/id="cube-map-apply-fields"/);
  assert.match(page,/value="high">Collision\/elevation only/);
  assert.match(page,/value="high">Same raw collision\/elevation bits/);
 }
 for(const source of [app,offline]){
  assert.match(source,/mode==='tile'\?\{tileId\}:\{collision\}/);
  assert.match(source,/changes\.push\(\{x,y,\.\.\.proposal,expectedRaw:cell\.raw\}\)/);
  assert.match(source,/seedX:selected\.x,seedY:selected\.y,\.\.\.proposal,matchMode/);
 }
});
