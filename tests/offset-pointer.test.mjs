import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHmaOffsetPointers,inspectHmaPointerReferences} from '../src/semantic.js';

function put32(b,at,value){for(let i=0;i<4;i++)b[at+i]=(value>>>(8*i))&255;}
const sample=[
 '[General]',
 "MetadataLayout = '''expansion'''",
 '[[NamedAnchors]]',
 "Name = '''test'''",
 'Address = 0x80',
 "Format = '''[value:]1'''",
 '[[OffsetPointer]]',
 'Address = 0x000040',
 'Offset = 0x000004',
 '[[OffsetPointer]]',
 'Address = 0x000044',
 'Offset = -8 # legitimate signed displacement',
 '[[OffsetPointer]]',
 'Address = 0x000048',
 'Offset = 0xFFFFFFF8'
].join('\n');
test('parse offset pointers only, with signed decimal and 32-bit hexadecimal displacement',()=>{
 const records=parseHmaOffsetPointers(sample,{romSize:256});
 assert.deepEqual(records.map(r=>[r.address,r.offset,r.valid]),[[64,4,true],[68,-8,true],[72,-8,true]]);
 assert.equal(records[0].line>0,true);
});
test('reject malformed offset pointer entries rather than silently omit them',()=>{
 for(const fragment of ['Address = 0x10','Offset = 4','Address = nope\nOffset = 4',
 'Address = 0x10\nOffset = 0x100000000','Address = 0x10\nOffset = -2147483649']){
  assert.throws(()=>parseHmaOffsetPointers('[[OffsetPointer]]\n'+fragment),/Malformed/);
 }
});
test('offset pointer bounds include all four bytes',()=>{
 const records=parseHmaOffsetPointers('[[OffsetPointer]]\nAddress = 0xFD\nOffset = 0',{romSize:256});
 assert.equal(records[0].valid,false);
});
test('offset pointer metadata supports adjusted positive displacement and does not alter ROM',()=>{
 const b=new Uint8Array(256);put32(b,0x40,0x08000084);
 const before=b.slice();
 const offsets=parseHmaOffsetPointers(sample,{romSize:b.length});
 const result=inspectHmaPointerReferences(b,128,[],{offsetPointers:offsets,maxScanBytes:100});
 assert.deepEqual(result.declared.map(x=>[x.source,x.kind,x.offset]),[[0x40,'offset-pointer',4]]);
 assert.equal(result.examinedOffsetPointers,3);
 assert.equal(result.candidateHits,0);
 assert.deepEqual(b,before);
});
test('negative offsets decode by subtracting the negative displacement',()=>{
 const b=new Uint8Array(256);put32(b,0x44,0x08000078);
 const result=inspectHmaPointerReferences(b,128,[],{
  offsetPointers:[{address:0x44,offset:-8}],maxScanBytes:128
 });
 assert.deepEqual(result.declared.map(x=>[x.source,x.offset]),[[0x44,-8]]);
});
test('conflicting metadata for one source is rejected',()=>{
 const b=new Uint8Array(256);
 assert.throws(()=>inspectHmaPointerReferences(b,128,[],{offsetPointers:[
  {address:64,offset:4},{address:64,offset:-8}
 ]}),/Conflicting/);
});
test('duplicate identical offset sources count once',()=>{
 const b=new Uint8Array(256);put32(b,64,0x08000084);
 const r=inspectHmaPointerReferences(b,128,[],{offsetPointers:[
  {address:64,offset:4},{address:64,offset:4}
 ],maxScanBytes:128});
 assert.equal(r.examinedOffsetPointers,1);
 assert.equal(r.matchedDeclared,1);
});
test('out-of-ROM offsets and scan-budget exhaustion are reported',()=>{
 const b=new Uint8Array(256);put32(b,64,0x08000084);
 const r=inspectHmaPointerReferences(b,128,[],{
  offsetPointers:[{address:300,offset:0},{address:64,offset:4}],maxTableSlots:1,maxScanBytes:0
 });
 assert.equal(r.skippedOffsetPointers,1);
 assert.equal(r.examinedOffsetPointers,1);
});
test('non-GBA raw values cannot become typed offset pointer matches',()=>{
 const b=new Uint8Array(256);put32(b,64,0x07FFFF80);
 const r=inspectHmaPointerReferences(b,128,[],{
  offsetPointers:[{address:64,offset:-256}],maxScanBytes:0
 });
 assert.equal(r.matchedDeclared,0);
});
test('typed-table and offset pointer descriptions do not double-count one source',()=>{
 const b=new Uint8Array(256);put32(b,64,0x08000080);
 const r=inspectHmaPointerReferences(b,128,[{name:'table',address:64,format:'[ptr<text>]1'}],{
  offsetPointers:[{address:64,offset:0}],maxScanBytes:100
 });
 assert.equal(r.matchedDeclared,1);
});
