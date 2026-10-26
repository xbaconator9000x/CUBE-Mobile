import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {StreamingSha256,fingerprintRomSha256,fingerprintMatchesRom} from '../src/rom-fingerprint.js';
import {RomModel} from '../src/core.js';
const reference=data=>createHash('sha256').update(data).digest('hex');
test('SHA-256 NIST vectors, empty, abc and million a',()=>{
 const cases=[
  [new Uint8Array(),'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  [new TextEncoder().encode('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  [new Uint8Array(1_000_000).fill(97),'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0']
 ];
 for(const [bytes,expected] of cases){
  const sha=new StreamingSha256();
  for(let i=0;i<bytes.length;i+=37)sha.update(bytes.subarray(i,i+37));
  assert.equal(sha.digestHex(),expected);
  assert.throws(()=>sha.digestHex());
  assert.throws(()=>sha.update(new Uint8Array()));
 }
});
test('SHA-256 chunk boundaries match independent Node crypto',()=>{
 for(const n of [1,55,56,57,63,64,65,119,120,121,128,129,1024,65537]){
  const bytes=Uint8Array.from({length:n},(_,i)=>(i*97+11)&255);
  for(const step of [1,7,63,64,65,512]){
   const sha=new StreamingSha256();
   for(let i=0;i<n;i+=step)sha.update(bytes.subarray(i,i+step));
   assert.equal(sha.digestHex(),reference(bytes),'length '+n+' step '+step);
  }
 }
});
test('fingerprint includes staged edits without snapshot allocation or ROM mutation',async()=>{
 const bytes=Uint8Array.from({length:0x200},(_,i)=>i&255);
 const rom=new RomModel('test.gba',bytes);
 rom.snapshot=()=>{throw Error('Full ROM snapshot must not be allocated');};
 rom.write(0,0xFF);rom.write(0x1FF,0x55);
 const expected=bytes.slice();expected[0]=0xFF;expected[0x1FF]=0x55;
 const result=await fingerprintRomSha256(rom,{chunkSize:64,yieldEvery:2});
 assert.equal(result.sha256,reference(expected));
 assert.equal(fingerprintMatchesRom(rom,result),true);
 assert.deepEqual(rom.original,bytes);
 assert.deepEqual(rom.base,bytes);
 rom.undo();
 assert.equal(fingerprintMatchesRom(rom,result),false);
});
test('concurrent edits do not change captured fingerprint or silently remain valid',async()=>{
 const bytes=new Uint8Array(0x400).fill(0x3F);
 const rom=new RomModel('test.gba',bytes);
 const result=await fingerprintRomSha256(rom,{chunkSize:64,yieldEvery:1,
  onProgress:(done)=>{if(done===64)rom.write(200,0xCC);}
 });
 assert.equal(result.sha256,reference(bytes));
 assert.equal(fingerprintMatchesRom(rom,result),false);
});
test('patched ROM replacement invalidates earlier fingerprint',async()=>{
 const rom=new RomModel('test.gba',new Uint8Array(0x200));
 const result=await fingerprintRomSha256(rom);
 rom.switchPatched(new Uint8Array(0x200).fill(1));
 assert.equal(fingerprintMatchesRom(rom,result),false);
});
test('fingerprint refuses invalid inputs and honours cancellation',async()=>{
 const rom=new RomModel('test.gba',new Uint8Array(0x200));
 await assert.rejects(fingerprintRomSha256(rom,{chunkSize:0}));
 await assert.rejects(fingerprintRomSha256(rom,{chunkSize:2**21}));
 await assert.rejects(fingerprintRomSha256(rom,{signal:{aborted:true}}),/cancelled/);
 rom.edits.set(rom.length,1);
 await assert.rejects(fingerprintRomSha256(rom),/Invalid staged/);
});
