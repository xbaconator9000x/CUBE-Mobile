import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {renderHmaCubeMapViewport} from '../src/hma-cube-map-render.js';
function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
const options={bankIndex:0,mapIndex:0,mapCount:1};
async function make(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(0xe000);
 const metadata=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);ptr(bytes,0x200,0x280);
 u32(bytes,0x280,2);u32(bytes,0x284,1);
 for(const [at,target] of [[0x288,0x400],[0x28c,0x300],[0x290,0x500],[0x294,0x540]])
  ptr(bytes,at,target);
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
 for(let i=0;i<8;i++){
  u16(bytes,0x9400+i*2,0);
  u16(bytes,0xb400+i*2,512|(6<<12));
 }
 return {bytes,metadata};
}
test('conservative CUBE RSE viewport renders two metatiles without ROM writes',async()=>{
 const {bytes,metadata}=await make(),before=bytes.slice();
 const image=renderHmaCubeMapViewport(bytes,metadata,options);
 assert.equal(image.width,32);assert.equal(image.height,16);
 assert.deepEqual([...image.pixels.slice(0,4)],[255,0,0,255]);
 assert.deepEqual([...image.pixels.slice(64,68)],[0,0,255,255]);
 assert.equal(image.map.layout.width,2);
 assert.equal(image.renderingMode,'conservative-rse');
 assert.equal(image.cubeLayoutAuthenticated,false);
 assert.equal(image.writeAuthorized,false);
 assert.deepEqual(bytes,before);
});
test('CUBE custom light flags and FRLG variants fail closed instead of misrendering',async()=>{
 const {bytes,metadata}=await make();
 bytes[0x298]=1;
 assert.throws(()=>renderHmaCubeMapViewport(bytes,metadata,options),/FRLG/i);
 bytes[0x298]=0;bytes[0x502]=1;
 assert.throws(()=>renderHmaCubeMapViewport(bytes,metadata,options),/light/i);
 bytes[0x502]=0;bytes[0x541]=0;
 assert.throws(()=>renderHmaCubeMapViewport(bytes,metadata,options),/secondary/i);
});
test('CUBE render re-reads staged ROM bytes and bounds viewport',async()=>{
 const {bytes,metadata}=await make(),reader={length:bytes.length,read:i=>bytes[i]};
 const first=renderHmaCubeMapViewport(reader,metadata,options);
 bytes[0x9002]=0;
 assert.notEqual(renderHmaCubeMapViewport(reader,metadata,options).pixels[0],first.pixels[0]);
 assert.throws(()=>renderHmaCubeMapViewport(reader,metadata,{...options,x:2}),RangeError);
 assert.throws(()=>renderHmaCubeMapViewport({length:bytes.length,read:()=>300},metadata,options),RangeError);
});
