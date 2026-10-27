import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile and offline HTML expose a queued visual comparison control',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  assert.match(html,/id="map-visual-compare-queue"/);
  assert.match(html,/Compare queued map-cell changes/);
 }
});
test('queued comparison uses validated current-ROM previews and no ROM writes',()=>{
 const app=read('src/app.js');
 assert.match(app,/compareVanillaBlockmapVisualChangeSet\(model,\{/);
 assert.match(app,/reviewVanillaChangeSet\(model,mapReviewQueue/);
 assert.match(app,/mapReviewRom!==model/);
 assert.match(app,/p\.headerOffset===headerAddress&&p\.family===family/);
 assert.match(app,/map-visual-compare-queue'\)\.disabled=!next\.some/);
 assert.match(app,/No ROM writes; CUBE layout and walkability remain unauthenticated/);
});
test('standalone script includes queued comparator and parses without ES imports',()=>{
 const offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 const script=offline.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script);
 assert.match(script[1],/function compareVanillaBlockmapVisualChangeSet/);
 assert.doesNotMatch(script[1],/^import \{/m);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
});
