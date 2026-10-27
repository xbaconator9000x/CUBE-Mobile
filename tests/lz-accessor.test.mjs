import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeLz10,scanLz10Graphics} from '../src/core.js';
const sample=Uint8Array.from([0x10,8,0,0,0,1,2,3,4,5,6,7,8]);
const accessor=r=>({length:r.length,read:i=>r[i],snapshot(){throw Error('snapshot forbidden');}});
test('LZ10 accessor parity, staged edits, immutable source',()=>{
 const before=sample.slice();
 assert.deepEqual(decodeLz10(accessor(sample)),decodeLz10(sample));
 assert.deepEqual([...decodeLz10(sample).data],[1,2,3,4,5,6,7,8]);
 assert.equal(decodeLz10({length:sample.length,read:i=>i===5?42:sample[i]}).data[0],42);
 assert.deepEqual(sample,before);
});
test('LZ10 overlapping backreference remains byte exact',()=>{
 const bytes=Uint8Array.from([0x10,8,0,0,0x40,0x61,0x40,0]);
 assert.deepEqual([...decodeLz10(accessor(bytes)).data],Array(8).fill(0x61));
});
test('scan accepts candidate crossing chunk boundary without snapshots',()=>{
 const r=new Uint8Array(256);r.set(sample,30);
 const found=scanLz10Graphics(accessor(r),{start:28,end:32,minBytes:8});
 assert.equal(found.length,1);assert.equal(found[0].offset,30);
});
test('invalid accessor values, truncated streams, output limits rejected',()=>{
 assert.throws(()=>decodeLz10(accessor(sample.subarray(0,6))),/Truncated/);
 assert.throws(()=>decodeLz10({length:sample.length,read:i=>i===4?256:sample[i]}),/Invalid ROM accessor byte/);
 assert.throws(()=>scanLz10Graphics({length:sample.length,read:i=>i===0?-1:sample[i]},{minBytes:8}),/Invalid ROM accessor byte/);
 assert.throws(()=>decodeLz10(sample,0,{maxOutput:4}),/output/);
});
test('mobile and standalone no longer snapshot ROM for LZ preview or scan',()=>{
 for(const path of ['src/app.js','app/CUBHMA_Mobile_Lab_Offline.html']){
  const content=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.doesNotMatch(content,/decodeLz10\(model\.snapshot\(\)/);
  assert.doesNotMatch(content,/const data=model\.snapshot\(\),chunkSize/);
  assert.match(content,/decodeLz10\(model,/);
  assert.match(content,/const data=model,chunkSize=1024\*1024/);
 }
});
