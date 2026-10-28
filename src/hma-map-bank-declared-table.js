/**
 * Metadata-declared, bounded, read-only HMA map-bank pointer table evidence.
 * Pinned upstream: kcradi/CUBHMA MapModel.cs AllMapsModel.Create uses
 * GetTableModel("data.maps.banks"); cube_emerald.toml declares [maps<...>]34.
 * A metadata count and plausible pointer bytes do NOT authenticate a ROM.
 */
import {inspectHmaMapBankRawPointer} from './hma-map-bank-raw-pointer.js';

export function inspectHmaDeclaredBankTableShape(format){
  if(typeof format!=='string'||format.length>8192||
     !format.startsWith('[maps<'))return null;
  let depth=0,close=-1;
  for(let i=0;i<format.length;i++){
    if(format[i]==='['){depth++;if(depth>64)return null;}
    else if(format[i]===']'){
      depth--;if(depth<0)return null;
      if(depth===0){close=i;break;}
    }
  }
  if(close<0||format[close-1]!=='>')return null;
  const suffix=format.slice(close+1);
  if(!/^[1-9][0-9]{0,2}$/.test(suffix))return null;
  const count=Number(suffix);
  if(count>256)return null;
  return Object.freeze({declaredBankCount:count,tableByteLength:count*4,
    shape:'fixed-pointer-table',metadataOnly:true,romAuthenticated:false,
    writeAuthorized:false});
}

export function inspectHmaDeclaredBankPointerTable(rom,summary){
  // Preserve the existing fail-closed anchor provenance checks.
  const anchor=inspectHmaMapBankRawPointer(rom,summary);
  const count=summary?.declaredBankCount;
  if(!Number.isSafeInteger(count)||count<1||count>256||
     summary?.declaredTableByteLength!==count*4)
    throw new RangeError('No bounded fixed bank-table count in the imported metadata');
  const start=anchor.sourceOffset,end=start+count*4;
  if(end>rom.length)throw new RangeError('Declared bank pointer table exceeds ROM bounds');
  const rows=[],targets=new Map();
  let conventionalCount=0,inRomCount=0,duplicateTargetCount=0,unalignedCount=0,insideTableCount=0;
  for(let index=0;index<count;index++){
    const sourceOffset=start+index*4;
    let rawWord=0;
    for(let j=0;j<4;j++){
      const byte=rom.read(sourceOffset+j);
      if(!Number.isInteger(byte)||byte<0||byte>255)
        throw new RangeError('Invalid staged ROM byte');
      rawWord=(rawWord+byte*2**(8*j))>>>0;
    }
    const conventional=rawWord>=0x08000000&&rawWord<0x0A000000;
    const candidate=conventional?rawWord-0x08000000:null;
    const targetOffset=candidate!==null&&candidate<rom.length?candidate:null;
    const unaligned=targetOffset!==null&&targetOffset%4!==0;
    const pointsInsideTable=targetOffset!==null&&targetOffset>=start&&targetOffset<end;
    const firstTargetIndex=targetOffset!==null?targets.get(targetOffset):undefined;
    const duplicateOf=firstTargetIndex===undefined?null:firstTargetIndex;
    if(targetOffset!==null&&!targets.has(targetOffset))targets.set(targetOffset,index);
    if(conventional)conventionalCount++;
    if(targetOffset!==null)inRomCount++;
    if(unaligned)unalignedCount++;
    if(pointsInsideTable)insideTableCount++;
    if(duplicateOf!==null)duplicateTargetCount++;
    rows.push(Object.freeze({index,sourceOffset,rawWord,targetOffset,duplicateOf,
      unaligned,pointsInsideTable,status:targetOffset!==null?'in-rom-pointer':
        conventional?'out-of-rom-pointer':'not-conventional-pointer'}));
  }
  return Object.freeze({anchorOffset:start,declaredBankCount:count,tableByteLength:count*4,
    conventionalCount,inRomCount,duplicateTargetCount,unalignedCount,insideTableCount,
    rows:Object.freeze(rows),readOnly:true,metadataDeclared:true,
    romAuthenticated:false,cubeLayoutAuthenticated:false,writeAuthorized:false});
}
