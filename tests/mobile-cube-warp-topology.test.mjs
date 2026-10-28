import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('CUBE warp topology audit is available in modular and offline mobile UIs',async()=>{
 const [html,app,offline,build]=await Promise.all([
  read('index.html'),read('src/app.js'),
  read('app/CUBHMA_Mobile_Lab_Offline.html'),read('build-standalone.mjs')
 ]);
 for(const page of [html,offline]){
  for(const id of ['cube-warp-audit','cube-warp-audit-banks',
   'cube-warp-audit-status','cube-warp-audit-list'])
   assert.ok(page.includes('id="'+id+'"'),id);
 }
 for(const source of [app,offline]){
  assert.match(source,/auditHmaCubeWarpTopology\(model,mapBankCustomSummary/);
  assert.match(source,/clearCubeWarpAudit\(\)/);
  assert.match(source,/cubeWarpAuditEvidence!==evidence/);
  assert.match(source,/now\.records\[record\.index\]\.offset/);
  assert.match(source,/Missing destination declarations remain unresolved/);
 }
 assert.match(build,/stripHmaCubeWarpArrival/);
 assert.match(offline,/const \{traceHmaCubeWarpArrival,auditHmaCubeWarpTopology\}=\(\(\)=>/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
