import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile and standalone map preview queue has real review and clear handlers',()=>{
 for(const p of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(p);
  for(const id of ['map-review-cell-add','map-review-warp-add',
   'map-review-event-add','map-review-run','map-review-clear',
   'map-review-status','map-review-list'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 const app=read('src/app.js');
 assert.match(app,/reviewVanillaChangeSet\(model,next/);
 assert.match(app,/reviewVanillaChangeSet\(model,mapReviewQueue/);
 assert.match(app,/map-review-clear'\)\.addEventListener/);
 assert.match(app,/clearMapChangeReview\(\);clearMapAtlas/);
 assert.match(app,/function metadataReset\(\)\{metadataImportSerial\+\+;metadataFingerprints=\[\];clearWarpInspection/);
 assert.match(app,/clearWarpInspection\('Metadata reset; inspect warps again.'\);clearMapChangeReview\(\)/);
 assert.match(app,/map-review-cell-add'\)\.disabled=false/);
 assert.match(app,/map-review-warp-add'\)\.disabled=false/);
 assert.match(app,/map-review-event-add'\)\.disabled=false/);
});
test('offline review helper parses and never grants semantic write permissions',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function reviewVanillaChangeSet\(/);
 assert.match(html,/transactionCommitted:false/);
 assert.match(html,/writeAuthorized:false/);
 const script=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
 assert.doesNotMatch(script[1],/^import \{/m);
});

test('typed field changes are shown in modular and standalone review',()=>{
 const app=read('src/app.js');
 const offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(app,/entry\.fieldChanges\.map\(f=>/);
 assert.match(offline,/entry\.fieldChanges\.map\(f=>/);
 assert.match(offline,/function reviewFieldChanges\(/);
 assert.match(offline,/non-editable pointer, flag or reserved field/);
});
