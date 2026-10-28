import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeBankCatalog} from '../src/hma-cube-bank-catalog.js';
function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8')).replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(0x1000);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);
 ptr(bytes,0x100,0x200);ptr(bytes,0x104,0x240);
 for(const [header,layout] of [[0x200,0x280],[0x240,0x2c0]]){
  ptr(bytes,header,layout);
  u32(bytes,layout,2);u32(bytes,layout+4,1);
  ptr(bytes,layout+8,0x400);ptr(bytes,layout+12,0x300);
  ptr(bytes,layout+16,0x500);ptr(bytes,layout+20,0x540);
 }
 return {bytes,summary};
}
test('CUBE catalog discovers explicit maps and same-bank blockmap aliases without writes',async()=>{
 const {bytes,summary}=await fixture(),before=bytes.slice();
 const result=inspectHmaCubeBankCatalog(bytes,summary,{bankIndex:0,mapCount:3});
 assert.equal(result.decoded,2);assert.equal(result.invalid,1);
 assert.deepEqual(result.rows[0].sameBankBlockmapAliases,[0,1]);
 assert.deepEqual(result.rows[1].sameBankBlockmapAliases,[0,1]);
 assert.deepEqual(result.rows[0].sameBankHeaderAliases,[0]);
 assert.equal(result.rows[2].status,'invalid-or-unsupported');
 assert.equal(result.rows[0].eventStatus,'decoded');
 assert.equal(result.rows[0].connectionStatus,'decoded');
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.otherBankOwnershipUnknown,true);
 assert.deepEqual(bytes,before);
});
test('CUBE catalog refuses unbounded counts, invalid bank, and stale map pointers',async()=>{
 const {bytes,summary}=await fixture();
 for(const count of [0,129,1.2,NaN])
  assert.throws(()=>inspectHmaCubeBankCatalog(bytes,summary,{bankIndex:0,mapCount:count}),RangeError);
 assert.throws(()=>inspectHmaCubeBankCatalog(bytes,summary,{bankIndex:999,mapCount:1}),RangeError);
 const first=inspectHmaCubeBankCatalog(bytes,summary,{bankIndex:0,mapCount:2});
 u32(bytes,0x104,0);
 const second=inspectHmaCubeBankCatalog(bytes,summary,{bankIndex:0,mapCount:2});
 assert.notDeepEqual(first,second);
 assert.equal(second.rows[1].status,'invalid-or-unsupported');
});
