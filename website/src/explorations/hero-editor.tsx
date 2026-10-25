import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { Check, Download, GripHorizontal, RotateCcw, Undo2, X } from 'lucide-react';
import '@fontsource-variable/inter';
import '../../../src/components/arc/foundation.css';
import '../site.css';
import './hero-editor.css';
import { Button } from '../../../src/components/arc/button/button';
import { Input } from '../../../src/components/arc/input/input';
import { LocaleProvider } from '../../../src/features/settings/locale';
import { copy, type Language } from '../copy';
import { SiteContext } from '../parts/useSite';
import { Hero } from '../sections/Hero';
import { Nav } from '../sections/Nav';
import { bounds, defaultFade, fadeValue, layoutCss, layoutIds, layoutStorageKey, parseLayout, placementValue, type CardPlacement, type FadePlacement, type HeroLayout, type LayoutId } from './hero-layout';

const names = ['Anti-Defensive Writing', 'SFT / RL', 'Design Spells', 'Plot color', 'seeco on X', 'Korea artist', 'Oregon 101', 'Uiverse'];
type Drag = { kind: 'card'; id: LayoutId; startX: number; startY: number; x: number; y: number } | { kind: 'panel'; startX: number; startY: number; x: number; y: number };
const Canvas = memo(function Canvas({ stageRef, onPointerDown }: { stageRef: RefObject<HTMLDivElement | null>; onPointerDown: (event: ReactPointerEvent) => void }) {
  return <div className="layout-canvas" ref={stageRef} onPointerDown={onPointerDown}><Nav /><main><Hero /></main></div>;
});

