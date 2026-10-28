import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('CUBE cross-bank ownership inspector is available in mobile and offline UI',async()=>{
 const [app,html,offline,build]=await Promise.all([
  read('src/app.js'),read('index.html'),read('app/CUBHMA_Mobile_Lab_Offline.html'),
  read('build-standalone.mjs')]);
 for(const page of [html,offline])
  for(const id of ['cube-ownership-banks','cube-ownership-scan','cube-ownership-status','cube-ownership-list'])
   assert.ok(page.includes('id="'+id+'"'),id);
 assert.match(app,/auditHmaCubeCrossBankOwnership\(model,mapBankCustomSummary/);
 assert.match(app,/JSON\.stringify\(fresh\)!==JSON\.stringify\(snapshot\.report\)/);
 assert.match(app,/exclusive ownership and safe editing NOT proven/);
 assert.match(build,/stripHmaCubeCrossBankOwnership/);
 assert.match(offline,/const auditHmaCubeCrossBankOwnership=\(\(\)=>/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
