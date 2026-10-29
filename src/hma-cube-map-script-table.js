/**
 * Bounded CUBHMA Emerald map-script table and conditional subscript decoder.
 * Source: kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc,
 * Models/Map/MapModel.cs MapFormat mapscripts<[type. pointer<>]!00>
 * and ViewModels/Map/MapScriptCollection.cs.
 *
 * Type 2 and 4 pointers refer to conditional tables of 8-byte entries:
 * variable:u16, value:u16, pointer:u32; terminated by variable 0 or FFFF.
 * Other supported types point at scripts directly. Never execute instructions
 * or assume an in-ROM pointer is a verified executable script.
 */
import {inspectHmaCubeMapEntry} from './hma-cube-map-discovery.js';

function reader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>0&&typeof source.read==='function')return source;
 throw TypeError('Expected bounded ROM reader');
}
function u8(rom,at){
 if(!Number.isSafeInteger(at)||at<0||at>=rom.length)throw RangeError('Map-script read outside ROM');
 const n=rom.read(at);
 if(!Number.isInteger(n)||n<0||n>255)throw RangeError('Invalid ROM accessor byte');
 return n;
}
function u16(rom,at){return u8(rom,at)|(u8(rom,at+1)<<8);}
function u32(rom,at){return (u16(rom,at)|(u16(rom,at+2)<<16))>>>0;}
function pointer(rom,raw,label){
 if(raw<0x08000000||raw>=0x0A000000)
  throw RangeError(label+' is not a conventional GBA ROM pointer');
 const at=raw-0x08000000;
 if(at>=rom.length)throw RangeError(label+' points beyond ROM');
 return at;
}
function budget(n,max,label){
 if(!Number.isSafeInteger(n)||n<1||n>max)
  throw RangeError(label+' must be within 1–'+max);
}
function overlaps(a,n,b,m){return a<b+m&&b<a+n;}
function structuralRanges(map){
 return [[map.header.address,28],[map.layout.address,28],
  [map.layout.blockmapOffset,map.layout.blockmapBytes],
  [map.bankOffset,map.mapCount*4]];
}
/**
 * Read a 5-byte, zero-terminated map-script list and bounded 8-byte
 * conditional tables. Refuse missing terminators, unsupported types,
 * self-overlapping tables and out-of-ROM pointers.
 */
export function inspectHmaCubeMapScripts(source,summary,{
 bankIndex,mapIndex,mapCount,maxEntries=64,maxConditions=64
}={}){
 budget(maxEntries,64,'Map-script entry budget');
 budget(maxConditions,64,'Conditional-script entry budget');
 const rom=reader(source),map=inspectHmaCubeMapEntry(rom,summary,{bankIndex,mapIndex,mapCount});
 const start=map.header.scriptsOffset;
 if(start===null)return Object.freeze({
  bankIndex,mapIndex,mapCount,hasTable:false,entries:Object.freeze([]),
  scriptEntries:0,conditionalTableCount:0,conditionalEntries:0,
  terminated:true,readOnly:true,romAuthenticated:false,
  scriptSemanticsVerified:false,writeAuthorized:false
 });
 const rawEntries=[];let terminatorOffset=null;
 for(let i=0;i<=maxEntries;i++){
  const at=start+i*5;
  const type=u8(rom,at);
  if(type===0){terminatorOffset=at;break;}
  if(i===maxEntries)throw RangeError('Map-script table has no zero terminator within budget');
  if(type>7)throw RangeError('Unsupported CUBHMA map-script type');
  const rawPointer=u32(rom,at+1);
  rawEntries.push({index:i,type,sourceOffset:at,pointerSource:at+1,
   rawPointer,targetOffset:pointer(rom,rawPointer,'Map-script target'),
   conditional:type===2||type===4});
 }
 if(terminatorOffset===null)
  throw RangeError('Map-script table has no zero terminator within budget');
 const tableBytes=terminatorOffset-start+1;
 for(const [at,size] of structuralRanges(map))
  if(overlaps(start,tableBytes,at,size))
   throw RangeError('Map-script table overlaps known map structure');
 const entries=[];let conditionalTableCount=0,conditionalEntries=0;
 for(const entry of rawEntries){
  const conditions=[];
  if(entry.conditional){
   conditionalTableCount++;
   const conditionStart=entry.targetOffset;
   let terminated=false;
   for(let i=0;i<=maxConditions;i++){
    const at=conditionStart+i*8,variable=u16(rom,at);
    if(variable===0||variable===0xffff){terminated=true;break;}
    if(i===maxConditions)throw RangeError('Conditional map-script table has no terminator within budget');
    const value=u16(rom,at+2),rawPointer=u32(rom,at+4);
    conditions.push(Object.freeze({index:i,sourceOffset:at,
     variable,value,rawPointer,targetOffset:pointer(rom,rawPointer,'Conditional script target')}));
   }
   if(!terminated)throw RangeError('Conditional map-script table has no terminator within budget');
   const usedBytes=conditions.length*8+2;
   if(overlaps(conditionStart,usedBytes,start,tableBytes)||
      structuralRanges(map).some(([at,size])=>overlaps(conditionStart,usedBytes,at,size)))
    throw RangeError('Conditional map-script table overlaps known map structure');
   conditionalEntries+=conditions.length;
  }
  entries.push(Object.freeze({...entry,conditions:Object.freeze(conditions),
   scriptInstructionsDecoded:false}));
 }
 return Object.freeze({bankIndex,mapIndex,mapCount,hasTable:true,
  tableOffset:start,tableBytes,terminatorOffset,
  entries:Object.freeze(entries),scriptEntries:entries.length,
  conditionalTableCount,conditionalEntries,terminated:true,
  readOnly:true,romAuthenticated:false,scriptSemanticsVerified:false,
  scriptInstructionsDecoded:false,writeAuthorized:false});
}

