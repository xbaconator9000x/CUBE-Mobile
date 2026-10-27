import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile navigation and Android Back routing include map inspector',()=>{
 const html=read('index.html'),app=read('src/app.js');
 assert.match(html,/data-tab="maps"/);
 assert.match(html,/id="view-maps"/);
 assert.match(html,/id="map-inspect"/);
 assert.match(app,/home\|hex\|anchors\|maps\|graphics/);
 assert.match(app,/inspectBlockMap\(model,/);
 assert.match(app,/setPageForOffset\(cell\.byteOffset\)/);
});
test('offline build includes map inspector and no source-only module import',()=>{
 const html=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(html,/id="view-maps"/);
 assert.match(html,/function inspectBlockMap\(/);
 assert.match(html,/blockmap-grid/);
 assert.doesNotMatch(html,/import \{inspectBlockMap\}/);
});
