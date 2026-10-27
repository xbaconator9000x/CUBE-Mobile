import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapBlocksets} from '../src/map-blocksets.js';
const ptr=n=>0x08000000+n;
function u32(r,o,n){for(let i=0;i<4;i++)r[o+i]=(n>>>(8*i))&255;}
function fixture(family='RSE'){
 const r=new Uint8Array(0x600).fill(0xff);
 u32(r,0x100,ptr(0x140));u32(r,0x104,0);u32(r,0x108,0);u32(r,0x10c,0);
 u32(r,0x140,2);u32(r,0x144,2);
 for(const [o,n] of [[0x148,0x200],[0x14c,0x220],[0x150,0x240],[0x154,0x280]])u32(r,o,ptr(n));
 for(const [o,second] of [[0x240,false],[0x280,true]]){
  r[o]=second?0:1;r[o+1]=second?1:0;r[o+2]=0;r[o+3]=0;
  u32(r,o+4,ptr(0x400));u32(r,o+8,ptr(0x420));u32(r,o+12,ptr(0x440));
  u32(r,o+(family==='FRLG'?20:16),ptr(0x480));
  u32(r,o+(family==='FRLG'?16:20),0);
 }
 return r;
}
const read=(r,family='RSE')=>inspectVanillaMapBlocksets(r,{address:0x100,family});
test('RSE blockset headers preserve primary/secondary source and raw graphics pointers',()=>{
 const r=fixture(),before=r.slice(),out=read(r);
 assert.equal(out.primary.headerOffset,0x240);assert.equal(out.secondary.headerOffset,0x280);
 assert.equal(out.primary.isCompressed,true);assert.equal(out.secondary.isSecondary,true);
 assert.equal(out.primary.tilesetOffset,0x400);assert.equal(out.primary.paletteOffset,0x420);
 assert.equal(out.primary.metatileOffset,0x440);assert.equal(out.primary.attributesOffset,0x480);
 assert.equal(out.primary.animationOffset,null);assert.equal(out.layoutAuthenticated,false);
 assert.ok(Object.isFrozen(out)&&Object.isFrozen(out.primary));assert.deepEqual(r,before);
});
test('FRLG swaps animation and attribute pointer fields',()=>{
 const r=fixture('FRLG'),out=read(r,'FRLG');
 assert.equal(out.primary.attributesPointer,ptr(0x480));
 assert.equal(out.primary.animationPointer,0);
});
test('malformed header pointers, flags and structural overlaps fail closed',()=>{
 for(const [o,v] of [[0x150,ptr(0x100)],[0x150,ptr(0x140)],[0x150,ptr(0x220)],[0x150,ptr(0x280)],[0x150,ptr(0x5f0)],[0x244,0],[0x248,0x07000000]]){
  const r=fixture();u32(r,o,v);assert.throws(()=>read(r));
 }
 const r=fixture();r[0x240]=2;assert.throws(()=>read(r),/flags/);
});
test('staged ROM reads affect preview but never mutate original bytes',()=>{
 const r=fixture();const accessor={length:r.length,read:i=>i===0x240?0:r[i]};
 assert.equal(read(accessor).primary.isCompressed,false);assert.equal(r[0x240],1);
});
