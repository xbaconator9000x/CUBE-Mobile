import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('CUBE raw warp trace and destination map navigation exist in modular and offline UI',async()=>{
 const [app,html,offline,build]=await Promise.all([
  read('src/app.js'),read('index.html'),read('app/CUBHMA_Mobile_Lab_Offline.html'),
  read('build-standalone.mjs')]);
 for(const page of [html,offline])
  for(const id of ['cube-warp-trace-index','cube-target-map-count','cube-warp-trace',
   'cube-warp-trace-open','cube-warp-trace-status'])
   assert.ok(page.includes('id="'+id+'"'),id);
 assert.match(app,/traceHmaCubeWarpArrival\(model,mapBankCustomSummary/);
 assert.match(app,/JSON\.stringify\(now\)!==JSON\.stringify\(snapshot\.report\)/);
 assert.match(app,/cube-warp-trace-open/);
 assert.match(app,/Gameplay travel and walkability NOT verified/);
 assert.match(build,/stripHmaCubeWarpArrival/);
 assert.match(offline,/const traceHmaCubeWarpArrival=\(\(\)=>/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
