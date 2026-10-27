import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeBlockCell, inspectBlockMap} from '../src/map-blocks.js';

function fixture() {
  const rom = new Uint8Array(64).fill(0xFF);
  // 3 columns x 2 rows at file offset 8. Each word: tile (10 bits),
  // collision/elevation (6 bits). Values deliberately distinguish both.
  const cells = [[0,0],[1023,63],[512,32],[7,1],[10,0],[31,15]];
  cells.forEach(([tile,collision],i)=>{
    const value=(collision<<10)|tile;
    rom[8+i*2]=value&255;rom[9+i*2]=value>>8;
  });
  return rom;
}

test('upstream BlockCell bit split retains 10-bit tile and 6-bit collision',()=>{
 assert.deepEqual(decodeBlockCell(0xFFFF),{raw:65535,tileId:1023,collision:63});
 assert.deepEqual(decodeBlockCell(0x8000),{raw:32768,tileId:0,collision:32});
 assert.deepEqual(decodeBlockCell(0x03FF),{raw:1023,tileId:1023,collision:0});
});
test('decode rejects negative, fractional and overflow words',()=>{
 for(const v of [-1,65536,1.5,NaN,Infinity])assert.throws(()=>decodeBlockCell(v));
});
test('map rows use row-major little-endian addressing',()=>{
 const rom=fixture();
 const out=inspectBlockMap(rom,{address:8,width:3,height:2,viewportWidth:3,viewportHeight:2});
 assert.equal(out.cells[0][1].tileId,1023);
 assert.equal(out.cells[0][1].collision,63);
 assert.equal(out.cells[1][0].tileId,7);
 assert.equal(out.cells[1][0].byteOffset,14);
 assert.equal(out.cells[1][2].collision,15);
 assert.equal(out.truncated,false);
 assert.equal(out.walkabilityVerified,false);
});
test('viewport selection preserves global coordinates and byte offsets',()=>{
 const out=inspectBlockMap(fixture(),{address:8,width:3,height:2,x:1,y:0,viewportWidth:2,viewportHeight:1});
 assert.equal(out.rows,1);assert.equal(out.columns,2);
 assert.equal(out.cells[0][0].x,1);assert.equal(out.cells[0][0].byteOffset,10);
 assert.equal(out.cells[0][1].tileId,512);assert.equal(out.truncated,true);
});
test('edge viewport clips rather than reading next map row',()=>{
 const out=inspectBlockMap(fixture(),{address:8,width:3,height:2,x:2,y:1});
 assert.equal(out.columns,1);assert.equal(out.rows,1);
 assert.equal(out.cells[0][0].tileId,31);
});
test('reject out-of-ROM complete layout even when requested viewport fits',()=>{
 assert.throws(()=>inspectBlockMap(new Uint8Array(20),{address:8,width:3,height:3,viewportWidth:1,viewportHeight:1}),/beyond ROM/);
});
test('reject raw GBA pointer, unaligned offset, invalid dimensions and origin',()=>{
 const rom=fixture();
 for(const opts of [
  {address:0x08000008,width:3,height:2},
  {address:9,width:3,height:2},
  {address:8,width:0,height:2},
  {address:8,width:1025,height:1},
  {address:8,width:3,height:2,x:3},
  {address:8,width:3,height:2,y:-1},
  {address:8,width:3,height:2,viewportWidth:65},
 ])assert.throws(()=>inspectBlockMap(rom,opts));
});
test('inspection never modifies ROM and does not expose writable row arrays',()=>{
 const rom=fixture(),before=rom.slice();
 const out=inspectBlockMap(rom,{address:8,width:3,height:2});
 assert.deepEqual(rom,before);
 assert.equal(Object.isFrozen(out.cells),true);
 assert.equal(Object.isFrozen(out.cells[0]),true);
 assert.equal(Object.isFrozen(out.cells[0][0]),true);
 assert.throws(()=>{out.cells[0][0].collision=0;},TypeError);
});
test('wrong ROM input fails closed',()=>{
 assert.throws(()=>inspectBlockMap([0,1,2],{address:0,width:1,height:1}),TypeError);
});
