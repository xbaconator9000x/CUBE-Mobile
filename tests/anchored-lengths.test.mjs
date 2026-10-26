import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveHmaTableLayouts,previewHmaFixedTable,inspectHmaPointerReferences} from '../src/semantic.js';

const anchor=(name,address,format)=>({name,address,format,valid:true});
const put32=(bytes,at,value)=>{for(let i=0;i<4;i++)bytes[at+i]=(value>>>(i*8))&255;};

test('forward-referenced named array count resolves without reading ROM bytes',()=>{
 const anchors=[anchor('child',40,'[ptr<text> flag.]root'),anchor('root',16,'[hp.]3')];
 const r=resolveHmaTableLayouts(anchors,{romSize:256});
 assert.equal(r.byName.get('child').layout.count,3);
 assert.equal(r.byName.get('child').layout.rowSize,5);
 assert.equal(r.byName.get('child').lengthFrom,'root');
 assert.equal(r.anchoredCount,1);
 assert.equal(r.unresolved.size,0);
 assert.equal(r.conflicted.size,0);
});

test('transitive named length dependencies resolve in stable topological order',()=>{
 const a=[anchor('c',100,'[c.]b'),anchor('b',80,'[b.]a'),anchor('a',10,'[a.]4')];
 const r=resolveHmaTableLayouts(a,{romSize:256});
 assert.deepEqual([...r.byName].map(([name])=>name),['a','b','c']);
 assert.equal(r.byName.get('c').layout.count,4);
 assert.equal(r.anchoredCount,2);
});

test('cycles and unresolved parents fail closed, never inferred as one row',()=>{
 const a=[anchor('a',10,'[x.]b'),anchor('b',20,'[x.]a'),anchor('c',30,'[x.]missing')];
 const r=resolveHmaTableLayouts(a,{romSize:128});
 assert.equal(r.byName.size,0);
 assert.equal(r.unresolved.get('a'),'unresolved-or-cyclic-length-anchor');
 assert.equal(r.unresolved.get('b'),'unresolved-or-cyclic-length-anchor');
 assert.equal(r.unresolved.get('c'),'missing-length-anchor');
});

test('bounded parent margins resolve while malformed fields and non-table parents stay unsupported',()=>{
 const a=[anchor('root',10,'[hp.]2'),anchor('margin',20,'[hp.]root-1'),
          anchor('bad',30,'[hp.|z]root'),anchor('text',40,'text'),
          anchor('fromText',50,'[hp.]text')];
 const r=resolveHmaTableLayouts(a,{romSize:128});
 assert.equal(r.byName.size,2);
 assert.equal(r.byName.get('margin').layout.count,1);
 assert.deepEqual(r.byName.get('margin').parentMargins,{beginning:-1,end:0});
 assert.equal(r.unresolved.get('bad'),'unsupported-fields');
 assert.equal(r.unresolved.get('fromText'),'unresolved-or-cyclic-length-anchor');
});

test('out-of-bounds parent prevents its dependent from being resolved',()=>{
 const a=[anchor('root',63,'[hp.]2'),anchor('child',10,'[hp.]root')];
 const r=resolveHmaTableLayouts(a,{romSize:64});
 assert.equal(r.byName.size,0);
 assert.equal(r.unresolved.get('root'),'out-of-bounds');
 assert.equal(r.unresolved.get('child'),'unresolved-or-cyclic-length-anchor');
});

test('conflicting duplicate anchor names invalidate dependent lengths',()=>{
 const a=[anchor('root',10,'[hp.]2'),anchor('root',20,'[hp.]3'),anchor('child',30,'[hp.]root')];
 const r=resolveHmaTableLayouts(a,{romSize:100});
 assert.equal(r.byName.size,0);
 assert.equal(r.unresolved.get('root'),'conflicting-duplicate-name');
 assert.equal(r.unresolved.get('child'),'unresolved-or-cyclic-length-anchor');
});

test('identical metadata aliases do not cause duplicate name rejection',()=>{
 const a=[anchor('root',10,'[hp.]2'),anchor('root',10,'[hp.]2'),anchor('child',20,'[hp.]root')];
 const r=resolveHmaTableLayouts(a,{romSize:100});
 assert.equal(r.byName.size,2);
 assert.equal(r.unresolved.size,0);
});

