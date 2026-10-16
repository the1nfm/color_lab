import React, {useState,useRef,useEffect,useMemo,useDeferredValue} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
const LIMIT=100000, ROW=44;
const names={ok:'Структура OK',damaged:'Файл повреждён',unsupported:'Не поддерживается'};
const fmtBytes=n=>n>=1073741824?`${(n/1073741824).toFixed(2)} ГиБ`:n>=1048576?`${(n/1048576).toFixed(2)} МиБ`:`${(n/1024).toFixed(1)} КиБ`;
const dpi=r=>`${r.dpi_x?.toFixed(2)??'—'} × ${r.dpi_y?.toFixed(2)??'—'}`;
function App(){
 const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('Выберите папку или файлы.'),[total,setTotal]=useState(0),[done,setDone]=useState(0);
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[scroll,setScroll]=useState(0),[selected,setSelected]=useState(null);
 const [threads,setThreads]=useState(Math.min(4,Math.max(1,(navigator.hardwareConcurrency||4)-1))),[elapsed,setElapsed]=useState(0),[summary,setSummary]=useState({bytes:0,read:0,bad:0});
 const pool=useRef([]),buffer=useRef([]),timer=useRef(null),token=useRef(0),stats=useRef({bytes:0,read:0,bad:0}),started=useRef(0),fileInput=useRef(),dirInput=useRef(),viewport=useRef();
 const deferred=useDeferredValue(query);
 const filtered=useMemo(()=>{const q=deferred.toLowerCase();return rows.filter(r=>(filter==='all'||(filter==='warnings'?r.warnings.length>0:r.status===filter))&&(!q||r.name.toLowerCase().includes(q)||r.format?.toLowerCase().includes(q)));},[rows,deferred,filter]);
 useEffect(()=>{setScroll(0);if(viewport.current)viewport.current.scrollTop=0;},[deferred,filter]);
 useEffect(()=>()=>{pool.current.forEach(w=>w.terminate());clearInterval(timer.current);token.current++;},[]);
 const flush=()=>{setRows([...buffer.current]);setDone(buffer.current.length);setSummary({...stats.current});setElapsed((performance.now()-started.current)/1000);};
 const stop=()=>{token.current++;pool.current.forEach(w=>w.terminate());pool.current=[];clearInterval(timer.current);flush();setBusy(false);setMessage('Обработка остановлена. Готовые результаты сохранены.');};
 const scan=async(files,run)=>{
   if(run!==token.current)return;
   buffer.current=[];stats.current={bytes:0,read:0,bad:0};setRows([]);setDone(0);setSelected(null);setSummary({...stats.current});setElapsed(0);setScroll(0);setTotal(files.length);
   if(!files.length){setBusy(false);setMessage('Папка пуста.');return;}
   started.current=performance.now();setMessage('Чтение заголовков в Web Workers…');let next=0;let completed=0;
   timer.current=setInterval(flush,150);
   const finish=()=>{pool.current.forEach(w=>w.terminate());pool.current=[];clearInterval(timer.current);flush();setBusy(false);setMessage('Готово. Проверена структура, но не декодируемость всех пикселей.');};
   const send=w=>{
     if(run!==token.current)return;
     if(next>=files.length){if(completed===files.length)finish();return;}
     const items=files.slice(next,next+16).map((x,i)=>({file:x.file,path:x.path,id:next+i}));next+=items.length;
     w.postMessage({type:'batch',items});
   };
   const fail=e=>{if(run!==token.current)return;stop();setMessage(`Ошибка Worker/WASM: ${e}. Сначала выполните npm run wasm и проверьте путь к /wasm/.`);};
   const wasmBase=new URL(`${import.meta.env.BASE_URL}wasm/`,location.href).href;
   for(let i=0;i<Math.min(threads,files.length);i++){
     const w=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});pool.current.push(w);
     w.onerror=e=>fail(e.message);
     w.onmessage=({data})=>{
       if(run!==token.current)return;
       if(data.type==='fatal'){fail(data.error);return;}
       if(data.type==='ready'){send(w);return;}
       if(data.type==='result'){
         buffer.current.push(...data.rows);completed+=data.rows.length;
         for(const r of data.rows){stats.current.bytes+=r.size;stats.current.read+=r.readBytes;if(r.status==='damaged')stats.current.bad++;}
         if(completed===files.length)finish();else send(w);
       }
     };
     w.postMessage({type:'init',wasmBase});
   }
 };
 const fromInput=event=>{
   const list=event.target.files;if(!list?.length)return;
   if(list.length>LIMIT){setMessage(`В выбранной папке больше ${LIMIT} файлов. Уменьшите набор.`);event.target.value='';return;}
   const files=Array.from(list,f=>({file:f,path:f.webkitRelativePath||f.name}));event.target.value='';
   const run=++token.current;setBusy(true);scan(files,run);
 };
 const chooseDirectory=async()=>{
   if(!window.showDirectoryPicker){dirInput.current.click();return;}
   let handle;
   try{handle=await window.showDirectoryPicker({mode:'read'});}catch(e){if(e.name!=='AbortError')setMessage(String(e));return;}
   const run=++token.current;setBusy(true);setMessage('Обход папки…');const files=[];
   try{
     // Iterative directory walk, yields between entries; no recursion depth risk.
     const stack=[{handle,path:handle.name}];
     while(stack.length){const item=stack.pop();for await(const entry of item.handle.values()){
       if(run!==token.current)return;
       const path=`${item.path}/${entry.name}`;
       if(entry.kind==='directory')stack.push({handle:entry,path});
       else {if(files.length>=LIMIT)throw Error(`Превышен лимит ${LIMIT} файлов`);files.push({file:await entry.getFile(),path});}
       if(files.length%200===0)setMessage(`Обход папки: ${files.length} файлов`);
     }}
     await scan(files,run);
   }catch(e){if(run===token.current){setBusy(false);setMessage(`Ошибка обхода: ${e.message}`);}}
 };
 const exportCSV=()=>{
   const quote=v=>{let s=String(v??'');if(typeof v==='string' && /^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
   const lines=[['Имя','Формат','Ширина','Высота','DPI X','DPI Y','Бит/пиксель','Сжатие','Статус','Замечания','Прочитано байт'],...filtered.map(r=>[r.name,r.format,r.width,r.height,r.dpi_x,r.dpi_y,r.depth,r.compression,names[r.status],r.warnings.join('; '),r.readBytes])];
   const blob=new Blob(['\ufeff'+lines.map(line=>line.map(quote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
   const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='image-metadata.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const start=Math.max(0,Math.floor(scroll/ROW)-8), end=Math.min(filtered.length,start+35);
 return <main>
   <header><div><p className="eyebrow">ЛАБОРАТОРНАЯ РАБОТА №2</p><h1>Image Inspector</h1></div><span className="privacy">Файлы остаются на вашем компьютере</span></header>
   <section className="panel">
     <div className="controls"><button disabled={busy} onClick={chooseDirectory}>Выбрать папку</button><button className="secondary" disabled={busy} onClick={()=>fileInput.current.click()}>Выбрать файлы</button>
       <label>Workers <select disabled={busy} value={threads} onChange={e=>setThreads(+e.target.value)}>{[1,2,3,4,6,8].map(n=><option key={n}>{n}</option>)}</select></label>
       {busy&&<button className="danger" onClick={stop}>Остановить</button>}
       <button className="secondary" disabled={!filtered.length} onClick={exportCSV}>Экспорт CSV</button>
     </div>
     <input ref={fileInput} data-testid="files" type="file" multiple onChange={fromInput} hidden/>
     <input ref={dirInput} type="file" multiple webkitdirectory="" directory="" onChange={fromInput} hidden/>
     <p role="status">{message}</p><progress max={total||1} value={done}/>
     <div className="stats"><span>{done.toLocaleString('ru')} / {total.toLocaleString('ru')} файлов</span><span>{elapsed.toFixed(2)} с</span><span>{elapsed>0?(done/elapsed).toFixed(0):0} файлов/с</span><span>Размер файлов: {fmtBytes(summary.bytes)}</span><span>Считано: {fmtBytes(summary.read)}</span><span>Повреждено: {summary.bad}</span></div>
   </section>
   <section className="panel"><div className="controls"><input aria-label="Поиск" placeholder="Поиск по пути или формату…" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Фильтр статуса" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Все статусы</option><option value="ok">Структура OK</option><option value="damaged">Повреждённые</option><option value="unsupported">Не поддерживаются</option><option value="warnings">С замечаниями</option></select><span>Найдено: {filtered.length}</span></div>
   <div className="table-wrap"><div className="table-head grid"><span>Имя / путь</span><span>Формат</span><span>Размер, px</span><span>DPI X × Y</span><span>Бит/px</span><span>Сжатие</span><span>Статус</span></div>
   <div ref={viewport} className="viewport" onScroll={e=>setScroll(e.currentTarget.scrollTop)}><div style={{height:filtered.length*ROW,position:'relative'}}>
     {filtered.slice(start,end).map((r,i)=><button key={r.id} data-testid="row" className={`table-row grid ${r.status}`} style={{top:(start+i)*ROW,height:ROW}} onClick={()=>setSelected(r)} title={[r.name,...r.warnings].join('\n')}>
       <span>{r.name}</span><span>{r.format||'—'}</span><span>{r.width?`${r.width} × ${r.height}`:'—'}</span><span>{dpi(r)}</span><span>{r.depth??'—'}</span><span>{r.compression||'—'}</span><span>{names[r.status]||r.status}{r.warnings.length?' ⚠':''}</span>
     </button>)}
   </div></div></div>
   <p className="hint">Нажмите строку для подробностей. «—» означает отсутствие данных, а не 72/96 DPI по умолчанию. Для GIF показана глубина индекса палитры; для TIFF — первая страница, для GIF — размер логического экрана.</p></section>
   {selected&&<section className="panel details"><h2>{selected.name}</h2><p>{names[selected.status]} · {fmtBytes(selected.size)} · прочитано {fmtBytes(selected.readBytes)}, операций {selected.reads} · {selected.ms.toFixed(2)} мс</p><ul>{[...selected.details,...selected.warnings].map((t,i)=><li key={i}>{t}</li>)}</ul></section>}
   <footer>Быстрая структурная проверка: сигнатуры, длины, смещения, служебные CRC PNG и конечные маркеры. Потоки пикселей и CRC IDAT не проверяются. Подробные ограничения — в README и документации.</footer>
 </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
