import { useEffect, useRef, useState } from 'react';

type View =
  | 'today'
  | 'story'
  | 'ask'
  | 'pets'
  | 'you'
  | 'petDetails'
  | 'profile'
  | 'overview'
  | 'clip'
  | 'context'
  | 'confirm'
  | 'saved'
  | 'undone';

type Interpretation = 'normal' | 'one-time' | 'open';

type OwnerContext = {
  note: string;
  interpretation: Interpretation;
  savedAt: string;
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

function MainHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <header className="main-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p className="main-subtitle">{subtitle}</p>}
      </div>
      <Avatar />
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
    { id: 'pets', label: 'Pets', icon: 'nav-pets.svg' },
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
            {item.icon ? <img src={asset(item.icon)} alt="" /> : <span className="you-icon" />}
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

function TodayPage({ onStory, onEvidence, saved }: { onStory: () => void; onEvidence: () => void; saved: OwnerContext | null }) {
  return (
    <>
      <MainHeader eyebrow="A little window into her day." title="Hello, Luna!" subtitle="Tuesday · 15 September" />
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

function StoryPage({ onEvidence, onAdd, saved }: { onEvidence: () => void; onAdd: () => void; saved: OwnerContext | null }) {
  const moments = [
    { time: '8:10 AM', title: 'Breakfast at her bowl', note: 'Observed eating as usual', image: 'story-breakfast.png' },
    { time: '11:35 AM', title: 'Rest by the window', note: saved ? 'Emily added context to this moment' : 'A quiet moment to remember', image: 'story-window.png' },
    { time: '4:20 PM', title: 'Her favourite toy chase', note: 'One of today’s highlights!', image: 'story-toy.png' },
  ];
  return (
    <>
      <MainHeader eyebrow="LUNA · DAILY STORY" title="Her moments" subtitle="Tuesday · 15 September" />
      <div className="story-summary"><img src={asset('story-heart.png')} alt="" /><strong>3 moments, one lovely day</strong></div>
      <section className="timeline-section">
        <div className="section-heading"><h2>Today’s timeline</h2><button className="text-link" onClick={onAdd}>Edit story ✎</button></div>
        <div className="timeline-list">
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
      <button className="floating-add" onClick={onAdd}>+ Add</button>
    </>
  );
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

function AskPage({ onEvidence, onContext }: { onEvidence: () => void; onContext: () => void }) {
  return (
    <>
      <MainHeader eyebrow="ASK AI · OBSERVATION DIALOGUE" title="Ask Pawsona" />
      <div className="linked-evidence ask-status"><span className="loading-ring" /><span><strong>Reviewing afternoon rest</strong><small>Linked to Today’s Story · 2 clips + your note</small></span></div>
      <div className="chat-message ai">Luna rested longer this afternoon than in the recent clips available. I can’t tell why—or know exactly how she felt. Would you like to check the evidence or add what happened at home?<button className="text-link" onClick={onEvidence}>View evidence →</button></div>
      <div className="chat-message owner">My family had visitors today. She often settles down after that.</div>
      <div className="chat-message ai">Would you like to add this as owner context? You can review the clips before anything is saved.<div className="chat-choices"><button onClick={onContext}>Yes</button><button onClick={onEvidence}>No</button></div></div>
      <div className="ask-composer"><span>Quick context</span><div className="quick-chips"><button onClick={onContext}>Food changed</button><button onClick={onContext}>Routine changed</button><button onClick={onContext}>Not sure yet</button></div><button className="composer-input" onClick={onContext}>What would you like to know? <b>↑</b></button></div>
    </>
  );
}

function SimplePage({ kind, petName, ownerName, onPetEdit, onProfileEdit, onAction }: { kind: 'pets' | 'you'; petName: string; ownerName: string; onPetEdit: () => void; onProfileEdit: () => void; onAction: (title: string, detail: string) => void }) {
  return kind === 'pets' ? (
    <div className="profile-page pets-page">
      <MainHeader eyebrow="PET PROFILE" title={`${petName}, as she is`} />
      <section className="pet-profile-hero">
        <Avatar />
        <div className="profile-hero-copy"><strong>{petName}</strong><small>Golden Retriever · 3 years old</small><button className="mini-action" onClick={onPetEdit}><span>✎</span> Edit pet details</button></div>
        <button className="sort-action" aria-label="Reorder pets" onClick={() => onAction('Reorder pets', 'Luna is your current pet profile. You can change the order as you add pets.')}>⇄</button>
      </section>

      <section className="profile-section care-section">
        <h2>Who looks after Luna?</h2>
        <div className="profile-card care-card">
          <div className="card-topline"><strong>Group Name</strong><button className="profile-link" onClick={() => onAction('Manage members', 'Emily is the primary owner. Mom and Dad are members of Luna’s care circle.')}>Manage members →</button></div>
          <button className="member-row" onClick={() => onAction('My account', 'Emily · Primary owner')}><span className="member-avatar emily-avatar">E</span><span><strong>My account</strong><small>Primary owner</small></span><i>›</i></button>
          <button className="member-row" onClick={() => onAction('Mom', 'A member of Luna’s care circle.')}><span className="member-avatar mom-avatar">M</span><span><strong>Mom</strong></span><i>›</i></button>
          <button className="member-row" onClick={() => onAction('Dad', 'A member of Luna’s care circle.')}><span className="member-avatar dad-avatar">D</span><span><strong>Dad</strong></span><i>›</i></button>
        </div>
      </section>

      <section className="profile-section">
        <div className="profile-section-heading"><h2>Typical patterns</h2><button className="profile-link" onClick={() => onAction('Pattern history', 'Owner-confirmed patterns are based on notes and selected records.')}>View history →</button></div>
        <div className="profile-card pattern-card">
          <strong className="card-caption">Owner-confirmed knowledge</strong>
          <button className="knowledge-row" onClick={() => onAction('Active mornings', 'From your notes and selected records.')}><span className="knowledge-icon">☼</span><span><strong>Active mornings</strong><small>From your notes and selected records</small></span><i>›</i></button>
          <button className="knowledge-row" onClick={() => onAction('Quiet afternoon rest', 'Compared by time period, not one fixed “normal”.')}><span className="knowledge-icon">☁</span><span><strong>Quiet afternoon rest</strong><small>Compare by time period, not one fixed<br />“normal”</small></span><i>›</i></button>
          <button className="knowledge-row" onClick={() => onAction('Likes her rope toy', 'Added by her caregiver.')}><span className="knowledge-icon">♥</span><span><strong>Likes her rope toy</strong><small>Added by her caregiver</small></span><i>›</i></button>
        </div>
      </section>

      <section className="profile-section context-section">
        <div className="profile-section-heading"><h2>Life &amp; care context</h2><button className="profile-link" onClick={() => onAction('Add care event', 'Add a life-stage note, health record, routine change, or care handover for Luna.')}>Add event +</button></div>
        <div className="profile-card context-card">
          <button className="knowledge-row" onClick={() => onAction('Life-stage notes', 'Moving, ageing, routine changes and care handover.')}><span className="knowledge-icon">≡</span><span><strong>Life-stage notes</strong><small>Moving, ageing, routine changes and<br />care handover</small></span><i>›</i></button>
          <button className="knowledge-row" onClick={() => onAction('Health & care notes', 'Owner records only · not an AI diagnosis.')}><span className="knowledge-icon">＋</span><span><strong>Health &amp; care notes</strong><small>Owner records only · not an AI diagnosis</small></span><i>›</i></button>
        </div>
      </section>
    </div>
  ) : (
    <div className="profile-page you-page">
      <MainHeader eyebrow="YOUR SPACE" title="My Profile" />
      <button className="account-profile-hero" onClick={onProfileEdit}>
        <span className="member-avatar emily-avatar account-avatar">{ownerName.slice(0, 1)}</span>
        <span className="profile-hero-copy"><strong>My account</strong><small>Primary owner · Manage your details</small><span className="mini-action"><b>✎</b> Edit my profile</span></span>
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

function SettingsPage({ kind, initialName, onBack, onSaved }: { kind: 'petDetails' | 'profile'; initialName: string; onBack: () => void; onSaved: (name: string) => void }) {
  const pet = kind === 'petDetails';
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(false);

  function save() {
    try { localStorage.setItem(pet ? 'pawsona-pet-name' : 'pawsona-owner-name', name.trim()); } catch { /* Keep the current value in this view. */ }
    onSaved(name.trim());
    setSaved(true);
  }

  return (
    <section className="settings-page">
      <header className="settings-header">
        <button className="settings-back" aria-label="Back to Today" onClick={onBack}>←</button>
        <h1>{pet ? 'Luna’s details' : 'My account'}</h1>
      </header>
      <p className="settings-eyebrow">{pet ? 'PET PROFILE' : 'YOUR SPACE'}</p>
      <section className="settings-summary">
        <strong>{pet ? name || 'Luna' : name || 'Emily'}</strong>
        <p>{pet ? 'Keep the details that help carers recognise her.' : 'Your details stay separate from Luna’s records.'}</p>
      </section>
      <div className="settings-fields">
        <label className="settings-field">
          <strong>Name</strong>
          <input value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} aria-label={pet ? 'Pet name' : 'Your name'} />
        </label>
        {pet ? <>
          <div className="settings-field"><strong>Breed</strong><p>Golden Retriever</p></div>
          <div className="settings-field"><strong>Age</strong><p>3 years old</p></div>
        </> : <>
          <div className="settings-field"><strong>Role</strong><p>Primary owner</p></div>
          <div className="settings-field"><strong>Preferences</strong><p>Manage your account details here.</p></div>
        </>}
      </div>
      <div className="settings-action">
        <button className="primary-button full" onClick={save}>{saved ? 'Saved' : pet ? 'Save details' : 'Save profile'}</button>
        {saved && <p role="status">Your changes have been saved.</p>}
      </div>
    </section>
  );
}

export default function App() {
  const [view, setView] = useState<View>('today');
  const [petName, setPetName] = useState(() => localStorage.getItem('pawsona-pet-name') || 'Luna');
  const [ownerName, setOwnerName] = useState(() => localStorage.getItem('pawsona-owner-name') || 'Emily');
  const [saved, setSaved] = useState<OwnerContext | null>(readSavedContext);
  const [note, setNote] = useState(saved?.note ?? 'Visitors were at home today. Luna often rests afterward.');
  const [interpretation, setInterpretation] = useState<Interpretation>(saved?.interpretation ?? 'normal');
  const [profileAction, setProfileAction] = useState<{ title: string; detail: string } | null>(null);
  const scrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [view]);

  function saveContext() {
    const next = { note: note.trim(), interpretation, savedAt: new Date().toISOString() };
    setSaved(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Local state still works. */ }
    setView('saved');
  }

  function undoContext() {
    setSaved(null);
    try { localStorage.removeItem(storageKey); } catch { /* Local state still works. */ }
    setView('undone');
  }

  const mainView = (['today', 'story', 'ask', 'pets', 'you'] as View[]).includes(view);
  const activeNav: View = view === 'petDetails' ? 'pets' : view === 'profile' ? 'you' : mainView ? view : 'today';
  function navigate(view: View) {
    setView(view);
  }

  return (
    <div className="app-stage">
      <div className="phone">
        <main ref={scrollRef} className={`screen-scroll ${view === 'today' ? 'home-screen' : ''}`}>
          <StatusBar />
          <div className={`screen-content ${mainView ? 'main-content' : 'detail-content'}`}>
            {view === 'today' && <TodayPage onStory={() => setView('story')} onEvidence={() => setView('overview')} saved={saved} />}
            {view === 'story' && <StoryPage onEvidence={() => setView('overview')} onAdd={() => setView('context')} saved={saved} />}
            {view === 'overview' && <OverviewPage onBack={() => setView('today')} onClip={() => setView('clip')} saved={saved} onSaved={() => setView('saved')} />}
            {view === 'clip' && <ClipPage onBack={() => setView('overview')} onContext={() => setView('context')} />}
            {view === 'context' && <ContextPage note={note} setNote={setNote} interpretation={interpretation} setInterpretation={setInterpretation} onBack={() => setView('clip')} onReview={() => setView('confirm')} />}
            {view === 'confirm' && <ConfirmPage note={note} interpretation={interpretation} onBack={() => setView('context')} onSave={saveContext} />}
            {view === 'saved' && saved && <SavedPage saved={saved} onBack={() => setView('today')} onUndo={undoContext} onEvidence={() => setView('clip')} onEdit={() => setView('context')} />}
            {view === 'undone' && <UndonePage onBack={() => setView('today')} onReview={() => setView('overview')} />}
            {view === 'ask' && <AskPage onEvidence={() => setView('overview')} onContext={() => setView('context')} />}
            {(view === 'pets' || view === 'you') && <SimplePage kind={view} petName={petName} ownerName={ownerName} onPetEdit={() => setView('petDetails')} onProfileEdit={() => setView('profile')} onAction={(title, detail) => setProfileAction({ title, detail })} />}
            {view === 'petDetails' && <SettingsPage kind="petDetails" initialName={petName} onSaved={setPetName} onBack={() => setView('pets')} />}
            {view === 'profile' && <SettingsPage kind="profile" initialName={ownerName} onSaved={setOwnerName} onBack={() => setView('you')} />}
          </div>
        </main>
        {profileAction && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setProfileAction(null)}><section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" onClick={(event) => event.stopPropagation()}><button className="profile-dialog-close" aria-label="Close" onClick={() => setProfileAction(null)}>×</button><h2 id="profile-dialog-title">{profileAction.title}</h2><p>{profileAction.detail}</p><button className="primary-button" onClick={() => setProfileAction(null)}>Done</button></section></div>}
        {mainView && <BottomNav active={activeNav} onNavigate={navigate} />}
      </div>
    </div>
  );
}


