import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('CUBE warp record preflight is wired to modular and offline mobile interfaces',async()=>{
 const [app,html,offline,build,doc]=await Promise.all([
  read('src/app.js'),read('index.html'),read('app/CUBHMA_Mobile_Lab_Offline.html'),
  read('build-standalone.mjs'),read('docs/HMA_CUBE_WARP_EDIT_PREFLIGHT.md')]);
 for(const page of [html,offline])for(const id of [
  'cube-warp-edit-index','cube-warp-edit-load','cube-warp-edit-preview',
  'cube-warp-edit-x','cube-warp-edit-y','cube-warp-edit-elevation',
  'cube-warp-edit-warpId','cube-warp-edit-targetMap','cube-warp-edit-targetBank',
  'cube-warp-edit-target-banks','cube-warp-edit-status'])
   assert.ok(page.includes('id="'+id+'"'),id);
 assert.match(app,/previewHmaCubeWarpRecordChange\(model,mapBankCustomSummary/);
 assert.match(app,/freshCubeWarpEditSource\(cubeWarpEvidence\)/);
 assert.match(app,/cubeWarpEditSelection=null/);
 assert.match(app,/Other warps preserved:/);
 assert.match(build,/stripHmaCubeWarpEditPreview/);
 assert.match(offline,/const previewHmaCubeWarpRecordChange=\(\(\)=>/);
 assert.match(offline,/function clearCubeWarpEditPreview\(/);
 assert.doesNotMatch(offline,/src\/app\.js/);
 assert.match(doc,/mobile and offline interfaces/);
});
