import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseLocalCubeBankSmokeArgs,inspectLocalCubeBankSmoke} from '../scripts/local-cube-bank-smoke.mjs';

function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),'cube-custom-local-'));
 try{
  const bytes=new Uint8Array(4096),rom=join(dir,'local.gba'),metadata=join(dir,'local.toml');
  const toml=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
    .replace('Address = 0x102D520','Address = 0x10');
  ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);
  ptr(bytes,0x200,0x280);ptr(bytes,0x204,0x600);
  u32(bytes,0x280,4);u32(bytes,0x284,3);
  ptr(bytes,0x288,0x400);ptr(bytes,0x28c,0x300);
  ptr(bytes,0x290,0x500);ptr(bytes,0x294,0x540);
  bytes[0x601]=1;ptr(bytes,0x608,0x700);
  u16(bytes,0x700,7);u16(bytes,0x702,2);
  bytes[0x706]=255;bytes[0x707]=255;
  await writeFile(rom,bytes);await writeFile(metadata,toml);
  const hash=createHash('sha256').update(bytes).digest('hex');
  return await fn({dir,rom,metadata,hash,bytes});
 }finally{await rm(dir,{recursive:true,force:true});}
}
const flags=['--bank-index','0','--map-index','0','--map-count','1'];
test('opt-in custom CUBE map smoke reports aggregate structure without paths, hashes or ROM writes',async()=>{
 await fixture(async({dir,rom,metadata,hash,bytes})=>{
  const before=await readFile(rom);
  const args=['--rom',rom,'--metadata',metadata,'--expected-sha256',hash,...flags];
  const report=await inspectLocalCubeBankSmoke(args);
  assert.equal(report.schema,'cube-mobile-local-cube-bank-table-smoke/3');
  assert.deepEqual(report.customMapSelection,{bankIndex:0,mapIndex:0,explicitMapCount:1});
  assert.equal(report.customMapWidth,4);
  assert.equal(report.customMapHeight,3);
  assert.equal(report.customMapRawCellCount,12);
  assert.equal(report.customEventCounts.warps,1);
  assert.equal(report.customWarpOutsideMapCount,1);
  assert.equal(report.customWarpSpecialTargetCount,1);
  assert.equal(report.cubeLayoutAuthenticated,false);
  assert.equal(report.independentParityEvidence,false);
  const output=JSON.stringify(report);
  assert.ok(!output.includes(dir));
  assert.ok(!output.includes(hash));
  assert.ok(!output.includes('0x08000200'));
  assert.deepEqual(await readFile(rom),before);
  assert.deepEqual(before,Buffer.from(bytes));
 });
});
test('partial map selectors, unsafe counts and wrong hash refuse custom inspection',async()=>{
 await fixture(async({rom,metadata,hash})=>{
  const base=['--rom',rom,'--metadata',metadata,'--expected-sha256',hash];
  for(const bad of [
    ['--bank-index','0'],['--bank-index','0','--map-count','1'],
    ['--bank-index','256','--map-index','0','--map-count','1'],
    ['--bank-index','0','--map-index','0','--map-count','1025'],
    ['--bank-index','0','--map-index','0','--map-count','01'],
    ['--bank-index','0','--map-index','0','--map-count','0']]){
    assert.throws(()=>parseLocalCubeBankSmokeArgs([...base,...bad]),RangeError);
  }
  await assert.rejects(inspectLocalCubeBankSmoke([
    '--rom',rom,'--metadata',metadata,'--expected-sha256','0'.repeat(64),...flags]),RangeError);
 });
});