function Editor() {
  const stage = useRef<HTMLDivElement>(null);
  const [language, setLanguage] = useState<Language>('en');
  const site = useMemo(() => ({ language, copy: copy[language], setLanguage }), [language]);
  const [layout, setLayout] = useState<HeroLayout | null>(null);
  const current = useRef<HeroLayout | null>(null);
  const initial = useRef<HeroLayout | null>(null);
  const history = useRef<HeroLayout[]>([]);
  const [selected, setSelected] = useState<LayoutId>('plot-color');
  const [fade, setFade] = useState(true);
  const [guides, setGuides] = useState(true);
  const [shown, setShown] = useState(true);
  const [panel, setPanel] = useState({ x: 20, y: 80 });
  const panelPosition = useRef(panel);
  const drag = useRef<Drag | null>(null);
  const [copied, setCopied] = useState(false);
  const feedbackTimer = useRef<number | undefined>(undefined);
  const [error, setError] = useState('');
  const upload = useRef<HTMLInputElement>(null);

  const apply = useCallback((next: HeroLayout, remember = true) => {
    if (remember && current.current) history.current = [...history.current.slice(-39), current.current];
    current.current = next;
    setLayout(next);
    setCopied(false);
    setError('');
  }, []);
  const patch = useCallback((id: LayoutId, changes: Partial<Omit<CardPlacement, 'id'>>, remember = true) => {
    const previous = current.current;
    if (!previous) return;
    const safe = Object.fromEntries(Object.entries(changes).filter(([key, value]) => key in bounds && Number.isFinite(value)).map(([key, value]) => [key, placementValue(key as keyof typeof bounds, value!)]));
    apply({ ...previous, cards: previous.cards.map(card => card.id === id ? { ...card, ...safe } : card) }, remember);
  }, [apply]);
  const undo = useCallback(() => { const previous = history.current.pop(); if (previous) apply(previous, false); }, [apply]);
  const patchFade = (key: keyof FadePlacement, value: number) => {
    if (!current.current || !Number.isFinite(value)) return;
    const previous = current.current;
    apply({ ...previous, fade: { ...(previous.fade ?? defaultFade(previous.canvas)), [key]: fadeValue(key, value) } });
  };

  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  }, [language]);
  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (cancelled || !stage.current) return;
      const art = stage.current.querySelector<HTMLElement>('.hero-references')!;
      art.inert = false;
      const canvas = { width: art.clientWidth, height: art.clientHeight };
      const cards = layoutIds.map((id, z) => {
        const node = art.querySelector<HTMLElement>(`[data-hero-reference="${id}"]`)!;
        const oldDisplay = node.style.display;
        node.style.display = 'block';
        const transform = new DOMMatrix(getComputedStyle(node).transform);
        const result = { id, x: node.offsetLeft + node.offsetWidth / 2 - canvas.width / 2, y: node.offsetTop,
          scale: Math.round(Math.hypot(transform.a, transform.b) * 100) / 100,
          rotation: Math.round(Math.atan2(transform.b, transform.a) * 180 / Math.PI), z };
        node.style.display = oldDisplay;
        return result;
      });
      const baseline: HeroLayout = { version: 1, canvas, cards, fade: defaultFade(canvas) };
      initial.current = baseline;
      let restored = baseline;
      try { const saved = localStorage.getItem(layoutStorageKey); if (saved) restored = parseLayout(saved); } catch { /* Invalid/old editor drafts do not change the baseline. */ }
      apply(restored, false);
      setPanel({ x: Math.max(12, window.innerWidth - 320), y: 80 });
    });
    return () => { cancelled = true; window.clearTimeout(feedbackTimer.current); };
  }, [apply]);
  useEffect(() => { panelPosition.current = panel; }, [panel]);
  useEffect(() => {
    const keepPanelVisible = () => setPanel(value => ({ x: Math.min(Math.max(0, window.innerWidth - 300), value.x), y: Math.min(Math.max(0, window.innerHeight - 100), value.y) }));
    window.addEventListener('resize', keepPanelVisible);
    return () => window.removeEventListener('resize', keepPanelVisible);
  }, []);
  useEffect(() => {
    if (!layout) return;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(layoutStorageKey, JSON.stringify(layout)); } catch { setError('浏览器无法保存草稿，请导出 JSON。'); }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [layout]);

  const onCardPointerDown = useCallback((event: ReactPointerEvent) => {
    if (event.button !== 0 || !current.current) return;
    const node = (event.target as HTMLElement).closest<HTMLElement>('[data-hero-reference]');
    if (!node) return;
    const id = node.dataset.heroReference as LayoutId;
    const card = current.current.cards.find(value => value.id === id)!;
    history.current = [...history.current.slice(-39), current.current];
    setSelected(id);
    drag.current = { kind: 'card', id, startX: event.clientX, startY: event.clientY, x: card.x, y: card.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const active = drag.current;
      if (!active) return;
      const x = active.x + event.clientX - active.startX, y = active.y + event.clientY - active.startY;
      if (active.kind === 'card') patch(active.id, { x, y }, false);
      else setPanel({ x: Math.min(Math.max(0, window.innerWidth - 300), Math.max(0, x)), y: Math.min(window.innerHeight - 48, Math.max(0, y)) });
    };
    const stop = () => { drag.current = null; };
    const keys = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input,textarea,select,[contenteditable]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); return; }
      const card = current.current?.cards.find(value => value.id === selected);
      if (!card || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      patch(selected, { x: card.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), y: card.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    window.addEventListener('keydown', keys);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); window.removeEventListener('blur', stop); window.removeEventListener('keydown', keys); };
  }, [patch, selected, undo]);

  const exported = () => {
    const art = stage.current!.querySelector<HTMLElement>('.hero-references')!;
    return JSON.stringify({ ...current.current, canvas: { width: art.clientWidth, height: art.clientHeight } }, null, 2);
  };
  const copyLayout = async () => {
    try {
      await navigator.clipboard.writeText(exported());
      setCopied(true); window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch { setError('无法复制，请使用“下载 JSON”。'); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exported()], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'stashdock-hero-layout.json'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const card = layout?.cards.find(value => value.id === selected);
  const fadeSettings = layout ? layout.fade ?? defaultFade(layout.canvas) : null;
  return <SiteContext.Provider value={site}><LocaleProvider language={language}><MotionConfig reducedMotion="always">
    <style>{layout ? layoutCss(layout) : ''}</style>
    <style>{`.layout-canvas [data-hero-reference="${selected}"] .hero-reference-paper::after{content:"";position:absolute;inset:-3px;border:1px dashed var(--accent);border-radius:var(--radius-panel);pointer-events:none;}`}</style>
    <div className="layout-workspace" data-fade={fade} data-controls={shown}>
      <Canvas stageRef={stage} onPointerDown={onCardPointerDown} />
      {guides && shown && fade && fadeSettings && <div className="layout-fade-guides" aria-hidden="true">
        <div className="layout-fade-guide" style={{ top: fadeSettings.start }}><span>渐隐起点 {fadeSettings.start}px</span></div>
        <div className="layout-fade-guide" style={{ top: fadeSettings.start + fadeSettings.height }}><span>渐隐结束 {fadeSettings.start + fadeSettings.height}px</span></div>
      </div>}
    </div>
    {!shown && <Button variant="secondary" className="layout-show" onClick={() => setShown(true)}>显示调整面板</Button>}
    <aside className="layout-inspector" aria-label="卡片布局调整" hidden={!shown} style={{ left: panel.x, top: panel.y }}>
      <div className="layout-panel-header">
        <button className="layout-panel-grip" aria-label="拖动调整面板" type="button" onPointerDown={event => {
          if (event.button !== 0) return;
          drag.current = { kind: 'panel', startX: event.clientX, startY: event.clientY, ...panelPosition.current };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}><GripHorizontal size={18} aria-hidden="true" /><span>卡片布局</span></button>
        <Button variant="ghost" className="layout-icon-button" aria-label="隐藏调整面板" onClick={() => setShown(false)}><X size={18} /></Button>
      </div>
      <div className="layout-panel-body">
        <p className="layout-help">拖动卡片。方向键微调，Shift 加速。草稿自动保存在此浏览器。</p>
        <label className="layout-select-label">选择卡片<select value={selected} onChange={event => setSelected(event.target.value as LayoutId)}>{layoutIds.map((id, index) => <option value={id} key={id}>{names[index]}</option>)}</select></label>
        {card && <>
          <div className="layout-field-grid">
            <Input label="水平位置" type="number" value={card.x} step={1} onChange={event => patch(selected, { x: event.target.valueAsNumber })} />
            <Input label="垂直位置" type="number" value={card.y} step={1} onChange={event => patch(selected, { y: event.target.valueAsNumber })} />
          </div>
          <Input label="大小（%）" type="number" min={20} max={200} value={Math.round(card.scale * 100)} onChange={event => patch(selected, { scale: event.target.valueAsNumber / 100 })} />
          <input className="layout-range" aria-label="调整大小" type="range" min={20} max={200} value={card.scale * 100} onChange={event => patch(selected, { scale: Number(event.target.value) / 100 })} />
          <Input label="旋转（°）" type="number" min={-180} max={180} value={card.rotation} onChange={event => patch(selected, { rotation: event.target.valueAsNumber })} />
          <input className="layout-range" aria-label="调整旋转" type="range" min={-180} max={180} value={card.rotation} onChange={event => patch(selected, { rotation: Number(event.target.value) })} />
          <Input label="层级（越大越靠前）" type="number" min={0} max={99} value={card.z} onChange={event => patch(selected, { z: event.target.valueAsNumber })} />
        </>}
        <section className="layout-fade-settings" aria-labelledby="fade-settings-heading">
          <h2 id="fade-settings-heading">整体渐隐</h2>
          <label className="layout-fade"><input type="checkbox" checked={fade} onChange={event => setFade(event.target.checked)} />预览渐隐</label>
          {fadeSettings && <>
            <div className="layout-field-grid">
              <Input label="渐隐起点（px）" type="number" min={-2000} max={6000} value={fadeSettings.start} onChange={event => patchFade('start', event.target.valueAsNumber)} />
              <Input label="渐隐高度（px）" type="number" min={1} max={4000} value={fadeSettings.height} onChange={event => patchFade('height', event.target.valueAsNumber)} />
            </div>
            <input className="layout-range" aria-label="调整渐隐起点" type="range" min={0} max={Math.max(1600, layout?.canvas.height ?? 1600)} value={fadeSettings.start} onChange={event => patchFade('start', Number(event.target.value))} />
            <Input label="渐隐强度（%）" type="number" min={0} max={100} value={fadeSettings.strength} onChange={event => patchFade('strength', event.target.valueAsNumber)} />
            <input className="layout-range" aria-label="调整渐隐强度" type="range" min={0} max={100} value={fadeSettings.strength} onChange={event => patchFade('strength', Number(event.target.value))} />
            <p className="layout-help">从起点向下过渡。100% 在结束位置完全消失。</p>
          </>}
          <label className="layout-fade"><input type="checkbox" checked={guides} onChange={event => setGuides(event.target.checked)} />显示渐隐边界</label>
        </section>
        <div className="layout-field-grid">
          <Button variant="secondary" onClick={undo} disabled={!history.current.length}><Undo2 size={16} />撤销</Button>
          <Button variant="secondary" onClick={() => { if (initial.current) apply(initial.current); }}><RotateCcw size={16} />重置全部</Button>
        </div>
        <Button variant="primary" className={copied ? 'layout-copied' : ''} disabled={!layout} onClick={() => { void copyLayout(); }}>{copied ? <><Check size={16} />已复制</> : '复制布局'}</Button>
        <div className="layout-field-grid">
          <Button variant="secondary" disabled={!layout} onClick={download}><Download size={16} />下载 JSON</Button>
          <Button variant="ghost" onClick={() => upload.current?.click()}>导入 JSON</Button>
        </div>
        <input ref={upload} hidden type="file" accept=".json,application/json" aria-label="导入布局文件" onChange={event => {
          const file = event.target.files?.[0]; if (!file) return;
          if (file.size > 50000) { setError('布局文件应小于 50 KB。'); return; }
          void file.text().then(text => { try { apply(parseLayout(text)); } catch (cause) { setError(cause instanceof Error ? cause.message : '无法读取布局。'); } });
          event.target.value = '';
        }} />
        <p className="layout-help" role="status">{error || '调好后，把复制的参数或 JSON 文件发给我即可。'}</p>
      </div>
    </aside>
  </MotionConfig></LocaleProvider></SiteContext.Provider>;
}

createRoot(document.getElementById('root')!).render(<Editor />);
