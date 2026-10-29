import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RomModel} from '../src/core.js';
import {fingerprintRomSha256} from '../src/rom-fingerprint.js';
import {fingerprintMetadataFiles} from '../src/metadata-fingerprint.js';
import {validateHmaMetadataManifests,compareHmaMetadataManifest} from '../src/hma-metadata-manifest.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const hash=async rom=>(await fingerprintRomSha256(rom)).sha256;
test('mobile and standalone expose bounded read-only ordered manifest import and clearing',()=>{
 const html=read('index.html'),offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 const app=read('src/app.js'),builder=read('build-standalone.mjs');
 for(const text of [html,offline]){
  assert.match(text,/id="metadata-manifest-picker"/);
  assert.match(text,/id="metadata-manifest-clear"/);
  assert.match(text,/id="metadata-manifest-status"/);
 }
 assert.match(app,/This is a caller-supplied claim, not independent CUBE authentication/);
 assert.match(offline,/This is a caller-supplied claim, not independent CUBE authentication/);
 assert.match(app,/validateHmaMetadataManifests\(\[JSON\.parse\(text\)\]\)/);
 assert.match(app,/compareHmaMetadataManifest\(model,fingerprintResult,metadataFingerprints/);
 assert.match(app,/file\.size>64\*1024/);
 assert.match(app,/manifestImportSerial\+\+;importedHmaManifest=null/);
 assert.match(builder,/stripHmaMetadataManifest/);
 assert.match(offline,/function compareHmaMetadataManifest\(/);
 assert.doesNotMatch(offline,/import \{compareHmaMetadataManifest/);
});
test('caller-supplied ordered byte match is still not authentication or permission',async()=>{
 const raw=new Uint8Array(0x200);
 for(const [i,c] of [...'BPEE'].entries())raw[0xAC+i]=c.charCodeAt(0);
 const rom=new RomModel('fixture.gba',raw),fp=await fingerprintRomSha256(rom);
 const bytes=new TextEncoder().encode('[[NamedAnchors]]\n');
 const records=fingerprintMetadataFiles([{name:'cube_emerald.toml',bytes}]);
 const crypto=await import('node:crypto');
 const manifest={romSha256:fp.sha256,romLength:raw.length,gameCode:'BPEE',revision:0,
  layout:'custom',sourceCommit:'a'.repeat(40),
  evidenceUrl:'https://github.com/kcradi/CUBHMA/commit/'+'a'.repeat(40),
  files:[{name:'cube_emerald.toml',length:bytes.length,
   sha256:crypto.createHash('sha256').update(bytes).digest('hex')}]};
 const [claim]=validateHmaMetadataManifests([manifest]);
 const result=compareHmaMetadataManifest(rom,fp,records,{manifests:[claim]});
 assert.equal(result.status,'exact-file-set-match');
 assert.equal(result.semanticWritesAllowed,false);
 assert.equal(result.independentlyAuthenticated,false);
 assert.equal(result.curatedManifest,false);
 rom.write(0x100,12);
 assert.equal(compareHmaMetadataManifest(rom,fp,records,{manifests:[claim]}).status,'stale');
});
