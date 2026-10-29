import {fingerprintMatchesRom} from './rom-fingerprint.js';

/**
 * Independently verified exact-ROM profiles belong here ONLY after provenance,
 * ROM SHA-256, and exact compatible metadata SHA-256 are established.
 * An empty registry is intentional: no CUBE binary has been authenticated.
 * Never populate from a ROM header, filename, TOML marker or user-supplied hash.
 */
export const CURATED_ROM_PROFILES=Object.freeze([]);
const SHA256=/^[0-9a-f]{64}$/i;
const COMMIT=/^[0-9a-f]{40}$/i;
const GAME_CODE=/^[A-Z0-9]{4}$/;

/** Validate the complete registry before using any record; duplicates fail closed. */
export function validateRomProfileRegistry(profiles){
  if(!Array.isArray(profiles)||profiles.length>1024)
    throw Error('Invalid ROM profile registry');
  const seen=new Set();
  return profiles.map((entry,index)=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry)||
       typeof entry.sha256!=='string'||!SHA256.test(entry.sha256)||
       !Number.isSafeInteger(entry.length)||entry.length<0xC0||entry.length>128*1024*1024||
       !GAME_CODE.test(entry.gameCode)||
       !Number.isInteger(entry.revision)||entry.revision<0||entry.revision>255||
       !['stock','expansion','custom'].includes(entry.layout)||
       typeof entry.metadataSha256!=='string'||!SHA256.test(entry.metadataSha256)||
       typeof entry.sourceCommit!=='string'||!COMMIT.test(entry.sourceCommit)||
       typeof entry.evidenceUrl!=='string'||!/^https:\/\/[^\s/]+\/\S+$/.test(entry.evidenceUrl))
      throw Error('Invalid exact ROM profile at index '+index);
    const sha256=entry.sha256.toLowerCase(),metadataSha256=entry.metadataSha256.toLowerCase();
    if(seen.has(sha256))throw Error('Duplicate exact ROM SHA-256 in profile registry');
    seen.add(sha256);
    return Object.freeze({sha256,length:entry.length,gameCode:entry.gameCode,
      revision:entry.revision,layout:entry.layout,metadataSha256,
      sourceCommit:entry.sourceCommit.toLowerCase(),evidenceUrl:entry.evidenceUrl});
  });
}

/**
 * Read-only identity comparison. A pasted expected digest is USER-SUPPLIED
 * evidence, not proof of a trusted CUBE build. A caller-injected registry is
 * also untrusted. Neither permits semantic writes or metadata relocation.
 */
export function compareRomIdentity(model,fingerprint,{expectedSha256='',profiles=CURATED_ROM_PROFILES}={}){
  const entries=validateRomProfileRegistry(profiles);
  if(typeof expectedSha256!=='string')throw Error('Expected SHA-256 must be text');
  const expected=expectedSha256.trim().toLowerCase();
  if(expected&&!SHA256.test(expected))throw Error('Expected SHA-256 must be exactly 64 hexadecimal characters');
  if(!fingerprintMatchesRom(model,fingerprint))
    return {status:'stale',expectedMatch:null,profile:null,curated:false,
      metadataAuthenticated:false,semanticWritesAllowed:false};
  if(typeof fingerprint.sha256!=='string'||!SHA256.test(fingerprint.sha256)||
     fingerprint.length!==model.length)
    throw Error('Invalid ROM fingerprint result');
  const sha256=fingerprint.sha256.toLowerCase();
  const matched=entries.find(entry=>entry.sha256===sha256&&entry.length===model.length);
  const gameCode=Array.from({length:4},(_,i)=>String.fromCharCode(model.read(0xAC+i))).join('');
  const revision=model.read(0xBC);
  const headerMatches=!!matched&&matched.gameCode===gameCode&&matched.revision===revision;
  return {
    status:matched?(headerMatches?'profile-match':'profile-conflict'):'unknown',
    expectedMatch:expected?sha256===expected:null,
    profile:headerMatches?matched:null,
    curated:headerMatches&&profiles===CURATED_ROM_PROFILES,
    metadataAuthenticated:false,
    semanticWritesAllowed:false
  };
}


/**
 * Cross-check two separately validated *claims* about the same ROM and
 * ordered TOML evidence. The manifest's file set is checked by
 * compareHmaMetadataManifest before calling this helper. This only detects
 * contradictory declarations; it never establishes independent provenance.
 *
 * A single-file profile digest cannot authenticate an ordered multi-file
 * metadata overlay. Do not silently treat the first file as the whole set.
 */
export function compareRomProfileManifestClaims(profile,manifest,metadataFiles){
  const [p]=validateRomProfileRegistry([profile]);
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||
     typeof manifest.romSha256!=='string'||!SHA256.test(manifest.romSha256)||
     !Number.isSafeInteger(manifest.romLength)||
     !GAME_CODE.test(manifest.gameCode)||
     !Number.isInteger(manifest.revision)||manifest.revision<0||manifest.revision>255||
     !['stock','expansion','custom'].includes(manifest.layout)||
     typeof manifest.sourceCommit!=='string'||!COMMIT.test(manifest.sourceCommit)||
     !Number.isSafeInteger(manifest.fileCount)||manifest.fileCount<1||manifest.fileCount>16||
     !Array.isArray(metadataFiles)||metadataFiles.length!==manifest.fileCount||
     metadataFiles.some(f=>!f||typeof f.sha256!=='string'||!SHA256.test(f.sha256)||
       !Number.isSafeInteger(f.length)||f.length<1))
    throw new RangeError('Invalid cross-source ROM/metadata evidence');
  let status;
  if(p.sha256!==manifest.romSha256.toLowerCase()||
     p.length!==manifest.romLength||p.gameCode!==manifest.gameCode||
     p.revision!==manifest.revision)
    status='rom-identity-conflict';
  else if(p.layout!==manifest.layout)
    status='layout-conflict';
  else if(p.sourceCommit!==manifest.sourceCommit.toLowerCase())
    status='source-revision-conflict';
  else if(metadataFiles.length!==1)
    status='multi-file-profile-unbound';
  else if(p.metadataSha256!==metadataFiles[0].sha256.toLowerCase())
    status='profile-metadata-digest-conflict';
  else status='consistent-exact-byte-claims';
  return Object.freeze({status,
    consistentExactByteClaims:status==='consistent-exact-byte-claims',
    independentlyAuthenticated:false,metadataAuthenticated:false,
    cubeLayoutAuthenticated:false,semanticWritesAllowed:false,readOnly:true});
}
