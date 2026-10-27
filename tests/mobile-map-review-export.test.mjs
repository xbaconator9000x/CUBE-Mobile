import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile review JSON export is guarded by live queue and stale original validation',()=>{
 const app=read('src/app.js'),html=read('index.html');
 assert.match(html,/id="map-review-export"/);
 assert.match(app,/exportVanillaChangeReviewJson\(model,mapReviewQueue\)/);
 assert.match(app,/mapReviewRom!==model/);
 assert.match(app,/map-review-export'\)\.disabled=false/);
 assert.match(app,/map-review-impact','map-review-export'\]\)\$\(id\)\.disabled=true/);
 assert.match(app,/downloadFile\(safeName\(model\.name\)\+'_map-review\.json',json,'application\/json'\)/);
 assert.match(app,/No raw ROM byte arrays, executable patch/);
});
test('offline review JSON export parses and has no semantic write grant',()=>{
 const offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(offline,/function exportVanillaChangeReviewJson\(/);
 assert.match(offline,/id="map-review-export"/);
 assert.match(offline,/applicablePatch:false/);
 const script=offline.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
 assert.doesNotMatch(script[1],/^import \{/m);
});
