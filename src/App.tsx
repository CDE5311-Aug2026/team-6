import { useEffect, useRef, useState, type RefObject } from 'react';

type View =
  | 'today'
  | 'story'
  | 'ask'
  | 'pets'
  | 'you'
  | 'petDetails'
  | 'profile'
  | 'memberDetails'
  | 'careMembers'
  | 'patternHistory'
  | 'careEvent'
  | 'overview'
  | 'clip'
  | 'context'
  | 'confirm'
  | 'saved'
  | 'addMoments'
  | 'addCompose'
  | 'addPreview'
  | 'addSaved'
  | 'undone';

type Interpretation = 'normal' | 'one-time' | 'open';

type OwnerContext = {
  note: string;
  interpretation: Interpretation;
  savedAt: string;
};

type CareMember = { id: string; name: string; role: string; detail: string };
type StoryObservation = { id: string; note: string; title: string; image: string; momentCount: number; context: string; privateRecord: boolean; savedAt: string };

const readStoryObservations = (): StoryObservation[] => {
  try {
    const value = localStorage.getItem('pawsona-story-observations-v1');
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed as StoryObservation[] : [];
  } catch { return []; }
};

const storageKey = 'pawsona-owner-context-v1';
const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;
const interpretationLabels: Record<Interpretation, string> = {
  normal: 'Normal in this context',
  'one-time': 'One-time event',
  open: 'Leave the pattern open',
};

function readSavedContext(): OwnerContext | null {
  try {
    const value = localStorage.getItem(storageKey);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'note' in parsed &&
      'interpretation' in parsed &&
      typeof parsed.note === 'string' &&
      (parsed.interpretation === 'normal' ||
        parsed.interpretation === 'one-time' ||
        parsed.interpretation === 'open')
    ) {
      return parsed as OwnerContext;
    }
  } catch {
    // The demo can still run if browser storage is unavailable.
  }
  return null;
}

function StatusBar() {
  return (
    <div className="status-bar" aria-hidden="true">
      <span>9:41</span>
      <img src={asset('status-levels.svg')} alt="" />
    </div>
  );
}

function Avatar() {
  return <img className="avatar" src={asset('luna-avatar.png')} alt="Luna" />;
}

function OwnerAvatar({ src, name, className = '' }: { src: string; name: string; className?: string }) {
  return <span className={`member-avatar emily-avatar owner-avatar ${className}`}>{src ? <img src={src} alt="" /> : name.slice(0, 1).toUpperCase()}</span>;
}

function MainHeader({ eyebrow, title, subtitle, onPetsNavigate }: { eyebrow: string; title: string; subtitle?: string; onPetsNavigate?: () => void }) {
  return (
    <header className="main-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p className="main-subtitle">{subtitle}</p>}
      </div>
      <button className="header-avatar-button" type="button" aria-label="Open Pets" onClick={onPetsNavigate}><Avatar /></button>
    </header>
  );
}

function DetailHeader({ title, eyebrow, onBack }: { title: string; eyebrow: string; onBack: () => void }) {
  return (
    <header className="detail-header">
      <div className="detail-title-row">
        <button className="back-button" aria-label="Go back" onClick={onBack}>←</button>
        <h1>{title}</h1>
      </div>
      <p className="eyebrow">{eyebrow}</p>
    </header>
  );
}

