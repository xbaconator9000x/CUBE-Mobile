import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('mobile/offline batch previews report raw placement diagnostics without walkability claims',async()=>{
 const [controller,offline,build]=await Promise.all([
  read('src/hma-cube-batch-mobile.js'),read('app/CUBHMA_Mobile_Lab_Offline.html'),
  read('build-standalone.mjs')
 ]);
 assert.match(controller,/auditHmaCubeRawPlacements\(ctx\.rom,ctx\.summary/);
 assert.match(controller,/raw\.nonzeroRawHighBits/);
 assert.match(controller,/raw\.sourceColocations/);
 assert.match(controller,/raw\.proposedColocations/);
 assert.match(controller,/NOT walkability/);
 assert.match(build,/stripHmaCubeRawPlacementAudit/);
 assert.match(offline,/const auditHmaCubeRawPlacements=\(\(\)=>/);
 assert.doesNotMatch(offline,/src\/app\.js/);
});
