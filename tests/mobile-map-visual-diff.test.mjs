import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile and offline map preview expose side-by-side read-only comparison',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-visual-compare','map-compare-before','map-compare-after','map-compare-status'])
   assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/Compare proposed map appearance/);
  assert.match(html,/no ROM write/i);
 }
});
test('mobile visual compare reuses reviewed preview and renders both images locally',()=>{
 const app=read('src/app.js');
 assert.match(app,/compareVanillaBlockmapVisualChange\(model,\{preview,x,y,viewportWidth:12,viewportHeight:10\}\)/);
 assert.match(app,/lastMapPreviews\.cell=result/);
 assert.match(app,/map-visual-compare'\)\.disabled=false/);
 assert.match(app,/context\.putImageData\(image,0,0\)/);
 assert.match(app,/clearRenderedMap\(/);
 assert.match(app,/No ROM bytes were modified/);
 const build=read('build-standalone.mjs');
 assert.match(build,/stripMapVisualDiff/);
 assert.match(build,/map-visual-diff/);
});
test('offline bundled visual compare is syntactically valid and has no imports',()=>{
 const offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(offline,/function compareVanillaBlockmapVisualChange/);
 const script=offline.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
 assert.doesNotMatch(script[1],/^import \{/m);
});
