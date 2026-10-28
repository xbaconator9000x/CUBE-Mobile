/**
 * Read-only CUBE custom map event group and raw warp inspection.
 * Pinned CUBHMA MapModel.cs EventsFormat/WarpsFormat and cube_emerald.toml
 * at 3044393183e01af2ae1e907fb37e4a75eda6a8dc.
 * No game reachability, walkability or ROM authenticity is inferred.
 */
import {inspectHmaCubeMapEntry} from './hma-cube-map-discovery.js';

const definitions=Object.freeze([
  Object.freeze({name:'objects',size:24,index:0}),
  Object.freeze({name:'warps',size:8,index:1}),
  Object.freeze({name:'scripts',size:16,index:2}),
  Object.freeze({name:'signposts',size:12,index:3})
]);
function reader(source){
  if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
  if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&typeof source.read==='function')return source;
  throw new TypeError('Expected bounded staged ROM reader');
}
function byte(rom,i){
  const n=rom.read(i);
  if(!Number.isInteger(n)||n<0||n>255)throw new RangeError('Invalid staged ROM byte');
  return n;
}
function u16(rom,i){return byte(rom,i)|(byte(rom,i+1)<<8);}
function u32(rom,i){return (u16(rom,i)|(u16(rom,i+2)<<16))>>>0;}
function span(rom,start,size,label,alignment=4){
  if(!Number.isSafeInteger(start)||start<0||start%alignment||
     !Number.isSafeInteger(size)||size<1||start>rom.length-size)
    throw new RangeError(label+' exceeds ROM bounds or alignment');
}
function intersects(a,as,b,bs){return a<b+bs&&b<a+as;}
function checkClaims(start,size,claims,label){
  for(const claim of claims)
    if(intersects(start,size,claim.start,claim.size))
      throw new RangeError(label+' overlaps '+claim.name);
}
function pointer(rom,raw,size,label){
  if(raw<0x08000000||raw>=0x0A000000)
    throw new RangeError(label+' is not a conventional GBA pointer');
  const target=raw-0x08000000;
  span(rom,target,size,label);
  return target;
}
export function inspectHmaCubeMapEventWarps(source,summary,options){
  const rom=reader(source);
  const map=inspectHmaCubeMapEntry(rom,summary,options);
  const {header,layout}=map;
  const empty=Object.freeze([]);
  if(header.eventsOffset===null)return Object.freeze({
    map,eventsOffset:null,counts:Object.freeze({objects:0,warps:0,scripts:0,signposts:0}),
    offsets:Object.freeze({objects:null,warps:null,scripts:null,signposts:null}),
    warps:empty,readOnly:true,romAuthenticated:false,
    cubeLayoutAuthenticated:false,writeAuthorized:false
  });
  const eventsOffset=header.eventsOffset;
  span(rom,eventsOffset,20,'CUBE events group');
  const bankTableStart=summary.declarations[0].address;
  const claims=[
    {start:bankTableStart,size:map.declaredBankCount*4,name:'declared bank table'},
    {start:map.bankOffset,size:map.mapCount*4,name:'bank map pointers'},
    {start:header.address,size:28,name:'map header'},
    {start:layout.address,size:28,name:'map layout'},
    {start:layout.blockmapOffset,size:layout.blockmapBytes,name:'blockmap'}
  ];
  checkClaims(eventsOffset,20,claims,'Events group');
  claims.push({start:eventsOffset,size:20,name:'events group'});
  const counts={},offsets={};
  for(const def of definitions){
    const count=byte(rom,eventsOffset+def.index);
    const raw=u32(rom,eventsOffset+4+def.index*4);
    counts[def.name]=count;
    if(count===0){offsets[def.name]=null;continue;}
    const length=count*def.size;
    const offset=pointer(rom,raw,length,def.name+' event array');
    checkClaims(offset,length,claims,def.name+' event array');
    claims.push({start:offset,size:length,name:def.name+' event array'});
    offsets[def.name]=offset;
  }
  const warps=[];
  if(offsets.warps!==null)for(let i=0;i<counts.warps;i++){
    const at=offsets.warps+i*8,x=u16(rom,at),y=u16(rom,at+2);
    const targetMap=byte(rom,at+6),targetBank=byte(rom,at+7);
    warps.push(Object.freeze({index:i,offset:at,x,y,elevation:byte(rom,at+4),
      warpId:byte(rom,at+5),targetMap,targetBank,
      outsideDeclaredMap:x>=layout.width||y>=layout.height,
      specialTarget:targetMap===255||targetBank===255}));
  }
  return Object.freeze({map,eventsOffset,counts:Object.freeze(counts),
    offsets:Object.freeze(offsets),warps:Object.freeze(warps),
    readOnly:true,romAuthenticated:false,cubeLayoutAuthenticated:false,
    walkabilityVerified:false,writeAuthorized:false});
}
