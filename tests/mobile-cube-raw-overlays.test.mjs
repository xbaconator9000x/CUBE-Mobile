import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('CUBE rendered raw attribute overlays remain explicitly non-walkability and offline',async()=>{
 const [html,app,offline]=await Promise.all([
  read('index.html'),read('src/app.js'),read('app/CUBHMA_Mobile_Lab_Offline.html')]);
 for(const page of [html,offline]){
  assert.match(page,/id="cube-map-overlay"/);
  assert.match(page,/id="cube-map-overlay-legend"/);
  assert.match(page,/value="highBits"/);
  assert.match(page,/value="behavior"/);
 }
 assert.match(app,/buildVanillaRawMapOverlay\(rendered,\{mode:overlayMode,maxLegend:12\}\)/);
 assert.match(app,/snapshot\.overlayMode!==\$\('cube-map-overlay'\)\.value/);
 assert.match(app,/Raw overlay changed; render the CUBE map again/);
 assert.match(app,/overlay\.legend/);
 assert.match(app,/No CUBE raw overlay selected/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
