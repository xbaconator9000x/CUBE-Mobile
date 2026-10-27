import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('mobile script pointer roles show provenance and revalidate before navigation',()=>{
 const app=read('src/app.js');
 assert.match(app,/auditVanillaScriptOperandPointers\(model,auditOptions\)/);
 assert.match(app,/Review vanilla script operand pointer roles/);
 assert.match(app,/pointerSourceOffset===finding\.pointerSourceOffset/);
 assert.match(app,/rawPointer===finding\.rawPointer/);
 assert.match(app,/item\.role===finding\.role&&item\.status===finding\.status/);
 assert.match(app,/previewVanillaEventScriptBytes\(model/);
 assert.match(app,/Script operand bytes changed; reinspect/);
 assert.match(app,/setPageForOffset\(offset\);gotoTab\('hex'\)/);
 assert.match(app,/Roles are unverified command hints/);
});

test('offline build includes role audit and parseable mobile script',()=>{
 const build=read('build-standalone.mjs');
 assert.match(build,/vanillaScriptOperands=read\('src\/vanilla-script-operand-pointers\.js'\)/);
 assert.match(build,/stripVanillaScriptOperands/);
 const offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(offline,/function auditVanillaScriptOperandPointers\(/);
 assert.match(offline,/Review vanilla script operand pointer roles/);
 assert.match(offline,/No CUBE grammar, traversal or writes/);
 const inline=offline.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(inline);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+inline[1]));
 assert.doesNotMatch(inline[1],/^import \{/m);
 assert.doesNotMatch(inline[1],/^export /m);
});
