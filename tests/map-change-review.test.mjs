import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewVanillaChangeSet} from '../src/map-change-review.js';
const flags={readOnly:true,previewOnly:true,writeAuthorized:false,layoutAuthenticated:false};
const cell=(at,before,after)=>({...flags,byteOffset:at,
 before:{bytes:before},after:{bytes:after}});
const warp=(at,before,after)=>({...flags,recordOffset:at,warpIndex:0,before,after});
const event=(at,kind,before,after)=>({...flags,recordOffset:at,kind,
 recordLength:before.length,before,after});
test('multiple disjoint byte previews produce a frozen sorted review without ROM mutation',()=>{
 const rom=new Uint8Array(64).fill(0),original=rom.slice();
 const p=reviewVanillaChangeSet(rom,[warp(24,Array(8).fill(0),[1,...Array(7).fill(0)]),
  cell(4,[0,0],[3,2]),event(40,'signposts',Array(12).fill(0),Array(12).fill(0))]);
 assert.deepEqual(p.entries.map(e=>e.offset),[4,24,40]);
 assert.equal(p.changedBytes,3);assert.equal(p.totalBytes,22);
 assert.equal(p.transactionCommitted,false);assert.equal(p.writeAuthorized,false);
 assert.ok(Object.isFrozen(p.entries)&&Object.isFrozen(p.entries[0].after));
 assert.deepEqual(rom,original);
});
test('rejects partially overlapping records, exact duplicates and unbounded sets',()=>{
 const rom=new Uint8Array(64);
 assert.throws(()=>reviewVanillaChangeSet(rom,[cell(4,[0,0],[1,0]),
  warp(5,Array(8).fill(0),Array(8).fill(0))]),/overlap/);
 assert.throws(()=>reviewVanillaChangeSet(rom,[cell(4,[0,0],[1,0]),
  cell(4,[0,0],[2,0])]),/overlap/);
 assert.throws(()=>reviewVanillaChangeSet(rom,[cell(4,[0,0],[1,0])],{maxBytes:1}),/byte limit/);
 assert.throws(()=>reviewVanillaChangeSet(rom,[],{}),RangeError);
});
test('rejects stale originals, malformed bytes and unsupported preview authority',()=>{
 const rom=new Uint8Array(64);
 rom[5]=9;
 assert.throws(()=>reviewVanillaChangeSet(rom,[cell(4,[0,0],[1,0])]),/changed/);
 for(const p of [
  {...cell(4,[0,0],[1,0]),writeAuthorized:true},
  cell(4,[0,256],[1,0]),
  cell(4,[0,0],[1]),
  {...flags,recordOffset:8,kind:'objects',recordLength:16,
   before:Array(16).fill(0),after:Array(16).fill(0)},
  cell(63,[0,0],[1,0])
 ])assert.throws(()=>reviewVanillaChangeSet(rom,[p]));
});
test('supports staged readers, rejects bad accessor bytes and preserves source',()=>{
 const rom=new Uint8Array(64),before=rom.slice();
 const reader={length:rom.length,read:i=>i===4?5:rom[i]};
 const p=reviewVanillaChangeSet(reader,[cell(4,[5,0],[6,0])]);
 assert.equal(p.changedBytes,1);
 assert.deepEqual(rom,before);
 assert.throws(()=>reviewVanillaChangeSet({length:64,read:()=>-1},
  [cell(4,[0,0],[1,0])]),/Invalid staged/);
});