function BottomNav({ active, onNavigate }: { active: View; onNavigate: (view: View) => void }) {
  const items: { id: View; label: string; icon?: string }[] = [
    { id: 'today', label: 'Today', icon: 'nav-today.svg' },
    { id: 'story', label: 'Story', icon: 'nav-story.svg' },
    { id: 'ask', label: 'Ask AI', icon: 'nav-ai.svg' },
    { id: 'pets', label: 'Pets', icon: 'paw' },
    { id: 'you', label: 'You' },
  ];
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {items.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
          aria-current={active === item.id ? 'page' : undefined}
        >
          <span className="nav-icon">
            {item.icon === 'paw' ? <svg className="paw-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="5.2" cy="9" rx="2.1" ry="2.8" /><ellipse cx="10" cy="5.7" rx="2" ry="2.7" /><ellipse cx="15.2" cy="5.8" rx="2" ry="2.7" /><ellipse cx="19" cy="9.8" rx="2" ry="2.7" /><path d="M12 10.2c-2.1 0-3.1 1.9-4.5 3.4-1.2 1.3-2.2 2.6-1.7 4.1.6 1.7 2.2 1.7 3.8 1.2.9-.3 1.6-.5 2.5-.5s1.7.2 2.6.5c1.5.5 3.1.5 3.7-1.2.5-1.5-.5-2.8-1.7-4.1-1.4-1.5-2.5-3.4-4.7-3.4Z" /></svg> : item.icon ? <img src={asset(item.icon)} alt="" /> : <span className="you-icon" />}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
      <span className="home-indicator" aria-hidden="true" />
    </nav>
  );
}

function StickyAction({ label, onClick, hint, disabled = false }: { label: string; onClick: () => void; hint?: string; disabled?: boolean }) {
  return (
    <div className="sticky-action">
      <button className="primary-button full" onClick={onClick} disabled={disabled}>{label}</button>
      {hint && <p>{hint}</p>}
    </div>
  );
}

function TodayPage({ onStory, onEvidence, onPetsNavigate, saved }: { onStory: () => void; onEvidence: () => void; onPetsNavigate: () => void; saved: OwnerContext | null }) {
  return (
    <>
      <MainHeader eyebrow="A little window into her day." title="Hello, Luna!" subtitle="Tuesday · 15 September" onPetsNavigate={onPetsNavigate} />
      <section className="today-hero">
        <span className="story-badge">✦ &nbsp; TODAY’S STORY</span>
        <img className="hero-sparkle" src={asset('sparkle.svg')} alt="" />
        <h2>Sunny naps, a playful afternoon, and one very good toy.</h2>
        <p>9:00 AM–6:00 PM</p>
        <button className="primary-button" onClick={onStory}>Read Luna’s story →</button>
      </section>

      <section className="today-section">
        <h2>Moments you might love</h2>
        <div className="moment-grid">
          <button className="moment-card" onClick={onStory}>
            <img src={asset('toy-chase.png')} alt="Luna with her toy on a blue background" />
            <span className="moment-card-copy"><strong>The toy chase</strong><small>Video · 0:18 · 4:20 PM</small></span>
          </button>
          <button className="moment-card" onClick={onStory}>
            <img src={asset('sunny-nap.png')} alt="Luna resting on a yellow background" />
            <span className="moment-card-copy"><strong>A sunny window nap</strong><small>Photo · 11:35 AM</small></span>
          </button>
        </div>
      </section>

      <section className="today-section closer-look">
        <h2>Worth a closer look</h2>
        <button className="notice-card" onClick={onEvidence}>
          <img src={asset('warning.png')} alt="" />
          <span><strong>{saved ? 'Your context is now linked' : 'Afternoon rest looked a little longer'}</strong><small>{saved ? 'Review the clips and your note.' : 'It may be ordinary. Review the clips.'}</small></span>
        </button>
      </section>
    </>
  );
}

function StoryPage({ onEvidence, onAdd, onPetsNavigate, saved, observations }: { onEvidence: () => void; onAdd: () => void; onPetsNavigate: () => void; saved: OwnerContext | null; observations: StoryObservation[] }) {
  const moments = [
    { time: '8:10 AM', title: 'Breakfast at her bowl', note: 'Observed eating as usual', image: 'story-breakfast.png' },
    { time: '11:35 AM', title: 'Rest by the window', note: saved ? 'Emily added context to this moment' : 'A quiet moment to remember', image: 'story-window.png' },
    { time: '4:20 PM', title: 'Her favourite toy chase', note: 'One of today’s highlights!', image: 'story-toy.png' },
  ];
  const visibleObservations = observations.filter((observation) => !observation.privateRecord);
  return (
    <>
      <MainHeader eyebrow="LUNA · DAILY STORY" title="Her moments" subtitle="Tuesday · 15 September" onPetsNavigate={onPetsNavigate} />
      <div className="story-summary"><img src={asset('story-heart.png')} alt="" /><strong>3 moments, one lovely day</strong></div>
      <section className="timeline-section">
        <div className="section-heading"><h2>Today’s timeline</h2><button className="text-link" onClick={onAdd}>Edit story ✎</button></div>
        <div className="timeline-list">
          {visibleObservations.map((observation) => (
            <button className="timeline-row" key={observation.id} onClick={onEvidence}>
              <span className="timeline-time">Today</span>
              <span className="timeline-card"><img src={observation.image} alt="" /><span><strong>{observation.title}</strong><small>{observation.note}</small></span><span className="dots" aria-hidden="true">···</span></span>
            </button>
          ))}
          {moments.map((moment) => (
            <button className="timeline-row" key={moment.time} onClick={onEvidence}>
              <span className="timeline-time">{moment.time.replace(' ', '\n')}</span>
              <span className="timeline-card">
                <img src={asset(moment.image)} alt="" />
                <span><strong>{moment.title}</strong><small>{moment.note}</small></span>
                <span className="dots" aria-hidden="true">···</span>
              </span>
            </button>
          ))}
        </div>
      </section>
      {saved && <button className="story-owner-note" onClick={onEvidence}><strong>Emily’s context</strong><span>{saved.note}</span></button>}
    </>
  );
}

const momentChoices = [
  { id: 'window', time: '11:35', title: 'window rest', image: 'story-window.png' },
  { id: 'toy', time: '16:20', title: 'toy chase', image: 'story-toy.png' },
  { id: 'breakfast', time: '08:10', title: 'breakfast', image: 'story-breakfast.png' },
];

function StoryAddPage({ step, onBack, onCancel, selectedMoments, setSelectedMoments, note, setNote, context, setContext, privateRecord, setPrivateRecord, observations, ownerName, onSave, onEdit }: {
  step: 'moments' | 'compose' | 'preview' | 'saved';
  onBack: () => void;
  onCancel: () => void;
  selectedMoments: string[];
  setSelectedMoments: (ids: string[]) => void;
  note: string;
  setNote: (value: string) => void;
  context: string;
  setContext: (value: string) => void;
  privateRecord: boolean;
  setPrivateRecord: (value: boolean) => void;
  observations: StoryObservation[];
  ownerName: string;
  onSave: () => void;
  onEdit: () => void;
}) {
  const [sourceTab, setSourceTab] = useState<'Photos' | 'Clips' | 'Notes'>('Photos');
  const latest = observations[0];
  const selected = momentChoices.filter((moment) => selectedMoments.includes(moment.id));
  const noteChoices = [
    { id: 'note-visitors', text: 'Visitors came over today.', label: 'Owner note · today' },
    { id: 'note-play', text: 'Luna played after lunch.', label: 'Care note · yesterday' },
    { id: 'note-rest', text: 'Quiet rest by the window.', label: 'Routine note · last week' },
  ];
  const selectedNotes = noteChoices.filter((entry) => selectedMoments.includes(entry.id));
  const image = latest?.image ?? selected[0]?.image ?? asset('story-window.png');
  const observationText = step === 'saved' ? latest?.note ?? note : note;
  const observationTitle = latest?.title || 'A window rest after visitors';
  const cancel = <button className="add-cancel" onClick={onCancel}>Cancel</button>;
  const header = (title: string, eyebrow: string) => <header className="add-flow-header"><div className="add-flow-title"><button className="back-button" aria-label="Go back" onClick={onBack}>←</button><h1>{title}</h1>{cancel}</div><p className="eyebrow">{eyebrow}</p></header>;

  if (step === 'moments') return <div className="add-flow-page">
    {header('Choose moments', '1 OF 3 · SELECT SOURCES')}
    <div className="source-tabs" role="tablist" aria-label="Moment sources">{(['Photos', 'Clips', 'Notes'] as const).map((tab) => <button key={tab} className={sourceTab === tab ? 'active' : ''} role="tab" aria-selected={sourceTab === tab} onClick={() => { setSourceTab(tab); setSelectedMoments(tab === 'Notes' ? ['note-visitors'] : ['window', 'toy']); }}>{tab}</button>)}</div>
    <div className={`moment-picker-grid ${sourceTab === 'Notes' ? 'notes-picker-grid' : ''}`}>
      {sourceTab === 'Notes' ? noteChoices.map((entry) => { const chosen = selectedMoments.includes(entry.id); return <button className={`moment-choice note-moment-choice ${chosen ? 'selected' : ''}`} key={entry.id} onClick={() => setSelectedMoments(chosen ? selectedMoments.filter((id) => id !== entry.id) : [...selectedMoments, entry.id])}><span>{entry.text}</span>{chosen && <span className="moment-check">✓</span>}<small>{entry.label}</small></button>; }) : momentChoices.map((moment, index) => { const chosen = selectedMoments.includes(moment.id); const label = sourceTab === 'Clips' ? ['Clip · 0:12', 'Clip · 0:18', 'Clip · 0:08'][index] : `${moment.time} · ${moment.title}`; return <button className={`moment-choice ${chosen ? 'selected' : ''}`} key={moment.id} onClick={() => setSelectedMoments(chosen ? selectedMoments.filter((id) => id !== moment.id) : [...selectedMoments, moment.id])}><img src={asset(moment.image)} alt="" />{chosen && <span className="moment-check">✓</span>}<small>{label}</small></button>; })}
      {sourceTab !== 'Notes' && <label className="moment-choice add-device-choice"><input type="file" accept="image/*,video/*" /><span className="add-device-plus">＋</span><span>Add photo or video</span></label>}
    </div>
    <button className="text-only-option" onClick={() => { setSelectedMoments([]); onEdit(); }}><strong>Start with a written observation</strong><span>No photo or clip needed to remember this moment.</span></button>
    <div className="sticky-action"><button className="primary-button full" onClick={onEdit} disabled={!selectedMoments.length}>Continue with {selectedMoments.length} {sourceTab === 'Notes' ? (selectedMoments.length === 1 ? 'note' : 'notes') : sourceTab === 'Clips' ? (selectedMoments.length === 1 ? 'clip' : 'clips') : (selectedMoments.length === 1 ? 'moment' : 'moments')}</button><p>Only what you select will be added.</p></div>
  </div>;

  if (step === 'compose') return <div className="add-flow-page">
    {header('Write a moment', '2 OF 3 · ADD YOUR WORDS')}
    {selected.length > 0 || selectedNotes.length > 0 ? <><div className="compose-section-label"><strong>Selected moments</strong><button className="text-link" onClick={onBack}>Edit</button></div>{selected.length > 0 ? <div className="selected-moments-strip">{selected.map((moment) => <img key={moment.id} src={asset(moment.image)} alt={moment.title} />)}</div> : <div className="selected-note-strip">{selectedNotes.map((entry) => <div key={entry.id}><span>{entry.text}</span><small>{entry.label}</small></div>)}</div>}</> : <><div className="written-observation-mode"><strong>Written observation</strong><button className="text-link" onClick={onBack}>Edit</button></div><div className="written-observation-note"><strong>A note is enough</strong><span>You can describe a moment without a photo or camera clip.</span></div></>}
    <label className="observation-writing-card"><strong>What happened with Luna?</strong><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe what you noticed…" /></label>
    <section className="add-context-choices"><strong>Add context</strong><div>{['Visitors at home', 'Routine changed', 'Not sure yet'].map((item) => <button key={item} className={context === item ? 'active' : ''} onClick={() => setContext(context === item ? '' : item)}>{item}</button>)}</div></section>
    <div className="sticky-action"><button className="primary-button full" onClick={onEdit} disabled={!note.trim()}>Preview observation</button><p>Your note is shown as your own words.</p></div>
  </div>;

  if (step === 'preview') return <div className="add-flow-page">
    {header('Preview', '3 OF 3 · CHECK BEFORE SAVING')}
    <article className="observation-preview-card">{selected.length ? <img src={image} alt="Luna" /> : <div className="observation-note-visual"><small>A note from {ownerName}</small><p>{note || 'A moment with Luna.'}</p></div>}<div className="observation-preview-copy"><small>Luna · Today</small><strong>{observationTitle}</strong><p>{note || 'A moment with Luna.'}</p><div>{selectedMoments.length} selected {selectedMoments.length === 1 ? 'moment' : 'moments'} · {selected.length ? 'owner observation' : 'written observation'}</div><span>Owner-provided context{context ? ` · ${context}` : ''}</span></div></article>
    <section className="observation-destination"><strong>Where this goes</strong><button className={!privateRecord ? 'selected' : ''} onClick={() => setPrivateRecord(false)}><span>{!privateRecord ? '✓' : '○'}</span>Add to Luna’s Story</button><button className={privateRecord ? 'selected' : ''} onClick={() => setPrivateRecord(true)}><span>{privateRecord ? '✓' : '○'}</span>Keep as a private record instead</button><small>You choose which sources and words are saved.</small></section>
    <div className="sticky-action"><button className="primary-button full" onClick={onSave}>Save observation</button><p>Nothing updates Luna’s baseline automatically.</p></div>
  </div>;

  return <div className="add-flow-page">
    {header('Moment saved', `ADDED TO ${privateRecord ? 'PRIVATE RECORDS' : 'LUNA’S STORY'}`)}
    <section className="observation-saved-banner"><strong>✓ &nbsp;{privateRecord ? 'Your private record is saved' : 'Your observation is saved'}</strong><span>{privateRecord ? `Visible only to you · Added by ${ownerName}` : `Added by ${ownerName}`} · Today</span></section>
    <article className="observation-preview-card saved-observation-card">{selected.length ? <img src={image} alt="Luna" /> : <div className="observation-note-visual"><small>A note from {ownerName}</small><p>{observationText || 'A moment with Luna.'}</p></div>}<div className="observation-preview-copy"><strong>{observationTitle}</strong><p>{observationText || 'A moment with Luna.'}</p><div>{latest?.momentCount ?? selectedMoments.length} selected moments · owner observation</div><span>{privateRecord ? 'Private record · not in Luna’s Story' : 'Visible in Luna’s Story'}</span></div></article>
    <div className="saved-observation-links"><button className="text-link" onClick={onEdit}>Edit observation</button><button className="text-link" onClick={onCancel}>Return to Story</button></div>
    <div className="sticky-action"><button className="primary-button full" onClick={onCancel}>{privateRecord ? 'Return to Today' : 'View in Story'}</button><p>You can edit or remove this observation later.</p></div>
  </div>;
}

function OverviewPage({ onBack, onClip, saved, onSaved }: { onBack: () => void; onClip: () => void; saved: OwnerContext | null; onSaved: () => void }) {
  const heights = [49, 70, 58, 84, 5, 74, 91];
  return (
    <>
      <DetailHeader title="Afternoon rest" eyebrow="TODAY · POSSIBLE CHANGE" onBack={onBack} />
      <section className="insight-card"><strong>Rest looked longer this week</strong><b>4 of 7 observed afternoons</b><p>Compared with Luna’s recent 4-week record.</p></section>
      {saved && <button className="overview-owner-context" onClick={onSaved}><small>OWNER CONTEXT ADDED</small><strong>{interpretationLabels[saved.interpretation]}</strong><span>{saved.note}</span><em>View or undo →</em></button>}
      <section className="chart-card"><strong>Recent afternoons</strong><p>Recorded rest &nbsp;·&nbsp; missing data</p><div className="bars">{heights.map((height, i) => <div className="bar-col" key={i}><span className={`bar ${i === 4 ? 'missing' : ''}`} style={{ height }} /><small>{'MTWTFSS'[i]}</small></div>)}</div><p className="coverage">5 of 7 days have usable coverage</p></section>
      <div className="section-heading supporting-title"><h2>Supporting moments</h2><span>2 clips + 1 note</span></div>
      <div className="evidence-grid">
        <button className="evidence-tile" onClick={onClip}><img src={asset('overview-window.png')} alt="Luna resting by the window" /><span><strong>Window rest</strong><small>15 Sep · clip</small></span></button>
        <button className="evidence-tile" onClick={onClip}><img src={asset('overview-rest.png')} alt="Luna resting in another selected clip" /><span><strong>Another rest</strong><small>Recent day · clip</small></span></button>
      </div>
      <StickyAction label="See supporting moments" onClick={onClip} hint="This is a comparison, not a cause or diagnosis." />
    </>
  );
}

function ClipPage({ onBack, onContext }: { onBack: () => void; onContext: () => void }) {
  const [playing, setPlaying] = useState(false);
  return (
    <>
      <DetailHeader title="Window rest" eyebrow="SELECTED CLIP · 15 SEP" onBack={onBack} />
      <section className="clip-player">
        <div className="clip-image"><img src={asset('clip-still.png')} alt="Luna in the selected camera clip" /><button aria-label={playing ? 'Pause clip preview' : 'Play clip preview'} onClick={() => setPlaying(!playing)}><img src={asset('play.svg')} alt="" /></button></div>
        <div className="clip-progress"><span style={{ width: playing ? '62%' : '38%' }} /></div>
        <small>{playing ? '0:19' : '0:12'} / 0:28</small>
      </section>
      <section className="detail-card"><strong>From the home camera</strong><p>15 Sep · 11:35 AM–11:36 AM</p></section>
      <section className="detail-card warm"><strong>What the clip shows</strong><p>Luna rested beside the window during this recorded moment.</p></section>
      <section className="detail-card"><strong>Emily’s note · today</strong><p>“Visitors were at home.” This is owner context, not an AI conclusion.</p></section>
      <StickyAction label="Add your context" onClick={onContext} hint="Your words will stay separate from the clip." />
    </>
  );
}

function ContextPage({ note, setNote, interpretation, setInterpretation, onBack, onReview }: {
  note: string;
  setNote: (value: string) => void;
  interpretation: Interpretation;
  setInterpretation: (value: Interpretation) => void;
  onBack: () => void;
  onReview: () => void;
}) {
  return (
    <>
      <DetailHeader title="Add context" eyebrow="YOUR WORDS · OWNER INPUT" onBack={onBack} />
      <div className="linked-evidence"><img src={asset('context-clip.png')} alt="Selected clip of Luna" /><span><strong>Afternoon rest</strong><small>2 clips · selected sources</small></span></div>
      <h2 className="question-heading">What else was happening?</h2>
      <div className="writing-field"><textarea aria-label="Your context for Luna’s afternoon rest" value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did you notice at home?" maxLength={500} /><div>＋ Photo &nbsp;&nbsp; ◉ Voice note</div></div>
      <fieldset className="choice-card"><legend>How should Pawsona treat this?</legend>{(Object.keys(interpretationLabels) as Interpretation[]).map((value) => <label key={value}><input type="radio" name="interpretation" value={value} checked={interpretation === value} onChange={() => setInterpretation(value)} />{interpretationLabels[value]}</label>)}</fieldset>
      <StickyAction label="Review what will be saved" onClick={onReview} disabled={!note.trim()} hint="You can leave this pattern open." />
    </>
  );
}

function ConfirmPage({ note, interpretation, onBack, onSave }: { note: string; interpretation: Interpretation; onBack: () => void; onSave: () => void }) {
  return (
    <>
      <DetailHeader title="Confirm" eyebrow="REVIEW BEFORE SAVING" onBack={onBack} />
      <section className="confirm-card"><small>OWNER CORRECTION</small><h2>{interpretationLabels[interpretation]}</h2><p>“{note}”</p><span>Emily · Primary owner · Today</span></section>
      <div className="linked-evidence"><img src={asset('context-clip.png')} alt="Selected clip of Luna" /><span><strong>Linked evidence</strong><small>2 selected clips + owner note</small></span></div>
      <section className="detail-card effects-card"><strong>After you save</strong><p>✓ &nbsp;Your context stays attributed to you</p><p>✓ &nbsp;The original observations stay available</p><p>○ &nbsp;Baseline is not changed automatically</p></section>
      <button className="text-link standalone" onClick={onBack}>Edit words or choice</button>
      <StickyAction label="Save owner correction" onClick={onSave} />
    </>
  );
}

function SavedPage({ saved, onBack, onUndo, onEvidence, onEdit }: { saved: OwnerContext; onBack: () => void; onUndo: () => void; onEvidence: () => void; onEdit: () => void }) {
  return (
    <>
      <DetailHeader title="Saved" eyebrow="OWNER CORRECTION SAVED" onBack={onBack} />
      <section className="saved-banner"><h2>✓ &nbsp;Context saved</h2><p>Luna’s baseline was not changed automatically.</p></section>
      <section className="saved-result"><small>EMILY’S CONTEXT</small><strong>{interpretationLabels[saved.interpretation]}</strong><p>{saved.note}</p><div>Linked to 2 selected clips · saved today</div><span>Owner-confirmed context</span></section>
      <section className="detail-card"><strong>What happens next?</strong><p>Future reviews can show this context alongside new observations.</p></section>
      <div className="saved-links"><button className="text-link" onClick={onUndo}>Undo correction</button><button className="text-link" onClick={onEvidence}>Review linked evidence</button><button className="text-link" onClick={onEdit}>Edit your context</button></div>
      <StickyAction label="Return to Today" onClick={onBack} />
    </>
  );
}

function UndonePage({ onBack, onReview }: { onBack: () => void; onReview: () => void }) {
  return (
    <>
      <DetailHeader title="Correction undone" eyebrow="OWNER CONTEXT REMOVED" onBack={onBack} />
      <section className="saved-banner"><h2>✓ &nbsp;Correction undone</h2><p>Your saved context has been removed from this pattern.</p></section>
      <section className="detail-card"><strong>Original observations remain</strong><p>The selected clips and Luna’s Story are still available for review.</p></section>
      <button className="text-link standalone" onClick={onReview}>Review the evidence again</button>
      <StickyAction label="Return to Today" onClick={onBack} />
    </>
  );
}

type AskAttachment = { url: string; name: string };
type AskMessage = { role: 'user' | 'assistant'; text: string; attachment?: AskAttachment };

function AskPage({ onEvidence, onContext, onPetsNavigate, messages, messageEndRef }: { onEvidence: () => void; onContext: () => void; onPetsNavigate: () => void; messages: AskMessage[]; messageEndRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="ask-page">
      <MainHeader eyebrow="ASK AI · OBSERVATION DIALOGUE" title="Ask Pawsona" onPetsNavigate={onPetsNavigate} />
      <div className="linked-evidence ask-status"><span className="loading-ring" /><span><strong>Reviewing afternoon rest</strong><small>Linked to Today’s Story · 2 clips + your note</small></span></div>
      <section className="ask-thread" aria-label="Conversation with Pawsona">
        <article className="chat-message ai">Luna rested longer this afternoon than in the recent clips available. I can’t tell why—or know exactly how she felt. Would you like to check the evidence or add what happened at home?<button className="text-link" onClick={onEvidence}>View evidence →</button></article>
        <article className="chat-message owner">My family had visitors today. She often settles down after that.</article>
        <article className="chat-message ai">Would you like to add this as owner context? You can review the clips before anything is saved.<div className="chat-choices"><button onClick={onContext}>Yes</button><button onClick={onEvidence}>No</button></div></article>
        {messages.map((message, index) => message.role === 'user'
          ? <article className="chat-message owner" key={`user-${index}`}>{message.attachment && <img className="chat-attachment" src={message.attachment.url} alt={message.attachment.name} />}{message.text && <span>{message.text}</span>}</article>
          : <article className="chat-message ai dynamic-answer" key={`assistant-${index}`}>{message.text}<button className="text-link" onClick={onEvidence}>View linked evidence →</button></article>)}
        <div ref={messageEndRef} />
      </section>
    </div>
  );
}

function AskComposer({ value, onValue, onSend, onQuickContext }: { value: string; onValue: (value: string) => void; onSend: (attachment?: AskAttachment) => void; onQuickContext: (value: string) => void }) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<AskAttachment | undefined>();
  function removeAttachment() {
    if (attachment) URL.revokeObjectURL(attachment.url);
    setAttachment(undefined);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }
  function send() {
    onSend(attachment);
    setAttachment(undefined);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }
  return (
    <section className={`ask-dock${attachment ? ' has-attachment' : ''}`} aria-label="Ask Pawsona a question">
      <div className="quick-context-label">Quick context</div>
      <div className="quick-chips">
        <button onClick={() => onQuickContext('Food changed')}>Food changed</button>
        <button onClick={() => onQuickContext('Routine changed')}>Routine changed</button>
        <button onClick={() => onQuickContext('Not sure yet')}>Not sure yet</button>
      </div>
      <div className={`ask-input-box${attachment ? ' has-attachment' : ''}`}>
        {attachment && <div className="ask-attachment-preview"><div className="ask-attachment-tile"><img src={attachment.url} alt={attachment.name} /><button type="button" aria-label="Remove attached image" onClick={removeAttachment}>×</button></div></div>}
        <textarea aria-label="What would you like to ask Pawsona?" placeholder="What would you like to know?" value={value} onChange={(event) => onValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} />
        <div className="ask-input-tools">
          <button aria-label="Attach an image" onClick={() => imageInputRef.current?.click()}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="m5 17 5-5 3 3 2-2 5 5" /></svg></button>
          <button aria-label="Add context" onClick={() => onQuickContext('Please include this context: ')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 6-6 6 6 6M16 6l6 6-6 6" /></svg></button>
          <button aria-label="Voice note" onClick={() => onQuickContext('Voice note: ')}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" /></svg></button>
          <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) { if (attachment) URL.revokeObjectURL(attachment.url); setAttachment({ url: URL.createObjectURL(file), name: file.name }); } }} />
          <button className="ask-send-button" aria-label="Send message" disabled={!value.trim() && !attachment} onClick={send}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg></button>
        </div>
      </div>
    </section>
  );
}

