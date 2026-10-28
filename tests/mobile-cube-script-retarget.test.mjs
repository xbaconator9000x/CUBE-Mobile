import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('script retargeting is wired into touch and offline combined transaction',async()=>{
 const [mobile,html,offline,combined,ownership]=await Promise.all([
  read('src/hma-cube-batch-mobile.js'),read('index.html'),
  read('app/CUBHMA_Mobile_Lab_Offline.html'),
  read('src/hma-cube-combined-transaction.js'),
  read('src/hma-cube-edit-ownership-impact.js')
 ]);
 for(const page of [html,offline])for(const id of [
  'script-kind','script-index','script-load','script-expected',
  'script-target-kind','script-target-index','script-queue',
  'script-preview','script-verify','script-clear','script-list','script-status'
 ])assert.ok(page.includes('id="cube-batch-'+id+'"'),id);
 for(const s of ['previewHmaCubeScriptRetargetBatch','verifyHmaCubeScriptRetargetDryRun',
  'scripts:scriptQueue','scriptSnapshot!==ctx.snapshot','r.scriptChanges'])
  assert.ok(mobile.includes(s),s);
 assert.match(combined,/scriptPlan\.rawBytes/);
 assert.match(ownership,/'script-reference'/);
 assert.match(mobile,/Hidden-item signpost is not a script pointer/);
 assert.doesNotMatch(mobile,/createObjectURL\(|\.saveAs\(|\.writeFile\(/);
});
