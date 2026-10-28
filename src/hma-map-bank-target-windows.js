/**
 * Read-only, bounded second-hop raw word evidence for HMA map-bank pointers.
 * Pinned upstream CUBHMA MapModel.cs: AllMapsModel[index] calls
 * GetSubTable("maps"), MapBankModel[index] calls GetSubTable("map").
 * These words are NOT authenticated map pointers, counts or structures.
 */
import {inspectHmaDeclaredBankPointerTable} from './hma-map-bank-declared-table.js';

function rawWord(rom,offset){
  let value=0;
  for(let i=0;i<4;i++){
    const byte=rom.read(offset+i);
    if(!Number.isInteger(byte)||byte<0||byte>255)
      throw new RangeError('Invalid staged ROM byte in bank target window');
    value=(value+byte*2**(8*i))>>>0;
  }
  return value;
}
function overlaps(a,as,b,bs){return a<b+bs&&b<a+as;}

/**
 * Samples a short fixed number of raw words at each unique, aligned in-ROM
 * target of the metadata-declared bank table. Never scans for sentinels,
 * infers map counts or follows a third pointer hop.
 */
export function inspectHmaDeclaredBankTargetWindows(rom,summary,{
  wordsPerTarget=8,maxUniqueTargets=64
}={}){
  if(!Number.isSafeInteger(wordsPerTarget)||wordsPerTarget<1||wordsPerTarget>16||
     !Number.isSafeInteger(maxUniqueTargets)||maxUniqueTargets<1||maxUniqueTargets>256)
    throw new RangeError('Invalid bounded bank target window limits');
  const table=inspectHmaDeclaredBankPointerTable(rom,summary);
  const windowBytes=wordsPerTarget*4;
  const seen=new Map(),sampled=[];
  const rows=[];
  let invalidTargets=0,misalignedTargets=0,tableOverlaps=0;
  let truncatedTargets=0,overlappingWindows=0,duplicateTargets=0;
  let conventionalNestedWords=0,inRomNestedWords=0,zeroWords=0;
  for(const entry of table.rows){
    const base={slotIndex:entry.index,sourceOffset:entry.sourceOffset,
      rawWord:entry.rawWord,targetOffset:entry.targetOffset};
    let status=null,sampleOf=null,words=Object.freeze([]);
    const target=entry.targetOffset;
    if(target===null){status='invalid-target';invalidTargets++;}
    else if(seen.has(target)){
      status='duplicate-target';sampleOf=seen.get(target);duplicateTargets++;
    }else if(target%4!==0){status='unaligned-target';misalignedTargets++;}
    else if(overlaps(target,windowBytes,table.anchorOffset,table.tableByteLength)){
      status='table-overlap';tableOverlaps++;
    }else if(target>rom.length-windowBytes){
      status='truncated-target';truncatedTargets++;
    }else if(sampled.some(s=>overlaps(target,windowBytes,s.targetOffset,windowBytes))){
      status='overlapping-window';overlappingWindows++;
    }else{
      if(sampled.length>=maxUniqueTargets)
        throw new RangeError('Unique bank target sample budget exceeded');
      status='sampled';sampleOf=entry.index;
      const wordRows=[];
      for(let i=0;i<wordsPerTarget;i++){
        const sourceOffset=target+i*4,raw=rawWord(rom,sourceOffset);
        const conventional=raw>=0x08000000&&raw<0x0A000000;
        const candidate=conventional?raw-0x08000000:null;
        const targetOffset=candidate!==null&&candidate<rom.length?candidate:null;
        if(conventional)conventionalNestedWords++;
        if(targetOffset!==null)inRomNestedWords++;
        if(raw===0)zeroWords++;
        wordRows.push(Object.freeze({index:i,sourceOffset,rawWord:raw,
          targetOffset,status:targetOffset!==null?'in-rom-pointer':
            conventional?'out-of-rom-pointer':'not-conventional-pointer'}));
      }
      words=Object.freeze(wordRows);
      seen.set(target,entry.index);
      sampled.push(Object.freeze({slotIndex:entry.index,targetOffset:target,words}));
    }
    rows.push(Object.freeze({...base,status,sampleOf,words}));
  }
  return Object.freeze({
    anchorOffset:table.anchorOffset,declaredBankCount:table.declaredBankCount,
    wordsPerTarget,windowBytes,sampledTargets:sampled.length,
    invalidTargets,misalignedTargets,tableOverlaps,truncatedTargets,
    overlappingWindows,duplicateTargets,conventionalNestedWords,
    inRomNestedWords,zeroWords,rows:Object.freeze(rows),
    samples:Object.freeze(sampled),readOnly:true,metadataDeclared:true,
    romAuthenticated:false,cubeLayoutAuthenticated:false,
    writeAuthorized:false
  });
}
