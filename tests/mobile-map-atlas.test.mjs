import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('modular and offline apps expose declared atlas browsing and navigation',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-atlas-counts','map-atlas-inspect','map-atlas-status','map-atlas-select','map-atlas-open'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 const app=read('src/app.js');
 assert.match(app,/inspectVanillaMapAtlas\(model/);
 assert.match(app,/openDeclaredAtlasMap\(target\)/);
 assert.match(app,/clearMapAtlas\(message/);
 assert.match(app,/requireVanillaMapFormat\(\)/);
 const offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(offline,/function inspectVanillaMapAtlas/);
 assert.match(offline,/function lookupVanillaMapAtlasTarget/);
 assert.doesNotMatch(offline,/^import \{.*?\} from '\.\//m);
});

test('bounded bank-table candidate probe appears in modular and offline map UI',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-atlas-probe','map-atlas-probe-start','map-atlas-probe-bytes','map-atlas-probe-status','map-atlas-probe-list'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(read('src/app.js'),/probeVanillaMapBankTables\(model/);
 assert.match(read('app/CUBHMA_Mobile_Lab_Offline.html'),/function probeVanillaMapBankTables/);
});

test('shared map pointer alias review is wired in modular and offline UI',()=>{
 for(const path of ['index.html','app/CUBHMA_Mobile_Lab_Offline.html']){
  const html=read(path);
  for(const id of ['map-atlas-alias-audit','map-atlas-alias-status','map-atlas-alias-list'])
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 const app=read('src/app.js'),offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
 assert.match(app,/auditVanillaAtlasPointerAliases\(atlas/);
 assert.match(app,/map-atlas-alias-audit'\)\.disabled=false/);
 assert.match(app,/map-atlas-alias-audit'\)\.disabled=true/);
 assert.match(offline,/function auditVanillaAtlasPointerAliases\(/);
});
