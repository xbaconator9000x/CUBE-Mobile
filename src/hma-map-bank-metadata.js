/**
 * Read-only bridge from real imported HMA [[NamedAnchors]] declarations to
 * the upstream CUBHMA map-bank format hierarchy. No ROM format is inferred.
 *
 * Source: kcradi/CUBHMA MapModel.cs AllMapsModel.Create uses the
 * "data.maps.banks" table; Format(model) obtains its FormatString and
 * extracts map<...> metadata. The metadata is evidence, NOT authentication.
 */
import {parseHmaNamedAnchors} from './semantic.js';
import {inspectHmaMapFormatHierarchy} from './hma-map-format-hierarchy.js';
import {auditHmaMapPointerMultiplicity} from './hma-map-format-ambiguity.js';

const MAP_BANK_ANCHOR='data.maps.banks';
const MAX_SOURCES=64;
const MAX_DECLARATIONS=128;

function result(status, declarations, extra={}) {
  return Object.freeze({
    status,anchorName:MAP_BANK_ANCHOR,
    declarationCount:declarations.length,
    declarations:Object.freeze(declarations.map(d=>Object.freeze(d))),
    readOnly:true,romAuthenticated:false,cubeLayoutAuthenticated:false,
    writeAuthorized:false,...extra
  });
}

/**
 * Compare exact named-anchor declarations across TOML sources, including
 * duplicates, conflicting overlays, invalid ROM spans and malformed formats.
 * A matching header, address or metadata declaration is NEVER sufficient
 * evidence to decode a custom CUBE map.
 */
export function inspectHmaMapBankAnchorSources(sources,{romSize=Infinity}={}){
  if(!Array.isArray(sources)||sources.length>MAX_SOURCES)
    throw new RangeError('Expected at most 64 named TOML sources');
  if(romSize!==Infinity&&(!Number.isSafeInteger(romSize)||romSize<0))
    throw new RangeError('Invalid ROM length');
  const declarations=[];
  const sourceNames=new Set();
  for(const source of sources){
    if(typeof source?.name!=='string'||!source.name.trim()||
       typeof source.text!=='string'||sourceNames.has(source.name))
      throw new TypeError('Each TOML source needs a unique name and text');
    sourceNames.add(source.name);
    for(const anchor of parseHmaNamedAnchors(source.text,{romSize})){
      if(anchor.name!==MAP_BANK_ANCHOR)continue;
      if(declarations.length>=MAX_DECLARATIONS)
        throw new RangeError('Too many map-bank anchor declarations');
      declarations.push({
        source:source.name,line:anchor.line,
        address:anchor.address,format:anchor.format,
        addressInBounds:romSize===Infinity?null:
          anchor.address%4===0&&anchor.address<=romSize-4
      });
    }
  }
  if(!declarations.length)return result('missing',declarations,{
    hierarchy:null,uniqueDeclarationCount:0
  });
  const signatures=new Set(declarations.map(d=>JSON.stringify([d.address,d.format])));
  const common={uniqueDeclarationCount:signatures.size};
  // HMA's metadata overlay precedence has not been ported: never silently
  // choose one of two differing map-bank declarations.
  if(signatures.size!==1)return result('conflicting-declarations',declarations,{
    ...common,hierarchy:null
  });
  const first=declarations[0];
  if(first.address%4!==0||first.addressInBounds===false)
    return result('invalid-address',declarations,{...common,hierarchy:null});
  let hierarchy,multiplicity;
  try {
    multiplicity=auditHmaMapPointerMultiplicity(first.format);
    if(!multiplicity.ambiguous)
      hierarchy=inspectHmaMapFormatHierarchy(first.format);
  } catch(err) {
    if(!(err instanceof RangeError))throw err;
    return result('malformed-format',declarations,{...common,hierarchy:null});
  }
  if(multiplicity.ambiguous)
    return result('ambiguous-format',declarations,{...common,hierarchy:null,multiplicity});
  const status=hierarchy.status==='custom-candidate'?'custom-candidate':
    hierarchy.status==='vanilla-marker'?'vanilla-marker':'unresolved-format';
  return result(status,declarations,{...common,hierarchy,multiplicity});
}
