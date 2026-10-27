import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('mobile operand alias explorer uses bounded full-atlas and stale revalidation',()=>{
 const app=read('src/app.js');
 assert.match(app,/auditVanillaAtlasScriptOperandAliases\(model,atlas,opts\)/);
 assert.match(app,/maxMaps:512,maxPointerFields:8192,maxScripts:1024/);
 assert.match(app,/maxOperandFields:8192,maxGroups:24,maxReferences:8/);
 assert.match(app,/group\.sourceCount/);
 assert.match(app,/group\.mixedRoles/);
 assert.match(app,/result\.mixedRoleGroups/);
 assert.match(app,/ref\.pointerSourceOffset===reference\.pointerSourceOffset/);
 assert.match(app,/Script operand aliases changed; rescan before navigation/);
 assert.match(app,/Atlas inputs changed; reinspect before navigation/);
 assert.match(app,/map-script-operand-atlas-audit'\)\.disabled=true/);
 assert.match(app,/map-script-operand-atlas-audit'\)\.disabled=false/);
 assert.match(app,/setPageForOffset\(offset\);gotoTab\('hex'\)/);
});
test('offline UI bundles script operand scanner without module imports',()=>{
 const index=read('index.html');
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 for(const id of ['map-script-operand-atlas-audit',
  'map-script-operand-atlas-status','map-script-operand-atlas-list']){
  assert.match(index,new RegExp('id="'+id+'"'));
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/function auditVanillaAtlasScriptOperandAliases\(/);
 const inline=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(inline);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+inline[1]));
 assert.doesNotMatch(inline[1],/^import \{/m);
 const build=read('build-standalone.mjs');
 assert.match(build,/vanillaScriptOperandAtlas=read\('src\/vanilla-script-operand-alias-atlas\.js'\)/);
 assert.match(build,/stripVanillaScriptOperandAtlas/);
});
