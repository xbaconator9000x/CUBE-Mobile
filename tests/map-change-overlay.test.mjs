import test from 'node:test';
import assert from 'node:assert/strict';
import {createVanillaReviewedChangeOverlay} from '../src/map-change-review.js';
const flags={readOnly:true,previewOnly:true,writeAuthorized:false,layoutAuthenticated:false};
const cell=(offset,before,after)=>({...flags,byteOffset:offset,
 before:{bytes:before},after:{bytes:after}});
const warp=(offset,before,after)=>({...flags,recordOffset:offset,warpIndex:0,before,after});
test('overlay composes disjoint cell and warp edits without mutating backing ROM',()=>{
 const rom=new Uint8Array(64),original=rom.slice();
 const overlay=createVanillaReviewedChangeOverlay(rom,[
  cell(4,[0,0],[3,4]),warp(24,Array(8).fill(0),[2,0,3,0,0,1,2,3])
 ]);
 assert.equal(overlay.source.length,rom.length);
 assert.equal(overlay.source.read(4),3);
 assert.equal(overlay.source.read(5),4);
 assert.equal(overlay.source.read(24),2);
 assert.equal(overlay.source.read(30),2);
 assert.equal(overlay.source.read(7),0);
 assert.equal(overlay.review.changedBytes,8);
 assert.equal(overlay.transactionCommitted,false);
 assert.equal(overlay.writeAuthorized,false);
 assert.ok(Object.isFrozen(overlay)&&Object.isFrozen(overlay.source));
 assert.deepEqual(rom,original);
});
test('overlay fails closed when a queued original byte changes after creation',()=>{
 const rom=new Uint8Array(64);
 const overlay=createVanillaReviewedChangeOverlay(rom,[cell(4,[0,0],[3,4])]);
 rom[4]=9;
 assert.throws(()=>overlay.source.read(4),/changed/);
 assert.equal(overlay.source.read(6),0);
});
test('overlay rejects invalid reads, invalid accessors, overlapping and forbidden changes',()=>{
 const rom=new Uint8Array(64);
 const overlay=createVanillaReviewedChangeOverlay(rom,[cell(4,[0,0],[3,4])]);
 for(const offset of [-1,64,0.5,NaN])assert.throws(()=>overlay.source.read(offset),RangeError);
 assert.throws(()=>createVanillaReviewedChangeOverlay(rom,[
  cell(4,[0,0],[3,4]),cell(4,[0,0],[5,6])
 ]),/overlap/);
 assert.throws(()=>createVanillaReviewedChangeOverlay(rom,[cell(4,[1,0],[3,4])]),/changed/);
 assert.throws(()=>createVanillaReviewedChangeOverlay({length:64,read:()=>999},[
  cell(4,[0,0],[3,4])
 ]),/Invalid/);
});
test('staged source bytes are honored and source remains immutable',()=>{
 const rom=new Uint8Array(64),source={length:rom.length,read:i=>i===4?7:rom[i]};
 const overlay=createVanillaReviewedChangeOverlay(source,[cell(4,[7,0],[8,0])]);
 assert.equal(overlay.source.read(4),8);
 assert.equal(rom[4],0);
});
