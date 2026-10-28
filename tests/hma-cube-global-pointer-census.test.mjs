import test from 'node:test';
import assert from 'node:assert/strict';
import {auditHmaCubeGlobalPointerCandidates as scan} from '../src/hma-cube-global-pointer-census.js';
function u32(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;b[i+2]=(v>>>16)&255;b[i+3]=(v>>>24)&255;}
test('whole-ROM scan finds canonical and mirrored pointer candidates without exposing offsets',()=>{
 const bytes=new Uint8Array(256);
 u32(bytes,0,0x08000080);u32(bytes,4,0x0a000081);u32(bytes,8,0x0c000082);
 u32(bytes,12,0x08000020);u32(bytes,16,0x08000084);
 const before=bytes.slice();
 const result=scan(bytes,[{start:128,length:4}]);
 assert.equal(result.canonicalPointerCandidates,1);
 assert.equal(result.alternateWindowCandidates,2);
 assert.equal(result.distinctCandidateSourceWords,3);
 assert.equal(result.scannedAlignedWords,64);
 assert.equal(result.globalOwnershipProven,false);
 assert.equal(result.writeAuthorized,false);
 assert.ok(!JSON.stringify(result).includes('128'));
 assert.deepEqual(bytes,before);
});
test('unaligned source words are not claimed inspected',()=>{
 const bytes=new Uint8Array(128);
 u32(bytes,1,0x08000060);
 const r=scan(bytes,[{start:96,length:4}]);
 assert.equal(r.distinctCandidateSourceWords,0);
 assert.equal(r.unalignedPointersInspected,false);
});
test('expanded address overlap is explicitly ambiguous',()=>{
 const rom={length:0x02000100,read:i=>i===0?0x80:i===1?0:i===2?0:i===3?0x0a:0};
 const result=scan(rom,[{start:0x80,length:1},{start:0x02000080,length:1}]);
 assert.equal(result.canonicalPointerCandidates,1);
 assert.equal(result.alternateWindowCandidates,1);
 assert.equal(result.ambiguousExpandedWindowCandidates,1);
});
test('invalid ranges, budgets and byte readers fail closed',()=>{
 const b=new Uint8Array(128);
 for(const bad of [[],[{start:-1,length:1}],[{start:127,length:2}],
   [{start:0,length:33}],Array.from({length:161},()=>({start:0,length:1}))])
  assert.throws(()=>scan(b,bad),RangeError);
 assert.throws(()=>scan({length:128,read:()=>256},[{start:0,length:1}]),RangeError);
});
