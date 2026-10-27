import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('mobile and standalone expose the bounded raw-cell census control',()=>{
 const index=read('index.html'),app=read('src/app.js'),
  offline=read('app/CUBHMA_Mobile_Lab_Offline.html'),
  builder=read('build-standalone.mjs');
 for(const html of [index,offline]){
  assert.match(html,/id="map-atlas-raw-census"[^>]*disabled/);
  assert.match(html,/id="map-atlas-raw-census-status"/);
  assert.match(html,/id="map-atlas-raw-census-list"/);
 }
 for(const js of [app,offline]){
  assert.match(js,/auditVanillaAtlasRawCells\(model,atlas,opts\)/);
  assert.match(js,/maxMaps:128,maxUniqueCells:65536,maxRows:32/);
  assert.match(js,/if\(!inputsUnchanged\(\)\)/);
  assert.match(js,/walkability or CUBE collision semantics/);
 }
 assert.match(builder,/stripMapCellCensus/);
 assert.match(offline,/function auditVanillaAtlasRawCells\(/);
 assert.doesNotMatch(offline,/export function auditVanillaAtlasRawCells/);
});
