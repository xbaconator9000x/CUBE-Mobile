/**
 * Multi-cell, read-only CUBE Emerald visual preflight.
 * Source: pinned kcradi/CUBHMA MapModel.cs BlockCell encoding and
 * cube_emerald.toml map/layout definitions. No semantic ROM writes.
 */
import {inspectHmaCubeMapEntry} from './hma-cube-map-discovery.js';
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';
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
  // Surface events occupying edited cells before a future save workflow.
  // Raw event coordinates are evidence of possible interaction, not proof
  // that a collision/high-bit change makes the cell passable or impassable.
  let eventInspectionStatus='unavailable';
  const eventImpacts=[];
  try {
    const eventReport=inspectHmaCubeMapEventWarps(rom,summary,{bankIndex,mapIndex,mapCount});
    eventInspectionStatus='decoded';
    for(const record of records.filter(r=>r.changed)){
      const touching=[];
      for(const [kind,items] of Object.entries(eventReport.arrays))
        for(const item of items)
          if(item.x===record.x&&item.y===record.y)
            touching.push(Object.freeze({kind,index:item.index,offset:item.offset}));
      if(touching.length)eventImpacts.push(Object.freeze({
        x:record.x,y:record.y,cellOffset:record.byteOffset,
        rawHighBitsChanged:record.before.collision!==record.after.collision,
        tileChanged:record.before.tileId!==record.after.tileId,
        events:Object.freeze(touching)
      }));
    }
  } catch(_error) {
    // A structurally undecodable event table must never be presented as
    // "no events"; future write authorization remains explicitly false.
  }
  return Object.freeze({
    bankIndex,mapIndex,mapCount,x,y,viewportWidth,viewportHeight,
    changes:Object.freeze(records),changedCells:records.filter(c=>c.changed).length,
    changedPixels,beforeImage,afterImage,ownership,
    eventInspectionStatus,eventImpacts:Object.freeze(eventImpacts),
    eventRecordsAffected:eventImpacts.reduce((n,c)=>n+c.events.length,0),
    readOnly:true,previewOnly:true,writeAuthorized:false,
    romAuthenticated:false,cubeLayoutAuthenticated:false,
    walkabilityVerified:false,exclusiveOwnershipProven:false
  });
}

/**
 * Four-neighbor flood fill of a bounded, already rendered CUBE viewport.
 * A tile-only match deliberately ignores raw high bits; exact mode matches
 * the full 16-bit blockmap word. Neither mode infers walkability.
 * No ROM access, no writes, no silent partial fill on the 32-cell limit.
 */