function SimplePage({ kind, petName, ownerName, ownerRole = 'Primary caregiver', ownerAvatar = '', ownerPreference = 'Manage your profile details here.', onPetsNavigate, onPetEdit, onProfileEdit, onAction, careMembers, primaryMemberId, onMemberClick, onCareMembers, onPatternHistory, onCareEvent }: { kind: 'pets' | 'you'; petName: string; ownerName: string; ownerRole?: string; ownerAvatar?: string; ownerPreference?: string; onPetsNavigate: () => void; onPetEdit: () => void; onProfileEdit: () => void; onAction: (title: string, detail: string) => void; careMembers: CareMember[]; primaryMemberId: string; onMemberClick: (id: string) => void; onCareMembers: () => void; onPatternHistory: () => void; onCareEvent: () => void }) {
  const isPrimaryCaregiver = primaryMemberId === 'emily';
  return kind === 'pets' ? (
    <div className="profile-page pets-page">
      <MainHeader eyebrow="PET PROFILE" title={`${petName}, as she is`} onPetsNavigate={onPetsNavigate} />
      <section className="pet-profile-hero">
        <Avatar />
        <div className="profile-hero-copy"><strong>{petName}</strong><small>Golden Retriever · 3 years old</small><button className="mini-action" onClick={onPetEdit}><span>✎</span> Edit pet details</button></div>
        <button className="sort-action" aria-label="Reorder pets" onClick={() => onAction('Reorder pets', 'Luna is your current pet profile. You can change the order as you add pets.')}>⇄</button>
      </section>

      <section className="profile-section care-section">
        <h2>Who looks after Luna?</h2>
        <div className="profile-card care-card">
          <div className="card-topline"><strong>Group Name</strong>{isPrimaryCaregiver && <button className="profile-link" onClick={onCareMembers}>Manage members →</button>}</div>
          {careMembers.map((member) => <button className="member-row" key={member.id} onClick={() => onMemberClick(member.id)}>{member.id === 'emily' ? <OwnerAvatar src={ownerAvatar} name={ownerName} /> : <span className={`member-avatar ${member.id}-avatar`}>{member.name.slice(0, 1)}</span>}<span><strong>{member.id === 'emily' ? ownerName : member.name}</strong>{member.id === primaryMemberId && <small>{member.id === 'emily' ? ownerRole : 'Primary caregiver'}</small>}</span><i>›</i></button>)}
        </div>
      </section>

      <section className="profile-section">
        <div className="profile-section-heading"><h2>Typical patterns</h2><button className="profile-link" onClick={onPatternHistory}>View history →</button></div>
        <div className="profile-card pattern-card">
          <strong className="card-caption">Owner-confirmed knowledge</strong>
          <button className="knowledge-row" onClick={() => onAction('Active mornings', 'From your notes and selected records.')}><span className="knowledge-icon">☼</span><span><strong>Active mornings</strong><small>From your notes and selected records</small></span><i>›</i></button>
          <button className="knowledge-row" onClick={() => onAction('Quiet afternoon rest', 'Compared by time period, not one fixed “normal”.')}><span className="knowledge-icon">☁</span><span><strong>Quiet afternoon rest</strong><small>Compare by time period, not one fixed<br />“normal”</small></span><i>›</i></button>
          <button className="knowledge-row" onClick={() => onAction('Likes her rope toy', 'Added by her caregiver.')}><span className="knowledge-icon">♥</span><span><strong>Likes her rope toy</strong><small>Added by her caregiver</small></span><i>›</i></button>
        </div>
      </section>

      <section className="profile-section context-section">
        <div className="profile-section-heading"><h2>Life &amp; care context</h2><button className="profile-link" onClick={onCareEvent}>Add event +</button></div>
        <div className="profile-card context-card">
          <button className="knowledge-row" onClick={() => onAction('Life-stage notes', 'Moving, ageing, routine changes and care handover.')}><span className="knowledge-icon">≡</span><span><strong>Life-stage notes</strong><small>Moving, ageing, routine changes and<br />care handover</small></span><i>›</i></button>
          <button className="knowledge-row" onClick={() => onAction('Health & care notes', 'Owner records only · not an AI diagnosis.')}><span className="knowledge-icon">＋</span><span><strong>Health &amp; care notes</strong><small>Owner records only · not an AI diagnosis</small></span><i>›</i></button>
        </div>
      </section>
    </div>
  ) : (
    <div className="profile-page you-page">
      <MainHeader eyebrow="YOUR SPACE" title="My Profile" onPetsNavigate={onPetsNavigate} />
      <button className="account-profile-hero" onClick={onProfileEdit}>
        <OwnerAvatar src={ownerAvatar} name={ownerName} className="account-avatar" />
        <span className="profile-hero-copy"><strong>{ownerName}</strong><small>{ownerPreference}</small><span className="mini-action"><b>✎</b> Edit my profile</span></span>
      </button>

      <section className="profile-section you-section">
        <div className="profile-section-heading"><h2>My pets</h2><button className="profile-link" onClick={() => onAction('Add Pets', 'Add a pet profile to your Pawsona space.')}>Add Pets +</button></div>
        <div className="profile-card you-list pets-list">
          <button className="you-row" onClick={onPetEdit}><Avatar /><span><strong>Luna</strong><small>Golden Retriever · 3 years old</small></span><em>Family</em></button>
          <button className="you-row" onClick={() => onAction('Cat', 'British Shorthair · 2 years old · Solo')}><span className="cat-avatar">🐈‍⬛</span><span><strong>Cat</strong><small>British Shorthair · 2 years old</small></span><em>Solo</em></button>
        </div>
      </section>

      <section className="profile-section you-section media-section">
        <div className="profile-section-heading"><h2>Connected media</h2><button className="profile-link" onClick={() => onAction('Add source', 'Choose a photo album or connect a supported camera source.')}>Add source +</button></div>
        <div className="profile-card you-list media-list">
          <button className="media-row" onClick={() => onAction('Selected photo album', 'Only the album you chose is connected.')}><span className="media-icon">▦</span><span><strong>Selected photo album</strong><small>Only the album you chose</small></span><em className="connected">Connected</em></button>
          <button className="media-row" onClick={() => onAction('Selected photo album', 'Only the album you chose is connected.')}><span className="media-icon">▦</span><span><strong>Selected photo album</strong><small>Only the album you chose</small></span><em className="connected">Connected</em></button>
          <button className="media-row" onClick={() => onAction('Smart feeder', 'Equipment can be added when you are ready to connect it.')}><span className="media-icon">◇</span><span><strong>Smart feeder</strong><small>Equipment can be added</small></span><em className="not-connected">Not linked</em></button>
        </div>
      </section>

      <section className="profile-section you-section privacy-section">
        <div className="profile-section-heading"><h2>Privacy &amp; support</h2><button className="profile-link" onClick={() => onAction('Privacy & support', 'Review data permissions, sharing, retention and accessibility preferences.')}>Open→</button></div>
        <div className="profile-card you-list privacy-list">
          <button className="media-row" onClick={() => onAction('Data, sharing & retention', 'Review permissions, access and deletion.')}><span className="media-icon">▤</span><span><strong>Data, sharing &amp; retention</strong><small>Review permissions, access and deletion</small></span><i>›</i></button>
          <button className="media-row" onClick={() => onAction('Accessibility & feedback', 'Text size, captions, help and suggestions.')}><span className="media-icon">◎</span><span><strong>Accessibility &amp; feedback</strong><small>Text size, captions, help and suggestions</small></span><i>›</i></button>
        </div>
      </section>
    </div>
  );
}

