/**
 * Source-grounded, read-only CUBE custom blockmap cell visual preflight.
 * Pinned CUBHMA MapModel.cs BlockCell.Block = (Collision << 10) | Tile.
 * No source mutation, saved ROM, authenticated layout, or walkability claims.
 */
import {inspectHmaCubeMapEntry} from './hma-cube-map-discovery.js';
import {renderHmaCubeMapViewport} from './hma-cube-map-render.js';

function asReader(source) {
  if (source instanceof Uint8Array) return {length:source.length,read:i=>source[i]};
  if (source && Number.isSafeInteger(source.length) && source.length>=0 &&
      typeof source.read==='function') return source;
  throw new TypeError('Expected a bounded staged ROM reader');
}
function bounded(value,max,label) {
  if (!Number.isSafeInteger(value)||value<0||value>max)
    throw new RangeError(label+' must be an integer in 0–'+max);
}
function byte(source,at) {
  const n=source.read(at);
  if (!Number.isInteger(n)||n<0||n>255) throw new RangeError('Invalid staged ROM byte');
  return n;
}
function overlayReader(source,at,raw) {
  return Object.freeze({length:source.length,read:i=>{
    if (!Number.isSafeInteger(i)||i<0||i>=source.length)
      throw new RangeError('Overlay read outside ROM');
    return i===at?raw&255:i===at+1?raw>>>8:byte(source,i);
  }});
}
function imageCell(image,x,y) {
  const row=image.cells.find(row=>row[0]?.y===y);
  return row?.find(cell=>cell.x===x)??null;
}
/**
 * Produce before/after RSE images using a two-byte virtual overlay.
 * This deliberately cannot write to the ROM or export a modified ROM.
 */
export function previewHmaCubeBlockmapVisualChange(source,summary,{
  bankIndex,mapIndex,mapCount,x,y,tileId,collision,expectedRaw,
  viewportX,viewportY,viewportWidth=10,viewportHeight=8
}={}) {
  const rom=asReader(source);
  const options={bankIndex,mapIndex,mapCount};
  const map=inspectHmaCubeMapEntry(rom,summary,options);
  bounded(x,map.layout.width-1,'Cell X');
  bounded(y,map.layout.height-1,'Cell Y');
  if (tileId===undefined&&collision===undefined)
    throw new RangeError('Specify tile ID or raw collision/elevation bits');
  if (tileId!==undefined) bounded(tileId,1023,'Tile ID');
  if (collision!==undefined) bounded(collision,63,'Raw collision/elevation');
  if (expectedRaw!==undefined) bounded(expectedRaw,65535,'Expected original word');
  const at=map.layout.blockmapOffset+(y*map.layout.width+x)*2;
  const original=byte(rom,at)|(byte(rom,at+1)<<8);
  if (expectedRaw!==undefined&&expectedRaw!==original)
    throw new RangeError('Selected cell changed; inspect and preview again');
  const next=((collision??(original>>>10))<<10)|(tileId??(original&1023));
  const vx=viewportX??Math.floor(x/10)*10,vy=viewportY??Math.floor(y/8)*8;
  bounded(vx,map.layout.width-1,'Viewport X');
  bounded(vy,map.layout.height-1,'Viewport Y');
  bounded(viewportWidth,32,'Viewport width');
  bounded(viewportHeight,32,'Viewport height');
  if (viewportWidth<1||viewportHeight<1||x<vx||y<vy||
      x>=vx+viewportWidth||y>=vy+viewportHeight)
    throw new RangeError('Selected cell must be inside the bounded preview viewport');
  const renderOptions={...options,x:vx,y:vy,viewportWidth,viewportHeight};
  const before=renderHmaCubeMapViewport(rom,summary,renderOptions);
  const staged=overlayReader(rom,at,next);
  const after=renderHmaCubeMapViewport(staged,summary,renderOptions);
  if (before.width!==after.width||before.height!==after.height||
      before.blockmapOffset!==after.blockmapOffset||
      JSON.stringify(before.map)!==JSON.stringify(after.map))
    throw new RangeError('CUBE structural map changed during virtual preview');
  const a=imageCell(before,x,y),b=imageCell(after,x,y);
  if (!a||!b||a.raw!==original||b.raw!==next||a.byteOffset!==at||b.byteOffset!==at)
    throw new RangeError('CUBE blockmap preview failed typed decode/redecode');
  let changedPixels=0;
  for (let i=0;i<before.pixels.length;i+=4)
    if (before.pixels[i]!==after.pixels[i]||
        before.pixels[i+1]!==after.pixels[i+1]||
        before.pixels[i+2]!==after.pixels[i+2]||
        before.pixels[i+3]!==after.pixels[i+3]) changedPixels++;
  const word=value=>Object.freeze({raw:value,tileId:value&1023,
    collision:value>>>10,bytes:Object.freeze([value&255,value>>>8])});
  return Object.freeze({
    bankIndex,mapIndex,mapCount,x,y,byteOffset:at,
    before:word(original),after:word(next),changed:original!==next,
    changedPixels,viewportX:vx,viewportY:vy,
    beforeImage:before,afterImage:after,
    readOnly:true,previewOnly:true,writeAuthorized:false,
    romAuthenticated:false,cubeLayoutAuthenticated:false,
    walkabilityVerified:false,otherMapOwnershipUnknown:true
  });
}
