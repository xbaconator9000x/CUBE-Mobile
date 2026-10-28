/**
 * Safe mobile view model for upstream CUBHMA data.maps.banks metadata.
 * Does not expose raw format strings, TOML content or ROM bytes.
 * Evidence is not ROM authentication and never grants write authority.
 */
import {inspectHmaMapBankAnchorSources} from './hma-map-bank-metadata.js';

export function summarizeHmaMapBankSources(sources,{romSize=Infinity}={}){
  const report=inspectHmaMapBankAnchorSources(sources,{romSize});
  const declarations=report.declarations.map(d=>Object.freeze({
    source:d.source,line:d.line,address:d.address,
    formatLength:d.format.length,addressInBounds:d.addressInBounds
  }));
  const sections=report.hierarchy?.sections?
    Object.entries(report.hierarchy.sections).filter(([,format])=>format!==null).map(([name])=>name):[];
  return Object.freeze({
    status:report.status,anchorName:report.anchorName,
    declarationCount:report.declarationCount,
    uniqueDeclarationCount:report.uniqueDeclarationCount,
    declarations:Object.freeze(declarations),
    sectionNames:Object.freeze(sections),
    vanillaMarker:report.hierarchy?.vanillaMarker===true,
    ambiguousFields:Object.freeze((report.multiplicity?.duplicates||[]).map(d=>
      Object.freeze({scope:d.scope,name:d.name,count:d.count}))),
    readOnly:true,romAuthenticated:false,cubeLayoutAuthenticated:false,
    writeAuthorized:false
  });
}
