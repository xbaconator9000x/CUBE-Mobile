import test from 'node:test';
import assert from 'node:assert/strict';
import {RomModel} from '../src/core.js';
import {fingerprintRomSha256} from '../src/rom-fingerprint.js';
import {CURATED_ROM_PROFILES,validateRomProfileRegistry,compareRomIdentity} from '../src/rom-compatibility.js';

function syntheticRom(){
  const bytes=new Uint8Array(0x200);
  for(const [i,v] of [...'BPEE'].entries())bytes[0xAC+i]=v.charCodeAt(0);
  bytes[0xBC]=0;
  return new RomModel('synthetic.gba',bytes);
}
const profile=(sha256,extra={})=>({
  sha256,length:0x200,gameCode:'BPEE',revision:0,layout:'expansion',
  metadataSha256:'b'.repeat(64),sourceCommit:'a'.repeat(40),
  evidenceUrl:'https://github.com/kcradi/CUBHMA/commit/'+ 'a'.repeat(40),
  ...extra
});
test('no real CUBE fingerprints are silently claimed by the bundled registry',async()=>{
  const rom=syntheticRom(),fingerprint=await fingerprintRomSha256(rom);
  assert.deepEqual(CURATED_ROM_PROFILES,[]);
  const result=compareRomIdentity(rom,fingerprint);
  assert.equal(result.status,'unknown');
  assert.equal(result.curated,false);
  assert.equal(result.metadataAuthenticated,false);
  assert.equal(result.semanticWritesAllowed,false);
});
test('a pasted hash is exact-byte evidence, never proof of CUBE layout',async()=>{
  const rom=syntheticRom(),fingerprint=await fingerprintRomSha256(rom);
  const match=compareRomIdentity(rom,fingerprint,{expectedSha256:'  '+fingerprint.sha256.toUpperCase()+'  '});
  assert.equal(match.expectedMatch,true);
  assert.equal(match.status,'unknown');
  assert.equal(match.metadataAuthenticated,false);
  assert.equal(match.semanticWritesAllowed,false);
  const mismatch=compareRomIdentity(rom,fingerprint,{expectedSha256:'0'.repeat(64)});
  assert.equal(mismatch.expectedMatch,false);
  assert.equal(mismatch.status,'unknown');
  assert.throws(()=>compareRomIdentity(rom,fingerprint,{expectedSha256:'bad'}),/64 hexadecimal/);
});
test('a synthetic injected profile can match but never grants trusted write access',async()=>{
  const rom=syntheticRom(),fingerprint=await fingerprintRomSha256(rom);
  const entry=profile(fingerprint.sha256.toUpperCase());
  const result=compareRomIdentity(rom,fingerprint,{profiles:[entry]});
  assert.equal(result.status,'profile-match');
  assert.equal(result.profile.layout,'expansion');
  assert.equal(result.curated,false);
  assert.equal(result.metadataAuthenticated,false);
  assert.equal(result.semanticWritesAllowed,false);
  assert.equal(entry.sha256,fingerprint.sha256.toUpperCase(),'validation never mutates input');
});
test('a conflicting header revision fails closed even for an exact injected hash',async()=>{
  const rom=syntheticRom(),fingerprint=await fingerprintRomSha256(rom);
  const result=compareRomIdentity(rom,fingerprint,{profiles:[profile(fingerprint.sha256,{revision:1})]});
  assert.equal(result.status,'profile-conflict');
  assert.equal(result.profile,null);
  assert.equal(result.semanticWritesAllowed,false);
});
test('staged edit, undo, patch replacement and model swap invalidate old identities',async()=>{
  const rom=syntheticRom(),fingerprint=await fingerprintRomSha256(rom);
  rom.write(0x100,7);
  assert.equal(compareRomIdentity(rom,fingerprint).status,'stale');
  rom.undo();
  assert.equal(compareRomIdentity(rom,fingerprint).status,'unknown');
  rom.switchPatched(new Uint8Array(0x200));
  assert.equal(compareRomIdentity(rom,fingerprint).status,'stale');
  assert.equal(compareRomIdentity(syntheticRom(),fingerprint).status,'stale');
});
test('profile registry rejects duplicate SHA, malformed provenance and unsupported layouts',()=>{
  const hash='a'.repeat(64),valid=profile(hash);
  assert.equal(validateRomProfileRegistry([valid])[0].sha256,hash);
  assert.throws(()=>validateRomProfileRegistry([valid,{...valid,layout:'stock'}]),/Duplicate/);
  for(const bad of [
    {sha256:'bad'},{length:0xBF},{length:128*1024*1024+1},
    {gameCode:'BPE!'},{revision:256},{layout:'guess'},
    {metadataSha256:'bad'},{sourceCommit:'bad'},
    {evidenceUrl:'http://example.org/test'}
  ])assert.throws(()=>validateRomProfileRegistry([profile(hash,bad)]),/Invalid exact/);
  assert.throws(()=>validateRomProfileRegistry(null),/Invalid ROM profile registry/);
});
test('profile registry and comparison cannot alter the original ROM bytes',async()=>{
  const rom=syntheticRom(),original=rom.original.slice(),base=rom.base.slice();
  const fingerprint=await fingerprintRomSha256(rom);
  const registry=[profile(fingerprint.sha256)];
  compareRomIdentity(rom,fingerprint,{profiles:registry,expectedSha256:fingerprint.sha256});
  assert.deepEqual(rom.original,original);
  assert.deepEqual(rom.base,base);
  assert.equal(rom.dirty,false);
});
test('invalid fingerprint shape is rejected instead of treated as a known profile',async()=>{
  const rom=syntheticRom(),fingerprint=await fingerprintRomSha256(rom);
  const bad={...fingerprint,sha256:'xyz'};
  assert.throws(()=>compareRomIdentity(rom,bad),/Invalid ROM fingerprint/);
  assert.throws(()=>compareRomIdentity(rom,{...fingerprint,length:0}),/Invalid ROM fingerprint/);
});
