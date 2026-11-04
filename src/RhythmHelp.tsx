import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const RHYTHM_GUIDE_EVENT = 'pawsona:review-rhythm-guide';
const seenKey = 'pawsona-rhythm-guide-v1';
const steps = [
  { target: '.rhythm-circle-guide.outer', title: 'Outer ring · Usual times', text: 'These windows show when activities usually happen, based on confirmed patterns. They are a guide, not a record of care.' },
  { target: '.rhythm-circle-guide.inner', title: 'Inner ring · This day', text: 'These markers show recorded moments and planned care. Green means recorded or completed; grey means upcoming; red means check first. Missing records do not prove missed care.' },
  { target: '[aria-label="Dial view"]', title: 'Choose your view', text: 'Now shows the current half day. Full day shows all 24 hours. Drag the dial to explore time, or tap an activity to open its details.' },
];
let seenThisSession = false;

export default function RhythmHelp() {
  const [mode, setMode] = useState<'help' | 'guide' | null>(null);
  const [step, setStep] = useState(0);
  const [bounds, setBounds] = useState<{ left: number; top: number; width: number; height: number; ring?: { cx: number; cy: number; rx: number; ry: number } } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const startGuide = () => { setStep(0); setMode('guide'); };
  const close = () => {
    if (mode === 'guide') {
      seenThisSession = true;
      try { localStorage.setItem(seenKey, 'seen'); } catch { /* Keep the session fallback. */ }
    }
    dialog.current?.close();
    setMode(null);
    trigger.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    const replay = () => startGuide();
    window.addEventListener(RHYTHM_GUIDE_EVENT, replay);
    let seen = seenThisSession;
    try { seen ||= localStorage.getItem(seenKey) === 'seen'; } catch { /* Fall back to session. */ }
    // Give the existing account setup / app tour priority; never stack modal guides.
    let observer: MutationObserver | undefined;
    const maybeStart = () => {
      if (seen || document.querySelector('.getting-started-backdrop, .guided-tour-layer, .profile-dialog-backdrop, dialog[open]')) return;
      seen = true;
      seenThisSession = true;
      observer?.disconnect();
      startGuide();
    };
    observer = new MutationObserver(maybeStart);
    observer.observe(document.body, { childList: true, subtree: true });
    const frame = requestAnimationFrame(maybeStart);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener(RHYTHM_GUIDE_EVENT, replay); };
  }, []);
  useEffect(() => {
    if (!mode) return;
    const fit = () => {
      const r = trigger.current?.closest('.phone')?.getBoundingClientRect();
      if (!r || !dialog.current) return;
      Object.assign(dialog.current.style, { top: `${r.top}px`, height: `${r.height}px`, width: `${r.width}px` });
    };
    fit();
    if (!dialog.current?.open) dialog.current?.showModal();
    heading.current?.focus({ preventScroll: true });
    if (mode !== 'guide') { setBounds(null); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }
    const measure = () => {
      fit();
      const phone = trigger.current?.closest('.phone');
      const target = phone?.querySelector(steps[step].target);
      const chart = phone?.querySelector('.daily-rhythm-circle-chart');
      if (!target || !dialog.current || !panel.current) return;
      const d = dialog.current.getBoundingClientRect();
      // A rotated SVG circle's bounding box is larger than the visible ring.
      // Use its transformed centre and radius so the highlight follows the arc.
      const matrix = target instanceof SVGCircleElement ? target.getScreenCTM() : null;
      const centre = target instanceof SVGCircleElement && matrix ? new DOMPoint(target.cx.baseVal.value, target.cy.baseVal.value).matrixTransform(matrix) : null;
      const radius = target instanceof SVGCircleElement && matrix ? target.r.baseVal.value * Math.hypot(matrix.a, matrix.b) : 0;
      const r = centre ? { left: centre.x-radius, right: centre.x+radius, top: centre.y-radius, bottom: centre.y+radius, width: radius*2, height: radius*2 } : target.getBoundingClientRect();
      const c = step < 2 ? chart?.getBoundingClientRect() : undefined;
      const top = Math.max(r.top, c?.top ?? d.top, d.top + 8);
      const bottom = Math.min(r.bottom, c?.bottom ?? d.bottom, panel.current.getBoundingClientRect().top - 12);
      const left = Math.max(d.left + 8, r.left);
      const width = Math.min(r.right, d.right - 8) - left;
      setBounds(bottom > top ? { left: left - d.left, top: top - d.top, width, height: bottom - top,
        ring: step < 2 ? { cx: (r.left + r.right) / 2 - left, cy: (r.top + r.bottom) / 2 - top, rx: r.width / 2 - 2, ry: r.height / 2 - 2 } : undefined } : null);
    };
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    const scroller = trigger.current?.closest('.screen-scroll');
    scroller?.addEventListener('scroll', measure, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', measure); scroller?.removeEventListener('scroll', measure); };
  }, [mode, step]);
  return <>
    <button ref={trigger} className="rhythm-info" type="button" aria-label="About Daily Rhythm" aria-haspopup="dialog" onClick={() => setMode('help')}><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 9v5M10 6v.2"/></svg></button>
    {createPortal(<dialog ref={dialog} className={`rhythm-help-dialog ${mode === 'guide' ? 'is-guide' : ''}`} aria-labelledby="rhythm-help-title" onCancel={event => { event.preventDefault(); close(); }} onClose={() => setMode(null)} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      {mode === 'guide' && bounds && <div className={`rhythm-guide-target ${bounds.ring ? 'is-ring' : ''}`} style={{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height}} aria-hidden="true">{bounds.ring && <svg width="100%" height="100%"><ellipse cx={bounds.ring.cx} cy={bounds.ring.cy} rx={bounds.ring.rx} ry={bounds.ring.ry} className="rhythm-guide-ring-halo"/><ellipse cx={bounds.ring.cx} cy={bounds.ring.cy} rx={bounds.ring.rx} ry={bounds.ring.ry}/></svg>}</div>}
      <section ref={panel} className="rhythm-help-sheet">
        <header><h2 id="rhythm-help-title" tabIndex={-1} ref={heading}>{mode === 'guide' ? steps[step].title : 'Read Daily Rhythm'}</h2><button type="button" className="rhythm-sheet-close" aria-label={mode === 'guide' ? 'Skip rhythm guide' : 'Close rhythm help'} onClick={close}>×</button></header>
        <div className="rhythm-sheet-body">{mode === 'guide' ? <><p className="rhythm-guide-count">{step + 1} of {steps.length}</p><p>{steps[step].text}</p></> : <>
          <h3>Outer ring · Typical windows</h3><p>When an activity usually happens, based on confirmed patterns.</p>
          <h3>Inner ring · This day</h3><p>Recorded moments and planned care. A plan is not proof that care happened.</p>
          <h3>Read the states</h3><p>Green: recorded or completed. Grey: upcoming. Red: check the details first. Missing records do not prove missed care.</p>
          <h3>Explore the dial</h3><p>Tap an activity for its time and details. Now shows the current half day; Full day shows 24 hours. Drag the dial to explore time.</p>
        </>}</div>
        <footer>{mode === 'guide' ? <><button className="profile-link" type="button" onClick={close}>Skip guide</button><div className="rhythm-guide-navigation"><button className="profile-link" type="button" disabled={step === 0} onClick={() => setStep(value => value - 1)}>Back</button><button className="primary-button" type="button" onClick={() => step === steps.length - 1 ? close() : setStep(value => value + 1)}>{step === steps.length - 1 ? 'Got it' : 'Next'}</button></div></> : <><button className="profile-link" type="button" onClick={startGuide}>Show me around</button><button className="primary-button" type="button" onClick={close}>Done</button></>}</footer>
      </section>
    </dialog>, document.body)}
  </>;
}
