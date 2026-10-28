import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseLocalCubeBankSmokeArgs,inspectLocalCubeBankSmoke} from '../scripts/local-cube-bank-smoke.mjs';
function u16(b,i,v){b[i]=v&255;b[i+1]=v>>>8;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),'cube-render-smoke-'));
 try{
  const toml=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8')).replace('Address = 0x102D520','Address = 0x10');
  const bytes=new Uint8Array(0xe000);
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
  bytes.fill(0x11,0x1000,0x1020);bytes.fill(0x22,0x5000,0x5020);
  u16(bytes,0x9002,0x001f);u16(bytes,0x9200+6*32+4,0x7c00);
  for(let i=0;i<8;i++){u16(bytes,0x9400+i*2,0);u16(bytes,0xb400+i*2,512|(6<<12));}
  const rom=join(dir,'local.gba'),metadata=join(dir,'local.toml');
  await writeFile(rom,bytes);await writeFile(metadata,toml);
  const hash=createHash('sha256').update(bytes).digest('hex');
  return await fn({dir,rom,metadata,hash,bytes});
 }finally{await rm(dir,{recursive:true,force:true});}
}
const args=({rom,metadata,hash})=>['--rom',rom,'--metadata',metadata,
 '--expected-sha256',hash,'--bank-index','0','--map-index','0','--map-count','1','--render-map','1'];
test('local render smoke reports aggregate-only RSE viewport and preserves ROM',async()=>{
 await fixture(async f=>{
  const before=await readFile(f.rom);
  const result=await inspectLocalCubeBankSmoke(args(f));
  assert.equal(result.customRenderMode,'conservative-rse');
  assert.equal(result.customRenderedMetatiles,2);
  assert.equal(result.customRenderedPixelCount,512);
  assert.equal(result.customRenderedOutputExported,false);
  assert.equal(result.independentParityEvidence,false);
  const json=JSON.stringify(result);
  assert.ok(!json.includes(f.dir));
  assert.ok(!json.includes(f.hash));
  assert.ok(!json.includes('0x08000000'));
  assert.deepEqual(await readFile(f.rom),before);
 });
});
test('local render check refuses missing map selection, malformed flag and custom lighting',async()=>{
 await fixture(async f=>{
  const full=args(f);
  assert.throws(()=>parseLocalCubeBankSmokeArgs(full.slice(0,6).concat(['--render-map','1'])),RangeError);
  assert.throws(()=>parseLocalCubeBankSmokeArgs(full.slice(0,-1).concat(['0'])),RangeError);
  f.bytes[0x502]=1;
  await writeFile(f.rom,f.bytes);
  const hash=createHash('sha256').update(f.bytes).digest('hex');
  await assert.rejects(inspectLocalCubeBankSmoke(args({...f,hash})),/light/i);
 });
});
