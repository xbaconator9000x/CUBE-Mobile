import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveHmaTableLayouts,inspectHmaPointerReferences,previewHmaFixedTable} from '../src/semantic.js';

const a=(name,address,format)=>({name,address,format,valid:true});
const w=(name,address,length=4)=>({name,address,length,offset:0,multOffset:1,valid:true});
const p=(address,offset=0)=>({address,offset,valid:true});
function put32(bytes,at,value){for(let i=0;i<4;i++)bytes[at+i]=(value>>>(i*8))&255;}

test('every MatchedWords source inside one table is ambiguous, not only the first',()=>{
 const rom=new Uint8Array(512);
 put32(rom,40,1);put32(rom,48,1);
 const words=[w('ONE',40),w('TWO',48)];
 const anchors=[a('source',32,'[x.]32'),a('childOne',100,'[ptr<text>]ONE'),a('childTwo',200,'[ptr<text>]TWO')];
 const r=resolveHmaTableLayouts(anchors,{romSize:rom.length,rom,matchedWords:words});
 assert.equal(r.wordOverlapWitnesses,1);
 assert.deepEqual([...r.conflicted].sort(),['childOne','childTwo','source']);
 assert.throws(()=>previewHmaFixedTable(rom,anchors[2],{tableResolution:r}),/Overlapping/);
});
test('unresolved MatchedWords still reserve their claimed bytes',()=>{
 const rom=new Uint8Array(256);put32(rom,40,5);put32(rom,44,6);
 const anchors=[a('source',32,'[x.]24')];
 const words=[w('AMBIG',40),w('AMBIG',44)];
 const r=resolveHmaTableLayouts(anchors,{romSize:256,rom,matchedWords:words});
 assert.equal(r.wordResolution.unresolved.get('AMBIG'),'disagreeing-matched-word-values');
 assert.equal(r.conflicted.has('source'),true);
});
test('exact OffsetPointer overlay on a complete pointer field remains compatible',()=>{
 const rom=new Uint8Array(256);put32(rom,40,0x08000084);
 const anchors=[a('table',40,'[ptr<text> flag.]1')];
 const offsets=[p(40,4)];
 const r=resolveHmaTableLayouts(anchors,{romSize:rom.length,offsetPointers:offsets});
 assert.equal(r.conflicted.size,0);
 assert.equal(r.conflictedOffsetPointers.size,0);
 const refs=inspectHmaPointerReferences(rom,128,anchors,{offsetPointers:offsets,maxScanBytes:100});
 assert.deepEqual(refs.declared.map(x=>x.kind),['offset-pointer']);
});
test('OffsetPointer in a scalar field is not a typed pointer reference',()=>{
 const rom=new Uint8Array(256);put32(rom,40,0x08000080);
 const anchors=[a('scalar',40,'[value::]1')],offsets=[p(40)];
 const before=rom.slice();
 const r=resolveHmaTableLayouts(anchors,{romSize:256,offsetPointers:offsets});
 assert.equal(r.conflicted.has('scalar'),true);
 assert.equal(r.conflictedOffsetPointers.has(40),true);
 const refs=inspectHmaPointerReferences(rom,128,anchors,{offsetPointers:offsets,maxScanBytes:100});
 assert.equal(refs.matchedDeclared,0);
 assert.equal(refs.skippedConflictedOffsetPointers,1);
 assert.deepEqual(rom,before);
});
test('partial pointer field and cross-row source are conflicts',()=>{
 const rom=new Uint8Array(256);
 const anchors=[a('pointers',40,'[ptr<text>]2')];
 for(const source of [41,42,43,45]){
  const r=resolveHmaTableLayouts(anchors,{romSize:256,offsetPointers:[p(source)]});
  assert.equal(r.conflicted.has('pointers'),true,'source '+source);
  assert.equal(r.conflictedOffsetPointers.has(source),true,'source '+source);
 }
});
test('OffsetPointer straddling two adjacent tables suppresses both claims',()=>{
 const rom=new Uint8Array(256);
 const anchors=[a('first',40,'[x::]1'),a('second',44,'[y::]1')];
 const r=resolveHmaTableLayouts(anchors,{romSize:256,offsetPointers:[p(42)]});
 assert.deepEqual([...r.conflicted].sort(),['first','second']);
 assert.equal(r.conflictedOffsetPointers.has(42),true);
});
test('overlapping OffsetPointer source spans invalidate both declarations',()=>{
 const rom=new Uint8Array(256);put32(rom,40,0x08000080);
 const offsets=[p(40),p(42)];
 const r=resolveHmaTableLayouts([],{romSize:256,offsetPointers:offsets});
 assert.deepEqual([...r.conflictedOffsetPointers].sort((x,y)=>x-y),[40,42]);
 const refs=inspectHmaPointerReferences(rom,128,[],{offsetPointers:offsets,maxScanBytes:0});
 assert.equal(refs.matchedDeclared,0);
 assert.equal(refs.skippedConflictedOffsetPointers,2);
});
test('OffsetPointer and WordRun source overlap invalidates dependent table',()=>{
 const rom=new Uint8Array(256);put32(rom,8,2);put32(rom,100,0x08000080);
 const anchors=[a('child',100,'[ptr<text>]COUNT')],words=[w('COUNT',8)];
 const r=resolveHmaTableLayouts(anchors,{romSize:256,rom,matchedWords:words,offsetPointers:[p(10)]});
 assert.equal(r.conflictedOffsetPointers.has(10),true);
 assert.equal(r.conflicted.has('child'),true);
 const refs=inspectHmaPointerReferences(rom,128,anchors,{matchedWords:words,offsetPointers:[p(10)],maxScanBytes:0});
 assert.equal(refs.matchedDeclared,0);
});
test('out-of-ROM OffsetPointer is reported but does not contaminate valid table claims',()=>{
 const r=resolveHmaTableLayouts([a('table',40,'[ptr<text>]1')],{
  romSize:128,offsetPointers:[p(126)]
 });
 assert.equal(r.invalidOffsetPointers,1);
 assert.equal(r.conflicted.size,0);
 assert.equal(r.conflictedOffsetPointers.size,0);
});
test('bounded prefix-max collision lookup handles many table claims without quadratic pair scan',()=>{
 const anchors=[];
 for(let i=0;i<2000;i++)anchors.push(a('t'+i,16+i*8,'[ptr<text>]1'));
 const rom=new Uint8Array(20000);
 const r=resolveHmaTableLayouts(anchors,{romSize:rom.length,offsetPointers:[p(16+1000*8)]});
 assert.equal(r.conflicted.size,0);
 assert.equal(r.conflictedOffsetPointers.size,0);
 assert.equal(r.byName.size,2000);
});
test('contradictory offset declarations fail closed in resolver',()=>{
 assert.throws(()=>resolveHmaTableLayouts([],{romSize:128,offsetPointers:[p(20,4),p(20,-4)]}),/Conflicting offset pointer/);
});
