/**
 * Read-only CUBE custom connection destination inspection.
 * Source: pinned CUBHMA MapModel.cs ConnectionsFormat and cube_emerald.toml.
 * Destination map counts are explicit. Direction/displacement are raw engine
 * fields, not evidence of traversability or reciprocal gameplay geometry.
 */
import {inspectHmaCubeMapConnections} from './hma-cube-map-connections.js';
import {inspectHmaCubeMapEntry} from './hma-cube-map-discovery.js';

function bounded(value, limit, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value >= limit)
    throw new RangeError(label + ' outside explicit bounds');
}
export function traceHmaCubeConnectionDestination(source, summary, {
  bankIndex, mapIndex, mapCount, connectionIndex, targetMapCount
} = {}) {
  const options = {bankIndex, mapIndex, mapCount};
  const origin = inspectHmaCubeMapConnections(source, summary, options);
  bounded(connectionIndex, origin.connections.length, 'Connection index');
  const record = origin.connections[connectionIndex];
  const base = {
    sourceBank:bankIndex, sourceMap:mapIndex, sourceConnectionIndex:connectionIndex,
    sourceOffset:record.offset, direction:record.direction,
    displacement:record.displacement, targetBank:record.targetBank,
    targetMap:record.targetMap, readOnly:true, romAuthenticated:false,
    cubeLayoutAuthenticated:false, travelVerified:false, writeAuthorized:false
  };
  const outcome = (status, fields={}) => Object.freeze({...base, status, ...fields});
  if (record.targetBank===255 || record.targetMap===255)
    return outcome('special-or-unresolved');
  if (record.targetBank>=origin.map.declaredBankCount)
    return outcome('outside-declared-bank-table');
  if (!Number.isSafeInteger(targetMapCount) || targetMapCount<1 || targetMapCount>128)
    throw new RangeError('Explicit target-bank map count must be 1–128');
  if (record.targetMap>=targetMapCount)
    return outcome('outside-explicit-target-map-count');
  const targetOptions = {
    bankIndex:record.targetBank, mapIndex:record.targetMap, mapCount:targetMapCount
  };
  let destination, links;
  try {
    destination = inspectHmaCubeMapEntry(source, summary, targetOptions);
    links = inspectHmaCubeMapConnections(source, summary, targetOptions);
  } catch (_error) {
    return outcome('invalid-or-unsupported-target');
  }
  const backLinks = Object.freeze(links.connections
    .filter(link=>link.targetBank===bankIndex && link.targetMap===mapIndex)
    .map(link=>Object.freeze({
      index:link.index, offset:link.offset, direction:link.direction,
      displacement:link.displacement
    })));
  return outcome('resolved-raw', {
    targetMapCount, targetHeaderOffset:destination.header.address,
    targetWidth:destination.layout.width, targetHeight:destination.layout.height,
    targetConnectionCount:links.count, backLinks,
    rawReturnLinkPresent:backLinks.length>0
  });
}
