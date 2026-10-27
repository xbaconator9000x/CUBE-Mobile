import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapEvents,inspectVanillaEventScriptPointers,previewVanillaEventScriptBytes} from '../src/map-events.js';
const ptr=n=>0x08000000+n;
function u32(rom,at,n){for(let i=0;i<4;i++)rom[at+i]=(n>>>(8*i))&255;}
function u16(rom,at,n){rom[at]=n&255;rom[at+1]=(n>>>8)&255;}
function fixture(){
 const rom=new Uint8Array(0x500).fill(0xff);
 u32(rom,0x100,ptr(0x140));u32(rom,0x104,ptr(0x180));u32(rom,0x108,0);u32(rom,0x10c,0);
 u32(rom,0x140,2);u32(rom,0x144,2);
 for(const [at,to] of [[0x148,0x200],[0x14c,0x220],[0x150,0x240],[0x154,0x260]])u32(rom,at,ptr(to));
 rom.set([1,1,1,1],0x180);
 for(const [at,to] of [[0x184,0x2a0],[0x188,0x2c0],[0x18c,0x2e0],[0x190,0x300]])u32(rom,at,ptr(to));
 rom[0x2a0]=5;rom[0x2a1]=7;u16(rom,0x2a2,0x1234);u16(rom,0x2a4,0x55);u16(rom,0x2a6,0x66);rom[0x2a8]=3;rom[0x2a9]=4;
 u16(rom,0x2aa,0x1122);u16(rom,0x2ac,0x3344);u16(rom,0x2ae,0x5566);u32(rom,0x2b0,ptr(0x350));u16(rom,0x2b4,0x7788);u16(rom,0x2b6,0x99aa);
 u16(rom,0x2c0,9);u16(rom,0x2c2,10);rom.set([11,12,13,14],0x2c4);
 u16(rom,0x2e0,20);u16(rom,0x2e2,21);u16(rom,0x2e4,22);u16(rom,0x2e6,23);u32(rom,0x2e8,0xabcdef01);u32(rom,0x2ec,ptr(0x380));
 u16(rom,0x300,30);u16(rom,0x302,31);rom[0x304]=32;rom[0x305]=33;u16(rom,0x306,34);u32(rom,0x308,0x11223344);
 return rom;
}
const read=(rom,options={})=>inspectVanillaMapEvents(rom,{address:0x100,family:'RSE',...options});
test('all four vanilla arrays preserve coordinates, source offsets and raw pointers',()=>{
 const rom=fixture(),before=rom.slice(),r=read(rom);
 assert.deepEqual(r.counts,{objects:1,warps:1,scripts:1,signposts:1});
 assert.deepEqual(r.offsets,{objects:0x2a0,warps:0x2c0,scripts:0x2e0,signposts:0x300});
 assert.deepEqual(r.arrays.objects[0],{index:0,offset:0x2a0,id:5,graphics:7,familyField:0x1234,x:0x55,y:0x66,elevation:3,movement:4,range:0x1122,trainerType:0x3344,trainerRangeOrBerryId:0x5566,scriptPointer:ptr(0x350),flag:0x7788,padding:0x99aa});
 assert.deepEqual(r.arrays.warps[0],{index:0,offset:0x2c0,x:9,y:10,elevation:11,warpId:12,targetMap:13,targetBank:14});
 assert.deepEqual(r.arrays.scripts[0],{index:0,offset:0x2e0,x:20,y:21,elevation:22,trigger:23,indexValue:0xabcdef01,scriptPointer:ptr(0x380)});
 assert.deepEqual(r.arrays.signposts[0],{index:0,offset:0x300,x:30,y:31,elevation:32,kind:33,unused:34,rawArgument:0x11223344});
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.arrays)&&Object.isFrozen(r.arrays.objects[0]));
 assert.deepEqual(rom,before);
});
test('FRLG format is explicitly selectable without CUBE authentication',()=>{
 const r=read(fixture(),{family:'FRLG'});
 assert.equal(r.arrays.objects[0].familyField,0x1234);assert.equal(r.layoutAuthenticated,false);
});
test('null/empty events ignore garbage unused pointers',()=>{
 let rom=fixture();u32(rom,0x104,0);let r=read(rom);
 assert.equal(r.eventsOffset,null);assert.equal(r.arrays.objects.length,0);
 rom=fixture();rom.fill(0,0x180,0x184);r=read(rom);
 assert.deepEqual(r.counts,{objects:0,warps:0,scripts:0,signposts:0});
 assert.equal(r.offsets.objects,null);
});
test('rejects invalid pointers, structural and cross-array overlaps',()=>{
 for(const [at,val] of [[0x184,0],[0x184,ptr(0x180)],[0x184,ptr(0x140)],[0x184,ptr(0x220)],[0x184,ptr(0x2c0)],[0x184,ptr(0x4f0)],[0x18c,ptr(0x2a0)],[0x190,0x07000300]]){
  const rom=fixture();u32(rom,at,val);assert.throws(()=>read(rom),/array|pointer|bounds|overlap/i);
 }
});
test('staged ROM accessor affects inspection but not base bytes',()=>{
 const rom=fixture();
 const result=read({length:rom.length,read:i=>i===0x2a0?99:rom[i]});
 assert.equal(result.arrays.objects[0].id,99);assert.equal(rom[0x2a0],5);
 const zero=read({length:rom.length,read:i=>i===0x180?0:rom[i]});
 assert.equal(zero.counts.objects,0);assert.equal(zero.arrays.objects.length,0);
});
test('unknown format and invalid accessor bytes fail closed',()=>{
 assert.throws(()=>read([]),TypeError);
 assert.throws(()=>read(fixture(),{family:'CUBE'}));
 assert.throws(()=>read({length:0x500,read(){return 300;}}));
});

