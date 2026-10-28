/**
 * Exact, ordered multi-file HMA TOML manifest evidence. Pinned upstream
 * kcradi/CUBHMA StoredMetadata and stock metadata overlays load separate
 * files; hashing a concatenation or one overlay is not equivalent.
 *
 * No manifest is bundled without independent source/ROM verification.
 * Even a matching caller-supplied manifest NEVER authorizes ROM writes.
 */
import {compareRomMetadataFingerprintRecords} from './metadata-fingerprint.js';

export const CURATED_HMA_METADATA_MANIFESTS=Object.freeze([]);
const SHA=/^[0-9a-f]{64}$/i;
const COMMIT=/^[0-9a-f]{40}$/i;
const GAME=/^[A-Z0-9]{4}$/;
const NAME=/^[A-Za-z0-9][A-Za-z0-9._-]{0,249}\.toml$/i;
const MAX_FILE=4*1024*1024,MAX_TOTAL=16*1024*1024;

export function validateHmaMetadataManifests(manifests){
  if(!Array.isArray(manifests)||manifests.length>128)
    throw new RangeError('Invalid ordered HMA metadata manifest registry');
  const seenRoms=new Set();
  return Object.freeze(manifests.map((entry,index)=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry)||
       typeof entry.romSha256!=='string'||!SHA.test(entry.romSha256)||
       !Number.isSafeInteger(entry.romLength)||entry.romLength<0xC0||
       entry.romLength>128*1024*1024||
       !GAME.test(entry.gameCode)||
       !Number.isInteger(entry.revision)||entry.revision<0||entry.revision>255||
       !['stock','expansion','custom'].includes(entry.layout)||
       typeof entry.sourceCommit!=='string'||!COMMIT.test(entry.sourceCommit)||
       typeof entry.evidenceUrl!=='string'||
       !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:blob|commit)\/[a-f0-9]{40}(?:\/[^\s]*)?$/i.test(entry.evidenceUrl)||
       !Array.isArray(entry.files)||entry.files.length<1||entry.files.length>16)
      throw new RangeError('Invalid ordered metadata manifest at index '+index);
    const romSha256=entry.romSha256.toLowerCase();
    if(seenRoms.has(romSha256))
      throw new RangeError('Duplicate ROM identity in ordered manifest registry');
    seenRoms.add(romSha256);
    const names=new Set();let total=0;
    const files=entry.files.map((file,order)=>{
      if(!file||typeof file!=='object'||Array.isArray(file)||
         typeof file.name!=='string'||!NAME.test(file.name)||
         file.name.includes('..')||
         typeof file.sha256!=='string'||!SHA.test(file.sha256)||
         !Number.isSafeInteger(file.length)||file.length<1||file.length>MAX_FILE)
        throw new RangeError('Invalid ordered metadata file at '+index+':'+order);
      const key=file.name.toLowerCase();
      if(names.has(key))throw new RangeError('Duplicate ordered metadata filename');
      names.add(key);total+=file.length;
      if(total>MAX_TOTAL)throw new RangeError('Ordered metadata exceeds size budget');
      return Object.freeze({name:file.name,length:file.length,sha256:file.sha256.toLowerCase()});
    });
    return Object.freeze({romSha256,romLength:entry.romLength,
      gameCode:entry.gameCode,revision:entry.revision,layout:entry.layout,
      sourceCommit:entry.sourceCommit.toLowerCase(),
      evidenceUrl:entry.evidenceUrl,files:Object.freeze(files)});
  }));
}

/**
 * Compares the live ROM and cached exact-file SHA-256 records with an ordered
 * manifest. This is an identity check, not proof of CUBE layout semantics.
 * Imported manifests are untrusted, and the bundled curated registry is empty.
 */
export function compareHmaMetadataManifest(model,romFingerprint,metadataFingerprints,
  {manifests=CURATED_HMA_METADATA_MANIFESTS}={}){
  const registry=validateHmaMetadataManifests(manifests);
  const checked=compareRomMetadataFingerprintRecords(model,romFingerprint,
    metadataFingerprints,{profiles:[]});
  const files=checked.metadataFiles;
  const base={metadataFiles:files,readOnly:true,metadataAuthenticated:false,
    cubeLayoutAuthenticated:false,semanticWritesAllowed:false,
    independentlyAuthenticated:false,curatedManifest:false};
  if(checked.status==='stale')
    return Object.freeze({...base,status:'stale',exactFileSetMatch:null,manifest:null});
  const digest=romFingerprint.sha256.toLowerCase();
  const manifest=registry.find(m=>m.romSha256===digest&&m.romLength===model.length);
  if(!manifest)
    return Object.freeze({...base,status:'unknown-rom',exactFileSetMatch:null,manifest:null});
  const code=Array.from({length:4},(_,i)=>String.fromCharCode(model.read(0xAC+i))).join('');
  if(manifest.gameCode!==code||manifest.revision!==model.read(0xBC))
    return Object.freeze({...base,status:'rom-header-conflict',exactFileSetMatch:null,manifest:null});
  const publicManifest=Object.freeze({romSha256:manifest.romSha256,
    romLength:manifest.romLength,gameCode:manifest.gameCode,revision:manifest.revision,
    layout:manifest.layout,sourceCommit:manifest.sourceCommit,evidenceUrl:manifest.evidenceUrl,
    fileCount:manifest.files.length});
  if(!files.length)
    return Object.freeze({...base,status:'metadata-missing',exactFileSetMatch:null,
      manifest:publicManifest});
  const sameOrder=files.length===manifest.files.length&&
    files.every((file,i)=>file.name===manifest.files[i].name);
  if(!sameOrder)
    return Object.freeze({...base,status:'ordered-file-set-mismatch',exactFileSetMatch:false,
      manifest:publicManifest});
  const match=files.every((file,i)=>file.length===manifest.files[i].length&&
    file.sha256===manifest.files[i].sha256);
  return Object.freeze({...base,status:match?'exact-file-set-match':'file-byte-mismatch',
    exactFileSetMatch:match,manifest:publicManifest});
}
