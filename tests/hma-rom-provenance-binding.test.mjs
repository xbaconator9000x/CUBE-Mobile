import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RomModel} from '../src/core.js';
import {fingerprintRomSha256} from '../src/rom-fingerprint.js';
import {fingerprintMetadataFiles} from '../src/metadata-fingerprint.js';
import {compareRomProfileManifestClaims} from '../src/rom-compatibility.js';
import {compareRomHmaProvenance} from '../src/hma-rom-provenance-binding.js';

const encode=text=>new TextEncoder().encode(text);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function makeRom(){
  const bytes=new Uint8Array(0x200);
  for(const [i,c] of [...'BPEE'].entries())bytes[0xAC+i]=c.charCodeAt(0);
  return new RomModel('synthetic.gba',bytes);
}
const commit='a'.repeat(40);
const url='https://github.com/kcradi/CUBHMA/commit/'+commit;
const files=()=>[
  {name:'base.toml',bytes:encode('[[NamedAnchors]]\r\nName = "x"\r\n')}
];
function evidence(fingerprint,inputs=files()){
  const records=fingerprintMetadataFiles(inputs);
  const profile={
    sha256:fingerprint.sha256,length:0x200,gameCode:'BPEE',revision:0,
    layout:'expansion',metadataSha256:records[0].sha256,
    sourceCommit:commit,evidenceUrl:url
  };
  const manifest={
    romSha256:fingerprint.sha256,romLength:0x200,gameCode:'BPEE',
    revision:0,layout:'expansion',sourceCommit:commit,evidenceUrl:url,
    files:records.map(f=>({name:f.name,length:f.length,sha256:f.sha256}))
  };
  return {records,profile,manifest};
}
const check=(model,fp,records,profile,manifest)=>
  compareRomHmaProvenance(model,fp,records,{profiles:[profile],manifests:[manifest]});

test('matching exact ROM, revision, source commit and ordered TOML claims remain read-only',async()=>{
  const model=makeRom(),before=model.base.slice();
  const fp=await fingerprintRomSha256(model);
  const {records,profile,manifest}=evidence(fp);
  const result=check(model,fp,records,profile,manifest);
  assert.equal(result.status,'consistent-exact-byte-claims');
  assert.equal(result.consistentExactByteClaims,true);
  assert.equal(result.romStatus,'profile-match');
  assert.equal(result.manifestStatus,'exact-file-set-match');
  assert.equal(result.metadataFileCount,1);
  for(const key of ['independentlyAuthenticated','metadataAuthenticated',
    'cubeLayoutAuthenticated','semanticWritesAllowed','exclusiveOwnershipProven',
    'gameEmulatorVerified','androidHardwareVerified','strictParityEvidence'])
    assert.equal(result[key],false,key);
  assert.equal(result.readOnly,true);
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(model.base,before);
  assert.equal(model.dirty,false);
});

test('empty curated registries cannot claim any provenance binding',async()=>{
  const model=makeRom(),fp=await fingerprintRomSha256(model);
  const {records}=evidence(fp);
  const result=compareRomHmaProvenance(model,fp,records);
  assert.equal(result.status,'rom-profile-unavailable');
  assert.equal(result.consistentExactByteClaims,false);
  assert.equal(result.semanticWritesAllowed,false);
});

test('one changed TOML byte fails even if the ROM and profile are exact',async()=>{
  const model=makeRom(),fp=await fingerprintRomSha256(model);
  const {profile,manifest}=evidence(fp);
  const changed=fingerprintMetadataFiles([{name:'base.toml',bytes:encode('Name = "Y"')}]);
  const result=check(model,fp,changed,profile,manifest);
  assert.equal(result.status,'file-byte-mismatch');
  assert.equal(result.consistentExactByteClaims,false);
});

test('overlay order and missing overlays cannot be silently accepted',async()=>{
  const model=makeRom(),fp=await fingerprintRomSha256(model);
  const inputs=[...files(),{name:'cube_emerald.toml',bytes:encode('overlay\n')}];
  const {records,profile,manifest}=evidence(fp,inputs);
  const reversed=[...records].reverse();
  assert.equal(check(model,fp,reversed,profile,manifest).status,
    'ordered-file-set-mismatch');
  assert.equal(check(model,fp,records.slice(0,1),profile,manifest).status,
    'ordered-file-set-mismatch');
  assert.equal(check(model,fp,[],profile,manifest).status,'metadata-missing');
});

