import test from 'node:test';
import assert from 'node:assert/strict';
import {compareVanillaBlockmapVisualChangeSet} from '../src/map-visual-diff.js';
import {previewVanillaBlockmapCellChange} from '../src/map-edit-preview.js';
const ptr=n=>0x08000000+n;
function w(r,o,n){r[o]=n&255;r[o+1]=n>>>8&255;}
function d(r,o,n){for(let i=0;i<4;i++)r[o+i]=n>>>(i*8)&255;}
function fixture(){
 const r=new Uint8Array(0xe000);
 d(r,0x100,ptr(0x140));d(r,0x140,2);d(r,0x144,1);
 for(const [o,n] of [[0x148,0x200],[0x14c,0x220],[0x150,0x240],[0x154,0x280]])d(r,o,ptr(n));
 for(const [off,second] of [[0x240,false],[0x280,true]]){
  r[off+1]=second?1:0;
  d(r,off+4,ptr(second?0x5000:0x1000));
  d(r,off+8,ptr(second?0x9200:0x9000));
  d(r,off+12,ptr(second?0xb400:0x9400));
  d(r,off+16,ptr(second?0xd800:0xd400));
 }
 r.fill(0x11,0x1000,0x1020);
 w(r,0x9002,0x001f);w(r,0x9022,0x03e0);
 for(let i=0;i<8;i++){w(r,0x9400+i*2,0);w(r,0x9410+i*2,0x1000);}
 return r;
}
function cell(r,x,fields){return previewVanillaBlockmapCellChange(r,{
 address:0x100,family:'RSE',x,y:0,...fields
});}
test('two queued metatile changes compose into one immutable viewport diff',()=>{
 const r=fixture(),original=r.slice();
 const result=compareVanillaBlockmapVisualChangeSet(r,{previews:[
  cell(r,0,{tileId:1}),cell(r,1,{tileId:1})
 ]});
 assert.equal(result.changedPixelCount,512);
 assert.deepEqual(result.changedPixelBounds,{x:0,y:0,width:32,height:16});
 assert.equal(result.changedCellCount,2);
 assert.equal(result.changedMetatileCount,2);
 assert.equal(result.visibleCellCount,2);
 assert.equal(result.reviewedBytes,4);
 assert.equal(result.writeAuthorized,false);
 assert.deepEqual(r,original);
});
test('collision-only edits are counted without inventing visual changes',()=>{
 const r=fixture();
 const result=compareVanillaBlockmapVisualChangeSet(r,{previews:[
  cell(r,0,{collision:31}),cell(r,1,{tileId:1})
 ]});
 assert.equal(result.changedPixelCount,256);
 assert.equal(result.changedRawCollisionCount,1);
 assert.equal(result.changedMetatileCount,1);
});
test('duplicate, stale and fabricated cell previews fail closed',()=>{
 const r=fixture(),a=cell(r,0,{tileId:1});
 assert.throws(()=>compareVanillaBlockmapVisualChangeSet(r,{previews:[a,a]}),/overlap/);
 assert.throws(()=>compareVanillaBlockmapVisualChangeSet(r,{
  previews:[{...a,blockmapOffset:0x500}]
 }),/provenance/);
 r[0x220]=5;
 assert.throws(()=>compareVanillaBlockmapVisualChangeSet(r,{previews:[a]}),/Original|changed/);
});
test('offscreen changes do not affect visible pixels, and viewport bounds are enforced',()=>{
 const r=fixture(),result=compareVanillaBlockmapVisualChangeSet(r,{
  previews:[cell(r,1,{tileId:1})],viewportWidth:1
 });
 assert.equal(result.changedPixelCount,0);
 assert.equal(result.visibleCellCount,0);
 assert.throws(()=>compareVanillaBlockmapVisualChangeSet(r,{
  previews:[cell(r,0,{tileId:1})],viewportWidth:13
 }),/limited/);
});
test('staged ROM readers and unrelated preview kinds are handled safely',()=>{
 const r=fixture(),staged={length:r.length,read:i=>r[i]};
 assert.equal(compareVanillaBlockmapVisualChangeSet(staged,{
  previews:[cell(staged,0,{tileId:1})]
 }).changedPixelCount,256);
 assert.throws(()=>compareVanillaBlockmapVisualChangeSet(r,{
  previews:[{...cell(r,0,{tileId:1}),headerOffset:0x101}]
 }),/map|provenance|bounds/i);
});
