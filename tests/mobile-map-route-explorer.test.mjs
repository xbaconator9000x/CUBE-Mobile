import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile route controls and module are present in modular and offline builds',()=>{
 const html=read('index.html'),app=read('src/app.js'),
  offline=read('app/CUBHMA_Mobile_Lab_Offline.html'),
  build=read('build-standalone.mjs');
 for(const id of ['map-atlas-route','map-atlas-route-target',
  'map-atlas-route-status','map-atlas-route-list']){
  assert.equal(html.split('id="'+id+'"').length-1,1);
  assert.equal(offline.split('id="'+id+'"').length-1,1);
  assert.ok(app.includes("$('"+id+"')"));
 }
 assert.match(app,/import \{inspectVanillaAtlasRawRoute\} from '\.\/map-route-explorer\.js'/);
 assert.match(build,/mapRouteExplorer=read\('src\/map-route-explorer\.js'\)/);
 assert.match(offline,/function inspectVanillaAtlasRawRoute\(/);
 assert.doesNotMatch(offline,/import \{inspectVanillaAtlasRawRoute\}/);
});
test('raw route click handler is identical in offline and modular builds',()=>{
 const app=read('src/app.js'),offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 const start="$('map-atlas-route').addEventListener('click'";
 const end="$('map-atlas-raw-census').addEventListener('click'";
 const extract=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));
 assert.ok(app.indexOf(start)>0&&offline.indexOf(start)>0);
 assert.equal(extract(app),extract(offline));
 assert.match(extract(app),/inputsUnchanged\(\)/);
 assert.match(extract(app),/freshRoute\(\)/);
 assert.match(extract(app),/setPageForOffset\(step.sourceOffset\)/);
 assert.match(extract(app),/openDeclaredAtlasMap\(destination\)/);
 assert.match(extract(app),/NOT verified gameplay travel/);
});
test('atlas invalidation clears route results and disables route selection',()=>{
 const app=read('src/app.js');
 const clear=app.slice(app.indexOf('function clearMapAtlas('),
  app.indexOf('function openDeclaredAtlasMap('));
 assert.match(clear,/\$\('map-atlas-route'\)\.disabled=true/);
 assert.match(clear,/\$\('map-atlas-route-target'\)\.disabled=true/);
 assert.match(clear,/\$\('map-atlas-route-list'\)\.replaceChildren\(\)/);
 assert.match(app,/\$\('map-atlas-route'\)\.disabled=false/);
 assert.match(app,/routeTarget\.replaceChildren/);
});
