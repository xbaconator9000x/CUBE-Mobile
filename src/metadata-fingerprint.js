import {StreamingSha256} from './rom-fingerprint.js';
import {compareRomIdentity,CURATED_ROM_PROFILES} from './rom-compatibility.js';

/**
 * Exact-byte identity for locally loaded HMA/CUBHMA TOML files.
 *
 * Do NOT hash decoded text, normalise line endings, remove a UTF-8 BOM, or
 * concatenate several files: each changes the bytes whose identity matters.
 * A profile's singular metadataSha256 can bind only ONE exact file. Upstream
 * often loads several TOML files; those require a future authenticated manifest.
 */
const MAX_FILES=16;
const MAX_FILE_BYTES=4*1024*1024;
const MAX_TOTAL_BYTES=16*1024*1024;

export function fingerprintMetadataFiles(files){
  if(!Array.isArray(files)||files.length>MAX_FILES)
    throw Error('Invalid metadata file collection');
  const names=new Set(),result=[];
  let total=0;
  for(const file of files){
    if(!file||typeof file!=='object'||Array.isArray(file)||
       typeof file.name!=='string'||!file.name.trim()||
       file.name.length>255||file.name.includes('\0')||
       !(file.bytes instanceof Uint8Array)||
       file.bytes.length<1||file.bytes.length>MAX_FILE_BYTES)
      throw Error('Invalid metadata file for exact SHA-256');
    if(names.has(file.name))throw Error('Duplicate metadata filename');
    names.add(file.name);
    total+=file.bytes.length;
    if(total>MAX_TOTAL_BYTES)throw Error('Metadata files exceed total size limit');
    const hasher=new StreamingSha256();
    hasher.update(file.bytes);
    result.push(Object.freeze({
      name:file.name,length:file.bytes.length,sha256:hasher.digestHex()
    }));
  }
  return Object.freeze(result);
}

/**
 * Read-only two-part identity check. The ROM must match a profile's full SHA,
 * size and header before its metadata digest is even compared. The current
 * registry is empty. Caller-injected profiles and matching hashes NEVER
 * authorize editing, relocation, or claims that the metadata was parsed safely.
 */
/** Compare previously hashed metadata records without retaining raw TOML bytes. */
export function compareRomMetadataFingerprintRecords(model,romFingerprint,metadataFingerprints,
  {profiles=CURATED_ROM_PROFILES}={}){
  if(!Array.isArray(metadataFingerprints)||metadataFingerprints.length>MAX_FILES)
    throw Error('Invalid metadata fingerprint collection');
  const names=new Set(),files=[];
  let total=0;
  for(const entry of metadataFingerprints){
    if(!entry||typeof entry!=='object'||Array.isArray(entry)||
       typeof entry.name!=='string'||!entry.name.trim()||
       entry.name.length>255||entry.name.includes('\0')||
       !Number.isSafeInteger(entry.length)||entry.length<1||entry.length>MAX_FILE_BYTES||
       typeof entry.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(entry.sha256)||
       names.has(entry.name))
      throw Error('Invalid exact metadata fingerprint record');
    names.add(entry.name);
    total+=entry.length;
    if(total>MAX_TOTAL_BYTES)throw Error('Metadata fingerprints exceed total size limit');
    files.push(Object.freeze({name:entry.name,length:entry.length,sha256:entry.sha256.toLowerCase()}));
  }
  const rom=compareRomIdentity(model,romFingerprint,{profiles});
  let metadataExactMatch=null,metadataBindingStatus='rom-unverified';
  if(rom.status==='profile-match'){
    if(!files.length)metadataBindingStatus='metadata-missing';
    else if(files.length!==1)metadataBindingStatus='multi-file-manifest-required';
    else{
      metadataExactMatch=files[0].sha256===rom.profile.metadataSha256;
      metadataBindingStatus=metadataExactMatch?'exact-byte-match':'digest-mismatch';
    }
  }
  return Object.freeze({...rom,metadataFiles:Object.freeze(files),metadataExactMatch,
    metadataBindingStatus,metadataAuthenticated:false,semanticWritesAllowed:false});
}

/** Exact raw-byte wrapper for callers that still hold their imported files. */
export function compareRomMetadataIdentity(model,romFingerprint,metadataFiles,
  {profiles=CURATED_ROM_PROFILES}={}){
  return compareRomMetadataFingerprintRecords(model,romFingerprint,
    fingerprintMetadataFiles(metadataFiles),{profiles});
}
