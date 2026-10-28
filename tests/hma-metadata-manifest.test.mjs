import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RomModel} from '../src/core.js';
import {fingerprintRomSha256} from '../src/rom-fingerprint.js';
import {fingerprintMetadataFiles} from '../src/metadata-fingerprint.js';
import {CURATED_HMA_METADATA_MANIFESTS,validateHmaMetadataManifests,
  compareHmaMetadataManifest} from '../src/hma-metadata-manifest.js';

const bytes=s=>new TextEncoder().encode(s);
const sha=b=>createHash('sha256').update(b).digest('hex');
function rom(){
 const data=new Uint8Array(0x200);
 for(const [i,c] of [...'BPEE'].entries())data[0xAC+i]=c.charCodeAt(0);
 return new RomModel('fixture.gba',data);
}
function manifest(fingerprint,files){
 return {romSha256:fingerprint.sha256,romLength:0x200,gameCode:'BPEE',
  revision:0,layout:'custom',sourceCommit:'a'.repeat(40),
  evidenceUrl:'https://github.com/kcradi/CUBHMA/commit/'+'a'.repeat(40),
  files:files.map(f=>({name:f.name,length:f.bytes.length,sha256:sha(f.bytes)}))};
}
test('ordered exact multi-file manifest comparison never authenticates CUBE or enables writes',async()=>{
 const model=rom(),fingerprint=await fingerprintRomSha256(model);
 const files=[{name:'default.toml',bytes:bytes('common\r\n')},
  {name:'cube_emerald.toml',bytes:bytes('overlay\n')}];
 const records=fingerprintMetadataFiles(files);
 const expected=manifest(fingerprint,files);
 const result=compareHmaMetadataManifest(model,fingerprint,records,{manifests:[expected]});
 assert.equal(result.status,'exact-file-set-match');
 assert.equal(result.exactFileSetMatch,true);
 assert.equal(result.independentlyAuthenticated,false);
 assert.equal(result.semanticWritesAllowed,false);
 assert.equal(result.metadataAuthenticated,false);
 assert.equal(result.cubeLayoutAuthenticated,false);
 assert.equal(result.curatedManifest,false);
 assert.equal(CURATED_HMA_METADATA_MANIFESTS.length,0);
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.metadataFiles));
 assert.equal(result.manifest.fileCount,2);
});
test('reordered files, missing files, renamed files and changed bytes fail closed',async()=>{
 const model=rom(),fingerprint=await fingerprintRomSha256(model);
 const files=[{name:'default.toml',bytes:bytes('one')},
  {name:'cube_emerald.toml',bytes:bytes('two')}];
 const expected=manifest(fingerprint,files);
 const check=entries=>compareHmaMetadataManifest(model,fingerprint,
  fingerprintMetadataFiles(entries),{manifests:[expected]});
 assert.equal(check([...files].reverse()).status,'ordered-file-set-mismatch');
 assert.equal(check([files[0]]).status,'ordered-file-set-mismatch');
 assert.equal(check([{...files[0],name:'renamed.toml'},files[1]]).status,'ordered-file-set-mismatch');
 assert.equal(check([{...files[0],bytes:bytes('ONE')},files[1]]).status,'file-byte-mismatch');
 assert.equal(check([]).status,'metadata-missing');
});
test('ROM replacement and modified staged ROM invalidate an otherwise exact manifest',async()=>{
 const model=rom(),fingerprint=await fingerprintRomSha256(model);
 const files=[{name:'a.toml',bytes:bytes('x')}],records=fingerprintMetadataFiles(files);
 const expected=manifest(fingerprint,files);
 model.write(0x100,0x42);
 assert.equal(compareHmaMetadataManifest(model,fingerprint,records,{manifests:[expected]}).status,'stale');
 const next=await fingerprintRomSha256(model);
 assert.equal(compareHmaMetadataManifest(model,next,records,{manifests:[expected]}).status,'unknown-rom');
});
test('header conflict cannot match even when a caller supplies the exact ROM digest',async()=>{
 const model=rom(),fingerprint=await fingerprintRomSha256(model);
 const files=[{name:'a.toml',bytes:bytes('x')}];
 const expected={...manifest(fingerprint,files),gameCode:'BPRE'};
 const result=compareHmaMetadataManifest(model,fingerprint,fingerprintMetadataFiles(files),
  {manifests:[expected]});
 assert.equal(result.status,'rom-header-conflict');
 assert.equal(result.exactFileSetMatch,null);
});
test('unverified ROMs and empty curated registry do not produce exact matches',async()=>{
 const model=rom(),fingerprint=await fingerprintRomSha256(model);
 const records=fingerprintMetadataFiles([{name:'a.toml',bytes:bytes('x')}]);
 const result=compareHmaMetadataManifest(model,fingerprint,records);
 assert.equal(result.status,'unknown-rom');
 assert.equal(result.independentlyAuthenticated,false);
});
test('rejects duplicate, unsafe and oversized manifests before comparing bytes',async()=>{
 const model=rom(),fingerprint=await fingerprintRomSha256(model);
 const files=[{name:'a.toml',bytes:bytes('x')}],good=manifest(fingerprint,files);
 const bad=[
  [good,good],
  [{...good,files:[]}],
  [{...good,files:[...good.files,{...good.files[0],name:'A.toml'}]}],
  [{...good,files:[{...good.files[0],name:'../a.toml'}]}],
  [{...good,files:[{...good.files[0],name:'dir/a.toml'}]}],
  [{...good,files:[{...good.files[0],length:4*1024*1024+1}]}],
  [{...good,files:[{...good.files[0],sha256:'bad'}]}],
  [{...good,sourceCommit:'not-a-commit'}],
  [{...good,evidenceUrl:'http://example.com/unpinned'}],
  [{...good,romLength:100}],
  [{...good,revision:256}],
  Array.from({length:129},()=>good)
 ];
 for(const entries of bad)
  assert.throws(()=>validateHmaMetadataManifests(entries),undefined,JSON.stringify(entries).slice(0,60));
 assert.throws(()=>compareHmaMetadataManifest(model,fingerprint,
  fingerprintMetadataFiles(files),{manifests:[good,good]}),RangeError);
});
test('normalizes hashes, freezes copied manifest records and preserves exact TOML bytes',async()=>{
 const model=rom(),fingerprint=await fingerprintRomSha256(model);
 const files=[{name:'a.toml',bytes:Uint8Array.from([0xEF,0xBB,0xBF,13,10])}];
 const good=manifest(fingerprint,files);
 const registry=validateHmaMetadataManifests([{...good,
  romSha256:good.romSha256.toUpperCase(),
  files:[{...good.files[0],sha256:good.files[0].sha256.toUpperCase()}]}]);
 assert.ok(Object.isFrozen(registry[0].files[0]));
 assert.equal(registry[0].romSha256,fingerprint.sha256);
 assert.equal(registry[0].files[0].sha256,sha(files[0].bytes));
 assert.equal(compareHmaMetadataManifest(model,fingerprint,fingerprintMetadataFiles(files),
  {manifests:registry}).status,'exact-file-set-match');
});
