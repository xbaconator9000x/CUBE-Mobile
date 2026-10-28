import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('mobile CUBE map inspector has explicit counts and read-only navigation',async()=>{
 const [html,app,standalone]=await Promise.all([
   read('index.html'),read('src/app.js'),read('app/CUBHMA_Mobile_Lab_Offline.html')]);
 for(const id of ['cube-bank-index','cube-map-index','cube-map-count','cube-map-inspect',
   'cube-map-status','cube-map-details']){
   assert.match(html,new RegExp('id="'+id+'"'));
   assert.match(standalone,new RegExp('id="'+id+'"'));
 }
 assert.match(app,/inspectHmaCubeMapEntry\(model,mapBankCustomSummary,options\)/);
 assert.match(app,/cubeMapEvidence=\{options,report\}/);
 assert.match(app,/JSON\.stringify\(now\)!==JSON\.stringify\(snapshot\.report\)/);
 assert.match(app,/inspectBlockMap\(model,\{address:l\.blockmapOffset/);
 assert.match(app,/current\.raw!==cell\.raw/);
 assert.match(app,/mapBankCustomSummary=null;cubeMapEvidence=null/);
 assert.match(standalone,/function inspectHmaCubeMapEntry\(/);
 assert.match(standalone,/function drawCubeMapEvidence\(/);
 assert.doesNotMatch(standalone,/src\/app\.js/);
});
