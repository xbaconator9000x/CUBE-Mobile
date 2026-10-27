import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapBankEntry,inspectVanillaMapWarps} from '../src/map-discovery.js';
import {inspectBlockMap} from '../src/map-blocks.js';
const gba=n=>0x08000000+n;
function put32(rom,at,n){for(let i=0;i<4;i++)rom[at+i]=(n>>>(i*8))&255;}
function put16(rom,at,n){rom[at]=n&255;rom[at+1]=n>>>8;}
function fixture(family='RSE'){
 const rom=new Uint8Array(1024).fill(0xff);
 put32(rom,0x100,gba(0x120));put32(rom,0x104,gba(0x140));
 put32(rom,0x120,gba(0x160));put32(rom,0x124,gba(0x160));
 put32(rom,0x160,gba(0x1a0));put32(rom,0x164,gba(0x1c0));
 put32(rom,0x168,0);put32(rom,0x16c,0);
 put32(rom,0x1a0,3);put32(rom,0x1a4,2);
 for(const [offset,target] of [[0x1a8,0x240],[0x1ac,0x220],[0x1b0,0x260],[0x1b4,0x280]])
   put32(rom,offset,gba(target));
 if(family==='FRLG'){rom[0x1b8]=2;rom[0x1b9]=2;}
 rom[0x1c0]=1;rom[0x1c1]=2;rom[0x1c2]=3;rom[0x1c3]=4;
 put32(rom,0x1c8,gba(0x200));
 put16(rom,0x200,11);put16(rom,0x202,22);
 rom.set([3,4,5,6],0x204);
 put16(rom,0x208,44);put16(rom,0x20a,55);
 rom.set([7,8,9,10],0x20c);
 put16(rom,0x220,0xffff);
 return rom;
}
const entry=(rom,more={})=>inspectVanillaMapBankEntry(rom,{
 address:0x100,bankCount:2,bankIndex:0,mapCount:2,mapIndex:0,family:'RSE',...more
});
test('resolve explicit vanilla bank/map chain with provenance and map cells',()=>{
 const rom=fixture(),before=rom.slice(),out=entry(rom);
 assert.equal(out.bankPointerSource,0x100);
 assert.equal(out.mapPointerSource,0x120);
 assert.equal(out.mapHeaderOffset,0x160);
 assert.equal(out.header.layout.blockmapOffset,0x220);
 assert.equal(out.header.layout.width,3);
 assert.equal(inspectBlockMap(rom,{address:out.header.layout.blockmapOffset,width:3,height:2}).cells[0][0].collision,63);
 assert.equal(out.layoutAuthenticated,false);
 assert.equal(Object.isFrozen(out),true);
 assert.deepEqual(rom,before);
});
test('vanilla warps preserve exact coordinates and destination IDs',()=>{
 const rom=fixture(),before=rom.slice();
 const out=inspectVanillaMapWarps(rom,{address:0x160,family:'RSE'});
 assert.deepEqual([out.objectCount,out.warpCount,out.scriptCount,out.signpostCount],[1,2,3,4]);
 assert.equal(out.warpOffset,0x200);
 assert.deepEqual(out.warps[0],{index:0,offset:0x200,x:11,y:22,elevation:3,warpId:4,targetMap:5,targetBank:6});
 assert.deepEqual(out.warps[1],{index:1,offset:0x208,x:44,y:55,elevation:7,warpId:8,targetMap:9,targetBank:10});
 assert.equal(Object.isFrozen(out.warps),true);
 assert.equal(Object.isFrozen(out.warps[0]),true);
 assert.deepEqual(rom,before);
});
test('FRLG layout is followed only when explicitly selected',()=>{
 const rom=fixture('FRLG');
 assert.deepEqual(entry(rom,{family:'FRLG'}).header.layout.extra,{borderWidth:2,borderHeight:2,unused:65535});
 assert.equal(inspectVanillaMapWarps(rom,{address:0x160,family:'FRLG'}).warps.length,2);
});
test('zero warps does not dereference unused warp pointer',()=>{
 const rom=fixture();rom[0x1c1]=0;put32(rom,0x1c8,0xffffffff);
 const out=inspectVanillaMapWarps(rom,{address:0x160,family:'RSE'});
 assert.equal(out.warpOffset,null);assert.deepEqual(out.warps,[]);
});
test('null events pointer returns an empty, read-only result',()=>{
 const rom=fixture();put32(rom,0x164,0);
 const out=inspectVanillaMapWarps(rom,{address:0x160,family:'RSE'});
 assert.equal(out.eventsOffset,null);assert.equal(out.warpCount,0);
});
test('bank count/index and table bounds fail closed',()=>{
 const rom=fixture();
 for(const more of [{bankCount:0},{bankCount:257},{mapCount:0},{mapCount:1025},
   {bankIndex:2},{mapIndex:-1},{mapIndex:2},{address:0x101},{address:0x400}])
   assert.throws(()=>entry(rom,more));
});
test('bad map-bank pointers and self-overlapping arrays are rejected',()=>{
 const rom=fixture();
 for(const value of [0,0x07000120,0x0a000120,gba(0x121),gba(0x400),gba(0x100)]){
  put32(rom,0x100,value);assert.throws(()=>entry(rom));
 }
});
test('map header, layout and blockmap cannot occupy pointer arrays',()=>{
 const rom=fixture();
 put32(rom,0x120,gba(0x120));assert.throws(()=>entry(rom),/overlap/);
});
test('bad warp pointers, truncated arrays and structure overlap fail closed',()=>{
 const rom=fixture();
 for(const p of [0,0x07000200,gba(0x201),gba(0x400),gba(0x1c0),gba(0x220)]){
  put32(rom,0x1c8,p);
  assert.throws(()=>inspectVanillaMapWarps(rom,{address:0x160,family:'RSE'}));
 }
});
test('staged edits affect inspection but never mutate base bytes',()=>{
 const rom=fixture();const edits=new Map([[0x1c1,1],[0x200,0x99]]);
 let reads=0;
 const accessor={length:rom.length,read(i){reads++;return edits.get(i)??rom[i];}};
 const out=inspectVanillaMapWarps(accessor,{address:0x160,family:'RSE'});
 assert.equal(out.warpCount,1);assert.equal(out.warps[0].x,0x99);
 assert.equal(rom[0x1c1],2);assert.equal(rom[0x200],11);
 assert.ok(reads<150);
});
test('invalid ROM reader and accessor bytes are rejected',()=>{
 assert.throws(()=>entry([]),TypeError);
 const rom={length:1024,read(){return 256;}};
 assert.throws(()=>entry(rom),/Invalid ROM accessor byte/);
});
