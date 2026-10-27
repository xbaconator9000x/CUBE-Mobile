import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTrackedPath,detectCredentialSignature,auditTrackedFiles} from '../scripts/repository-safety.mjs';
test('rejects ROMs, saves, patches, archives, keys, APKs and env files',()=>{
 for(const name of ['game.gba','save.sav','patch.bps','rom.zip','app.apk','cert.pem','.env','config/.env.local','../secret.txt'])
  assert.throws(()=>validateTrackedPath(name));
 assert.equal(validateTrackedPath('src/map-atlas.js'),true);
});
test('detects secret-like credentials without embedding real secrets',()=>{
 assert.equal(detectCredentialSignature('ghp_'+('A'.repeat(36))),true);
 assert.equal(detectCredentialSignature('-----BEGIN PRIVATE KEY-----'),true);
 assert.equal(detectCredentialSignature('This is a sample documentation line.'),false);
});
test('inspects tracked files and fails on credential patterns and oversized entries',()=>{
 const ok=()=>({isFile:()=>true,size:12});
 assert.equal(auditTrackedFiles(['src/a.js'],()=>Buffer.from('safe'),ok),1);
 assert.throws(()=>auditTrackedFiles(['src/a.js'],()=>Buffer.from('ghp_'+('A'.repeat(36))),ok),/Credential/);
 assert.throws(()=>auditTrackedFiles(['src/a.js'],()=>Buffer.from('safe'),()=>({isFile:()=>true,size:5000000})),/oversized/);
});
