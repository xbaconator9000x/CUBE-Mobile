import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHmaParentLengthToken,resolveHmaTableLayouts,collectHmaNamedAnchors,
  previewHmaFixedTable,inspectHmaPointerReferences
} from '../src/semantic.js';

const anchor=(name,address,format)=>({name,address,format,valid:true});
const toml=(name,address,format)=>[
  '[[NamedAnchors]]',"Name = '''"+name+"'''",
  'Address = 0x'+address.toString(16),"Format = '''"+format+"'''"
].join('\n');
const write32=(bytes,at,value)=>{for(let i=0;i<4;i++)bytes[at+i]=(value>>>(8*i))&255;};

test('ParentOffset parser follows upstream one-sided positive and negative semantics',()=>{
 assert.deepEqual(parseHmaParentLengthToken('root+3'),{parent:'root',beginningMargin:0,endMargin:3});
 assert.deepEqual(parseHmaParentLengthToken('root-3'),{parent:'root',beginningMargin:-3,endMargin:0});
 assert.deepEqual(parseHmaParentLengthToken('root'),{parent:'root',beginningMargin:0,endMargin:0});
});
test('two signed margins distinguish beginning from end',()=>{
 for(const [expr,beginning,end] of [
  ['root+2-1',2,-1],['root-2+1',-2,1],['root+1+2',1,2],
  ['root-1-2',-1,-2],['root+0-1',0,-1]
 ])assert.deepEqual(parseHmaParentLengthToken(expr),{parent:'root',beginningMargin:beginning,endMargin});
});
test('invalid, ambiguous and excessive margin tokens fail closed',()=>{
 for(const token of ['root++1','root+-1','root+1-2+3','root+1.5','root-',
                     'root+99999999999999','root-1000001','root+1x',''])
   assert.equal(parseHmaParentLengthToken(token),null,token);
});
test('positive and negative margins adjust row counts without shifting table start',()=>{
 const a=[anchor('parent',12,'[id.]5'),anchor('plus',40,'[ptr<text>]parent+2'),
          anchor('minus',100,'[value.]parent-2')];
 const r=resolveHmaTableLayouts(a,{romSize:256});
 assert.equal(r.byName.get('plus').layout.count,7);
 assert.equal(r.byName.get('plus').anchor.address,40);
 assert.equal(r.byName.get('minus').layout.count,3);
 assert.equal(r.conflicted.size,0);
});
test('both margins compose with transitive linked lengths',()=>{
 const a=[anchor('grandchild',140,'[value.]child+1-2'),
          anchor('child',40,'[value.]root-1+3'),
          anchor('root',10,'[value.]5')];
 const r=resolveHmaTableLayouts(a,{romSize:256});
 assert.equal(r.byName.get('child').layout.count,7);
 assert.equal(r.byName.get('grandchild').layout.count,6);
 assert.equal(r.byName.get('grandchild').lengthFrom,'child');
 assert.deepEqual(r.byName.get('grandchild').parentMargins,{beginning:1,end:-2});
});
test('zero and excessive adjusted counts fail closed and prevent descendant resolution',()=>{
 const a=[anchor('root',8,'[value.]3'),anchor('zero',30,'[value.]root-3'),
          anchor('grandchild',40,'[value.]zero+1'),
          anchor('huge',50,'[value.]root+1000000')];
 const r=resolveHmaTableLayouts(a,{romSize:256});
 assert.equal(r.unresolved.get('zero'),'invalid-adjusted-length');
 assert.equal(r.unresolved.get('huge'),'invalid-adjusted-length');
 assert.equal(r.unresolved.get('grandchild'),'unresolved-or-cyclic-length-anchor');
 assert.equal(r.byName.size,1);
});
test('margin-expanded tables must remain inside ROM bounds',()=>{
 const a=[anchor('root',8,'[value.]2'),anchor('child',62,'[value.]root+1')];
 const r=resolveHmaTableLayouts(a,{romSize:64});
 assert.equal(r.unresolved.get('child'),'out-of-bounds');
});
test('malformed expressions never fall back to exact-name or one-row inference',()=>{
 const a=[anchor('root',8,'[value.]4'),anchor('bad',20,'[value.]root++1')];
 const r=resolveHmaTableLayouts(a,{romSize:64});
 assert.equal(r.unresolved.get('bad'),'unsupported-length-expression');
 assert.equal(r.byName.size,1);
});
test('margin-linked table preview and pointer references remain read-only',()=>{
 const bytes=new Uint8Array(256);
 write32(bytes,40,0x08000080);write32(bytes,44,0x08000080);
 const before=bytes.slice();
 const a=[anchor('root',10,'[value.]3'),anchor('child',40,'[ptr<text>]root-1')];
 const layout=resolveHmaTableLayouts(a,{romSize:bytes.length});
 const table=previewHmaFixedTable(bytes,a[1],{tableResolution:layout});
 assert.equal(table.count,2);
 assert.deepEqual(table.rows.map(x=>x.offset),[40,44]);
 const refs=inspectHmaPointerReferences(bytes,128,a,{maxScanBytes:64});
 assert.deepEqual(refs.declared.map(x=>x.source),[40,44]);
 assert.deepEqual(bytes,before);
});
test('identical declarations deduplicate without suppressing named table inspection',()=>{
 const sources=[{name:'a.toml',text:toml('root',10,'[value.]2')},
                {name:'b.toml',text:toml('root',10,'[value.]2')}];
 const r=collectHmaNamedAnchors(sources,{romSize:256});
 assert.equal(r.anchors.length,1);
 assert.equal(r.conflictedNames.size,0);
 assert.equal(resolveHmaTableLayouts(r.anchors,{romSize:256}).byName.size,1);
});
test('conflicting same-name TOML overlays remain visible and cannot be typed',()=>{
 const sources=[{name:'default.toml',text:toml('root',40,'[ptr<text>]1')},
                {name:'override.toml',text:toml('root',44,'[ptr<text>]1')}];
 const merged=collectHmaNamedAnchors(sources,{romSize:256});
 assert.equal(merged.anchors.length,2);
 assert.deepEqual([...merged.conflictedNames],['root']);
 assert.deepEqual(merged.anchors.map(a=>a.source),['default.toml','override.toml']);
 const resolved=resolveHmaTableLayouts(merged.anchors,{romSize:256});
 assert.equal(resolved.unresolved.get('root'),'conflicting-duplicate-name');
 const bytes=new Uint8Array(256);write32(bytes,40,0x08000080);write32(bytes,44,0x08000080);
 const refs=inspectHmaPointerReferences(bytes,128,merged.anchors,{maxScanBytes:64});
 assert.equal(refs.matchedDeclared,0);
 assert.deepEqual(refs.candidates.map(x=>x.source),[40,44]);
});
test('same-name different-format claims are not silently discarded',()=>{
 const sources=[{name:'a',text:toml('root',40,'[hp.]1')},
                {name:'b',text:toml('root',40,'[ptr<text>]1')}];
 const r=collectHmaNamedAnchors(sources,{romSize:256});
 assert.equal(r.anchors.length,2);
 assert.equal(resolveHmaTableLayouts(r.anchors,{romSize:256}).unresolved.get('root'),'conflicting-duplicate-name');
});
test('invalid metadata input and excessive source lists fail closed',()=>{
 assert.throws(()=>collectHmaNamedAnchors([{name:'',text:''}]),/Unnamed/);
 assert.throws(()=>collectHmaNamedAnchors([{name:'bad',text:null}]),/Metadata/);
 assert.throws(()=>collectHmaNamedAnchors(new Array(1001).fill({name:'x',text:''})),/source list/);
});
test('multiple conflicting versions of one name remain explicit, identical copies deduplicate',()=>{
 const sources=[{name:'one',text:toml('root',10,'[x.]1')},
                {name:'two',text:toml('root',11,'[x.]1')},
                {name:'three',text:toml('root',11,'[x.]1')},
                {name:'four',text:toml('root',12,'[x.]1')}];
 const r=collectHmaNamedAnchors(sources,{romSize:256});
 assert.equal(r.anchors.length,3);
 assert.equal(r.conflictedNames.size,1);
});