test('overlap sweep identifies conflicted tables with bounded witness output',()=>{
 const a=[anchor('wide',8,'[hp.]40'),anchor('inside',16,'[hp.]2'),anchor('tail',35,'[hp.]20')];
 const r=resolveHmaTableLayouts(a,{romSize:100,maxOverlaps:1});
 assert.equal(r.overlapWitnesses,2);
 assert.equal(r.overlaps.length,1);
 assert.equal(r.overlapTruncated,true);
 assert.deepEqual([...r.conflicted].sort(),['inside','tail','wide']);
});

test('touching intervals are not overlapping',()=>{
 const a=[anchor('first',8,'[hp.]2'),anchor('second',10,'[hp.]2')];
 const r=resolveHmaTableLayouts(a,{romSize:20});
 assert.equal(r.conflicted.size,0);
 assert.equal(r.overlapWitnesses,0);
});

test('anchored-count preview reads only supported rows and does not mutate ROM',()=>{
 const bytes=new Uint8Array(128);bytes.set([9,10,11],40);
 const a=[anchor('root',10,'[hp.]3'),anchor('child',40,'[level.]root')];
 const before=bytes.slice(),resolution=resolveHmaTableLayouts(a,{romSize:bytes.length});
 const table=previewHmaFixedTable(bytes,a[1],{maxRows:2,tableResolution:resolution});
 assert.equal(table.count,3);
 assert.deepEqual(table.rows.map(x=>x.cells[0].value),[9,10]);
 assert.equal(table.truncated,true);
 assert.deepEqual(bytes,before);
});

test('conflicted table preview refuses even read-only typed interpretation',()=>{
 const bytes=new Uint8Array(128);
 const a=[anchor('one',20,'[hp.]10'),anchor('two',25,'[hp.]5')];
 const r=resolveHmaTableLayouts(a,{romSize:bytes.length});
 assert.throws(()=>previewHmaFixedTable(bytes,a[0],{tableResolution:r}),/Overlapping/);
});

test('anchored-length typed pointer fields contribute to bounded references',()=>{
 const bytes=new Uint8Array(256);
 put32(bytes,40,0x08000080);put32(bytes,44,0x08000080);
 const a=[anchor('root',10,'[hp.]2'),anchor('child',40,'[ptr<text>]root')];
 const r=inspectHmaPointerReferences(bytes,128,a,{maxScanBytes:64});
 assert.deepEqual(r.declared.map(x=>[x.source,x.table,x.row]),[[40,'child',0],[44,'child',1]]);
 assert.equal(r.anchoredTables,1);
 assert.equal(r.conflictedTables,0);
});

test('conflicted typed pointer claims are never classified as typed references',()=>{
 const bytes=new Uint8Array(256);put32(bytes,20,0x08000080);
 const a=[anchor('one',20,'[ptr<text>]1'),anchor('two',22,'[ptr<text>]1')];
 const r=inspectHmaPointerReferences(bytes,128,a,{maxScanBytes:64});
 assert.equal(r.matchedDeclared,0);
 assert.equal(r.conflictedTables,2);
 assert.deepEqual(r.candidates.map(x=>x.source),[20]);
});

test('invalid ROM length and overlap reporting limits fail closed',()=>{
 const a=[anchor('x',1,'[hp.]1')];
 assert.throws(()=>resolveHmaTableLayouts(a,{romSize:-1}),/ROM length/);
 assert.throws(()=>resolveHmaTableLayouts(a,{maxOverlaps:1001}),/overlap/);
 assert.throws(()=>resolveHmaTableLayouts(new Array(50001).fill(a[0])),/metadata/);
});

test('large dependency chain resolves iteratively without recursion',()=>{
 const a=[anchor('n0',1,'[hp.]1')];
 for(let i=1;i<1200;i++)a.push(anchor('n'+i,1+i,'[hp.]n'+(i-1)));
 const r=resolveHmaTableLayouts(a,{romSize:4096,maxOverlaps:0});
 assert.equal(r.byName.size,1200);
 assert.equal(r.byName.get('n1199').layout.count,1);
 assert.equal(r.conflicted.size,0);
});
