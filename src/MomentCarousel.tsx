import { Children, Fragment, cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

function cardsIn(children: ReactNode): ReactElement[] {
  return Children.toArray(children).flatMap(child => isValidElement(child)
    ? child.type === Fragment ? cardsIn((child.props as { children?: ReactNode }).children) : [child]
    : []);
}

/** Native touch scrolling, mouse dragging and a gently moving circular track. */
export default function MomentCarousel({ children }: { children: ReactNode }) {
  const cards = cardsIn(children);
  const viewport = useRef<HTMLDivElement>(null);
  const pausedUntil = useRef(0);
  const hovering = useRef(false);
  const dragging = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const pause = () => { pausedUntil.current = performance.now() + 7000; };
  const signature = cards.map(card => card.key).join('|');
  useEffect(() => {
    const el = viewport.current;
    if (!el || cards.length < 2) return;
    let segment = 0, frame = 0, last = 0, visible = false, carry = 0;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const measure = () => {
      el.style.setProperty('--moment-carousel-width', `${el.clientWidth}px`);
      const set = el.querySelector<HTMLElement>('.moment-carousel-set');
      segment = set ? set.getBoundingClientRect().width + 14 : 0;
      el.scrollLeft = segment;
    };
    measure();
    const resize = new ResizeObserver(measure); resize.observe(el);
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }); intersection.observe(el);
    const tick = (time: number) => {
      const delta = last ? Math.min(time - last, 50) : 0; last = time;
      if (segment && visible && !pausedRef.current && !motion.matches && !document.hidden && !hovering.current && !dragging.current && time > pausedUntil.current && !el.contains(document.activeElement)) {
        carry += delta * .014;
        const pixels = Math.floor(carry); carry -= pixels;
        el.scrollLeft += pixels;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); };
  }, [signature, cards.length]);
  return <div className="moment-carousel" role="region" aria-label="Moments you might love">
    {cards.length > 1 && <button className="moment-carousel-pause" type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Resume scrolling' : 'Pause scrolling'}</button>}
    <div className={`moment-carousel-viewport ${cards.length < 2 ? 'is-single' : ''}`} ref={viewport}
      onMouseEnter={() => { hovering.current = true; }} onMouseLeave={() => { hovering.current = false; pause(); }}
      onFocusCapture={pause} onWheel={pause} onTouchStart={pause} onTouchEnd={pause}
      onScroll={event => {
        if (cards.length < 2 || dragging.current) return;
        const el = event.currentTarget, set = el.querySelector<HTMLElement>('.moment-carousel-set');
        const segment = set ? set.getBoundingClientRect().width + 14 : 0;
        if (segment && el.scrollLeft < segment / 2) el.scrollLeft += segment;
        else if (segment && el.scrollLeft > segment * 2) el.scrollLeft -= segment;
      }}
      onPointerDown={event => {
        pause(); suppressClick.current = false;
        if (event.pointerType === 'mouse' && event.button === 0) dragging.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
      }}
      onPointerMove={event => {
        const drag = dragging.current;
        if (!drag) return;
        const delta = event.clientX - drag.x;
        if (Math.abs(delta) > 6) { drag.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
        if (drag.moved) { event.preventDefault(); event.currentTarget.scrollLeft = drag.scroll - delta; }
      }}
      onPointerUp={() => { suppressClick.current = dragging.current?.moved ?? false; dragging.current = null; pause(); }}
      onPointerCancel={() => { dragging.current = null; pause(); }}
      onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
      {(cards.length > 1 ? [0, 1, 2] : [1]).map(copy => <div className="moment-carousel-set" key={copy} aria-hidden={copy !== 1 ? true : undefined}>
        {cards.map((card, index) => cloneElement(card as ReactElement<{ tabIndex?: number; draggable?: boolean }>, { key: `${copy}-${index}`, tabIndex: copy === 1 ? undefined : -1, draggable: false }))}
      </div>)}
    </div>
  </div>;
}
