/**
 * Explicit read-only vanilla RSE/FRLG map atlas.
 * Upstream: kcradi/CUBHMA MapModel.cs AllMapsModel/MapBankModel.
 * Counts come from the user, never inferred from headers or sentinel scans.
 * This does not authenticate CUBE expansion layouts or permit ROM writes.
 */
import {inspectVanillaMapBankEntry} from './map-discovery.js';

export function parseVanillaBankMapCounts(text) {
 if(typeof text!=='string'||!/^\s*\d+(?:\s*[,\s]\s*\d+)*\s*$/.test(text))
  throw new RangeError('Enter comma-separated decimal map counts, one per bank');
 const parts=text.trim().split(/[\s,]+/);
 if(parts.length<1||parts.length>256)throw new RangeError('Declare 1–256 vanilla banks');
 const counts=parts.map(Number);
 if(counts.some(n=>!Number.isSafeInteger(n)||n<1||n>1024))
  throw new RangeError('Each declared bank must have 1–1024 maps');
 return Object.freeze(counts);
}
export function inspectVanillaMapAtlas(source,{address,bankMapCounts,family,maxMaps=4096}={}) {
 if(!Array.isArray(bankMapCounts)||bankMapCounts.length<1||bankMapCounts.length>256)
  throw new RangeError('Explicit map counts required for 1–256 banks');
 if(!Number.isSafeInteger(maxMaps)||maxMaps<1||maxMaps>4096)
  throw new RangeError('Atlas map limit must be 1–4096');
 let total=0;
 for(const n of bankMapCounts){
  if(!Number.isSafeInteger(n)||n<1||n>1024)
   throw new RangeError('Each declared bank must have 1–1024 maps');
  total+=n;
  if(total>maxMaps)throw new RangeError('Declared map catalog exceeds bounded map limit');
 }
 const maps=[],banks=[];
 for(let bankIndex=0;bankIndex<bankMapCounts.length;bankIndex++){
  const mapCount=bankMapCounts[bankIndex];
  const first=inspectVanillaMapBankEntry(source,{address,bankCount:bankMapCounts.length,
   bankIndex,mapCount,mapIndex:0,family});
  for(const bank of banks){
   if(first.bankOffset<bank.bankOffset+bank.mapCount*4 &&
      bank.bankOffset<first.bankOffset+mapCount*4)
    throw new RangeError('Declared map-bank pointer arrays overlap');
  }
  banks.push(Object.freeze({bankIndex,mapCount,bankOffset:first.bankOffset,
   bankPointerSource:first.bankPointerSource}));
  for(let mapIndex=0;mapIndex<mapCount;mapIndex++){
   const result=mapIndex===0?first:inspectVanillaMapBankEntry(source,{
    address,bankCount:bankMapCounts.length,bankIndex,mapCount,mapIndex,family});
   maps.push(Object.freeze({bankIndex,mapIndex,mapHeaderOffset:result.mapHeaderOffset,
    mapPointerSource:result.mapPointerSource,layoutOffset:result.header.layoutOffset,
    blockmapOffset:result.header.layout.blockmapOffset,width:result.header.layout.width,
    height:result.header.layout.height}));
  }
 }
 return Object.freeze({address,family,bankMapCounts:Object.freeze([...bankMapCounts]),
  bankCount:banks.length,mapCount:maps.length,banks:Object.freeze(banks),
  maps:Object.freeze(maps),readOnly:true,layoutAuthenticated:false});
}
export function lookupVanillaMapAtlasTarget(atlas,bankIndex,mapIndex) {
 if(!atlas||!Array.isArray(atlas.maps))throw new TypeError('Expected inspected atlas');
 if(!Number.isSafeInteger(bankIndex)||!Number.isSafeInteger(mapIndex)||
    bankIndex<0||mapIndex<0)return null;
 return atlas.maps.find(m=>m.bankIndex===bankIndex&&m.mapIndex===mapIndex)||null;
}
