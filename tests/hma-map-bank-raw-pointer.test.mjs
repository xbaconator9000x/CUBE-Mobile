import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankRawPointer} from '../src/hma-map-bank-raw-pointer.js';

const summary=(status='custom-candidate',address=16)=>({
 status,uniqueDeclarationCount:1,declarations:[{address,addressInBounds:true}]
});
const rom=(raw,offset=16,length=256)=>{
 const bytes=new Uint8Array(length);
 for(let i=0;i<4;i++)bytes[offset+i]=(raw>>> (i*8))&255;
 return {length,read:i=>bytes[i],bytes};
};
test('raw conventional pointer preserves exact staged bytes and offsets without writes',()=>{
 const model=rom(0x08000040),original=model.bytes.slice();
 const result=inspectHmaMapBankRawPointer(model,summary());
 assert.equal(result.status,'in-rom-pointer');
 assert.equal(result.sourceOffset,16);
 assert.equal(result.rawWord,0x08000040);
 assert.equal(result.targetOffset,64);
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.romAuthenticated,false);
 assert.ok(Object.isFrozen(result));
 assert.deepEqual(model.bytes,original);
});
test('raw nonpointer, out-of-ROM and boundary pointers are not followed',()=>{
 assert.equal(inspectHmaMapBankRawPointer(rom(0xFFFFFFFF),summary()).status,'not-conventional-pointer');
 const outside=inspectHmaMapBankRawPointer(rom(0x08001000),summary());
 assert.equal(outside.status,'out-of-rom-pointer');
 assert.equal(outside.targetOffset,null);
 assert.equal(inspectHmaMapBankRawPointer(rom(0x080000FF),summary()).targetOffset,255);
});
test('missing, conflicting, invalid or stale declarations fail closed',()=>{
 const model=rom(0x08000040);
 for(const status of ['missing','conflicting-declarations','ambiguous-format','invalid-address'])
  assert.throws(()=>inspectHmaMapBankRawPointer(model,summary(status)),RangeError);
 assert.throws(()=>inspectHmaMapBankRawPointer(model,{...summary(),uniqueDeclarationCount:2}),RangeError);
 assert.throws(()=>inspectHmaMapBankRawPointer(model,{...summary(),declarations:[{address:16,addressInBounds:false}]}),RangeError);
 assert.throws(()=>inspectHmaMapBankRawPointer(model,summary('custom-candidate',253)),RangeError);
 assert.throws(()=>inspectHmaMapBankRawPointer({length:256,read:()=>300},summary()),RangeError);
 assert.throws(()=>inspectHmaMapBankRawPointer(null,summary()),TypeError);
});
test('staged edits are observed on a fresh inspection, never cached as truth',()=>{
 const model=rom(0x08000040);
 const first=inspectHmaMapBankRawPointer(model,summary());
 model.bytes[16]=0x80;
 const next=inspectHmaMapBankRawPointer(model,summary());
 assert.notEqual(first.rawWord,next.rawWord);
 assert.equal(next.targetOffset,128);
});
test('mobile and offline raw pointer controls remain present',async()=>{
 const [app,html,offline,build]=await Promise.all([
  readFile(new URL('../src/app.js',import.meta.url),'utf8'),
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../app/CUBHMA_Mobile_Lab_Offline.html',import.meta.url),'utf8'),
  readFile(new URL('../build-standalone.mjs',import.meta.url),'utf8')
 ]);
 for(const source of [html,offline]){
  assert.match(source,/id="map-bank-raw-inspect"/);
  assert.match(source,/id="map-bank-raw-follow"/);
  assert.match(source,/id="map-bank-raw-status"/);
 }
 assert.match(app,/inspectHmaMapBankRawPointer/);
 assert.match(build,/hma-map-bank-raw-pointer\.js/);
 assert.match(offline,/function inspectHmaMapBankRawPointer/);
});
