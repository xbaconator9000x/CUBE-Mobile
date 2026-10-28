import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('mobile and offline cross-bank event claims are explicitly opt-in',async()=>{
 const [app,html,offline,source]=await Promise.all([
  read('src/app.js'),read('index.html'),read('app/CUBHMA_Mobile_Lab_Offline.html'),
  read('src/hma-cube-cross-bank-ownership.js')
 ]);
 for(const page of [html,offline])assert.match(page,/id="cube-ownership-events"/);
 assert.match(app,/includeEvents=\$\('cube-ownership-events'\)\.checked/);
 assert.match(app,/auditHmaCubeCrossBankOwnership\(model,mapBankCustomSummary,\{banks,includeEvents\}\)/);
 assert.match(app,/Event coverage setting changed/);
 assert.match(source,/eventIssues/);
 assert.match(source,/sameMapRelationships/);
 assert.match(source,/completeOwnershipProven:false/);
 assert.match(offline,/eventClaimsInspected/);
});
