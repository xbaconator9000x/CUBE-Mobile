import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseLocalHmaManifestArgs,inspectLocalHmaManifest}
 from '../scripts/local-hma-manifest-smoke.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const cli=fileURLToPath(new URL('../scripts/local-hma-manifest-smoke.mjs',import.meta.url));
async function fixture(run){
 const dir=await mkdtemp(join(tmpdir(),'cube-rom-cross-'));
 const rom=Buffer.alloc(0x400);
 for(const [i,c] of [...'BPEE'].entries())rom[0xAC+i]=c.charCodeAt(0);
 const metadata=Buffer.from('[[NamedAnchors]]\nName = "test"\nAddress = 0x100\n');
 const commit='a'.repeat(40),url='https://github.com/kcradi/CUBHMA/commit/'+commit;
 const romPath=join(dir,'owned.gba'),tomlPath=join(dir,'default.toml'),
  manifestPath=join(dir,'manifest.json'),profilePath=join(dir,'profile.json');
 const manifest={romSha256:sha(rom),romLength:rom.length,gameCode:'BPEE',
  revision:0,layout:'custom',sourceCommit:commit,evidenceUrl:url,
  files:[{name:'default.toml',length:metadata.length,sha256:sha(metadata)}]};
 const profile={sha256:sha(rom),length:rom.length,gameCode:'BPEE',
  revision:0,layout:'custom',metadataSha256:sha(metadata),
  sourceCommit:commit,evidenceUrl:url};
 await Promise.all([writeFile(romPath,rom),writeFile(tomlPath,metadata),
  writeFile(manifestPath,JSON.stringify(manifest)),
  writeFile(profilePath,JSON.stringify(profile))]);
 const args=['--rom',romPath,'--manifest',manifestPath,
  '--metadata',tomlPath,'--profile',profilePath];
 try{await run({dir,rom,metadata,romPath,tomlPath,manifestPath,profilePath,
  manifest,profile,args});}
 finally{await rm(dir,{recursive:true,force:true});}
}
test('local single-file ROM and TOML profile claims agree but never authenticate writes',async()=>{
 await fixture(async f=>{
  const before=await readFile(f.romPath);
  const result=await inspectLocalHmaManifest(f.args);
  assert.equal(result.status,'exact-file-set-match');
  assert.equal(result.crossSourceStatus,'consistent-exact-byte-claims');
  assert.equal(result.crossSourceClaimsConsistent,true);
  assert.equal(result.separateProfileProvided,true);
  assert.equal(result.independentlyAuthenticated,false);
  assert.equal(result.safeSemanticEditingVerified,false);
  assert.deepEqual(await readFile(f.romPath),before);
  const json=JSON.stringify(result);
  for(const secret of [f.dir,sha(f.rom),sha(f.metadata),f.romPath])
   assert.equal(json.includes(secret),false);
 });
});
test('legacy one-file profile cannot bind an ordered multi-file overlay',async()=>{
 await fixture(async f=>{
  const second=join(f.dir,'overlay.toml'),bytes=Buffer.from('overlay\n');
  await writeFile(second,bytes);
  const manifest={...f.manifest,files:[...f.manifest.files,
   {name:'overlay.toml',length:bytes.length,sha256:sha(bytes)}]};
  await writeFile(f.manifestPath,JSON.stringify(manifest));
  const args=[...f.args,'--metadata',second];
  const result=await inspectLocalHmaManifest(args);
  assert.equal(result.status,'exact-file-set-match');
  assert.equal(result.crossSourceStatus,'multi-file-profile-unbound');
  assert.equal(result.crossSourceClaimsConsistent,false);
  await assert.rejects(inspectLocalHmaManifest([...args,'--target-words','1']),
   /Cross-source/);
 });
});
test('contradictory profile layout and metadata digest are explicitly rejected',async()=>{
 await fixture(async f=>{
  await writeFile(f.profilePath,JSON.stringify({...f.profile,layout:'stock'}));
  assert.equal((await inspectLocalHmaManifest(f.args)).crossSourceStatus,'layout-conflict');
  await writeFile(f.profilePath,JSON.stringify({...f.profile,metadataSha256:'0'.repeat(64)}));
  assert.equal((await inspectLocalHmaManifest(f.args)).crossSourceStatus,
   'profile-metadata-digest-conflict');
 });
});
test('unknown ROM profile never becomes independent authentication',async()=>{
 await fixture(async f=>{
  await writeFile(f.profilePath,JSON.stringify({...f.profile,sha256:'0'.repeat(64)}));
  const result=await inspectLocalHmaManifest(f.args);
  assert.equal(result.crossSourceStatus,'rom-profile-unavailable');
  assert.equal(result.independentlyAuthenticated,false);
 });
});
test('reject symlinked ROM, TOML, manifest and profile paths',async()=>{
 await fixture(async f=>{
  for(const path of [f.romPath,f.tomlPath,f.manifestPath,f.profilePath]){
   const alias=join(f.dir,'alias-'+path.split('/').pop());
   await symlink(path,alias);
   const args=f.args.map(value=>value===path?alias:value);
   await assert.rejects(inspectLocalHmaManifest(args),/symlink/i);
  }
 });
});
test('invalid optional profile, aliases and malformed JSON fail closed',async()=>{
 await fixture(async f=>{
  assert.equal(parseLocalHmaManifestArgs(f.args).profile,f.profilePath);
  assert.throws(()=>parseLocalHmaManifestArgs([...f.args,'--profile',f.profilePath]),RangeError);
  assert.throws(()=>parseLocalHmaManifestArgs(f.args.map(value=>
   value===f.profilePath?f.manifestPath:value)),RangeError);
  await writeFile(f.profilePath,'{not-json');
  await assert.rejects(inspectLocalHmaManifest(f.args),/UTF-8 JSON/);
 });
});
test('CLI reports only aggregate statuses and never prints local paths or digests',async()=>{
 await fixture(async f=>{
  const run=spawnSync(process.execPath,[cli,...f.args],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const report=JSON.parse(run.stdout);
  assert.equal(report.crossSourceStatus,'consistent-exact-byte-claims');
  for(const privateValue of [f.dir,sha(f.rom),sha(f.metadata)])
   assert.equal(run.stdout.includes(privateValue),false);
 });
});


test('local two-file profile binds every TOML overlay without authenticating writes',async()=>{
 await fixture(async f=>{
  const second=join(f.dir,'overlay.toml'),bytes=Buffer.from('[[NamedAnchors]]\\nName = "overlay"\\n');
  await writeFile(second,bytes);
  const manifest={...f.manifest,files:[...f.manifest.files,
   {name:'overlay.toml',length:bytes.length,sha256:sha(bytes)}]};
  const profile={...f.profile,metadataFiles:manifest.files};
  await writeFile(f.manifestPath,JSON.stringify(manifest));
  await writeFile(f.profilePath,JSON.stringify(profile));
  const args=[...f.args,'--metadata',second];
  const before=await readFile(f.romPath);
  const ok=await inspectLocalHmaManifest(args);
  assert.equal(ok.status,'exact-file-set-match');
  assert.equal(ok.orderedProfileProvided,true);
  assert.equal(ok.crossSourceStatus,'consistent-ordered-byte-claims');
  assert.equal(ok.crossSourceClaimsConsistent,true);
  assert.equal(ok.independentlyAuthenticated,false);
  assert.equal(ok.safeSemanticEditingVerified,false);
  assert.deepEqual(await readFile(f.romPath),before);
  const text=JSON.stringify(ok);
  for(const secret of [f.dir,sha(f.rom),sha(f.metadata),sha(bytes)])
   assert.equal(text.includes(secret),false);
  const reordered=await inspectLocalHmaManifest([...f.args,'--metadata',second]);
  assert.equal(reordered.crossSourceStatus,'consistent-ordered-byte-claims');
  await writeFile(f.profilePath,JSON.stringify({...profile,
   metadataFiles:[manifest.files[0],{...manifest.files[1],sha256:'f'.repeat(64)}]}));
  const mismatch=await inspectLocalHmaManifest(args);
  assert.equal(mismatch.crossSourceStatus,'profile-ordered-file-byte-mismatch');
  await assert.rejects(inspectLocalHmaManifest([...args,'--target-words','1']),/Cross-source/);
 });
});
