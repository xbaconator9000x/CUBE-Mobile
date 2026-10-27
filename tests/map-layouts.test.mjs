import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapLayout,inspectVanillaMapHeader} from '../src/map-layouts.js';
import {inspectBlockMap} from '../src/map-blocks.js';

const gba=offset=>0x08000000+offset;
function write32(bytes,at,n){for(let i=0;i<4;i++)bytes[at+i]=(n>>>(i*8))&255;}
function fixture(family='RSE'){
 const rom=new Uint8Array(256).fill(0xFF);
 write32(rom,0x20,gba(0x40));write32(rom,0x24,gba(0xE0));
 write32(rom,0x28,0);write32(rom,0x2C,0xFFFFFFFF);
 write32(rom,0x40,3);write32(rom,0x44,2);
 write32(rom,0x48,gba(0xC0));write32(rom,0x4C,gba(0x80));
 write32(rom,0x50,gba(0xA0));write32(rom,0x54,gba(0xB0));
 if(family==='FRLG'){rom[0x58]=2;rom[0x59]=3;rom[0x5A]=0;rom[0x5B]=0;}
 rom[0x80]=0xFF;rom[0x81]=0xFF;
 return rom;
}
test('vanilla RSE layout resolves bounded blockmap and source pointers',()=>{
 const rom=fixture(),before=rom.slice();
 const layout=inspectVanillaMapLayout(rom,{address:0x40,family:'RSE'});
 assert.equal(layout.width,3);assert.equal(layout.height,2);
 assert.equal(layout.blockmapOffset,0x80);
 assert.equal(layout.primaryOffset,0xA0);assert.equal(layout.secondaryOffset,0xB0);
 assert.equal(layout.borderOffset,0xC0);assert.equal(layout.byteLength,12);
 assert.equal(layout.layoutAuthenticated,false);assert.equal(layout.walkabilityVerified,false);
 assert.equal(layout.readOnly,true);assert.equal(Object.isFrozen(layout),true);
 assert.deepEqual(rom,before);
});
test('read-only map header follows only its explicitly supplied pointer',()=>{
 const header=inspectVanillaMapHeader(fixture(),{address:0x20,family:'RSE'});
 assert.equal(header.layoutOffset,0x40);assert.equal(header.layout.blockmapOffset,0x80);
 assert.equal(header.eventsOffset,0xE0);
 assert.equal(header.scriptsOffset,null);assert.equal(header.connectionsOffset,null);
 assert.equal(header.layoutAuthenticated,false);
});
test('FRLG layout reads its extra border fields without changing RSE size',()=>{
 const layout=inspectVanillaMapLayout(fixture('FRLG'),{address:0x40,family:'FRLG'});
 assert.deepEqual(layout.extra,{borderWidth:2,borderHeight:3,unused:0});
 assert.equal(inspectVanillaMapLayout(fixture(),{address:0x40,family:'RSE'}).extra,null);
});
test('resolved blockmap is compatible with existing raw collision decoder',()=>{
 const rom=fixture(),layout=inspectVanillaMapHeader(rom,{address:0x20,family:'RSE'}).layout;
 const cells=inspectBlockMap(rom,{address:layout.blockmapOffset,width:layout.width,height:layout.height});
 assert.equal(cells.cells[0][0].tileId,1023);
 assert.equal(cells.cells[0][0].collision,63);
});
test('staged ROM accessor is read without allocating a snapshot',()=>{
 const rom=fixture();const edits=new Map([[0x44,1]]);let reads=0;
 const accessor={length:rom.length,read(i){reads++;return edits.get(i)??rom[i];}};
 const layout=inspectVanillaMapLayout(accessor,{address:0x40,family:'RSE'});
 assert.equal(layout.height,1);assert.ok(reads<50);assert.equal(rom[0x44],2);
});
test('invalid families, offsets and dimensions fail closed',()=>{
 const rom=fixture();
 for(const args of [{address:0x40},{address:0x41,family:'RSE'},{address:0x40,family:'CUBE'},
  {address:0x100,family:'RSE'}])
  assert.throws(()=>inspectVanillaMapLayout(rom,args));
 write32(rom,0x40,0);assert.throws(()=>inspectVanillaMapLayout(rom,{address:0x40,family:'RSE'}),/dimensions/);
});
test('invalid and unaligned pointers fail closed',()=>{
 const rom=fixture();
 for(const bad of [0,0x07000080,0x0A000080,gba(0x81),gba(0x100)]){
  write32(rom,0x4C,bad);
  assert.throws(()=>inspectVanillaMapLayout(rom,{address:0x40,family:'RSE'}));
 }
});
test('reject complete blockmap overrun, even if viewport would fit',()=>{
 const rom=fixture();write32(rom,0x40,100);write32(rom,0x44,100);
 assert.throws(()=>inspectVanillaMapLayout(rom,{address:0x40,family:'RSE'}),/beyond ROM/);
});
test('reject blockmap overlap with layout',()=>{
 const rom=fixture();write32(rom,0x4C,gba(0x40));
 assert.throws(()=>inspectVanillaMapLayout(rom,{address:0x40,family:'RSE'}),/overlaps/);
});
test('reject invalid map header layout pointer and header bounds',()=>{
 const rom=fixture();write32(rom,0x20,0);
 assert.throws(()=>inspectVanillaMapHeader(rom,{address:0x20,family:'RSE'}),/Layout/);
 assert.throws(()=>inspectVanillaMapHeader(rom,{address:0xF0,family:'RSE'}),/bounds/);
});
test('malformed ROM accessors fail closed',()=>{
 assert.throws(()=>inspectVanillaMapLayout([], {address:0,family:'RSE'}),TypeError);
 const rom={length:256,read(){return 256;}};
 assert.throws(()=>inspectVanillaMapLayout(rom,{address:0x40,family:'RSE'}),/invalid byte/);
});
