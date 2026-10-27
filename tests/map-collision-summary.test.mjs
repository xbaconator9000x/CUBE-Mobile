import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeBlockmapChunk} from '../src/map-blocks.js';

const make=()=>{
 const rom=new Uint8Array(0x200);
 const words=[0x0003,0x0403,0xfc02,0xfc02,0x0801,0x0003];
 words.forEach((word,i)=>{rom[0x80+i*2]=word&255;rom[0x81+i*2]=word>>8;});
 return rom;
};
const options={address:0x80,width:3,height:2};
test('raw six-bit distribution, tile frequency, and source offsets are exact',()=>{
 const rom=make(),before=rom.slice();
 const a=summarizeBlockmapChunk(rom,{...options,maxCells:4});
 assert.equal(a.scannedCells,4);
 assert.equal(a.totalCells,6);
 assert.equal(a.nextCell,4);
 assert.equal(a.firstByteOffset,0x80);
 assert.equal(a.lastByteOffset,0x87);
 assert.equal(a.rawHighBitCounts[0],1);
 assert.equal(a.rawHighBitCounts[1],1);
 assert.equal(a.rawHighBitCounts[63],2);
 assert.equal(a.rawHighBitCounts.reduce((x,y)=>x+y,0),4);
 assert.deepEqual(a.commonTiles,[{tileId:2,count:2},{tileId:3,count:2}]);
 assert.equal(a.distinctTiles,2);
 assert.equal(a.walkabilityVerified,false);
 assert.equal(a.layoutAuthenticated,false);
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.rawHighBitCounts)&&Object.isFrozen(a.commonTiles[0]));
 assert.deepEqual(rom,before);
 const b=summarizeBlockmapChunk(rom,{...options,startCell:4,maxCells:4096});
 assert.equal(b.scannedCells,2);
 assert.equal(b.nextCell,null);
 assert.deepEqual(b.commonTiles,[{tileId:1,count:1},{tileId:3,count:1}]);
});
test('staged byte accessor is read, never written, and invalid values fail closed',()=>{
 const rom=make(),reads=[];
 const staged={length:rom.length,read:i=>{reads.push(i);return i===0x80?4:rom[i];}};
 const a=summarizeBlockmapChunk(staged,{...options,maxCells:1});
 assert.deepEqual(reads,[0x80,0x81]);
 assert.deepEqual(a.commonTiles,[{tileId:4,count:1}]);
 assert.equal(rom[0x80],3);
 assert.throws(()=>summarizeBlockmapChunk({length:rom.length,read:()=>256},{...options,maxCells:1}),/invalid byte/);
 assert.throws(()=>summarizeBlockmapChunk({length:rom.length,read:()=>undefined},{...options,maxCells:1}),/invalid byte/);
});
test('reject malformed offsets, dimensions, full-span overflows and unbounded scans',()=>{
 const rom=make();
 for(const args of [{address:0x81},{address:-2},{address:0x200},
   {width:0},{width:1025},{height:0},{height:1025},
   {startCell:-1},{startCell:6},{startCell:0.5},
   {maxCells:0},{maxCells:4097},{maxCells:1.5}]){
  assert.throws(()=>summarizeBlockmapChunk(rom,{...options,...args}));
 }
 assert.throws(()=>summarizeBlockmapChunk([],options),TypeError);
 assert.throws(()=>summarizeBlockmapChunk(new Uint8Array(8),options),/bounds/);
});
test('4096-cell cap and deterministic tile tie breaking',()=>{
 const rom=new Uint8Array(10000);
 const a=summarizeBlockmapChunk(rom,{address:0,width:100,height:50});
 assert.equal(a.scannedCells,4096);
 assert.equal(a.nextCell,4096);
 assert.deepEqual(a.commonTiles,[{tileId:0,count:4096}]);
 const b=summarizeBlockmapChunk(rom,{address:0,width:100,height:50,startCell:4096});
 assert.equal(b.scannedCells,904);
 assert.equal(b.nextCell,null);
});
