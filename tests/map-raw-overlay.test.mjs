import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVanillaRawMapOverlay} from '../src/map-raw-overlay.js';
const attr=(x,y,collision,behavior,terrain=null,encounter=null)=>({x,y,collision,behavior,terrain,encounter});
const rendered={columns:3,rows:2,attributes:[
 [attr(5,8,0,0x10,1,0),attr(6,8,2,0x20,2,1),attr(7,8,2,0x20,2,1)],
 [attr(5,9,63,0x10,1,0),attr(6,9,0,0x40,0,3),attr(7,9,2,0x20,2,1)]
]};
test('raw six-bit overlays are bounded, deterministic, and count visible cells only',()=>{
 const before=JSON.stringify(rendered),a=buildVanillaRawMapOverlay(rendered),b=buildVanillaRawMapOverlay(rendered);
 assert.deepEqual(a,b);assert.equal(a.cells.length,6);assert.equal(a.distinctValues,3);
 assert.deepEqual(a.legend.map(x=>[x.value,x.count]),[[2,3],[0,2],[63,1]]);
 assert.equal(a.cells[0].x,5);assert.equal(a.cells[0].y,8);
 assert.equal(a.walkabilityVerified,false);assert.equal(a.layoutAuthenticated,false);
 assert.equal(JSON.stringify(rendered),before);
});
test('behavior, FRLG terrain and encounter remain separate raw categories',()=>{
 assert.deepEqual(buildVanillaRawMapOverlay(rendered,{mode:'behavior'}).legend.map(x=>[x.value,x.count]),[[32,3],[16,2],[64,1]]);
 assert.deepEqual(buildVanillaRawMapOverlay(rendered,{mode:'terrain'}).legend.map(x=>[x.value,x.count]),[[2,3],[1,2],[0,1]]);
 assert.deepEqual(buildVanillaRawMapOverlay(rendered,{mode:'encounter'}).legend.map(x=>[x.value,x.count]),[[1,3],[0,2],[3,1]]);
 assert.notDeepEqual(buildVanillaRawMapOverlay(rendered,{mode:'highBits'}).cells[0].rgb,
  buildVanillaRawMapOverlay(rendered,{mode:'highBits'}).cells[1].rgb);
});
test('missing family-specific fields, oversized grids and bad limits fail closed',()=>{
 assert.throws(()=>buildVanillaRawMapOverlay({columns:1,rows:1,attributes:[[attr(0,0,0,0)]]},{mode:'terrain'}),/unavailable/);
 assert.throws(()=>buildVanillaRawMapOverlay({...rendered,columns:13}),/bounded/);
 assert.throws(()=>buildVanillaRawMapOverlay(rendered,{mode:'walkability'}),/Unsupported/);
 assert.throws(()=>buildVanillaRawMapOverlay(rendered,{maxLegend:0}),/Legend/);
 const x=buildVanillaRawMapOverlay(rendered,{maxLegend:1});
 assert.equal(x.legend.length,1);assert.equal(x.legendTruncated,true);
});
