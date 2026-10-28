import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {traceHmaCubeWarpArrival} from '../src/hma-cube-warp-arrival.js';
function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8')).replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);ptr(bytes,0x104,0x240);
 for(const [header,layout,events] of [[0x200,0x280,0x600],[0x240,0x2c0,0x640]]){
  ptr(bytes,header,layout);ptr(bytes,header+4,events);
  u32(bytes,layout,4);u32(bytes,layout+4,4);
  ptr(bytes,layout+8,0x400);ptr(bytes,layout+12,0x300);
  ptr(bytes,layout+16,0x500);ptr(bytes,layout+20,0x540);
 }
 bytes[0x601]=1;ptr(bytes,0x608,0x800);
 bytes[0x641]=1;ptr(bytes,0x648,0x808);
 u16(bytes,0x800,1);u16(bytes,0x802,2);bytes[0x805]=0;bytes[0x806]=1;bytes[0x807]=0;
 u16(bytes,0x808,3);u16(bytes,0x80a,1);bytes[0x80d]=0;bytes[0x80e]=0;bytes[0x80f]=0;
 return {bytes,summary};
}
const options={bankIndex:0,mapIndex:0,mapCount:2,warpIndex:0,targetMapCount:2};
test('CUBE warp arrival resolves explicit target and reports reciprocal raw record without writes',async()=>{
 const {bytes,summary}=await fixture(),before=bytes.slice();
 const result=traceHmaCubeWarpArrival(bytes,summary,options);
 assert.equal(result.status,'resolved-raw');
 assert.equal(result.arrival.x,3);assert.equal(result.arrival.y,1);
 assert.equal(result.arrival.returnsToOrigin,true);
 assert.equal(result.arrival.coordinatesInBounds,true);
 assert.equal(result.writeAuthorized,false);assert.equal(result.travelVerified,false);
 assert.deepEqual(bytes,before);
});
test('CUBE warp arrival handles missing, special and out-of-range targets without guessing',async()=>{
 const {bytes,summary}=await fixture();
 assert.throws(()=>traceHmaCubeWarpArrival(bytes,summary,{...options,warpIndex:1}),RangeError);
 assert.throws(()=>traceHmaCubeWarpArrival(bytes,summary,{...options,targetMapCount:0}),RangeError);
 assert.equal(traceHmaCubeWarpArrival(bytes,summary,{...options,targetMapCount:1}).status,'outside-explicit-target-map-count');
 bytes[0x805]=2;
 assert.equal(traceHmaCubeWarpArrival(bytes,summary,options).status,'target-warp-index-missing');
 bytes[0x805]=255;
 assert.equal(traceHmaCubeWarpArrival(bytes,summary,options).status,'special-or-unresolved');
 bytes[0x805]=0;bytes[0x807]=255;
 assert.equal(traceHmaCubeWarpArrival(bytes,summary,options).status,'special-or-unresolved');
});
