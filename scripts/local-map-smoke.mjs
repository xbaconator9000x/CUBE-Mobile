#!/usr/bin/env node
/**
 * LOCAL-ONLY structural smoke check for a user-supplied GBA ROM and an
 * independently supplied exact hash + explicit vanilla map-table declaration.
 * Never uploads, patches, saves or exports ROM bytes. This is NOT authentic
 * CUBE compatibility certification or a parity acceptance report.
 */
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectVanillaMapAtlas,auditVanillaAtlasPointerAliases}
 from '../src/map-atlas.js';
import {inspectVanillaMapEvents} from '../src/map-events.js';
import {auditVanillaMapEventScripts} from '../src/vanilla-map-script-audit.js';
import {auditVanillaAtlasWideScriptAliases} from '../src/vanilla-script-alias-atlas.js';

function fail(message){throw new RangeError(message);}
function args(argv){
 if(argv.length!==4||argv[0]!=='--rom'||argv[2]!=='--manifest')
  fail('Usage: node scripts/local-map-smoke.mjs --rom <local.gba> --manifest <local.json>');
 return {romPath:argv[1],manifestPath:argv[3]};
}
function manifestFromText(text){
 let m;
 try{m=JSON.parse(text);}catch{fail('Manifest must contain valid JSON');}
 if(!m||typeof m!=='object'||Array.isArray(m)||
    m.schema!=='cube-mobile-local-map-smoke/1'||
    !/^[0-9a-f]{64}$/i.test(m.expectedSha256||'')||
    !['RSE','FRLG'].includes(m.family)||
    !Number.isSafeInteger(m.bankTableOffset)||m.bankTableOffset<0||
    m.bankTableOffset%4||
    !Array.isArray(m.bankMapCounts)||m.bankMapCounts.length<1||
    m.bankMapCounts.length>256||
    m.bankMapCounts.some(n=>!Number.isSafeInteger(n)||n<1||n>1024)||
    m.bankMapCounts.reduce((a,n)=>a+n,0)>4096||
    m.scanAllScriptAliases!==undefined&&typeof m.scanAllScriptAliases!=='boolean')
  fail('Manifest requires schema, SHA-256, family, aligned bank offset and bounded explicit counts');
 return m;
}
function main(){
 const {romPath,manifestPath}=args(process.argv.slice(2));
 const manifest=manifestFromText(readFileSync(manifestPath,'utf8'));
 const size=statSync(romPath).size;
 if(!Number.isSafeInteger(size)||size<1||size>128*1024*1024)
  fail('Local ROM size must be 1–128 MiB');
 const rom=new Uint8Array(readFileSync(romPath));
 const actualSha256=createHash('sha256').update(rom).digest('hex');
 if(actualSha256!==manifest.expectedSha256.toLowerCase())
  fail('Local ROM SHA-256 does not match the separately supplied manifest');
 const atlas=inspectVanillaMapAtlas(rom,{
  address:manifest.bankTableOffset,
  bankMapCounts:manifest.bankMapCounts,family:manifest.family
 });
 const aliases=auditVanillaAtlasPointerAliases(atlas,{
  maxGroups:16,maxReferences:8
 });
 const eventSummaries=[];
 for(const map of atlas.maps.slice(0,16)){
  const events=inspectVanillaMapEvents(rom,{
   address:map.mapHeaderOffset,family:manifest.family
  });
  const scriptAudit=auditVanillaMapEventScripts(rom,{
   address:map.mapHeaderOffset,family:manifest.family,
   maxRecords:32,maxBytes:64,maxCommands:16
  });
  eventSummaries.push({
   scriptPointersTotal:scriptAudit.totalRecords,
   scriptPointersInspected:scriptAudit.inspectedRecords,
   scriptPointersTruncated:scriptAudit.truncated,
   scriptPointerStatuses:scriptAudit.counts,
   scriptOperandPointerStatuses:scriptAudit.operandPointerStatuses,
   scriptOperandPointerRoles:scriptAudit.operandPointerRoles,
   bankIndex:map.bankIndex,mapIndex:map.mapIndex,
   objects:events.counts.objects,warps:events.counts.warps,
   scripts:events.counts.scripts,signposts:events.counts.signposts
  });
 }
 const scriptAliasAtlas=manifest.scanAllScriptAliases===true?
  auditVanillaAtlasWideScriptAliases(rom,atlas,{
   maxMaps:4096,maxPointerFields:32768,maxGroups:16,maxReferences:8
  }):null;
 const report={
  schema:'cube-mobile-local-map-smoke-report/1',
  romSha256:actualSha256,romSize:size,family:manifest.family,
  bankTableOffset:manifest.bankTableOffset,
  declaredBankCount:atlas.bankCount,declaredMapCount:atlas.mapCount,
  eventMapsInspected:eventSummaries.length,eventSummaries,
  aliasGroups:aliases.totalGroups,aliasCounts:aliases.counts,
  aliasesTruncated:aliases.truncated,
  scriptAliasAtlas:scriptAliasAtlas?{
   mapsInspected:scriptAliasAtlas.mapsInspected,
   pointerFields:scriptAliasAtlas.pointerFields,
   inRomPointers:scriptAliasAtlas.inRomPointers,
   distinctTargets:scriptAliasAtlas.distinctTargets,
   sharedTargets:scriptAliasAtlas.totalGroups,
   groupsTruncated:scriptAliasAtlas.truncated,
   layoutAuthenticated:false,ownershipAuthenticated:false
  }:null,
  readOnly:true,romModified:false,romExported:false,
  hashMatchedUserDeclaration:true,
  layoutAuthenticated:false,cubeCompatibilityVerified:false,
  romSaveReopenVerified:false,emulatorVerified:false,
  androidHardwareVerified:false,independentParityEvidence:false,
  warning:'Hash-matched user declaration and vanilla structural smoke only. This is not CUBE authentication, a save/reopen test, or independent feature-parity evidence.'
 };
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
try{main();}catch(error){
 // Avoid accidentally printing local filesystem paths in shared CI logs.
 const message=error instanceof RangeError?error.message:
  'Could not read local input or inspect the declared vanilla structure';
 process.stderr.write('Local map smoke failed: '+message+'\n');
 process.exitCode=1;
}
