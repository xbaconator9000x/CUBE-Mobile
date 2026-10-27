/**
 * Read-only vanilla RSE/FRLG 16x16 metatile compositor.
 * Based on upstream BlockmapRun.RenderBlock and LzTilemapRun.ReadTileData.
 * Does not authenticate CUBE layouts, walkability or pointer ownership.
 */
import {inspectVanillaMapBlocksets} from './map-blocksets.js';
import {inspectVanillaMapHeader} from './map-layouts.js';
import {inspectBlockMap} from './map-blocks.js';
import {decodeLz10} from './core.js';
function asRom(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&typeof source.read==='function')return source;
 throw new TypeError('Expected read-only ROM accessor');
}
function span(rom,at,length,label){
 if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(length)||length<1||at>rom.length-length)
  throw new RangeError(label+' exceeds ROM bounds');
}
function byte(rom,at){
 const b=rom.read(at);
 if(!Number.isInteger(b)||b<0||b>255)throw new RangeError('Invalid ROM accessor byte');
 return b;
}
function word(rom,at){
 span(rom,at,2,'Metatile word');
 return byte(rom,at)|(byte(rom,at+1)<<8);
}
function rgb(word){
 const scale=n=>(n<<3)|(n>>>2);
 return [scale(word&31),scale((word>>>5)&31),scale((word>>>10)&31)];
}
export function renderVanillaMapViewport(source,{address,family,x=0,y=0,viewportWidth=12,viewportHeight=10}={}){
 const rom=asRom(source);
 const header=inspectVanillaMapHeader(rom,{address,family});
 const sets=inspectVanillaMapBlocksets(rom,{address,family});
 const layout=header.layout;
 const view=inspectBlockMap(rom,{address:layout.blockmapOffset,width:layout.width,height:layout.height,
  x,y,viewportWidth,viewportHeight});
 const split=family==='FRLG'?640:512,primaryPalettes=family==='FRLG'?7:6;
 const graphics={};
 for(const key of ['primary','secondary']){
  const set=sets[key];
  span(rom,set.paletteOffset,13*32,key+' palette table');
  graphics[key]=set.isCompressed?decodeLz10(rom,set.tilesetOffset).data:null;
  if(graphics[key]&&graphics[key].length%32)throw new RangeError('Compressed tileset is not 4bpp aligned');
 }
 const palettes=new Map(),metatiles=new Map();
 function palette(bank){
  if(bank<0||bank>=13)throw new RangeError('Unsupported palette bank');
  if(palettes.has(bank))return palettes.get(bank);
  const set=sets[bank<primaryPalettes?'primary':'secondary'];
  const colors=Array.from({length:16},(_,i)=>rgb(word(rom,set.paletteOffset+bank*32+i*2)));
  palettes.set(bank,colors);return colors;
 }
 function block(id){
  if(!Number.isInteger(id)||id<0||id>=1024)throw new RangeError('Invalid block ID');
  if(metatiles.has(id))return metatiles.get(id);
  const set=sets[id<split?'primary':'secondary'],local=id<split?id:id-split;
  const offset=set.metatileOffset+local*16,attr=set.attributesOffset+local*(family==='FRLG'?4:2);
  span(rom,offset,16,'Metatile descriptors');
  span(rom,attr,family==='FRLG'?4:2,'Metatile attributes');
  const layer=family==='FRLG'?byte(rom,attr+3)>>>5:byte(rom,attr+1)>>>4;
  if(layer>3)throw new RangeError('Unsupported metatile layer');
  const descriptors=Array.from({length:8},(_,i)=>word(rom,offset+i*2));
  const value={layer,descriptors};metatiles.set(id,value);return value;
 }
 function pixel(tile,x,y){
  if(tile<0||tile>=1024)throw new RangeError('Invalid tile index');
  const key=tile<split?'primary':'secondary',local=tile<split?tile:tile-split;
  const compressed=graphics[key],offset=local*32+y*4+(x>>>1);
  let b;
  if(compressed){
   if(local*32>compressed.length-32)throw new RangeError('Compressed tile missing');
   b=compressed[offset];
  }else{
   const start=sets[key].tilesetOffset+local*32;
   span(rom,start,32,'Raw tile');
   b=byte(rom,start+y*4+(x>>>1));
  }
  return x&1?b>>>4:b&15;
 }
 const width=view.columns*16,height=view.rows*16,data=new Uint8ClampedArray(width*height*4);
 for(const row of view.cells)for(const cell of row){
  const blockData=block(cell.tileId),left=(cell.x-x)*16,top=(cell.y-y)*16;
  function paint(descriptors,layer,transparent){
   for(let q=0;q<4;q++){
    const value=descriptors[q+layer*4],tile=value&1023,pal=palette(value>>>12);
    const flipX=Boolean(value&0x400),flipY=Boolean(value&0x800);
    const qx=(q&1)*8,qy=(q>>>1)*8;
    for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++){
     const index=pixel(tile,flipX?7-xx:xx,flipY?7-yy:yy);
     if(transparent&&index===0)continue;
     const dest=((top+qy+yy)*width+left+qx+xx)*4,c=pal[index];
     data[dest]=c[0];data[dest+1]=c[1];data[dest+2]=c[2];data[dest+3]=255;
    }
   }
  }
  paint(blockData.descriptors,0,false);
  paint(blockData.descriptors,1,true);
  if(blockData.layer===3){
   if(cell.tileId===1023)throw new RangeError('Triple layer has no following block');
   paint(block(cell.tileId+1).descriptors,0,true);
  }
 }
 return Object.freeze({width,height,pixels:data,cells:view.cells,columns:view.columns,rows:view.rows,
  blockmapOffset:layout.blockmapOffset,headerAddress:address,readOnly:true,
  layoutAuthenticated:false,walkabilityVerified:false});
}
