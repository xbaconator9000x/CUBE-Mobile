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
