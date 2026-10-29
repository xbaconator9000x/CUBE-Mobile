import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/app.js');
const offline=read('app/CUBHMA_Mobile_Lab_Offline.html');
const html=read('index.html');
const start=app.indexOf('function filteredCubeEventRecords(');
const end=app.indexOf('function drawCubeWarpEvidence(){',start);

test('CUBE event filter only narrows read-only records, preserving source arrays',()=>{
 assert.ok(start>=0&&end>start,'filter helper exists before event render');
 const scope={};
 runInNewContext(app.slice(start,end),scope);
 const objects=[{index:0},{index:3}],warps=[{index:0},{index:1}];
 assert.equal(scope.filteredCubeEventRecords('objects',objects,'all','').length,2);
 assert.equal(scope.filteredCubeEventRecords('objects',objects,'warps','').length,0);
 assert.equal(scope.filteredCubeEventRecords('warps',warps,'warps','1')[0].index,1);
 assert.equal(scope.filteredCubeEventRecords('objects',objects,'all','0')[0].index,0);
 for(const invalid of ['-1','1.5','1e2','0x1','999999999999999999999','01'])
   assert.equal(scope.filteredCubeEventRecords('objects',objects,'all',invalid).length,0);
 assert.equal(objects.length,2);
 assert.equal(warps.length,2);
});

test('CUBE event filter controls and live count are present in modular and offline builds',()=>{
 for(const page of [html,offline]){
  for(const id of ['cube-warps-kind-filter','cube-warps-index-filter',
    'cube-warps-filter-clear','cube-warps-filter-status'])
   assert.ok(page.includes('id="'+id+'"'),id);
  assert.match(page,/id="cube-warps-filter-status"[^>]*aria-live="polite"/);
  assert.match(page,/label for="cube-warps-index-filter"/);
  assert.match(page,/value="signposts">Signposts/);
 }
 assert.ok(offline.includes(app.slice(start,end)),'offline filter helper matches modular source');
 assert.match(app,/filteredCubeEventRecords\(kind,records,filterKind,filterIndex\)/);
 assert.match(offline,/filteredCubeEventRecords\(kind,records,filterKind,filterIndex\)/);
 assert.match(app,/indexInput\.validity\?\.badInput/);
 assert.match(app,/filterStatus\.textContent=visibleRecords/);
});

test('filtering keeps stale-ROM verification and copy-only editor focus',()=>{
 const draw=app.slice(app.indexOf('function drawCubeWarpEvidence(){'),
  app.indexOf("const cubeWarpRawFields=['x'",app.indexOf('function drawCubeWarpEvidence(){')));
 const verified=draw.indexOf('inspectHmaCubeMapEventWarps(ensureModel()');
 const filtered=draw.indexOf('filteredCubeEventRecords(kind,records,filterKind,filterIndex)');
 assert.ok(verified>=0&&filtered>verified,'source revalidated before rendering filtered actions');
 assert.match(draw,/if\(cubeWarpEvidence!==snapshot\)throw Error/);
 assert.match(draw,/\$\('cube-batch-warp-load'\)\.focus\(\)/);
 assert.match(draw,/\$\('cube-batch-event-load'\)\.focus\(\)/);
 assert.match(draw,/filterStatus\.textContent='Source expired/);
 assert.doesNotMatch(draw,/saveLocalBpsTargetAs|writeFile|semanticWritesAuthorized:true/);
});
