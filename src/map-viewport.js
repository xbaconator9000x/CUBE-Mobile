/**
 * Touch viewport helpers for the raw, read-only blockmap inspector.
 * Warps are spatial hints from explicitly selected vanilla headers, not
 * authenticated map topology or passability information.
 */
function viewportDimension(value,label){
  if(!Number.isSafeInteger(value)||value<1||value>1024)
    throw new RangeError(label+' must be an integer from 1 to 1024');
}
export function panMapViewport({
  width,height,x=0,y=0,dx=0,dy=0,viewportWidth=12,viewportHeight=10
}={}){
  viewportDimension(width,'Map width');viewportDimension(height,'Map height');
  viewportDimension(viewportWidth,'Viewport width');viewportDimension(viewportHeight,'Viewport height');
  for(const [name,value] of [['X',x],['Y',y],['DX',dx],['DY',dy]])
    if(!Number.isSafeInteger(value))throw new RangeError(name+' must be an integer');
  if(x<0||y<0||x>=width||y>=height)
    throw new RangeError('Current viewport origin is outside map');
  const nextX=Math.max(0,Math.min(width-1,Math.min(width-viewportWidth,Math.max(0,x+dx))));
  const nextY=Math.max(0,Math.min(height-1,Math.min(height-viewportHeight,Math.max(0,y+dy))));
  return Object.freeze({x:nextX,y:nextY});
}
export function indexMapWarpMarkers(warps,{width,height}={}){
  viewportDimension(width,'Map width');viewportDimension(height,'Map height');
  if(!Array.isArray(warps)||warps.length>255)
    throw new RangeError('Expected at most 255 vanilla warp records');
  const markers=Object.create(null);
  for(const warp of warps){
    if(!warp||!Number.isSafeInteger(warp.x)||!Number.isSafeInteger(warp.y)||
       !Number.isSafeInteger(warp.index)||warp.index<0||warp.index>254)
      throw new RangeError('Invalid warp coordinates/index');
    if(warp.x>=width||warp.y>=height||warp.x<0||warp.y<0)continue;
    const key=warp.x+','+warp.y;
    if(markers[key]===undefined)markers[key]=[];
    markers[key].push(warp.index);
  }
  for(const key of Object.keys(markers))Object.freeze(markers[key]);
  return Object.freeze(markers);
}

/**
 * Spatial hints for raw vanilla object/script/signpost records.
 * Labels are identifiers only, not verified passability or script semantics.
 * Out-of-map records are omitted; the caller must match source layout identity.
 */
export function indexMapEventMarkers(arrays,{width,height}={}){
  viewportDimension(width,'Map width');viewportDimension(height,'Map height');
  if(!arrays||typeof arrays!=='object')throw new TypeError('Expected event arrays');
  const markers=Object.create(null);
  for(const [name,prefix] of [['objects','O'],['scripts','S'],['signposts','P']]){
    const records=arrays[name];
    if(!Array.isArray(records)||records.length>255)
      throw new RangeError('Invalid '+name+' event array');
    for(const record of records){
      if(!record||!Number.isSafeInteger(record.x)||!Number.isSafeInteger(record.y)||
         !Number.isSafeInteger(record.index)||record.index<0||record.index>254)
        throw new RangeError('Invalid '+name+' event coordinates/index');
      if(record.x<0||record.y<0||record.x>=width||record.y>=height)continue;
      const key=record.x+','+record.y;
      if(markers[key]===undefined)markers[key]=[];
    markers[key].push(prefix+record.index);
    }
  }
  for(const key of Object.keys(markers))Object.freeze(markers[key]);
  return Object.freeze(markers);
}

/**
 * Hit-test a composed 16px metatile viewport in native canvas coordinates.
 * The caller must transform CSS/client coordinates to canvas pixels first.
 * Returns source byte offsets from the existing read-only decoded cells.
 */
export function inspectRenderedMapPixel(rendered,pixelX,pixelY) {
 if(!rendered||!Array.isArray(rendered.cells)||!Array.isArray(rendered.attributes)||
    !Number.isSafeInteger(rendered.columns)||!Number.isSafeInteger(rendered.rows))
  throw new TypeError('Expected rendered map viewport');
 if(!Number.isFinite(pixelX)||!Number.isFinite(pixelY)||pixelX<0||pixelY<0||
    pixelX>=rendered.columns*16||pixelY>=rendered.rows*16)return null;
 const column=Math.floor(pixelX/16),row=Math.floor(pixelY/16);
 const cell=rendered.cells[row]?.[column],attribute=rendered.attributes[row]?.[column];
 if(!cell||!attribute||!Number.isSafeInteger(cell.byteOffset))
  throw new RangeError('Rendered map cell has no source provenance');
 return Object.freeze({column,row,cell,attribute});
}

/** Spatial markers are unverified coordinates, not sprite/warp semantics. */
export function projectRenderedMapMarkers(rendered,warpIndex=null,eventIndex=null) {
 if(!rendered||!Array.isArray(rendered.cells)||!Number.isSafeInteger(rendered.columns)||
    !Number.isSafeInteger(rendered.rows))
  throw new TypeError('Expected rendered map viewport');
 const markers=[];
 for(let row=0;row<rendered.rows;row++)for(let column=0;column<rendered.columns;column++){
  const cell=rendered.cells[row]?.[column];
  if(!cell||!Number.isSafeInteger(cell.x)||!Number.isSafeInteger(cell.y))
   throw new RangeError('Rendered map coordinate missing');
  const key=cell.x+','+cell.y;
  const warps=warpIndex?.[key]||[],events=eventIndex?.[key]||[];
  if(!Array.isArray(warps)||!Array.isArray(events))
   throw new TypeError('Invalid marker index');
  if(warps.length||events.length)markers.push(Object.freeze({
   column,row,x:cell.x,y:cell.y,warps:Object.freeze([...warps]),
   events:Object.freeze([...events])
  }));
 }
 return Object.freeze(markers);
}
