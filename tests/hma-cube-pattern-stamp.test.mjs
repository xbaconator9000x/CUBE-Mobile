import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planHmaCubeViewportStamp} from '../src/hma-cube-cell-batch.js';
const image=(words,width)=>({cells:Array.from({length:words.length/width},(_,y)=>
 Array.from({length:width},(_,x)=>{
  const raw=words[y*width+x];
  return {x:x+10,y:y+20,raw,tileId:raw&1023,collision:raw>>>10};
 }))});
test('stamp copies original pattern and preserves destination originals',()=>{
 const view=image([1,1026,3,4,5,6,7,8,9,10,11,12],4);
 const plan=planHmaCubeViewportStamp(view,{sourceX:10,sourceY:20,
  targetX:12,targetY:21,width:2,height:2});
 assert.deepEqual(plan.changes.map(c=>[c.x,c.y,c.tileId,c.collision,c.expectedRaw]),[
  [12,21,1,0,7],[13,21,2,1,8],[12,22,5,0,11],[13,22,6,0,12]]);
 assert.equal(plan.sourceOverlapsDestination,false);
 assert.equal(plan.writeAuthorized,false);
 assert.ok(Object.isFrozen(plan.changes));
 assert.equal(view.cells[0][1].raw,1026);
});
test('overlapping copy samples the original snapshot rather than cascading',()=>{
 const view=image([1,2,3,4],4);
 const plan=planHmaCubeViewportStamp(view,{sourceX:10,sourceY:20,
  targetX:11,targetY:20,width:3,height:1,fields:'tile'});
 assert.deepEqual(plan.changes.map(c=>[c.tileId,c.expectedRaw]),[
  [1,2],[2,3],[3,4]]);
 assert.ok(plan.sourceOverlapsDestination);
 assert.ok(plan.changes.every(c=>!Object.hasOwn(c,'collision')));
});
test('collision-only stamps preserve destination tile IDs',()=>{
 const view=image([1025,2049,3,4],2);
 const plan=planHmaCubeViewportStamp(view,{sourceX:10,sourceY:20,
  targetX:10,targetY:21,width:2,height:1,fields:'high'});
 assert.deepEqual(plan.changes.map(c=>[c.collision,c.expectedRaw]),[[1,3],[2,4]]);
 assert.ok(plan.changes.every(c=>!Object.hasOwn(c,'tileId')));
});
test('out-of-viewport, malformed, oversized and invalid fields fail closed',()=>{
 const view=image(Array(40).fill(1),8);
 const args={sourceX:10,sourceY:20,targetX:10,targetY:20,width:2,height:2};
 for(const override of [{width:9},{height:9},{width:8,height:5},
  {targetX:17},{targetY:25},{sourceX:9},{fields:'walkable'},
  {maxCells:0}])
  assert.throws(()=>planHmaCubeViewportStamp(view,{...args,...override}));
 assert.throws(()=>planHmaCubeViewportStamp({cells:[[{
  ...view.cells[0][0],raw:65536}]]},args));
});
test('mobile and offline provide bounded source-to-target stamp workflow',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
 const [html,app,offline,build]=await Promise.all([
  read('index.html'),read('src/app.js'),
  read('app/CUBHMA_Mobile_Lab_Offline.html'),read('build-standalone.mjs')]);
 for(const page of [html,offline])for(const id of [
  'cube-map-stamp-target-x','cube-map-stamp-target-y','cube-map-stamp-width',
  'cube-map-stamp-height','cube-map-batch-stamp'])
  assert.ok(page.includes('id="'+id+'"'),id);
 for(const source of [app,offline]){
  assert.match(source,/planHmaCubeViewportStamp/);
  assert.match(source,/appendCubeBatchProposals\(snapshot,plan\.changes\)/);
  assert.match(source,/cube-map-batch-stamp'\)\.disabled=true/);
  assert.match(source,/cube-map-batch-stamp'\)\.disabled=false/);
 }
 assert.match(build,/planHmaCubeViewportStamp/);
});
