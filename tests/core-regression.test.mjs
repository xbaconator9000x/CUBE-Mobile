// Regression cases restored from the original v0.5 source checkpoint.
// Keep binary boundary and patch integrity tests alongside semantic additions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {crc32,RomModel,applyIps,applyBps,decodeLz10,scanLz10Graphics} from '../src/core.js';
const makeRom=()=>{const b=new Uint8Array(512);b.fill(0xff);b.set([0x50,0x4F,0x4B,0x45,0x4D,0x4F,0x4E],0xA0);b.set([0x42,0x50,0x45,0x45],0xAC);b[0xB2]=0x96;let s=0;for(let i=0xA0;i<=0xBC;i++)s=(s+b[i])&255;b[0xBD]=(0x19-s)&255;return b;};
const u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
function encodeBps(n){const out=[];for(;;){const x=n%128;n=Math.floor(n/128);if(n===0){out.push(0x80|x);break;}out.push(x);n--; }return out;}
function bps(source,target,actions){const p=[...Buffer.from('BPS1'),...encodeBps(source.length),...encodeBps(target.length),...encodeBps(0),...actions,...u32(crc32(source)),...u32(crc32(target))];return Uint8Array.from([...p,...u32(crc32(Uint8Array.from(p)))]);}
test('IPS EOF marker offset is encoded without colliding with terminator',()=>{
 const rom=new Uint8Array(0x454F50).fill(255),m=new RomModel('big.gba',rom);
 m.write(0x454F46,1);
 const out=applyIps(rom,m.exportIps());
 assert.equal(out[0x454F46],1);assert.equal(out[0x454F45],255);
});
test('IPS RLE can extend ROM and preserves output',()=>{
 const rom=makeRom(),ips=Uint8Array.from([...Buffer.from('PATCH'),0,2,0,0,0,0,3,55,...Buffer.from('EOF')]);
 const out=applyIps(rom,ips);assert.equal(out.length,515);assert.deepEqual([...out.slice(512,515)],[55,55,55]);
});
test('IPS truncation and malformed records are rejected',()=>{
 const src=makeRom();
 assert.throws(()=>applyIps(src,Uint8Array.from([1,2,3])));
 assert.throws(()=>applyIps(src,Uint8Array.from([...Buffer.from('PATCH'),0,0,3])));
});
test('BPS source-read and target-read operations match expected bytes',()=>{
 const source=makeRom(),target=source.slice();target[16]=9;
 const patch=bps(source,target,[...encodeBps((16-1)*4+0),...encodeBps((1-1)*4+1),9,...encodeBps((source.length-17-1)*4+0)]);
 assert.deepEqual(applyBps(source,patch),target);
});
test('BPS overlapping target-copy action is safe',()=>{
 const source=makeRom(),target=source.slice();target.set([10,10,10,10,10],30);
 const actions=[...encodeBps((30-1)*4),...encodeBps(1),10,...encodeBps((4-1)*4+3),...encodeBps(60),...encodeBps((source.length-35-1)*4)];
 assert.deepEqual(applyBps(source,bps(source,target,actions)),target);
});
test('BPS patch and source CRCs are mandatory',()=>{
 const source=makeRom(),target=source.slice(),patch=bps(source,target,[...encodeBps((source.length-1)*4)]);
 assert.deepEqual(applyBps(source,patch),target);
 const corrupt=patch.slice();corrupt[5]^=12;assert.throws(()=>applyBps(source,corrupt),/patch CRC/);
 const wrong=source.slice();wrong[10]^=1;assert.throws(()=>applyBps(wrong,patch),/source CRC/);
});
test('sidecar restore fails atomically on malformed edits',()=>{
 const a=new RomModel('a.gba',makeRom());a.write(25,44);
 const project=a.project(),b=new RomModel('b.gba',makeRom());
 assert.equal(b.loadProject(project),1);assert.equal(b.read(25),44);
 const broken=structuredClone(project);broken.edits.push([9999999,9]);
 assert.throws(()=>b.loadProject(broken));assert.equal(b.read(25),44);
});
test('patch session refuses unsafe IPS export and sidecar restore',()=>{
 const m=new RomModel('x.gba',makeRom());m.switchPatched(makeRom());
 assert.equal(m.appliedPatch,true);
 assert.throws(()=>m.exportIps(),/save/);
 assert.throws(()=>m.loadProject({format:'cubhma-mobile-lab',version:1}),/sidecar|Reset/);
});
test('LZ10 rejects truncated and oversized streams',()=>{
 assert.throws(()=>decodeLz10(Uint8Array.from([0x10,8,0,0,0,1,2])),/Truncated/);
 assert.throws(()=>decodeLz10(Uint8Array.from([0x10,0,0,16])),/output/);
});
test('LZ10 scan excludes false candidates and honors range',()=>{
 const rom=new Uint8Array(2048).fill(0xff),raw=Uint8Array.from({length:256},(_,i)=>i%16);
 const coded=[0x10,0,1,0];for(let i=0;i<256;i+=8)coded.push(0,...raw.slice(i,i+8));
 rom.set(Uint8Array.from(coded),0x200);
 rom.set([0x10,0,1,0,0x80,0,0],0x80);
 const found=scanLz10Graphics(rom);
 assert.deepEqual(found,[{offset:0x200,size:256,compressedBytes:292,tileCount:8}]);
 assert.deepEqual(scanLz10Graphics(rom,{start:0x200,end:0x201}),found);
 assert.deepEqual(scanLz10Graphics(rom,{start:0,end:0x200}),[]);
});
