import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('CUBE raw warp markers overlay rendered map in modular and offline UI',async()=>{
 const [html,app,offline]=await Promise.all([
  read('index.html'),read('src/app.js'),read('app/CUBHMA_Mobile_Lab_Offline.html')]);
 for(const page of [html,offline]){
  assert.match(page,/<option value="warps">Warp source markers and destinations<\/option>/);
  assert.match(page,/id="cube-map-overlay-legend"/);
 }
 for(const source of [app,offline]){
  assert.match(source,/overlayMode==='warps'/);
  assert.match(source,/warpOverlayReport=inspectHmaCubeMapEventWarps/);
  assert.match(source,/ctx\.strokeRect\(cx\+1,cy\+1,14,14\)/);
  assert.match(source,/JSON\.stringify\(freshWarps\)!==snapshot\.warpOverlayJson/);
  assert.match(source,/No gameplay traversal or collision inference/);
 }
});
