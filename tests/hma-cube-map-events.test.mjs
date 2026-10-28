import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeMapEventWarps} from '../src/hma-cube-map-events.js';

function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
const options={bankIndex:0,mapIndex:0,mapCount:1};
async function make(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
   .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const metadata=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);
 ptr(bytes,0x200,0x280);ptr(bytes,0x204,0x600);
 u32(bytes,0x280,3);u32(bytes,0x284,2);
 ptr(bytes,0x288,0x400);ptr(bytes,0x28c,0x300);
 ptr(bytes,0x290,0x500);ptr(bytes,0x294,0x540);
 bytes[0x601]=2;ptr(bytes,0x608,0x700);
 u16(bytes,0x700,1);u16(bytes,0x702,1);bytes[0x704]=3;
 bytes[0x705]=4;bytes[0x706]=5;bytes[0x707]=6;
 u16(bytes,0x708,9);u16(bytes,0x70A,1);bytes[0x70C]=0;
 bytes[0x70D]=1;bytes[0x70E]=255;bytes[0x70F]=255;
 return {bytes,metadata};
}
test('CUBE custom events report exact warp offsets and out-of-map/special targets',async()=>{
 const {bytes,metadata}=await make(),copy=bytes.slice();
 const report=inspectHmaCubeMapEventWarps(bytes,metadata,options);
 assert.equal(report.counts.warps,2);
 assert.equal(report.offsets.warps,0x700);
 assert.equal(report.warps[0].offset,0x700);
 assert.deepEqual([report.warps[0].x,report.warps[0].y],[1,1]);
 assert.equal(report.warps[0].outsideDeclaredMap,false);
 assert.equal(report.warps[0].specialTarget,false);
 assert.equal(report.warps[1].outsideDeclaredMap,true);
 assert.equal(report.warps[1].specialTarget,true);
 assert.equal(report.cubeLayoutAuthenticated,false);
 assert.equal(report.writeAuthorized,false);
 assert.ok(Object.isFrozen(report.warps)&&Object.isFrozen(report.warps[0]));
 assert.deepEqual(bytes,copy);
});
test('zero-count event pointers are ignored, null event group remains empty',async()=>{
 const {bytes,metadata}=await make();
 bytes[0x601]=0;u32(bytes,0x608,0xFFFFFFFF);
 let result=inspectHmaCubeMapEventWarps(bytes,metadata,options);
 assert.equal(result.counts.warps,0);
 assert.equal(result.offsets.warps,null);
 assert.equal(result.warps.length,0);
 u32(bytes,0x204,0);
 result=inspectHmaCubeMapEventWarps(bytes,metadata,options);
 assert.equal(result.eventsOffset,null);
 assert.equal(result.counts.objects,0);
});
test('all event arrays are validated for overlap and bounds before returning warps',async()=>{
 const {bytes,metadata}=await make();
 const run=()=>inspectHmaCubeMapEventWarps(bytes,metadata,options);
 ptr(bytes,0x608,0x600);
 assert.throws(run,/overlap/i);
 ptr(bytes,0x608,0x700);
 bytes[0x600]=1;ptr(bytes,0x604,0x700);
 assert.throws(run,/overlap/i);
 ptr(bytes,0x604,0x800);
 bytes[0x602]=1;ptr(bytes,0x60c,0x808);
 assert.throws(run,/overlap/i);
 ptr(bytes,0x60c,0x900);
 bytes[0x603]=1;ptr(bytes,0x610,0xFF8);
 assert.throws(run,/bounds/i);
});
test('staged ROM changes revalidate pointers, coordinates and byte integrity',async()=>{
 const {bytes,metadata}=await make();
 const reader={length:bytes.length,read:i=>bytes[i]};
 const before=inspectHmaCubeMapEventWarps(reader,metadata,options);
 bytes[0x700]=2;
 assert.notEqual(inspectHmaCubeMapEventWarps(reader,metadata,options).warps[0].x,
   before.warps[0].x);
 assert.throws(()=>inspectHmaCubeMapEventWarps({length:bytes.length,read:()=>256},metadata,options),RangeError);
});
