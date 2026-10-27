import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile warp trace is reachable from existing vanilla warp list',()=>{
 const app=read('src/app.js');
 assert.match(app,/traceVanillaWarpArrival\(model,atlas,/);
 assert.match(app,/Trace recorded arrival for warp/);
 assert.match(app,/sources\.length!==1/);
 assert.match(app,/openDeclaredAtlasMap\(entry\)/);
 assert.match(app,/destination\.x-6,dy:destination\.y-5/);
 assert.match(app,/NOT verified runtime teleport behavior/);
});
test('standalone warp tracing is bundled without module imports or ROM write permissions',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function traceVanillaWarpArrival\(/);
 assert.match(html,/runtimeBehaviorVerified:false/);
 assert.match(html,/Trace recorded arrival for warp/);
 const script=html.match(/<script>\n'use strict';\n([\s\S]*?)\n<\/script>/);
 assert.ok(script);
 assert.doesNotThrow(()=>new Script("'use strict';\n"+script[1]));
 assert.doesNotMatch(script[1],/^import \{/m);
});
