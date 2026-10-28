import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {auditHmaCubeCrossBankOwnership} from '../src/hma-cube-cross-bank-ownership.js';
function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
   .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x14,0x120);
 ptr(bytes,0x100,0x200);ptr(bytes,0x120,0x240);
 for(const [header,layout] of [[0x200,0x280],[0x240,0x2c0]]){
   ptr(bytes,header,layout);
   u32(bytes,layout,3);u32(bytes,layout+4,2);
   ptr(bytes,layout+8,0x400);ptr(bytes,layout+12,0x300);
   ptr(bytes,layout+16,0x500);ptr(bytes,layout+20,0x540);
 }
 return {bytes,summary};
}
const banks=[{bankIndex:0,mapCount:1},{bankIndex:1,mapCount:1}];
test('detects shared CUBE blockmap across explicitly counted banks without writing',async()=>{
 const {bytes,summary}=await fixture(),before=bytes.slice();
 const report=auditHmaCubeCrossBankOwnership(bytes,summary,{banks});
 assert.equal(report.decoded,2);
 assert.equal(report.invalid,0);
 assert.equal(report.crossBankRelationshipCount,1);
 assert.deepEqual([report.relationships[0].first,report.relationships[0].second],['0:0','1:0']);
 assert.equal(report.relationships[0].firstKind,'blockmap');
 assert.equal(report.relationships[0].sameStart,true);
 assert.equal(report.completeOwnershipProven,false);
 assert.equal(report.writeAuthorized,false);
 assert.ok(Object.isFrozen(report.relationships[0]));
 assert.deepEqual(bytes,before);
});
test('flags partial overlapping blockmaps and preserves invalid map slots',async()=>{
 const {bytes,summary}=await fixture();
 ptr(bytes,0x2cc,0x306);
 const report=auditHmaCubeCrossBankOwnership(bytes,summary,{banks});
 assert.equal(report.crossBankRelationshipCount,1);
 assert.equal(report.relationships[0].sameStart,false);
 assert.equal(report.relationships[0].overlapBytes,6);
 ptr(bytes,0x120,0);
 const bad=auditHmaCubeCrossBankOwnership(bytes,summary,{banks});
 assert.equal(bad.invalid,1);
 assert.equal(bad.crossBankRelationshipCount,0);
});
test('rejects duplicate, unbounded and malformed bank count requests',async()=>{
 const {bytes,summary}=await fixture();
 const run=b=>auditHmaCubeCrossBankOwnership(bytes,summary,{banks:b});
 for(const b of [[],[{bankIndex:0,mapCount:0}],[
   {bankIndex:0,mapCount:1},{bankIndex:0,mapCount:1}],[
   {bankIndex:0,mapCount:129}]]){
   assert.throws(()=>run(b),RangeError);
 }
 assert.throws(()=>run(Array.from({length:9},(_,i)=>({bankIndex:i,mapCount:1}))),RangeError);
 assert.throws(()=>run([{bankIndex:0,mapCount:128},{bankIndex:1,mapCount:128},{bankIndex:2,mapCount:1}]),RangeError);
});
