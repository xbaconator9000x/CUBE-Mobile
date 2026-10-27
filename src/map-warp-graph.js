/**
 * Read-only directed graph of RAW vanilla warp/connection references.
 * Structures: pinned kcradi/CUBHMA MapModel.cs, AllMapsModel,
 * EventsFormat/WarpsFormat and ConnectionsFormat.
 *
 * A graph edge is not proof that the player can travel between maps.
 * Scripted warps, special 0xFF values, runtime conditions and CUBE
 * expansions are not interpreted. No ROM bytes are changed.
 */
import {inspectVanillaMapBankEntry} from './map-discovery.js';
import {inspectVanillaMapEvents} from './map-events.js';
import {inspectVanillaMapConnections} from './map-connections.js';

const key=(bank,map)=>bank+','+map;
const frozen=a=>Object.freeze(a);
export function auditVanillaAtlasWarpGraph(source,atlas,{
  originBank=0,originMap=0,maxMaps=256,maxLinks=16384,
  maxRows=128,maxFindings=128
}={}){
  if(!(source instanceof Uint8Array)&&!(source&&
    Number.isSafeInteger(source.length)&&source.length>=0&&
    typeof source.read==='function'))
    throw new TypeError('Read-only ROM bytes or accessor required');
  if(!atlas||atlas.readOnly!==true||atlas.layoutAuthenticated!==false||
    !['RSE','FRLG'].includes(atlas.family)||!Array.isArray(atlas.maps)||
    !Array.isArray(atlas.bankMapCounts)||!Number.isSafeInteger(atlas.address)||
    atlas.address<0||atlas.address%4||
    atlas.bankMapCounts.length<1||atlas.bankMapCounts.length>256||
    atlas.bankMapCounts.some(n=>!Number.isSafeInteger(n)||n<1||n>1024)||
    atlas.bankMapCounts.reduce((sum,n)=>sum+n,0)!==atlas.maps.length)
    throw new TypeError('Explicit declared vanilla map atlas required');
  for(const [name,n,limit] of [
    ['maxMaps',maxMaps,4096],['maxLinks',maxLinks,65536],
    ['maxRows',maxRows,4096],['maxFindings',maxFindings,1024]
  ])if(!Number.isSafeInteger(n)||n<1||n>limit)
    throw new RangeError(name+' outside bounded inspection limits');
  if(atlas.maps.length<1||atlas.maps.length>maxMaps)
    throw new RangeError('Declared atlas exceeds graph map budget; no partial result');
  if(!Number.isSafeInteger(originBank)||!Number.isSafeInteger(originMap)||
    originBank<0||originMap<0)
    throw new RangeError('Origin must be a declared bank/map');
  const nodes=[],byId=new Map(),rawLinks=[];
  let expectedBank=0,expectedMap=0;
  // Re-derive every canonical bank/map pointer and map layout from ROM.
  // Never trust caller-supplied map headers or reordered atlas entries.
  for(const m of atlas.maps){
    if(!m||m.bankIndex!==expectedBank||m.mapIndex!==expectedMap)
      throw new RangeError('Declared atlas map order or identity changed');
    expectedMap++;
    if(expectedMap===atlas.bankMapCounts[expectedBank]){
      expectedBank++;expectedMap=0;
    }
    const canonical=inspectVanillaMapBankEntry(source,{
      address:atlas.address,bankCount:atlas.bankMapCounts.length,
      bankIndex:m.bankIndex,mapCount:atlas.bankMapCounts[m.bankIndex],
      mapIndex:m.mapIndex,family:atlas.family
    });
    if(m.mapPointerSource!==canonical.mapPointerSource||
      m.mapHeaderOffset!==canonical.mapHeaderOffset||
      m.layoutOffset!==canonical.header.layoutOffset||
      m.blockmapOffset!==canonical.header.layout.blockmapOffset||
      m.width!==canonical.header.layout.width||
      m.height!==canonical.header.layout.height)
      throw new RangeError('Declared atlas map pointer or layout changed');
    const id=key(m.bankIndex,m.mapIndex);
    const node={id,bankIndex:m.bankIndex,mapIndex:m.mapIndex,
      headerOffset:m.mapHeaderOffset,incoming:0,outgoing:0,
      warpCount:0,connectionCount:0};
    const events=inspectVanillaMapEvents(source,{
      address:m.mapHeaderOffset,family:atlas.family
    });
    const connections=inspectVanillaMapConnections(source,{
      address:m.mapHeaderOffset,family:atlas.family
    });
    node.warpCount=events.arrays.warps.length;
    node.connectionCount=connections.connections.length;
    byId.set(id,node);nodes.push(node);
    for(const w of events.arrays.warps)rawLinks.push({
      source:id,kind:'warp',index:w.index,offset:w.offset,
      targetBank:w.targetBank,targetMap:w.targetMap,targetWarpId:w.warpId
    });
    for(const c of connections.connections)rawLinks.push({
      source:id,kind:'connection',index:c.index,offset:c.offset,
      targetBank:c.targetBank,targetMap:c.targetMap,targetWarpId:null
    });
    if(rawLinks.length>maxLinks)
      throw new RangeError('Declared atlas exceeds graph link budget; no partial result');
  }
  const origin=key(originBank,originMap);
  if(!byId.has(origin))throw new RangeError('Origin outside declared atlas');
  const edges=[],anomalies=[];
  const counts={resolved:0,special:0,undeclared:0,invalidWarp:0,
    warps:0,connections:0,oneWayPairs:0};
  const adjacency=new Map(nodes.map(n=>[n.id,new Set()]));
  for(const link of rawLinks){
    counts[link.kind==='warp'?'warps':'connections']++;
    const targetId=key(link.targetBank,link.targetMap);
    const target=byId.get(targetId);
    let status;
    if(link.targetBank===255||link.targetMap===255||
      link.kind==='warp'&&link.targetWarpId===255)status='special';
    else if(!target)status='undeclared';
    else if(link.kind==='warp'&&link.targetWarpId>=target.warpCount)
      status='invalidWarp';
    else status='resolved';
    counts[status]++;
    if(status==='resolved'){
      adjacency.get(link.source).add(targetId);
      byId.get(link.source).outgoing++;
      target.incoming++;
      edges.push(frozen({...link,targetId,status}));
    }else anomalies.push(frozen({...link,targetId,status}));
  }
  const oneWay=[];
  for(const [from,targets] of adjacency){
    for(const to of targets){
      if(from!==to&&!adjacency.get(to).has(from)){
        counts.oneWayPairs++;
        oneWay.push(frozen({source:from,target:to,status:'no-direct-return'}));
      }
    }
  }
  const reached=new Set([origin]),queue=[origin];
  for(let i=0;i<queue.length;i++){
    for(const target of adjacency.get(queue[i])){
      if(!reached.has(target)){reached.add(target);queue.push(target);}
    }
  }
  const rows=nodes.slice(0,maxRows).map(n=>frozen({
    bankIndex:n.bankIndex,mapIndex:n.mapIndex,
    headerOffset:n.headerOffset,incoming:n.incoming,outgoing:n.outgoing,
    warpCount:n.warpCount,connectionCount:n.connectionCount,
    reachableByRawLinks:reached.has(n.id)
  }));
  const findings=[...anomalies,...oneWay].slice(0,maxFindings);
  return frozen({
    originBank,originMap,mapsInspected:nodes.length,linksInspected:rawLinks.length,
    reachableByRawLinks:reached.size,notReachedByRawLinks:nodes.length-reached.size,
    isolatedMaps:nodes.filter(n=>!n.incoming&&!n.outgoing).length,
    counts:frozen(counts),rows:frozen(rows),rowsTruncated:rows.length<nodes.length,
    findings:frozen(findings),totalFindings:anomalies.length+oneWay.length,
    findingsTruncated:findings.length<anomalies.length+oneWay.length,
    readOnly:true,layoutAuthenticated:false,gameplayReachabilityVerified:false,
    cubeCompatibilityVerified:false,writeAuthorized:false,
    independentParityEvidence:false
  });
}
