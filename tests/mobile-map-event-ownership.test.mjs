import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('modular and offline map views expose read-only event ownership review',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-event-ownership-audit','map-event-ownership-status',
   'map-event-ownership-list'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 const app=read('src/app.js');
 assert.match(app,/auditVanillaAtlasEventOwnership\(model,atlas/);
 assert.match(app,/map-event-ownership-audit'\)\.disabled=true/);
 assert.match(app,/map-event-ownership-audit'\)\.disabled=false/);
 assert.match(app,/Atlas inputs changed; reinspect before event ownership review/);
 assert.match(app,/Event ownership findings changed; review again/);
 assert.match(app,/setPageForOffset\(sourceOffset\);gotoTab\('hex'\)/);
});
test('standalone event ownership scanner is bundled, parseable and cannot write ROM bytes',()=>{
 const offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(offline,/function auditVanillaAtlasEventOwnership\(/);
 assert.match(offline,/ownershipAuthenticated:false/);
 assert.match(offline,/writeAuthorized:false/);
 const inline=offline.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(inline);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+inline[1]));
 assert.doesNotMatch(inline[1],/^import \{/m);
 assert.doesNotMatch(inline[1],/^export /m);
});
