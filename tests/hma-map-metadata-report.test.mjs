import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseMapMetadataCliArgs,inspectLocalHmaMapMetadata} from '../scripts/hma-map-metadata-report.mjs';

const script=fileURLToPath(new URL('../scripts/hma-map-metadata-report.mjs',import.meta.url));
const fmt='[banks<map<[layout<[width::]1> events<[warps<[x: y:]4>]1> music.]1>]1>';
const toml=(format=fmt,address='0x100')=>`[[NamedAnchors]]
Name = "data.maps.banks"
Address = ${address}
Format = '''${format}'''`;

async function withToml(fn){
 const dir=await mkdtemp(join(tmpdir(),'cube-map-metadata-'));
 try{return await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}
}

test('local CLI reports exact map-bank evidence without returning raw TOML or ROM bytes',async()=>{
 await withToml(async dir=>{
  const file=join(dir,'custom.toml');
  await writeFile(file,toml());
  const report=await inspectLocalHmaMapMetadata(['--rom-size','4096',file]);
  assert.equal(report.status,'custom-candidate');
  assert.equal(report.declarationCount,1);
  assert.equal(report.declarations[0].address,256);
  assert.equal(report.declarations[0].formatLength,fmt.length);
  assert.ok(report.hierarchy.sectionNames.includes('warps'));
  assert.equal(report.romAuthenticated,false);
  assert.equal(report.writeAuthorized,false);
  assert.ok(!JSON.stringify(report).includes('width::'));
  assert.ok(!JSON.stringify(report).includes(dir));
 });
});
test('local CLI detects conflicting overlays and does not select one',async()=>{
 await withToml(async dir=>{
  const a=join(dir,'a.toml'),b=join(dir,'b.toml');
  await writeFile(a,toml());await writeFile(b,toml(fmt,'0x104'));
  const report=await inspectLocalHmaMapMetadata([a,b]);
  assert.equal(report.status,'conflicting-declarations');
  assert.equal(report.hierarchy,null);
  assert.equal(report.uniqueDeclarationCount,2);
 });
});
test('CLI invocation produces JSON and nonzero exit for missing anchor',async()=>{
 await withToml(async dir=>{
  const file=join(dir,'other.toml');
  await writeFile(file,'[[NamedAnchors]]\nName="other"\nAddress=0x100\nFormat="[x.]"');
  const p=spawnSync(process.execPath,[script,file],{encoding:'utf8'});
  assert.equal(p.status,2);
  assert.equal(JSON.parse(p.stdout).status,'missing');
  assert.equal(p.stderr,'');
 });
});
test('invalid UTF-8, unknown flags and file budgets fail closed',async()=>{
 await withToml(async dir=>{
  const file=join(dir,'invalid.toml');
  await writeFile(file,Uint8Array.from([0xff,0xfe,0xfd]));
  await assert.rejects(inspectLocalHmaMapMetadata([file]),TypeError);
  assert.throws(()=>parseMapMetadataCliArgs(['--bogus','a.toml']),RangeError);
  assert.throws(()=>parseMapMetadataCliArgs(['--rom-size','-1','a.toml']),RangeError);
  assert.throws(()=>parseMapMetadataCliArgs([]),RangeError);
  await writeFile(file,'x'.repeat(4*1024*1024+1));
  await assert.rejects(inspectLocalHmaMapMetadata([file]),RangeError);
 });
});
