/**
 * Read-only CUBE Emerald custom map connections.
 * Pinned upstream: kcradi/CUBHMA 3044393183e01af2ae1e907fb37e4a75eda6a8dc
 * MapModel.cs ConnectionsFormat and QuickEditItems/cube_emerald.toml.
 * No automatic destination count discovery or gameplay traversal assertions.
 */
import {inspectHmaCubeMapEntry} from './hma-cube-map-discovery.js';

function accessor(source) {
  if (source instanceof Uint8Array) return {length:source.length,read:i=>source[i]};
  if (source && Number.isSafeInteger(source.length) && source.length>=0 &&
      typeof source.read==='function') return source;
  throw new TypeError('Expected bounded read-only ROM accessor');
}
function byte(rom,at) {
  const value=rom.read(at);
  if (!Number.isInteger(value)||value<0||value>255)
    throw new RangeError('Invalid staged ROM byte');
  return value;
}
function word(rom,at) {return byte(rom,at)|(byte(rom,at+1)<<8);}
function dword(rom,at) {return (word(rom,at)|(word(rom,at+2)<<16))>>>0;}
function span(rom,at,size,label) {
  if (!Number.isSafeInteger(at)||at<0||at%4!==0||
      !Number.isSafeInteger(size)||size<1||at>rom.length-size)
    throw new RangeError(label+' outside aligned ROM bounds');
}
function intersects(a,al,b,bl) {return a<b+bl&&b<a+al;}
function assertDisjoint(at,size,claims,label) {
  for (const c of claims) if (intersects(at,size,c.at,c.size))
    throw new RangeError(label+' overlaps '+c.label);
}
export function inspectHmaCubeMapConnections(source,summary,options) {
  const rom=accessor(source),map=inspectHmaCubeMapEntry(rom,summary,options);
  const at=map.header.connectionsOffset,empty=Object.freeze([]);
  if (at===null) return Object.freeze({map,connectionsOffset:null,arrayOffset:null,
    count:0,connections:empty,readOnly:true,romAuthenticated:false,
    cubeLayoutAuthenticated:false,writeAuthorized:false});
  const claims=[
    {at:summary.declarations[0].address,size:map.declaredBankCount*4,label:'bank table'},
    {at:map.bankOffset,size:map.mapCount*4,label:'bank map pointers'},
    {at:map.header.address,size:28,label:'map header'},
    {at:map.layout.address,size:28,label:'map layout'},
    {at:map.layout.blockmapOffset,size:map.layout.blockmapBytes,label:'blockmap'}
  ];
  span(rom,at,8,'Connection header');
  assertDisjoint(at,8,claims,'Connection header');
  claims.push({at,size:8,label:'connection header'});
  const count=dword(rom,at),raw=dword(rom,at+4);
  if (count>1024) throw new RangeError('Connection count exceeds 1024-record cap');
  let arrayOffset=null;
  const connections=[];
  if (count) {
    if (raw<0x08000000||raw>=0x0A000000)
      throw new RangeError('Connection array is not a conventional GBA ROM pointer');
    arrayOffset=raw-0x08000000;
    span(rom,arrayOffset,count*12,'Connection array');
    assertDisjoint(arrayOffset,count*12,claims,'Connection array');
    for (let i=0;i<count;i++) {
      const offset=arrayOffset+i*12,displacement=dword(rom,offset+4);
      connections.push(Object.freeze({
        index:i,offset,direction:dword(rom,offset),
        rawDisplacement:displacement,displacement:displacement|0,
        targetBank:byte(rom,offset+8),targetMap:byte(rom,offset+9),
        unused:word(rom,offset+10)
      }));
    }
  }
  return Object.freeze({map,connectionsOffset:at,arrayOffset,count,
    connections:Object.freeze(connections),readOnly:true,romAuthenticated:false,
    cubeLayoutAuthenticated:false,writeAuthorized:false});
}
