import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/local-map-smoke.mjs',import.meta.url));
const ptr=n=>0x08000000+n;
function d(r,o,n){for(let i=0;i<4;i++)r[o+i]=n>>>(i*8)&255;}
function fixture(){
 const r=new Uint8Array(0x1000).fill(0xff);
 d(r,0x100,ptr(0x140));d(r,0x140,ptr(0x200));
 d(r,0x200,ptr(0x300));
 for(const o of [4,8,12])d(r,0x200+o,0);
 d(r,0x300,2);d(r,0x304,2);
 for(const [o,target] of [[8,0x500],[12,0x400],[16,0x600],[20,0x620]])
  d(r,0x300+o,ptr(target));
 return r;
}
function run(rom,override={}){
 const dir=mkdtempSync(join(tmpdir(),'cube-map-smoke-'));
 try{
  const romPath=join(dir,'fixture.gba'),manifestPath=join(dir,'manifest.json');
  const hash=createHash('sha256').update(rom).digest('hex');
  const manifest={schema:'cube-mobile-local-map-smoke/1',
   expectedSha256:hash,family:'RSE',bankTableOffset:0x100,
   bankMapCounts:[1],...override};
  writeFileSync(romPath,rom);writeFileSync(manifestPath,JSON.stringify(manifest));
  const result=spawnSync(process.execPath,[script,'--rom',romPath,
   '--manifest',manifestPath],{encoding:'utf8'});
  assert.deepEqual(new Uint8Array(readFileSync(romPath)),rom);
  return result;
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('local hash-matched declared atlas emits a non-writing JSON smoke report',()=>{
 const result=run(fixture());
 assert.equal(result.status,0,result.stderr);
 const report=JSON.parse(result.stdout);
 assert.equal(report.declaredMapCount,1);
 assert.equal(report.declaredBankCount,1);
 assert.equal(report.eventMapsInspected,1);
 assert.equal(report.eventSummaries[0].warps,0);
 assert.equal(report.hashMatchedUserDeclaration,true);
 assert.equal(report.cubeCompatibilityVerified,false);
 assert.equal(report.romSaveReopenVerified,false);
 assert.equal(report.independentParityEvidence,false);
 assert.equal(report.romModified,false);
 assert.doesNotMatch(result.stdout,/0xff,0xff|fixture.gba|manifest.json/);
});
test('wrong independent digest is rejected before inspecting structures',()=>{
 const result=run(fixture(),{expectedSha256:'0'.repeat(64)});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/SHA-256 does not match/);
 assert.equal(result.stdout,'');
});
test('malformed bank declaration and wrong family fail closed',()=>{
 for(const override of [{bankMapCounts:[0]},{family:'CUBE'},
  {bankTableOffset:257},{bankMapCounts:[4097]}]){
  const result=run(fixture(),override);
  assert.notEqual(result.status,0);
  assert.equal(result.stdout,'');
 }
});
test('hash-matched ROM with invalid map pointers fails without report',()=>{
 const rom=fixture();rom[0x100]=0;
 const result=run(rom);
 assert.notEqual(result.status,0);
 assert.equal(result.stdout,'');
});

test('local smoke includes bounded script-prefix status without exporting script bytes',()=>{
 const rom=fixture();
 d(rom,0x204,ptr(0x700));
 rom[0x700]=1;rom[0x701]=0;rom[0x702]=0;rom[0x703]=0;
 d(rom,0x704,ptr(0x740));d(rom,0x708,0);
 d(rom,0x70c,0);d(rom,0x710,0);
 d(rom,0x750,ptr(0x900));
 rom.set([0x16,0,0x40,1,0,0x02],0x900);
 const result=run(rom);
 assert.equal(result.status,0,result.stderr);
 const report=JSON.parse(result.stdout);
 const first=report.eventSummaries[0];
 assert.equal(first.scriptPointersTotal,1);
 assert.equal(first.scriptPointersInspected,1);
 assert.equal(first.scriptPointersTruncated,false);
 assert.equal(first.scriptPointerStatuses.inRom,1);
 assert.equal(first.scriptPointerStatuses.decoded,1);
 assert.equal(first.scriptPointerStatuses.terminal,1);
 assert.equal(report.cubeCompatibilityVerified,false);
 assert.doesNotMatch(result.stdout,/setvar|scriptPointer\\":|fixture.gba/);
});
