import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('opt-in CUBE RSE rendered canvas is available in modular and offline builds',async()=>{
 const [html,app,offline,build]=await Promise.all([
  read('index.html'),read('src/app.js'),
  read('app/CUBHMA_Mobile_Lab_Offline.html'),read('build-standalone.mjs')]);
 for(const page of [html,offline])for(const id of [
  'cube-map-render','cube-map-render-canvas','cube-map-render-status',
  'cube-map-render-selection','cube-map-render-jump'])
  assert.match(page,new RegExp('id="'+id+'"'));
 assert.match(app,/renderHmaCubeMapViewport\(model,mapBankCustomSummary/);
 assert.match(app,/image\.data\.set\(rendered\.pixels\)/);
 assert.match(app,/inspectRenderedMapPixel\(fresh/);
 assert.match(app,/fresh\.pixels\.every/);
 assert.match(app,/clearCubeRenderedMap\('ROM replaced/);
 assert.match(app,/clearCubeRenderedMap\('Metadata reset/);
 assert.match(app,/cubeRenderEvidence=null/);
 assert.match(build,/stripHmaCubeMapRender/);
 assert.match(offline,/const renderHmaCubeMapViewport=\(\(\)=>\{/);
 assert.match(offline,/function clearCubeRenderedMap\(/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
