import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('mobile vanilla script inspector is guarded and uses source-grounded decoder',()=>{
 const app=read('src/app.js');
 assert.match(app,/inspectVanillaScriptCommandPrefix\(model/);
 assert.match(app,/previewVanillaEventScriptBytes\(model/);
 assert.match(app,/model!==original/);
 assert.match(app,/Script pointer changed; reinspect/);
 assert.match(app,/Unknown commands stop decoding/);
 assert.match(app,/No CUBE grammar authentication/);
 assert.match(app,/setPageForOffset\(command.offset\)/);
});
test('offline HTML includes the same bounded decoder and mobile control',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function inspectVanillaScriptCommandPrefix\(/);
 assert.match(html,/Inspect vanilla command prefix \(limited\)/);
 assert.match(html,/unknown-opcode/);
 assert.doesNotMatch(html,/^import \{.*?\} from '\.\//m);
 const script=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
});
test('offline bundler explicitly strips and includes the decoder module',()=>{
 const build=read('build-standalone.mjs');
 assert.match(build,/vanillaScriptPrefix=read\('src\/vanilla-script-prefix\.js'\)/);
 assert.match(build,/stripVanillaScriptPrefix/);
 assert.match(build,/map-raw-overlay\|vanilla-script-prefix/);
});
