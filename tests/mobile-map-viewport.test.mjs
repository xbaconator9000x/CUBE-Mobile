import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('touch map pan controls appear in modular and offline builds',()=>{
 for(const html of [read('index.html'),read('app/CUBHMA_Mobile_Lab_Offline.html')])
  for(const id of ['map-pan-up','map-pan-down','map-pan-left','map-pan-right'])
   assert.match(html,new RegExp('id="'+id+'"'));
});
test('map markers are gated to matching blockmap offset and dimensions',()=>{
 const app=read('src/app.js');
 assert.match(app,/inspectedWarpMap\.address===address/);
 assert.match(app,/inspectedWarpMap\.width===width/);
 assert.match(app,/inspectedWarpMap\.height===height/);
 assert.match(app,/indexMapWarpMarkers\(inspectedWarpMap\.warps/);
 assert.match(app,/clearWarpInspection\('ROM bytes changed/);
 assert.match(app,/button\.classList\.toggle\('has-warp'/);
});
test('standalone bundle includes viewport helpers and touch handlers',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function panMapViewport/);
 assert.match(html,/function indexMapWarpMarkers/);
 assert.match(html,/\['map-pan-left',-12,0\]/);
 assert.doesNotMatch(html,/^import \{.*?\} from '\.\//m);
});
