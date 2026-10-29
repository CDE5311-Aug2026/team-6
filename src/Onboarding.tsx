import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { TOUR_STEPS, type SetupValues } from './gettingStarted';

function trapDialog(event: KeyboardEvent<HTMLElement>) {
  if(event.key!=='Tab') return;
  const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')).filter(el=>el.offsetParent!==null);
  const first=controls[0],last=controls[controls.length-1];
  if(!first||!last)return;
  if(event.shiftKey && (document.activeElement===first || document.activeElement?.tagName==='H2')){event.preventDefault();last.focus();}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
}
export function SetupWizard({ initial, allowPetEdit, onFinish, onSkip }: { initial: SetupValues; allowPetEdit: boolean; onFinish: (value: SetupValues) => void; onSkip: () => void }) {
  const [step, setStep] = useState(0);
  const [value, setValue] = useState(initial);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const goals = ['Daily routines', 'Understanding behavior', 'Shared care', 'Health observations'];
  return <div className="getting-started-backdrop"><section className="getting-started-panel" role="dialog" aria-modal="true" aria-labelledby="setup-title" onKeyDown={e=>{if(e.key==='Escape')onSkip();else trapDialog(e);}}>
    <header><span className="getting-started-kicker">MAKE PAWSONA YOURS</span><button className="getting-started-link" onClick={onSkip}>Maybe later</button></header>
    <div className="setup-progress" aria-label={'Step ' + (step + 1) + ' of 3'}>{[0,1,2].map(i => <span key={i} className={i <= step ? 'active' : ''} />)}</div>
    <p className="getting-started-step">Step {step + 1} of 3</p>
    <h2 id="setup-title" tabIndex={-1} ref={heading}>{['A little about you', 'Who do you care for?', 'Care, your way'][step]}</h2>
    <form onSubmit={event => { event.preventDefault(); if (step < 2) setStep(step + 1); else onFinish(value); }}>
      <div className="setup-fields">
        {step === 0 && <><p>Choose how you appear to your care circle. You can change this later.</p><label>Display name<input autoComplete="nickname" maxLength={60} required value={value.name} onChange={e => setValue({...value, name:e.target.value})} placeholder="What should we call you?" /></label><label>Your relationship<select value={value.relationship} onChange={e => setValue({...value,relationship:e.target.value})}><option value="">Choose, if you like</option><option>Pet parent</option><option>Family caregiver</option><option>Temporary caregiver</option></select></label></>}
        {step === 1 && <><p>{allowPetEdit ? 'Add the basics, or leave the name blank to add a pet later.' : 'Your shared pet’s details are managed by their primary caregiver.'}</p>{allowPetEdit && <><label>Pet name (optional)<input maxLength={60} value={value.petName} onChange={e => setValue({...value,petName:e.target.value})} placeholder="Your pet’s name" /></label><label>Pet type<select value={value.species} onChange={e => setValue({...value,species:e.target.value as 'Dog'|'Cat'})}><option>Dog</option><option>Cat</option></select></label><small>Breed, age, photos and care-circle permissions can be set in Pet profile.</small></>}</>}
        {step === 2 && <><p>What would you like help with? Choose as many as you like.</p><div className="setup-goals">{goals.map(goal => <button type="button" key={goal} aria-pressed={value.goals.includes(goal)} onClick={() => setValue({...value,goals:value.goals.includes(goal)?value.goals.filter(g=>g!==goal):[...value.goals,goal]})}>{goal}</button>)}</div><h3>On this device</h3><label className="setup-toggle"><input type="checkbox" checked={value.largeText} onChange={e=>setValue({...value,largeText:e.target.checked})} />Larger reading text</label><label className="setup-toggle"><input type="checkbox" checked={value.reducedMotion} onChange={e=>setValue({...value,reducedMotion:e.target.checked})} />Reduce motion</label><label className="setup-toggle"><input type="checkbox" checked={value.includeHistory} onChange={e=>setValue({...value,includeHistory:e.target.checked})} />Include recent Story text in Ask AI</label><small>When you ask, permitted recent records may be shared with OpenAI. Private records and past media are excluded. You can change this in Settings.</small></>}
      </div>
      <footer>{step > 0 && <button type="button" className="cancel-button" onClick={()=>setStep(step-1)}>Back</button>}<button type="submit" className="primary-button" disabled={step === 0 && !value.name.trim()}>{step === 2 ? 'Save & start guide' : 'Continue'}</button></footer>
    </form>
  </section></div>;
}

