import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeMapScripts} from '../src/hma-cube-map-script-table.js';
function u16(b,i,v){b[i]=v&255;b[i+1]=v>>>8;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(){
 const toml=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(0xe000);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text:toml}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);ptr(bytes,0x200,0x280);
 u32(bytes,0x280,2);u32(bytes,0x284,1);
 for(const [at,to] of [[0x288,0x400],[0x28c,0x300],[0x290,0x500],[0x294,0x540]])ptr(bytes,at,to);
 for(const [at,secondary] of [[0x500,0],[0x540,1]]){
  bytes[at+1]=secondary;
  ptr(bytes,at+4,secondary?0x5000:0x1000);
  ptr(bytes,at+8,secondary?0x9200:0x9000);
  ptr(bytes,at+12,secondary?0xb400:0x9400);
  ptr(bytes,at+16,secondary?0xd800:0xd400);
 }
 ptr(bytes,0x208,0xa00);
 bytes[0xa00]=1;ptr(bytes,0xa01,0xc00);
 bytes[0xa05]=2;ptr(bytes,0xa06,0xb00);
 bytes[0xa0a]=0;
 u16(bytes,0xb00,0x4000);u16(bytes,0xb02,1);ptr(bytes,0xb04,0xc20);
 u16(bytes,0xb08,0);
 return {bytes,summary};
}
const opts={bankIndex:0,mapIndex:0,mapCount:1};
test('source-grounded map scripts decode direct and conditional references',async()=>{
 const {bytes,summary}=await fixture(),before=bytes.slice();
 const r=inspectHmaCubeMapScripts(bytes,summary,opts);
 assert.equal(r.hasTable,true);
 assert.equal(r.scriptEntries,2);
 assert.equal(r.conditionalTableCount,1);
 assert.equal(r.conditionalEntries,1);
 assert.equal(r.entries[0].type,1);
 assert.equal(r.entries[1].type,2);
 assert.equal(r.entries[1].conditions[0].variable,0x4000);
 assert.equal(r.entries[1].conditions[0].value,1);
 assert.equal(r.entries[1].conditions[0].targetOffset,0xc20);
 assert.equal(r.scriptInstructionsDecoded,false);
 assert.equal(r.writeAuthorized,false);
 assert.deepEqual(bytes,before);
});
test('null map scripts are empty and read-only',async()=>{
 const {bytes,summary}=await fixture();u32(bytes,0x208,0);
 const r=inspectHmaCubeMapScripts(bytes,summary,opts);
 assert.equal(r.hasTable,false);
 assert.equal(r.scriptEntries,0);
 assert.equal(r.terminated,true);
});
test('rejects unsupported type, missing terminator and malformed target',async()=>{
 const {bytes,summary}=await fixture();
 bytes[0xa00]=8;
 assert.throws(()=>inspectHmaCubeMapScripts(bytes,summary,opts),/unsupported/i);
 bytes[0xa00]=1;
 for(let i=0;i<64;i++){bytes[0xa00+i*5]=1;ptr(bytes,0xa00+i*5+1,0xc00);}
 assert.throws(()=>inspectHmaCubeMapScripts(bytes,summary,{...opts,maxEntries:63}),/no zero terminator/i);
 bytes[0xa00]=1;u32(bytes,0xa01,0x12345678);
 assert.throws(()=>inspectHmaCubeMapScripts(bytes,summary,{...opts,maxEntries:1}),/pointer/i);
});
test('rejects conditional table without terminator or aliasing map structures',async()=>{
 const {bytes,summary}=await fixture();
 for(let i=0;i<64;i++){u16(bytes,0xb00+i*8,0x4000);u16(bytes,0xb00+i*8+2,1);ptr(bytes,0xb00+i*8+4,0xc20);}
 assert.throws(()=>inspectHmaCubeMapScripts(bytes,summary,{...opts,maxConditions:63}),/conditional.*terminator/i);
 ptr(bytes,0xa06,0x300);
 assert.throws(()=>inspectHmaCubeMapScripts(bytes,summary,opts),/overlaps known map structure|conditional/i);
});
test('bounded read-only accessor and invalid bytes',async()=>{
 const {bytes,summary}=await fixture();
 const accessor={length:bytes.length,read:i=>bytes[i],
  write:()=>{throw Error('WRITING FORBIDDEN')}};
 assert.equal(inspectHmaCubeMapScripts(accessor,summary,opts).scriptEntries,2);
 const bad={length:bytes.length,read:i=>i===0xa00?999:bytes[i]};
 assert.throws(()=>inspectHmaCubeMapScripts(bad,summary,opts),/invalid/i);
 assert.throws(()=>inspectHmaCubeMapScripts(bytes,summary,{...opts,maxEntries:0}),/budget/i);
});
