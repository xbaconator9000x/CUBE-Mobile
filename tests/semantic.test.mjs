import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHmaNamedAnchors,readAnchorInspection,filterAnchors,groupAnchors} from '../src/semantic.js';

const src="[[NamedAnchors]]\nName = '''graphics.pokemon.front'''\nAddress = 0x10\nFormat = '''`lzs4x64x64`'''\n\n[[NamedAnchors]]\nName = 'data.pokemon.stats'\nAddress = 0x30\nFormat = '[hp. atk.]386'\n\n[[NamedAnchors]]\nName = 'outside'\nAddress = 0x1000\n";
test('HMA NamedAnchors TOML indexing',()=>{const a=parseHmaNamedAnchors(src,{romSize:256});assert.equal(a.length,3);assert.equal(a[0].name,'graphics.pokemon.front');assert.equal(a[1].address,48);assert.equal(a[2].valid,false);});
test('Invalid metadata addresses not converted to pointers',()=>assert.equal(parseHmaNamedAnchors("[[NamedAnchors]]\nName='bad'\nAddress=unknown").length,0));
test('Bounded metadata input',()=>assert.throws(()=>parseHmaNamedAnchors('x'.repeat(4*1024*1024+1))));
test('Pointer inspection follows only in-bounds ROM pointer',()=>{const b=new Uint8Array(128);b.set([0x20,0,0,0x08],16);const a=readAnchorInspection(b,{address:16});assert.equal(a.pointer,32);assert.throws(()=>readAnchorInspection(b,{address:128}));});
test('Semantic search by anchor name and format',()=>{const a=parseHmaNamedAnchors(src);assert.equal(filterAnchors(a,'stats').length,1);assert.equal(filterAnchors(a,'lzs').length,1);assert.equal(groupAnchors(a).length,3);});


import {parseHmaFixedTableFormat,previewHmaFixedTable} from '../src/semantic.js';
test('source-grounded fixed-length table layout handles scalar widths and field offsets',()=>{
 const layout=parseHmaFixedTableFormat('[hp. attack: defense:. experience::]386');
 assert.equal(layout.rowSize,10);assert.equal(layout.count,386);
 assert.deepEqual(layout.fields.map(f=>f.offset),[0,1,3,6]);
 assert.equal(parseHmaFixedTableFormat('[word::|h]4').fields[0].size,4);
});
test('read-only table preview reads bounded little-endian rows',()=>{
 const rom=new Uint8Array(100);rom.set([5,0x34,0x12,8,0x78,0x56],10);
 const table=previewHmaFixedTable(rom,{address:10,format:'[hp. xp:]2'});
 assert.deepEqual(table.rows.map(r=>r.cells.map(c=>c.value)),[[5,0x1234],[8,0x5678]]);
 assert.deepEqual(table.rows.map(r=>r.offset),[10,13]);
});
test('pointer targets are validated, raw text bytes are not misrepresented as decoded PCS',()=>{
 const rom=new Uint8Array(128);rom.set([0x20,0,0,8,0x41,0xFF,0x00],12);
 const row=previewHmaFixedTable(rom,{address:12,format:'[pointer<text> name""3]1'}).rows[0];
 assert.equal(row.cells[0].target,32);assert.equal(row.cells[1].value,'41 FF 00');
 rom[15]=0x0A;
 assert.equal(previewHmaFixedTable(rom,{address:12,format:'[pointer<text>]1'}).rows[0].cells[0].target,null);
});
test('unsupported, dynamic and malformed layouts fail closed',()=>{
 for(const format of ['[hp.]data.pokemon.count','[hp.','[hp.]0','[hp.]100000000','[hp. hp.]2','[name""0]2','[a. [b.]2]1','[a.|unknown]3','[x<bad]2']){
   assert.equal(parseHmaFixedTableFormat(format),null,format);
 }
});
test('table boundary and preview limit failures are explicit, never partial',()=>{
 const rom=new Uint8Array(10);
 assert.throws(()=>previewHmaFixedTable(rom,{address:8,format:'[hp::]2'}),/extends beyond/);
 assert.throws(()=>previewHmaFixedTable(rom,{address:0,format:'[hp.]3'},{maxRows:1000}),/limit/);
 assert.equal(previewHmaFixedTable(rom,{address:0,format:'[hp.]10'},{maxRows:3}).rows.length,3);
});
