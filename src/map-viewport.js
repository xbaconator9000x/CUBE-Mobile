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
    (markers[key]??=[]).push(warp.index);
  }
  for(const key of Object.keys(markers))Object.freeze(markers[key]);
  return Object.freeze(markers);
}
