import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('local and upstream TOML imports hash exact bytes before atomic metadata commit',()=>{
  const app=read('src/app.js');
  const local=app.slice(app.indexOf("$('metadata-picker').addEventListener"),
    app.indexOf('const upstreamPin='));
  const upstream=app.slice(app.indexOf("$('metadata-stock').addEventListener"));
  assert.match(local,/new Uint8Array\(await file\.arrayBuffer\(\)\)/);
  assert.match(upstream,/new Uint8Array\(await response\.arrayBuffer\(\)\)/);
  assert.doesNotMatch(local,/file\.text\(\)/);
  assert.doesNotMatch(upstream,/response\.text\(\)/);
  assert.match(app,/const nextFingerprints=fingerprintMetadataFiles\(sources\.map/);
  assert.match(app,/metadataFingerprints=nextFingerprints;/);
  assert.match(local,/assertMetadataImportCurrent\(snapshot,serial\);\s*metadataCommit\(sources\);/);
  assert.match(upstream,/assertMetadataImportCurrent\(snapshot,serial\);\s*metadataCommit\(sources\);/);
});
test('ROM replacement and metadata reset invalidate cached metadata identity',()=>{
  const app=read('src/app.js');
  assert.match(app,/function installModel\(name,bytes\)\{metadataImportSerial\+\+;metadataFingerprints=\[\];/);
  assert.match(app,/function metadataReset\(\)\{metadataImportSerial\+\+;metadataFingerprints=\[\];/);
  assert.match(app,/fingerprintMatchesRom\(model,\{snapshot\}\)/);
  assert.match(app,/drawMetadataFingerprintStatus\(\);/);
});
test('offline and modular UI both expose metadata digests and no write authority',()=>{
  const app=read('src/app.js'),html=read('index.html'),offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
  assert.match(html,/id="metadata-fingerprint-status"/);
  assert.match(offline,/id="metadata-fingerprint-status"/);
  assert.match(app,/compareRomMetadataFingerprintRecords\(model,fingerprintResult,metadataFingerprints\)/);
  assert.match(app,/Identity does not authenticate CUBE layout or permit semantic writes/);
  assert.match(offline,/function compareRomMetadataFingerprintRecords\(/);
  assert.match(offline,/function fingerprintMetadataFiles\(/);
  const inline=offline.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
  assert.ok(inline,'standalone script is present');
  assert.doesNotThrow(()=>new Script("'use strict';\n"+inline[1]),'offline bundle parses as a classic script');
});
