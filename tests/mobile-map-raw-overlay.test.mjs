import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('modular and offline mobile views expose bounded raw-value overlays',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-raw-overlay-mode','map-overlay-status','map-overlay-legend'])
   assert.match(html,new RegExp('id="'+id+'"'));
  for(const mode of ['none','highBits','behavior','terrain','encounter'])
   assert.match(html,new RegExp('value="'+mode+'"'));
  assert.match(html,/not passability/i);
 }
});
test('rendered map overlay is applied before spatial event markers',()=>{
 const app=read('src/app.js');
 const start=app.indexOf("const overlayMode=$('map-raw-overlay-mode').value;");
 const markers=app.indexOf("const projected=projectRenderedMapMarkers(rendered,markerIndex,eventMarkerIndex);",start);
 assert.ok(start>0&&markers>start);
 assert.match(app.slice(start,markers),/buildVanillaRawMapOverlay/);
 assert.match(app.slice(start,markers),/context\.fillRect\(cell\.column\*16,cell\.row\*16,16,16\)/);
 assert.match(app,/map-raw-overlay-mode'\)\.addEventListener\('change'/);
 assert.match(app,/NOT verified collision or walkability/);
});
test('standalone overlay bundle is valid JavaScript and contains no imports',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function buildVanillaRawMapOverlay/);
 const match=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(match);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+match[1]));
 assert.doesNotMatch(match[1],/^import \{/m);
});
