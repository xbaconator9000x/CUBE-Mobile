import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('touchscreen and offline CUBE event/warp inspector revalidate before hex navigation',async()=>{
 const [app,html,offline,build]=await Promise.all([
   read('src/app.js'),read('index.html'),read('app/CUBHMA_Mobile_Lab_Offline.html'),
   read('build-standalone.mjs')]);
 for(const page of [html,offline])
  for(const id of ['cube-map-warps','cube-warps-status','cube-warps-list'])
   assert.match(page,new RegExp('id="'+id+'"'));
 assert.match(app,/inspectHmaCubeMapEventWarps\(model,mapBankCustomSummary,options\)/);
 assert.match(app,/JSON\.stringify\(now\)!==JSON\.stringify\(snapshot\.report\)/);
 assert.match(app,/cubeWarpEvidence=null/);
 assert.match(app,/outsideDeclaredMap/);
 assert.match(app,/specialTarget/);
 assert.match(build,/stripHmaCubeMapEvents/);
 assert.match(offline,/function inspectHmaCubeMapEventWarps\(/);
 assert.match(offline,/function drawCubeWarpEvidence\(/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
