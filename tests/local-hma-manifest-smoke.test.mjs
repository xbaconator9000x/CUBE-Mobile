import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseLocalHmaManifestArgs,inspectLocalHmaManifest}
  from '../scripts/local-hma-manifest-smoke.mjs';

const sha=data=>createHash('sha256').update(data).digest('hex');
async function fixture(){
 const dir=await mkdtemp(join(tmpdir(),'cube-manifest-smoke-'));
 const rom=new Uint8Array(0x200);
 for(const [i,c] of [...'BPEE'].entries())rom[0xAC+i]=c.charCodeAt(0);
 const one=Buffer.from('default\r\n'),two=Buffer.from('overlay\n');
 const romPath=join(dir,'fixture.gba'),first=join(dir,'default.toml'),
  second=join(dir,'cube_emerald.toml'),manifestPath=join(dir,'manifest.json');
 const manifest={romSha256:sha(rom),romLength:rom.length,gameCode:'BPEE',
  revision:0,layout:'custom',sourceCommit:'a'.repeat(40),
  evidenceUrl:'https://github.com/kcradi/CUBHMA/commit/'+'a'.repeat(40),
  files:[{name:'default.toml',length:one.length,sha256:sha(one)},
   {name:'cube_emerald.toml',length:two.length,sha256:sha(two)}]};
 await Promise.all([writeFile(romPath,rom),writeFile(first,one),
  writeFile(second,two),writeFile(manifestPath,JSON.stringify(manifest))]);
 const args=['--rom',romPath,'--manifest',manifestPath,
  '--metadata',first,'--metadata',second];
 return {dir,rom,one,two,manifest,args,romPath,first,second,manifestPath};
}
test('local ordered manifest smoke reports exact match without exporting ROM data',async()=>{
 const f=await fixture();
 try{
  const before=await readFile(f.romPath);
  const result=await inspectLocalHmaManifest(f.args);
  assert.equal(result.status,'exact-file-set-match');
  assert.equal(result.exactFileSetMatch,true);
  assert.equal(result.metadataFilesProvided,2);
  assert.equal(result.independentlyAuthenticated,false);
  assert.equal(result.romModified,false);
  assert.equal(result.romExported,false);
  assert.equal(result.safeSemanticEditingVerified,false);
  const json=JSON.stringify(result);
  for(const sensitive of [f.dir,f.romPath,f.first,f.second,sha(f.rom),sha(f.one),sha(f.two)])
   assert.equal(json.includes(sensitive),false);
  assert.deepEqual(await readFile(f.romPath),before);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('reordered local TOML inputs fail exact order without modifying files',async()=>{
 const f=await fixture();
 try{
  const args=['--rom',f.romPath,'--manifest',f.manifestPath,
   '--metadata',f.second,'--metadata',f.first];
  const result=await inspectLocalHmaManifest(args);
  assert.equal(result.status,'ordered-file-set-mismatch');
  assert.equal(result.exactFileSetMatch,false);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('local file edits and ROM edits fail exact identity',async()=>{
 const f=await fixture();
 try{
  await writeFile(f.second,Buffer.from('changed'));
  assert.equal((await inspectLocalHmaManifest(f.args)).status,'file-byte-mismatch');
  await writeFile(f.second,f.two);
  const changed=f.rom.slice();changed[0x100]=1;
  await writeFile(f.romPath,changed);
  assert.equal((await inspectLocalHmaManifest(f.args)).status,'unknown-rom');
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('malformed and duplicate local arguments are rejected',()=>{
 const args=['--rom','r.gba','--manifest','m.json','--metadata','a.toml'];
 assert.equal(parseLocalHmaManifestArgs(args).metadata.length,1);
 for(const invalid of [
  [],['--rom','r.gba'],[...args,'--rom','again.gba'],
  [...args,'--metadata','folder/a.toml'],
  [...args,'--unexpected','x'],
  ['--rom','r.gba','--manifest','m.json'],
  [...args,'--metadata',''],
  [...args,'--metadata','a.toml','--metadata','a.toml']
 ])assert.throws(()=>parseLocalHmaManifestArgs(invalid),RangeError);
});
test('malformed JSON manifest is rejected before touching ROM bytes',async()=>{
 const f=await fixture();
 try{
  await writeFile(f.manifestPath,'{not valid json');
  await assert.rejects(()=>inspectLocalHmaManifest(f.args),RangeError);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
