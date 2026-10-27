import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('mobile alias pages enforce declared atlas provenance and revalidate findings',()=>{
 const app=read('src/app.js');
 assert.match(app,/auditVanillaAtlasScriptAliases\(model,atlas/);
 assert.match(app,/maxMaps:16,maxGroups:32,maxReferences:8/);
 assert.match(app,/atlasScriptAliasStart=result\.nextStartMap\?\?0/);
 assert.match(app,/Reinspect the declared atlas before scanning script aliases/);
 assert.match(app,/Atlas inputs changed; reinspect before navigation/);
 assert.match(app,/Shared script target changed; rescan before navigation/);
 assert.match(app,/setPageForOffset\(offset\);gotoTab\('hex'\)/);
 assert.match(app,/Cross-page aliases are not detected/);
 assert.match(app,/map-script-alias-audit'\)\.disabled=true/);
 assert.match(app,/map-script-alias-audit'\)\.disabled=false/);
});

test('offline HTML includes touch controls, namespaced reader and parser-safe code',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 const source=read('index.html');
 for(const id of ['map-script-alias-audit','map-script-alias-status','map-script-alias-list']){
  assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(source,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/function auditVanillaAtlasScriptAliases\(/);
 assert.match(html,/function scriptAliasReader\(/);
 assert.match(html,/function scriptAliasReadPointer\(/);
 const inline=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(inline);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+inline[1]));
 assert.doesNotMatch(inline[1],/^import \{/m);
 assert.doesNotMatch(inline[1],/^export /m);
 const build=read('build-standalone.mjs');
 assert.match(build,/vanillaScriptAliases=read\('src\/vanilla-script-aliases\.js'\)/);
 assert.match(build,/stripVanillaScriptAliases/);
});
