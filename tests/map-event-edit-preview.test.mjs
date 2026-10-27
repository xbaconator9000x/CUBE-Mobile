import test from 'node:test';
import assert from 'node:assert/strict';
import {previewVanillaEventCoordinateChange} from '../src/map-event-edit-preview.js';
const ptr=n=>0x08000000+n;
function u32(r,o,n){for(let i=0;i<4;i++)r[o+i]=n>>>(8*i)&255;}
function u16(r,o,n){r[o]=n&255;r[o+1]=n>>>8&255;}
function fixture(){
 const r=new Uint8Array(0x800).fill(0xff);
 u32(r,0x100,ptr(0x140));u32(r,0x104,ptr(0x180));
 u32(r,0x108,0);u32(r,0x10c,0);
 u32(r,0x140,4);u32(r,0x144,4);
 for(const [off,to] of [[8,0x200],[12,0x220],[16,0x240],[20,0x260]])
  u32(r,0x140+off,ptr(to));
 r.set([1,0,1,1],0x180);
 u32(r,0x184,ptr(0x300));u32(r,0x18c,ptr(0x340));u32(r,0x190,ptr(0x380));
 u16(r,0x304,1);u16(r,0x306,2);r[0x308]=3;u32(r,0x310,ptr(0x700));
 u16(r,0x340,1);u16(r,0x342,2);u16(r,0x344,0x1234);
 u32(r,0x34c,ptr(0x720));
 u16(r,0x380,1);u16(r,0x382,2);r[0x384]=5;
 u32(r,0x388,0x11223344);
 return r;
}
const preview=(r,kind,changes,opts={})=>previewVanillaEventCoordinateChange(r,{
 address:0x100,family:'RSE',kind,index:0,changes,...opts});
test('object preview changes only coordinate and elevation bytes, not script pointer',()=>{
 const rom=fixture(),before=rom.slice();
 const p=preview(rom,'objects',{x:3,y:0,elevation:9});
 assert.equal(p.recordOffset,0x300);assert.equal(p.recordLength,24);
 assert.equal(p.arrayPointerSource,0x184);
 assert.deepEqual(p.after.slice(4,9),[3,0,0,0,9]);
 assert.deepEqual(p.after.slice(16,20),p.before.slice(16,20));
 assert.equal(p.changed,true);assert.equal(p.writeAuthorized,false);
 assert.ok(Object.isFrozen(p.after));
 assert.deepEqual(rom,before);
});
test('trigger elevation uses 16-bit little endian while signpost uses one byte',()=>{
 const rom=fixture();
 const trigger=preview(rom,'scripts',{x:2,elevation:0x4321});
 assert.deepEqual(trigger.after.slice(0,6),[2,0,2,0,0x21,0x43]);
 assert.equal(trigger.arrayPointerSource,0x18c);
 assert.deepEqual(trigger.after.slice(12,16),trigger.before.slice(12,16));
 const sign=preview(rom,'signposts',{y:3,elevation:8});
 assert.deepEqual(sign.after.slice(0,5),[1,0,3,0,8]);
 assert.deepEqual(sign.after.slice(8,12),sign.before.slice(8,12));
 assert.equal(sign.arrayPointerSource,0x190);
});
test('expected original bytes reject stale selection and preserve unchanged previews',()=>{
 const rom=fixture();
 const p=preview(rom,'objects',{x:1});
 assert.equal(p.changed,false);
 assert.deepEqual(preview(rom,'objects',{x:3},{expectedBytes:p.before}).before,p.before);
 rom[0x305]=7;
 assert.throws(()=>preview(rom,'objects',{x:3},{expectedBytes:p.before}),/changed since selection/);
});
test('bad fields, coordinates, kinds, indexes and malformed expectations fail closed',()=>{
 const rom=fixture();
 for(const [kind,changes,opts] of [
  ['objects',{scriptPointer:0},{}],['scripts',{x:4},{}],
  ['signposts',{y:-1},{}],['objects',{elevation:256},{}],
  ['objects',{},{}],['objects',{x:1.5},{}],
  ['warps',{x:1},{}],['objects',{x:1},{index:1}],
  ['objects',{x:1},{expectedBytes:[1,2]}]
 ])assert.throws(()=>preview(rom,kind,changes,opts));
 assert.throws(()=>preview(rom,'objects',{x:1},{family:'CUBE'}),RangeError);
});
test('staged ROM reader changes preview without mutating source',()=>{
 const rom=fixture(),before=rom.slice();
 const reader={length:rom.length,read:i=>i===0x304?3:rom[i]};
 const p=preview(reader,'objects',{elevation:9});
 assert.equal(p.original.x,3);
 assert.equal(p.proposed.x,3);
 assert.deepEqual(rom,before);
});
