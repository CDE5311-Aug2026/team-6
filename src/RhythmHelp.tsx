import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const RHYTHM_GUIDE_EVENT = 'pawsona:review-rhythm-guide';
const seenKey = 'pawsona-rhythm-guide-v1';
const steps = [
  { target: '.rhythm-circle-guide.outer', spotlight: 'dial', title: 'One ring · Your day', text: 'This single ring is your day’s timeline. The pointer marks now: recorded Daily activity is on its left, and AI-predicted events are on its right.' },
  { target: '.daily-rhythm-circle-chart', spotlight: 'left', title: 'Daily activity · Already happened', text: 'The area to the left of the pointer shows activity that has already happened. Tap an event on the dial to open its details.' },
  { target: '.daily-rhythm-circle-chart', spotlight: 'right', title: 'Upcoming · AI predictions', text: 'The area to the right of the pointer shows AI predictions based on the Typical pattern. These are not records, and the activity may not happen.' },
  { target: '[aria-label="Dial view"]', spotlight: 'element', title: 'Explore the dial', text: 'Now shows the current half-day; Full day shows all 24 hours. Drag the dial to explore times, or tap an event to see its details.' },
];
let seenThisSession = false;

export default function RhythmHelp() {
  const [mode, setMode] = useState<'help' | 'guide' | null>(null);
  const [step, setStep] = useState(0);
  const [bounds, setBounds] = useState<{ left: number; top: number; width: number; height: number; viewWidth: number; viewHeight: number; focusPath?: string; ring?: { cx: number; cy: number; rx: number; ry: number } } | null>(null);
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
      if (!target || !dialog.current || !panel.current) { setBounds(null); return; }
      const d = dialog.current.getBoundingClientRect();
      // A rotated SVG circle's bounding box is larger than the visible ring.
      // Use its transformed centre and radius so the highlight follows the arc.
      const matrix = target instanceof SVGCircleElement ? target.getScreenCTM() : null;
      const centre = target instanceof SVGCircleElement && matrix ? new DOMPoint(target.cx.baseVal.value, target.cy.baseVal.value).matrixTransform(matrix) : null;
      const radius = target instanceof SVGCircleElement && matrix ? target.r.baseVal.value * Math.hypot(matrix.a, matrix.b) : 0;
      const r = centre ? { left: centre.x-radius, right: centre.x+radius, top: centre.y-radius, bottom: centre.y+radius, width: radius*2, height: radius*2 } : target.getBoundingClientRect();
      const c = step < steps.length - 1 ? chart?.getBoundingClientRect() : undefined;
      const top = Math.max(r.top, c?.top ?? d.top, d.top + 8);
      const bottom = Math.min(r.bottom, c?.bottom ?? d.bottom, panel.current.getBoundingClientRect().top - 12);
      const left = Math.max(d.left + 8, r.left);
      const width = Math.min(r.right, d.right - 8) - left;
      let focusPath: string | undefined;
      if (steps[step].spotlight === 'left' || steps[step].spotlight === 'right' || steps[step].spotlight === 'dial') {
        const box = chart?.getBoundingClientRect();
        const circle = chart?.querySelector('.rhythm-circle-guide.outer');
        const circleMatrix = circle instanceof SVGCircleElement ? circle.getScreenCTM() : null;
        const pointer = chart?.querySelector('.rhythm-circle-now-dot');
        const pointerMatrix = pointer instanceof SVGCircleElement ? pointer.getScreenCTM() : null;
        if (box && circle instanceof SVGCircleElement && circleMatrix) {
          const screenCentre = new DOMPoint(circle.cx.baseVal.value, circle.cy.baseVal.value).matrixTransform(circleMatrix);
          const cx = screenCentre.x - d.left;
          const fullDay = chart?.classList.contains('is-full-day') ?? false;
          const scale = Math.hypot(circleMatrix.a, circleMatrix.b);
          const radius = circle.r.baseVal.value * scale;
          const cy = screenCentre.y - d.top;
          const boundaryStart = fullDay ? -Math.PI / 2 : Math.PI;
          const boundaryEnd = fullDay ? boundaryStart + Math.PI * 2 : Math.PI * 2;
          const pointAt = (angle: number) => `${cx + Math.cos(angle) * radius} ${cy + Math.sin(angle) * radius}`;
          if (steps[step].spotlight === 'dial') {
            focusPath = fullDay
              ? `M${pointAt(boundaryStart)} A${radius} ${radius} 0 0 1 ${pointAt(boundaryStart + Math.PI)} A${radius} ${radius} 0 0 1 ${pointAt(boundaryEnd)} Z`
              : `M${pointAt(boundaryStart)} A${radius} ${radius} 0 0 1 ${pointAt(boundaryEnd)} Z`;
          } else if (pointer instanceof SVGCircleElement && pointerMatrix) {
            const tip = new DOMPoint(pointer.cx.baseVal.value, pointer.cy.baseVal.value).matrixTransform(pointerMatrix);
            let pointerAngle = Math.atan2(tip.y - screenCentre.y, tip.x - screenCentre.x);
            while (pointerAngle < boundaryStart) pointerAngle += Math.PI * 2;
            while (pointerAngle > boundaryEnd) pointerAngle -= Math.PI * 2;
            const drawSector = (start: number, end: number) => `M${cx} ${cy} L${pointAt(start)} A${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${pointAt(end)} Z`;
            focusPath = steps[step].spotlight === 'left'
              ? drawSector(boundaryStart, pointerAngle)
              : drawSector(pointerAngle, boundaryEnd);
          }
        }
      } else if (steps[step].spotlight === 'element') {
        const radius = Math.min(16, r.height / 2, r.width / 2);
        const x = r.left - d.left, y = r.top - d.top, w = r.width, h = r.height;
        focusPath = `M${x+radius} ${y} H${x+w-radius} Q${x+w} ${y} ${x+w} ${y+radius} V${y+h-radius} Q${x+w} ${y+h} ${x+w-radius} ${y+h} H${x+radius} Q${x} ${y+h} ${x} ${y+h-radius} V${y+radius} Q${x} ${y} ${x+radius} ${y} Z`;
      }
      setBounds(bottom > top ? { left: left - d.left, top: top - d.top, width, height: bottom - top,
        viewWidth: d.width, viewHeight: d.height, focusPath,
        ring: steps[step].spotlight === 'dial' ? { cx: (r.left + r.right) / 2 - left, cy: (r.top + r.bottom) / 2 - top, rx: r.width / 2 - 2, ry: r.height / 2 - 2 } : undefined } : null);
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
      {mode === 'guide' && bounds?.focusPath && <svg className="rhythm-guide-scrim" width={bounds.viewWidth} height={bounds.viewHeight} viewBox={`0 0 ${bounds.viewWidth} ${bounds.viewHeight}`} aria-hidden="true"><defs><mask id="rhythm-guide-focus-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={bounds.viewWidth} height={bounds.viewHeight}><rect width={bounds.viewWidth} height={bounds.viewHeight} fill="white"/><path d={bounds.focusPath} fill="black"/></mask></defs><rect width={bounds.viewWidth} height={bounds.viewHeight} fill="#16271e88" mask="url(#rhythm-guide-focus-mask)"/></svg>}
      {mode === 'guide' && bounds?.ring && <div className="rhythm-guide-target is-ring" style={{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height}} aria-hidden="true"><svg width="100%" height="100%"><ellipse cx={bounds.ring.cx} cy={bounds.ring.cy} rx={bounds.ring.rx} ry={bounds.ring.ry} className="rhythm-guide-ring-halo"/><ellipse cx={bounds.ring.cx} cy={bounds.ring.cy} rx={bounds.ring.rx} ry={bounds.ring.ry}/></svg></div>}
      <section ref={panel} className="rhythm-help-sheet">
        <header><h2 id="rhythm-help-title" tabIndex={-1} ref={heading}>{mode === 'guide' ? steps[step].title : 'Read Daily Rhythm'}</h2><button type="button" className="rhythm-sheet-close" aria-label={mode === 'guide' ? 'Skip rhythm guide' : 'Close rhythm help'} onClick={close}>×</button></header>
        <div className="rhythm-sheet-body">{mode === 'guide' ? <><p className="rhythm-guide-count">{step + 1} of {steps.length}</p><p>{steps[step].text}</p></> : <>
          <h3>One ring · Your day</h3><p>The ring is a single timeline. The pointer marks now: Daily activity that has already happened is shown to its left, and upcoming events to its right.</p>
          <h3>Daily activity · Already happened</h3><p>Past events come from recorded activity. Tap one to open its details.</p>
          <h3>Upcoming · AI predictions</h3><p>AI uses your Typical pattern to predict likely upcoming events. Predictions are only suggestions about what may happen; they are not records, and the activity may not happen.</p>
          <h3>Explore the dial</h3><p>Now focuses on today around the current time; Full day shows all 24 hours. Drag to explore times, or tap an event to see its details.</p>
        </>}</div>
        <footer>{mode === 'guide' ? <><button className="profile-link" type="button" onClick={close}>Skip guide</button><div className="rhythm-guide-navigation"><button className="profile-link" type="button" disabled={step === 0} onClick={() => setStep(value => value - 1)}>Back</button><button className="primary-button" type="button" onClick={() => step === steps.length - 1 ? close() : setStep(value => value + 1)}>{step === steps.length - 1 ? 'Got it' : 'Next'}</button></div></> : <><button className="profile-link" type="button" onClick={startGuide}>Show me around</button><button className="primary-button" type="button" onClick={close}>Done</button></>}</footer>
      </section>
    </dialog>, document.body)}
  </>;
}
