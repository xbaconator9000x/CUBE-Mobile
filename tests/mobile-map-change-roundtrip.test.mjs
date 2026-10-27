import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile and standalone expose typed queued map preview audit',()=>{
 for(const p of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(p);
  for(const id of ['map-review-roundtrip','map-review-roundtrip-status','map-review-roundtrip-list'])
   assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/Verify typed queued preview/);
 }
 const app=read('src/app.js');
 assert.match(app,/import \{auditVanillaQueuedChangeRoundtrip\} from '\.\/map-change-roundtrip\.js'/);
 assert.match(app,/auditVanillaQueuedChangeRoundtrip\(model,atlas,mapReviewQueue/);
 assert.match(app,/map-review-roundtrip'\)\.addEventListener/);
 assert.match(app,/map-review-roundtrip'\)\.disabled=true/);
 assert.match(app,/Atlas inputs changed; inspect again before roundtrip audit/);
 assert.match(app,/setPageForOffset\(entry.offset\);gotoTab\('hex'\)/);
});
test('offline roundtrip module is bundled and syntactically valid',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function auditVanillaQueuedChangeRoundtrip\(/);
 assert.match(html,/typedRoundtripPassed:true/);
 assert.match(html,/transactionCommitted:false,runtimeBehaviorVerified:false/);
 const script=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script);
 assert.doesNotMatch(script[1],/^import \{/m);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
});
