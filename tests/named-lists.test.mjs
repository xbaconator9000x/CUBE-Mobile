import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHmaLists,collectHmaLists,resolveHmaTableLayouts,previewHmaFixedTable,inspectHmaPointerReferences} from '../src/semantic.js';
const anchor=(name,address,format)=>({name,address,format,valid:true});
const source=(name,text)=>({name,text});
const put32=(bytes,at,value)=>{for(let i=0;i<4;i++)bytes[at+i]=(value>>>(8*i))&255;};
const listText=(name,items)=>"[[List]]\nName = '''"+name+"'''\n0 = [ "+items.map(x=>"'''"+x+"'''").join(', ')+" ]";

test('upstream-style multiline list counts entries without reading ROM data',()=>{
 const text="[[List]]\nName = '''weathertypes'''\n0 = [\n  '''None''',\n  '''SunnyClouds''', # source comment\n  '''Rain''',\n]\n[[NamedAnchors]]\nName = '''unrelated'''\nAddress = 0x20";
 const lists=parseHmaLists(text);
 assert.equal(lists.length,1);
 assert.deepEqual(lists[0].entries,['None','SunnyClouds','Rain']);
 assert.equal(lists[0].name,'weathertypes');
});
test('inline and numbered sparse list entries preserve upstream append and padding',()=>{
 const lists=parseHmaLists("[[List]]\nName = '''types'''\n0 = ['''Normal''', '''Fire''']\n4 = '''Water'''\n1 = '''Electric'''");
 assert.deepEqual(lists[0].entries,['Normal','Fire',null,null,'Water','Electric']);
});
test('list parser permits a literal closing bracket or hash inside quoted values',()=>{
 const lists=parseHmaLists("[[List]]\nName = '''special'''\n0 = [ '''a]#b''', '''b''', ] # comment");
 assert.deepEqual(lists[0].entries,['a]#b','b']);
});
test('single-entry and double-quoted TOML strings are supported',()=>{
 const lists=parseHmaLists('[[List]]\nName = "test"\n0 = "one"\n1 = [ "two", \'three\' ]');
 assert.deepEqual(lists[0].entries,['one','two','three']);
});
test('list-derived count resolves and reports provenance',()=>{
 const lists=parseHmaLists(listText('types',['A','B','C']));
 const r=resolveHmaTableLayouts([anchor('typeFlags',40,'[flag.]types')],{romSize:128,lists});
 assert.equal(r.byName.get('typeFlags').kind,'named-list-count');
 assert.equal(r.byName.get('typeFlags').layout.count,3);
 assert.equal(r.byName.get('typeFlags').lengthFrom,'types');
 assert.equal(r.listCount,1);
 assert.equal(r.anchoredCount,0);
});
test('list margins and chained anchor-dependent lengths propagate',()=>{
 const lists=parseHmaLists(listText('types',['A','B','C']));
 const a=[anchor('child',80,'[value.]parent+1'),anchor('parent',40,'[value.]types-1')];
 const r=resolveHmaTableLayouts(a,{romSize:128,lists});
 assert.equal(r.byName.get('parent').layout.count,2);
 assert.equal(r.byName.get('child').layout.count,3);
 assert.equal(r.listCount,1);
 assert.equal(r.anchoredCount,1);
});
test('conflicting named lists never silently select an arbitrary count',()=>{
 const merged=collectHmaLists([source('a.toml',listText('types',['A','B'])),source('b.toml',listText('types',['A','B','C']))]);
 assert.equal(merged.conflictedNames.has('types'),true);
 const r=resolveHmaTableLayouts([anchor('flags',40,'[flag.]types')],{romSize:128,lists:merged.lists,conflictingLists:merged.conflictedNames});
 assert.equal(r.byName.size,0);
 assert.equal(r.unresolved.get('flags'),'conflicting-list-name');
});
test('identical list declarations deduplicate safely',()=>{
 const text=listText('types',['A','B']);
 const merged=collectHmaLists([source('one',text),source('two',text)]);
 assert.equal(merged.lists.length,1);
 assert.equal(merged.conflictedNames.size,0);
});
test('named anchors take precedence over a list of the same name',()=>{
 const lists=parseHmaLists(listText('root',['A','B']));
 const r=resolveHmaTableLayouts([anchor('root',10,'text'),anchor('child',40,'[x.]root')],{romSize:128,lists});
 assert.equal(r.byName.size,0);
 assert.equal(r.unresolved.get('child'),'unresolved-or-cyclic-length-anchor');
});
test('UnmappedConstant is not a table-length source (upstream uses MatchedWords)',()=>{
 const lists=parseHmaLists("[[UnmappedConstant]]\nName = '''COUNT'''\nValue = 0x10");
 const r=resolveHmaTableLayouts([anchor('child',40,'[x.]COUNT')],{romSize:128,lists});
 assert.equal(r.byName.size,0);
 assert.equal(r.unresolved.get('child'),'missing-length-anchor');
});
test('invalid adjusted count and out-of-ROM list table fail closed',()=>{
 const lists=parseHmaLists(listText('types',['A','B']));
 const r=resolveHmaTableLayouts([anchor('zero',10,'[x.]types-2'),anchor('tooBig',127,'[x.]types')],{romSize:128,lists});
 assert.equal(r.byName.size,0);
 assert.equal(r.unresolved.get('zero'),'invalid-adjusted-length');
 assert.equal(r.unresolved.get('tooBig'),'out-of-bounds');
});
test('list-derived table pointer fields are read-only and included in typed matches',()=>{
 const bytes=new Uint8Array(256);put32(bytes,40,0x08000080);put32(bytes,44,0x08000080);
 const before=bytes.slice(),lists=parseHmaLists(listText('two',['A','B']));
 const anchors=[anchor('pointers',40,'[ptr<text>]two')];
 const resolved=resolveHmaTableLayouts(anchors,{romSize:bytes.length,lists});
 const preview=previewHmaFixedTable(bytes,anchors[0],{tableResolution:resolved});
 const refs=inspectHmaPointerReferences(bytes,128,anchors,{lists,maxScanBytes:64});
 assert.equal(preview.count,2);
 assert.equal(refs.listTables,1);
 assert.deepEqual(refs.declared.map(x=>x.source),[40,44]);
 assert.deepEqual(bytes,before);
});
test('overlapping list-derived tables are not trusted as typed pointer owners',()=>{
 const bytes=new Uint8Array(256);put32(bytes,40,0x08000080);
 const lists=parseHmaLists(listText('two',['A','B']));
 const a=[anchor('pointers',40,'[ptr<text>]two'),anchor('overlap',42,'[x.]2')];
 const r=inspectHmaPointerReferences(bytes,128,a,{lists,maxScanBytes:64});
 assert.equal(r.matchedDeclared,0);
 assert.equal(r.conflictedTables,2);
 assert.deepEqual(r.candidates.map(x=>x.source),[40]);
});
test('malformed, incomplete, excessive and unsupported list data fails closed',()=>{
 const bad=[
 "[[List]]\nName = '''a'''\n0 = [ '''a'''",
 "[[List]]\nName = '''a'''\n0 = [ '''a''', invalid ]",
 "[[List]]\nName = '''a'''\n0 = 42",
 "[[List]]\nName = '''a'''\n100001 = '''a'''",
 "[[List]]\n0 = [ '''a''' ]",
 "[[List]]\nName = '''a'''\n0 = [ '''a''' ] trailing"
 ];
 for(const text of bad)assert.throws(()=>parseHmaLists(text),Error);
 assert.throws(()=>collectHmaLists([source('',bad[0])]),/Unnamed/);
 assert.throws(()=>resolveHmaTableLayouts([],{lists:[{name:'x',entries:[]}]}),/list metadata/);
});

test('upstream default.toml scriptvariablealiases hex indexes preserve actual cardinality',()=>{
 const lists=parseHmaLists("[[List]]\nName = '''scriptvariablealiases'''\n0x4000 = [ '''temp0''', '''temp1''' ]\n0x8000 = [ '''var0''', '''var1''' ]");
 assert.equal(lists[0].entries.length,0x8002);
 assert.equal(lists[0].entries[0x4000],'temp0');
 assert.equal(lists[0].entries[0x4001],'temp1');
 assert.equal(lists[0].entries[0x8000],'var0');
 assert.equal(lists[0].entries[0x7fff],null);
 assert.throws(()=>parseHmaLists("[[List]]\nName = '''x'''\n0xZZ = '''bad'''"),/index/);
});
