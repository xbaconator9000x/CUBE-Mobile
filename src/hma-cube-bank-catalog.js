/**
 * Bounded read-only CUBE Emerald map catalog from an explicitly supplied
 * bank map count. Pinned CUBHMA MapModel.cs and cube_emerald.toml.
 * Invalid individual maps do not hide other valid map entries.
 * This is not discovery of dynamic counts or ROM authentication.
 */
import {inspectHmaCubeMapEntry} from './hma-cube-map-discovery.js';
import {inspectHmaDeclaredBankPointerTable} from './hma-map-bank-declared-table.js';
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';
import {inspectHmaCubeMapConnections} from './hma-cube-map-connections.js';

function reader(source) {
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&
    typeof source.read==='function')return source;
 throw new TypeError('Expected a bounded staged ROM reader');
}
function groupAliases(rows,key) {
 const groups=new Map();
 for(const row of rows){
  if(row.status!=='decoded')continue;
  const offset=row[key];
  const group=groups.get(offset)||[];
  group.push(row.index);groups.set(offset,group);
 }
 return groups;
}
export function inspectHmaCubeBankCatalog(source,summary,{bankIndex,mapCount}={}){
 const rom=reader(source);
 if(!Number.isSafeInteger(mapCount)||mapCount<1||mapCount>128)
  throw new RangeError('Explicit CUBE catalog map count must be 1–128');
 const table=inspectHmaDeclaredBankPointerTable(rom,summary);
 if(!Number.isSafeInteger(bankIndex)||bankIndex<0||bankIndex>=table.declaredBankCount)
  throw new RangeError('CUBE bank index outside declared table');
 const rows=[];
 for(let index=0;index<mapCount;index++){
  const opts={bankIndex,mapIndex:index,mapCount};
  try{
   const map=inspectHmaCubeMapEntry(rom,summary,opts);
   const row={index,status:'decoded',headerOffset:map.header.address,
    layoutOffset:map.layout.address,blockmapOffset:map.layout.blockmapOffset,
    width:map.layout.width,height:map.layout.height,layoutId:map.header.layoutId,
    regionSectionId:map.header.regionSectionId,
    eventStatus:'unavailable',connectionStatus:'unavailable',
    events:null,connections:null};
   try{
    const events=inspectHmaCubeMapEventWarps(rom,summary,opts);
    row.eventStatus='decoded';row.events=events.counts;
   }catch(_error){row.eventStatus='invalid-or-unsupported';}
   try{
    const connections=inspectHmaCubeMapConnections(rom,summary,opts);
    row.connectionStatus='decoded';row.connections=connections.count;
   }catch(_error){row.connectionStatus='invalid-or-unsupported';}
   rows.push(row);
  }catch(_error){
   rows.push({index,status:'invalid-or-unsupported'});
  }
 }
 const headers=groupAliases(rows,'headerOffset'),layouts=groupAliases(rows,'layoutOffset'),
  blocks=groupAliases(rows,'blockmapOffset');
 const result=Object.freeze(rows.map(row=>{
  if(row.status!=='decoded')return Object.freeze(row);
  return Object.freeze({...row,events:Object.freeze({...row.events}),
   sameBankHeaderAliases:Object.freeze([...headers.get(row.headerOffset)]),
   sameBankLayoutAliases:Object.freeze([...layouts.get(row.layoutOffset)]),
   sameBankBlockmapAliases:Object.freeze([...blocks.get(row.blockmapOffset)])});
 }));
 const valid=result.filter(row=>row.status==='decoded').length;
 return Object.freeze({bankIndex,mapCount,declaredBankCount:table.declaredBankCount,
  decoded:valid,invalid:mapCount-valid,rows:result,
  explicitCountRequired:true,otherBankOwnershipUnknown:true,
  readOnly:true,romAuthenticated:false,cubeLayoutAuthenticated:false,
  writeAuthorized:false});
}
