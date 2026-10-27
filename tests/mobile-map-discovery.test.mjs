import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile and offline UI expose explicit bank/count and warp controls',()=>{
 const page=read('index.html'),offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 for(const id of ['map-bank-offset','map-bank-count','map-bank-index',
   'map-bank-map-count','map-bank-map-index','map-bank-inspect',
   'map-bank-status','map-warp-inspect','map-warp-list','map-warp-status'])
   for(const html of [page,offline])assert.match(html,new RegExp('id="'+id+'"'));
});
test('mobile app imports source-grounded read-only bank and warp decoders',()=>{
 const app=read('src/app.js');
 assert.match(app,/import \{inspectVanillaMapBankEntry,inspectVanillaMapWarps\} from '\.\/map-discovery\.js'/);
 assert.match(app,/inspectVanillaMapBankEntry\(model/);
 assert.match(app,/inspectVanillaMapWarps\(model/);
 assert.match(app,/metadataLayoutKind==='expansion'/);
 assert.match(app,/metadataLayoutKind==='custom'/);
 assert.match(app,/clearWarpInspection\('ROM bytes changed/);
});
test('offline output includes both decoders, with no remaining module imports',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/function inspectVanillaMapBankEntry/);
 assert.match(html,/function inspectVanillaMapWarps/);
 assert.doesNotMatch(html,/^import \{.*?\} from '\.\//m);
 assert.doesNotMatch(html,/<script type="module" src="src\/app\.js"/);
});
