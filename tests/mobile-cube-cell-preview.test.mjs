import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('CUBE visual-only proposed cell UI is wired in modular and offline builds',async()=>{
 const [html,app,build,offline]=await Promise.all([
  read('index.html'),read('src/app.js'),read('build-standalone.mjs'),
  read('app/CUBHMA_Mobile_Lab_Offline.html')]);
 for(const page of [html,offline]){
  for(const id of ['cube-map-proposed-tile','cube-map-proposed-high','cube-map-cell-preview',
   'cube-map-preview-status','cube-map-preview-after'])
   assert.ok(page.includes('id="'+id+'"'),id);
 }
 assert.match(app,/previewHmaCubeBlockmapVisualChange\(model,mapBankCustomSummary/);
 assert.match(app,/expectedRaw:selected\.raw/);
 assert.match(app,/cube-map-preview-after/);
 assert.match(app,/No ROM writes, unknown shared ownership/);
 assert.match(build,/stripHmaCubeMapCellPreview/);
 assert.match(offline,/const previewHmaCubeBlockmapVisualChange=\(\(\)=>/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
