import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeMapEventWarps} from '../src/hma-cube-map-events.js';
const options={bankIndex:0,mapIndex:0,mapCount:1};
function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function make(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const metadata=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);
 ptr(bytes,0x200,0x280);ptr(bytes,0x204,0x600);
 u32(bytes,0x280,4);u32(bytes,0x284,3);
 ptr(bytes,0x288,0x400);ptr(bytes,0x28c,0x300);
 ptr(bytes,0x290,0x500);ptr(bytes,0x294,0x540);
 bytes.set([1,0,1,1],0x600);
 ptr(bytes,0x604,0x800);ptr(bytes,0x60c,0x900);ptr(bytes,0x610,0xa00);
 bytes[0x800]=7;bytes[0x801]=8;u16(bytes,0x802,0x102);
 u16(bytes,0x804,3);u16(bytes,0x806,2);bytes[0x808]=1;bytes[0x809]=9;
 u16(bytes,0x80a,0x201);u16(bytes,0x80c,2);u16(bytes,0x80e,3);
 ptr(bytes,0x810,0xb00);u16(bytes,0x814,0x41);
 u16(bytes,0x900,1);u16(bytes,0x902,2);u16(bytes,0x904,4);
 u16(bytes,0x906,5);u32(bytes,0x908,0x12345678);ptr(bytes,0x90c,0xb20);
 u16(bytes,0xa00,9);u16(bytes,0xa02,2);bytes[0xa04]=1;
 bytes[0xa05]=4;u32(bytes,0xa08,0x87654321);
 return {bytes,metadata};
}
test('CUBE event decoder exposes object, trigger, signpost and raw script pointer provenance',async()=>{
 const {bytes,metadata}=await make(),before=bytes.slice();
 const result=inspectHmaCubeMapEventWarps(bytes,metadata,options);
 assert.equal(result.counts.objects,1);assert.equal(result.counts.scripts,1);
 assert.equal(result.counts.signposts,1);assert.equal(result.counts.warps,0);
 assert.equal(result.objects[0].id,7);assert.equal(result.objects[0].kindField,0x102);
 assert.equal(result.objects[0].x,3);assert.equal(result.objects[0].scriptPointerSource,0x810);
 assert.equal(result.objects[0].scriptPointer,0x08000b00);
 assert.equal(result.scripts[0].indexValue,0x12345678);
 assert.equal(result.scripts[0].scriptPointerSource,0x90c);
 assert.equal(result.signposts[0].rawArgument,0x87654321);
 assert.equal(result.signposts[0].outsideDeclaredMap,true);
 assert.equal(result.writeAuthorized,false);assert.equal(result.cubeLayoutAuthenticated,false);
 assert.ok(Object.isFrozen(result.arrays)&&Object.isFrozen(result.objects[0]));
 assert.deepEqual(bytes,before);
});
test('custom event arrays fail closed on overlap, stale staged changes and bad accessor',async()=>{
 const {bytes,metadata}=await make(),run=()=>inspectHmaCubeMapEventWarps(bytes,metadata,options);
 ptr(bytes,0x610,0x800);assert.throws(run,/overlap/i);
 ptr(bytes,0x610,0xa00);
 const staged={length:bytes.length,read:i=>bytes[i]};
 const before=inspectHmaCubeMapEventWarps(staged,metadata,options);
 bytes[0x804]=2;
 assert.notEqual(inspectHmaCubeMapEventWarps(staged,metadata,options).objects[0].x,before.objects[0].x);
 assert.throws(()=>inspectHmaCubeMapEventWarps({length:bytes.length,read:()=>-1},metadata,options),RangeError);
});
