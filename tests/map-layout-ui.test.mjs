import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile and offline app both expose explicit vanilla map controls',()=>{
 const html=read('index.html'),offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 for(const id of ['map-layout-offset','map-layout-family','map-layout-source','map-layout-inspect','map-layout-status']){
  assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(offline,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/not CUBE expansion layouts/i);
 assert.match(offline,/function inspectVanillaMapHeader/);
 assert.match(offline,/function inspectVanillaMapLayout/);
});
test('mobile and offline keep vanilla map inspection read-only and explicitly unverified',()=>{
 const app=read('src/app.js'),offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 for(const s of [app,offline]){
  assert.match(s,/metadataLayoutKind==='expansion'/);
  assert.match(s,/NOT CUBE-authenticated/);
  assert.match(s,/inspectVanillaMapHeader\(model/);
 }
});
