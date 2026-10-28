/**
 * Multi-cell, read-only CUBE Emerald visual preflight.
 * Source: pinned kcradi/CUBHMA MapModel.cs BlockCell encoding and
 * cube_emerald.toml map/layout definitions. No semantic ROM writes.
 */
import {inspectHmaCubeMapEntry} from './hma-cube-map-discovery.js';
import {renderHmaCubeMapViewport} from './hma-cube-map-render.js';
import {auditHmaCubeCrossBankOwnership} from './hma-cube-cross-bank-ownership.js';

function reader(source) {
  if (source instanceof Uint8Array) return {length:source.length,read:i=>source[i]};
  if (source && Number.isSafeInteger(source.length) && source.length>=0 &&
      typeof source.read==='function') return source;
  throw new TypeError('Expected a bounded read-only ROM accessor');
}
function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value<min || value>max)
    throw new RangeError(name+' must be an integer from '+min+' to '+max);
}
function byte(rom,offset) {
  if (!Number.isSafeInteger(offset)||offset<0||offset>=rom.length)
    throw new RangeError('ROM byte outside bounds');
  const value=rom.read(offset);
  if (!Number.isInteger(value)||value<0||value>255)
    throw new RangeError('ROM accessor returned invalid byte');
  return value;
}
function word(rom,offset) {return byte(rom,offset)|(byte(rom,offset+1)<<8);}
function decoded(raw) {
  return Object.freeze({raw,tileId:raw&1023,collision:raw>>>10,
    bytes:Object.freeze([raw&255,raw>>>8])});
}
/**
 * Atomically preflight 1-32 typed proposals against exact expected original
 * words. Re-renders the entire bounded viewport using a virtual read overlay,
 * not the writable ROM model. Duplicate cells and stale bytes fail closed.
 *
 * Optional ownership census is advisory only: even a zero-overlap census
 * cannot prove all banks have been enumerated or authorize ROM writes.
 */
export function previewHmaCubeCellBatch(source,summary,{
  bankIndex,mapIndex,mapCount,changes,
  x=0,y=0,viewportWidth=10,viewportHeight=8,banks
}={}) {
  const rom=reader(source);
  const map=inspectHmaCubeMapEntry(rom,summary,{bankIndex,mapIndex,mapCount});
  if (!Array.isArray(changes)||changes.length<1||changes.length>32)
    throw new RangeError('Provide 1–32 CUBE cell changes');
  integer(x,0,map.layout.width-1,'Viewport X');
  integer(y,0,map.layout.height-1,'Viewport Y');
  integer(viewportWidth,1,32,'Viewport width');
  integer(viewportHeight,1,32,'Viewport height');
  const right=Math.min(map.layout.width,x+viewportWidth);
  const bottom=Math.min(map.layout.height,y+viewportHeight);
  const overlays=new Map(),seen=new Set(),records=[];
  for (const change of changes) {
    if (!change||typeof change!=='object')
      throw new TypeError('Each change must be an object');
    integer(change.x,0,map.layout.width-1,'Cell X');
    integer(change.y,0,map.layout.height-1,'Cell Y');
    if (change.x<x||change.x>=right||change.y<y||change.y>=bottom)
      throw new RangeError('All proposed cells must fit the preview viewport');
    if (change.tileId===undefined&&change.collision===undefined)
      throw new RangeError('Cell proposal must change a tile ID or raw high bits');
    if (change.tileId!==undefined) integer(change.tileId,0,1023,'Tile ID');
    if (change.collision!==undefined) integer(change.collision,0,63,'Raw high bits');
    integer(change.expectedRaw,0,65535,'Expected original cell word');
    const offset=map.layout.blockmapOffset+
      (change.y*map.layout.width+change.x)*2;
    if (seen.has(offset)) throw new RangeError('Duplicate cell proposal');
    seen.add(offset);
    const old=word(rom,offset);
    if (old!==change.expectedRaw)
      throw new RangeError('Cell changed since selection; inspect again');
    const next=((change.collision??(old>>>10))<<10)|
      (change.tileId??(old&1023));
    overlays.set(offset,next&255);
    overlays.set(offset+1,next>>>8);
    records.push(Object.freeze({x:change.x,y:change.y,byteOffset:offset,
      before:decoded(old),after:decoded(next),changed:old!==next}));
  }
  const staged=Object.freeze({length:rom.length,read:i=>
    overlays.has(i)?overlays.get(i):byte(rom,i)});
  const options={bankIndex,mapIndex,mapCount,x,y,viewportWidth,viewportHeight};
  const beforeImage=renderHmaCubeMapViewport(rom,summary,options);
  const afterImage=renderHmaCubeMapViewport(staged,summary,options);
  if (beforeImage.width!==afterImage.width||
      beforeImage.height!==afterImage.height||
      beforeImage.blockmapOffset!==afterImage.blockmapOffset||
      JSON.stringify(beforeImage.map)!==JSON.stringify(afterImage.map))
    throw new RangeError('CUBE map structure changed during virtual preview');
  for (const record of records) {
    const cell=grid=>grid.cells.flat().find(c=>c.x===record.x&&c.y===record.y);
    if (cell(beforeImage)?.raw!==record.before.raw||
        cell(afterImage)?.raw!==record.after.raw)
      throw new RangeError('Virtual cell re-decode failed');
  }
  let changedPixels=0;
  for(let i=0;i<beforeImage.pixels.length;i+=4)
    if(beforeImage.pixels[i]!==afterImage.pixels[i]||
       beforeImage.pixels[i+1]!==afterImage.pixels[i+1]||
       beforeImage.pixels[i+2]!==afterImage.pixels[i+2]||
       beforeImage.pixels[i+3]!==afterImage.pixels[i+3])changedPixels++;
  let ownership=null;
  if (banks!==undefined) {
    const census=auditHmaCubeCrossBankOwnership(rom,summary,{banks});
    if (!banks.some(b=>b.bankIndex===bankIndex&&b.mapCount===mapCount))
      throw new RangeError('Ownership census must include the selected bank/count');
    const id=bankIndex+':'+mapIndex;
    const owner=census.maps.find(m=>m.id===id);
    if (owner?.status!=='decoded'||
        owner.blockmapOffset!==map.layout.blockmapOffset||
        owner.blockmapBytes!==map.layout.blockmapBytes)
      throw new RangeError('Selected map missing from ownership census');
    const relationships=census.relationships.filter(r=>
      (r.first===id||r.second===id)&&
      (r.firstKind==='blockmap'||r.secondKind==='blockmap'));
    ownership=Object.freeze({requestedMaps:census.requestedMaps,
      invalidMaps:census.invalid,overlapCount:relationships.length,
      overlaps:Object.freeze(relationships),partialCoverage:true,
      exclusiveOwnershipProven:false});
  }
  return Object.freeze({
    bankIndex,mapIndex,mapCount,x,y,viewportWidth,viewportHeight,
    changes:Object.freeze(records),changedCells:records.filter(c=>c.changed).length,
    changedPixels,beforeImage,afterImage,ownership,
    readOnly:true,previewOnly:true,writeAuthorized:false,
    romAuthenticated:false,cubeLayoutAuthenticated:false,
    walkabilityVerified:false,exclusiveOwnershipProven:false
  });
}
