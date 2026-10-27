import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('modular/offline UI exposes object, trigger and signpost coordinate planning',()=>{
 for(const p of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(p);
  for(const id of ['map-event-preview','map-event-preview-status',
   'map-event-preview-x','map-event-preview-y','map-event-preview-elevation'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 const app=read('src/app.js');
 assert.match(app,/previewVanillaEventCoordinateChange\(model/);
 assert.match(app,/Plan coordinate changes for/);
 assert.match(app,/selectedEventPreview=null/);
 assert.match(app,/map-event-preview'\)\.disabled=true/);
 assert.match(app,/map-event-preview'\)\.disabled=false/);
 assert.match(app,/Event selection expired; inspect and select an event again/);
 assert.match(app,/expectedBytes:selection\.expectedBytes/);
});
test('offline event record preview is parseable and grants no write authority',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function previewVanillaEventCoordinateChange\(/);
 assert.match(html,/previewOnly:true,writeAuthorized:false/);
 const script=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
 assert.doesNotMatch(script[1],/^import \{/m);
 assert.doesNotMatch(script[1],/^export /m);
});