export function planHmaCubeViewportFloodFill(image,{
  seedX,seedY,tileId,collision,matchMode='tile',maxCells=32
}={}){
  if(!image||!Array.isArray(image.cells)||!image.cells.length||
     image.cells.length>32||!Array.isArray(image.cells[0])||
     !image.cells[0].length||image.cells[0].length>32)
    throw new RangeError('Expected a bounded rendered CUBE cell grid');
  if(tileId===undefined&&collision===undefined)
    throw new RangeError('Specify a tile ID, raw high bits, or both');
  if(tileId!==undefined)integer(tileId,0,1023,'Proposed tile ID');
  if(collision!==undefined)integer(collision,0,63,'Proposed raw high bits');
  integer(maxCells,1,32,'Flood-fill cell limit');
  if(matchMode!=='tile'&&matchMode!=='exact'&&matchMode!=='high')
    throw new RangeError('Flood match must be tile, high or exact');
  const rows=image.cells,width=rows[0].length,height=rows.length;
  const originX=rows[0][0]?.x,originY=rows[0][0]?.y;
  integer(originX,0,1023,'Viewport X');
  integer(originY,0,1023,'Viewport Y');
  const cells=new Map();
  for(let y=0;y<height;y++){
    if(!Array.isArray(rows[y])||rows[y].length!==width)
      throw new RangeError('Flood-fill grid is not rectangular');
    for(let x=0;x<width;x++){
      const c=rows[y][x];
      if(!c||c.x!==originX+x||c.y!==originY+y||
         !Number.isSafeInteger(c.raw)||c.raw<0||c.raw>65535||
         c.tileId!==(c.raw&1023)||c.collision!==(c.raw>>>10))
        throw new RangeError('Flood-fill grid has invalid or stale cells');
      cells.set(c.x+':'+c.y,c);
    }
  }
  integer(seedX,originX,originX+width-1,'Flood seed X');
  integer(seedY,originY,originY+height-1,'Flood seed Y');
  const seed=cells.get(seedX+':'+seedY);
  const same=c=>matchMode==='exact'?c.raw===seed.raw:
    matchMode==='high'?c.collision===seed.collision:c.tileId===seed.tileId;
  const queue=[seed],visited=new Set([seedX+':'+seedY]),changes=[];
  let touchesViewportEdge=false;
  for(let head=0;head<queue.length;head++){
    const cell=queue[head];
    changes.push(Object.freeze({x:cell.x,y:cell.y,
      ...(tileId===undefined?{}:{tileId}),
      ...(collision===undefined?{}:{collision}),expectedRaw:cell.raw}));
    if(changes.length>maxCells)
      throw new RangeError('Flood fill exceeds 32-cell budget; no proposals queued');
    if(cell.x===originX||cell.y===originY||
       cell.x===originX+width-1||cell.y===originY+height-1)
      touchesViewportEdge=true;
    for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){
      const nx=cell.x+dx,ny=cell.y+dy,key=nx+':'+ny;
      if(visited.has(key))continue;
      visited.add(key);
      const next=cells.get(key);
      if(next&&same(next))queue.push(next);
    }
  }
  return Object.freeze({changes:Object.freeze(changes),
    matchedCells:changes.length,matchMode,touchesViewportEdge,
    viewportOnly:true,readOnly:true,previewOnly:true,writeAuthorized:false,
    walkabilityVerified:false});
}

/**
 * Copy a bounded rectangular pattern from one rendered CUBE viewport region
 * to another without touching ROM bytes. Overlapping source/destination
 * rectangles always sample the original snapshot, never prior proposals.
 */
export function planHmaCubeViewportStamp(image,{
  sourceX,sourceY,targetX,targetY,width=1,height=1,fields='both',maxCells=32
}={}){
  if(!image||!Array.isArray(image.cells)||!image.cells.length||
     image.cells.length>32||!Array.isArray(image.cells[0])||
     !image.cells[0].length||image.cells[0].length>32)
    throw new RangeError('Expected bounded CUBE viewport cells');
  const rows=image.cells,columns=rows[0].length,lines=rows.length;
  const left=rows[0][0]?.x,top=rows[0][0]?.y;
  integer(left,0,1023,'Viewport X');integer(top,0,1023,'Viewport Y');
  integer(width,1,8,'Stamp width');integer(height,1,8,'Stamp height');
  integer(maxCells,1,32,'Stamp cell limit');
  if(width*height>maxCells)
    throw new RangeError('Pattern stamp exceeds 32-cell budget');
  if(!['both','tile','high'].includes(fields))
    throw new RangeError('Invalid stamp paint fields');
  for(let y=0;y<lines;y++){
    if(!Array.isArray(rows[y])||rows[y].length!==columns)
      throw new RangeError('Pattern source grid is not rectangular');
    for(let x=0;x<columns;x++){
      const c=rows[y][x];
      if(!c||c.x!==left+x||c.y!==top+y||
         !Number.isSafeInteger(c.raw)||c.raw<0||c.raw>65535||
         c.tileId!==(c.raw&1023)||c.collision!==(c.raw>>>10))
        throw new RangeError('Pattern source contains invalid or stale cells');
    }
  }
  for(const [x,y,name] of [
    [sourceX,sourceY,'Source'],[targetX,targetY,'Destination']]){
    integer(x,left,left+columns-width,name+' X');
    integer(y,top,top+lines-height,name+' Y');
  }
  const changes=[];
  for(let dy=0;dy<height;dy++)for(let dx=0;dx<width;dx++){
    const source=rows[sourceY-top+dy][sourceX-left+dx];
    const target=rows[targetY-top+dy][targetX-left+dx];
    changes.push(Object.freeze({x:target.x,y:target.y,
      ...(fields==='high'?{}:{tileId:source.tileId}),
      ...(fields==='tile'?{}:{collision:source.collision}),
      expectedRaw:target.raw}));
  }
  const overlaps=sourceX<targetX+width&&targetX<sourceX+width&&
    sourceY<targetY+height&&targetY<sourceY+height;
  return Object.freeze({changes:Object.freeze(changes),width,height,fields,
    copiedCells:changes.length,sourceOverlapsDestination:overlaps,
    readOnly:true,previewOnly:true,writeAuthorized:false,
    romAuthenticated:false,walkabilityVerified:false});
}

