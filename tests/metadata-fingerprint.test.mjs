import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RomModel} from '../src/core.js';
import {fingerprintRomSha256} from '../src/rom-fingerprint.js';
import {CURATED_ROM_PROFILES} from '../src/rom-compatibility.js';
import {fingerprintMetadataFiles,compareRomMetadataIdentity} from '../src/metadata-fingerprint.js';

const bytes=text=>new TextEncoder().encode(text);
const sha=data=>createHash('sha256').update(data).digest('hex');
function rom(){
  const data=new Uint8Array(0x200);
  for(const [i,c] of [...'BPEE'].entries())data[0xAC+i]=c.charCodeAt(0);
  return new RomModel('synthetic.gba',data);
}
function profile(romHash,metadataHash,changes={}){
  return {sha256:romHash,length:0x200,gameCode:'BPEE',revision:0,
    layout:'expansion',metadataSha256:metadataHash,
    sourceCommit:'a'.repeat(40),
    evidenceUrl:'https://github.com/kcradi/CUBHMA/commit/'+'a'.repeat(40),
    ...changes};
}
test('metadata SHA-256 matches independent crypto over exact raw bytes',()=>{
  const samples=[
    bytes('[[NamedAnchors]]\nName = "x"\n'),
    bytes('[[NamedAnchors]]\r\nName = "x"\r\n'),
    Uint8Array.from([0xEF,0xBB,0xBF,...bytes('a=1\n')]),
    Uint8Array.from([0x00,0xFF,0x80,0xFE])
  ];
  for(const raw of samples){
    const result=fingerprintMetadataFiles([{name:'custom.toml',bytes:raw}]);
    assert.equal(result[0].sha256,sha(raw));
    assert.equal(result[0].length,raw.length);
  }
  assert.notEqual(sha(samples[0]),sha(samples[1]),'line endings must not be normalised');
  assert.notEqual(sha(samples[2]),sha(bytes('a=1\n')),'BOM must remain significant');
});
test('synthetic ROM + single exact TOML hash can match without granting write authority',async()=>{
  const model=rom(),fingerprint=await fingerprintRomSha256(model);
  const raw=bytes('[[NamedAnchors]]\nName="test"\n');
  const files=[{name:'custom.toml',bytes:raw}];
  const original=model.base.slice();
  const injected=[profile(fingerprint.sha256,sha(raw))];
  assert.deepEqual(CURATED_ROM_PROFILES,[]);
  const result=compareRomMetadataIdentity(model,fingerprint,files,{profiles:injected});
  assert.equal(result.status,'profile-match');
  assert.equal(result.metadataBindingStatus,'exact-byte-match');
  assert.equal(result.metadataExactMatch,true);
  assert.equal(result.curated,false);
  assert.equal(result.metadataAuthenticated,false);
  assert.equal(result.semanticWritesAllowed,false);
  assert.deepEqual(model.base,original);
  assert.equal(model.dirty,false);
  assert.deepEqual(raw,files[0].bytes);
  assert.equal(injected[0].metadataSha256,sha(raw),'profile not mutated');
});
test('one-byte metadata difference fails exact binding, even when ROM matches',async()=>{
  const model=rom(),fingerprint=await fingerprintRomSha256(model);
  const original=bytes('Name = "a"\n'),changed=bytes('Name = "b"\n');
  const result=compareRomMetadataIdentity(model,fingerprint,[{name:'m.toml',bytes:changed}],
    {profiles:[profile(fingerprint.sha256,sha(original))]});
  assert.equal(result.status,'profile-match');
  assert.equal(result.metadataExactMatch,false);
  assert.equal(result.metadataBindingStatus,'digest-mismatch');
  assert.equal(result.semanticWritesAllowed,false);
});
test('multi-file upstream-style overlays cannot masquerade as one metadata hash',async()=>{
  const model=rom(),fingerprint=await fingerprintRomSha256(model);
  const first=bytes('a=1\n'),second=bytes('b=2\n');
  const result=compareRomMetadataIdentity(model,fingerprint,[
    {name:'default.toml',bytes:first},{name:'default.bpee.toml',bytes:second}
  ],{profiles:[profile(fingerprint.sha256,sha(first))]});
  assert.equal(result.metadataExactMatch,null);
  assert.equal(result.metadataBindingStatus,'multi-file-manifest-required');
  assert.equal(result.metadataFiles.length,2);
  assert.equal(result.semanticWritesAllowed,false);
});
test('unverified, stale, and header-conflicting ROMs never claim metadata match',async()=>{
  const model=rom(),fingerprint=await fingerprintRomSha256(model),raw=bytes('a=1\n');
  const files=[{name:'a.toml',bytes:raw}],injected=[profile(fingerprint.sha256,sha(raw))];
  let result=compareRomMetadataIdentity(model,fingerprint,files);
  assert.equal(result.metadataBindingStatus,'rom-unverified');
  assert.equal(result.metadataExactMatch,null);
  result=compareRomMetadataIdentity(model,fingerprint,files,
    {profiles:[profile(fingerprint.sha256,sha(raw),{revision:1})]});
  assert.equal(result.status,'profile-conflict');
  assert.equal(result.metadataExactMatch,null);
  model.write(0x100,42);
  result=compareRomMetadataIdentity(model,fingerprint,files,{profiles:injected});
  assert.equal(result.status,'stale');
  assert.equal(result.metadataExactMatch,null);
  assert.equal(result.semanticWritesAllowed,false);
});
test('missing metadata is not a match, and validation fails closed',async()=>{
  const model=rom(),fingerprint=await fingerprintRomSha256(model);
  const result=compareRomMetadataIdentity(model,fingerprint,[],
    {profiles:[profile(fingerprint.sha256,'b'.repeat(64))]});
  assert.equal(result.metadataBindingStatus,'metadata-missing');
  assert.equal(result.metadataExactMatch,null);
  for(const bad of [
    null,{},new Array(17).fill({name:'a',bytes:bytes('a')}),
    [{name:'',bytes:bytes('a')}],
    [{name:'a',bytes:new Uint8Array()}],
    [{name:'a',bytes:'not raw bytes'}],
    [{name:'a',bytes:new Uint8Array(4*1024*1024+1)}],
    [{name:'same',bytes:bytes('1')},{name:'same',bytes:bytes('2')}]
  ])assert.throws(()=>fingerprintMetadataFiles(bad));
  const tooManyBytes=Array.from({length:5},(_,i)=>({
    name:'part'+i,bytes:new Uint8Array(4*1024*1024)
  }));
  assert.throws(()=>fingerprintMetadataFiles(tooManyBytes),/total size/);
});
