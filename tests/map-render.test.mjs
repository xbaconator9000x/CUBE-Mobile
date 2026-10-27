import test from 'node:test';
import assert from 'node:assert/strict';
import {renderVanillaMapViewport} from '../src/map-render.js';
const ptr=n=>0x08000000+n;
function w(r,o,n){r[o]=n&255;r[o+1]=n>>>8&255;}
function d(r,o,n){for(let i=0;i<4;i++)r[o+i]=n>>>(i*8)&255;}
function fixture(family='RSE'){
 const r=new Uint8Array(0xe000),split=family==='FRLG'?640:512,pal=family==='FRLG'?7:6;
 d(r,0x100,ptr(0x140));d(r,0x140,2);d(r,0x144,1);
 for(const [o,n] of [[0x148,0x200],[0x14c,0x220],[0x150,0x240],[0x154,0x280]])d(r,o,ptr(n));
 for(const [off,second] of [[0x240,false],[0x280,true]]){
  r[off+1]=second?1:0;
  d(r,off+4,ptr(second?0x5000:0x1000));
  d(r,off+8,ptr(second?0x9200:0x9000));
  d(r,off+12,ptr(second?0xb400:0x9400));
  d(r,off+(family==='FRLG'?20:16),ptr(second?0xd800:0xd400));
 }
 w(r,0x220,0);w(r,0x222,split);
 for(let i=0;i<32;i++){r[0x1000+i]=0x11;r[0x5000+i]=0x22;}
 w(r,0x9002,0x001f);w(r,0x9200+pal*32+4,0x7c00);
 for(let i=0;i<8;i++){w(r,0x9400+i*2,0);w(r,0xb400+i*2,split|(pal<<12));}
 return r;
}
test('RSE two blocksets render different palette banks and preserve ROM',()=>{
 const r=fixture(),before=r.slice(),out=renderVanillaMapViewport(r,{address:0x100,family:'RSE'});
 assert.equal(out.width,32);assert.equal(out.height,16);
 assert.deepEqual([...out.pixels.slice(0,4)],[255,0,0,255]);
 assert.deepEqual([...out.pixels.slice(64,68)],[0,0,255,255]);
 assert.equal(out.cells[0][1].tileId,512);assert.equal(out.layoutAuthenticated,false);
 assert.deepEqual(r,before);
});
test('FRLG block and palette split is 640 and 7',()=>{
 const out=renderVanillaMapViewport(fixture('FRLG'),{address:0x100,family:'FRLG'});
 assert.deepEqual([...out.pixels.slice(64,68)],[0,0,255,255]);
});
test('staged byte accessor changes palette without modifying source',()=>{
 const r=fixture(),staged={length:r.length,read:i=>i===0x9002?0:r[i]};
 assert.equal(renderVanillaMapViewport(staged,{address:0x100,family:'RSE'}).pixels[0],0);
 assert.equal(r[0x9002],31);
});
test('malformed attributes and metatile offsets are rejected',()=>{
 const r=fixture();r[0xd401]=0xf0;
 assert.throws(()=>renderVanillaMapViewport(r,{address:0x100,family:'RSE'}),/layer/);
 const r2=fixture();d(r2,0x24c,ptr(0xdff8));
 assert.throws(()=>renderVanillaMapViewport(r2,{address:0x100,family:'RSE'}),/bounds/);
});

test('horizontal flip reverses 8px tile samples while upper palette-zero remains transparent',()=>{
 const r=fixture();
 r.fill(0,0x1000,0x1020);r[0x1000]=0x01;r[0x1003]=0x20;
 w(r,0x9004,0x03e0);
 w(r,0x9408,1); // upper tile 1 is transparent
 let result=renderVanillaMapViewport(r,{address:0x100,family:'RSE'});
 assert.deepEqual([...result.pixels.slice(0,4)],[255,0,0,255]);
 w(r,0x9400,0x400);
 result=renderVanillaMapViewport(r,{address:0x100,family:'RSE'});
 assert.deepEqual([...result.pixels.slice(0,4)],[0,255,0,255]);
});
test('LZ-compressed 4bpp primary tileset renders identically to raw source',()=>{
 const r=fixture(),before=renderVanillaMapViewport(r,{address:0x100,family:'RSE'});
 const lz=Uint8Array.from([0x10,32,0,0,...Array.from({length:4},()=>[0,...Array(8).fill(0x11)]).flat()]);
 r.set(lz,0x1000);r[0x240]=1;
 const after=renderVanillaMapViewport(r,{address:0x100,family:'RSE'});
 assert.deepEqual([...after.pixels],[...before.pixels]);
});

test('metatile attribute inspector preserves raw collision and RSE behavior/layer bytes',()=>{
 const r=fixture();
 w(r,0x220,0xa800);r[0xd400]=0x42;r[0xd401]=0x20;
 const result=renderVanillaMapViewport(r,{address:0x100,family:'RSE'});
 const a=result.attributes[0][0];
 assert.equal(a.collision,42);assert.equal(a.behavior,0x42);assert.equal(a.layer,2);
 assert.deepEqual(a.rawBytes,[0x42,0x20]);assert.equal(a.verifiedWalkability,false);
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(result.attributes));
});
test('FRLG attribute decoding preserves raw terrain and encounter fields',()=>{
 const r=fixture('FRLG');r[0xd400]=0x33;r[0xd401]=0x06;r[0xd403]=0x21;
 const a=renderVanillaMapViewport(r,{address:0x100,family:'FRLG'}).attributes[0][0];
 assert.equal(a.behavior,0x33);assert.equal(a.terrain,3);
 assert.equal(a.encounter,1);assert.equal(a.layer,1);
});
