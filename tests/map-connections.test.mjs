import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapConnections} from '../src/map-connections.js';
const gba=n=>0x08000000+n;
function put32(r,o,n){for(let i=0;i<4;i++)r[o+i]=(n>>>(i*8))&255;}
function fixture(){
 const r=new Uint8Array(1024).fill(0xff);
 put32(r,0x160,gba(0x1a0));put32(r,0x164,0);
 put32(r,0x168,0);put32(r,0x16c,gba(0x2a0));
 put32(r,0x1a0,2);put32(r,0x1a4,2);
 for(const [o,n] of [[0x1a8,0x240],[0x1ac,0x220],[0x1b0,0x260],[0x1b4,0x280]])
   put32(r,o,gba(n));
 put32(r,0x2a0,2);put32(r,0x2a4,gba(0x2c0));
 put32(r,0x2c0,1);put32(r,0x2c4,0xfffffffd);
 r[0x2c8]=4;r[0x2c9]=7;r[0x2ca]=0xaa;r[0x2cb]=0xbb;
 put32(r,0x2cc,4);put32(r,0x2d0,8);
 r[0x2d4]=9;r[0x2d5]=10;
 return r;
}
const inspect=r=>inspectVanillaMapConnections(r,{address:0x160,family:'RSE'});
test('vanilla connections preserve direction, signed displacement, raw target and unused',()=>{
 const rom=fixture(),before=rom.slice(),result=inspect(rom);
 assert.equal(result.count,2);assert.equal(result.connectionsOffset,0x2a0);
 assert.equal(result.arrayOffset,0x2c0);
 assert.deepEqual(result.connections[0],{
  index:0,offset:0x2c0,direction:1,displacement:-3,rawDisplacement:0xfffffffd,
  targetBank:4,targetMap:7,unused:0xbbaa
 });
 assert.equal(result.connections[1].displacement,8);
 assert.equal(result.connections[1].targetMap,10);
 assert.equal(result.layoutAuthenticated,false);
 assert.equal(Object.isFrozen(result.connections[0]),true);
 assert.deepEqual(rom,before);
});
test('FRLG header and layout can be explicitly selected',()=>{
 const result=inspectVanillaMapConnections(fixture(),{address:0x160,family:'FRLG'});
 assert.equal(result.connections.length,2);
});
test('null connections pointer and zero count do not dereference absent array',()=>{
 const rom=fixture();put32(rom,0x16c,0);
 assert.equal(inspect(rom).connections.length,0);
 put32(rom,0x16c,gba(0x2a0));put32(rom,0x2a0,0);put32(rom,0x2a4,0xffffffff);
 assert.equal(inspect(rom).arrayOffset,null);
});
test('reject absurd count and array outside ROM',()=>{
 const rom=fixture();put32(rom,0x2a0,1025);
 assert.throws(()=>inspect(rom),/count/);
 put32(rom,0x2a0,2);put32(rom,0x2a4,gba(0x3f0));
 assert.throws(()=>inspect(rom),/bounds/);
});
test('reject malformed pointers, misalignment and structure overlaps',()=>{
 const rom=fixture();
 for(const pointer of [0,0x070002c0,0x0a0002c0,gba(0x2c1),gba(0x2a0),gba(0x220),gba(0x160)]){
  put32(rom,0x2a4,pointer);assert.throws(()=>inspect(rom));
 }
});
test('reject connection header overlapping layout and map header',()=>{
 const rom=fixture();
 put32(rom,0x16c,gba(0x1a0));assert.throws(()=>inspect(rom),/overlaps/);
 put32(rom,0x16c,gba(0x160));assert.throws(()=>inspect(rom),/overlaps/);
});
test('staged ROM changes are observed without copying or mutating original',()=>{
 const rom=fixture(),edits=new Map([[0x2c8,99],[0x2c4,0xfe]]);
 let reads=0;
 const result=inspect({length:rom.length,read(i){reads++;return edits.get(i)??rom[i];}});
 assert.equal(result.connections[0].targetBank,99);
 assert.equal(result.connections[0].displacement,-2);
 assert.equal(rom[0x2c8],4);
 assert.ok(reads<150);
});
test('invalid source or accessor byte fails closed',()=>{
 assert.throws(()=>inspect([]),TypeError);
 assert.throws(()=>inspect({length:1024,read(){return 300;}}),/invalid byte/i);
});
