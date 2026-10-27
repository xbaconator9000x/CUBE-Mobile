/**
 * Read-only, byte-exact proposed vanilla blockmap cell change.
 *
 * Pinned upstream kcradi/CUBHMA MapModel.cs: BlockCells stores
 * (collision << 10) | tile as a little-endian u16. This module deliberately
 * NEVER writes a ROM or authorizes an edit. CUBE layouts are unauthenticated.
 */
import {inspectVanillaMapHeader} from './map-layouts.js';
import {inspectBlockMap} from './map-blocks.js';

function bounded(value,max,label) {
 if(!Number.isSafeInteger(value)||value<0||value>max)
  throw new RangeError(label+' must be an integer from 0 to '+max);
}
function snapshotAtlas(atlas,header,layout) {
 if(atlas===undefined)return Object.freeze({known:false,total:0,maps:Object.freeze([])});
 if(!atlas||atlas.readOnly!==true||atlas.layoutAuthenticated!==false||
    !Array.isArray(atlas.maps)||atlas.maps.length<1||atlas.maps.length>4096||
    atlas.family!==header.family)
  throw new TypeError('Expected a declared read-only vanilla atlas for the same family');
 const own=atlas.maps.filter(m=>m.mapHeaderOffset===header.address);
 if(!own.length||own.some(m=>m.layoutOffset!==header.layoutOffset||
    m.blockmapOffset!==layout.blockmapOffset||m.width!==layout.width||
    m.height!==layout.height))
  throw new RangeError('Selected header is absent or stale in the declared atlas');
 const owners=atlas.maps.filter(m=>m.blockmapOffset===layout.blockmapOffset);
 return Object.freeze({known:true,total:owners.length,maps:Object.freeze(
  owners.slice(0,16).map(m=>Object.freeze({bankIndex:m.bankIndex,mapIndex:m.mapIndex,
   mapHeaderOffset:m.mapHeaderOffset})) )});
}
export function previewVanillaBlockmapCellChange(source,{
 address,family,x,y,tileId,collision,expectedRaw,atlas
}={}) {
 const header=inspectVanillaMapHeader(source,{address,family}),layout=header.layout;
 bounded(x,layout.width-1,'X');bounded(y,layout.height-1,'Y');
 if(tileId===undefined&&collision===undefined)
  throw new RangeError('Specify a proposed tile ID or raw six-bit collision value');
 if(tileId!==undefined)bounded(tileId,1023,'Tile ID');
 if(collision!==undefined)bounded(collision,63,'Raw collision');
 if(expectedRaw!==undefined)bounded(expectedRaw,65535,'Expected original cell word');
 const view=inspectBlockMap(source,{address:layout.blockmapOffset,
  width:layout.width,height:layout.height,x,y,viewportWidth:1,viewportHeight:1});
 const current=view.cells[0][0];
 if(expectedRaw!==undefined&&expectedRaw!==current.raw)
  throw new RangeError('Original cell changed since selection; preview again');
 const nextTile=tileId===undefined?current.tileId:tileId;
 const nextCollision=collision===undefined?current.collision:collision;
 const nextRaw=(nextCollision<<10)|nextTile;
 const aliases=snapshotAtlas(atlas,header,layout);
 return Object.freeze({
  headerOffset:header.address,layoutOffset:header.layoutOffset,
  blockmapOffset:layout.blockmapOffset,width:layout.width,height:layout.height,
  x,y,byteOffset:current.byteOffset,
  before:Object.freeze({raw:current.raw,tileId:current.tileId,
   collision:current.collision,bytes:Object.freeze([current.raw&255,current.raw>>>8])}),
  after:Object.freeze({raw:nextRaw,tileId:nextTile,
   collision:nextCollision,bytes:Object.freeze([nextRaw&255,nextRaw>>>8])}),
  changed:nextRaw!==current.raw,aliases,readOnly:true,
  previewOnly:true,writeAuthorized:false,layoutAuthenticated:false,
  walkabilityVerified:false
 });
}
