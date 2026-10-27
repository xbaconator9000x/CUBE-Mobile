import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('mobile branch pointer review revalidates selection and pointer provenance',()=>{
 const app=read('src/app.js');
 assert.match(app,/auditVanillaScriptBranchTargets\(model/);
 assert.match(app,/Audit vanilla branch pointer hints/);
 assert.match(app,/previewVanillaEventScriptBytes\(model/);
 assert.match(app,/Script pointer changed; reinspect/);
 assert.match(app,/model!==original/);
 assert.match(app,/setPageForOffset\(finding.pointerSourceOffset\)/);
 assert.match(app,/setPageForOffset\(finding.targetOffset\)/);
 assert.match(app,/Targets outside decoded prefix are unresolved, not invalid/);
});
test('standalone includes the branch audit and parseable event UI',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function auditVanillaScriptBranchTargets\(/);
 assert.match(html,/Audit vanilla branch pointer hints/);
 assert.doesNotMatch(html,/^import \{.*?\} from '\.\//m);
 const script=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
});
test('offline generator includes dependency in correct order',()=>{
 const build=read('build-standalone.mjs');
 assert.match(build,/vanillaScriptBranches=read\('src\/vanilla-script-branches\.js'\)/);
 assert.match(build,/stripVanillaScriptPrefix\+"\\n"\+stripVanillaScriptBranches/);
 assert.match(build,/map-raw-overlay\|map-cell-census\|map-warp-graph\|vanilla-script-prefix\|vanilla-script-branches/);
});
