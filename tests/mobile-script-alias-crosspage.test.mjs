import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('mobile cross-page alias inspector preserves bounds and revalidates provenance',()=>{
 const app=read('src/app.js');
 assert.match(app,/auditVanillaScriptAliasesAcrossPages\(model,atlas,opts\)/);
 assert.match(app,/maxMaps:64/);
 assert.match(app,/maxPointerFields:4096,maxGroups:32,maxReferences:8/);
 assert.match(app,/atlasScriptCrossPageStart=result\.nextStartMap\?\?0/);
 assert.match(app,/Cross-page script aliases changed; rescan before navigation/);
 assert.match(app,/Atlas inputs changed; reinspect before navigation/);
 assert.match(app,/setPageForOffset\(offset\);gotoTab\('hex'\)/);
 assert.match(app,/Aliases outside this scan window are unknown/);
 assert.match(app,/map-script-crosspage-audit'\)\.disabled=true/);
 assert.match(app,/map-script-crosspage-audit'\)\.disabled=false/);
});

test('standalone includes exact cross-page inspector and mobile controls',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 const index=read('index.html');
 for(const id of ['map-script-crosspage-audit','map-script-crosspage-status',
  'map-script-crosspage-list']){
  assert.match(index,new RegExp('id="'+id+'"'));
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/function auditVanillaScriptAliasesAcrossPages\(/);
 assert.match(html,/crossesSixteenMapPage/);
 const inline=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(inline);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+inline[1]));
 assert.doesNotMatch(inline[1],/^import \{/m);
 const build=read('build-standalone.mjs');
 assert.match(build,/vanillaScriptCrossPage=read\('src\/vanilla-script-alias-crosspage\.js'\)/);
 assert.match(build,/stripVanillaScriptCrossPage/);
});
