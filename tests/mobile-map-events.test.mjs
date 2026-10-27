import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('modular and offline UI expose read-only vanilla event controls',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-event-inspect','map-event-status','map-event-list'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
});
test('map event inspection is gated and invalidated with map and ROM changes',()=>{
 const app=read('src/app.js');
 assert.match(app,/inspectVanillaMapEvents\(model/);
 assert.match(app,/requireVanillaMapFormat\(\)/);
 assert.match(app,/metadataLayoutKind==='expansion'/);
 assert.match(app,/metadataLayoutKind==='custom'/);
 assert.match(app,/function clearWarpInspection[\s\S]*?clearEventInspection\(/);
 assert.match(app,/map-event-inspect'\)\.click\(\)/);
 assert.match(app,/button\.addEventListener\('click',[\s\S]*?setPageForOffset\(event\.offset\)/);
});
test('standalone contains event decoder without module imports',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function inspectVanillaMapEvents/);
 assert.doesNotMatch(html,/^import \{.*?\} from '\.\//m);
});
