import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('cell change preview controls are present in modular and standalone UI',()=>{
 for(const p of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const s=read(p);
  for(const id of ['map-preview-cell','map-preview-x','map-preview-y',
   'map-preview-tile','map-preview-collision','map-preview-status'])
   assert.match(s,new RegExp('id="'+id+'"'));
 }
});
test('preview uses explicit vanilla map header and never grants a semantic write',()=>{
 const app=read('src/app.js');
 assert.match(app,/previewVanillaBlockmapCellChange\(model,/);
 assert.match(app,/header\.layout\.blockmapOffset!==parseOffset/);
 assert.match(app,/requireVanillaMapFormat\(\);/);
 assert.match(app,/Shared blockmap owners:/);
 assert.match(app,/NOT applied/);
 const offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(offline,/function previewVanillaBlockmapCellChange/);
 assert.match(offline,/writeAuthorized:false/);
 const script=offline.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
});