function SettingsPage({ kind, initialName, initialAvatar = '', initialPreference = 'Manage your profile details here.', onBack, onSaved, onProfileSaved }: { kind: 'petDetails' | 'profile'; initialName: string; initialAvatar?: string; initialPreference?: string; onBack: () => void; onSaved: (name: string) => void; onProfileSaved?: (profile: { name: string; avatar: string; preference: string }) => void }) {
  const pet = kind === 'petDetails';
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [preference, setPreference] = useState(initialPreference);
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  function save() {
    const nextName = name.trim();
    try {
      localStorage.setItem(pet ? 'pawsona-pet-name' : 'pawsona-owner-name', nextName);
      if (!pet) {
        localStorage.setItem('pawsona-owner-avatar', avatar);
        localStorage.setItem('pawsona-owner-preference', preference);
      }
    } catch { setSaveFailed(true); return; }
    onSaved(nextName);
    if (!pet) {
      onProfileSaved?.({ name: nextName, avatar, preference });
      onBack();
    } else setSaved(true);
  }

  function readAvatar(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        setAvatar(canvas.toDataURL('image/jpeg', 0.82));
        setSaved(false);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  return (
    <section className="settings-page">
      <header className="settings-header">
        <button className="settings-back" aria-label="Back to Today" onClick={onBack}>←</button>
        <h1>{pet ? 'Luna’s details' : 'My profile'}</h1>
      </header>
      <p className="settings-eyebrow">{pet ? 'PET PROFILE' : 'YOUR SPACE'}</p>
      <section className={`settings-summary${pet ? '' : ' profile-summary'}`}>
        {!pet && <label className="profile-avatar-upload" aria-label="Upload profile photo">
          <OwnerAvatar src={avatar} name={name} className="profile-edit-avatar" />
          <span className="avatar-edit-badge" aria-hidden="true">✎</span>
          <input type="file" accept="image/*" aria-label="Choose profile photo" onChange={(event) => readAvatar(event.target.files?.[0])} />
        </label>}
        <div className="profile-summary-copy">
        <strong>{pet ? name || 'Luna' : name || 'Emily'}</strong>
        <p>{pet ? 'Keep the details that help carers recognise her.' : preference}</p>
        </div>
      </section>
      <div className={`settings-fields${pet ? '' : ' profile-settings-fields'}`}>
        {pet ? <label className="settings-field">
          <strong>Name</strong><input value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} aria-label="Pet name" />
        </label> : <>
          <section className="settings-field profile-edit-field">
            <strong>Name</strong><div className="profile-field-control"><input value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} aria-label="Your name" /></div>
          </section>
        </>}
        {pet ? <>
          <div className="settings-field"><strong>Breed</strong><p>Golden Retriever</p></div>
          <div className="settings-field"><strong>Age</strong><p>3 years old</p></div>
        </> : <>
          <label className="settings-field profile-preference-field"><strong>Preferences</strong><input value={preference} onChange={(event) => { setPreference(event.target.value); setSaved(false); }} aria-label="Preferences" /></label>
        </>}
      </div>
      <div className="settings-action">
        <button className="primary-button full" onClick={save}>{pet ? 'Save details' : 'Save profile'}</button>
        {saved && <p role="status">Your changes have been saved.</p>}
      </div>
      {saveFailed && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setSaveFailed(false)}><section className="profile-dialog" role="alertdialog" aria-modal="true" aria-labelledby="profile-save-error-title" onClick={(event) => event.stopPropagation()}><h2 id="profile-save-error-title">Couldn’t save your profile</h2><p>Your changes could not be saved. Please try again.</p><button className="primary-button" onClick={() => setSaveFailed(false)}>OK</button></section></div>}
    </section>
  );
}

function RolePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const options = ['Primary caregiver', 'Caregiver', 'Temporary caregiver'];
  return <section className={`settings-field profile-edit-field profile-role-field${open ? ' is-open' : ''}`}>
    <strong>Role</strong><div className="profile-field-control"><button type="button" className="profile-role-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}><span>{value}</span><i className={open ? 'is-open' : ''}>⌄</i></button></div>
    {open && <div className="profile-role-options" role="listbox" aria-label="Choose your role">{options.map((option) => <button type="button" role="option" aria-selected={value === option} className={value === option ? 'selected' : ''} key={option} onClick={() => { onChange(option); setOpen(false); }}>{option}</button>)}</div>}
  </section>;
}

function PetSecondaryPage({ kind, petName, ownerName, ownerRole = 'Primary caregiver', ownerAvatar = '', careMembers, primaryMemberId, isPrimaryCaregiver, onBack, onReviewEvidence, onSaveEvent, onMemberClick, onRemoveMember, onAddMember }: { kind: 'careMembers' | 'patternHistory' | 'careEvent'; petName: string; ownerName: string; ownerRole?: string; ownerAvatar?: string; careMembers: CareMember[]; primaryMemberId: string; isPrimaryCaregiver: boolean; onBack: () => void; onReviewEvidence: () => void; onSaveEvent: (event: { type: string; when: string; note: string }) => void; onMemberClick: (id: string) => void; onRemoveMember: (id: string) => void; onAddMember: (name: string, role: string) => void }) {
  const [eventType, setEventType] = useState('Routine change');
  const [when, setWhen] = useState('Today');
  const [note, setNote] = useState('');
  const [openPicker, setOpenPicker] = useState<'type' | 'when' | null>(null);
  const [savedEvent, setSavedEvent] = useState(false);
  const [openMemberMenu, setOpenMemberMenu] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<CareMember | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Caregiver');
  const isCareMembers = kind === 'careMembers';
  const isPatternHistory = kind === 'patternHistory';
  const title = isCareMembers ? `Who cares for ${petName}?` : isPatternHistory ? 'Typical patterns' : 'Life & care event';
  const eyebrow = isCareMembers ? 'SHARED CARE' : isPatternHistory ? 'OWNER-CONFIRMED KNOWLEDGE' : 'OWNER RECORD';
  const summaryTitle = isCareMembers ? 'Care circle' : isPatternHistory ? 'Patterns over time' : `Add context to ${petName}’s life`;
  const summaryNote = isCareMembers ? `Three people can add context to ${petName}’s day.` : isPatternHistory ? 'Compare observations by time period and source.' : 'Your note stays attributed to you.';

  function chooseField(which: 'type' | 'when', value: string) {
    if (which === 'type') setEventType(value); else setWhen(value);
    setOpenPicker(null);
    setSavedEvent(false);
  }

  return (
    <section className="settings-page pet-subpage">
      <header className="settings-header">
        <button className="settings-back" aria-label="Back to pet profile" onClick={onBack}>←</button>
        <h1>{title}</h1>
      </header>
      <div className="settings-eyebrow-row"><p className="settings-eyebrow">{eyebrow}</p>{isCareMembers && isPrimaryCaregiver && <button className="profile-link care-add-member" onClick={() => setShowAddMember(true)}>Add +</button>}</div>
      <section className="settings-summary">
        <strong>{summaryTitle}</strong>
        <p>{summaryNote}</p>
      </section>
      {isCareMembers ? <div className="care-member-details">
        {careMembers.map((member) => <div className="care-person-wrap" key={member.id}>
          <button className="care-person-card" onClick={() => onMemberClick(member.id)}>
            {member.id === 'emily' ? <OwnerAvatar src={ownerAvatar} name={ownerName} className="care-person-avatar" /> : <span className={`member-avatar care-person-avatar ${member.id}-avatar`}>{member.name.slice(0, 1)}</span>}
            <span className="care-person-copy"><strong>{member.id === 'emily' ? ownerName : member.name}</strong><small>{member.id === 'emily' ? ownerRole : member.id === primaryMemberId ? 'Primary caregiver' : member.role}</small><span>{member.id === primaryMemberId ? 'Manages the profile' : 'Can add observations'}</span></span>
          </button>
          {isPrimaryCaregiver && member.id !== 'emily' && <button className="member-more care-person-more" aria-label={`Options for ${member.name}`} aria-expanded={openMemberMenu === member.id} onClick={() => setOpenMemberMenu(openMemberMenu === member.id ? null : member.id)}>⋯</button>}
          {isPrimaryCaregiver && openMemberMenu === member.id && member.id !== 'emily' && <div className="member-menu care-person-menu" role="menu"><button role="menuitem" onClick={() => { setPendingRemoval(member); setOpenMemberMenu(null); }}>Remove member</button></div>}
        </div>)}
      </div> : isPatternHistory ? <div className="pattern-history-details">
        <article className="settings-field"><strong>Active mornings</strong><p>Seen in selected records and owner notes</p></article>
        <article className="settings-field"><strong>Quiet afternoon rest</strong><p>Review this pattern against recent clips</p></article>
        <article className="settings-field"><strong>Rope toy play</strong><p>Added by her caregiver</p></article>
      </div> : <div className="care-event-details">
        <div className="event-picker-wrap">
          <button className="settings-field event-picker" aria-expanded={openPicker === 'type'} onClick={() => setOpenPicker(openPicker === 'type' ? null : 'type')}><strong>Event type</strong><span>{eventType}</span></button>
          {openPicker === 'type' && <div className="event-picker-menu" role="listbox" aria-label="Event type">{['Routine change', 'Life-stage change', 'Health & care', 'Care handover'].map((option) => <button key={option} role="option" aria-selected={eventType === option} onClick={() => chooseField('type', option)}>{option}</button>)}</div>}
        </div>
        <div className="event-picker-wrap">
          <button className="settings-field event-picker" aria-expanded={openPicker === 'when'} onClick={() => setOpenPicker(openPicker === 'when' ? null : 'when')}><strong>When</strong><span>{when}</span></button>
          {openPicker === 'when' && <div className="event-picker-menu" role="listbox" aria-label="When">{['Today', 'Yesterday', 'This week', 'Choose a date'].map((option) => <button key={option} role="option" aria-selected={when === option} onClick={() => chooseField('when', option)}>{option}</button>)}</div>}
        </div>
        <label className="settings-field event-note-field"><strong>What changed?</strong><textarea aria-label="What changed?" placeholder="Write what happened and why it may matter." value={note} onChange={(event) => { setNote(event.target.value); setSavedEvent(false); }} /></label>
      </div>}
      {!isCareMembers && <div className="settings-action">
        <button className="primary-button full" onClick={isPatternHistory ? onReviewEvidence : () => { onSaveEvent({ type: eventType, when, note: note.trim() }); setSavedEvent(true); }}>{isPatternHistory ? 'Review recent evidence' : savedEvent ? 'Event saved' : 'Save event'}</button>
        {savedEvent && <p role="status">Your care event has been saved.</p>}
      </div>}
      {pendingRemoval && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingRemoval(null)}><section className="profile-dialog member-removal-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-member-title" onClick={(event) => event.stopPropagation()}><h2 id="remove-member-title">Remove {pendingRemoval.name}?</h2><p>They will no longer be able to add observations or care context for {petName}.</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingRemoval(null)}>Cancel</button><button className="danger-button" onClick={() => { onRemoveMember(pendingRemoval.id); setPendingRemoval(null); }}>Remove member</button></div></section></div>}
      {showAddMember && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setShowAddMember(false)}><form className="profile-dialog add-member-dialog" role="dialog" aria-modal="true" aria-labelledby="add-member-title" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); const name = newMemberName.trim(); if (!name) return; onAddMember(name, newMemberRole); setNewMemberName(''); setNewMemberRole('Caregiver'); setShowAddMember(false); }}><h2 id="add-member-title">Add group member</h2><label className="settings-field"><strong>Name</strong><input autoFocus value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)} placeholder="Enter name" /></label><label className="settings-field"><strong>Role</strong><select value={newMemberRole} onChange={(event) => setNewMemberRole(event.target.value)}><option>Caregiver</option><option>Temporary caregiver</option></select></label><div className="member-removal-actions"><button type="button" className="cancel-button" onClick={() => setShowAddMember(false)}>Cancel</button><button type="submit" className="primary-button" disabled={!newMemberName.trim()}>Add member</button></div></form></div>}
    </section>
  );
}

