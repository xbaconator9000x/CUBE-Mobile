import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeMapConnections} from '../src/hma-cube-map-connections.js';
const opts={bankIndex:0,mapIndex:0,mapCount:1};
function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,o){u32(b,i,0x08000000+o);}
async function make(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
   .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const metadata=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);
 ptr(bytes,0x200,0x280);ptr(bytes,0x20c,0x600);
 u32(bytes,0x280,4);u32(bytes,0x284,3);
 ptr(bytes,0x288,0x400);ptr(bytes,0x28c,0x300);
 ptr(bytes,0x290,0x500);ptr(bytes,0x294,0x540);
 u32(bytes,0x600,2);ptr(bytes,0x604,0x700);
 u32(bytes,0x700,1);u32(bytes,0x704,0xfffffffd);
 bytes[0x708]=3;bytes[0x709]=4;u16(bytes,0x70a,0x1234);
 u32(bytes,0x70c,4);u32(bytes,0x710,5);
 bytes[0x714]=255;bytes[0x715]=6;
 return {bytes,metadata};
}
test('CUBE custom connection records decode signed displacements with exact offsets',async()=>{
 const {bytes,metadata}=await make(),before=bytes.slice();
 const result=inspectHmaCubeMapConnections(bytes,metadata,opts);
 assert.equal(result.count,2);
 assert.equal(result.connectionsOffset,0x600);
 assert.equal(result.arrayOffset,0x700);
 assert.deepEqual([result.connections[0].direction,result.connections[0].displacement,
   result.connections[0].targetBank,result.connections[0].targetMap],
   [1,-3,3,4]);
 assert.equal(result.connections[0].unused,0x1234);
 assert.equal(result.connections[1].targetBank,255);
 assert.equal(result.romAuthenticated,false);
 assert.equal(result.writeAuthorized,false);
 assert.ok(Object.isFrozen(result.connections[0]));
 assert.deepEqual(bytes,before);
});
test('zero connections and absent header remain empty without following invalid pointer',async()=>{
 const {bytes,metadata}=await make();
 u32(bytes,0x600,0);u32(bytes,0x604,0xFFFFFFFF);
 let result=inspectHmaCubeMapConnections(bytes,metadata,opts);
 assert.equal(result.count,0);assert.equal(result.arrayOffset,null);
 u32(bytes,0x20c,0);
 result=inspectHmaCubeMapConnections(bytes,metadata,opts);
 assert.equal(result.connectionsOffset,null);assert.equal(result.count,0);
});
test('reject invalid count, overlapping headers and array, truncation, stale staged bytes',async()=>{
 const {bytes,metadata}=await make(),run=()=>inspectHmaCubeMapConnections(bytes,metadata,opts);
 u32(bytes,0x600,1025);assert.throws(run,/count/i);
 u32(bytes,0x600,2);
 ptr(bytes,0x604,0x600);assert.throws(run,/overlap/i);
 ptr(bytes,0x604,0xff8);assert.throws(run,/bounds/i);
 ptr(bytes,0x604,0x700);
 ptr(bytes,0x20c,0x200);assert.throws(run,/overlap/i);
 ptr(bytes,0x20c,0x600);
 const reader={length:bytes.length,read:i=>bytes[i]};
 const first=inspectHmaCubeMapConnections(reader,metadata,opts);
 bytes[0x704]=1;
 assert.notEqual(inspectHmaCubeMapConnections(reader,metadata,opts).connections[0].displacement,
   first.connections[0].displacement);
 assert.throws(()=>inspectHmaCubeMapConnections({length:bytes.length,read:()=>300},metadata,opts),RangeError);
});
