/**
 * Bounded read-only census of RAW vanilla map-cell high bits.
 * Source: pinned CUBHMA MapModel.BlockCells (word & 0x3ff, word >> 10).
 * No high-bit value is interpreted as passability, collision semantics,
 * CUBE compatibility, or permission to write ROM bytes.
 */
import {inspectVanillaMapBankEntry} from './map-discovery.js';
import {summarizeBlockmapChunk} from './map-blocks.js';

export function auditVanillaAtlasRawCells(source,atlas,{
 maxMaps=256,maxUniqueCells=131072,maxRows=64,chunkSize=4096
}={}){
 if(!(source instanceof Uint8Array)&&!(source&&
   Number.isSafeInteger(source.length)&&source.length>=0&&
   typeof source.read==='function'))
  throw new TypeError('Expected ROM bytes or a read-only ROM accessor');
 if(!atlas||atlas.readOnly!==true||atlas.layoutAuthenticated!==false||
   !['RSE','FRLG'].includes(atlas.family)||!Array.isArray(atlas.maps)||
   !Array.isArray(atlas.bankMapCounts)||!Number.isSafeInteger(atlas.address)||
   atlas.address<0||atlas.address%4||
   atlas.bankMapCounts.length<1||atlas.bankMapCounts.length>256||
   atlas.bankMapCounts.some(n=>!Number.isSafeInteger(n)||n<1||n>1024)||
   atlas.bankMapCounts.reduce((a,b)=>a+b,0)!==atlas.maps.length)
  throw new TypeError('Explicit read-only vanilla atlas required');
 if(!Number.isSafeInteger(maxMaps)||maxMaps<1||maxMaps>4096||
   !Number.isSafeInteger(maxUniqueCells)||maxUniqueCells<1||
   maxUniqueCells>1048576||!Number.isSafeInteger(maxRows)||
   maxRows<1||maxRows>256||!Number.isSafeInteger(chunkSize)||
   chunkSize<1||chunkSize>4096)
  throw new RangeError('Invalid bounded raw-cell census limits');
 if(atlas.maps.length>maxMaps)
  throw new RangeError('Atlas exceeds raw-cell map budget; no partial result');
 const ranges=new Map(),records=[];
 let expectedBank=0,expectedMap=0,uniqueCells=0,logicalCells=0;
 // Validate every canonical pointer and budget BEFORE reading cell data.
 for(const m of atlas.maps){
  if(!m||m.bankIndex!==expectedBank||m.mapIndex!==expectedMap)
   throw new RangeError('Declared atlas map order changed');
  expectedMap++;
  if(expectedMap===atlas.bankMapCounts[expectedBank]){
   expectedBank++;expectedMap=0;
  }
  const c=inspectVanillaMapBankEntry(source,{
   address:atlas.address,bankCount:atlas.bankMapCounts.length,
   bankIndex:m.bankIndex,mapCount:atlas.bankMapCounts[m.bankIndex],
   mapIndex:m.mapIndex,family:atlas.family
  });
  if(m.mapPointerSource!==c.mapPointerSource||
    m.mapHeaderOffset!==c.mapHeaderOffset||
    m.layoutOffset!==c.header.layoutOffset||
    m.blockmapOffset!==c.header.layout.blockmapOffset||
    m.width!==c.header.layout.width||m.height!==c.header.layout.height)
   throw new RangeError('Declared atlas map pointer or layout changed');
  const cells=m.width*m.height,start=m.blockmapOffset,end=start+cells*2;
  if(!Number.isSafeInteger(end)||end>source.length)
   throw new RangeError('Declared blockmap exceeds ROM bounds');
  const key=start+':'+cells;
  for(const other of ranges.values()){
   if(other.key!==key&&start<other.end&&other.start<end)
    throw new RangeError('Partially overlapping blockmaps require independent ownership review');
  }
  if(!ranges.has(key)){
   uniqueCells+=cells;
   if(uniqueCells>maxUniqueCells)
    throw new RangeError('Unique cell budget exceeded; no partial result');
   ranges.set(key,{key,start,end,width:m.width,height:m.height,cells,
    references:0,flags:null,nonzero:0});
  }
  const span=ranges.get(key);
  if(span.width!==m.width||span.height!==m.height)
   throw new RangeError('Shared blockmap has conflicting dimensions');
  span.references++;
  logicalCells+=cells;
  records.push({bankIndex:m.bankIndex,mapIndex:m.mapIndex,span});
 }
 const flags=new Array(64).fill(0);
 for(const span of ranges.values()){
  span.flags=new Array(64).fill(0);
  for(let startCell=0;startCell<span.cells;startCell+=chunkSize){
   const chunk=summarizeBlockmapChunk(source,{
    address:span.start,width:span.width,height:span.height,
    startCell,maxCells:chunkSize
   });
   for(let i=0;i<64;i++){
    span.flags[i]+=chunk.rawHighBitCounts[i];
    flags[i]+=chunk.rawHighBitCounts[i];
   }
  }
  span.nonzero=span.cells-span.flags[0];
 }
 const rows=records.slice(0,maxRows).map(({bankIndex,mapIndex,span})=>
  Object.freeze({bankIndex,mapIndex,blockmapOffset:span.start,
   width:span.width,height:span.height,cells:span.cells,
   nonzeroRawHighBitCells:span.nonzero,
   sharedBlockmapReferences:span.references,
   rawHighBitCounts:Object.freeze([...span.flags])}));
 return Object.freeze({
  mapsInspected:records.length,uniqueBlockmaps:ranges.size,
  sharedMapReferences:records.length-ranges.size,
  logicalCells,uniqueCells,nonzeroRawHighBitCells:uniqueCells-flags[0],
  rawHighBitCounts:Object.freeze(flags),
  rows:Object.freeze(rows),rowsTruncated:rows.length<records.length,
  readOnly:true,layoutAuthenticated:false,walkabilityVerified:false,
  ownershipAuthenticated:false,writeAuthorized:false,
  independentParityEvidence:false
 });
}