test('multi-file manifest cannot masquerade as a single-file profile digest',async()=>{
  const model=makeRom(),fp=await fingerprintRomSha256(model);
  const inputs=[...files(),{name:'cube_emerald.toml',bytes:encode('overlay\n')}];
  const {records,profile,manifest}=evidence(fp,inputs);
  const result=check(model,fp,records,profile,manifest);
  assert.equal(result.manifestStatus,'exact-file-set-match');
  assert.equal(result.status,'multi-file-profile-unbound');
  assert.equal(result.consistentExactByteClaims,false);
});

test('conflicting layout and source revision are rejected independently',async()=>{
  const model=makeRom(),fp=await fingerprintRomSha256(model);
  const {records,profile,manifest}=evidence(fp);
  assert.equal(check(model,fp,records,{...profile,layout:'stock'},manifest).status,
    'layout-conflict');
  assert.equal(check(model,fp,records,{...profile,sourceCommit:'b'.repeat(40)},manifest).status,
    'source-revision-conflict');
  assert.equal(check(model,fp,records,{...profile,metadataSha256:'c'.repeat(64)},manifest).status,
    'profile-metadata-digest-conflict');
});

test('ROM revision disagreement and stale staged edits fail closed',async()=>{
  const model=makeRom(),fp=await fingerprintRomSha256(model);
  const {records,profile,manifest}=evidence(fp);
  assert.equal(check(model,fp,records,{...profile,revision:1},manifest).status,
    'rom-header-conflict');
  assert.equal(check(model,fp,records,profile,{...manifest,revision:1}).status,
    'rom-header-conflict');
  model.write(0x100,123);
  const stale=check(model,fp,records,profile,manifest);
  assert.equal(stale.status,'stale');
  assert.equal(stale.semanticWritesAllowed,false);
  model.undo();
  assert.equal(check(model,fp,records,profile,manifest).status,
    'consistent-exact-byte-claims');
});

test('missing manifest or unknown ROM profile never infers provenance',async()=>{
  const model=makeRom(),fp=await fingerprintRomSha256(model);
  const {records,profile,manifest}=evidence(fp);
  const missing=compareRomHmaProvenance(model,fp,records,
    {profiles:[profile],manifests:[]});
  assert.equal(missing.status,'ordered-manifest-unavailable');
  const unknown=check(model,fp,records,
    {...profile,sha256:'d'.repeat(64)},manifest);
  assert.equal(unknown.status,'rom-profile-unavailable');
});

test('malformed profile, manifest and fingerprint records fail before acceptance',async()=>{
  const model=makeRom(),fp=await fingerprintRomSha256(model);
  const {records,profile,manifest}=evidence(fp);
  assert.throws(()=>check(model,fp,records,{...profile,sha256:'bad'},manifest));
  assert.throws(()=>check(model,fp,records,profile,{...manifest,files:[]}));
  assert.throws(()=>check(model,fp,[{name:'base.toml',length:1,sha256:'bad'}],
    profile,manifest));
  assert.throws(()=>compareRomProfileManifestClaims(profile,
    {...manifest,fileCount:0},records),/Invalid cross-source/);
});

test('direct claim comparison never treats matching user-supplied records as authentication',async()=>{
  const model=makeRom(),fp=await fingerprintRomSha256(model);
  const {records,profile,manifest}=evidence(fp);
  const summary={...manifest,fileCount:manifest.files.length};
  const result=compareRomProfileManifestClaims(profile,summary,records);
  assert.equal(result.status,'consistent-exact-byte-claims');
  assert.equal(result.independentlyAuthenticated,false);
  assert.equal(result.semanticWritesAllowed,false);
  assert.ok(Object.isFrozen(result));
  assert.equal(sha(files()[0].bytes),records[0].sha256);
});
