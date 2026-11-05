import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('ROM import reports local read-only progress, cancellation, and errors',()=>{
 const app=read('src/app.js');
 const start=app.indexOf("$('rom-picker').addEventListener('change',async e=>");
 const end=app.indexOf("$('rom-fingerprint').addEventListener",start);
 assert.ok(start>=0&&end>start,'ROM import handler exists');
 const handler=app.slice(start,end);
 assert.match(handler,/romImportInFlight=true/);
 assert.match(handler,/setRomImportStatus\(`Checking \$\{file\.name\} locally…`,'loading'\)/);
 assert.match(handler,/Reading \$\{file\.name\} into local memory/);
 assert.match(handler,/buffer\.byteLength!==file\.size/);
 assert.match(handler,/Open cancelled\. The current ROM and staged changes are unchanged/);
 assert.match(handler,/Review the current session before continuing/);
 assert.match(handler,/finally\{\s*romImportInFlight=false/);
 assert.match(app,/Browsing is read-only unless raw editing is explicitly unlocked/);
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  assert.match(html,/<output id="rom-import-status" class="import-status" role="status" aria-live="polite">/);
  assert.match(html,/Browsing starts read-only; ROM layout and metadata are not authenticated/);
 }
});
