/**
 * Bounded CUBE cross-bank map ownership census, read-only.
 * Explicit counts only; partial census cannot prove exclusive ownership.
 * Source: pinned CUBHMA MapModel.cs map pointers and custom layout.
 */
import {inspectHmaCubeMapEntry} from './hma-cube-map-discovery.js';
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';

function asReader(source) {
  if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
  if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&
     typeof source.read==='function')return source;
  throw new TypeError('Expected a bounded staged ROM reader');
}
function overlaps(a,b) {
  return a.start < b.start+b.size && b.start < a.start+a.size;
}
export function auditHmaCubeCrossBankOwnership(source,summary,{banks,includeEvents=false}={}) {
  if(typeof includeEvents!=='boolean')throw new TypeError('includeEvents must be boolean');
  const rom=asReader(source);
  if(!Array.isArray(banks)||banks.length<1||banks.length>8)
    throw new RangeError('Provide 1–8 explicitly counted CUBE banks');
  const seen=new Set();
  let budget=0;
  for(const entry of banks){
    if(!entry||!Number.isSafeInteger(entry.bankIndex)||entry.bankIndex<0||
       !Number.isSafeInteger(entry.mapCount)||entry.mapCount<1||entry.mapCount>128)
      throw new RangeError('Each bank needs a nonnegative integer index and 1–128 maps');
    if(seen.has(entry.bankIndex))throw new RangeError('Duplicate CUBE bank index');
    seen.add(entry.bankIndex);budget+=entry.mapCount;
    if(budget>256)throw new RangeError('CUBE census exceeds 256-map budget');
  }
  const maps=[],claims=[];
  const eventIssues=[];
  const widths={objects:24,warps:8,scripts:16,signposts:12};
  for(const {bankIndex,mapCount} of banks)for(let mapIndex=0;mapIndex<mapCount;mapIndex++){
    const id=bankIndex+':'+mapIndex;
    try{
      const map=inspectHmaCubeMapEntry(rom,summary,{bankIndex,mapIndex,mapCount});
      maps.push(Object.freeze({id,bankIndex,mapIndex,status:'decoded',
        headerOffset:map.header.address,layoutOffset:map.layout.address,
        blockmapOffset:map.layout.blockmapOffset,
        blockmapBytes:map.layout.blockmapBytes,
        width:map.layout.width,height:map.layout.height}));
      for(const [kind,start,size] of [
        ['header',map.header.address,28],
        ['layout',map.layout.address,28],
        ['blockmap',map.layout.blockmapOffset,map.layout.blockmapBytes]
      ])claims.push({id,kind,start,size});
      if(includeEvents){
        try{
          const events=inspectHmaCubeMapEventWarps(rom,summary,{bankIndex,mapIndex,mapCount});
          if(events.eventsOffset!==null){
            claims.push({id,kind:'events-group',start:events.eventsOffset,size:20});
            for(const [kind,width] of Object.entries(widths)){
              if(events.counts[kind]>0)
                claims.push({id,kind:'event-'+kind,start:events.offsets[kind],
                  size:events.counts[kind]*width});
            }
          }
        }catch(error){
          eventIssues.push(Object.freeze({id,bankIndex,mapIndex,
            status:'event-arrays-invalid-or-unsupported',
            reason:error instanceof Error?error.message:'Unknown decoder error'}));
        }
      }
    }catch(_error){
      maps.push(Object.freeze({id,bankIndex,mapIndex,status:'invalid-or-unsupported'}));
    }
  }
  const relationships=[],sameMapRelationships=[];
  for(let i=0;i<claims.length;i++)for(let j=i+1;j<claims.length;j++){
    const a=claims[i],b=claims[j];
    if(!overlaps(a,b))continue;
    // Any overlap across different map records is important, even when
    // the records use different semantic kinds.
    const finding=Object.freeze({
      first:a.id,second:b.id,firstKind:a.kind,secondKind:b.kind,
      sameStart:a.start===b.start,
      overlapStart:Math.max(a.start,b.start),
      overlapBytes:Math.min(a.start+a.size,b.start+b.size)-Math.max(a.start,b.start)
    });
    if(a.id===b.id)sameMapRelationships.push(finding);
    else relationships.push(finding);
  }
  const invalid=maps.filter(m=>m.status!=='decoded').length;
  const crossBank=relationships.filter(r=>r.first.split(':')[0]!==r.second.split(':')[0]);
  return Object.freeze({
    requestedBanks:Object.freeze(banks.map(x=>Object.freeze({...x}))),
    requestedMaps:budget,decoded:budget-invalid,invalid,
    maps:Object.freeze(maps),relationships:Object.freeze(relationships),
    includeEvents,eventClaimsInspected:includeEvents?claims.filter(c=>c.kind.startsWith('event')).length:0,
    eventIssues:Object.freeze(eventIssues),
    sameMapRelationships:Object.freeze(sameMapRelationships),
    crossBankRelationshipCount:crossBank.length,
    completeOwnershipProven:false,partialCoverage:true,
    writeAuthorized:false,readOnly:true,romAuthenticated:false,
    cubeLayoutAuthenticated:false
  });
}
