import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHmaLists,parseHmaFixedTableFormat,previewHmaFixedTable,resolveHmaTableLayouts} from '../src/semantic.js';

const list=(name,values)=>parseHmaLists("[[List]]\nName = '''"+name+"'''\n0 = ["+values.map(v=>"'''"+v+"'''").join(', ')+"]");
const anchor={name:'weatherTable',address:16,format:'[weather.weathertypes count:]3'};
test('enum suffix is retained only as a read-only hint on integer fields',()=>{
 const layout=parseHmaFixedTableFormat(anchor.format);
 assert.equal(layout.fields[0].enumName,'weathertypes');
 assert.equal(layout.fields[1].enumName,undefined);
 assert.equal(parseHmaFixedTableFormat('[weather.weathertypes|h]1').fields[0].enumName,'weathertypes');
 assert.equal(parseHmaFixedTableFormat('[raw.|h]1').fields[0].enumName,undefined);
});
test('named-list enum preview preserves raw numeric values and ROM bytes',()=>{
 const rom=new Uint8Array(80);
 rom.set([0,5,1,6,2,7],16);
 const before=rom.slice();
 const lists=list('weathertypes',['None','Sun','Rain']);
 const resolved=resolveHmaTableLayouts([anchor],{romSize:rom.length,lists});
 const preview=previewHmaFixedTable(rom,anchor,{tableResolution:resolved,lists,anchors:[anchor]});
 assert.deepEqual(preview.rows.map(r=>r.cells[0].value),[0,1,2]);
 assert.deepEqual(preview.rows.map(r=>r.cells[0].enumLabel),['None','Sun','Rain']);
 assert.deepEqual(rom,before);
});
test('unknown and sparse enum entries never fabricate labels',()=>{
 const rom=new Uint8Array(32);
 rom.set([0,1,3],4);
 const a={name:'enumTable',address:4,format:'[type.types]3'};
 const lists=[{name:'types',entries:['One',null,'Three']}];
 const rows=previewHmaFixedTable(rom,a,{lists}).rows;
 assert.equal(rows[0].cells[0].enumLabel,'One');
 assert.equal(rows[1].cells[0].enumLabel,undefined);
 assert.equal(rows[2].cells[0].enumLabel,undefined);
});
test('conflicting lists and named-anchor precedence suppress labels',()=>{
 const rom=Uint8Array.from([1,0,0,0,0,0,0,0]);
 const a={name:'enumTable',address:0,format:'[type.types]1'};
 const lists=list('types',['None','Rain']);
 assert.equal(previewHmaFixedTable(rom,a,{lists,conflictingLists:new Set(['types'])}).rows[0].cells[0].enumLabel,undefined);
 assert.equal(previewHmaFixedTable(rom,a,{lists,anchors:[{name:'types'}]}).rows[0].cells[0].enumLabel,undefined);
 assert.equal(previewHmaFixedTable(rom,a,{lists:[...lists,...lists]}).rows[0].cells[0].enumLabel,undefined);
});
test('enum label preview refuses invalid metadata arguments',()=>{
 assert.throws(()=>previewHmaFixedTable(new Uint8Array(8),{address:0,format:'[x.types]1'},{lists:null}),/metadata/);
});
