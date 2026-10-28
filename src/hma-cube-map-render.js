/**
 * Conservative read-only CUBE Emerald RSE metatile viewport.
 * Source: pinned CUBHMA MapModel.cs and cube_emerald.toml custom layout:
 * first 24 layout bytes and the 24-byte blockset pointer prefix match RSE.
 * CUBE-specific lighting modes and FRLG layout variants fail closed.
 * This is a rendering preview, not authenticated ROM/layout or walkability.
 */
import {inspectHmaCubeMapEntry} from './hma-cube-map-discovery.js';
import {inspectVanillaMapBlocksets} from './map-blocksets.js';
import {renderVanillaMapViewport} from './map-render.js';

function reader(source) {
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&typeof source.read==='function')return source;
 throw new TypeError('Expected bounded read-only ROM accessor');
}
function byte(rom,at) {
 if(!Number.isSafeInteger(at)||at<0||at>=rom.length)
  throw new RangeError('Blockset flag outside ROM');
 const b=rom.read(at);
 if(!Number.isInteger(b)||b<0||b>255)throw new RangeError('Invalid staged ROM byte');
 return b;
}
export function renderHmaCubeMapViewport(source,summary,{
 bankIndex,mapIndex,mapCount,x=0,y=0,viewportWidth=12,viewportHeight=10
}={}){
 const rom=reader(source);
 const map=inspectHmaCubeMapEntry(rom,summary,{bankIndex,mapIndex,mapCount});
 if(map.layout.isFrlg!==0)
  throw new RangeError('CUBE FRLG metatile layout is not supported by the RSE renderer');
 const sets=inspectVanillaMapBlocksets(rom,{address:map.header.address,family:'RSE'});
 if(sets.primary.headerOffset!==map.layout.primaryOffset||
    sets.secondary.headerOffset!==map.layout.secondaryOffset)
  throw new RangeError('CUBE blockset pointers do not match RSE-compatible prefix');
 for(const [name,set,expectedSecondary] of [
  ['primary',sets.primary,0],['secondary',sets.secondary,1]]){
  const at=set.headerOffset;
  if(byte(rom,at+1)!==expectedSecondary)
   throw new RangeError(name+' blockset secondary flag is inconsistent');
  if(byte(rom,at+2)!==0||byte(rom,at+3)!==0)
   throw new RangeError(name+' CUBE light palettes/custom light colors unsupported');
 }
 const image=renderVanillaMapViewport(rom,{
  address:map.header.address,family:'RSE',x,y,viewportWidth,viewportHeight
 });
 if(image.blockmapOffset!==map.layout.blockmapOffset)
  throw new RangeError('Rendered blockmap differs from custom CUBE layout');
 return Object.freeze({...image,map,readOnly:true,romAuthenticated:false,
  cubeLayoutAuthenticated:false,walkabilityVerified:false,writeAuthorized:false,
  renderingMode:'conservative-rse'});
}
