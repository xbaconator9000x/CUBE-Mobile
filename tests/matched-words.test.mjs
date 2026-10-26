import test from 'node:test';
import assert from 'node:assert/strict';
import {
 parseHmaMatchedWords,collectHmaMatchedWords,resolveHmaMatchedWordCounts,
 resolveHmaTableLayouts,previewHmaFixedTable,inspectHmaPointerReferences,parseHmaLists
} from '../src/semantic.js';

const anchor=(name,address,format)=>({name,address,format,valid:true});
const put=(bytes,address,value,width=4)=>{for(let i=0;i<width;i++)bytes[address+i]=Math.floor(value/2**(8*i))&255;};
const word=(name,address,length=4,offset=0,multOffset=1)=>({name,address,length,offset,multOffset,valid:true});
const toml=(name,address,extras='')=>"[[MatchedWords]]\nName = '''"+name+"'''\nAddress = 0x"+address.toString(16)+"\n"+extras;

test('parse CUBHMA MatchedWords with defaults, offsets, multiplier and notes',()=>{
 const records=parseHmaMatchedWords(toml('COUNT',0x20)+toml('COUNT',0x24,
  "Length = 2\nOffset = -2\nMultOffset = 3\nNote = '''Trainer's party count'''\n"));
 assert.equal(records.length,2);
 assert.deepEqual([records[0].length,records[0].offset,records[0].multOffset],[4,0,1]);
 assert.deepEqual([records[1].address,records[1].length,records[1].offset,records[1].multOffset],
  [0x24,2,-2,3]);
 assert.equal(records[1].note,"Trainer's party count");
});
test('signed two-complement offset hex is supported, not a 4 GiB positive displacement',()=>{
 const [w]=parseHmaMatchedWords(toml('COUNT',16,'Offset = 0xFFFFFFFF\n'));
 assert.equal(w.offset,-1);
});
test('ROM bounds are marked invalid without reading beyond the ROM',()=>{
 const [w]=parseHmaMatchedWords(toml('COUNT',63,'Length = 4\n'),{romSize:64});
 assert.equal(w.valid,false);
 const b=new Uint8Array(64);
 const r=resolveHmaMatchedWordCounts([w],b);
 assert.equal(r.unresolved.get('COUNT'),'matched-word-out-of-bounds');
});
test('metadata merge preserves multiple distinct source locations of one name',()=>{
 const merged=collectHmaMatchedWords([
  {name:'one',text:toml('COUNT',8)},
  {name:'two',text:toml('COUNT',12)}
 ]);
 assert.equal(merged.words.length,2);
 assert.equal(merged.conflictedNames.size,0);
 const bytes=new Uint8Array(64);put(bytes,8,3);put(bytes,12,3);
 assert.equal(resolveHmaMatchedWordCounts(merged.words,bytes).byName.get('COUNT').count,3);
});
test('identical matched word metadata is deduplicated across source files',()=>{
 const text=toml('COUNT',8,'Length = 2\n');
 const merged=collectHmaMatchedWords([{name:'a',text},{name:'b',text}]);
 assert.equal(merged.words.length,1);
});
test('same source address with conflicting word meaning rejects both names',()=>{
 const merged=collectHmaMatchedWords([
  {name:'a',text:toml('COUNT',8)},
  {name:'b',text:toml('OTHER',8)}
 ]);
 assert.deepEqual([...merged.conflictedNames].sort(),['COUNT','OTHER']);
 const bytes=new Uint8Array(64);put(bytes,8,3);
 const r=resolveHmaMatchedWordCounts(merged.words,bytes,{conflictingWords:merged.conflictedNames});
 assert.equal(r.byName.size,0);
});
test('disagreeing ROM-backed locations never silently pick the first count',()=>{
 const bytes=new Uint8Array(64);put(bytes,8,2);put(bytes,12,3);
 const words=[word('COUNT',8),word('COUNT',12)];
 const r=resolveHmaMatchedWordCounts(words,bytes);
 assert.equal(r.unresolved.get('COUNT'),'disagreeing-matched-word-values');
 const tables=resolveHmaTableLayouts([anchor('child',32,'[x.]COUNT')],{romSize:64,rom:bytes,matchedWords:words});
 assert.equal(tables.unresolved.get('child'),'disagreeing-matched-word-values');
});
test('WordRun arithmetic and ArrayRun arithmetic must agree for nontrivial offset/multiplier',()=>{
 const bytes=new Uint8Array(64);put(bytes,8,12);
 const r=resolveHmaMatchedWordCounts([word('COUNT',8,4,2,2)],bytes);
 assert.equal(r.unresolved.get('COUNT'),'ambiguous-matched-word-arithmetic');
 assert.equal(r.byName.size,0);
});
test('non-integral decoded constant fails closed rather than rounding',()=>{
 const bytes=new Uint8Array(64);put(bytes,8,11);
 const r=resolveHmaMatchedWordCounts([word('COUNT',8,4,0,2)],bytes);
 assert.equal(r.unresolved.get('COUNT'),'ambiguous-matched-word-arithmetic');
});
test('offset with multiplier one resolves using both upstream expressions',()=>{
 const bytes=new Uint8Array(128);put(bytes,8,7);
 const words=[word('COUNT',8,4,2,1)];
 const result=resolveHmaTableLayouts([anchor('child',40,'[x.]COUNT')],{
  romSize:bytes.length,rom:bytes,matchedWords:words
 });
 assert.equal(result.byName.get('child').layout.count,5);
 assert.equal(result.byName.get('child').kind,'matched-word-count');
 assert.equal(result.matchedCount,1);
});
test('multiplier with zero offset resolves using both upstream expressions',()=>{
 const bytes=new Uint8Array(128);put(bytes,8,10);
 const result=resolveHmaTableLayouts([anchor('child',40,'[x.]COUNT')],{
  romSize:128,rom:bytes,matchedWords:[word('COUNT',8,4,0,2)]
 });
 assert.equal(result.byName.get('child').layout.count,5);
});
test('ROM-backed word length supports forward-linked dependent tables and margins',()=>{
 const bytes=new Uint8Array(256);put(bytes,9,3,1);
 const anchors=[anchor('descendant',100,'[v.]child+1'),
  anchor('child',60,'[v.]COUNT-1')];
 const result=resolveHmaTableLayouts(anchors,{romSize:256,rom:bytes,matchedWords:[word('COUNT',9,1)]});
 assert.equal(result.byName.get('child').layout.count,2);
 assert.equal(result.byName.get('descendant').layout.count,3);
 assert.equal(result.anchoredCount,1);
 assert.equal(result.matchedCount,1);
});
test('word lengths participate in table preview and typed pointer references without writes',()=>{
 const bytes=new Uint8Array(256);put(bytes,8,2,2);
 put(bytes,40,0x08000080);put(bytes,44,0x08000080);
 const before=bytes.slice(),words=[word('COUNT',8,2)];
 const anchors=[anchor('pointers',40,'[ptr<text>]COUNT')];
 const resolution=resolveHmaTableLayouts(anchors,{romSize:256,rom:bytes,matchedWords:words});
 const preview=previewHmaFixedTable(bytes,anchors[0],{tableResolution:resolution});
 const refs=inspectHmaPointerReferences(bytes,128,anchors,{matchedWords:words,maxScanBytes:64});
 assert.equal(preview.count,2);
 assert.equal(refs.matchedTables,1);
 assert.deepEqual(refs.declared.map(x=>x.source),[40,44]);
 assert.deepEqual(bytes,before);
});
test('named anchors take precedence over lists and matched words even if anchor cannot resolve',()=>{
 const bytes=new Uint8Array(128);put(bytes,8,3);
 const words=[word('COUNT',8)];
 const lists=parseHmaLists("[[List]]\nName = '''COUNT'''\n0 = [ '''A''', '''B''' ]");
 const anchors=[anchor('COUNT',12,'text'),anchor('child',40,'[x.]COUNT')];
 const r=resolveHmaTableLayouts(anchors,{romSize:128,rom:bytes,matchedWords:words,lists});
 assert.equal(r.byName.size,0);
 assert.equal(r.unresolved.get('child'),'unresolved-or-cyclic-length-anchor');
});
test('named list takes precedence over matched words when no named anchor exists',()=>{
 const bytes=new Uint8Array(128);put(bytes,8,3);
 const words=[word('COUNT',8)];
 const lists=parseHmaLists("[[List]]\nName = '''COUNT'''\n0 = [ '''A''', '''B''' ]");
 const r=resolveHmaTableLayouts([anchor('child',40,'[x.]COUNT')],{
  romSize:128,rom:bytes,matchedWords:words,lists
 });
 assert.equal(r.byName.get('child').layout.count,2);
 assert.equal(r.byName.get('child').kind,'named-list-count');
});
test('missing ROM does not permit word-derived count inference',()=>{
 const r=resolveHmaTableLayouts([anchor('child',40,'[x.]COUNT')],{
  romSize:128,matchedWords:[word('COUNT',8)]
 });
 assert.equal(r.unresolved.get('child'),'matched-word-rom-required');
});
test('word source spans must not overlap even for same decoded value',()=>{
 const bytes=new Uint8Array(64);
 const r=resolveHmaMatchedWordCounts([word('COUNT',8,4),word('COUNT',10,2)],bytes);
 assert.equal(r.unresolved.get('COUNT'),'overlapping-matched-word-sources');
});
test('out-of-ROM derived tables and zero lengths remain excluded',()=>{
 const bytes=new Uint8Array(64);put(bytes,8,4);
 const r=resolveHmaTableLayouts([anchor('end',62,'[x.]COUNT'),anchor('zero',32,'[x.]COUNT-4')],{
  romSize:64,rom:bytes,matchedWords:[word('COUNT',8)]
 });
 assert.equal(r.unresolved.get('end'),'out-of-bounds');
 assert.equal(r.unresolved.get('zero'),'invalid-adjusted-length');
});
test('malformed word metadata and duplicate TOML keys fail closed',()=>{
 for(const extra of ['Length = 3\n','Length = 8\n','MultOffset = 0\n','MultOffset = -1\n',
  'Offset = 0x100000000\n','Address = 0x10\n','Length = 2\nLength = 4\n'])
  assert.throws(()=>parseHmaMatchedWords(toml('COUNT',8,extra)),Error,extra);
 assert.throws(()=>parseHmaMatchedWords("[[MatchedWords]]\nAddress = 0x20"),/Malformed/);
 assert.throws(()=>parseHmaMatchedWords("[[MatchedWords]]\nName = '''COUNT'''"),/Malformed/);
});
test('invalid read proxy, source metadata and ROM length mismatch are rejected',()=>{
 assert.throws(()=>resolveHmaMatchedWordCounts([word('COUNT',8,3)],new Uint8Array(64)),/Malformed/);
 assert.throws(()=>collectHmaMatchedWords([{name:'',text:toml('COUNT',8)}]),/Unnamed/);
 assert.throws(()=>resolveHmaTableLayouts([],{romSize:100,rom:new Uint8Array(64),matchedWords:[word('COUNT',8)]}),/ROM length mismatch/);
});

