import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {summarizeHmaMapBankSources} from '../src/hma-map-bank-report.js';

const format='[banks<map<[layout<[width:: height::]1> events<[warps<[x: y:]4>]1> music.]1>]1>';
const source=(name,fmt=format,address='0x100')=>({name,text:`[[NamedAnchors]]
Name = "data.maps.banks"
Address = ${address}
Format = '''${fmt}'''`});

test('mobile map-bank summary exposes bounded provenance, never format text or ROM trust',()=>{
 const summary=summarizeHmaMapBankSources([source('cube.toml')],{romSize:4096});
 assert.equal(summary.status,'custom-candidate');
 assert.equal(summary.declarations[0].source,'cube.toml');
 assert.equal(summary.declarations[0].address,256);
 assert.equal(summary.declarations[0].line,1);
 assert.equal(summary.declarations[0].formatLength,format.length);
 assert.equal(summary.declarations[0].addressInBounds,true);
 assert.deepEqual(summary.sectionNames,['layout','events','warps']);
 assert.equal(summary.romAuthenticated,false);
 assert.equal(summary.cubeLayoutAuthenticated,false);
 assert.equal(summary.writeAuthorized,false);
 assert.ok(Object.isFrozen(summary)&&Object.isFrozen(summary.declarations)&&Object.isFrozen(summary.sectionNames));
 assert.ok(!JSON.stringify(summary).includes('width::'));
 assert.ok(!JSON.stringify(summary).includes('music.'));
});

test('contradictory metadata remains visible but does not select an anchor',()=>{
 const summary=summarizeHmaMapBankSources([source('a'),source('b',format,'0x104')],{romSize:4096});
 assert.equal(summary.status,'conflicting-declarations');
 assert.equal(summary.declarationCount,2);
 assert.equal(summary.uniqueDeclarationCount,2);
 assert.deepEqual(summary.sectionNames,[]);
 assert.equal(summary.writeAuthorized,false);
});

test('out-of-bounds, missing and ambiguous metadata fail closed',()=>{
 assert.equal(summarizeHmaMapBankSources([source('a',format,'0xFFF')],{romSize:4096}).status,'invalid-address');
 assert.equal(summarizeHmaMapBankSources([{name:'none',text:''}]).status,'missing');
 const repeated='[banks<map<[layout<[width::]1> layout<[height::]1> music.]1>]1>';
 const ambiguous=summarizeHmaMapBankSources([source('a',repeated)]);
 assert.equal(ambiguous.status,'ambiguous-format');
 assert.deepEqual(ambiguous.ambiguousFields,[{scope:'map',name:'layout',count:2}]);
});

test('real pinned upstream CUBE metadata is summarized without exposing DSL',async()=>{
 const text=await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8');
 const summary=summarizeHmaMapBankSources([{name:'cube_emerald.toml',text}],{romSize:32*1024*1024});
 assert.equal(summary.status,'custom-candidate');
 assert.equal(summary.declarations[0].address,0x102D520);
 assert.ok(summary.sectionNames.includes('warps'));
 assert.equal(summary.writeAuthorized,false);
 assert.ok(!JSON.stringify(summary).includes('map<'));
});

test('mobile integration and offline bundle must expose the same read-only map-bank control',async()=>{
 const [app,html,offline,build]=await Promise.all([
  readFile(new URL('../src/app.js',import.meta.url),'utf8'),
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../app/CUBHMA_Mobile_Lab_Offline.html',import.meta.url),'utf8'),
  readFile(new URL('../build-standalone.mjs',import.meta.url),'utf8')
 ]);
 for(const content of [html,offline]){
  assert.match(content,/id="map-bank-metadata-status"/);
  assert.match(content,/id="map-bank-metadata-list"/);
  assert.match(content,/id="map-bank-metadata-jump"/);
 }
 assert.match(app,/summarizeHmaMapBankSources/);
 assert.match(app,/mapBankMetadataReport=null/);
 assert.match(app,/mapBankMetadataReport=nextMapBankReport/);
 assert.match(build,/hma-map-bank-report\.js/);
 assert.match(offline,/function summarizeHmaMapBankSources/);
});
