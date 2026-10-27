import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('mobile full-atlas script alias navigation is bounded and stale-checked',()=>{
 const app=read('src/app.js');
 assert.match(app,/auditVanillaAtlasWideScriptAliases\(model,atlas,opts\)/);
 assert.match(app,/maxMaps:4096,maxPointerFields:32768,maxGroups:32,maxReferences:8/);
 assert.match(app,/result\.mapsInspected/);
 assert.match(app,/crossesSixtyFourMapWindow/);
 assert.match(app,/Atlas-wide script aliases changed; rescan before navigation/);
 assert.match(app,/Atlas inputs changed; reinspect before navigation/);
 assert.match(app,/setPageForOffset\(offset\);gotoTab\('hex'\)/);
 assert.match(app,/map-script-atlas-audit'\)\.disabled=true/);
 assert.match(app,/map-script-atlas-audit'\)\.disabled=false/);
});
test('offline build includes full-atlas scanner and controls with valid script syntax',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 const index=read('index.html');
 for(const id of ['map-script-atlas-audit','map-script-atlas-status',
  'map-script-atlas-list']){
  assert.match(index,new RegExp('id="'+id+'"'));
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/function auditVanillaAtlasWideScriptAliases\(/);
 assert.match(html,/function atlasAliasReader\(/);
 const inline=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(inline);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+inline[1]));
 assert.doesNotMatch(inline[1],/^import \{/m);
 const build=read('build-standalone.mjs');
 assert.match(build,/vanillaScriptAtlas=read\('src\/vanilla-script-alias-atlas\.js'\)/);
 assert.match(build,/stripVanillaScriptAtlas/);
});
