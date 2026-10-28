import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('CUBE warp/event batch controller is connected to current map lifecycle',async()=>{
 const [app,controller,html,offline,build]=await Promise.all([
  read('src/app.js'),read('src/hma-cube-batch-mobile.js'),
  read('index.html'),read('app/CUBHMA_Mobile_Lab_Offline.html'),
  read('build-standalone.mjs')
 ]);
 assert.match(app,/bindHmaCubeBatchEditors\(/);
 assert.match(app,/cubeBatchEditors\.ready\(false\)/);
 assert.match(app,/cubeBatchEditors\.ready\(Boolean\(snapshot\)\)/);
 assert.match(app,/getContext:\(\)=>\(\{rom:model,summary:mapBankCustomSummary,snapshot:cubeWarpEvidence,/);
 for(const page of [html,offline]){
  for(const kind of ['warp','event']){
   for(const action of ['load','queue','preview','verify','clear']){
    assert.ok(page.includes('id="cube-batch-'+kind+'-'+action+'"'),kind+' '+action);
   }
   for(const field of ['x','y','elevation'])
    assert.ok(page.includes('id="cube-batch-'+kind+'-'+field+'"'),kind+' '+field);
  }
  assert.match(page,/id="cube-batch-warp-banks"/);
  assert.match(page,/id="cube-batch-event-kind"/);
 }
 assert.match(controller,/previewHmaCubeWarpBatch\(/);
 assert.match(controller,/verifyHmaCubeWarpBatchDryRun\(/);
 assert.match(controller,/previewHmaCubeEventPositionBatch\(/);
 assert.match(controller,/verifyHmaCubeEventPositionBatchDryRun\(/);
 assert.match(controller,/inspectHmaCubeMapEventWarps\(/);
 assert.match(controller,/JSON\.stringify\(fresh\)!==JSON\.stringify\(snapshot\.report\)/);
 assert.match(controller,/No ROM exported/);
 assert.match(build,/stripHmaCubeBatchMobile/);
 assert.match(offline,/const bindHmaCubeBatchEditors=\(\(\)=>/);
 assert.match(offline,/const \{previewHmaCubeWarpBatch,verifyHmaCubeWarpBatchDryRun\}=\(\(\)=>/);
 assert.match(offline,/const \{previewHmaCubeEventPositionBatch,verifyHmaCubeEventPositionBatchDryRun\}=\(\(\)=>/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
test('batch editor retains no semantic ROM write or export API',async()=>{
 const controller=await read('src/hma-cube-batch-mobile.js');
 assert.doesNotMatch(controller,/\.download\(|createObjectURL\(|\.write\(|\.save\(/);
 assert.match(controller,/Only 32 distinct warps/);
 assert.match(controller,/Only 32 distinct events/);
 assert.match(controller,/Batch source or bank counts changed/);
 assert.match(controller,/Event kind\/index changed/);
});