/**
 * Bounded raw script-pointer reference index for a single declared CUBE map.
 * This is NOT an opcode decoder, interpreter, global pointer graph or
 * permission to relocate/repoint scripts. Exact pointer sources are retained.
 */
export function inspectHmaCubeMapScriptReferences(source,summary,options={}){
 const maxReferences=options.maxReferences??256;
 if(!Number.isSafeInteger(maxReferences)||maxReferences<1||maxReferences>4096)
  throw new RangeError('Script reference finding budget must be 1–4096');
 const report=inspectHmaCubeMapScripts(source,summary,options);
 if(!report.hasTable)return Object.freeze({
  bankIndex:report.bankIndex,mapIndex:report.mapIndex,mapCount:report.mapCount,
  references:Object.freeze([]),totalReferenceCount:0,
  referenceFindingsTruncated:false,aliasGroups:Object.freeze([]),
  structuralTargetWarnings:Object.freeze([]),readOnly:true,
  romAuthenticated:false,scriptSemanticsVerified:false,writeAuthorized:false
 });
 const map=inspectHmaCubeMapEntry(reader(source),summary,options);
 const ranges=[
  ...structuralRanges(map).map(([start,size],i)=>({start,size,
   kind:['map-header','map-layout','blockmap','bank-map-pointers'][i]})),
  {start:report.tableOffset,size:report.tableBytes,kind:'map-script-table'}
 ];
 const all=[];
 for(const entry of report.entries){
  if(entry.conditional){
   const size=entry.conditions.length*8+2;
   ranges.push({start:entry.targetOffset,size,kind:'conditional-script-table'});
   all.push({kind:'conditional-table',entryIndex:entry.index,
    conditionIndex:null,pointerSource:entry.pointerSource,
    rawPointer:entry.rawPointer,targetOffset:entry.targetOffset});
   for(const condition of entry.conditions)all.push({
    kind:'conditional-script',entryIndex:entry.index,
    conditionIndex:condition.index,pointerSource:condition.sourceOffset+4,
    rawPointer:condition.rawPointer,targetOffset:condition.targetOffset
   });
  }else all.push({kind:'direct-script',entryIndex:entry.index,
   conditionIndex:null,pointerSource:entry.pointerSource,
   rawPointer:entry.rawPointer,targetOffset:entry.targetOffset});
 }
 all.sort((a,b)=>a.pointerSource-b.pointerSource||a.targetOffset-b.targetOffset);
 const groups=new Map(),warnings=[];
 for(const ref of all){
  const category=ref.kind==='conditional-table'?'table':'script';
  const key=category+':'+ref.targetOffset;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(ref);
  if(category==='script')for(const range of ranges)
   if(ref.targetOffset>=range.start&&ref.targetOffset<range.start+range.size)
    warnings.push(Object.freeze({
     pointerSource:ref.pointerSource,targetOffset:ref.targetOffset,
     entryIndex:ref.entryIndex,conditionIndex:ref.conditionIndex,
     overlaps:range.kind
    }));
 }
 const aliasGroups=[...groups].filter(([,refs])=>refs.length>1).map(([key,refs])=>
  Object.freeze({category:key.split(':')[0],targetOffset:refs[0].targetOffset,
   referenceCount:refs.length,pointerSources:Object.freeze(refs.map(r=>r.pointerSource))}));
 return Object.freeze({
  bankIndex:report.bankIndex,mapIndex:report.mapIndex,mapCount:report.mapCount,
  references:Object.freeze(all.slice(0,maxReferences).map(ref=>Object.freeze(ref))),
  totalReferenceCount:all.length,referenceFindingsTruncated:all.length>maxReferences,
  aliasGroups:Object.freeze(aliasGroups),
  structuralTargetWarnings:Object.freeze(warnings),
  rawPointerSourcesVerified:true,readOnly:true,
  romAuthenticated:false,scriptSemanticsVerified:false,
  scriptInstructionsDecoded:false,exclusiveOwnershipProven:false,
  writeAuthorized:false
 });
}
