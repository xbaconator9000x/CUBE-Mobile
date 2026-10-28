import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('CUBE connection destination trace works from touch controls and offline bundle',async()=>{
 const [app,html,offline,build]=await Promise.all([
  read('src/app.js'),read('index.html'),read('app/CUBHMA_Mobile_Lab_Offline.html'),
  read('build-standalone.mjs')]);
 for(const page of [html,offline])
  for(const id of ['cube-connection-trace-index','cube-connection-target-count',
    'cube-connection-trace','cube-connection-trace-open','cube-connection-trace-status'])
   assert.ok(page.includes('id="'+id+'"'),id);
 assert.match(app,/traceHmaCubeConnectionDestination\(model,mapBankCustomSummary/);
 assert.match(app,/JSON\.stringify\(now\)!==JSON\.stringify\(snapshot\.report\)/);
 assert.match(app,/connection alignment and walkability NOT verified/);
 assert.match(app,/clearCubeConnectionTrace\(\)/);
 assert.match(build,/stripHmaCubeConnectionTrace/);
 assert.match(offline,/const traceHmaCubeConnectionDestination=\(\(\)=>/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
