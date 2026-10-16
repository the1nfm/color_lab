let api;
const expected = {jpg:'JPEG',jpeg:'JPEG',jpe:'JPEG',png:'PNG',gif:'GIF',bmp:'BMP',tif:'TIFF',tiff:'TIFF',pcx:'PCX'};
self.onmessage = async ({data}) => {
  if (data.type === 'init') {
    try {
      api = await import(/* @vite-ignore */ `${data.wasmBase}image_meta.js`);
      await api.default(new URL('image_meta_bg.wasm', data.wasmBase));
      self.postMessage({type:'ready'});
    } catch(e) {self.postMessage({type:'fatal',error:String(e)});}
    return;
  }
  if (data.type !== 'batch' || !api) return;
  const rows = [];
  for (const item of data.items) {
    const start = performance.now();
    const file = item.file;
    let cacheStart = -1, cache = new Uint8Array(), readBytes=0, reads=0, budget=0;
    const read = async (offset, length) => {
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset<0 || length<0 || offset+length>file.size) throw Error('Invalid read range');
      if (++budget>2000000) throw Error('Read operation limit');
      if (!length) return new Uint8Array();
      if (offset>=cacheStart && offset+length<=cacheStart+cache.length) return cache.subarray(offset-cacheStart, offset-cacheStart+length);
      // One reusable window per file/worker. Large pixel bodies are skipped.
      cacheStart = offset;
      const end = Math.min(file.size, offset + Math.max(65536, length));
      cache = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      readBytes += cache.length; reads++;
      return cache.subarray(0,length);
    };
    let meta;
    try {meta = JSON.parse(await api.inspect(file.size, read));}
    catch(e) {meta={status:'damaged',warnings:[String(e)],details:[]};}
    const ext = file.name.split('.').at(-1).toLowerCase();
    if (meta.status==='unknown') meta.status=expected[ext]?'damaged':'unsupported';
    meta.warnings ||= []; meta.details ||= [];
    if (meta.format && expected[ext] && expected[ext]!==meta.format) meta.warnings.push(`Расширение .${ext}, но сигнатура ${meta.format}`);
    rows.push({...meta,id:item.id,name:item.path,size:file.size,readBytes,reads,ms:performance.now()-start});
  }
  self.postMessage({type:'result',rows});
};
