/**
 * Bounded, raw-only pointer word window at a TOML-declared map-bank anchor.
 * Rows are bytes, NOT bank entries, map counts or custom CUBE structures.
 */
import {inspectHmaMapBankRawPointer} from './hma-map-bank-raw-pointer.js';

export function inspectHmaMapBankRawWindow(rom,summary,{words=16}={}){
  if(!Number.isSafeInteger(words)||words<1||words>32)
    throw new RangeError('Raw pointer window must contain 1–32 words');
  const first=inspectHmaMapBankRawPointer(rom,summary);
  const start=first.sourceOffset;
  if(start>rom.length-words*4)
    throw new RangeError('Raw pointer window extends beyond the staged ROM');
  const rows=[];
  let conventional=0,inRom=0;
  for(let index=0;index<words;index++){
    const sourceOffset=start+index*4;
    let rawWord=0;
    for(let j=0;j<4;j++){
      const byte=rom.read(sourceOffset+j);
      if(!Number.isInteger(byte)||byte<0||byte>255)
        throw new RangeError('Invalid staged ROM byte in raw pointer window');
      rawWord=(rawWord+byte*2**(8*j))>>>0;
    }
    const isConventional=rawWord>=0x08000000&&rawWord<0x0A000000;
    const candidate=isConventional?rawWord-0x08000000:null;
    const targetOffset=candidate!==null&&candidate<rom.length?candidate:null;
    if(isConventional)conventional++;
    if(targetOffset!==null)inRom++;
    rows.push(Object.freeze({
      index,sourceOffset,rawWord,targetOffset,
      status:targetOffset!==null?'in-rom-pointer':
        isConventional?'out-of-rom-pointer':'not-conventional-pointer'
    }));
  }
  return Object.freeze({
    anchorOffset:start,wordCount:words,conventionalCount:conventional,
    inRomCount:inRom,rows:Object.freeze(rows),
    readOnly:true,romAuthenticated:false,cubeLayoutAuthenticated:false,
    writeAuthorized:false
  });
}
