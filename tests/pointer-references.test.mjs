import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectHmaPointerReferences} from '../src/semantic.js';

function put32(b,at,value){for(let i=0;i<4;i++)b[at+i]=(value>>>(8*i))&255;}
test('read-only typed table identifies exact source field and row',()=>{
 const rom=new Uint8Array(256);put32(rom,40,0x08000080);put32(rom,46,0x08000080);
 const anchor={name:'data.pokemon.test',address:40,format:'[target<text> flag: ]2'};
 // The format has spaces by field, and a six-byte row.
 const before=rom.slice();
 const result=inspectHmaPointerReferences(rom,128,[anchor],{maxScanBytes:64});
 assert.deepEqual(result.declared.map(x=>[x.source,x.row,x.field]),[[40,0,'target'],[46,1,'target']]);
 assert.equal(result.matchedDeclared,2);
 assert.deepEqual(rom,before);
});
test('raw aligned references are explicitly unverified and de-duplicated',()=>{
 const b=new Uint8Array(256);
 put32(b,40,0x08000080);put32(b,60,0x08000080);
 const result=inspectHmaPointerReferences(b,128,[{name:'table',address:40,format:'[ptr<text>]1'}],{maxScanBytes:64});
 assert.deepEqual(result.declared.map(x=>x.source),[40]);
 assert.deepEqual(result.candidates.map(x=>x.source),[60]);
 assert.equal(result.candidates[0].kind,'raw-candidate');
 assert.match(result.disclaimer,/Neither proves ownership/);
});
test('non-4-byte aligned byte matches do not become pretend authoritative references',()=>{
 const b=new Uint8Array(256);put32(b,51,0x08000080);
 const r=inspectHmaPointerReferences(b,128,[],{maxScanBytes:100});
 assert.equal(r.declared.length,0);
 assert.equal(r.candidates.length,0);
 assert.equal(r.scanAlignment,4);
});
test('bounded ROM scan reports incompleteness and enforces output cap',()=>{
 const b=new Uint8Array(512);
 for(const p of [4,8,16,128,256])put32(b,p,0x08000100);
 const r=inspectHmaPointerReferences(b,256,[],{maxScanBytes:100,maxCandidates:2});
 assert.deepEqual(r.candidates.map(x=>x.source),[4,8]);
 assert.equal(r.candidateHits,3);
 assert.equal(r.candidatesTruncated,true);
 assert.equal(r.scannedBytes,100);
 assert.equal(r.rawScanComplete,false);
});
test('oversized tables are skipped rather than partially indexed or read out of ROM',()=>{
 const b=new Uint8Array(2048);put32(b,16,0x08000080);
 const a={name:'test',address:16,format:'[ptr<text>]128'};
 const r=inspectHmaPointerReferences(b,128,[a],{maxTableSlots:4,maxScanBytes:0});
 assert.equal(r.skippedTables,1);
 assert.equal(r.examinedSlots,0);
 assert.equal(r.declared.length,0);
 assert.equal(r.rawScanComplete,false);
});
test('invalid targets and scan parameters fail closed',()=>{
 const b=new Uint8Array(32);
 for(const offset of [-1,32,0x2000000,NaN])assert.throws(()=>inspectHmaPointerReferences(b,offset,[]),/Target/);
 assert.throws(()=>inspectHmaPointerReferences(b,1,[],{maxScanBytes:-1}),/limit/);
 assert.throws(()=>inspectHmaPointerReferences(b,1,[],{maxDeclared:0}),/limit/);
 assert.throws(()=>inspectHmaPointerReferences(b,1,new Array(50001).fill({})),/metadata/);
});
test('identical duplicate typed table declarations point to one physical slot once',()=>{
 const b=new Uint8Array(256);put32(b,40,0x08000080);
 const a={name:'first',address:40,format:'[ptr<text>]1'};
 const r=inspectHmaPointerReferences(b,128,[a,{...a,name:'first'}],{maxScanBytes:44});
 assert.equal(r.declared.length,1);assert.equal(r.matchedDeclared,1);
 assert.equal(r.examinedSlots,2);
});
test('ROM model read method is supported without cloning the binary',()=>{
 const b=new Uint8Array(256);put32(b,40,0x08000080);
 const proxy={length:b.length,read:i=>b[i]};
 const r=inspectHmaPointerReferences(proxy,128,[{name:'x',address:40,format:'[ptr<text>]1'}],{maxScanBytes:64});
 assert.equal(r.declared[0].source,40);
});

test('metadata-declared pointer slots may be unaligned while raw search remains aligned',()=>{
 const b=new Uint8Array(256);put32(b,13,0x08000080);
 const r=inspectHmaPointerReferences(b,128,[{name:'unaligned',address:13,format:'[ptr<text>]1'}],{maxScanBytes:64});
 assert.deepEqual(r.declared.map(x=>x.source),[13]);
 assert.equal(r.candidateHits,0);
});
test('dynamic or unsupported metadata is never interpreted as a typed owner',()=>{
 const b=new Uint8Array(256);put32(b,40,0x08000080);
 const r=inspectHmaPointerReferences(b,128,[{name:'dynamic',address:40,format:'[ptr<text>]data.pokemon.count'}],{maxScanBytes:64});
 assert.equal(r.matchedDeclared,0);
 assert.equal(r.unsupportedFormats,1);
 assert.deepEqual(r.candidates.map(x=>x.source),[40]);
});
test('32 MiB ROM pointer ceiling remains enforced for larger expansion ROMs',()=>{
 const fake={length:0x02000010,read:()=>0};
 assert.throws(()=>inspectHmaPointerReferences(fake,0x02000000,[],{maxScanBytes:0}),/representable/);
});
test('declared results are capped but all inspected matching slots are counted',()=>{
 const b=new Uint8Array(256);
 for(const p of [20,24,28,32])put32(b,p,0x08000080);
 const r=inspectHmaPointerReferences(b,128,[{name:'ptrs',address:20,format:'[ptr<text>]4'}],{maxDeclared:2,maxScanBytes:36});
 assert.equal(r.matchedDeclared,4);
 assert.deepEqual(r.declared.map(x=>x.source),[20,24]);
 assert.equal(r.declaredTruncated,true);
 assert.equal(r.candidateHits,0);
});
