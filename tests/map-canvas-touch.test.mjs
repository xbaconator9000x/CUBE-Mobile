import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRenderedMapPixel,projectRenderedMapMarkers} from '../src/map-viewport.js';
const cells=[[{x:10,y:20,byteOffset:0x100},{x:11,y:20,byteOffset:0x102}],
 [{x:10,y:21,byteOffset:0x104},{x:11,y:21,byteOffset:0x106}]];
const attributes=cells.map(row=>row.map(cell=>({behavior:0x22,layer:1,attributeOffset:cell.byteOffset+0x200})));
const view={columns:2,rows:2,cells,attributes};
test('canvas hit test maps 16px cells to source byte provenance',()=>{
 const a=inspectRenderedMapPixel(view,31.99,0);
 assert.equal(a.cell.byteOffset,0x102);
 assert.equal(a.attribute.attributeOffset,0x302);
 assert.equal(inspectRenderedMapPixel(view,0,31.99).cell.byteOffset,0x104);
 for(const [x,y] of [[32,0],[-1,0],[0,32],[0,-1],[NaN,0]])
  assert.equal(inspectRenderedMapPixel(view,x,y),null);
 assert.ok(Object.isFrozen(a));
});
test('event/warp projections retain raw indexes and local canvas cells',()=>{
 const projected=projectRenderedMapMarkers(view,{'11,20':[0,2]},{'11,20':['O1'],'10,21':['S0']});
 assert.equal(projected.length,2);
 assert.deepEqual(projected[0],{column:1,row:0,x:11,y:20,warps:[0,2],events:['O1']});
 assert.deepEqual(projected[1],{column:0,row:1,x:10,y:21,warps:[],events:['S0']});
 assert.ok(Object.isFrozen(projected)&&Object.isFrozen(projected[0].warps));
 assert.deepEqual(projectRenderedMapMarkers(view),[]);
});
test('invalid cell provenance and marker arrays fail closed',()=>{
 assert.throws(()=>inspectRenderedMapPixel({},0,0));
 assert.throws(()=>inspectRenderedMapPixel({...view,cells:[[{}]]},0,0));
 assert.throws(()=>projectRenderedMapMarkers(view,{'10,20':42}),/Invalid marker/);
});
