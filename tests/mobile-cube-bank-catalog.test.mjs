import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('CUBE explicit bank catalog supports touch navigation with stale-byte verification',async()=>{
 const [app,html,offline,build]=await Promise.all([
  read('src/app.js'),read('index.html'),read('app/CUBHMA_Mobile_Lab_Offline.html'),
  read('build-standalone.mjs')]);
 for(const page of [html,offline])
  for(const id of ['cube-map-catalog-scan','cube-map-catalog-status','cube-map-catalog-list'])
   assert.ok(page.includes('id="'+id+'"'),id);
 assert.match(app,/inspectHmaCubeBankCatalog\(model,mapBankCustomSummary/);
 assert.match(app,/JSON\.stringify\(fresh\)!==JSON\.stringify\(snapshot\.report\)/);
 assert.match(app,/cube-map-inspect'\)\.click\(\)/);
 assert.match(app,/clearCubeCatalog\(\);clearCubeRenderedMap/);
 assert.match(build,/stripHmaCubeBankCatalog/);
 assert.match(offline,/const inspectHmaCubeBankCatalog=\(\(\)=>/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
