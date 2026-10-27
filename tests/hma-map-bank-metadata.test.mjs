import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';

const format='[banks<map<[layout<[width:: height::]1> events<[warps<[x: y:]4>]1> music.]1>]1>';
function source(name,formatText=format,address='0x100'){
 return {name,text:`[[NamedAnchors]]
Name = "data.maps.banks"
Address = ${address}
Format = '''${formatText}'''`};
}

test('uses the upstream data.maps.banks anchor and preserves exact TOML provenance',()=>{
 const data=inspectHmaMapBankAnchorSources([source('cube.toml')],{romSize:0x2000});
 assert.equal(data.status,'custom-candidate');
 assert.equal(data.anchorName,'data.maps.banks');
 assert.equal(data.declarations[0].source,'cube.toml');
 assert.equal(data.declarations[0].line,1);
 assert.equal(data.declarations[0].address,0x100);
 assert.equal(data.declarations[0].addressInBounds,true);
 assert.equal(data.hierarchy.sections.warps,'[x: y:]4');
 assert.equal(data.romAuthenticated,false);
 assert.equal(data.cubeLayoutAuthenticated,false);
 assert.equal(data.writeAuthorized,false);
 assert.ok(Object.isFrozen(data)&&Object.isFrozen(data.declarations));
});
test('repeated identical overlays are retained as evidence, not silently erased',()=>{
 const data=inspectHmaMapBankAnchorSources([source('common.toml'),source('cube.toml')],{romSize:0x2000});
 assert.equal(data.status,'custom-candidate');
 assert.equal(data.declarationCount,2);
 assert.equal(data.uniqueDeclarationCount,1);
});
test('contradictory map-bank declarations fail closed regardless of source order',()=>{
 const a=source('common.toml'),b=source('cube.toml',format,'0x104');
 for(const sources of [[a,b],[b,a]]){
  const data=inspectHmaMapBankAnchorSources(sources,{romSize:0x2000});
  assert.equal(data.status,'conflicting-declarations');
  assert.equal(data.uniqueDeclarationCount,2);
  assert.equal(data.hierarchy,null);
 }
});
test('conflicting formats at the same address are not treated as compatible',()=>{
 const a=source('a.toml'),b=source('b.toml',format.replace('music.','weather.'));
 assert.equal(inspectHmaMapBankAnchorSources([a,b]).status,'conflicting-declarations');
});
test('missing anchor, out-of-ROM, truncated and unaligned addresses fail closed',()=>{
 assert.equal(inspectHmaMapBankAnchorSources([{name:'none',text:'[[NamedAnchors]]\nName="other"\nAddress=0x100\nFormat="[x.]"'}]).status,'missing');
 for(const address of ['0x101','0x1FF','0x200']){
  const data=inspectHmaMapBankAnchorSources([source('a',format,address)],{romSize:0x200});
  assert.equal(data.status,'invalid-address');
  assert.equal(data.hierarchy,null);
 }
});
test('malformed and unsupported metadata never authenticate CUBE maps',()=>{
 assert.equal(inspectHmaMapBankAnchorSources([source('a','[banks<map<[x.]1]')]).status,'malformed-format');
 assert.equal(inspectHmaMapBankAnchorSources([source('a','[foo<[x.]1>]')]).status,'unresolved-format');
 assert.equal(inspectHmaMapBankAnchorSources([source('a','[banks<map<[layout<[x.]1>]2>]')]).status,'unresolved-format');
});
test('vanilla marker is an upstream heuristic, never proof of ROM identity',()=>{
 const data=inspectHmaMapBankAnchorSources([source('a','[banks<map<[layout<[width::]1> music. cave. floorNum.]1>]')]);
 assert.equal(data.status,'vanilla-marker');
 assert.equal(data.romAuthenticated,false);
});
test('source budgets and malformed source arguments are rejected',()=>{
 assert.throws(()=>inspectHmaMapBankAnchorSources(null),RangeError);
 assert.throws(()=>inspectHmaMapBankAnchorSources([source('a'),source('a')]),TypeError);
 assert.throws(()=>inspectHmaMapBankAnchorSources([source('a')],{romSize:-1}),RangeError);
 assert.throws(()=>inspectHmaMapBankAnchorSources(Array.from({length:65},(_,i)=>source(String(i)))),RangeError);
});
