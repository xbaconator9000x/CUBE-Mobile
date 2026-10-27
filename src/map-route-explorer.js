/**
 * Read-only shortest RAW vanilla map-link route across an explicitly declared
 * RSE/FRLG atlas. Based on pinned CUBHMA MapModel.cs EventsFormat /
 * WarpsFormat / ConnectionsFormat. No scripted or gameplay travel is inferred.
 * Every input atlas map is independently revalidated by the graph audit.
 */
import {auditVanillaAtlasWarpGraph} from './map-warp-graph.js';
import {inspectVanillaMapEvents} from './map-events.js';
import {inspectVanillaMapConnections} from './map-connections.js';

const id=(bank,map)=>bank+','+map;
const freeze=Object.freeze;
export function inspectVanillaAtlasRawRoute(source,atlas,{
 originBank=0,originMap=0,targetBank,targetMap,
 maxMaps=256,maxLinks=16384,maxHops=256
}={}){
 for(const [name,value,limit] of [
  ['maxMaps',maxMaps,4096],['maxLinks',maxLinks,65536],
  ['maxHops',maxHops,4096]
 ])if(!Number.isSafeInteger(value)||value<1||value>limit)
  throw new RangeError(name+' must be a positive bounded integer');
 if(!Number.isSafeInteger(targetBank)||targetBank<0||
    !Number.isSafeInteger(targetMap)||targetMap<0)
  throw new RangeError('Select an explicit target bank and map');
 // Fail closed on forged atlas order, stale map pointers, malformed structures,
 // and budgets BEFORE deriving any route.
 const audit=auditVanillaAtlasWarpGraph(source,atlas,{
  originBank,originMap,maxMaps,maxLinks,maxRows:1,maxFindings:1
 });
 const from=id(originBank,originMap),to=id(targetBank,targetMap);
 const nodes=new Map(atlas.maps.map(m=>[id(m.bankIndex,m.mapIndex),m]));
 if(!nodes.has(to))throw new RangeError('Target is outside the declared atlas');
 const records=new Map(),warpCounts=new Map();
 for(const m of atlas.maps){
  const k=id(m.bankIndex,m.mapIndex);
  const events=inspectVanillaMapEvents(source,{
   address:m.mapHeaderOffset,family:atlas.family
  });
  const connections=inspectVanillaMapConnections(source,{
   address:m.mapHeaderOffset,family:atlas.family
  });
  warpCounts.set(k,events.arrays.warps.length);
  records.set(k,{events,connections});
 }
 const adjacency=new Map(),eligible=[];
 for(const m of atlas.maps){
  const k=id(m.bankIndex,m.mapIndex),{events,connections}=records.get(k);
  const outgoing=[];
  for(const w of events.arrays.warps){
   const target=id(w.targetBank,w.targetMap);
   if(w.targetBank===255||w.targetMap===255||w.warpId===255||
      !nodes.has(target)||w.warpId>=warpCounts.get(target))continue;
   outgoing.push(freeze({kind:'warp',source:k,target,
    sourceOffset:w.offset,index:w.index,targetWarpId:w.warpId}));
  }
  for(const c of connections.connections){
   const target=id(c.targetBank,c.targetMap);
   if(c.targetBank===255||c.targetMap===255||!nodes.has(target))continue;
   outgoing.push(freeze({kind:'connection',source:k,target,
    sourceOffset:c.offset,index:c.index,direction:c.direction,
    displacement:c.displacement}));
  }
  adjacency.set(k,outgoing);
  eligible.push(...outgoing);
 }
 if(eligible.length!==audit.counts.resolved)
  throw new RangeError('Raw map links changed during route inspection; retry');
 const queue=[from],visited=new Set(queue),parents=new Map();
 for(let head=0;head<queue.length;head++){
  const current=queue[head];
  if(current===to)break;
  for(const edge of adjacency.get(current)){
   if(visited.has(edge.target))continue;
   visited.add(edge.target);parents.set(edge.target,edge);
   queue.push(edge.target);
  }
 }
 const reachable=visited.has(to),reverse=[];
 if(reachable){
  let cursor=to;
  while(cursor!==from){
   const edge=parents.get(cursor);
   if(!edge)throw new RangeError('Incomplete raw route predecessor chain');
   reverse.push(edge);cursor=edge.source;
  }
 }
 if(reverse.length>maxHops)
  throw new RangeError('Raw shortest route exceeds display hop budget');
 const steps=freeze(reverse.reverse());
 return freeze({
  originBank,originMap,targetBank,targetMap,
  status:reachable?'raw-reachable':'raw-unreachable',
  hops:reachable?steps.length:null,steps,
  mapsInspected:audit.mapsInspected,linksInspected:audit.linksInspected,
  eligibleLinks:eligible.length,visitedMaps:visited.size,
  excludedLinks:audit.linksInspected-eligible.length,
  readOnly:true,layoutAuthenticated:false,
  gameplayReachabilityVerified:false,cubeCompatibilityVerified:false,
  writeAuthorized:false,independentParityEvidence:false
 });
}
