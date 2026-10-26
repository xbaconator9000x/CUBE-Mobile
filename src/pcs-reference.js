/**
 * Read-only, deliberately unauthenticated parser for HMA's pcsReference.txt.
 * Source: kcradi/CUBHMA src/HexManiac.Core/Models/PCSString.cs
 * (GetPCSFromReference, GetControlCodeLengthsFromReference,
 * GetTextMacrosFromReference, GetLengthForControlCode, FindMacro).
 * It does not write/encode ROM text or authenticate a CUBE ROM layout.
 */
const games = Object.freeze(['AXVE','AXPE','BPRE','BPGE','BPEE']);
const byteHex = v => v.toString(16).toUpperCase().padStart(2,'0');
const limit = 1024 * 1024;
const maxMacros = 2048;

function parseMacroBytes(source,line) {
  const tokens = source.trim().split(/[\s,]+/);
  if (!tokens.length || tokens.length === 1 && !tokens[0]) throw Error('Empty PCS macro at line '+line);
  const bytes = [];
  for (const token of tokens) {
    const hex = token.replace(/^0x/i,'');
    if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw Error('Invalid PCS macro bytes at line '+line);
    for (let i=0;i<hex.length;i+=2) {
      bytes.push(parseInt(hex.slice(i,i+2),16));
      if (bytes.length>64) throw Error('PCS macro exceeds 64 bytes at line '+line);
    }
  }
  return Object.freeze(bytes);
}