export function GuidedTour({ index, onStep, onClose }: { index: number; onStep: (index: number) => void; onClose: (completed: boolean) => void }) {
  const step = TOUR_STEPS[index];
  const panel = useRef<HTMLElement>(null);
  const [bounds, setBounds] = useState<{left:number;top:number;width:number;height:number}|null>(null);
  useEffect(() => {
    const phone = panel.current?.closest<HTMLElement>('.phone');
    let frame = 0;
    const measure = () => {
      if (!phone) return;
      const target = phone.querySelector<HTMLElement>(step.target) ?? phone.querySelector<HTMLElement>('.screen-scroll');
      if (!target) return;
      const p=phone.getBoundingClientRect(), r=target.getBoundingClientRect();
      const panelTop=panel.current?.getBoundingClientRect().top ?? p.bottom;
      const top=Math.max(r.top,p.top+105), bottom=Math.min(r.bottom,panelTop-12);
      setBounds(bottom>top+20?{left:Math.max(r.left-p.left,12),top:top-p.top,width:Math.min(r.width,p.width-24),height:bottom-top}:null);
    };
    const target=phone?.querySelector<HTMLElement>(step.target);
    target?.scrollIntoView({block:'start',behavior:'instant'});
    frame=requestAnimationFrame(measure);
    const resize=new ResizeObserver(measure); if(phone)resize.observe(phone);
    phone?.querySelector('.screen-scroll')?.addEventListener('scroll',measure,{passive:true});
    return ()=>{cancelAnimationFrame(frame);resize.disconnect();phone?.querySelector('.screen-scroll')?.removeEventListener('scroll',measure);};
  },[index,step.target]);
  useEffect(()=>{panel.current?.querySelector<HTMLHeadingElement>('h2')?.focus();},[index]);
  return <div className="guided-tour-layer">
    {bounds && <div className="guided-tour-focus" style={bounds} aria-hidden="true" />}
    <section ref={panel} className="guided-tour-panel" role="dialog" aria-modal="true" aria-labelledby="tour-title" onKeyDown={e=>{if(e.key==='Escape')onClose(false);else trapDialog(e);}}>
      <header><span className="getting-started-kicker">A QUICK LOOK AROUND</span><button className="getting-started-link" onClick={()=>onClose(false)}>Skip guide</button></header>
      <p className="getting-started-step">{index+1} / {TOUR_STEPS.length}</p><h2 id="tour-title" tabIndex={-1}>{step.title}</h2><p>{step.text}</p>
      <footer><button className="getting-started-link" disabled={index===0} onClick={()=>onStep(index-1)}>Back</button><div className="tour-dots" aria-hidden="true">{TOUR_STEPS.map((_,i)=><span key={i} className={i===index?'active':''} />)}</div><button className="primary-button" onClick={()=>index===TOUR_STEPS.length-1?onClose(true):onStep(index+1)}>{index===TOUR_STEPS.length-1?'Finish':'Next'}</button></footer>
    </section>
  </div>;
}

const helpSections = [
 ['Start with Today', 'Daily Rhythm shows recorded activity and confirmed routine windows. Today’s care turns plans into tasks. Tick a task only when completed; the bell lets you ask a caregiver to check it. A missing record is not proof that care was missed.'],
 ['Add and review Story records', 'Open Story and choose Add a moment. Pick an activity or write an observation, optionally add media, check the time and save. Open a record to review its details or add context. Private records stay out of the shared care timeline and Ask AI history.'],
 ['Set up your pet and care circle', 'Pet profile holds pet details, health and care records, Typical patterns and the care circle. The primary caregiver invites registered accounts and manages access. Viewers can read shared records; caregivers can contribute according to their permissions.'],
 ['Confirm a routine', 'Review the evidence and edit suggested time windows in Typical patterns. AI drafts need human confirmation. Timing prompts are based on a plan, not a diagnosis or proof of completed care.'],
 ['Coordinate care', 'Open the care plan to assign one-off tasks or request help. Recipients accept or decline; the primary caregiver can take over or ask someone else. Done by and the recorded time show who confirmed completion. Wait for sync to finish before assuming another caregiver can see an update.'],
 ['Ask AI', 'Quick questions fill the message box so you can edit them before sending. You may attach a photo. When enabled, limited recent public Story text is included with your question; private records and historical media are excluded. AI can be wrong and cannot diagnose your pet or replace a veterinarian.'],
 ['Reminders and sync', 'Time prompts update while Pawsona is open. Caregiver reminders appear inside Pawsona; phone and lock-screen push are not connected. If Not synced appears, check the message and retry. Do not repeat care solely because a record is missing.'],
 ['Your account on another device', 'Only the newest login can use your account’s cloud workspace. Signing in elsewhere ends this device’s access. The previous device shows a message and returns to Log in. Unsynced changes are not sent after it is replaced.'],
 ['Preferences and privacy', 'Edit your display name in My Profile. Display and Ask AI history preferences are in Settings. Basic setup and the guide can be revisited here. Guest data remains in the current browser. Full account deletion is not available in this course prototype; ask the study team for help.']
];
export function HelpPage({ onBack, onReview, onSetup }: { onBack:()=>void;onReview:()=>void;onSetup:()=>void }) {
  return <section className="help-page"><header className="detail-header"><div className="detail-title-row"><button className="back-button" onClick={onBack} aria-label="Back to My Profile">←</button><h1>Help & getting started</h1></div></header><section className="help-start-card"><span className="getting-started-kicker">A LITTLE GUIDANCE</span><h2>Feel at home in Pawsona</h2><p>Take the tour again, or finish setting up your space.</p><button className="primary-button" onClick={onReview}>Review getting-started guide</button><button className="getting-started-link" onClick={onSetup}>Edit basics & preferences →</button></section><div className="help-sections">{helpSections.map(([title,text],i)=><details key={title} open={i===0}><summary>{title}</summary><p>{text}</p></details>)}</div></section>;
}
