import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('touch-first graph UI is wired in modular and standalone builds',()=>{
 const html=read('index.html'),app=read('src/app.js'),
  offline=read('app/CUBHMA_Mobile_Lab_Offline.html'),
  build=read('build-standalone.mjs');
 for(const id of ['map-atlas-graph','map-atlas-graph-status','map-atlas-graph-list']){
  assert.equal(html.split('id="'+id+'"').length-1,1);
  assert.equal(offline.split('id="'+id+'"').length-1,1);
  assert.ok(app.includes("$('"+id+"')"));
 }
 assert.match(app,/import \{auditVanillaAtlasWarpGraph\} from '\.\/map-warp-graph\.js'/);
 assert.match(build,/mapWarpGraph=read\('src\/map-warp-graph\.js'\)/);
 assert.match(offline,/function auditVanillaAtlasWarpGraph\(/);
 assert.doesNotMatch(offline,/import \{auditVanillaAtlasWarpGraph\}/);
});
test('offline graph click handler exactly mirrors modular handler',()=>{
 const app=read('src/app.js'),offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 const start="$('map-atlas-graph').addEventListener('click'";
 const end="$('map-atlas-raw-census').addEventListener('click'";
 const extract=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));
 assert.ok(app.indexOf(start)>0&&offline.indexOf(start)>0);
 assert.equal(extract(offline),extract(app));
 assert.match(extract(app),/inputsUnchanged\(\)/);
 assert.match(extract(app),/auditVanillaAtlasWarpGraph\(model,atlas,opts\)/);
 assert.match(extract(app),/setPageForOffset\(match.offset\)/);
 assert.match(extract(app),/openDeclaredAtlasMap\(atlas.maps.find/);
});
test('atlas invalidation disables and clears graph controls',()=>{
 const app=read('src/app.js');
 const clear=app.slice(app.indexOf('function clearMapAtlas('),app.indexOf('function openDeclaredAtlasMap('));
 assert.match(clear,/\$\('map-atlas-graph'\)\.disabled=true/);
 assert.match(clear,/\$\('map-atlas-graph-list'\)\.replaceChildren\(\)/);
 assert.match(app,/\$\('map-atlas-graph'\)\.disabled=false/);
});
