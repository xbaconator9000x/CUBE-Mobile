/**
 * Byte-exact, immutable proposed coordinate/elevation changes for vanilla
 * object, script-trigger and signpost records.
 * Pinned kcradi/CUBHMA MapModel.cs: ObjectsFormat, ScriptsFormat,
 * SignpostsFormat. Never edits ROM bytes or authenticates CUBE layouts.
 */
import {inspectVanillaMapEvents} from './map-events.js';
import {inspectVanillaMapHeader} from './map-layouts.js';
const definitions=Object.freeze({
 objects:Object.freeze({size:24,pointerField:4,fields:Object.freeze({
  x:[4,2,65535],y:[6,2,65535],elevation:[8,1,255]})}),
 scripts:Object.freeze({size:16,pointerField:12,fields:Object.freeze({
  x:[0,2,65535],y:[2,2,65535],elevation:[4,2,65535]})}),
 signposts:Object.freeze({size:12,pointerField:16,fields:Object.freeze({
  x:[0,2,65535],y:[2,2,65535],elevation:[4,1,255]})})
});
function byte(source,i){
 const n=source instanceof Uint8Array?source[i]:source.read(i);
 if(!Number.isInteger(n)||n<0||n>255)
  throw new RangeError('Invalid staged ROM byte');
 return n;
}
export function previewVanillaEventCoordinateChange(source,{
 address,family,kind,index,changes,expectedBytes
}={}){
 const def=definitions[kind];
 if(!def)throw new RangeError('Select objects, scripts or signposts');
 const header=inspectVanillaMapHeader(source,{address,family});
 const events=inspectVanillaMapEvents(source,{address,family});
 const records=events.arrays[kind];
 if(!Number.isSafeInteger(index)||index<0||index>=records.length)
  throw new RangeError('Event index outside inspected vanilla map');
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||
    Object.keys(changes).length===0)
  throw new TypeError('Specify at least one coordinate or elevation field');
 for(const name of Object.keys(changes)){
  if(!Object.hasOwn(def.fields,name))
   throw new RangeError('Unsupported event field: '+name);
  const max=def.fields[name][2],n=changes[name];
  if(!Number.isSafeInteger(n)||n<0||n>max)
   throw new RangeError(name+' must be an integer from 0 to '+max);
 }
 if(changes.x!==undefined&&changes.x>=header.layout.width||
    changes.y!==undefined&&changes.y>=header.layout.height)
  throw new RangeError('Proposed event coordinates outside selected map');
 const record=records[index],offset=record.offset;
 const before=Object.freeze(Array.from({length:def.size},(_,i)=>byte(source,offset+i)));
 if(expectedBytes!==undefined){
  if(!Array.isArray(expectedBytes)||expectedBytes.length!==def.size||
     expectedBytes.some(n=>!Number.isInteger(n)||n<0||n>255))
   throw new TypeError('Expected original bytes must match complete record length');
  if(expectedBytes.some((n,i)=>n!==before[i]))
   throw new RangeError('Event bytes changed since selection; preview again');
 }
 const after=[...before];
 for(const name of Object.keys(changes)){
  const [start,size]=def.fields[name],n=changes[name];
  for(let i=0;i<size;i++)after[start+i]=(n>>>(8*i))&255;
 }
 const x=changes.x??record.x,y=changes.y??record.y;
 return Object.freeze({
  headerOffset:address,eventsOffset:events.eventsOffset,
  arrayOffset:events.offsets[kind],arrayPointerSource:events.eventsOffset+def.pointerField,
  kind,index,recordOffset:offset,recordLength:def.size,
  before,after:Object.freeze(after),changed:after.some((n,i)=>n!==before[i]),
  original:Object.freeze({x:record.x,y:record.y,elevation:record.elevation}),
  proposed:Object.freeze({x,y,elevation:changes.elevation??record.elevation}),
  originalCoordinatesInMap:record.x<header.layout.width&&record.y<header.layout.height,
  proposedCoordinatesInMap:x<header.layout.width&&y<header.layout.height,
  readOnly:true,previewOnly:true,writeAuthorized:false,
  layoutAuthenticated:false,ownershipVerified:false
 });
}
