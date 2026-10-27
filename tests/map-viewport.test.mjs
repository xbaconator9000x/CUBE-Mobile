import test from 'node:test';
import assert from 'node:assert/strict';
import {panMapViewport,indexMapWarpMarkers} from '../src/map-viewport.js';
test('touch panning advances by viewport and clamps to map bounds',()=>{
 assert.deepEqual(panMapViewport({width:30,height:24,x:0,y:0,dx:12,dy:10}),{x:12,y:10});
 assert.deepEqual(panMapViewport({width:30,height:24,x:12,y:10,dx:12,dy:10}),{x:18,y:14});
 assert.deepEqual(panMapViewport({width:30,height:24,x:0,y:0,dx:-12,dy:-10}),{x:0,y:0});
});
test('small maps do not pan outside their visible extent',()=>{
 assert.deepEqual(panMapViewport({width:4,height:3,x:0,y:0,dx:12,dy:10}),{x:0,y:0});
});
test('invalid dimensions, origins and fractional pan steps fail closed',()=>{
 for(const v of [{width:0,height:1},{width:1,height:1025},
   {width:5,height:5,x:5},{width:5,height:5,y:-1},
   {width:5,height:5,dx:1.5}])
  assert.throws(()=>panMapViewport(v));
});
test('warp markers preserve multiple IDs on one cell and reject off-map markers',()=>{
 const warps=[{index:0,x:1,y:2},{index:1,x:1,y:2},{index:2,x:99,y:99}];
 const before=structuredClone(warps);
 const out=indexMapWarpMarkers(warps,{width:10,height:10});
 assert.deepEqual(out['1,2'],[0,1]);assert.equal(out['99,99'],undefined);
 assert.equal(Object.isFrozen(out),true);assert.equal(Object.isFrozen(out['1,2']),true);
 assert.deepEqual(warps,before);
});
test('malformed warp arrays and indices fail closed',()=>{
 for(const input of [null,Array(256).fill({index:0,x:0,y:0}),
   [{index:-1,x:0,y:0}],[{index:0,x:1.5,y:0}],[{index:0,x:0,y:NaN}]])
   assert.throws(()=>indexMapWarpMarkers(input,{width:10,height:10}));
});
