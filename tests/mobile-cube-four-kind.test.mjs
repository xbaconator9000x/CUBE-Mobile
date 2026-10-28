import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('touch and offline four-kind combined editor includes raw connections in verification and ownership',async()=>{
 const [mobile,combined,ownership,offline]=await Promise.all([
  read('src/hma-cube-batch-mobile.js'),
  read('src/hma-cube-combined-transaction.js'),
  read('src/hma-cube-edit-ownership-impact.js'),
  read('app/CUBHMA_Mobile_Lab_Offline.html')
 ]);
 assert.match(mobile,/connections:connectionQueue/);
 assert.match(mobile,/r\.connectionChanges/);
 assert.match(mobile,/connectionSnapshot!==ctx\.snapshot/);
 assert.match(mobile,/JSON\.stringify\(warpBanks\)!==JSON\.stringify\(connectionBanks\)/);
 assert.match(mobile,/warpQueue\.length\|\|eventQueue\.length\|\|connectionQueue\.length/);
 assert.match(combined,/previewHmaCubeConnectionBatch\(rom,summary/);
 assert.match(combined,/inspectHmaCubeMapConnections\(staged,summary/);
 assert.match(ownership,/previewHmaCubeConnectionBatch\(source,summary/);
 assert.match(ownership,/'connection-records'/);
 assert.match(offline,/cube-batch-combined-verify/);
 assert.match(offline,/cube-batch-connection-queue/);
 assert.doesNotMatch(mobile,/\.saveAs\(|\.writeFile\(/);
});
