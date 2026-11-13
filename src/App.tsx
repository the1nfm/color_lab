import { useEffect, useRef, useState } from 'react';
import type { Method, Options } from './algorithms';
import type { Edge, Picture } from './pixels';
const tests = [
  ['salt-pepper.png', 'Шум «соль и перец»'],
  ['salt.png', 'Белый импульсный шум'],
  ['pepper.png', 'Черный импульсный шум'],
  ['uneven.png', 'Неравномерное освещение'],
  ['imbalanced.png', 'Маленький объект'],
  ['three-levels.png', 'Три уровня яркости'],
];
function draw(canvas: HTMLCanvasElement, image: Picture) {
  canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  const frame = context.createImageData(image.width, image.height);
  frame.data.set(image.data); context.putImageData(frame, 0, 0);
}
export default function App() {
  const before = useRef<HTMLCanvasElement>(null), after = useRef<HTMLCanvasElement>(null);
  const worker = useRef<Worker | null>(null);
  const [image, setImage] = useState<Picture | null>(null);
  const [method, setMethod] = useState<Method>('median');
  const [edge, setEdge] = useState<Edge>('reflect');
  const [filterRadius, setFilterRadius] = useState(1);
  const [localRadius, setLocalRadius] = useState(15);
  const [offset, setOffset] = useState(10);
  const [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  const [message, setMessage] = useState('Загрузите изображение или выберите тест.');
  useEffect(() => {
    const instance = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.current = instance;
    instance.onmessage = event => {
      setBusy(false);
      if (event.data.error) { setMessage(event.data.error); return; }
      draw(after.current!, event.data.image); setReady(true);
      setMessage(`Готово за ${event.data.elapsed.toFixed(1)} мс` +
        (event.data.threshold === undefined ? '' : `. Порог: ${event.data.threshold.toFixed(2)}`));
    };
    instance.onerror = () => { setBusy(false); setMessage('Ошибка рабочего потока. Перезагрузите страницу.'); };
    return () => { instance.terminate(); worker.current = null; };
  }, []);
  function load(url: string, release = false) {
    setBusy(true); setReady(false); setMessage('Загрузка…');
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = before.current!;
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const context = canvas.getContext('2d')!; context.drawImage(img, 0, 0);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        setImage({ width: frame.width, height: frame.height, data: frame.data });
        after.current!.width = 0; after.current!.height = 0;
        setMessage(`Изображение: ${frame.width} × ${frame.height}`);
      } catch { setMessage('Не удалось прочитать изображение.'); }
      finally { setBusy(false); if (release) URL.revokeObjectURL(url); }
    };
    img.onerror = () => { setBusy(false); setMessage('Не удалось загрузить изображение.'); if (release) URL.revokeObjectURL(url); };
    img.src = url;
  }
  const order = ['median', 'minimum', 'maximum'].includes(method);
  function run() {
    if (!image || !worker.current) return;
    const options: Options = { method, edge, radius: order ? filterRadius : localRadius, offset };
    setBusy(true); setReady(false); setMessage('Обработка…');
    worker.current.postMessage({ image, options });
  }
  function save() {
    after.current!.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = 'result.png'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }
  return <main>
    <h1>Обработка изображений · Вариант 10</h1>
    <p>Нелинейные фильтры, глобальная и адаптивная пороговая обработка.</p>
    <section>
      <label>Открыть изображение<input disabled={busy} type="file" accept="image/*" onChange={e => {
        const file = e.target.files?.[0]; if (file) load(URL.createObjectURL(file), true); e.target.value = '';
      }} /></label>
      <div className="tests">{tests.map(([file, title]) => <button key={file} disabled={busy} onClick={() => load(`${import.meta.env.BASE_URL}tests/${file}`)}>{title}</button>)}</div>
    </section>
    <section>
      <fieldset disabled={busy}>
        <label>Метод<select value={method} onChange={e => setMethod(e.target.value as Method)}>
          <option value="median">Медианный фильтр</option>
          <option value="minimum">Минимальный фильтр</option>
          <option value="maximum">Максимальный фильтр</option>
          <option value="otsu">Глобальный порог: Оцу</option>
          <option value="iterative">Глобальный порог: итеративный</option>
          <option value="adaptive">Адаптивный порог: локальное среднее</option>
        </select></label>
        {order && <>
          <label>Окно фильтра<select value={filterRadius} onChange={e => setFilterRadius(+e.target.value)}>
            <option value="1">3 × 3</option><option value="2">5 × 5</option><option value="3">7 × 7</option>
          </select></label>
          <label>Края<select value={edge} onChange={e => setEdge(e.target.value as Edge)}>
            <option value="reflect">Reflect — отражение</option><option value="clamp">Clamp — повтор края</option>
          </select></label>
        </>}
        {method === 'adaptive' && <>
          <label>Окно: {localRadius * 2 + 1} × {localRadius * 2 + 1}<input type="range" min="1" max="50" value={localRadius} onChange={e => setLocalRadius(+e.target.value)} /></label>
          <label>Поправка C: {offset}<input type="range" min="-30" max="50" value={offset} onChange={e => setOffset(+e.target.value)} /></label>
        </>}
        <button disabled={!image} onClick={run}>Обработать исходное изображение</button>
        <button disabled={!ready} onClick={save}>Сохранить PNG</button>
      </fieldset>
      <p role="status">{message}</p>{busy && <progress />}
    </section>
    <div className="images"><section><h2>До</h2><canvas ref={before} width="0" height="0" /></section><section><h2>После</h2><canvas ref={after} width="0" height="0" /></section></div>
    <p className="note">Каждый метод применяется к исходному изображению. Пороговая обработка работает с яркостью. Адаптивный метод необходимо сверить с лекцией.</p>
  </main>;
}
