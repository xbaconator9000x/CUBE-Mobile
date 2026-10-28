import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {previewHmaCubeBlockmapVisualChange} from '../src/hma-cube-map-cell-preview.js';
function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
const opts={bankIndex:0,mapIndex:0,mapCount:1,x:0,y:0};
async function fixture(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8')).replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(0xe000);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);ptr(bytes,0x200,0x280);
 u32(bytes,0x280,2);u32(bytes,0x284,1);
 for(const [at,to] of [[0x288,0x400],[0x28c,0x300],[0x290,0x500],[0x294,0x540]])ptr(bytes,at,to);
 u16(bytes,0x300,0);u16(bytes,0x302,512);
 for(const [at,secondary] of [[0x500,0],[0x540,1]]){
  bytes[at+1]=secondary;
  ptr(bytes,at+4,secondary?0x5000:0x1000);
  ptr(bytes,at+8,secondary?0x9200:0x9000);
  ptr(bytes,at+12,secondary?0xb400:0x9400);
  ptr(bytes,at+16,secondary?0xd800:0xd400);
 }
 bytes.fill(0x11,0x1000,0x1020);bytes.fill(0x22,0x5000,0x5020);
 u16(bytes,0x9002,0x001f);u16(bytes,0x9200+6*32+4,0x7c00);
 for(let i=0;i<8;i++){u16(bytes,0x9400+i*2,0);u16(bytes,0xb400+i*2,512|(6<<12));}
 return {bytes,summary};
}
test('CUBE cell preflight virtually re-renders changed metatile and leaves source intact',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 const result=previewHmaCubeBlockmapVisualChange(bytes,summary,{...opts,tileId:512,expectedRaw:0});
 assert.equal(result.before.raw,0);
 assert.equal(result.after.raw,512);
 assert.equal(result.changedPixels,256);
 assert.deepEqual([...result.beforeImage.pixels.slice(0,4)],[255,0,0,255]);
 assert.deepEqual([...result.afterImage.pixels.slice(0,4)],[0,0,255,255]);
 assert.equal(result.byteOffset,0x300);
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.otherMapOwnershipUnknown,true);
 assert.deepEqual(bytes,original);
});
test('CUBE cell preflight preserves raw high bits and detects stale originals',async()=>{
 const {bytes,summary}=await fixture();
 const result=previewHmaCubeBlockmapVisualChange(bytes,summary,{...opts,collision:47,expectedRaw:0});
 assert.equal(result.after.raw,47<<10);
 assert.equal(result.after.tileId,0);
 assert.equal(result.changedPixels,0);
 assert.throws(()=>previewHmaCubeBlockmapVisualChange(bytes,summary,{...opts,tileId:1,expectedRaw:1}),/changed/i);
 assert.equal(bytes[0x300],0);
});
test('CUBE cell preflight refuses invalid proposals and unsupported rendering',async()=>{
 const {bytes,summary}=await fixture();
 for(const changes of [{tileId:1024},{collision:64},{x:-1,tileId:1},
  {x:2,tileId:1},{tileId:1,viewportX:1},{tileId:1,viewportWidth:0}])
  assert.throws(()=>previewHmaCubeBlockmapVisualChange(bytes,summary,{...opts,...changes}),RangeError);
 bytes[0x298]=1;
 assert.throws(()=>previewHmaCubeBlockmapVisualChange(bytes,summary,{...opts,tileId:1}),/FRLG/i);
});
test('CUBE preflight accepts a bounded staged reader and never calls writes',async()=>{
 const {bytes,summary}=await fixture();
 const reader={length:bytes.length,read:i=>bytes[i],write:()=>{throw Error('MUST NOT WRITE')}};
 const result=previewHmaCubeBlockmapVisualChange(reader,summary,{...opts,tileId:512});
 assert.equal(result.changed,true);
 assert.equal(bytes[0x300],0);
});
