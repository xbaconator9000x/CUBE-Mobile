import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectHmaDeclaredBankTargetWindows} from '../src/hma-map-bank-target-windows.js';

const summary=count=>({status:'custom-candidate',uniqueDeclarationCount:1,
  declarations:[{address:16,addressInBounds:true}],declaredBankCount:count,
  declaredTableByteLength:count*4});
function fixture(pointers,windows={},length=256){
  const bytes=new Uint8Array(length);
  const set=(offset,word)=>{for(let j=0;j<4;j++)bytes[offset+j]=(word>>>(j*8))&255;};
  pointers.forEach((word,i)=>set(16+i*4,word));
  for(const [offset,words] of Object.entries(windows))
    words.forEach((word,i)=>set(Number(offset)+i*4,word));
  return {length,read:i=>bytes[i],bytes};
}
test('samples bounded second-hop raw words without inferring maps or writing',()=>{
  const rom=fixture([0x08000060,0x08000060,0x08000090,0x08000011,
    0x08000014,0x080000FC,0xFFFFFFFF],
    {96:[0x080000B0,0,0x08000300,0xFFFFFFFF],144:[0x080000C0,0,0,0]});
  const before=rom.bytes.slice();
  const result=inspectHmaDeclaredBankTargetWindows(rom,summary(7),{wordsPerTarget:4});
  assert.equal(result.sampledTargets,2);
  assert.equal(result.duplicateTargets,1);
  assert.equal(result.misalignedTargets,1);
  assert.equal(result.tableOverlaps,1);
  assert.equal(result.truncatedTargets,1);
  assert.equal(result.invalidTargets,1);
  assert.equal(result.conventionalNestedWords,3);
  assert.equal(result.inRomNestedWords,2);
  assert.equal(result.rows[0].words[0].targetOffset,176);
  assert.equal(result.rows[1].status,'duplicate-target');
  assert.equal(result.rows[1].sampleOf,0);
  assert.equal(result.rows[2].status,'sampled');
  assert.equal(result.writeAuthorized,false);
  assert.equal(result.romAuthenticated,false);
  assert.ok(Object.isFrozen(result.rows[0].words[0]));
  assert.deepEqual(rom.bytes,before);
});
test('rejects overlapping second-hop windows rather than treating them as separate structures',()=>{
  const rom=fixture([0x08000060,0x08000068],{96:[1,2,3,4]});
  const result=inspectHmaDeclaredBankTargetWindows(rom,summary(2),{wordsPerTarget:4});
  assert.equal(result.sampledTargets,1);
  assert.equal(result.overlappingWindows,1);
  assert.equal(result.rows[1].status,'overlapping-window');
});
test('fails closed for malformed metadata, bounds, limits and accessor bytes',()=>{
  const rom=fixture([0x08000060,0x08000090]);
  assert.throws(()=>inspectHmaDeclaredBankTargetWindows(rom,summary(2),{wordsPerTarget:17}),RangeError);
  assert.throws(()=>inspectHmaDeclaredBankTargetWindows(rom,summary(2),{maxUniqueTargets:0}),RangeError);
  assert.throws(()=>inspectHmaDeclaredBankTargetWindows(rom,summary(2),{maxUniqueTargets:1}),RangeError);
  assert.throws(()=>inspectHmaDeclaredBankTargetWindows(rom,{...summary(2),status:'conflicting-declarations'}),RangeError);
  const broken={length:rom.length,read:i=>i>=96&&i<112?256:rom.read(i)};
  assert.throws(()=>inspectHmaDeclaredBankTargetWindows(broken,summary(2),{wordsPerTarget:4}),RangeError);
});
test('reinspection detects changes to the second-hop target even with unchanged table',()=>{
  const rom=fixture([0x08000060],{96:[0x080000B0,0,0,0]});
  const old=inspectHmaDeclaredBankTargetWindows(rom,summary(1),{wordsPerTarget:4});
  rom.bytes[96]=0xC0;
  const fresh=inspectHmaDeclaredBankTargetWindows(rom,summary(1),{wordsPerTarget:4});
  assert.equal(old.rows[0].rawWord,fresh.rows[0].rawWord);
  assert.notEqual(old.rows[0].words[0].rawWord,fresh.rows[0].words[0].rawWord);
});
