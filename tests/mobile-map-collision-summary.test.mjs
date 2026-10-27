import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('raw collision scan and pagination controls exist in modular and standalone views',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-summary-start','map-summary-scan','map-summary-next',
   'map-summary-status','map-summary-list'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
});
test('mobile summary refuses mismatching vanilla header and never claims passability',()=>{
 const app=read('src/app.js');
 assert.match(app,/summarizeBlockmapChunk\(model/);
 assert.match(app,/requireVanillaMapFormat\(\)/);
 assert.match(app,/header\.layout\.blockmapOffset!==address/);
 assert.match(app,/header\.layout\.width!==width/);
 assert.match(app,/header\.layout\.height!==height/);
 assert.match(app,/firstRawHighBitOffsets\[flag\]/);
 assert.match(app,/map-summary-next'\)\.dataset\.nextCell/);
 assert.match(app,/clearRenderedMap[\s\S]*?clearRawBlockmapSummary/);
 assert.match(app,/NOT verified walkability or CUBE collision rules/);
});
test('standalone contains summary engine and parses without module imports',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function summarizeBlockmapChunk/);
 const match=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(match);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+match[1]));
 assert.doesNotMatch(html,/^import \{.*?\} from '\.\//m);
});