test('MatchedWords source overlapping a table disables typed reads for that table and word-derived descendants',()=>{
 const bytes=new Uint8Array(256);put(bytes,40,2);
 put(bytes,100,0x08000080);put(bytes,104,0x08000080);
 const words=[word('COUNT',40,4)];
 const anchors=[
  anchor('sourceTable',38,'[x.]8'),
  anchor('pointers',100,'[ptr<text>]COUNT'),
  anchor('grandchild',160,'[ptr<text>]pointers')
 ];
 const resolved=resolveHmaTableLayouts(anchors,{romSize:256,rom:bytes,matchedWords:words});
 assert.equal(resolved.wordOverlapWitnesses,1);
 assert.deepEqual([...resolved.conflicted].sort(),['grandchild','pointers','sourceTable']);
 assert.throws(()=>previewHmaFixedTable(bytes,anchors[1],{tableResolution:resolved}),/Overlapping/);
 const refs=inspectHmaPointerReferences(bytes,128,anchors,{matchedWords:words,maxScanBytes:120});
 assert.equal(refs.matchedDeclared,0);
 assert.deepEqual(refs.candidates.map(x=>x.source),[100,104]);
});
test('touching WordRun and table spans are not a collision',()=>{
 const bytes=new Uint8Array(128);put(bytes,8,2,2);
 const words=[word('COUNT',8,2)];
 const anchors=[anchor('child',10,'[x.]COUNT')];
 const resolved=resolveHmaTableLayouts(anchors,{romSize:128,rom:bytes,matchedWords:words});
 assert.equal(resolved.wordOverlapWitnesses,0);
 assert.equal(resolved.conflicted.size,0);
});
