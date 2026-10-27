/**
 * Read-only, source-grounded GBA blockmap inspection.
 *
 * Upstream CUBHMA: HexManiac.Core/Models/Map/MapModel.cs,
 * BlockCells[x,y] reads a little-endian 16-bit cell and returns
 * BlockCell(data & 0x3FF, data >> 10).
 *
 * IMPORTANT: the high six bits are raw collision/elevation metadata.
 * They are NOT a portable walkability boolean, and must not be flattened.
 * Callers must supply a separately verified blockmap ROM offset and dimensions.
 * No pointer discovery, semantic ownership, or ROM writing is performed here.
 */

function positiveInt(value, name, maximum) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
    throw new RangeError(name + ' must be an integer from 1 to ' + maximum);
}

export function decodeBlockCell(word) {
  if (!Number.isInteger(word) || word < 0 || word > 0xFFFF)
    throw new RangeError('Blockmap cell must be an unsigned 16-bit value');
  return Object.freeze({
    raw: word,
    tileId: word & 0x3FF,
    collision: word >>> 10,
  });
}

/**
 * Inspect a bounded viewport of a validated blockmap. Address is a ROM
 * file offset, not a GBA 0x08xxxxxx pointer. Even-aligned cells are required.
 * The full declared map must fit inside the ROM even for a tiny viewport.\n * A read-only {length, read(offset)} ROM model can expose staged edits\n * without allocating a complete copy of a large ROM.
 */
export function inspectBlockMap(bytes, {
  address, width, height,
  x = 0, y = 0, viewportWidth = 16, viewportHeight = 16,
} = {}) {
  if (!(bytes instanceof Uint8Array) && !(bytes && Number.isSafeInteger(bytes.length) && bytes.length >= 0 && typeof bytes.read === 'function'))
    throw new TypeError('ROM must be Uint8Array or a read-only ROM accessor');
  const read = bytes instanceof Uint8Array ? offset => bytes[offset] : offset => bytes.read(offset);
  if (!Number.isSafeInteger(address) || address < 0 || address % 2 !== 0)
    throw new RangeError('Blockmap ROM offset must be a non-negative even integer');
  positiveInt(width, 'Map width', 1024);
  positiveInt(height, 'Map height', 1024);
  if (!Number.isSafeInteger(x) || x < 0 || x >= width ||
      !Number.isSafeInteger(y) || y < 0 || y >= height)
    throw new RangeError('Viewport origin is outside the map');
  positiveInt(viewportWidth, 'Viewport width', 64);
  positiveInt(viewportHeight, 'Viewport height', 64);
  if (width * height > Math.floor((bytes.length - address) / 2))
    throw new RangeError('Complete blockmap extends beyond ROM bounds');
  const columns = Math.min(viewportWidth, width - x);
  const rows = Math.min(viewportHeight, height - y);
  const cells = [];
  for (let dy = 0; dy < rows; dy++) {
    const row = [];
    for (let dx = 0; dx < columns; dx++) {
      const offset = address + ((y + dy) * width + x + dx) * 2;
      const low = read(offset), high = read(offset + 1);
      if (!Number.isInteger(low) || low < 0 || low > 255 || !Number.isInteger(high) || high < 0 || high > 255)
        throw new RangeError('ROM accessor returned invalid byte');
      const raw = low | (high << 8);
      row.push(Object.freeze({
        x: x + dx, y: y + dy, byteOffset: offset, ...decodeBlockCell(raw),
      }));
    }
    cells.push(Object.freeze(row));
  }
  return Object.freeze({
    address, width, height, x, y, columns, rows,
    truncated: x + columns < width || y + rows < height,
    cells: Object.freeze(cells),
    readOnly: true,
    walkabilityVerified: false,
  });
}


/**
 * Summarise one bounded, contiguous page of raw vanilla blockmap words.
 * Source: CUBHMA MapModel.BlockCells (word & 0x3FF, word >> 10).
 * High six bits are NOT a verified walkability flag. This routine does not
 * infer collision rules, authenticate layout, mutate ROM or follow pointers.
 * Pages let mobile devices inspect large maps without allocating a full map.
 */
export function summarizeBlockmapChunk(source,{
  address,width,height,startCell=0,maxCells=4096
}={}){
  if(!(source instanceof Uint8Array)&&!(source&&Number.isSafeInteger(source.length)&&
    source.length>=0&&typeof source.read==='function'))
    throw new TypeError('Expected ROM bytes or a read-only staged accessor');
  const read=source instanceof Uint8Array?i=>source[i]:i=>source.read(i);
  if(!Number.isSafeInteger(address)||address<0||address%2)
    throw new RangeError('Blockmap offset must be a non-negative even ROM offset');
  positiveInt(width,'Map width',1024);
  positiveInt(height,'Map height',1024);
  const totalCells=width*height;
  if(address>source.length-totalCells*2)
    throw new RangeError('Complete declared blockmap exceeds ROM bounds');
  if(!Number.isSafeInteger(startCell)||startCell<0||startCell>=totalCells)
    throw new RangeError('Chunk start must select a blockmap cell');
  positiveInt(maxCells,'Chunk size',4096);
  const scannedCells=Math.min(maxCells,totalCells-startCell);
  const rawHighBitCounts=new Array(64).fill(0);
  const tileCounts=new Map();
  for(let i=0;i<scannedCells;i++){
    const offset=address+(startCell+i)*2;
    const low=read(offset),high=read(offset+1);
    if(!Number.isInteger(low)||low<0||low>255||
       !Number.isInteger(high)||high<0||high>255)
      throw new RangeError('ROM accessor returned an invalid byte');
    const word=low|(high<<8);
    const flag=word>>>10,tileId=word&0x3ff;
    rawHighBitCounts[flag]++;
    tileCounts.set(tileId,(tileCounts.get(tileId)||0)+1);
  }
  const commonTiles=[...tileCounts].sort((a,b)=>b[1]-a[1]||a[0]-b[0])
    .slice(0,8).map(([tileId,count])=>Object.freeze({tileId,count}));
  return Object.freeze({
    address,width,height,totalCells,startCell,scannedCells,
    firstByteOffset:address+startCell*2,
    lastByteOffset:address+(startCell+scannedCells)*2-1,
    nextCell:startCell+scannedCells<totalCells?startCell+scannedCells:null,
    rawHighBitCounts:Object.freeze(rawHighBitCounts),
    distinctTiles:tileCounts.size,commonTiles:Object.freeze(commonTiles),
    readOnly:true,walkabilityVerified:false,layoutAuthenticated:false
  });
}
