/**
 * Read-only raw attribute overlay for a bounded vanilla rendered viewport.
 * The colours distinguish byte values, NOT passability or collision semantics.
 */
const modes=Object.freeze({highBits:['collision',63],behavior:['behavior',255],
 terrain:['terrain',255],encounter:['encounter',3]});
function rgbFor(value){
 // Bijective red channel over 8-bit inputs; stable categorical swatches.
 return Object.freeze([(value*53+48)&255,(value*97+80)&255,(value*193+128)&255]);
}
export function buildVanillaRawMapOverlay(rendered,{mode='highBits',maxLegend=12}={}){
 if(!rendered||!Array.isArray(rendered.attributes)||
    !Number.isSafeInteger(rendered.columns)||!Number.isSafeInteger(rendered.rows)||
    rendered.columns<1||rendered.rows<1||rendered.columns>12||rendered.rows>10||
    rendered.attributes.length!==rendered.rows)
  throw new TypeError('Expected a bounded rendered vanilla viewport');
 if(!Object.hasOwn(modes,mode))throw new RangeError('Unsupported raw attribute overlay mode');
 if(!Number.isSafeInteger(maxLegend)||maxLegend<1||maxLegend>64)
  throw new RangeError('Legend limit must be 1–64');
 const [field,max]=modes[mode],counts=new Map(),cells=[];
 for(let row=0;row<rendered.rows;row++){
  const attrs=rendered.attributes[row];
  if(!Array.isArray(attrs)||attrs.length!==rendered.columns)
   throw new RangeError('Rendered attribute grid is inconsistent');
  for(let column=0;column<rendered.columns;column++){
   const attr=attrs[column],value=attr?.[field];
   if(!Number.isSafeInteger(value)||value<0||value>max)
    throw new RangeError('Raw '+field+' value is unavailable or invalid for this ROM family');
   const rgb=rgbFor(value);
   cells.push(Object.freeze({column,row,x:attr.x,y:attr.y,value,rgb}));
   const existing=counts.get(value);
   if(existing)existing.count++;
   else counts.set(value,{value,count:1,rgb,firstX:attr.x,firstY:attr.y});
  }
 }
 const ordered=[...counts.values()].sort((a,b)=>b.count-a.count||a.value-b.value);
 return Object.freeze({
  mode,field,cells:Object.freeze(cells),legend:Object.freeze(
   ordered.slice(0,maxLegend).map(item=>Object.freeze({...item}))),
  distinctValues:ordered.length,legendTruncated:ordered.length>maxLegend,
  readOnly:true,layoutAuthenticated:false,walkabilityVerified:false
 });
}

/**
 * Reuse the exact same categorical colours for a raw blockmap grid, even
 * when palette/tile graphics are missing or rendering is unavailable.
 */
export function buildRawBlockmapGridOverlay(preview,{maxLegend=12}={}){
 if(!preview||!Array.isArray(preview.cells)||
    !Number.isSafeInteger(preview.columns)||!Number.isSafeInteger(preview.rows))
  throw new TypeError('Expected a bounded raw blockmap viewport');
 const attributes=preview.cells.map(row=>{
  if(!Array.isArray(row))throw new TypeError('Invalid raw blockmap row');
  return row.map(cell=>({x:cell.x,y:cell.y,collision:cell.collision}));
 });
 return buildVanillaRawMapOverlay({columns:preview.columns,rows:preview.rows,attributes},
  {mode:'highBits',maxLegend});
}
