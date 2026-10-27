/**
 * Byte-exact, read-only visual comparison of a proposed vanilla blockmap cell.
 * Source-grounded in the existing CUBHMA BlockCells and metatile renderer.
 * This is a preview, NOT a semantic writer or CUBE layout authenticator.
 */
import {previewVanillaBlockmapCellChange} from './map-edit-preview.js';
import {reviewVanillaChangeSet} from './map-change-review.js';
import {renderVanillaMapViewport} from './map-render.js';

function reader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&typeof source.read==='function')return source;
 throw new TypeError('Expected ROM bytes or a read-only staged accessor');
}
function sameBytes(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>v===b[i]);}
export function compareVanillaBlockmapVisualChange(source,{preview,x=0,y=0,viewportWidth=12,viewportHeight=10}={}){
 const rom=reader(source);
 if(!preview||preview.previewOnly!==true||preview.readOnly!==true||
    preview.writeAuthorized!==false||preview.layoutAuthenticated!==false)
  throw new TypeError('Expected an unauthenticated vanilla cell preview');
 if(!Number.isSafeInteger(viewportWidth)||viewportWidth<1||viewportWidth>12||
    !Number.isSafeInteger(viewportHeight)||viewportHeight<1||viewportHeight>10)
  throw new RangeError('Visual comparison viewport is limited to 12 by 10 cells');
 // Revalidate all original bytes, allowed fields and the actual selected header.
 reviewVanillaChangeSet(rom,[preview]);
 const canonical=previewVanillaBlockmapCellChange(rom,{
  address:preview.headerOffset,family:preview.family,
  x:preview.x,y:preview.y,tileId:preview.after?.tileId,
  collision:preview.after?.collision,expectedRaw:preview.before?.raw
 });
 if(preview.byteOffset!==canonical.byteOffset||
    preview.layoutOffset!==canonical.layoutOffset||
    preview.blockmapOffset!==canonical.blockmapOffset||
    preview.width!==canonical.width||preview.height!==canonical.height||
    !sameBytes(preview.before?.bytes,canonical.before.bytes)||
    !sameBytes(preview.after?.bytes,canonical.after.bytes))
  throw new RangeError('Preview provenance does not match current vanilla map structure');
 if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x<0||y<0||
    x>=canonical.width||y>=canonical.height||
    preview.x<x||preview.y<y||preview.x>=x+viewportWidth||preview.y>=y+viewportHeight)
  throw new RangeError('Selected cell is outside the requested visual viewport');
 const options={address:preview.headerOffset,family:preview.family,x,y,viewportWidth,viewportHeight};
 const before=renderVanillaMapViewport(rom,options);
 const offset=canonical.byteOffset,bytes=canonical.after.bytes;
 const proposed={length:rom.length,read:i=>i===offset?bytes[0]:i===offset+1?bytes[1]:rom.read(i)};
 const after=renderVanillaMapViewport(proposed,options);
 if(before.width!==after.width||before.height!==after.height)
  throw new RangeError('Rendered viewport dimensions changed unexpectedly');
 let changedPixelCount=0,minX=before.width,minY=before.height,maxX=-1,maxY=-1;
 for(let py=0;py<before.height;py++)for(let px=0;px<before.width;px++){
  const i=(py*before.width+px)*4;
  if(before.pixels[i]!==after.pixels[i]||
     before.pixels[i+1]!==after.pixels[i+1]||
     before.pixels[i+2]!==after.pixels[i+2]||
     before.pixels[i+3]!==after.pixels[i+3]){
   changedPixelCount++;minX=Math.min(minX,px);minY=Math.min(minY,py);
   maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);
  }
 }
 return Object.freeze({
  before,after,changedPixelCount,
  changedPixelBounds:changedPixelCount?Object.freeze({x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}):null,
  selectedCell:Object.freeze({x:preview.x,y:preview.y,byteOffset:offset}),
  changedRawCollision:canonical.before.collision!==canonical.after.collision,
  changedMetatile:canonical.before.tileId!==canonical.after.tileId,
  readOnly:true,previewOnly:true,writeAuthorized:false,layoutAuthenticated:false,
  walkabilityVerified:false
 });
}


/**
 * Compare a bounded viewport against an immutable queue of proposed blockmap
 * changes. The queue is revalidated as a whole (including overlapping ranges)
 * and every cell is reconstructed from CURRENT vanilla map pointers. Offscreen
 * edits are accepted but do not affect the rendered viewport. No ROM writes.
 */
