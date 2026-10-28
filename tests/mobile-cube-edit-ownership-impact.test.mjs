import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('ownership impact audit is reachable from mobile and standalone combined editor',async()=>{
 const [controller,index,offline,builder]=await Promise.all([
  read('src/hma-cube-batch-mobile.js'),read('index.html'),
  read('app/CUBHMA_Mobile_Lab_Offline.html'),read('build-standalone.mjs')
 ]);
 for(const html of [index,offline])for(const id of [
  'cube-batch-ownership-banks','cube-batch-combined-ownership',
  'cube-batch-ownership-status'
 ])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(controller,/auditHmaCubeEditOwnershipImpact\(ctx\.rom,ctx\.summary,\{\.\.\.params,banks\}\)/);
 assert.match(controller,/combinedParams\(\)/);
 assert.match(controller,/ctx\.cellSnapshot!==ctx\.cellEvidence/);
 assert.match(controller,/r\.changedBytesTouchSharedClaims/);
 assert.match(controller,/Partial bank census only/);
 assert.match(builder,/stripHmaCubeEditOwnershipImpact/);
 assert.match(offline,/const auditHmaCubeEditOwnershipImpact=\(\(\)=>/);
 assert.match(offline,/const bindHmaCubeBatchEditors=\(\(\)=>/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
test('ownership button is disabled on reset and stale queue, without exposing save-as',async()=>{
 const [controller,index]=await Promise.all([
  read('src/hma-cube-batch-mobile.js'),read('index.html')
 ]);
 assert.match(controller,/\$\('cube-batch-combined-ownership'\)\.disabled=true/);
 assert.match(controller,/\$\('cube-batch-combined-ownership'\)\.disabled=!\(warpQueue\.length\|\|eventQueue\.length\|\|connectionQueue\.length\)/);
 assert.match(index,/id="cube-batch-combined-ownership"[^>]*disabled/);
 assert.doesNotMatch(controller,/\.saveAs\(|\.writeFile\(/);
});
