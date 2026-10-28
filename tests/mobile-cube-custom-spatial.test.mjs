import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('CUBE spatial grid, touch panning and complete event inspector are bundled offline',async()=>{
 const [html,app,offline,build]=await Promise.all([
  read('index.html'),read('src/app.js'),
  read('app/CUBHMA_Mobile_Lab_Offline.html'),read('build-standalone.mjs')]);
 const ids=['cube-map-x','cube-map-y','cube-map-page','cube-map-left','cube-map-right',
  'cube-map-up','cube-map-down','cube-map-connections','cube-connections-status','cube-connections-list'];
 for(const page of [html,offline])for(const id of ids)
  assert.match(page,new RegExp('id="'+id+'"'));
 assert.match(app,/inspectBlockMap\(model,\{address:l\.blockmapOffset,width:l\.width,height:l\.height,/);
 assert.match(app,/x:originX,y:originY/);
 assert.match(app,/markerAt\(cell\.x,cell\.y\)/);
 assert.match(app,/Object\.entries\(fresh\.arrays\)/);
 assert.match(app,/scriptPointerSource/);
 assert.match(app,/JSON\.stringify\(now\)!==JSON\.stringify\(snapshot\.report\)/);
 assert.match(app,/inspectHmaCubeMapConnections\(model,mapBankCustomSummary,options\)/);
 assert.match(build,/stripHmaCubeMapConnections/);
 assert.match(offline,/const inspectHmaCubeMapConnections=\(\(\)=>\{/);
 assert.match(offline,/function drawCubeConnectionEvidence\(\)/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
