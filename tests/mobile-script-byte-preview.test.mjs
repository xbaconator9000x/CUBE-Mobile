import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('raw script prefix preview is accessible in modular and offline UI',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-script-preview-status','map-script-preview-list'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 const app=read('src/app.js');
 assert.match(app,/previewVanillaEventScriptBytes\(model/);
 assert.match(app,/requireVanillaMapFormat\(\)/);
 assert.match(app,/model!==original/);
 assert.match(app,/parseOffset\(\$\('map-layout-offset'\)\.value\)!==address/);
 assert.match(app,/map-script-preview-list'\)\.replaceChildren/);
 assert.match(app,/command boundaries, script length, ownership and CUBE grammar unverified/);
});
test('standalone raw script byte inspector is parseable without imports',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function previewVanillaEventScriptBytes\(/);
 const script=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
 assert.doesNotMatch(html,/^import \{.*?\} from '\.\//m);
});
