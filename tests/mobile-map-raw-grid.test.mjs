import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {buildRawBlockmapGridOverlay,buildVanillaRawMapOverlay} from '../src/map-raw-overlay.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('raw blockmap grid colour fallback matches rendered high-bit swatches',()=>{
 const preview={columns:2,rows:2,cells:[
  [{x:10,y:20,collision:7},{x:11,y:20,collision:7}],
  [{x:10,y:21,collision:0},{x:11,y:21,collision:63}]
 ]};
 const original=JSON.stringify(preview),out=buildRawBlockmapGridOverlay(preview);
 assert.deepEqual(out.legend.map(e=>[e.value,e.count]),[[7,2],[0,1],[63,1]]);
 assert.deepEqual(out.cells[0].rgb,buildVanillaRawMapOverlay({
  columns:1,rows:1,attributes:[[{x:10,y:20,collision:7}]]
 }).cells[0].rgb);
 assert.equal(out.walkabilityVerified,false);
 assert.equal(JSON.stringify(preview),original);
 assert.throws(()=>buildRawBlockmapGridOverlay({...preview,columns:13}),/bounded/);
});
test('mobile and offline grids expose opt-out colour coding without ROM edits',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-grid-raw-colors','map-grid-color-status','map-grid-legend'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 const app=read('src/app.js');
 assert.match(app,/buildRawBlockmapGridOverlay\(preview\)/);
 assert.match(app,/button\.style\.borderLeft='5px solid rgb\('/);
 assert.match(app,/map-grid-raw-colors'\)\.addEventListener\('change'/);
 assert.match(app,/NOT passability/);
 const offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(offline,/function buildRawBlockmapGridOverlay/);
 const script=offline.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script);assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
});
