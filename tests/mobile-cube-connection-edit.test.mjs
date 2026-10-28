import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('CUBE connection batch controls are wired in modular and offline mobile',async()=>{
 const [controller,index,offline,builder]=await Promise.all([
  read('src/hma-cube-batch-mobile.js'),read('index.html'),
  read('app/CUBHMA_Mobile_Lab_Offline.html'),read('build-standalone.mjs')
 ]);
 const ids=['cube-batch-connection-index','cube-batch-connection-banks',
  'cube-batch-connection-load','cube-batch-connection-direction',
  'cube-batch-connection-rawDisplacement','cube-batch-connection-targetBank',
  'cube-batch-connection-targetMap','cube-batch-connection-unused',
  'cube-batch-connection-queue','cube-batch-connection-preview',
  'cube-batch-connection-verify','cube-batch-connection-clear',
  'cube-batch-connection-status','cube-batch-connection-list'];
 for(const html of [index,offline])for(const id of ids)
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(controller,/previewHmaCubeConnectionBatch\(ctx\.rom,ctx\.summary/);
 assert.match(controller,/verifyHmaCubeConnectionBatchDryRun\(ctx\.rom,ctx\.summary/);
 assert.match(controller,/current\(connectionSnapshot\)/);
 assert.match(controller,/connectionQueue\.length>=32/);
 assert.match(controller,/r\.inMemoryRollbackVerified/);
 assert.match(builder,/stripHmaCubeConnectionEdit/);
 assert.match(offline,/const \{previewHmaCubeConnectionBatch,verifyHmaCubeConnectionBatchDryRun\}=\(\(\)=>/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
test('connection queue remains disabled until inspected source and explicit action',async()=>{
 const [controller,index]=await Promise.all([
  read('src/hma-cube-batch-mobile.js'),read('index.html')
 ]);
 assert.match(controller,/\$\('cube-batch-connection-load'\)\.disabled=!enabled/);
 assert.match(controller,/\$\('cube-batch-connection-queue'\)\.disabled=false/);
 assert.ok(controller.includes("$('cube-batch-connection-'+action).disabled=true"));
 assert.match(index,/id="cube-batch-connection-verify"[^>]*disabled/);
 assert.doesNotMatch(controller,/\.writeFile\(|\.saveAs\(/);
});
