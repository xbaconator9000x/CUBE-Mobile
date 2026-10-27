import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function evaluateParity(data,hasFile=path=>existsSync(resolve(root,path))){
 if(!data||!Array.isArray(data.features)||!data.features.length)
  throw new TypeError('Nonempty feature inventory required');
 if(!/^[0-9a-f]{40}$/.test(data.upstreamCommit||''))
  throw new RangeError('Pinned upstream SHA required');
 const ids=new Set();let complete=0,partial=0,absent=0;
 for(const feature of data.features){
  if(!/^[a-z][a-z0-9-]+$/.test(feature.id||'')||ids.has(feature.id))
   throw new RangeError('Duplicate or invalid feature ID');
  ids.add(feature.id);
  if(!feature.upstreamPath?.startsWith('src/HexManiac.Core/')||
     !feature.upstreamPath.endsWith('.cs'))
   throw new RangeError('Source-grounded upstream C# path required');
  if(!['absent','partial','verified'].includes(feature.status))
   throw new RangeError('Invalid feature status');
  if(feature.status==='verified'){
   const evidence=feature.verification;
   for(const key of ['mobileUI','automatedTests','authenticRoundtrip','emulatorReport','androidReport','cubeCompatibility']){
    if(!evidence?.[key]||!hasFile(evidence[key]))
     throw new RangeError('Verified feature lacks '+key+': '+feature.id);
   }
   complete++;
  }else if(feature.status==='partial'){
   if(!Array.isArray(feature.localEvidence)||!feature.localEvidence.length||
      feature.localEvidence.some(path=>!hasFile(path)))
    throw new RangeError('Partial feature lacks local test evidence: '+feature.id);
   partial++;
  }else absent++;
 }
 return Object.freeze({total:data.features.length,verified:complete,partial,absent,
  verifiedPercent:Number((100*complete/data.features.length).toFixed(2)),
  reached20Percent:complete/data.features.length>=0.2});
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 const data=JSON.parse(readFileSync(resolve(root,'parity/feature-inventory.json'),'utf8'));
 const result=evaluateParity(data);
 console.log('Pinned upstream: '+data.upstreamRepo+'@'+data.upstreamCommit);
 console.log('Strict end-to-end verified parity: '+result.verified+'/'+result.total+
  ' ('+result.verifiedPercent+'%). Partial: '+result.partial+
  '; absent: '+result.absent+'. Target >=20%: '+(result.reached20Percent?'met':'NOT met'));
}
