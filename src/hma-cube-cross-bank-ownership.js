/**
 * Bounded CUBE cross-bank map ownership census, read-only.
 * Explicit counts only; partial census cannot prove exclusive ownership.
 * Source: pinned CUBHMA MapModel.cs map pointers and custom layout.
 */
import {inspectHmaCubeMapEntry} from './hma-cube-map-discovery.js';
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';
import {inspectHmaCubeMapConnections} from './hma-cube-map-connections.js';
import {inspectHmaCubeMapScripts} from './hma-cube-map-script-table.js';

function asReader(source) {
  if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
  if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&
     typeof source.read==='function')return source;
  throw new TypeError('Expected a bounded staged ROM reader');
}
function overlaps(a,b) {
  return a.start < b.start+b.size && b.start < a.start+a.size;
}
// Count all structural aliases while retaining a bounded set of findings.
// Focused edit audits do not lose their budget to unrelated map aliases.
function boundedRelationships(claims,{focusMapId=null,maxFindings=1024}={}){
 if(focusMapId!==null&&(typeof focusMapId!=='string'||!/^[0-9]+:[0-9]+$/.test(focusMapId)))
  throw new RangeError('Invalid focused CUBE map identifier');
 if(!Number.isSafeInteger(maxFindings)||maxFindings<1||maxFindings>4096)
  throw new RangeError('Ownership finding budget must be 1–4096');
 const sorted=claims.map((c,i)=>({...c,sequence:i}))
  .sort((a,b)=>a.start-b.start||a.sequence-b.sequence);
 const relationships=[],sameMapRelationships=[];
 let totalRelationshipCount=0,sameMapStructuralOverlapCount=0,crossBankRelationshipCount=0;
 let focusedRelationshipCount=0,focusedSameMapRelationshipCount=0;
 let relationshipFindingsTruncated=false,active=[];
 for(const claim of sorted){
  active=active.filter(other=>other.start+other.size>claim.start);
  for(const other of active){
   if(!overlaps(other,claim))continue;
   const same=other.id===claim.id;
   if(same)sameMapStructuralOverlapCount++;
   else{
    totalRelationshipCount++;
    if(other.id.split(':')[0]!==claim.id.split(':')[0])
     crossBankRelationshipCount++;
   }
   if(focusMapId!==null&&other.id!==focusMapId&&claim.id!==focusMapId)continue;
   if(same)focusedSameMapRelationshipCount++;
   else focusedRelationshipCount++;
   const output=same?sameMapRelationships:relationships;
   if(output.length>=maxFindings){relationshipFindingsTruncated=true;continue;}
   output.push(Object.freeze({
    first:other.id,second:claim.id,firstKind:other.kind,secondKind:claim.kind,
    sameStart:other.start===claim.start,
    overlapStart:Math.max(other.start,claim.start),
    overlapBytes:Math.min(other.start+other.size,claim.start+claim.size)-
     Math.max(other.start,claim.start)
   }));
  }
  active.push(claim);
 }
 return Object.freeze({
  relationships:Object.freeze(relationships),
  sameMapRelationships:Object.freeze(sameMapRelationships),
  totalRelationshipCount,sameMapStructuralOverlapCount,crossBankRelationshipCount,
  focusedRelationshipCount,focusedSameMapRelationshipCount,
  relationshipFindingsTruncated,findingBudgetPerCategory:maxFindings,focusMapId
 });
}
export function auditHmaCubeCrossBankOwnership(source,summary,{banks,includeEvents=false,includeConnections=false,includeMapScripts=false,focusMapId=null,maxFindings=1024}={}) {
  if(typeof includeEvents!=='boolean'||typeof includeConnections!=='boolean'||
     typeof includeMapScripts!=='boolean')
  throw new TypeError('includeEvents, includeConnections and includeMapScripts must be boolean');
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
  const eventIssues=[],connectionIssues=[],mapScriptIssues=[];
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
      if(includeMapScripts){
        try{
          const scripts=inspectHmaCubeMapScripts(rom,summary,{bankIndex,mapIndex,mapCount});
          if(scripts.hasTable){
            claims.push({id,kind:'map-scripts-table',start:scripts.tableOffset,
              size:scripts.tableBytes});
            for(const entry of scripts.entries)if(entry.conditional)
              claims.push({id,kind:'map-scripts-conditions',start:entry.targetOffset,
                size:entry.conditions.length*8+2});
          }
        }catch(error){
          mapScriptIssues.push(Object.freeze({id,bankIndex,mapIndex,
            status:'map-scripts-invalid-or-unsupported',
            reason:error instanceof Error?error.message:'Unknown decoder error'}));
        }
      }
      if(includeConnections){
        try{
          const conn=inspectHmaCubeMapConnections(rom,summary,{bankIndex,mapIndex,mapCount});
          if(conn.connectionsOffset!==null){
            claims.push({id,kind:'connections-group',
              start:conn.connectionsOffset,size:8});
            if(conn.count>0)claims.push({id,kind:'connection-records',
              start:conn.arrayOffset,size:conn.count*12});
          }
        }catch(error){
          connectionIssues.push(Object.freeze({id,bankIndex,mapIndex,
            status:'connections-invalid-or-unsupported',
            reason:error instanceof Error?error.message:'Unknown decoder error'}));
        }
      }
    }catch(_error){
      maps.push(Object.freeze({id,bankIndex,mapIndex,status:'invalid-or-unsupported'}));
    }
  }
  const findings=boundedRelationships(claims,{focusMapId,maxFindings});
  const {relationships,sameMapRelationships}=findings;
  const invalid=maps.filter(m=>m.status!=='decoded').length;
  return Object.freeze({
    requestedBanks:Object.freeze(banks.map(x=>Object.freeze({...x}))),
    requestedMaps:budget,decoded:budget-invalid,invalid,
    maps:Object.freeze(maps),relationships:Object.freeze(relationships),
    includeEvents,eventClaimsInspected:includeEvents?claims.filter(c=>c.kind.startsWith('event')).length:0,
    eventIssues:Object.freeze(eventIssues),
    includeConnections,connectionClaimsInspected:includeConnections?
      claims.filter(c=>c.kind.startsWith('connection')).length:0,
    connectionIssues:Object.freeze(connectionIssues),
    includeMapScripts,mapScriptClaimsInspected:includeMapScripts?
      claims.filter(c=>c.kind.startsWith('map-scripts-')).length:0,
    mapScriptIssues:Object.freeze(mapScriptIssues),
    sameMapRelationships:Object.freeze(sameMapRelationships),
    sameMapStructuralOverlapCount:findings.sameMapStructuralOverlapCount,
    sameMapStructuralAmbiguityDetected:findings.sameMapStructuralOverlapCount>0,
    crossBankRelationshipCount:findings.crossBankRelationshipCount,
    totalRelationshipCount:findings.totalRelationshipCount,
    focusedRelationshipCount:findings.focusedRelationshipCount,
    focusedSameMapRelationshipCount:findings.focusedSameMapRelationshipCount,
    relationshipFindingsTruncated:findings.relationshipFindingsTruncated,
    findingBudgetPerCategory:findings.findingBudgetPerCategory,
    focusMapId,
    completeOwnershipProven:false,partialCoverage:true,
    writeAuthorized:false,readOnly:true,romAuthenticated:false,
    cubeLayoutAuthenticated:false
  });
}
