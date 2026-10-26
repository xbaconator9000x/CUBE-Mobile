import test from 'node:test';
import assert from 'node:assert/strict';
import {identifyHmaRom,resolveHmaStockMetadata,checkHmaMetadataSources} from '../src/semantic.js';
function rom(code='BPRE',revision=0){
 const b=new Uint8Array(512);
 b[0xB2]=0x96;for(let i=0;i<4;i++)b[0xAC+i]=code.charCodeAt(i);b[0xBC]=revision;
 let sum=0;for(let i=0xA0;i<=0xBC;i++)sum=(sum+b[i])&255;
 b[0xBD]=(0x19-sum)&255;
 return b;
}
test('identifies supported ROM revision from checked header only',()=>{
 const b=rom('BPRE',1);assert.deepEqual(identifyHmaRom(b),{code:'BPRE',revision:1,headerValid:true,knownGame:true});
 assert.equal(resolveHmaStockMetadata(b).files.at(-1),'default.bpre1.toml');
});
test('Emerald uses its pinned shared and version metadata',()=>{
 assert.deepEqual(resolveHmaStockMetadata(rom('BPEE')).files,['default.toml','default.axve.axpe.bpee.toml','default.bpee.toml']);
});
test('rejects unknown ROM revisions instead of treating all nonzero as revision 1',()=>{
 assert.throws(()=>resolveHmaStockMetadata(rom('BPRE',2)),/No verified/);
 assert.throws(()=>resolveHmaStockMetadata(rom('BPEE',1)),/No verified/);
});
test('rejects corrupt headers for automatic stock selection',()=>{
 const b=rom();b[0xB2]=0;
 assert.equal(identifyHmaRom(b).headerValid,false);
 assert.throws(()=>resolveHmaStockMetadata(b),/header validation/);
});
test('rejects cross-family named stock files with clear error',()=>{
 assert.throws(()=>checkHmaMetadataSources([{name:'default.bpee.toml'}],rom('BPRE')),/incompatible/);
 assert.throws(()=>checkHmaMetadataSources([{name:'default.bpre0.toml'}],rom('BPRE',1)),/incompatible/);
 assert.throws(()=>checkHmaMetadataSources([{name:'default.bpef.toml'}],rom('BPRE',1)),/incompatible/);
});
test('accepts matching pinned stock and arbitrary custom sidecars, without claiming ROM authenticity',()=>{
 const c=checkHmaMetadataSources([{name:'default.bpre1.toml (upstream 30443931)'},{name:'my-project.toml'}],rom('BPRE',1));
 assert.deepEqual(c.sources.map(s=>s.kind),['stock-reference','unverified-custom']);
 assert.match(c.warning,/cannot authenticate/);
});
test('rejects corrupted headers for known stock metadata but permits unknown custom metadata',()=>{
 const b=rom('BPRE');b[0xBD]^=1;
 assert.throws(()=>checkHmaMetadataSources([{name:'default.bpre0.toml'}],b),/invalid ROM header/);
 assert.equal(checkHmaMetadataSources([{name:'mod.toml'}],b).sources[0].kind,'unverified-custom');
});
test('recognizes ROM model read accessor without materializing entire ROM',()=>{
 const b=rom('BPGE',1),wrapper={length:b.length,read:i=>b[i]};
 assert.equal(resolveHmaStockMetadata(wrapper).files.at(-1),'default.bpge1.toml');
});
