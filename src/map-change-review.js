/**
 * Immutable, bounded review of multiple proposed vanilla byte changes.
 * Accepts only the shapes emitted by the existing blockmap/warp/event
 * preview helpers. It is NOT a writer, relocation engine or ROM authenticator.
 */
function reviewReader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&
    typeof source.read==='function')return source;
 throw new TypeError('Expected ROM bytes or staged read-only accessor');
}
function reviewBytes(value,length,label){
 if(!Array.isArray(value)||value.length!==length||
    value.some(n=>!Number.isInteger(n)||n<0||n>255))
  throw new TypeError(label+' must be '+length+' exact bytes');
 return value;
}
function previewShape(preview){
 if(!preview||preview.previewOnly!==true||preview.readOnly!==true||
    preview.writeAuthorized!==false||preview.layoutAuthenticated!==false)
  throw new TypeError('Expected an unauthenticated immutable vanilla change preview');
 if(Number.isSafeInteger(preview.byteOffset)&&preview.before?.bytes&&preview.after?.bytes)
  return {kind:'blockmap',offset:preview.byteOffset,length:2,
   before:preview.before.bytes,after:preview.after.bytes};
 if(Number.isSafeInteger(preview.recordOffset)&&Array.isArray(preview.before)&&
    Array.isArray(preview.after)){
  if(Number.isSafeInteger(preview.warpIndex)&&preview.before.length===8)
   return {kind:'warp',offset:preview.recordOffset,length:8,
    before:preview.before,after:preview.after};
  if(['objects','scripts','signposts'].includes(preview.kind)){
   const sizes={objects:24,scripts:16,signposts:12};
   if(preview.recordLength!==sizes[preview.kind])throw new RangeError('Event record length mismatch');
   return {kind:preview.kind,offset:preview.recordOffset,length:sizes[preview.kind],
    before:preview.before,after:preview.after};
  }
 }
 throw new TypeError('Unsupported vanilla preview shape');
}
/**
 * Re-check every expected original byte and reject overlapping proposals.
 * No ROM mutation, save/export or semantic write permission is possible here.
 */
export function reviewVanillaChangeSet(source,previews,{
 maxChanges=64,maxBytes=2048
}={}){
 const rom=reviewReader(source);
 if(!Array.isArray(previews)||previews.length<1||
    !Number.isSafeInteger(maxChanges)||maxChanges<1||maxChanges>256||
    previews.length>maxChanges)
  throw new RangeError('Provide 1–256 bounded proposed changes');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>8192)
  throw new RangeError('Total byte limit must be 1–8192');
 const spans=[];let totalBytes=0,changedBytes=0;
 for(const [index,preview] of previews.entries()){
  const p=previewShape(preview);
  if(!Number.isSafeInteger(p.offset)||p.offset<0||
     p.offset>rom.length-p.length)
   throw new RangeError('Proposed record extends outside ROM');
  reviewBytes(p.before,p.length,'Original record');
  reviewBytes(p.after,p.length,'Proposed record');
  totalBytes+=p.length;
  if(totalBytes>maxBytes)throw new RangeError('Change review exceeds byte limit');
  for(let i=0;i<p.length;i++){
   const actual=rom.read(p.offset+i);
   if(!Number.isInteger(actual)||actual<0||actual>255)
    throw new RangeError('Invalid staged ROM byte');
   if(actual!==p.before[i])
    throw new RangeError('Original ROM bytes changed; rebuild the previews');
   if(p.after[i]!==p.before[i])changedBytes++;
  }
  spans.push({index,...p});
 }
 spans.sort((a,b)=>a.offset-b.offset||a.index-b.index);
 for(let i=1;i<spans.length;i++)
  if(spans[i].offset<spans[i-1].offset+spans[i-1].length)
   throw new RangeError('Proposed ROM byte ranges overlap; resolve conflict before reviewing');
 const entries=spans.map(p=>Object.freeze({
  sourceIndex:p.index,kind:p.kind,offset:p.offset,length:p.length,
  changed:p.after.some((n,i)=>n!==p.before[i]),
  before:Object.freeze([...p.before]),after:Object.freeze([...p.after])
 }));
 return Object.freeze({
  count:entries.length,totalBytes,changedBytes,
  entries:Object.freeze(entries),readOnly:true,previewOnly:true,
  writeAuthorized:false,layoutAuthenticated:false,
  ownershipVerified:false,transactionCommitted:false
 });
}
