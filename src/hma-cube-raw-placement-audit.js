/**
 * Read-only CUBE Emerald destination-cell diagnostics.
 * Reports raw six-bit blockmap values and event co-location, NEVER
 * inferred walkability or collision legality.
 */
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';

function reader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>0&&
    typeof source.read==='function')return source;
 throw new TypeError('Expected bounded ROM reader');
}
function byte(rom,i){
 if(!Number.isSafeInteger(i)||i<0||i>=rom.length)
  throw RangeError('Raw destination cell outside ROM');
 const n=rom.read(i);
 if(!Number.isInteger(n)||n<0||n>255)
  throw RangeError('Invalid ROM accessor byte');
 return n;
}
const kinds=['objects','warps','scripts','signposts'];
export function auditHmaCubeRawPlacements(source,summary,{
 bankIndex,mapIndex,mapCount,placements
}={}){
 const rom=reader(source);
 if(!Array.isArray(placements)||placements.length<1||placements.length>64)
  throw RangeError('Provide 1–64 proposed CUBE event placements');
 const events=inspectHmaCubeMapEventWarps(rom,summary,{bankIndex,mapIndex,mapCount});
 const layout=events.map.layout,seen=new Set(),proposedCounts=new Map(),results=[];
 for(const placement of placements){
  if(!placement||!kinds.includes(placement.kind)||
     !Number.isSafeInteger(placement.index)||placement.index<0||
     placement.index>=events.arrays[placement.kind].length||
     !Number.isSafeInteger(placement.x)||!Number.isSafeInteger(placement.y)||
     placement.x<0||placement.y<0||
     placement.x>=layout.width||placement.y>=layout.height)
   throw RangeError('Invalid proposed event identity or coordinates');
  const id=placement.kind+':'+placement.index;
  if(seen.has(id))throw RangeError('Duplicate proposed event identity');
  seen.add(id);
  const key=placement.x+':'+placement.y;
  proposedCounts.set(key,(proposedCounts.get(key)||0)+1);
 }
 for(const placement of placements){
  const offset=layout.blockmapOffset+
   2*(placement.y*layout.width+placement.x);
  const raw=byte(rom,offset)|(byte(rom,offset+1)<<8);
  const occupants=[];
  for(const [kind,records] of Object.entries(events.arrays))
   for(const record of records)
    if(!(kind===placement.kind&&record.index===placement.index)&&
       record.x===placement.x&&record.y===placement.y)
     occupants.push(Object.freeze({kind,index:record.index,sourceOffset:record.offset}));
  results.push(Object.freeze({
   kind:placement.kind,index:placement.index,x:placement.x,y:placement.y,
   blockmapByteOffset:offset,rawWord:raw,tileId:raw&1023,
   rawHighBits:raw>>>10,sourceOccupants:Object.freeze(occupants),
   proposedAtSameCell:proposedCounts.get(placement.x+':'+placement.y),
   collisionSemanticsVerified:false,walkabilityVerified:false
  }));
 }
 return Object.freeze({
  bankIndex,mapIndex,mapCount,
  placements:Object.freeze(results),
  nonzeroRawHighBits:results.filter(r=>r.rawHighBits!==0).length,
  sourceColocations:results.filter(r=>r.sourceOccupants.length).length,
  proposedColocations:results.filter(r=>r.proposedAtSameCell>1).length,
  rawOnly:true,readOnly:true,romAuthenticated:false,
  collisionSemanticsVerified:false,walkabilityVerified:false,
  exclusiveOwnershipProven:false,writeAuthorized:false
 });
}
