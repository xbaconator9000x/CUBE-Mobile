import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('modular and offline map review expose impact audit and bounded findings',()=>{
 for(const p of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(p);
  for(const id of ['map-review-impact','map-review-impact-status','map-review-impact-list'])
   assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/Audit shared map impact/);
 }
 const app=read('src/app.js');
 assert.match(app,/import \{auditVanillaChangeImpact\} from '\.\/map-change-impact\.js'/);
 assert.match(app,/auditVanillaChangeImpact\(model,atlas,mapReviewQueue/);
 assert.match(app,/map-review-impact'\)\.addEventListener/);
 assert.match(app,/map-review-impact'\)\.disabled=true/);
 assert.match(app,/mapReviewRom!==model/);
 assert.match(app,/Atlas inputs changed; inspect again before auditing/);
 assert.match(app,/setPageForOffset\(entry.offset\);gotoTab\('hex'\)/);
 assert.doesNotMatch(app,/transactionCommitted=true/);
});
test('offline impact implementation is bundled without imports or write authority',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function auditVanillaChangeImpact\(/);
 assert.match(html,/structuralConflict:conflictCount>0/);
 assert.match(html,/ownershipAuthenticated:false/);
 assert.match(html,/writeAuthorized:false,transactionCommitted:false/);
 const script=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script,'offline classic script exists');
 assert.doesNotMatch(script[1],/^import \{/m);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
});
