import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseLocalCubeBankSmokeArgs,inspectLocalCubeBankSmoke,
 fingerprintHmaCubeRenderedViewport} from '../scripts/local-cube-bank-smoke.mjs';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {renderHmaCubeMapViewport} from '../src/hma-cube-map-render.js';

function u16(b,i,v){b[i]=v&255;b[i+1]=v>>>8;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),'cube-ref-'));
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
  return await fn({dir,rom,metadata,hash,bytes,toml});
 }finally{await rm(dir,{recursive:true,force:true});}
}
const args=f=>['--rom',f.rom,'--metadata',f.metadata,'--expected-sha256',f.hash,
 '--bank-index','0','--map-index','0','--map-count','1','--render-map','1'];
test('reference comparison succeeds only for exact bounded RGBA viewport',async()=>{
 await fixture(async f=>{
  const summary=inspectHmaMapBankAnchorSources([{name:'local-metadata',text:f.toml}],{romSize:f.bytes.length});
  const view=renderHmaCubeMapViewport(f.bytes,summary,{bankIndex:0,mapIndex:0,mapCount:1,
   x:1,y:0,viewportWidth:1,viewportHeight:1});
  const expected=fingerprintHmaCubeRenderedViewport(view);
  const before=await readFile(f.rom);
  const result=await inspectLocalCubeBankSmoke([...args(f),'--viewport-x','1','--viewport-y','0',
   '--viewport-width','1','--viewport-height','1','--expected-render-sha256',expected]);
  assert.equal(result.customRenderReferenceCompared,true);
  assert.equal(result.customRenderReferenceMatched,true);
  assert.equal(result.customRenderReferenceIndependent,false);
  assert.equal(result.customRenderedPixelCount,256);
  assert.equal(result.independentParityEvidence,false);
  const report=JSON.stringify(result);
  assert.ok(!report.includes(expected));
  assert.ok(!report.includes(f.dir));
  assert.deepEqual(await readFile(f.rom),before);
  await assert.rejects(inspectLocalCubeBankSmoke([...args(f),
   '--expected-render-sha256','0'.repeat(64)]),/reference/i);
 });
});
test('reference fingerprint includes dimensions and rejects malformed RGBA',()=>{
 const a={width:1,height:1,pixels:new Uint8ClampedArray([1,2,3,255])};
 const b={width:2,height:1,pixels:new Uint8ClampedArray([1,2,3,255,1,2,3,255])};
 assert.match(fingerprintHmaCubeRenderedViewport(a),/^[0-9a-f]{64}$/);
 assert.notEqual(fingerprintHmaCubeRenderedViewport(a),fingerprintHmaCubeRenderedViewport(b));
 assert.throws(()=>fingerprintHmaCubeRenderedViewport({width:1,height:1,pixels:[1,2,3,255]}),RangeError);
});
test('reference comparison fails closed for missing render flag or unsafe viewport',()=>{
 const base=['--rom','x','--metadata','y','--expected-sha256','0'.repeat(64)];
 for(const extra of [
  ['--expected-render-sha256','0'.repeat(64)],
  ['--viewport-x','1'],
  ['--render-map','1','--viewport-width','0'],
  ['--render-map','1','--viewport-width','33'],
  ['--render-map','1','--viewport-x','1024'],
  ['--render-map','1','--expected-render-sha256','bogus']
 ])assert.throws(()=>parseLocalCubeBankSmokeArgs([...base,...extra]),RangeError);
});
