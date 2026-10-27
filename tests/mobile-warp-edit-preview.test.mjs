import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('warp preview inputs and button are available in modular and offline UI',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-warp-preview','map-warp-preview-status',
   'map-warp-preview-x','map-warp-preview-y','map-warp-preview-elevation',
   'map-warp-preview-warp-id','map-warp-preview-target-map','map-warp-preview-target-bank'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
});
test('warp preview selects original bytes, fails stale selections and never applies changes',()=>{
 const app=read('src/app.js');
 assert.match(app,/selectedWarpPreview=\{rom:model,address,family,warpIndex:warp.index,expectedBytes:bytes\}/);
 assert.match(app,/previewVanillaWarpRecordChange\(model,/);
 assert.match(app,/expectedBytes:selection\.expectedBytes/);
 assert.match(app,/Preview only — NOT applied/);
 assert.match(app,/selectedWarpPreview=null/);
 const offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(offline,/function previewVanillaWarpRecordChange\(/);
 assert.match(offline,/writeAuthorized:false/);
 const script=offline.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
});