function CareMemberDetailsPage({ member, ownerName, ownerRole, ownerAvatar, ownerPreference, onOwnerRoleChange, primaryMemberId, petName, onBack }: { member: CareMember; ownerName: string; ownerRole: string; ownerAvatar: string; ownerPreference: string; onOwnerRoleChange: (role: string) => void; primaryMemberId: string; petName: string; onBack: () => void }) {
  const name = member.id === 'emily' ? ownerName : member.name;
  const primary = member.id === primaryMemberId;
  if (member.id === 'emily') return <section className="settings-page pet-subpage">
    <header className="settings-header"><button className="settings-back" aria-label="Back to pet profile" onClick={onBack}>←</button><h1>Account details</h1></header>
    <p className="settings-eyebrow">CARE MEMBER</p>
    <section className="settings-summary profile-summary"><OwnerAvatar src={ownerAvatar} name={ownerName} className="profile-edit-avatar" /><div className="profile-summary-copy"><strong>{ownerName}</strong><p>{ownerPreference}</p></div></section>
    <div className="care-event-details member-account-details">
      <div className="settings-field"><strong>Name</strong><p>{ownerName}</p></div>
      <RolePicker value={ownerRole} onChange={onOwnerRoleChange} />
      <div className="settings-field"><strong>Preferences</strong><p>{ownerPreference}</p></div>
      <div className="settings-field"><strong>Care access</strong><p>{primary ? 'Manages the profile' : 'Can add observations'}</p></div>
    </div>
  </section>;
  return <section className="settings-page pet-subpage">
    <header className="settings-header"><button className="settings-back" aria-label="Back to pet profile" onClick={onBack}>←</button><h1>Account details</h1></header>
    <p className="settings-eyebrow">CARE MEMBER</p>
    <section className="settings-summary"><strong>{name}</strong><p>Care profile for {petName}’s care circle.</p></section>
    <div className="care-event-details member-account-details">
      <div className="settings-field"><strong>Name</strong><p>{name}</p></div>
      <div className="settings-field"><strong>Role</strong><p>{primary ? 'Primary caregiver' : member.role}</p></div>
      <div className="settings-field"><strong>Care access</strong><p>{primary ? 'Manages the profile' : 'Can add observations'}</p></div>
    </div>
  </section>;
}

