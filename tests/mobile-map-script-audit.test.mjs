import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('map script summary has bounded source-grounded audit and revalidated hex navigation',()=>{
 const app=read('src/app.js');
 assert.match(app,/auditVanillaMapEventScripts\(model,opts\)/);
 assert.match(app,/maxRecords:32,maxBytes:64,maxCommands:16/);
 assert.match(app,/Map\/ROM selection changed; audit scripts again/);
 assert.match(app,/Script audit pointer changed; audit again/);
 assert.match(app,/setPageForOffset\(offset\);gotoTab\('hex'\)/);
 assert.match(app,/No CUBE grammar, script ownership, execution or writes/);
 assert.match(app,/'map-script-map-audit'/);
});

test('offline map script audit is included and parses without module imports',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 const index=read('index.html');
 for(const id of ['map-script-map-audit','map-script-map-audit-status','map-script-map-audit-list']){
  assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(index,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/function auditVanillaMapEventScripts\(/);
 const inline=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(inline);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+inline[1]));
 assert.doesNotMatch(inline[1],/^import \{/m);
 const build=read('build-standalone.mjs');
 assert.match(build,/vanillaMapScriptAudit=read\('src\/vanilla-map-script-audit\.js'\)/);
 assert.match(build,/stripVanillaMapScriptAudit/);
});
