import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RomModel} from '../src/core.js';
import {fingerprintRomSha256} from '../src/rom-fingerprint.js';
import {fingerprintMetadataFiles,compareRomMetadataIdentity,compareRomMetadataFingerprintRecords} from '../src/metadata-fingerprint.js';

const bytes=s=>new TextEncoder().encode(s);
const sha=data=>createHash('sha256').update(data).digest('hex');
function rom(){
  const data=new Uint8Array(0x200);
  for(const [i,c] of [...'BPEE'].entries())data[0xAC+i]=c.charCodeAt(0);
  return new RomModel('test.gba',data);
}
function profile(romHash,metaHash){
  return {sha256:romHash,length:0x200,gameCode:'BPEE',revision:0,
    layout:'expansion',metadataSha256:metaHash,sourceCommit:'a'.repeat(40),
    evidenceUrl:'https://github.com/kcradi/CUBHMA/commit/'+'a'.repeat(40)};
}
test('cached metadata digests give same result as original exact raw bytes',async()=>{
  const model=rom(),fingerprint=await fingerprintRomSha256(model);
  const raw=Uint8Array.from([0xEF,0xBB,0xBF,...bytes('[[NamedAnchors]]\r\n')]);
  const sources=[{name:'metadata.toml',bytes:raw}];
  const records=fingerprintMetadataFiles(sources);
  const profiles=[profile(fingerprint.sha256,sha(raw))];
  const result=compareRomMetadataFingerprintRecords(model,fingerprint,records,{profiles});
  assert.deepEqual(result,compareRomMetadataIdentity(model,fingerprint,sources,{profiles}));
  assert.equal(result.metadataExactMatch,true);
  assert.equal(result.metadataAuthenticated,false);
  assert.equal(result.semanticWritesAllowed,false);
  assert.equal(result.curated,false);
});
test('cached digest records are copied, normalized and frozen',async()=>{
  const model=rom(),fingerprint=await fingerprintRomSha256(model),raw=bytes('hello');
  const record={name:'m.toml',length:raw.length,sha256:sha(raw).toUpperCase()};
  const result=compareRomMetadataFingerprintRecords(model,fingerprint,[record],
    {profiles:[profile(fingerprint.sha256,sha(raw))]});
  record.sha256='0'.repeat(64);
  assert.equal(result.metadataFiles[0].sha256,sha(raw));
  assert.equal(result.metadataExactMatch,true);
  assert.ok(Object.isFrozen(result.metadataFiles));
  assert.ok(Object.isFrozen(result.metadataFiles[0]));
});
test('multi-file digests require a manifest, not a concatenation or first-file match',async()=>{
  const model=rom(),fingerprint=await fingerprintRomSha256(model);
  const a=bytes('a'),b=bytes('b'),profiles=[profile(fingerprint.sha256,sha(a))];
  const result=compareRomMetadataFingerprintRecords(model,fingerprint,
    fingerprintMetadataFiles([{name:'a.toml',bytes:a},{name:'b.toml',bytes:b}]),{profiles});
  assert.equal(result.metadataBindingStatus,'multi-file-manifest-required');
  assert.equal(result.metadataExactMatch,null);
  assert.equal(result.semanticWritesAllowed,false);
});
test('cached digests cannot bind a stale ROM fingerprint',async()=>{
  const model=rom(),fingerprint=await fingerprintRomSha256(model),raw=bytes('a');
  const profiles=[profile(fingerprint.sha256,sha(raw))];
  model.write(0x100,42);
  const result=compareRomMetadataFingerprintRecords(model,fingerprint,
    fingerprintMetadataFiles([{name:'m.toml',bytes:raw}]),{profiles});
  assert.equal(result.status,'stale');
  assert.equal(result.metadataExactMatch,null);
});
test('malformed or duplicate cached digest records fail closed',async()=>{
  const model=rom(),fingerprint=await fingerprintRomSha256(model);
  const good={name:'m.toml',length:1,sha256:'a'.repeat(64)};
  for(const records of [null,{},new Array(17).fill(good),[{}],
    [{...good,length:0}],[{...good,length:4*1024*1024+1}],
    [{...good,sha256:'bad'}],[{...good,name:''}],[good,good],
    Array.from({length:5},(_,i)=>({...good,name:'f'+i,length:4*1024*1024}))])
    assert.throws(()=>compareRomMetadataFingerprintRecords(model,fingerprint,records));
});
