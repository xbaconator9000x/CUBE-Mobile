import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile and offline controls expose read-only blockset preview',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-blockset-inspect','map-blockset-status','map-blockset-list'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
});
test('tileset navigation remains gated to explicitly selected vanilla headers',()=>{
 const app=read('src/app.js');
 assert.match(app,/inspectVanillaMapBlocksets\(model/);
 assert.match(app,/requireVanillaMapFormat\(\)/);
 assert.match(app,/metadataLayoutKind==='expansion'/);
 assert.match(app,/metadataLayoutKind==='custom'/);
 assert.match(app,/clearBlocksetInspection\('Map or ROM changed/);
 assert.match(app,/graphics-offset'\)\.value=hex\(set\.tilesetOffset\)/);
 assert.match(app,/palette-offset'\)\.value=hex\(set\.paletteOffset\)/);
});
test('standalone includes blockset reader and no module imports',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function inspectVanillaMapBlocksets/);
 assert.doesNotMatch(html,/^import \{.*?\} from '\.\//m);
});
