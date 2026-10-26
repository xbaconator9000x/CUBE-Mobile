import test from 'node:test';
import assert from 'node:assert/strict';
import {crc32,RomModel,parseOffset,parseHexBytes,applyBps,applyIps,gbaHeader,decodeLz10,scanLz10Graphics,bgr555,paletteAt,gba4bppTile} from '../src/core.js';

function rom(){const r=new Uint8Array(512).fill(0xff);r.set([80,79,75,69,77,79,78],0xA0);r.set([66,80,69,69],0xAC);r[0xB2]=0x96;let sum=0;for(let i=0xA0;i<=0xBC;i++)sum=(sum+r[i])&255;r[0xBD]=(0x19-sum)&255;return r;}
test('CRC32 reference vector',()=>assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926));
test('Emerald GBA header checksum',()=>{const h=gbaHeader(rom());assert.equal(h.code,'BPEE');assert.equal(h.checksumValid,true);});
test('GBA pointer-to-offset conversion',()=>{assert.equal(parseOffset('0x080001A0'),0x1a0);assert.equal(parseOffset('1A0'),0x1a0);assert.throws(()=>parseOffset('nothex'));});
test('Hex byte parser',()=>assert.deepEqual([...parseHexBytes('DE AD BE EF')],[222,173,190,239]));
test('Raw edits are copy-on-write and undoable',()=>{const bytes=rom(),m=new RomModel('emerald.gba',bytes);m.write(16,42);assert.equal(bytes[16],255);assert.equal(m.read(16),42);m.undo();assert.equal(m.read(16),255);m.redo();assert.equal(m.read(16),42);});
test('ROM edits can be imported only against matching checksum',()=>{const a=new RomModel('a.gba',rom());a.write(15,42);const p=a.project(),b=new RomModel('b.gba',rom());assert.equal(b.loadProject(p),1);assert.equal(b.read(15),42);p.originalCrc32='00000000';assert.throws(()=>b.loadProject(p));});
test('IPS export/import round trip',()=>{const bytes=rom(),m=new RomModel('a.gba',bytes);m.write(12,88);m.write(16,42);assert.deepEqual(applyIps(bytes,m.exportIps()),m.snapshot());});
test('Invalid patches rejected without writing ROM',()=>{const bytes=rom(),copy=bytes.slice();assert.throws(()=>applyIps(bytes,Uint8Array.from([0,1])));assert.throws(()=>applyBps(bytes,Uint8Array.from([0,1])));assert.deepEqual(bytes,copy);});
test('BGR555 palette decode',()=>{assert.equal(bgr555(31).r,255);const pal=new Uint8Array(32);pal[2]=31;assert.equal(paletteAt(pal,0)[1].r,255);});
test('4bpp tile pixel unpack',()=>{const t=new Uint8Array(32);t[0]=0x21;assert.deepEqual([...gba4bppTile(t,0).slice(0,2)],[1,2]);});
test('LZ10 data safely decoded and discovered',()=>{const raw=Uint8Array.from({length:256},(_,i)=>i%16);const coded=[0x10,0,1,0];for(let i=0;i<256;i+=8)coded.push(0,...raw.slice(i,i+8));const data=Uint8Array.from(coded),r=new Uint8Array(1024).fill(255);r.set(data,0x100);assert.deepEqual(decodeLz10(r,0x100).data,raw);assert.equal(scanLz10Graphics(r)[0].offset,0x100);});
test('Bad LZ10 back-reference is refused',()=>assert.throws(()=>decodeLz10(Uint8Array.from([0x10,16,0,0,0x80,0,0]))));
