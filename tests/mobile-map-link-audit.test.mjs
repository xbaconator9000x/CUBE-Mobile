import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('read-only map-link audit is reachable from modular and offline mobile views',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-atlas-audit','map-atlas-audit-status','map-atlas-audit-list'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 const app=read('src/app.js'),offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(app,/auditVanillaMapLinks\(model,atlas/);
 assert.match(app,/clearMapAtlas\(message/);
 assert.match(offline,/function auditVanillaMapLinks/);
 assert.match(offline,/outside supplied counts/);
 assert.doesNotMatch(offline,/^import \{.*?\} from '\.\//m);
});

test('batch atlas audit controls and offline bundle stay synchronized',()=>{
 const app=read('src/app.js');
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-atlas-batch-audit','map-atlas-batch-status','map-atlas-batch-list'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(app,/auditVanillaAtlasLinkBatch\(model,atlas/);
 assert.match(app,/atlasBatchStart=result.nextStart/);
 assert.match(read('app/CUBHMA_Mobile_Lab_Offline.html'),/function auditVanillaAtlasLinkBatch/);
});

test('coordinate review is available in modular and offline mobile UI',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-event-coordinate-audit','map-event-coordinate-status','map-event-coordinate-list'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 const app=read('src/app.js'),offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(app,/auditVanillaMapEventCoordinates\(model,atlas/);
 assert.match(app,/map-event-coordinate-audit'\)\.disabled=false/);
 assert.match(app,/map-event-coordinate-audit'\)\.disabled=true/);
 assert.match(offline,/function auditVanillaMapEventCoordinates\(/);
 assert.match(offline,/walkabilityVerified:false/);
 assert.doesNotMatch(offline,/^import \{.*?\} from '\.\//m);
});
