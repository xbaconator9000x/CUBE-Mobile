/**
 * Optional second, ordered TOML claim in a locally supplied ROM profile.
 * This does NOT extend the curated registry, authenticate a CUBE build,
 * or grant semantic write access. Source: pinned CUBHMA StoredMetadata
 * overlays (kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc).
 *
 * The legacy metadataSha256 still binds the first file; metadataFiles
 * explicitly binds every file, in order. No concatenated hash shortcuts.
 */
const SHA=/^[a-f0-9]{64}$/i;
const NAME=/^[A-Za-z0-9][A-Za-z0-9._-]{0,249}\.toml$/i;
export function validateLocalOrderedProfileOverlay(profile){
 if(!profile||typeof profile!=='object'||Array.isArray(profile))
  throw new RangeError('Invalid local ROM profile');
 if(!Object.hasOwn(profile,'metadataFiles'))return null;
 const entries=profile.metadataFiles;
 if(!Array.isArray(entries)||entries.length<1||entries.length>16)
  throw new RangeError('Invalid ordered profile metadata files');
 const names=new Set();let total=0;
 const files=entries.map(file=>{
  if(!file||typeof file!=='object'||Array.isArray(file)||
    typeof file.name!=='string'||!NAME.test(file.name)||file.name.includes('..')||
    !Number.isSafeInteger(file.length)||file.length<1||file.length>4*1024*1024||
    typeof file.sha256!=='string'||!SHA.test(file.sha256))
   throw new RangeError('Invalid ordered profile metadata file');
  const name=file.name.toLowerCase();
  if(names.has(name))throw new RangeError('Duplicate ordered profile metadata filename');
  names.add(name);total+=file.length;
  if(total>16*1024*1024)throw new RangeError('Ordered profile metadata exceeds limit');
  return Object.freeze({name:file.name,length:file.length,sha256:file.sha256.toLowerCase()});
 });
 if(typeof profile.metadataSha256!=='string'||
   files[0].sha256!==profile.metadataSha256.toLowerCase())
  throw new RangeError('Legacy first-file profile digest conflicts with ordered metadata');
 return Object.freeze(files);
}
export function compareLocalOrderedProfileOverlay(files,manifest,records){
 if(!Array.isArray(files)||!manifest||!Array.isArray(manifest.files)||
   !Array.isArray(records))
  throw new RangeError('Invalid ordered overlay comparison');
 const same=(a,b)=>a.name===b.name&&a.length===b.length&&a.sha256===b.sha256.toLowerCase();
 let status;
 if(files.length!==manifest.files.length||files.length!==records.length||
    files.some((f,i)=>f.name!==manifest.files[i].name||f.name!==records[i].name))
  status='profile-ordered-file-set-mismatch';
 else if(files.some((f,i)=>!same(f,manifest.files[i])||!same(f,records[i])))
  status='profile-ordered-file-byte-mismatch';
 else status='consistent-ordered-byte-claims';
 return Object.freeze({status,consistentExactByteClaims:status==='consistent-ordered-byte-claims',
  independentlyAuthenticated:false,metadataAuthenticated:false,
  cubeLayoutAuthenticated:false,semanticWritesAllowed:false,readOnly:true});
}
