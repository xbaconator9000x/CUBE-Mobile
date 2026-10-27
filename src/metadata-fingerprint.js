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
export function compareRomMetadataIdentity(model,romFingerprint,metadataFiles,
  {profiles=CURATED_ROM_PROFILES}={}){
  const rom=compareRomIdentity(model,romFingerprint,{profiles});
  const files=fingerprintMetadataFiles(metadataFiles);
  let metadataExactMatch=null,metadataBindingStatus='rom-unverified';
  if(rom.status==='profile-match'){
    if(!files.length)metadataBindingStatus='metadata-missing';
    else if(files.length!==1)metadataBindingStatus='multi-file-manifest-required';
    else{
      metadataExactMatch=files[0].sha256===rom.profile.metadataSha256;
      metadataBindingStatus=metadataExactMatch?'exact-byte-match':'digest-mismatch';
    }
  }
  return Object.freeze({...rom,metadataFiles:files,metadataExactMatch,
    metadataBindingStatus,metadataAuthenticated:false,semanticWritesAllowed:false});
}
