/**
 * Immutable, byte-exact preview of a vanilla eight-byte warp record.
 * Pinned CUBHMA MapModel.cs WarpsFormat: x:y:elevation:warpID:map:bank.
 * Never writes a ROM; never authenticates CUBE layout or runtime behavior.
 */
import {inspectVanillaMapEvents} from './map-events.js';
import {inspectVanillaMapHeader} from './map-layouts.js';
const fields=Object.freeze({x:[0,2,65535],y:[2,2,65535],
 elevation:[4,1,255],warpId:[5,1,255],targetMap:[6,1,255],targetBank:[7,1,255]});
function checkedByte(source,at) {
 const value=source instanceof Uint8Array?source[at]:source.read(at);
 if(!Number.isInteger(value)||value<0||value>255)
  throw new RangeError('Invalid staged ROM byte');
 return value;
}
export function previewVanillaWarpRecordChange(source,{
 address,family,warpIndex,changes,expectedBytes
}={}) {
 const header=inspectVanillaMapHeader(source,{address,family});
 const events=inspectVanillaMapEvents(source,{address,family});
 if(!Number.isSafeInteger(warpIndex)||warpIndex<0||warpIndex>=events.arrays.warps.length)
  throw new RangeError('Warp index is outside inspected vanilla map');
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||
    !Object.keys(changes).length)
  throw new TypeError('Specify at least one warp field to preview');
 const names=Object.keys(changes);
 for(const name of names) {
  if(!Object.hasOwn(fields,name))throw new RangeError('Unsupported warp field: '+name);
  const n=changes[name],max=fields[name][2];
  if(!Number.isSafeInteger(n)||n<0||n>max)
   throw new RangeError(name+' must be an integer from 0 to '+max);
 }
 if(changes.x!==undefined&&changes.x>=header.layout.width||
    changes.y!==undefined&&changes.y>=header.layout.height)
  throw new RangeError('Proposed warp coordinates are outside selected map');
 const record=events.arrays.warps[warpIndex],offset=record.offset;
 const before=Object.freeze(Array.from({length:8},(_,i)=>checkedByte(source,offset+i)));
 if(expectedBytes!==undefined){
  if(!Array.isArray(expectedBytes)||expectedBytes.length!==8||
     expectedBytes.some(n=>!Number.isInteger(n)||n<0||n>255))
   throw new TypeError('Expected original bytes must be an eight-byte array');
  if(expectedBytes.some((n,i)=>n!==before[i]))
   throw new RangeError('Warp bytes changed since selection; preview again');
 }
 const after=[...before];
 for(const name of names){
  const [start,size]=fields[name],n=changes[name];
  for(let i=0;i<size;i++)after[start+i]=(n>>>(8*i))&255;
 }
 return Object.freeze({
  headerOffset:address,eventsOffset:events.eventsOffset,warpIndex,
  recordOffset:offset,before,after:Object.freeze(after),
  changed:after.some((n,i)=>n!==before[i]),
  proposed:Object.freeze({...changes}),
  originalCoordinatesInMap:record.x<header.layout.width&&record.y<header.layout.height,
  readOnly:true,previewOnly:true,writeAuthorized:false,
  layoutAuthenticated:false,runtimeBehaviorVerified:false,ownershipVerified:false
 });
}
