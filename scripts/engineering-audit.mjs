import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluateParity} from './parity-audit.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const round=n=>Number(n.toFixed(1));

/** Provisional relative-effort estimate, never an independent acceptance claim. */
export function evaluateEngineeringWork(wbs,inventory,hasFile=path=>existsSync(resolve(root,path))){
 if(wbs?.schema!=='cube-mobile-engineering-wbs/1'||
    wbs.status!=='provisional-source-grounded-estimate-not-an-audit'||
    wbs.upstreamCommit!==inventory?.upstreamCommit||
    wbs.upstreamRepo!==inventory?.upstreamRepo)
  throw new RangeError('Engineering WBS provenance or provisional status mismatch');
 if(!Array.isArray(inventory.features)||inventory.features.length!==30||
    !Array.isArray(wbs.families)||wbs.families.length!==30||
    !Array.isArray(wbs.sharedWorkstreams)||wbs.sharedWorkstreams.length<1)
  throw new RangeError('Engineering baseline requires all 30 audited feature families and shared work');
 const source=new Map(inventory.features.map(f=>[f.id,f]));
 const ids=new Set();
 let units=0,low=0,mid=0,high=0;
 for(const item of [...wbs.families,...wbs.sharedWorkstreams]){
  if(!item||typeof item.id!=='string'||ids.has(item.id)||
     !Number.isSafeInteger(item.effortUnits)||item.effortUnits<1||item.effortUnits>50||
     typeof item.rationale!=='string'||item.rationale.length<24)
   throw new RangeError('Invalid or duplicate WBS workstream');
  ids.add(item.id);
  const c=item.completion;
  if(!c||![c.low,c.mid,c.high].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)||
     c.low>c.mid||c.mid>c.high)
   throw new RangeError('WBS completion bounds must be ordered fractions');
  if(source.has(item.id)){
   const feature=source.get(item.id);
   if(item.upstreamPath!==feature.upstreamPath||
      JSON.stringify(item.localEvidence)!==JSON.stringify(feature.localEvidence||[]))
    throw new RangeError('WBS feature source/evidence mismatch: '+item.id);
   if(feature.status==='absent'&&c.mid!==0)
    throw new RangeError('Absent feature cannot claim unsubstantiated completed work: '+item.id);
   for(const path of item.localEvidence)if(!hasFile(path))
    throw new RangeError('Missing feature evidence: '+path);
  }else{
   if(wbs.families.includes(item)||!Array.isArray(item.sourceRefs)||
      item.sourceRefs.length===0||item.sourceRefs.some(path=>!hasFile(path)))
    throw new RangeError('Missing shared-workstream evidence: '+item.id);
  }
  units+=item.effortUnits;
  low+=item.effortUnits*c.low;
  mid+=item.effortUnits*c.mid;
  high+=item.effortUnits*c.high;
 }
 for(const feature of inventory.features)if(!ids.has(feature.id))
  throw new RangeError('Missing WBS family: '+feature.id);
 if(wbs.milestones?.engineeringWorkPercent!==50||
    wbs.milestones?.strictVerifiedParityPercent!==20||
    wbs.confidence!=='low')
  throw new RangeError('Milestones and low-confidence status must remain explicit');
 return Object.freeze({
  status:wbs.status,confidence:wbs.confidence,
  totalRelativeEffortUnits:units,
  engineeringWorkPercent:round(100*mid/units),
  uncertaintyLowPercent:round(100*low/units),
  uncertaintyHighPercent:round(100*high/units),
  planningMilestonePercent:50,
  planningMilestoneMet:mid/units>=.5,
  independentAcceptanceVerified:false
 });
}

const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 const inventory=JSON.parse(readFileSync(resolve(root,'parity/feature-inventory.json'),'utf8'));
 const wbs=JSON.parse(readFileSync(resolve(root,'parity/engineering-wbs.json'),'utf8'));
 const engineering=evaluateEngineeringWork(wbs,inventory);
 const parity=evaluateParity(inventory);
 console.log('Provisional engineering effort: '+engineering.engineeringWorkPercent+
  '% (judgement uncertainty '+engineering.uncertaintyLowPercent+'–'+
  engineering.uncertaintyHighPercent+'%; confidence LOW; NOT independently audited).');
 console.log('50% engineering planning milestone: '+(engineering.planningMilestoneMet?'met':'not met')+'.');
 console.log('Separate strict verified parity: '+parity.verified+'/'+parity.total+
  ' ('+parity.verifiedPercent+'%); 20% validation milestone: '+
  (parity.reached20Percent?'met':'not met')+'.');
}
