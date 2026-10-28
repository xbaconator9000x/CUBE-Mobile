import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaDeclaredBankTableShape,inspectHmaDeclaredBankPointerTable} from '../src/hma-map-bank-declared-table.js';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {summarizeHmaMapBankSources} from '../src/hma-map-bank-report.js';

function rom(words,length=128){
 const bytes=new Uint8Array(length);
 for(let i=0;i<words.length;i++)for(let j=0;j<4;j++)
   bytes[16+i*4+j]=(words[i]>>>(8*j))&255;
 return {length,read:i=>bytes[i],bytes};
}
const toml=format=>`[[NamedAnchors]]
Name = '''data.maps.banks'''
Address = 0x10
Format = '''${format}'''
`;
test('fixed HMA map-bank count extracted only from bounded outer table DSL',()=>{
 const shape=inspectHmaDeclaredBankTableShape('[maps<[map<[layout<>]1>]?>]34');
 assert.equal(shape.declaredBankCount,34);
 assert.equal(shape.tableByteLength,136);
 for(const invalid of ['[maps<[map<>]?>]?', '[maps<[map<>]?>]0',
   '[maps<[map<>]?>]257','[other<>]34','[maps<[map<>]?>]34garbage',
   '[maps<[map<>]?>34','[maps<[map<>]?>]34]']){
   assert.equal(inspectHmaDeclaredBankTableShape(invalid),null,invalid);
 }
});
test('upstream CUBE Emerald TOML declares 34 raw pointer slots, not verified maps',async()=>{
 const source=await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8');
 const report=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text:source}],{romSize:32*1024*1024});
 const mobile=summarizeHmaMapBankSources([{name:'cube_emerald.toml',text:source}],{romSize:32*1024*1024});
 assert.equal(report.declaredBankCount,34);
 assert.equal(mobile.declaredBankCount,34);
 assert.equal(mobile.declaredTableByteLength,136);
 assert.equal(mobile.romAuthenticated,false);
});
test('bounded declared table reads immutable bytes, flags duplicates and self references',()=>{
 const model=rom([0x08000040,0x08000040,0x08000010,0x08000043,0x08000200,0xFFFFFFFF]);
 const original=model.bytes.slice();
 const summary={status:'custom-candidate',uniqueDeclarationCount:1,
  declarations:[{address:16,addressInBounds:true}],declaredBankCount:6,
  declaredTableByteLength:24};
 const result=inspectHmaDeclaredBankPointerTable(model,summary);
 assert.equal(result.declaredBankCount,6);
 assert.equal(result.inRomCount,4);
 assert.equal(result.duplicateTargetCount,1);
 assert.equal(result.insideTableCount,1);
 assert.equal(result.unalignedCount,1);
 assert.equal(result.rows[1].duplicateOf,0);
 assert.equal(result.rows[2].pointsInsideTable,true);
 assert.equal(result.rows[4].status,'out-of-rom-pointer');
 assert.equal(result.writeAuthorized,false);
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.rows[0]));
 assert.deepEqual(model.bytes,original);
});
test('fail closed on absent or conflicting metadata, truncation and malformed readers',()=>{
 const model=rom([0x08000040]);
 const valid={status:'custom-candidate',uniqueDeclarationCount:1,
  declarations:[{address:16,addressInBounds:true}],declaredBankCount:2,
  declaredTableByteLength:8};
 for(const bad of [{...valid,declaredBankCount:null},
   {...valid,declaredBankCount:257},{...valid,declaredTableByteLength:4},
   {...valid,status:'conflicting-declarations'}]){
  assert.throws(()=>inspectHmaDeclaredBankPointerTable(model,bad),RangeError);
 }
 assert.throws(()=>inspectHmaDeclaredBankPointerTable(rom([0],20),valid),RangeError);
 assert.throws(()=>inspectHmaDeclaredBankPointerTable({length:128,read:()=>256},valid),RangeError);
});
test('stale raw target changes are visible on fresh inspection',()=>{
 const model=rom([0x08000040,0x08000050]);
 const summary={status:'custom-candidate',uniqueDeclarationCount:1,
  declarations:[{address:16,addressInBounds:true}],declaredBankCount:2,
  declaredTableByteLength:8};
 const old=inspectHmaDeclaredBankPointerTable(model,summary);
 model.bytes[20]=0x60;
 const fresh=inspectHmaDeclaredBankPointerTable(model,summary);
 assert.notEqual(old.rows[1].rawWord,fresh.rows[1].rawWord);
});