/**
 * Replace all visible cells matching a selected raw tile, six-bit high field,
 * or exact raw word. Unlike flood fill, disconnected matches are included.
 * The 32-cell budget is atomic and the original snapshot remains immutable.
 */
export function planHmaCubeViewportReplace(image,{
  seedX,seedY,tileId,collision,matchMode='tile',maxCells=32
}={}){
  if(!image||!Array.isArray(image.cells)||!image.cells.length||
     image.cells.length>32||!Array.isArray(image.cells[0])||
     !image.cells[0].length||image.cells[0].length>32)
    throw new RangeError('Expected bounded rendered CUBE viewport');
  if(tileId===undefined&&collision===undefined)
    throw new RangeError('Specify a replacement tile or raw high bits');
  if(tileId!==undefined)integer(tileId,0,1023,'Replacement tile ID');
  if(collision!==undefined)integer(collision,0,63,'Replacement high bits');
  integer(maxCells,1,32,'Visible replacement budget');
  if(!['tile','high','exact'].includes(matchMode))
    throw new RangeError('Unsupported visible replacement match mode');
  const rows=image.cells,width=rows[0].length,height=rows.length;
  const left=rows[0][0]?.x,top=rows[0][0]?.y;
  integer(left,0,1023,'Viewport X');integer(top,0,1023,'Viewport Y');
  integer(seedX,left,left+width-1,'Selected X');
  integer(seedY,top,top+height-1,'Selected Y');
  const all=[];
  for(let y=0;y<height;y++){
    if(!Array.isArray(rows[y])||rows[y].length!==width)
      throw new RangeError('Visible replacement grid is not rectangular');
    for(let x=0;x<width;x++){
      const c=rows[y][x];
      if(!c||c.x!==left+x||c.y!==top+y||
         !Number.isSafeInteger(c.raw)||c.raw<0||c.raw>65535||
         c.tileId!==(c.raw&1023)||c.collision!==(c.raw>>>10))
        throw new RangeError('Visible replacement has invalid or stale cells');
      all.push(c);
    }
  }
  const seed=rows[seedY-top][seedX-left];
  const match=c=>matchMode==='exact'?c.raw===seed.raw:
    matchMode==='high'?c.collision===seed.collision:c.tileId===seed.tileId;
  const changes=[];
  for(const c of all)if(match(c)){
    changes.push(Object.freeze({x:c.x,y:c.y,
      ...(tileId===undefined?{}:{tileId}),
      ...(collision===undefined?{}:{collision}),expectedRaw:c.raw}));
    if(changes.length>maxCells)
      throw new RangeError('Visible replacement exceeds 32-cell budget; no proposals queued');
  }
  return Object.freeze({changes:Object.freeze(changes),
    matchedCells:changes.length,matchMode,viewportOnly:true,
    readOnly:true,previewOnly:true,writeAuthorized:false,
    walkabilityVerified:false,romAuthenticated:false});
}

