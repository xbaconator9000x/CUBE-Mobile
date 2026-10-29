import test from 'node:test';
import assert from 'node:assert/strict';
import {RomModel} from '../src/core.js';
import {fingerprintRomSha256} from '../src/rom-fingerprint.js';

const rom=()=>Uint8Array.from({length:0xC0},(_,i)=>(i*17+3)&255);
async function baseHash(model){
 return (await fingerprintRomSha256({base:model.base,edits:new Map()},{
  chunkSize:64,yieldEvery:1024
 })).sha256;
}
test('v2 project sidecar restores staged bytes only against exact SHA-256 base',async()=>{
 const a=new RomModel('a.gba',rom());a.write(10,0xee);
 const digest=await baseHash(a),project=a.projectV2(digest);
 assert.equal(project.version,2);
 assert.equal(project.baseSha256,digest);
 const b=new RomModel('b.gba',rom());
 assert.equal(b.loadProjectV2(project,await baseHash(b)),1);
 assert.equal(b.read(10),0xee);
 assert.equal(b.base[10],rom()[10]);
 assert.throws(()=>b.loadProjectV2(project,'0'.repeat(64)),/SHA-256/);
});
test('CRC32-only legacy project cannot pass the v2 import gate',async()=>{
 const a=new RomModel('a.gba',rom());a.write(8,0xff);
 const legacy=a.project(),b=new RomModel('b.gba',rom());
 assert.throws(()=>b.loadProjectV2(legacy,await baseHash(b)),/SHA-256/);
 assert.equal(b.edits.size,0);
});
test('invalid SHA, patched base and corrupt v2 sidecars fail closed',async()=>{
 const a=new RomModel('a.gba',rom());
 assert.throws(()=>a.projectV2('not-a-sha'),/SHA-256/);
 const digest=await baseHash(a),project=a.projectV2(digest);
 assert.throws(()=>a.loadProjectV2({...project,baseSha256:'z'.repeat(64)},digest),/SHA-256/);
 assert.throws(()=>a.loadProjectV2({...project,edits:[[999,1]]},digest),/Invalid edit/);
 assert.equal(a.edits.size,0);
 a.switchPatched(rom());
 assert.throws(()=>a.projectV2(digest),/patched ROM/);
});
test('a changed base ROM is rejected even when project CRC fields are copied',async()=>{
 const a=new RomModel('a.gba',rom());a.write(15,0xaa);
 const p=a.projectV2(await baseHash(a));
 const altered=rom();altered[30]^=1;
 const b=new RomModel('b.gba',altered);
 assert.throws(()=>b.loadProjectV2(p,await baseHash(b)),/SHA-256/);
 assert.equal(b.edits.size,0);
});