/** Parse a locally supplied upstream-style reference; reject ambiguous overrides. */
export function parseHmaPcsReference(source) {
  if (typeof source!=='string' || source.length>limit) throw Error('PCS reference exceeds 1 MiB or is not text');
  const lines = source.replace(/^\uFEFF/,'').split(/\r?\n/);
  if (lines.length>20000) throw Error('Too many PCS reference lines');
  const glyphs = Array(256).fill(null);
  const controlCodeLengths = Object.create(null);
  const macrosByGame = Object.fromEntries(games.map(g=>[g,Object.create(null)]));
  let activeGames=games,macroCount=0,glyphCount=0;
  for (let index=0;index<lines.length;index++) {
    const lineNo=index+1,line=lines[index],trimmed=line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('@!game(')) {
      const match=/^@!game\(([^)]*)\)\s*(?:#.*)?$/.exec(trimmed);
      if (!match) throw Error('Invalid PCS game directive at line '+lineNo);
      const codes=match[1].match(/[A-Z0-9]{4}/g)||[];
      if (!codes.length || codes.some(g=>!games.includes(g)) ||
          match[1].replace(/[A-Z0-9]{4}|[\s,_|]/g,'').length)
        throw Error('Unsupported PCS game directive at line '+lineNo);
      activeGames=[...new Set(codes)];
      continue;
    }
    if (line.startsWith('0x')) {
      const match=/^0x([0-9a-f]{1,2})\s*=\s*(.*?)\s*(?:#.*)?$/i.exec(line);
      if (!match) throw Error('Malformed PCS glyph at line '+lineNo);
      const start=parseInt(match[1],16),raw=match[2].trim();
      const quoted=raw.length>=2 && raw[0]==='"' && raw.at(-1)==='"';
      // Upstream pcsReference.txt has `0xFF = "`: a literal one-character quote,
      // not an unterminated quoted range. C# GetPCSFromReference treats it as a glyph.
      if (raw.startsWith('"') && !quoted && raw!=='"') throw Error('Malformed PCS quoted glyph at line '+lineNo);
      const value=quoted?raw.slice(1,-1):raw;
      if (!value.length) throw Error('Empty PCS glyph at line '+lineNo);
      const chars=quoted?value.split(''):[value]; // C# reference uses UTF-16 char indexing
      if (start+chars.length>256) throw Error('PCS glyph range outside byte table at line '+lineNo);
      for (let i=0;i<chars.length;i++) {
        const at=start+i;
        if (glyphs[at]!==null && glyphs[at]!==chars[i])
          throw Error('Conflicting PCS glyph at line '+lineNo);
        if (glyphs[at]===null) glyphCount++;
        glyphs[at]=chars[i];
      }
      continue;
    }
    if (line.startsWith('CC_')) {
      const match=/^CC_([0-9a-f]{1,2})\s*=\s*(\d+)\s*(?:#.*)?$/i.exec(line);
      if (!match) throw Error('Malformed PCS control length at line '+lineNo);
      const code=parseInt(match[1],16),argumentsCount=Number(match[2]);
      if (!Number.isSafeInteger(argumentsCount) || argumentsCount>32)
        throw Error('Invalid PCS control length at line '+lineNo);
      const total=argumentsCount+1;
      if (controlCodeLengths[code]!==undefined && controlCodeLengths[code]!==total)
        throw Error('Conflicting PCS control length at line '+lineNo);
      controlCodeLengths[code]=total;
      continue;
    }
    if (line.startsWith('[')) {
      const match=/^(\[[^\]\r\n]{1,80}\])\s+(.+?)\s*(?:#.*)?$/.exec(line);
      if (!match) throw Error('Malformed PCS macro at line '+lineNo);
      const bytes=parseMacroBytes(match[2],lineNo);
      for (const game of activeGames) {
        const previous=macrosByGame[game][match[1]];
        if (previous && (previous.length!==bytes.length || previous.some((v,i)=>v!==bytes[i])))
          throw Error('Conflicting PCS macro at line '+lineNo);
        if (!previous) {
          if (++macroCount>maxMacros) throw Error('Too many PCS macros');
          macrosByGame[game][match[1]]=bytes;
        }
      }
    }
  }
  if (!glyphCount) throw Error('PCS reference has no glyph mappings');
  for (const game of games) Object.freeze(macrosByGame[game]);
  return Object.freeze({
    kind:'hma-pcs-reference-v1',
    glyphs:Object.freeze(glyphs),
    controlCodeLengths:Object.freeze(controlCodeLengths),
    macrosByGame:Object.freeze(macrosByGame),
    authenticated:false,editable:false
  });
}

function boundedBytes(bytes,start,length) {
  const read=bytes instanceof Uint8Array?i=>bytes[i]:
    typeof bytes?.read==='function'?i=>bytes.read(i):null;
  if (!read || !Number.isSafeInteger(bytes.length) ||
      !Number.isSafeInteger(start) || !Number.isSafeInteger(length) ||
      start<0 || length<1 || length>1024 ||
      start>bytes.length || length>bytes.length-start)
    throw Error('Invalid or out-of-bounds PCS reference span');
  const raw=Array.from({length},(_,i)=>read(start+i));
  if (raw.some(v=>!Number.isInteger(v)||v<0||v>255)) throw Error('Invalid ROM byte');
  return raw;
}

/**
 * Preview with an explicitly imported mapping and game-specific macros.
 * All matching is bounded to the selected span; no fallback glyph guessing.
 */
export function decodeHmaPcsReference(bytes,start,length,{gameCode,reference}={}) {
  if (!games.includes(gameCode) || reference?.kind!=='hma-pcs-reference-v1')
    return {supported:false,reason:'Recognised Gen 3 game code and parsed PCS reference required'};
  const raw=boundedBytes(bytes,start,length);
  // Upstream PCSString.FindMacro iterates the game's macro dictionary in
  // declaration order and returns the first complete match. Sorting by length
  // or name changes alias spellings (for example [grey] versus [gray]).
  // The parser preserves reference-file insertion order for each game.
  const macros=Object.entries(reference.macrosByGame[gameCode]||{})
    .map(([name,values])=>({name,values}));
  let text='',terminatorOffset=-1,truncatedEscape=false,unknownByteCount=0,macroCount=0;
  for (let i=0;i<raw.length;) {
    const value=raw[i];
    if (value===0xFF) {terminatorOffset=i;break;}
    const macro=macros.find(m=>m.values.length<=raw.length-i &&
      m.values.every((v,j)=>v===raw[i+j]));
    if (macro) {text+=macro.name;i+=macro.values.length;macroCount++;continue;}
    const glyph=reference.glyphs[value];
    if (glyph===null || glyph===undefined) {text+='\\!'+byteHex(value);unknownByteCount++;}
    else text+=glyph;
    let extra=0;
    if (value===0xFC) {
      const code=raw[i+1];
      extra=code===undefined?1:
        (reference.controlCodeLengths[code] ?? (code>0x14?1:2));
    } else if (value===0xF7 || value===0xF8 || value===0xF9 || value===0xFD) extra=1;
    if (extra) {
      const available=Math.min(extra,raw.length-i-1);
      text+=raw.slice(i+1,i+1+available).map(byteHex).join('');
      if (available<extra) {truncatedEscape=true;break;}
    }
    i+=extra+1;
  }
  return {
    supported:true,text,terminated:terminatorOffset>=0,terminatorOffset,
    truncatedEscape,unknownByteCount,macroCount,
    mapping:'imported-hma-pcs-reference',authenticated:false,editable:false
  };
}