export default function App() {
  const [view, setView] = useState<View>('today');
  const [petName, setPetName] = useState(() => localStorage.getItem('pawsona-pet-name') || 'Luna');
  const [ownerName, setOwnerName] = useState(() => localStorage.getItem('pawsona-owner-name') || 'Emily');
  const [ownerRole, setOwnerRole] = useState(() => localStorage.getItem('pawsona-owner-role') || 'Primary caregiver');
  const [ownerAvatar, setOwnerAvatar] = useState(() => localStorage.getItem('pawsona-owner-avatar') || '');
  const [ownerPreference, setOwnerPreference] = useState(() => localStorage.getItem('pawsona-owner-preference') || 'Manage your profile details here.');
  const [profileSaveNotice, setProfileSaveNotice] = useState(false);
  const [saved, setSaved] = useState<OwnerContext | null>(readSavedContext);
  const [storyObservations, setStoryObservations] = useState<StoryObservation[]>(readStoryObservations);
  const [draftMoments, setDraftMoments] = useState<string[]>(['window', 'toy']);
  const [draftObservation, setDraftObservation] = useState('She rested by the window after our visitors left, then played with her rope toy in the afternoon.');
  const [draftObservationContext, setDraftObservationContext] = useState('Visitors at home');
  const [draftPrivateRecord, setDraftPrivateRecord] = useState(false);
  const [note, setNote] = useState(saved?.note ?? 'Visitors were at home today. Luna often rests afterward.');
  const [interpretation, setInterpretation] = useState<Interpretation>(saved?.interpretation ?? 'normal');
  const [profileAction, setProfileAction] = useState<{ title: string; detail: string } | null>(null);
  const [careMembers, setCareMembers] = useState<CareMember[]>([
    { id: 'emily', name: ownerName, role: 'Primary owner', detail: 'manages the profile' },
    { id: 'mom', name: 'Mom', role: 'Caregiver', detail: 'can add observations' },
    { id: 'dad', name: 'Dad', role: 'Caregiver', detail: 'can add observations' },
  ]);
  const primaryMemberId = 'emily';
  const [selectedCareMemberId, setSelectedCareMemberId] = useState('emily');
  const [askInput, setAskInput] = useState('');
  const [askMessages, setAskMessages] = useState<AskMessage[]>([]);
  const scrollRef = useRef<HTMLElement>(null);
  const askEndRef = useRef<HTMLDivElement>(null);
  const navigationHistory = useRef<View[]>([]);

  function navigateTo(nextView: View) {
    if (nextView !== view) navigationHistory.current.push(view);
    setView(nextView);
  }

  function goBack(fallback: View = 'today') {
    setView(navigationHistory.current.pop() ?? fallback);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [view]);

  useEffect(() => {
    if (!profileSaveNotice) return;
    const timer = window.setTimeout(() => setProfileSaveNotice(false), 3000);
    return () => window.clearTimeout(timer);
  }, [profileSaveNotice]);

  useEffect(() => {
    if (view === 'ask' && askMessages.length && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [askMessages, view]);

  function saveContext() {
    const next = { note: note.trim(), interpretation, savedAt: new Date().toISOString() };
    setSaved(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Local state still works. */ }
    navigateTo('saved');
  }

  function undoContext() {
    setSaved(null);
    try { localStorage.removeItem(storageKey); } catch { /* Local state still works. */ }
    navigateTo('undone');
  }

  function startStoryObservation() {
    setDraftMoments(['window', 'toy']);
    setDraftObservation('She rested by the window after our visitors left, then played with her rope toy in the afternoon.');
    setDraftObservationContext('Visitors at home');
    setDraftPrivateRecord(false);
    navigateTo('addMoments');
  }

  function cancelStoryObservation() {
    navigationHistory.current = navigationHistory.current.filter((previous) => !(['addMoments', 'addCompose', 'addPreview', 'addSaved'] as View[]).includes(previous));
    setView('story');
  }

  function saveStoryObservation() {
    const selected = momentChoices.filter((moment) => draftMoments.includes(moment.id));
    const observation: StoryObservation = {
      id: `story-observation-${Date.now()}`,
      note: draftObservation.trim(),
      title: 'A window rest after visitors',
      image: asset(selected[0]?.image ?? 'story-window.png'),
      momentCount: selected.length,
      context: draftObservationContext,
      privateRecord: draftPrivateRecord,
      savedAt: new Date().toISOString(),
    };
    const next = [observation, ...storyObservations];
    setStoryObservations(next);
    try { localStorage.setItem('pawsona-story-observations-v1', JSON.stringify(next)); } catch { /* Keep this observation for the current session. */ }
    navigateTo('addSaved');
  }

  function sendAskMessage(attachment?: AskAttachment) {
    const text = askInput.trim();
    if (!text && !attachment) return;
    setAskMessages((current) => [...current, { role: 'user', text, attachment }, { role: 'assistant', text: 'Thanks for sharing. I’ll keep that in context. Would you like to review the linked observations together?' }]);
    setAskInput('');
  }

  const mainView = (['today', 'story', 'ask', 'pets', 'you'] as View[]).includes(view);
  const activeNav: View = view === 'petDetails' ? 'pets' : view === 'profile' ? 'you' : mainView ? view : 'today';
  const isPrimaryCaregiver = primaryMemberId === 'emily';
  const selectedCareMember = careMembers.find((member) => member.id === selectedCareMemberId) ?? careMembers[0];
  function openCareMember(id: string) {
    setSelectedCareMemberId(id);
    navigateTo('memberDetails');
  }
  function updateOwnerRole(role: string) {
    try { localStorage.setItem('pawsona-owner-role', role); } catch { /* Keep this selection active for the current session. */ }
    setOwnerRole(role);
  }
  function navigate(view: View) {
    navigateTo(view);
  }

  return (
    <div className="app-stage">
      <div className="phone">
        <main ref={scrollRef} className={`screen-scroll ${view === 'today' ? 'home-screen' : ''} ${view.startsWith('add') ? 'add-flow-scroll' : ''}`}>
          <StatusBar />
          <div className={`screen-content ${mainView ? 'main-content' : 'detail-content'} ${view === 'ask' ? 'ask-content' : ''} ${view.startsWith('add') ? 'add-flow-content' : ''}`}>
            {view === 'today' && <TodayPage onStory={() => navigateTo('story')} onEvidence={() => navigateTo('overview')} onPetsNavigate={() => navigateTo('pets')} saved={saved} />}
            {view === 'story' && <StoryPage onEvidence={() => navigateTo('overview')} onAdd={startStoryObservation} onPetsNavigate={() => navigateTo('pets')} saved={saved} observations={storyObservations} />}
            {view === 'addMoments' && <StoryAddPage step="moments" onBack={cancelStoryObservation} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} ownerName={ownerName} onSave={saveStoryObservation} onEdit={() => navigateTo('addCompose')} />}
            {view === 'addCompose' && <StoryAddPage step="compose" onBack={() => goBack('addMoments')} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} ownerName={ownerName} onSave={saveStoryObservation} onEdit={() => navigateTo('addPreview')} />}
            {view === 'addPreview' && <StoryAddPage step="preview" onBack={() => goBack('addCompose')} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} ownerName={ownerName} onSave={saveStoryObservation} onEdit={() => navigateTo('addCompose')} />}
            {view === 'addSaved' && <StoryAddPage step="saved" onBack={() => goBack('addPreview')} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} ownerName={ownerName} onSave={saveStoryObservation} onEdit={() => navigateTo('addCompose')} />}
            {view === 'overview' && <OverviewPage onBack={() => goBack('today')} onClip={() => navigateTo('clip')} saved={saved} onSaved={() => navigateTo('saved')} />}
            {view === 'clip' && <ClipPage onBack={() => goBack('overview')} onContext={() => navigateTo('context')} />}
            {view === 'context' && <ContextPage note={note} setNote={setNote} interpretation={interpretation} setInterpretation={setInterpretation} onBack={() => goBack('clip')} onReview={() => navigateTo('confirm')} />}
            {view === 'confirm' && <ConfirmPage note={note} interpretation={interpretation} onBack={() => goBack('context')} onSave={saveContext} />}
            {view === 'saved' && saved && <SavedPage saved={saved} onBack={() => goBack('confirm')} onUndo={undoContext} onEvidence={() => navigateTo('clip')} onEdit={() => navigateTo('context')} />}
            {view === 'undone' && <UndonePage onBack={() => goBack('saved')} onReview={() => navigateTo('overview')} />}
            {view === 'ask' && <AskPage onEvidence={() => navigateTo('overview')} onContext={() => navigateTo('context')} onPetsNavigate={() => navigateTo('pets')} messages={askMessages} messageEndRef={askEndRef} />}
            {(view === 'pets' || view === 'you') && <SimplePage kind={view} petName={petName} ownerName={ownerName} ownerRole={ownerRole} ownerAvatar={ownerAvatar} ownerPreference={ownerPreference} onPetsNavigate={() => navigateTo('pets')} onPetEdit={() => navigateTo('petDetails')} onProfileEdit={() => navigateTo('profile')} onAction={(title, detail) => setProfileAction({ title, detail })} careMembers={careMembers} primaryMemberId={primaryMemberId} onMemberClick={openCareMember} onCareMembers={() => navigateTo('careMembers')} onPatternHistory={() => navigateTo('patternHistory')} onCareEvent={() => navigateTo('careEvent')} />}
            {view === 'petDetails' && <SettingsPage kind="petDetails" initialName={petName} onSaved={setPetName} onBack={() => goBack('pets')} />}
            {view === 'profile' && <SettingsPage kind="profile" initialName={ownerName} initialAvatar={ownerAvatar} initialPreference={ownerPreference} onSaved={setOwnerName} onProfileSaved={({ name, avatar, preference }) => { setOwnerName(name); setOwnerAvatar(avatar); setOwnerPreference(preference); setProfileSaveNotice(true); }} onBack={() => goBack('you')} />}
            {view === 'memberDetails' && selectedCareMember && <CareMemberDetailsPage member={selectedCareMember} ownerName={ownerName} ownerRole={ownerRole} ownerAvatar={ownerAvatar} ownerPreference={ownerPreference} onOwnerRoleChange={updateOwnerRole} primaryMemberId={primaryMemberId} petName={petName} onBack={() => goBack('careMembers')} />}
            {(view === 'careMembers' || view === 'patternHistory' || view === 'careEvent') && <PetSecondaryPage kind={view} petName={petName} ownerName={ownerName} ownerRole={ownerRole} ownerAvatar={ownerAvatar} careMembers={careMembers} primaryMemberId={primaryMemberId} isPrimaryCaregiver={isPrimaryCaregiver} onMemberClick={openCareMember} onRemoveMember={(id) => setCareMembers((members) => members.filter((member) => member.id !== id))} onAddMember={(name, role) => setCareMembers((members) => [...members, { id: `member-${Date.now()}`, name, role, detail: 'can add observations' }])} onBack={() => goBack('pets')} onReviewEvidence={() => navigateTo('overview')} onSaveEvent={(event) => { try { localStorage.setItem('pawsona-care-event-v1', JSON.stringify(event)); } catch { /* Keep the saved state in the current view. */ } }} />}
          </div>
        </main>
        {view === 'story' && <button className="floating-add" onClick={startStoryObservation}>+ Add</button>}
        {view === 'ask' && <AskComposer value={askInput} onValue={setAskInput} onSend={sendAskMessage} onQuickContext={(value) => setAskInput((current) => current ? `${current} ${value}` : value)} />}
        {profileAction && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setProfileAction(null)}><section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" onClick={(event) => event.stopPropagation()}><button className="profile-dialog-close" aria-label="Close" onClick={() => setProfileAction(null)}>×</button><h2 id="profile-dialog-title">{profileAction.title}</h2><p>{profileAction.detail}</p><button className="primary-button" onClick={() => setProfileAction(null)}>Done</button></section></div>}
        {profileSaveNotice && <div className="profile-save-toast" role="status">Profile saved successfully</div>}
        {mainView && <BottomNav active={activeNav} onNavigate={navigate} />}
      </div>
    </div>
  );
}