test('script pointer field inspector classifies raw references without decoding scripts',()=>{
 const rom=fixture(),before=rom.slice();
 const result=inspectVanillaEventScriptPointers(rom,{address:0x100,family:'RSE'});
 assert.deepEqual(result.counts,{inRom:2,null:0,outsideRom:0,nonRom:0});
 assert.deepEqual(result.records.map(x=>x.sourceOffset),[0x2b0,0x2ec]);
 assert.deepEqual(result.records.map(x=>x.targetOffset),[0x350,0x380]);
 assert.equal(result.scriptsDecoded,false);
 assert.equal(result.layoutAuthenticated,false);
 assert.ok(Object.isFrozen(result.records)&&Object.isFrozen(result.records[0]));
 assert.deepEqual(rom,before);
});
test('script pointer inspection retains zero, non-ROM and out-of-ROM values',()=>{
 const rom=fixture();
 u32(rom,0x2b0,0);u32(rom,0x2ec,0x07000100);
 let result=inspectVanillaEventScriptPointers(rom,{address:0x100,family:'RSE'});
 assert.deepEqual(result.records.map(x=>x.status),['null','non-rom']);
 u32(rom,0x2ec,ptr(0x600));
 result=inspectVanillaEventScriptPointers(rom,{address:0x100,family:'RSE'});
 assert.equal(result.records[1].status,'outside-rom');
 assert.equal(result.records[1].targetOffset,null);
 const staged={length:rom.length,read:i=>i>=0x2b0&&i<0x2b4?0:rom[i]};
 assert.equal(inspectVanillaEventScriptPointers(staged,{address:0x100,family:'RSE'}).records[0].status,'null');
});

test('bounded raw script preview preserves source pointer and exact target bytes',()=>{
 const rom=fixture(),before=rom.slice();
 const a=previewVanillaEventScriptBytes(rom,{address:0x100,family:'RSE',
  kind:'objects',index:0,byteCount:4});
 assert.equal(a.pointerSourceOffset,0x2b0);
 assert.equal(a.targetOffset,0x350);
 assert.equal(a.rawPointer,ptr(0x350));
 assert.deepEqual(a.bytes,[255,255,255,255]);
 assert.equal(a.readBytes,4);
 assert.equal(a.truncated,false);
 assert.equal(a.scriptsDecoded,false);
 assert.equal(a.layoutAuthenticated,false);
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.bytes));
 assert.deepEqual(rom,before);
 const b=previewVanillaEventScriptBytes(rom,{address:0x100,family:'RSE',
  kind:'scripts',index:0,byteCount:1});
 assert.equal(b.targetOffset,0x380);
 assert.deepEqual(b.bytes,[255]);
});
test('raw script preview respects ROM end and staged bytes without writes',()=>{
 const rom=fixture();u32(rom,0x2b0,ptr(0x4fe));rom[0x4fe]=0x12;rom[0x4ff]=0x34;
 const staged={length:rom.length,read:i=>i===0x4fe?0x56:rom[i]};
 const a=previewVanillaEventScriptBytes(staged,{address:0x100,family:'RSE',
  kind:'objects',index:0,byteCount:8});
 assert.deepEqual(a.bytes,[0x56,0x34]);
 assert.equal(a.readBytes,2);assert.equal(a.truncated,true);
 assert.equal(rom[0x4fe],0x12);
 assert.throws(()=>previewVanillaEventScriptBytes(
  {length:rom.length,read:i=>i===0x4fe?300:rom[i]},
  {address:0x100,family:'RSE',kind:'objects',index:0,byteCount:8}),/Invalid ROM accessor byte/);
});
test('raw script preview rejects absent, unsafe and malformed pointers',()=>{
 const rom=fixture();
 for(const extra of [{kind:'warps',index:0},{kind:'objects',index:-1},
  {kind:'objects',index:1},{kind:'objects',index:0,byteCount:0},
  {kind:'objects',index:0,byteCount:65},{kind:'objects',index:0,byteCount:1.5}])
  assert.throws(()=>previewVanillaEventScriptBytes(rom,{address:0x100,family:'RSE',...extra}));
 u32(rom,0x2b0,0);
 assert.throws(()=>previewVanillaEventScriptBytes(rom,{address:0x100,family:'RSE',
  kind:'objects',index:0}),/no in-ROM target/);
 u32(rom,0x2b0,ptr(0x600));
 assert.throws(()=>previewVanillaEventScriptBytes(rom,{address:0x100,family:'RSE',
  kind:'objects',index:0}),/no in-ROM target/);
});
