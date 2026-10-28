#!/usr/bin/env node
/**
 * Local-only, SHA-256-matched raw CUBHMA map-bank table smoke.
 * User-provided expected hash is NOT independently curated authentication.
 * Emits aggregate counts only: never ROM bytes, addresses or local paths.
 */
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaDeclaredBankPointerTable} from '../src/hma-map-bank-declared-table.js';
import {inspectHmaDeclaredBankTargetWindows} from '../src/hma-map-bank-target-windows.js';
import {inspectHmaCubeMapEntry} from '../src/hma-cube-map-discovery.js';
import {inspectHmaCubeMapEventWarps} from '../src/hma-cube-map-events.js';
import {renderHmaCubeMapViewport} from '../src/hma-cube-map-render.js';
import {inspectHmaCubeMapScripts} from '../src/hma-cube-map-script-table.js';

const SHA=/^[0-9a-f]{64}$/i;
export function parseLocalCubeBankSmokeArgs(argv){
 if(!Array.isArray(argv)||argv.length<6||argv.length>26||argv.length%2!==0)
  throw new RangeError('Usage: --rom <local.gba> --metadata <local.toml> --expected-sha256 <64 hex>');
 const options={};
 for(let i=0;i<argv.length;i+=2){
  const key=argv[i],value=argv[i+1];
  if(!['--rom','--metadata','--expected-sha256','--target-words','--bank-index','--map-index','--map-count','--render-map','--expected-render-sha256',
      '--viewport-x','--viewport-y','--viewport-width','--viewport-height'].includes(key)||
     Object.hasOwn(options,key)||typeof value!=='string'||!value)
    throw new RangeError('Invalid local smoke arguments');
  options[key]=value;
 }
 if(!options['--rom']||!options['--metadata']||
    !SHA.test(options['--expected-sha256']||'')||
    (options['--target-words']!==undefined&&
     !/^(?:[1-9]|1[0-6])$/.test(options['--target-words'])))
  throw new RangeError('ROM, metadata and separately supplied exact SHA-256 are required');
 if(options['--render-map']!==undefined&&options['--render-map']!=='1')
  throw new RangeError('Use --render-map 1 for a bounded local render check');
 const viewKeys=['--viewport-x','--viewport-y','--viewport-width','--viewport-height'];
 if(options['--render-map']===undefined&&
    (options['--expected-render-sha256']!==undefined||
     viewKeys.some(key=>options[key]!==undefined)))
  throw new RangeError('Viewport and reference require --render-map 1');
 if(options['--expected-render-sha256']!==undefined&&
    !SHA.test(options['--expected-render-sha256']))
  throw new RangeError('Expected render reference must be a SHA-256 digest');
 for(const key of viewKeys){
  if(options[key]===undefined)continue;
  if(!/^(?:0|[1-9][0-9]{0,3})$/.test(options[key]))
   throw new RangeError('Invalid bounded viewport coordinate or dimension');
  const n=Number(options[key]);
  if(n>(key.endsWith('width')||key.endsWith('height')?32:1023)||
     ((key.endsWith('width')||key.endsWith('height'))&&n<1))
   throw new RangeError('Viewport exceeds 32-cell dimension or map coordinate budget');
 }
 const keys=['--bank-index','--map-index','--map-count'];
 const present=keys.filter(k=>options[k]!==undefined);
 if(options['--render-map']!==undefined&&present.length!==3)
  throw new RangeError('Render check requires a selected CUBE bank/map/count');
 if(present.length!==0&&present.length!==3)
  throw new RangeError('Custom map inspection requires bank index, map index and explicit map count together');
 if(present.length===3){
  for(const key of keys)if(!/^(?:0|[1-9][0-9]{0,3})$/.test(options[key]))
   throw new RangeError('Invalid explicit custom map selection');
  if(Number(options['--bank-index'])>255||Number(options['--map-index'])>1023||
     Number(options['--map-count'])<1||Number(options['--map-count'])>1024)
   throw new RangeError('Custom map selection exceeds bounded limits');
 }
 return options;
}
/** Domain-separated RGBA fingerprint; caller supplies independently obtained reference. */
export function fingerprintHmaCubeRenderedViewport(image){
 if(!image||!Number.isSafeInteger(image.width)||!Number.isSafeInteger(image.height)||
    image.width<1||image.height<1||image.width>512||image.height>512||
    !(image.pixels instanceof Uint8Array || image.pixels instanceof Uint8ClampedArray)||
    image.pixels.length!==image.width*image.height*4)
  throw new RangeError('Expected a bounded RGBA viewport');
 const dims=Buffer.alloc(8);
 dims.writeUInt32LE(image.width,0);dims.writeUInt32LE(image.height,4);
 return createHash('sha256').update('cube-mobile-rgba-v1\\0')
  .update(dims).update(image.pixels).digest('hex');
}
async function boundedRead(path,max){
 const before=await stat(path);
 if(!before.isFile()||before.size<1||before.size>max)
  throw new RangeError('Local input exceeds size budget');
 const bytes=await readFile(path);
 if(bytes.length!==before.size)
  throw new RangeError('Local input changed while reading');
 return bytes;
}
export async function inspectLocalCubeBankSmoke(argv){
 const args=parseLocalCubeBankSmokeArgs(argv);
 const rom=await boundedRead(args['--rom'],128*1024*1024);
 const digest=createHash('sha256').update(rom).digest('hex');
 if(digest!==args['--expected-sha256'].toLowerCase())
  throw new RangeError('ROM SHA-256 differs from separately supplied expectation');
 const toml=await boundedRead(args['--metadata'],4*1024*1024);
 const text=new TextDecoder('utf-8',{fatal:true}).decode(toml);
 const metadata=inspectHmaMapBankAnchorSources([{name:'local-metadata',text}],{romSize:rom.length});
 if(!['custom-candidate','vanilla-marker'].includes(metadata.status))
  throw new RangeError('No unambiguous bounded map-bank metadata declaration');
 const reader={length:rom.length,read:index=>rom[index]};
 const table=inspectHmaDeclaredBankPointerTable(reader,metadata);
 const targets=args['--target-words']===undefined?null:
   inspectHmaDeclaredBankTargetWindows(reader,metadata,
     {wordsPerTarget:Number(args['--target-words'])});
 const customOptions=args['--map-count']===undefined?null:{
   bankIndex:Number(args['--bank-index']),mapIndex:Number(args['--map-index']),
   mapCount:Number(args['--map-count'])};
 const custom=customOptions?inspectHmaCubeMapEntry(reader,metadata,customOptions):null;
 const events=customOptions?inspectHmaCubeMapEventWarps(reader,metadata,customOptions):null;
 const mapScripts=customOptions?inspectHmaCubeMapScripts(reader,metadata,customOptions):null;
 const render=args['--render-map']===undefined?null:
   renderHmaCubeMapViewport(reader,metadata,{...customOptions,
     x:Number(args['--viewport-x']??0),
     y:Number(args['--viewport-y']??0),
     viewportWidth:Number(args['--viewport-width']??10),
     viewportHeight:Number(args['--viewport-height']??8)});
 const expectedRender=args['--expected-render-sha256'];
 if(render&&expectedRender!==undefined&&
    fingerprintHmaCubeRenderedViewport(render)!==expectedRender.toLowerCase())
  throw new RangeError('CUBE render differs from supplied RGBA reference');
 return Object.freeze({
  schema:custom?'cube-mobile-local-cube-bank-table-smoke/3':'cube-mobile-local-cube-bank-table-smoke/2',
  hashMatchedUserDeclaration:true,
  metadataDeclarationStatus:metadata.status,
  declaredPointerSlots:table.declaredBankCount,
  conventionalPointerWords:table.conventionalCount,
  inRomPointerWords:table.inRomCount,
  repeatedTargets:table.duplicateTargetCount,
  unalignedTargets:table.unalignedCount,
  targetsInsideDeclaredTable:table.insideTableCount,
  ...(targets?{
    rawTargetWindowWords:targets.wordsPerTarget,
    rawTargetsSampled:targets.sampledTargets,
    rawNestedPointerShapedWords:targets.conventionalNestedWords,
    rawNestedInRomPointerWords:targets.inRomNestedWords,
    rawTargetOverlapSkips:targets.tableOverlaps+targets.overlappingWindows,
    rawTargetTruncationSkips:targets.truncatedTargets,
    rawTargetMisalignedSkips:targets.misalignedTargets,
    rawTargetInvalidSkips:targets.invalidTargets,
    rawTargetDuplicateSkips:targets.duplicateTargets
  }:{}),
  ...(custom?{
    customMapSelection:{bankIndex:custom.bankIndex,mapIndex:custom.mapIndex,
      explicitMapCount:custom.mapCount},
    customMapWidth:custom.layout.width,customMapHeight:custom.layout.height,
    customMapRawCellCount:custom.layout.width*custom.layout.height,
    customMapMetadataFormatRecognized:custom.metadataFormatRecognized,
    customMapScriptEntries:mapScripts.scriptEntries,
    customConditionalScriptTables:mapScripts.conditionalTableCount,
    customConditionalScriptEntries:mapScripts.conditionalEntries,
    customEventCounts:events.counts,customWarpOutsideMapCount:events.warps.filter(w=>w.outsideDeclaredMap).length,
    customWarpSpecialTargetCount:events.warps.filter(w=>w.specialTarget).length
  }:{}),
  ...(render?{
    customRenderMode:render.renderingMode,
    customRenderedMetatiles:render.columns*render.rows,
    customRenderedPixelCount:render.width*render.height,
    customRenderSupportedSubsetOnly:true,
    customRenderReferenceCompared:expectedRender!==undefined,
    customRenderReferenceMatched:expectedRender===undefined?null:true,
    customRenderReferenceIndependent:false,
    customRenderedOutputExported:false
  }:{}),
  readOnly:true,romModified:false,romExported:false,
  independentlyAuthenticated:false,cubeLayoutAuthenticated:false,
  safeSemanticEditingVerified:false,romSaveReopenVerified:false,
  emulatorVerified:false,androidHardwareVerified:false,
  independentParityEvidence:false,
  warning:'User-SHA-matched metadata and optional RGBA reference comparisons are not independently authenticated. They do not verify gameplay, device compatibility or strict parity.'
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const report=await inspectLocalCubeBankSmoke(process.argv.slice(2));
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
 }catch(error){
  const message=error instanceof RangeError?error.message:
   'Could not safely inspect local ROM and metadata inputs';
  process.stderr.write('Local CUBE bank smoke refused: '+message+'\n');
  process.exitCode=2;
 }
}