export function compareVanillaBlockmapVisualChangeSet(source,{
 previews,x=0,y=0,viewportWidth=12,viewportHeight=10
}={}){
 const rom=reader(source);
 if(!Array.isArray(previews)||previews.length<1||previews.length>64)
  throw new RangeError('Provide 1–64 blockmap previews');
 if(!Number.isSafeInteger(viewportWidth)||viewportWidth<1||viewportWidth>12||
    !Number.isSafeInteger(viewportHeight)||viewportHeight<1||viewportHeight>10)
  throw new RangeError('Visual comparison viewport is limited to 12 by 10 cells');
 const review=reviewVanillaChangeSet(rom,previews,{maxChanges:64,maxBytes:128});
 if(review.entries.some(entry=>entry.kind!=='blockmap'))
  throw new TypeError('Visual change set accepts blockmap cell previews only');
 const first=previews[0],header=first.headerOffset,family=first.family;
 if(!['RSE','FRLG'].includes(family))
  throw new RangeError('Expected a declared vanilla map family');
 const changes=new Map(),cells=[];
 for(const preview of previews){
  if(preview.headerOffset!==header||preview.family!==family)
   throw new RangeError('Visual changes must target one declared map header and family');
  const canonical=previewVanillaBlockmapCellChange(rom,{
   address:header,family,x:preview.x,y:preview.y,
   tileId:preview.after?.tileId,collision:preview.after?.collision,
   expectedRaw:preview.before?.raw
  });
  if(preview.byteOffset!==canonical.byteOffset||
     preview.layoutOffset!==canonical.layoutOffset||
     preview.blockmapOffset!==canonical.blockmapOffset||
     preview.width!==canonical.width||preview.height!==canonical.height||
     !sameBytes(preview.before?.bytes,canonical.before.bytes)||
     !sameBytes(preview.after?.bytes,canonical.after.bytes))
   throw new RangeError('Preview provenance does not match current vanilla map structure');
  changes.set(canonical.byteOffset,canonical.after.bytes);
  cells.push(Object.freeze({
   x:canonical.x,y:canonical.y,byteOffset:canonical.byteOffset,
   changedMetatile:canonical.before.tileId!==canonical.after.tileId,
   changedRawCollision:canonical.before.collision!==canonical.after.collision,
   visible:canonical.x>=x&&canonical.x<x+viewportWidth&&
           canonical.y>=y&&canonical.y<y+viewportHeight
  }));
 }
 const options={address:header,family,x,y,viewportWidth,viewportHeight};
 const before=renderVanillaMapViewport(rom,options);
 const staged={length:rom.length,read:i=>{
  const record=changes.get(i&~1);
  return record?record[i&1]:rom.read(i);
 }};
 const after=renderVanillaMapViewport(staged,options);
 if(before.width!==after.width||before.height!==after.height)
  throw new RangeError('Rendered viewport dimensions changed unexpectedly');
 let changedPixelCount=0,minX=before.width,minY=before.height,maxX=-1,maxY=-1;
 for(let py=0;py<before.height;py++)for(let px=0;px<before.width;px++){
  const i=(py*before.width+px)*4;
  if(before.pixels[i]!==after.pixels[i]||
     before.pixels[i+1]!==after.pixels[i+1]||
     before.pixels[i+2]!==after.pixels[i+2]||
     before.pixels[i+3]!==after.pixels[i+3]){
   changedPixelCount++;
   minX=Math.min(minX,px);minY=Math.min(minY,py);
   maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);
  }
 }
 return Object.freeze({
  before,after,changedPixelCount,
  changedPixelBounds:changedPixelCount?Object.freeze({
   x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1
  }):null,
  changedCellCount:cells.filter(cell=>cell.changedMetatile||cell.changedRawCollision).length,
  visibleCellCount:cells.filter(cell=>cell.visible).length,
  changedMetatileCount:cells.filter(cell=>cell.changedMetatile).length,
  changedRawCollisionCount:cells.filter(cell=>cell.changedRawCollision).length,
  cells:Object.freeze(cells),reviewedBytes:review.totalBytes,
  readOnly:true,previewOnly:true,writeAuthorized:false,
  layoutAuthenticated:false,walkabilityVerified:false
 });
}
