import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('vanilla map connections controls are present in mobile and offline builds',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-connection-inspect','map-connection-list','map-connection-status'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
});
test('connection inspection remains guarded against declared custom layouts',()=>{
 const app=read('src/app.js');
 assert.match(app,/inspectVanillaMapConnections\(model/);
 assert.match(app,/metadataLayoutKind==='expansion'/);
 assert.match(app,/metadataLayoutKind==='custom'/);
 assert.match(app,/clearConnectionInspection\('ROM bytes changed/);
 assert.match(app,/map-connection-inspect'\)\.click\(\)/);
});
test('offline bundle includes connection reader and no ES module import',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function inspectVanillaMapConnections/);
 assert.doesNotMatch(html,/^import \{.*?\} from '\.\//m);
});
