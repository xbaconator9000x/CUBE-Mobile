import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile and standalone expose gated rendered map canvas',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-render-enabled','map-render-status','map-render-canvas'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 const app=read('src/app.js');
 assert.match(app,/renderVanillaMapViewport\(model/);
 assert.match(app,/requireVanillaMapFormat\(\)/);
 assert.match(app,/header\.layout\.blockmapOffset!==address/);
 assert.match(app,/clearRenderedMap\('ROM replaced/);
 assert.match(read('app/CUBHMA_Mobile_Lab_Offline.html'),/function renderVanillaMapViewport/);
});

test('mobile displays raw metatile behavior/layer without calling it walkability',()=>{
 const app=read('src/app.js');
 assert.match(app,/rendered\.attributes/);
 assert.match(app,/attr\.behavior/);
 assert.match(app,/not verified walkability/);
});
