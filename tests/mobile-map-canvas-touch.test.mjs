import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('canvas touch selection and read-only event markers are bundled offline',()=>{
 const app=read('src/app.js');
 for(const name of ['inspectRenderedMapPixel','projectRenderedMapMarkers','map-render-selection','map-render-jump'])
  assert.ok(app.includes(name),name);
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-render-selection','map-render-jump','map-render-canvas'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 const offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(offline,/function inspectRenderedMapPixel/);
 assert.match(offline,/function projectRenderedMapMarkers/);
});