/**
 * Reversible copy-only transaction rehearsal. Applies validated raw cell
 * deltas to an isolated in-memory ROM snapshot, decodes the resulting map,
 * checks every changed byte and reverses the deltas. No patched ROM or
 * patch bytes escape this function; no file is saved or write authorized.
 *
 * This is NOT a genuine CUBE save/reopen or emulator acceptance test.
 */
export function verifyHmaCubeCellBatchDryRun(source,summary,options={}){
 const rom=reader(source);
 if(rom.length<1||rom.length>64*1024*1024)
  throw new RangeError('Copy-only dry run requires a ROM of 1–64 MiB');
 const preview=previewHmaCubeCellBatch(rom,summary,options);
 const original=new Uint8Array(rom.length);
 for(let i=0;i<original.length;i++)original[i]=byte(rom,i);
 const freshBefore=renderHmaCubeMapViewport(original,summary,{
  bankIndex:options.bankIndex,mapIndex:options.mapIndex,mapCount:options.mapCount,
  x:preview.x,y:preview.y,viewportWidth:preview.viewportWidth,
  viewportHeight:preview.viewportHeight
 });
 if(JSON.stringify(freshBefore.cells)!==JSON.stringify(preview.beforeImage.cells)||
    JSON.stringify(freshBefore.attributes)!==JSON.stringify(preview.beforeImage.attributes)||
    freshBefore.pixels.length!==preview.beforeImage.pixels.length||
    !freshBefore.pixels.every((value,i)=>value===preview.beforeImage.pixels[i]))
  throw new RangeError('Source changed during copy-only transaction rehearsal');
 const staged=original.slice(),expected=new Map();
 for(const record of preview.changes){
  const at=record.byteOffset;
  if((staged[at]|staged[at+1]<<8)!==record.before.raw)
   throw new RangeError('Original cell changed during transaction rehearsal');
  const raw=record.after.raw;
  staged[at]=raw&255;staged[at+1]=raw>>>8;
  expected.set(at,raw&255);expected.set(at+1,raw>>>8);
 }
 let changedBytes=0;
 for(let i=0;i<staged.length;i++){
  if(staged[i]!==original[i]){
   if(!expected.has(i)||expected.get(i)!==staged[i])
    throw new RangeError('Transaction touched an unplanned ROM byte');
   changedBytes++;
  }
 }
 const reopened=renderHmaCubeMapViewport(staged,summary,{
  bankIndex:options.bankIndex,mapIndex:options.mapIndex,mapCount:options.mapCount,
  x:preview.x,y:preview.y,viewportWidth:preview.viewportWidth,
  viewportHeight:preview.viewportHeight
 });
 if(JSON.stringify(reopened.cells)!==JSON.stringify(preview.afterImage.cells)||
    JSON.stringify(reopened.attributes)!==JSON.stringify(preview.afterImage.attributes)||
    reopened.pixels.length!==preview.afterImage.pixels.length||
    !reopened.pixels.every((value,i)=>value===preview.afterImage.pixels[i]))
  throw new RangeError('Re-decoded transaction differs from virtual preview');
 for(const record of preview.changes){
  staged[record.byteOffset]=record.before.bytes[0];
  staged[record.byteOffset+1]=record.before.bytes[1];
 }
 for(let i=0;i<staged.length;i++)
  if(staged[i]!==original[i])
   throw new RangeError('Copy-only transaction rollback failed');
 return Object.freeze({
  changedCells:preview.changedCells,changedBytes,
  inMemoryReDecodeVerified:true,inMemoryRollbackVerified:true,
  sourceBytesExported:false,patchedRomExported:false,
  authenticSaveReopenVerified:false,romAuthenticated:false,
  exclusiveOwnershipProven:false,writeAuthorized:false,
  readOnly:true,copyOnly:true
 });
}
