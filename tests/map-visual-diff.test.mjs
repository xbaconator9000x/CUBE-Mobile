import test from 'node:test';
import assert from 'node:assert/strict';
import {compareVanillaBlockmapVisualChange} from '../src/map-visual-diff.js';
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
function cell(r,fields){return previewVanillaBlockmapCellChange(r,{address:0x100,family:'RSE',x:0,y:0,...fields});}
test('metatile visual compare renders before and after without changing source ROM',()=>{
 const r=fixture(),original=r.slice(),preview=cell(r,{tileId:1});
 const result=compareVanillaBlockmapVisualChange(r,{preview});
 assert.equal(result.changedPixelCount,256);
 assert.deepEqual(result.changedPixelBounds,{x:0,y:0,width:16,height:16});
 assert.deepEqual([...result.before.pixels.slice(0,4)],[255,0,0,255]);
 assert.deepEqual([...result.after.pixels.slice(0,4)],[0,255,0,255]);
 assert.equal(result.writeAuthorized,false);assert.equal(result.walkabilityVerified,false);
 assert.deepEqual(r,original);
});
test('collision-only proposed edit changes bytes but not the rendered appearance',()=>{
 const r=fixture(),result=compareVanillaBlockmapVisualChange(r,{preview:cell(r,{collision:31})});
 assert.equal(result.changedPixelCount,0);
 assert.equal(result.changedPixelBounds,null);
 assert.equal(result.changedRawCollision,true);assert.equal(result.changedMetatile,false);
});
test('stale or forged previews and off-viewport selection fail closed',()=>{
 const r=fixture(),preview=cell(r,{tileId:1});
 r[0x220]=1;
 assert.throws(()=>compareVanillaBlockmapVisualChange(r,{preview}),/changed|Original/);
 r[0x220]=0;
 assert.throws(()=>compareVanillaBlockmapVisualChange(r,{preview:{...preview,blockmapOffset:0x300}}),/provenance/);
 assert.throws(()=>compareVanillaBlockmapVisualChange(r,{preview,x:1}),/outside/);
 assert.throws(()=>compareVanillaBlockmapVisualChange(r,{preview,viewportWidth:13}),/limited/);
});
test('staged accessor works and does not modify backing bytes',()=>{
 const r=fixture(),staged={length:r.length,read:i=>i===0x9002?0:r[i]};
 const result=compareVanillaBlockmapVisualChange(staged,{preview:cell(staged,{tileId:1})});
 assert.equal(result.changedPixelCount,256);
 assert.equal(r[0x9002],31);
});
