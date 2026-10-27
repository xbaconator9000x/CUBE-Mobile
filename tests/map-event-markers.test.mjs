import test from 'node:test';
import assert from 'node:assert/strict';
import {indexMapEventMarkers} from '../src/map-viewport.js';

const sample={
 objects:[{index:0,x:2,y:3},{index:1,x:2,y:3},{index:2,x:999,y:999}],
 scripts:[{index:0,x:2,y:3}],
 signposts:[{index:0,x:4,y:5}]
};
test('indexes raw object/script/signpost positions without assigning passability',()=>{
 const markers=indexMapEventMarkers(sample,{width:12,height:10});
 assert.deepEqual(markers['2,3'],['O0','O1','S0']);
 assert.deepEqual(markers['4,5'],['P0']);
 assert.equal(markers['999,999'],undefined);
 assert.ok(Object.isFrozen(markers)&&Object.isFrozen(markers['2,3']));
 assert.deepEqual(sample.objects[0],{index:0,x:2,y:3});
});
test('invalid record indexes, arrays and map dimensions fail closed',()=>{
 for(const bad of [{...sample,objects:[{index:-1,x:0,y:0}]},
  {...sample,scripts:[{index:0,x:1.2,y:0}]},
  {...sample,signposts:null},null])
   assert.throws(()=>indexMapEventMarkers(bad,{width:12,height:10}));
 assert.throws(()=>indexMapEventMarkers(sample,{width:0,height:10}));
});
