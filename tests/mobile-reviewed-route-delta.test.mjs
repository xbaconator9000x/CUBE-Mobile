import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('queued raw-route preview is present in modular and standalone builds',()=>{
 const html=read('index.html'),app=read('src/app.js'),
  offline=read('app/CUBHMA_Mobile_Lab_Offline.html'),
  build=read('build-standalone.mjs');
 for(const id of ['map-review-route-delta','map-review-route-delta-status',
  'map-review-route-delta-list']){
  assert.equal(html.split('id="'+id+'"').length-1,1);
  assert.equal(offline.split('id="'+id+'"').length-1,1);
  assert.ok(app.includes("$('"+id+"')"));
 }
 assert.match(app,/import \{compareVanillaReviewedRawRoute\} from '\.\/map-route-change-preview\.js'/);
 assert.match(build,/mapRouteChangePreview=read\('src\/map-route-change-preview\.js'\)/);
 assert.match(offline,/function compareVanillaReviewedRawRoute\(/);
 assert.doesNotMatch(offline,/import \{compareVanillaReviewedRawRoute\}/);
});
test('mobile queued route handler mirrors offline and rechecks stale results',()=>{
 const app=read('src/app.js'),offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 const start="$('map-review-route-delta').addEventListener('click'";
 const end="$('map-review-clear').addEventListener('click'";
 const extract=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));
 assert.ok(app.indexOf(start)>0&&offline.indexOf(start)>0);
 assert.equal(extract(app),extract(offline));
 assert.match(extract(app),/compareVanillaReviewedRawRoute\(model,atlas,queueSnapshot,opts\)/);
 assert.match(extract(app),/queueSnapshot\.every/);
 assert.match(extract(app),/freshResult\(\)/);
 assert.match(extract(app),/setPageForOffset\(step.sourceOffset\)/);
 assert.match(extract(app),/NO ROM write/);
});
test('queue and atlas invalidation clear route preview and disable controls',()=>{
 const app=read('src/app.js');
 const clear=app.slice(app.indexOf('function clearMapChangeReview('),
  app.indexOf('function removeQueuedMapPreview('));
 assert.match(clear,/map-review-route-delta/);
 const atlas=app.slice(app.indexOf('function clearMapAtlas('),
  app.indexOf('function openDeclaredAtlasMap('));
 assert.match(atlas,/\$\('map-review-route-delta'\)\.disabled=true/);
 assert.match(app,/mapReviewQueue\.some\(p=>!Number\.isSafeInteger\(p\.warpIndex\)\)/);
});
