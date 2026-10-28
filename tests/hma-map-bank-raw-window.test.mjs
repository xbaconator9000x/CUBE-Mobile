import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankRawWindow} from '../src/hma-map-bank-raw-window.js';
const summary={status:'custom-candidate',uniqueDeclarationCount:1,
 declarations:[{address:16,addressInBounds:true}]};
function rom(words,length=128){
 const bytes=new Uint8Array(length);
 words.forEach((word,index)=>{for(let i=0;i<4;i++)bytes[16+index*4+i]=(word>>>(8*i))&255;});
 return {length,read:i=>bytes[i],bytes};
}
test('raw window counts and retains exact per-word source offsets without ROM writes',()=>{
 const model=rom([0x08000040,0x08001000,0xFFFFFFFF,0x0800007F]);
 const original=model.bytes.slice();
 const result=inspectHmaMapBankRawWindow(model,summary,{words:4});
 assert.equal(result.wordCount,4);
 assert.equal(result.conventionalCount,3);
 assert.equal(result.inRomCount,2);
 assert.deepEqual(result.rows.map(r=>r.sourceOffset),[16,20,24,28]);
 assert.deepEqual(result.rows.map(r=>r.targetOffset),[64,null,null,127]);
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.romAuthenticated,false);
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.rows)&&Object.isFrozen(result.rows[0]));
 assert.deepEqual(model.bytes,original);
});
test('raw window rejects oversized, truncated and invalid staged readers',()=>{
 const model=rom([0x08000040],32);
 for(const words of [0,-1,33,1.5,Infinity])assert.throws(()=>
   inspectHmaMapBankRawWindow(model,summary,{words}),RangeError);
 assert.throws(()=>inspectHmaMapBankRawWindow(model,summary,{words:5}),RangeError);
 assert.throws(()=>inspectHmaMapBankRawWindow({length:128,read:()=>-1},summary),RangeError);
 assert.throws(()=>inspectHmaMapBankRawWindow(model,{...summary,status:'conflicting-declarations'}),RangeError);
});
test('fresh inspection sees changed raw bytes rather than trusting cached targets',()=>{
 const model=rom([0x08000040,0x08000060]);
 const old=inspectHmaMapBankRawWindow(model,summary,{words:2});
 model.bytes[20]=0x70;
 const fresh=inspectHmaMapBankRawWindow(model,summary,{words:2});
 assert.notEqual(old.rows[1].rawWord,fresh.rows[1].rawWord);
 assert.equal(fresh.rows[1].targetOffset,0x70);
});
test('mobile and offline window controls and safe navigation are wired',async()=>{
 const [app,html,offline,build]=await Promise.all([
  readFile(new URL('../src/app.js',import.meta.url),'utf8'),
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../app/CUBHMA_Mobile_Lab_Offline.html',import.meta.url),'utf8'),
  readFile(new URL('../build-standalone.mjs',import.meta.url),'utf8')
 ]);
 for(const source of [html,offline]){
  assert.match(source,/id="map-bank-raw-window-scan"/);
  assert.match(source,/id="map-bank-raw-window-status"/);
  assert.match(source,/id="map-bank-raw-window-list"/);
 }
 assert.match(app,/inspectHmaMapBankRawWindow/);
 assert.match(app,/fresh\.rows\[row\.index\]\.rawWord!==row\.rawWord/);
 assert.match(build,/hma-map-bank-raw-window\.js/);
 assert.match(offline,/function inspectHmaMapBankRawWindow/);
});
