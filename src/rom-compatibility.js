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
