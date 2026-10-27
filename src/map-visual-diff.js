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
