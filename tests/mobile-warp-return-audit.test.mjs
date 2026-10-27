import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('return-path review is wired to selected declared atlas and hex navigation',()=>{
 const app=read('src/app.js'),html=read('index.html');
 for(const id of ['map-warp-return-audit','map-warp-return-status','map-warp-return-list'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/auditVanillaWarpReturns\(model,atlas,/);
 assert.match(app,/result\.counts\.differentWarp/);
 assert.match(app,/result\.counts\.specialReturn/);
 assert.match(app,/setPageForOffset\(record\.returnTarget\.recordOffset\);gotoTab\('hex'\)/);
 assert.match(app,/Non-reciprocal links may be intentional/);
 assert.match(app,/\$\('map-warp-return-audit'\)\.disabled=true/);
 assert.match(app,/\$\('map-warp-return-audit'\)\.disabled=false/);
});
test('offline return-path reviewer is bundled and parses',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function auditVanillaWarpReturns\(/);
 assert.match(html,/id="map-warp-return-audit"/);
 const match=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(match);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+match[1]));
 assert.doesNotMatch(match[1],/^import \{/m);
});
