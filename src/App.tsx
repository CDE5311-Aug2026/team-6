import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';

type View =
  | 'today'
  | 'story'
  | 'ask'
  | 'pets'
  | 'you'
  | 'settings'
  | 'petDetails'
  | 'profile'
  | 'memberDetails'
  | 'careMembers'
  | 'patternHistory'
  | 'careEvent'
  | 'momentDetail'
  | 'overview'
  | 'clip'
  | 'context'
  | 'confirm'
  | 'saved'
  | 'addMoments'
  | 'addCompose'
  | 'addPreview'
  | 'addSaved'
  | 'storyEdit'
  | 'drafts'
  | 'undone';

type Interpretation = 'normal' | 'one-time' | 'open';

type ContextAttachment = {
  kind: 'photo' | 'voice';
  name: string;
  type: string;
  url: string;
};

type OwnerContext = {
  id: string;
  momentId: string;
  momentTitle: string;
  momentImage: string;
  note: string;
  interpretation: Interpretation;
  savedAt: string;
  attachments?: ContextAttachment[];
};

type CareMember = { id: string; name: string; role: string; detail: string };

type CareEvent = {
  type: string;
  when: string;
  note: string;
};

const careEventKey = 'pawsona-care-event-v1';

function readCareEvent(): CareEvent | null {
  try {
    const value = localStorage.getItem(careEventKey);
    if (!value) return null;

    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const event = parsed as Partial<CareEvent>;

    return typeof event.type === 'string' &&
      typeof event.when === 'string' &&
      typeof event.note === 'string'
      ? (event as CareEvent)
      : null;
  } catch {
    return null;
  }
}

const careMembersKey = 'pawsona-care-members-v1';

function readCareMembers(): CareMember[] | null {
  try {
    const value = localStorage.getItem(careMembersKey);
    if (!value) return null;

    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;

    const valid = parsed.every((entry) => {
      if (typeof entry !== 'object' || entry === null) return false;

      const member = entry as Partial<CareMember>;

      return (
        typeof member.id === 'string' &&
        typeof member.name === 'string' &&
        typeof member.role === 'string' &&
        typeof member.detail === 'string'
      );
    });

    return valid ? (parsed as CareMember[]) : null;
  } catch {
    return null;
  }
}

function saveCareMembersToStorage(members: CareMember[]) {
  try {
    localStorage.setItem(careMembersKey, JSON.stringify(members));
  } catch {
    /* Keep the members for this session. */
  }
}
type StoryMedia = { name: string; type: string; url: string };
type StorySourceNote = { id: string; text: string; label: string };
type StoryObservation = { id: string; note: string; title: string; image: string; mediaType?: string; relatedPhotos?: StoryMedia[]; momentCount: number; momentIds?: string[]; sourceNotes?: StorySourceNote[]; context: string; privateRecord: boolean; savedAt: string };
type StoryDraft = { id: string; selectedMoments: string[]; note: string; title?: string; momentAt?: string; relatedPhotos?: StoryMedia[]; context: string; savedAt: string; privateRecord?: boolean; uploadedMedia?: StoryMedia };
type AskAttachment = { url: string; name: string; kind: 'image' | 'audio'; type: string };
type AskMessage = { role: 'user' | 'assistant'; text: string; attachment?: AskAttachment };
type PetWorkspace = {
  contexts: OwnerContext[];
  observations: StoryObservation[];
  drafts: StoryDraft[];
  visibility: string[] | null;
  askMessages: AskMessage[];
  careMembers: CareMember[];
  careEvent: CareEvent | null;
};
type PrototypePet = {
  id: string;
  name: string;
  breed: string;
  age: string;
  avatar: string;
  hasDemoMoments: boolean;
  workspace: PetWorkspace;
};
type PrototypeAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  preference: string;
  pets: PrototypePet[];
  activePetId: string;
};
type PrototypeSession = {
  activeAccountId: string | null;
  accounts: PrototypeAccount[];
};
type MomentRecord = {
  id: string;
  time: string;
  title: string;
  summary: string;
  description: string;
  image: string;
  mediaType?: string;
  relatedPhotos?: StoryMedia[];
  source: string;
  observationContext?: string;
};

const storyVisibilityKey = 'pawsona-story-visibility-v1';

function readStoryVisibility(): string[] | null {
  try {
    const value = localStorage.getItem(storyVisibilityKey);
    if (!value) return null;

    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
      ? parsed
      : null;
  } catch {
    return null;
  }
}

const storyDraftsKey = 'pawsona-story-drafts-v1';
function readStoryDrafts(): StoryDraft[] {
  try {
    const value = localStorage.getItem(storyDraftsKey);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed as StoryDraft[] : [];
  } catch { return []; }
}

function formatObservationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Today';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date) + '\n' + new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function toLocalDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatPageDate(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date);
  const dayAndMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(date);
  return `${weekday} · ${dayAndMonth}`;
}

function formatShortDate(value: string | Date = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
}

function isSameLocalDay(value: string, comparison = new Date()) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) &&
    date.getFullYear() === comparison.getFullYear() &&
    date.getMonth() === comparison.getMonth() &&
    date.getDate() === comparison.getDate();
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatShortDate(value);
  if (isSameLocalDay(value)) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameLocalDay(value, yesterday)) return 'Yesterday';
  return formatShortDate(date);
}

function readStorageString(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function formatPetAge(age: string) {
  return `${age} ${Number(age) === 1 ? 'year' : 'years'} old`;
}

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

function readSavedContexts(): OwnerContext[] {
  try {
    const value = localStorage.getItem(storageKey);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.flatMap((entry, index) => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !('note' in entry) ||
        !('interpretation' in entry) ||
        typeof entry.note !== 'string' ||
        (entry.interpretation !== 'normal' && entry.interpretation !== 'one-time' && entry.interpretation !== 'open')
      ) return [];
      const saved = entry as Partial<OwnerContext>;
      return [{
        id: typeof saved.id === 'string' ? saved.id : `legacy-context-${index}`,
        momentId: typeof saved.momentId === 'string' ? saved.momentId : 'window',
        momentTitle: typeof saved.momentTitle === 'string' ? saved.momentTitle : 'Rest by the window',
        momentImage: typeof saved.momentImage === 'string' ? saved.momentImage : asset('story-window.png'),
        note: entry.note,
        interpretation: entry.interpretation,
        savedAt: typeof saved.savedAt === 'string' ? saved.savedAt : new Date().toISOString(),
        attachments: Array.isArray(saved.attachments) ? saved.attachments : [],
      }];
    });
  } catch {
    // The demo can still run if browser storage is unavailable.
  }
  return [];
}

function StatusBar() {
  return (
    <div className="status-bar" aria-hidden="true">
      <span>9:41</span>
      <img src={asset('status-levels.svg')} alt="" />
    </div>
  );
}

function Avatar({ name, src = '' }: { name: string; src?: string }) {
  return <img className="avatar" src={src || asset('luna-avatar.png')} alt={name} />;
}

function StoryMediaView({ src, type, alt, controls = false }: { src: string; type?: string; alt: string; controls?: boolean }) {
  if (type?.startsWith('audio/')) return <audio src={src} aria-label={alt} controls />;
  return type?.startsWith('video/')
    ? <video src={src} aria-label={alt} controls={controls} muted playsInline preload="metadata" />
    : <img src={src} alt={alt} />;
}

function OwnerAvatar({ src, name, className = '' }: { src: string; name: string; className?: string }) {
  return <span className={`member-avatar emily-avatar owner-avatar ${className}`}>{src ? <img src={src} alt="" /> : name.slice(0, 1).toUpperCase()}</span>;
}

function MainHeader({ eyebrow, title, subtitle, petName, petAvatar = '', onPetsNavigate, onSettingsNavigate }: { eyebrow: string; title: string; subtitle?: string; petName: string; petAvatar?: string; onPetsNavigate?: () => void; onSettingsNavigate?: () => void }) {
  return (
    <header className="main-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p className="main-subtitle">{subtitle}</p>}
      </div>
      {onSettingsNavigate ? <button className="header-settings-button" type="button" aria-label="Open settings" onClick={onSettingsNavigate}><span aria-hidden="true">⚙</span></button> : <button className="header-avatar-button" type="button" aria-label="Open Pets" onClick={onPetsNavigate}><Avatar name={petName} src={petAvatar} /></button>}
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

function StickyAction({ label, onClick, hint, disabled = false, className = '' }: { label: string; onClick: () => void; hint?: string; disabled?: boolean; className?: string }) {
  return (
    <div className={`sticky-action ${className}`}>
      <button className="primary-button full" onClick={onClick} disabled={disabled}>{label}</button>
      {hint && <p>{hint}</p>}
    </div>
  );
}

const baseMomentDefinitions: MomentRecord[] = [
  { id: 'breakfast', time: '8:10 AM', title: 'Breakfast time', summary: 'Observed eating as usual', description: 'Breakfast was recorded at the usual time, with no change noted in appetite or routine.', image: 'story-breakfast.png', source: 'Home camera · 8:10 AM' },
  { id: 'window', time: '11:35 AM', title: 'Rest by the window', summary: 'A quiet moment to remember', description: 'A calm rest beside the window was recorded after visitors had been at home.', image: 'story-window.png', source: 'Home camera · 11:35 AM' },
  { id: 'toy', time: '4:20 PM', title: 'Favourite toy chase', summary: 'One of today’s highlights!', description: 'An afternoon play session with a favourite toy was captured as an active, playful moment.', image: 'story-toy.png', source: 'Selected video · 4:20 PM' },
];

function resolveMoment(momentId: string, observations: StoryObservation[]): MomentRecord {
  const observation = observations.find((entry) => entry.id === momentId);
  if (observation) return {
    id: observation.id,
    time: formatObservationTime(observation.savedAt).replace('\n', ' · '),
    title: observation.title,
    summary: observation.note || 'Owner observation',
    description: observation.note || 'This moment was added as an owner observation.',
    image: observation.image,
    mediaType: observation.mediaType,
    relatedPhotos: observation.relatedPhotos,
    source: `Owner observation · ${formatRelativeDate(observation.savedAt)}`,
    observationContext: observation.context,
  };
  const base = baseMomentDefinitions.find((entry) => entry.id === momentId) ?? baseMomentDefinitions[1];
  return { ...base, image: asset(base.image) };
}

function TodayPage({ onStory, onMoment, onEvidence, onPetsNavigate, petName, petAvatar, saved, hasDemoMoments }: { onStory: () => void; onMoment: (momentId: string) => void; onEvidence: () => void; onPetsNavigate: () => void; petName: string; petAvatar: string; saved: OwnerContext | null; hasDemoMoments: boolean }) {
  return (
    <>
      <MainHeader eyebrow={`A little window into ${petName}’s day.`} title={`Hello, ${petName}!`} subtitle={formatPageDate()} onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} />
      {!hasDemoMoments ? <section className="today-empty-state"><span>♡</span><h2>Start {petName}’s first story</h2><p>Add a photo, video or written observation. This pet’s records will stay separate from your other pet profiles.</p><button className="primary-button" onClick={onStory}>Open {petName}’s Story →</button></section> : <>
      <section className="today-hero">
        <span className="story-badge">✦ &nbsp; TODAY’S STORY</span>
        <img className="hero-sparkle" src={asset('sparkle.svg')} alt="" />
        <h2>Sunny naps, a playful afternoon, and one very good toy.</h2>
        <p>9:00 AM–6:00 PM</p>
        <button className="primary-button" onClick={onStory}>Read {petName}’s story →</button>
      </section>

      <section className="today-section">
        <h2>Moments you might love</h2>
        <div className="moment-grid">
          <button className="moment-card" onClick={() => onMoment('toy')}>
            <img src={asset('toy-chase.png')} alt={`${petName} with a toy on a blue background`} />
            <span className="moment-card-copy"><strong>The toy chase</strong><small>Video · 0:18 · 4:20 PM</small></span>
          </button>
          <button className="moment-card" onClick={() => onMoment('window')}>
            <img src={asset('sunny-nap.png')} alt={`${petName} resting on a yellow background`} />
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
      </>}
    </>
  );
}

type StoryTimelineItem = { id: string; time: string; title: string; note: string; image: string; mediaType?: string; contexts?: { author: string; text: string }[] };

function TimelineContextTicker({ contexts }: { contexts: { author: string; text: string }[] }) {
  const latest = contexts[0];
  return <div className="timeline-card-contexts" aria-label="Latest owner context"><span className="timeline-context-line"><strong>{latest.author}:</strong> {latest.text}</span></div>;
}

function StoryTimelineRow({ item, showTime = true, menuOpen, onMenuToggle, onView, onEdit, onDelete }: { item: StoryTimelineItem; showTime?: boolean; menuOpen: boolean; onMenuToggle: () => void; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const [date, time] = item.time.split('\n');
  return <div className="timeline-row">
    <span className="timeline-time">{showTime && <><span className="timeline-date">{date}</span><span>{time}</span></>}</span>
    <div className="timeline-card">
      <button className="timeline-card-main" aria-label={`View details for ${item.title}`} onClick={onView}>
        <StoryMediaView src={item.image} type={item.mediaType} alt="" />
        <span><strong>{item.title}</strong><small>{item.note}</small></span>
      </button>
      {item.contexts && item.contexts.length > 0 && <TimelineContextTicker contexts={item.contexts} />}
      <button className="timeline-more" aria-label={`More actions for ${item.title}`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={onMenuToggle}>···</button>
      {menuOpen && <div className="timeline-action-menu" role="menu"><button role="menuitem" onClick={onView}>View details</button><button role="menuitem" onClick={onEdit}>Edit</button><button className="danger-menu-item" role="menuitem" onClick={onDelete}>Delete</button></div>}
    </div>
  </div>;
}

function StoryPage({ onMoment, onEditStory, onEditMoment, onDeleteMoment, onPetsNavigate, petName, petAvatar, ownerName, contexts, observations, includedMoments, hasDemoMoments }: { onMoment: (momentId: string) => void; onEditStory: () => void; onEditMoment: (item: StoryTimelineItem) => void; onDeleteMoment: (momentId: string) => string; onPetsNavigate: () => void; petName: string; petAvatar: string; ownerName: string; contexts: OwnerContext[]; observations: StoryObservation[]; includedMoments: string[] | null; hasDemoMoments: boolean }) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StoryTimelineItem | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const getTimelineContexts = (momentId: string, observationContext = '') => [
    ...contexts.filter((entry) => entry.momentId === momentId).map((entry) => ({ author: ownerName, text: entry.note })),
    ...(observationContext.trim() ? [{ author: ownerName, text: observationContext.trim() }] : []),
  ];
  const moments = (hasDemoMoments ? baseMomentDefinitions : []).map((moment) => ({
    id: moment.id,
    time: moment.time,
    title: moment.title,
    note: moment.summary,
    image: asset(moment.image),
    contexts: getTimelineContexts(moment.id),
  }));
  const visibleObservations = observations.filter((observation) => !observation.privateRecord && (!includedMoments || includedMoments.includes(observation.id)));
  const todayObservations = visibleObservations.filter((observation) => isSameLocalDay(observation.savedAt));
  const earlierObservations = visibleObservations.filter((observation) => !isSameLocalDay(observation.savedAt));
  const visibleMoments = moments.filter(
    (moment) =>
      !includedMoments ||
      includedMoments.includes(
        moment.time === '8:10 AM'
          ? 'breakfast'
          : moment.time === '4:20 PM'
            ? 'toy'
            : 'window'
      )
  );
  const todayTimelineItems = [
    ...todayObservations.map((observation) => ({ id: observation.id, time: formatObservationTime(observation.savedAt), title: observation.title, note: observation.note, image: observation.image, mediaType: observation.mediaType, contexts: getTimelineContexts(observation.id, observation.context) })),
    ...visibleMoments,
  ];
  const earlierTimelineItems = earlierObservations.map((observation) => ({ id: observation.id, time: formatObservationTime(observation.savedAt), title: observation.title, note: observation.note, image: observation.image, mediaType: observation.mediaType, contexts: getTimelineContexts(observation.id, observation.context) }));

  const totalMomentCount =
    todayObservations.length + visibleMoments.length;
  function confirmDelete() {
    if (!pendingDelete) return;
    const nextError = onDeleteMoment(pendingDelete.id);
    setDeleteError(nextError);
    if (!nextError) setPendingDelete(null);
  }
  return (
    <>
      <MainHeader eyebrow={`${petName.toUpperCase()} · DAILY STORY`} title="Daily moments" subtitle={formatPageDate()} onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} />
      <div className="story-summary"><img src={asset('story-heart.png')} alt="" /><strong>
        {totalMomentCount === 0 ? (
          'No moments yet'
        ) : (
          <>
            {totalMomentCount}{' '}
            {totalMomentCount === 1 ? 'moment' : 'moments'}, one lovely day
          </>
        )}
      </strong></div>
      <section className="timeline-section">
        <div className="section-heading"><h2>Today’s timeline</h2><button className="text-link" onClick={onEditStory}>Edit story ✎</button></div>
        <div className="timeline-list">
          {todayTimelineItems.map((item, index) => { const clockTime = item.time.split('\n').at(-1); const showTime = !todayTimelineItems.slice(0, index).some((previous) => previous.time.split('\n').at(-1) === clockTime); return <StoryTimelineRow key={item.id} item={item} showTime={showTime} menuOpen={openMenuId === item.id} onMenuToggle={() => setOpenMenuId(openMenuId === item.id ? null : item.id)} onView={() => { setOpenMenuId(null); onMoment(item.id); }} onEdit={() => { setOpenMenuId(null); onEditMoment(item); }} onDelete={() => { setOpenMenuId(null); setDeleteError(''); setPendingDelete(item); }} />; })}
        </div>
      </section>
      {earlierTimelineItems.length > 0 && <section className="timeline-section earlier-timeline-section"><div className="section-heading"><h2>Earlier moments</h2></div><div className="timeline-list">{earlierTimelineItems.map((item, index) => { const clockTime = item.time.split('\n').at(-1); const showTime = !earlierTimelineItems.slice(0, index).some((previous) => previous.time.split('\n').at(-1) === clockTime); return <StoryTimelineRow key={item.id} item={item} showTime={showTime} menuOpen={openMenuId === item.id} onMenuToggle={() => setOpenMenuId(openMenuId === item.id ? null : item.id)} onView={() => { setOpenMenuId(null); onMoment(item.id); }} onEdit={() => { setOpenMenuId(null); onEditMoment(item); }} onDelete={() => { setOpenMenuId(null); setDeleteError(''); setPendingDelete(item); }} />; })}</div></section>}
      {openMenuId && <button className="timeline-menu-dismiss" aria-label="Close moment actions" onClick={() => setOpenMenuId(null)} />}
      {pendingDelete && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-story-moment-title" onClick={(event) => event.stopPropagation()}><h2 id="delete-story-moment-title">Delete “{pendingDelete.title}”?</h2><p>{observations.some((entry) => entry.id === pendingDelete.id) ? 'This permanently removes this moment and its linked owner context from this pet’s Story.' : 'This removes this moment from the current Story. You can add it again later from Edit story.'}</p>{deleteError && <p className="inline-save-error" role="alert">{deleteError}</p>}<div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-button" onClick={confirmDelete}>Delete</button></div></section></div>}
    </>
  );
}

type StoryEditRow = { id: string; image: string; mediaType?: string; title: string; meta: string; note?: string; context?: string };

function StoryEditPage({ observations, includedMoments, petName, hasDemoMoments, onBack, onSave, onEdit, onDelete }: { observations: StoryObservation[]; includedMoments: string[] | null; petName: string; hasDemoMoments: boolean; onBack: () => void; onSave: (ids: string[]) => void; onEdit: (row: StoryEditRow) => void; onDelete: (id: string) => void }) {
  const [included, setIncluded] = useState<string[]>(() =>
    includedMoments
      ? [...includedMoments]
      : [
          ...observations
            .filter((entry) => !entry.privateRecord)
            .map((entry) => entry.id),
          ...(hasDemoMoments ? ['breakfast', 'window', 'toy'] : []),
        ]
  );
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const rows: StoryEditRow[] = [
    ...observations.filter((entry) => !entry.privateRecord).map((entry) => ({ id: entry.id, image: entry.image, mediaType: entry.mediaType, title: entry.title, meta: `${formatObservationTime(entry.savedAt)} · written observation`, note: entry.note, context: entry.context })),
    ...(hasDemoMoments ? [{ id: 'breakfast', image: asset('story-breakfast.png'), title: 'Breakfast time', meta: '08:10 · selected clip', note: 'Observed eating as usual' },
    {
      id: 'window',
      image: asset('story-window.png'),
      title: 'Rest by the window',
      meta: '11:35 · selected clip',
      note: 'A quiet moment to remember',
    },
    { id: 'toy', image: asset('story-toy.png'), title: 'Favourite toy chase', meta: '16:20 · selected clip', note: 'One of today’s highlights!' }] : []),
  ];
  const clearLongPress = () => { if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current); longPressTimer.current = null; };
  const beginLongPress = (id: string) => { clearLongPress(); longPressTimer.current = window.setTimeout(() => { suppressClick.current = true; setOpenMenuId(id); }, 520); };
  const removeRow = (id: string) => { setRemovedIds((current) => [...current, id]); setIncluded((current) => current.filter((entry) => entry !== id)); setOpenMenuId(null); onDelete(id); };
  return <section className="story-edit-page">
    <header className="story-edit-header"><button className="back-button" aria-label="Go back" onClick={onBack}>←</button><h1>Edit story</h1></header>
    <section className="story-visibility-card"><strong>Story visibility</strong><p>Keep selected moments in {petName}'s Story.<br/>Hidden moments remain in your records.</p><small>Sharing uses only moments you choose.</small></section>
    <div className="story-edit-rows">{rows.filter((row) => !removedIds.includes(row.id)).map((row) => <div className="story-edit-item" key={row.id} onPointerDown={() => beginLongPress(row.id)} onPointerUp={clearLongPress} onPointerLeave={clearLongPress} onPointerCancel={clearLongPress} onContextMenu={(event) => { event.preventDefault(); clearLongPress(); suppressClick.current = true; setOpenMenuId(row.id); }}><button type="button" className={`story-edit-row ${included.includes(row.id) ? 'included' : ''}`} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setOpenMenuId(null); setIncluded((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]); }}><StoryMediaView src={row.image} type={row.mediaType} alt="" /><span className="story-edit-row-copy"><strong>{row.title}</strong><small>{row.meta}</small></span><span className="story-edit-check" aria-hidden="true">{included.includes(row.id) ? '✓' : ''}</span></button>{openMenuId === row.id && <div className="story-row-action-bubble" role="menu"><button role="menuitem" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); clearLongPress(); setOpenMenuId(null); suppressClick.current = false; onEdit(row); }}>Edit</button><button role="menuitem" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); clearLongPress(); removeRow(row.id); suppressClick.current = false; }}>Delete</button></div>}</div>)}</div>
    <div className="sticky-action"><button className="primary-button full" onClick={() => onSave(included)}>Save Story changes</button></div>
  </section>;
}

function StoryDraftsPage({ drafts, onBack, onResume, onDelete }: { drafts: StoryDraft[]; onBack: () => void; onResume: (draft: StoryDraft) => void; onDelete: (id: string) => boolean }) {
  const [pendingDelete, setPendingDelete] = useState<StoryDraft | null>(null);
  const [deleteError, setDeleteError] = useState('');

  function closeDeleteDialog() {
    setPendingDelete(null);
    setDeleteError('');
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    if (!onDelete(pendingDelete.id)) {
      setDeleteError('This draft could not be deleted from this device. Please try again.');
      return;
    }
    closeDeleteDialog();
  }

  return <section className="story-drafts-page">
    <header className="story-edit-header"><button className="back-button" aria-label="Go back" onClick={onBack}>←</button><h1>Drafts</h1></header>
    {drafts.length ? <div className="story-drafts-list">{drafts.map((draft) => <div className="story-draft-row" key={draft.id}><button className="story-draft-card" onClick={() => onResume(draft)}><strong>{draft.title?.trim() || (draft.note.trim() ? draft.note : 'Untitled observation')}</strong><span>{draft.privateRecord ? 'Private note' : `${draft.selectedMoments.length} selected ${draft.selectedMoments.length === 1 ? 'moment' : 'moments'}`}{draft.context ? ` · ${draft.context}` : ''}</span><small>Saved {formatObservationTime(draft.savedAt).replace('\n', ' · ')}</small></button><button className="story-draft-delete" aria-label={`Delete draft ${draft.title?.trim() || draft.note.trim() || 'Untitled observation'}`} onClick={() => { setDeleteError(''); setPendingDelete(draft); }}>Delete</button></div>)}</div> : <div className="story-drafts-empty">No drafts yet.</div>}
    {pendingDelete && <div className="profile-dialog-backdrop" role="presentation" onClick={closeDeleteDialog}><section className="profile-dialog draft-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-draft-title" onClick={(event) => event.stopPropagation()}><h2 id="delete-draft-title">Delete this draft?</h2><p>This removes the unsaved observation from Drafts. This action cannot be undone.</p>{deleteError && <p className="inline-save-error" role="alert">{deleteError}</p>}<div className="member-removal-actions"><button className="cancel-button" onClick={closeDeleteDialog}>Cancel</button><button className="danger-button" onClick={confirmDelete}>Delete draft</button></div></section></div>}
  </section>;
}

const momentChoices = [
  { id: 'window', time: '11:35', title: 'window rest', image: 'story-window.png' },
  { id: 'toy', time: '16:20', title: 'toy chase', image: 'story-toy.png' },
  { id: 'breakfast', time: '08:10', title: 'breakfast', image: 'story-breakfast.png' },
];

function getNoteChoices(petName: string): StorySourceNote[] {
  return [
    { id: 'note-visitors', text: 'Visitors came over today.', label: 'Owner note · today' },
    { id: 'note-play', text: `${petName} played after lunch.`, label: 'Care note · yesterday' },
    { id: 'note-rest', text: 'Quiet rest by the window.', label: 'Routine note · last week' },
  ];
}

function defaultObservationForSource(sourceId: string, petName: string) {
  if (sourceId === 'breakfast') return `${petName} ate breakfast at the usual time.`;
  if (sourceId === 'toy') return `${petName} chased a favourite toy in the afternoon.`;
  if (sourceId === 'window') return `${petName} rested by the window after our visitors left.`;
  if (sourceId === 'uploaded') return `A new moment with ${petName}.`;
  return '';
}

function titleFromObservation(value: string) {
  const cleaned = value.trim().replace(/[.!?]+$/, '');
  if (!cleaned) return 'A written moment';
  return cleaned.length <= 42 ? cleaned : `${cleaned.slice(0, 39).trimEnd()}…`;
}

function MomentDateTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const now = new Date();
  now.setSeconds(0, 0);
  const selectedDate = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(selectedDate.getTime()) ? new Date() : selectedDate;
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(safeDate.getFullYear(), safeDate.getMonth(), 1));
  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const firstDay = (monthStart.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index - firstDay + 1));
  const dateLabel = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(safeDate);
  const timeLabel = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(safeDate);
  const formatLocalDateTime = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const isToday = safeDate.toDateString() === now.toDateString();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const isAfterCurrentMonth = monthStart.getTime() >= currentMonth.getTime();
  useEffect(() => {
    if (safeDate.getTime() > now.getTime()) {
      onChange(formatLocalDateTime(now));
      setVisibleMonth(currentMonth);
    }
  }, [value]);
  const updateDateTime = (date: Date) => onChange(formatLocalDateTime(date.getTime() > now.getTime() ? now : date));

  return <section className={`observation-time-field ${open ? 'picker-open' : ''}`}>
    <strong>When did this moment happen?</strong>
    <button type="button" className="moment-datetime-trigger" aria-expanded={open} onClick={() => { setVisibleMonth(new Date(safeDate.getFullYear(), safeDate.getMonth(), 1)); setOpen(!open); }}><span>{dateLabel}</span><span>{timeLabel}</span><span className="moment-calendar-icon" aria-hidden="true">▦</span></button>
    {open && <div className="moment-datetime-panel">
      <div className="moment-calendar-heading"><button type="button" aria-label="Previous month" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>‹</button><strong>{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(visibleMonth)}</strong><button type="button" aria-label="Next month" disabled={isAfterCurrentMonth} onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>›</button></div>
      <div className="moment-calendar-grid">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span className="moment-calendar-weekday" key={`${day}-${index}`}>{day}</span>)}{days.map((day, index) => { const inMonth = day.getMonth() === visibleMonth.getMonth(); const selected = day.toDateString() === safeDate.toDateString(); const future = day.getTime() > new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); return <button type="button" key={`${day.toISOString()}-${index}`} disabled={future} className={`${inMonth ? '' : 'outside-month'} ${selected ? 'selected' : ''}`} onClick={() => updateDateTime(new Date(day.getFullYear(), day.getMonth(), day.getDate(), safeDate.getHours(), safeDate.getMinutes()))}>{day.getDate()}</button>; })}</div>
      <div className="moment-time-controls"><strong>Time</strong><label><span>Hour</span><select aria-label="Hour" value={safeDate.getHours()} onChange={(event) => { const next = new Date(safeDate); next.setHours(Number(event.target.value)); updateDateTime(next); }}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour} disabled={isToday && hour > now.getHours()}>{String(hour).padStart(2, '0')}</option>)}</select></label><span className="moment-time-separator">:</span><label><span>Minute</span><select aria-label="Minute" value={safeDate.getMinutes()} onChange={(event) => { const next = new Date(safeDate); next.setMinutes(Number(event.target.value)); updateDateTime(next); }}>{Array.from({ length: 60 }, (_, minute) => <option key={minute} value={minute} disabled={isToday && safeDate.getHours() === now.getHours() && minute > now.getMinutes()}>{String(minute).padStart(2, '0')}</option>)}</select></label><button type="button" className="moment-picker-done" onClick={() => setOpen(false)}>Done</button></div>
    </div>}
  </section>;
}

function StoryAddPage({ step, onBack, onCancel, selectedMoments, setSelectedMoments, uploadedMedia, setUploadedMedia, title, setTitle, momentAt, setMomentAt, relatedPhotos, setRelatedPhotos, note, setNote, context, setContext, privateRecord, setPrivateRecord, observations, petName, ownerName, hasDemoMoments, saveError, onSave, onEdit }: {
  step: 'moments' | 'compose' | 'preview' | 'saved';
  onBack: () => void;
  onCancel: () => void;
  selectedMoments: string[];
  setSelectedMoments: (ids: string[]) => void;
  uploadedMedia: StoryMedia | null;
  setUploadedMedia: (media: StoryMedia | null) => void;
  title: string;
  setTitle: (value: string) => void;
  momentAt: string;
  setMomentAt: (value: string) => void;
  relatedPhotos: StoryMedia[];
  setRelatedPhotos: (photos: StoryMedia[]) => void;
  note: string;
  setNote: (value: string) => void;
  context: string;
  setContext: (value: string) => void;
  privateRecord: boolean;
  setPrivateRecord: (value: boolean) => void;
  observations: StoryObservation[];
  petName: string;
  ownerName: string;
  hasDemoMoments: boolean;
  saveError: string;
  onSave: () => void;
  onEdit: () => void;
}) {
  const [sourceTab, setSourceTab] = useState<'Photos' | 'Clips' | 'Notes'>('Photos');
  const [uploadError, setUploadError] = useState('');
  const latest = observations[0];
  const availableMomentChoices = hasDemoMoments ? momentChoices : [];
  const selected = availableMomentChoices.filter((moment) => selectedMoments.includes(moment.id));
  const noteChoices = hasDemoMoments ? getNoteChoices(petName) : [];
  const selectedNotes = noteChoices.filter((entry) => selectedMoments.includes(entry.id));
  const savedSourceNotes = latest?.sourceNotes ?? selectedNotes;
  const uploadedSelected = Boolean(uploadedMedia && selectedMoments.includes('uploaded'));
  const isOwnerCreatedMoment = uploadedSelected || selectedMoments.length === 0;
  const hasVisual = selected.length > 0 || uploadedSelected;
  const latestHasVisual = latest?.momentIds
    ? latest.momentIds.some((id) => id === 'uploaded' || momentChoices.some((moment) => moment.id === id))
    : Boolean(latest && !latest.sourceNotes?.length && latest.momentCount > 0);
  const image = step === 'saved'
    ? latest?.image ?? asset(selected[0]?.image ?? 'story-window.png')
    : uploadedSelected && uploadedMedia
      ? uploadedMedia.url
      : asset(selected[0]?.image ?? 'story-window.png');
  const mediaType = step === 'saved' ? latest?.mediaType : uploadedSelected ? uploadedMedia?.type : undefined;
  const observationText = step === 'saved' ? latest?.note ?? note : note;
  const selectedTitle = selected[0]?.id === 'breakfast' ? 'Breakfast time' : selected[0]?.id === 'toy' ? 'Favourite toy chase' : selected[0]?.id === 'window' ? 'Rest by the window' : uploadedSelected ? `A new moment with ${petName}` : titleFromObservation(selectedNotes[0]?.text ?? note);
  const observationTitle = step === 'saved' ? latest?.title ?? selectedTitle : title.trim() || selectedTitle;
  const cancel = <button className="add-cancel" onClick={onCancel}>Cancel</button>;
  const header = (title: string, eyebrow: string) => <header className="add-flow-header"><div className="add-flow-title"><button className="back-button" aria-label="Go back" onClick={onBack}>←</button><h1>{title}</h1>{cancel}</div><p className="eyebrow">{eyebrow}</p></header>;

  function chooseSourceTab(tab: 'Photos' | 'Clips' | 'Notes') {
    setSourceTab(tab);
    setUploadError('');
  }

  function toggleMomentSource(id: string, text: string) {
    const alreadyChosen = selectedMoments.includes(id);
    setSelectedMoments(alreadyChosen ? [] : [id]);
    if (!alreadyChosen) setNote(text);
  }

  function addRelatedPhotos(files: FileList | null) {
    if (!files?.length) return;
    const availableSlots = Math.max(0, 4 - relatedPhotos.length);
    const chosenFiles = Array.from(files).slice(0, availableSlots);
    if (Array.from(files).some((file) => !file.type.startsWith('image/') && !file.type.startsWith('audio/'))) {
      setUploadError('Choose image or audio files.');
      return;
    }
    if (chosenFiles.some((file) => file.size > 2 * 1024 * 1024)) {
      setUploadError('Choose files smaller than 2 MB each.');
      return;
    }
    Promise.all(chosenFiles.map((file) => new Promise<StoryMedia>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve({ name: file.name, type: file.type, url: reader.result }) : reject(new Error('Unreadable file'));
      reader.onerror = () => reject(new Error('Unreadable file'));
      reader.readAsDataURL(file);
    }))).then((media) => {
      setRelatedPhotos([...relatedPhotos, ...media]);
      setUploadError('');
    }).catch(() => setUploadError('An attachment could not be read. Please try another file.'));
  }

  function uploadMedia(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setUploadError('Choose an image or video file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Choose a file smaller than 2 MB for this prototype.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setUploadError('This file could not be read. Please try another one.');
        return;
      }
      setUploadedMedia({ name: file.name, type: file.type, url: reader.result });
      setSelectedMoments(['uploaded']);
      setNote(defaultObservationForSource('uploaded', petName));
      setTitle(`A moment with ${petName}`);
      setUploadError('');
    };
    reader.onerror = () => setUploadError('This file could not be read. Please try another one.');
    reader.readAsDataURL(file);
  }

  if (step === 'moments') return <div className="add-flow-page">
    {header('Choose a moment', '1 OF 3 · SELECT A MAIN MOMENT')}
    <div className="source-tabs" role="tablist" aria-label="Moment sources">{(['Photos', 'Clips', 'Notes'] as const).map((tab) => <button key={tab} className={sourceTab === tab ? 'active' : ''} role="tab" aria-selected={sourceTab === tab} onClick={() => chooseSourceTab(tab)}>{tab}</button>)}</div>
    <div className={`moment-picker-grid ${sourceTab === 'Notes' ? 'notes-picker-grid' : ''}`}>
      {sourceTab === 'Notes' ? noteChoices.map((entry) => { const chosen = selectedMoments.includes(entry.id); return <button className={`moment-choice note-moment-choice ${chosen ? 'selected' : ''}`} key={entry.id} onClick={() => { toggleMomentSource(entry.id, entry.text); if (!chosen) setTitle(titleFromObservation(entry.text)); }}><span>{entry.text}</span>{chosen && <span className="moment-check">✓</span>}<small>{entry.label}</small></button>; }) : availableMomentChoices.map((moment, index) => { const chosen = selectedMoments.includes(moment.id); const label = sourceTab === 'Clips' ? ['Clip · 0:12', 'Clip · 0:18', 'Clip · 0:08'][index] : `${moment.time} · ${moment.title}`; return <button className={`moment-choice ${chosen ? 'selected' : ''}`} key={moment.id} onClick={() => { toggleMomentSource(moment.id, defaultObservationForSource(moment.id, petName)); if (!chosen) setTitle(moment.title); }}><img src={asset(moment.image)} alt="" />{chosen && <span className="moment-check">✓</span>}<small>{label}</small></button>; })}
      {!hasDemoMoments && <p className="empty-source-message">No saved {sourceTab.toLowerCase()} yet. Add one from this device or start with a written observation.</p>}
      {sourceTab !== 'Notes' && uploadedMedia && <div role="button" tabIndex={0} aria-pressed={uploadedSelected} className={`moment-choice uploaded-device-choice ${uploadedSelected ? 'selected' : ''}`} onClick={() => { setSelectedMoments(uploadedSelected ? [] : ['uploaded']); if (!uploadedSelected && !title.trim()) setTitle(`A moment with ${petName}`); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedMoments(uploadedSelected ? [] : ['uploaded']); } }}><StoryMediaView src={uploadedMedia.url} type={uploadedMedia.type} alt={uploadedMedia.name} />{uploadedSelected && <span className="moment-check">✓</span>}<button type="button" className="remove-uploaded-media" aria-label={`Remove ${uploadedMedia.name}`} onClick={(event) => { event.stopPropagation(); setUploadedMedia(null); setSelectedMoments(selectedMoments.filter((id) => id !== 'uploaded')); }}>×</button><small>{uploadedMedia.name}</small></div>}
      {sourceTab !== 'Notes' && <label className="moment-choice add-device-choice"><input type="file" accept="image/*,video/*" onChange={(event) => { uploadMedia(event.target.files?.[0]); event.currentTarget.value = ''; }} /><span className="add-device-plus">＋</span><span>{uploadedSelected ? 'Replace photo or video' : 'Add photo or video'}</span></label>}
      {uploadError && <p className="upload-error" role="alert">{uploadError}</p>}
    </div>
    <button className="text-only-option" onClick={() => { setUploadedMedia(null); setSelectedMoments([]); setTitle(''); setRelatedPhotos([]); setNote(''); onEdit(); }}><strong>Start with a written observation</strong><span>No photo or clip needed to remember this moment.</span></button>
    <div className="sticky-action add-moment-sticky-action"><button className="primary-button full" onClick={onEdit} disabled={!selectedMoments.length}>{selectedMoments.length > 1 ? 'Continue with selected sources' : `Continue with this ${sourceTab === 'Notes' ? 'note' : sourceTab === 'Clips' ? 'clip' : 'moment'}`}</button><p>Each Story entry represents one distinct moment.</p></div>
  </div>;

  if (step === 'compose') return <div className="add-flow-page">
    {header('Write a moment', '2 OF 3 · ADD YOUR WORDS')}
    {hasVisual || selectedNotes.length > 0 ? <><div className="compose-section-label"><strong>Selected moment</strong></div>{hasVisual ? <div className="selected-moments-strip">{selected.map((moment) => <img key={moment.id} src={asset(moment.image)} alt={moment.title} />)}{uploadedSelected && uploadedMedia && <StoryMediaView src={uploadedMedia.url} type={uploadedMedia.type} alt={uploadedMedia.name} />}</div> : <div className="selected-note-strip">{selectedNotes.map((entry) => <div key={entry.id}><span>{entry.text}</span><small>{entry.label}</small></div>)}</div>}</> : <><div className="written-observation-mode"><strong>Written observation</strong></div><div className="written-observation-note"><strong>A note is enough</strong><span>You can describe a moment without a photo or camera clip.</span></div></>}
    {isOwnerCreatedMoment && <MomentDateTimePicker value={momentAt} onChange={setMomentAt} />}
    <label className="observation-title-field"><strong>Title</strong><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a title for this moment" maxLength={70} /></label>
    <section className="observation-writing-card"><strong>What happened with {petName}?</strong><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe what you noticed…" />{relatedPhotos.length > 0 && <div className="related-photos-strip">{relatedPhotos.map((media, index) => <div className={media.type.startsWith('audio/') ? 'audio-attachment-thumb' : ''} key={`${media.name}-${index}`}><StoryMediaView src={media.url} type={media.type} alt={media.name} controls={media.type.startsWith('audio/')} /><button type="button" aria-label={`Remove attachment ${index + 1}`} onClick={() => setRelatedPhotos(relatedPhotos.filter((_, mediaIndex) => mediaIndex !== index))}>×</button></div>)}</div>}{uploadError && <p className="upload-error" role="alert">{uploadError}</p>}<div className="observation-writing-tools"><label aria-label="Add photos"><input type="file" accept="image/*" multiple onChange={(event) => { addRelatedPhotos(event.target.files); event.currentTarget.value = ''; }} /><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="m5 17 5-5 3 3 2-2 5 5" /></svg></label><label aria-label="Add a voice note"><input type="file" accept="audio/*" capture onChange={(event) => { addRelatedPhotos(event.target.files); event.currentTarget.value = ''; }} /><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" /></svg></label></div></section>
    <section className="add-context-choices"><strong>Add context</strong><div>{['Visitors at home', 'Routine changed', 'Not sure yet'].map((item) => <button key={item} className={context === item ? 'active' : ''} onClick={() => setContext(context === item ? '' : item)}>{item}</button>)}</div></section>
    <div className="sticky-action"><button className="primary-button full" onClick={onEdit} disabled={!note.trim()}>Preview observation</button><p>Your note is shown as your own words.</p></div>
  </div>;

  if (step === 'preview') return <div className="add-flow-page">
    {header('Preview', '3 OF 3 · CHECK BEFORE SAVING')}
    <article className={`observation-preview-card ${!hasVisual ? 'note-observation-preview' : ''}`}>{hasVisual ? <StoryMediaView src={image} type={mediaType} alt={petName} controls={mediaType?.startsWith('video/')} /> : <div className="observation-note-visual"><strong>A note from {ownerName}</strong><p>{note || 'A moment with ' + petName + '.'}</p></div>}{relatedPhotos.length > 0 && <div className="preview-related-photos">{relatedPhotos.map((media, index) => <StoryMediaView key={`${media.name}-${index}`} src={media.url} type={media.type} alt={`Related attachment ${index + 1}`} controls={media.type.startsWith('audio/')} />)}</div>}<div className="observation-preview-copy"><small>{petName} · Today</small><strong>{observationTitle}</strong><p>{note || 'A moment with ' + petName + '.'}</p>{selectedNotes.length > 0 && <div className="preview-source-notes"><strong>Saved note sources</strong>{selectedNotes.map((entry) => <span key={entry.id}>{entry.text}<small>{entry.label}</small></span>)}</div>}<div>{selectedMoments.length} selected {selectedMoments.length === 1 ? 'source' : 'sources'} · {hasVisual ? 'owner observation' : `Written observation · ${ownerName}`}</div><span>Owner-provided context{context ? ` · ${context}` : ''}</span></div></article>
    <section className="observation-destination"><strong>Where this goes</strong><button className={!privateRecord ? 'selected' : ''} onClick={() => setPrivateRecord(false)}><span className="destination-radio">{!privateRecord && <i />}</span>Add to {petName}'s Story</button><button className={privateRecord ? 'selected' : ''} onClick={() => setPrivateRecord(true)}><span className="destination-radio">{privateRecord && <i />}</span>Keep as a private record</button><small>{privateRecord ? 'Only you can see this record until you choose to share it.' : 'You choose which sources and words are saved.'}</small></section>
    {saveError && <p className="inline-save-error" role="alert">{saveError}</p>}
    <div className="sticky-action"><button className="primary-button full" onClick={onSave}>{privateRecord ? 'Save private note' : 'Save observation'}</button>{!privateRecord && <p>Nothing updates {petName}'s baseline automatically.</p>}</div>
  </div>;

  return <div className="add-flow-page">
    {header(privateRecord ? 'Saved privately' : 'Moment saved', privateRecord ? 'SAVED TO PRIVATE RECORDS' : 'ADDED TO ' + petName.toUpperCase() + '’S STORY')}
    <section className="observation-saved-banner"><strong>✓ &nbsp;{privateRecord ? 'Your private note is saved' : 'Your observation is saved'}</strong><span>{privateRecord ? `Visible only to you · Added by ${ownerName}` : `Added by ${ownerName}`} · Today</span></section>
    <article className="observation-preview-card saved-observation-card">{latestHasVisual ? <StoryMediaView src={image} type={mediaType} alt={petName} controls={mediaType?.startsWith('video/')} /> : <div className="observation-note-visual"><strong>A note from {ownerName}</strong><p>{observationText || 'A moment with ' + petName + '.'}</p></div>}{latest?.relatedPhotos && latest.relatedPhotos.length > 0 && <div className="preview-related-photos">{latest.relatedPhotos.map((media, index) => <StoryMediaView key={`${media.name}-${index}`} src={media.url} type={media.type} alt={`Related attachment ${index + 1}`} controls={media.type.startsWith('audio/')} />)}</div>}<div className="observation-preview-copy"><strong>{observationTitle}</strong><p>{observationText || 'A moment with ' + petName + '.'}</p>{savedSourceNotes.length > 0 && <div className="preview-source-notes"><strong>Saved note sources</strong>{savedSourceNotes.map((entry) => <span key={entry.id}>{entry.text}<small>{entry.label}</small></span>)}</div>}<div>{(latest?.momentCount ?? selectedMoments.length) === 0 ? `Written observation · ${ownerName}` : `${latest?.momentCount ?? selectedMoments.length} selected ${(latest?.momentCount ?? selectedMoments.length) === 1 ? 'source' : 'sources'} · owner observation`}</div><span>{privateRecord ? 'Private record · not in ' + petName + '’s Story' : `Owner-provided context${latest?.context ? ` · ${latest.context}` : ''}`}</span></div></article>
    <div className="saved-observation-links"><button className="text-link" onClick={onEdit}>Edit observation</button></div>
    <div className="sticky-action"><button className="primary-button full" onClick={onCancel}>{privateRecord ? 'Return to Today' : 'View in Story'}</button><p>You can edit or remove this observation later.</p></div>
  </div>;
}

function MomentDetailPage({ moment, contexts, ownerName, ownerAvatar, petName, onBack, onAddContext, onEditContext, onDeleteContext }: { moment: MomentRecord; contexts: OwnerContext[]; ownerName: string; ownerAvatar: string; petName: string; onBack: () => void; onAddContext: () => void; onEditContext: (context: OwnerContext) => void; onDeleteContext: (id: string) => boolean }) {
  const [pendingDelete, setPendingDelete] = useState<OwnerContext | null>(null);
  const [deleteError, setDeleteError] = useState('');

  function closeDeleteDialog() {
    setPendingDelete(null);
    setDeleteError('');
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    if (!onDeleteContext(pendingDelete.id)) {
      setDeleteError('This context could not be deleted on this device. Please try again.');
      return;
    }
    closeDeleteDialog();
  }

  return (
    <>
      <DetailHeader title={moment.title} eyebrow="MOMENT DETAILS" onBack={onBack} />
      <article className="moment-detail-card">
        <section className="moment-detail-media">
          <StoryMediaView src={moment.image} type={moment.mediaType} alt={`${petName} · ${moment.title}`} controls={moment.mediaType?.startsWith('video/')} />
        </section>
        <section className="moment-summary-card"><div className="moment-summary-mini moment-source-mini"><strong>{moment.source}</strong><p>{moment.time}</p></div><div className="moment-summary-mini moment-description-mini"><strong>What this moment shows</strong><p>{moment.description}</p></div></section>
      </article>
      {moment.relatedPhotos && moment.relatedPhotos.length > 0 && <section className="moment-related-photos"><strong>Related photos</strong><div>{moment.relatedPhotos.map((media, index) => <StoryMediaView key={`${media.name}-${index}`} src={media.url} type={media.type} alt={`Related attachment ${index + 1}`} controls={media.type.startsWith('audio/')} />)}</div></section>}
      {moment.observationContext && <section className="observation-context-summary"><strong>Context saved with this observation</strong><span>{moment.observationContext}</span></section>}
      <section className="moment-context-section">
        <div className="section-heading"><h2>Owner context</h2>{contexts.length > 0 && <span>{contexts.length} saved</span>}</div>
        {contexts.length ? <div className="moment-context-list">{contexts.map((context) => <article className="detail-card moment-context-card" key={context.id}><div className="moment-context-head"><div className="moment-context-author"><OwnerAvatar src={ownerAvatar} name={ownerName} className="moment-context-avatar" /><span><strong>{ownerName}</strong><small>{formatObservationTime(context.savedAt).replace('\n', ' · ')}</small></span></div><span className={`context-kind-tag ${context.interpretation}`}>{interpretationLabels[context.interpretation]}</span></div><p>{context.note}</p><ContextAttachmentList attachments={context.attachments ?? []} /><div className="moment-context-actions"><button className="text-link" onClick={() => onEditContext(context)}>Edit</button><button className="moment-context-delete" onClick={() => { setDeleteError(''); setPendingDelete(context); }}>Delete</button></div></article>)}</div> : <div className="empty-context-state"><strong>No context has been added</strong><p>Add what was happening around this specific moment. It will stay attached here.</p></div>}
      </section>
      <StickyAction className="moment-detail-action" label="Add context to this moment" onClick={onAddContext} hint={`Context will be linked only to “${moment.title}”.`} />
      {pendingDelete && <div className="profile-dialog-backdrop" role="presentation" onClick={closeDeleteDialog}><section className="profile-dialog context-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-context-title" onClick={(event) => event.stopPropagation()}><h2 id="delete-context-title">Delete this context?</h2><p>This removes the owner context from “{moment.title}”. This action cannot be undone.</p>{deleteError && <p className="inline-save-error" role="alert">{deleteError}</p>}<div className="member-removal-actions"><button className="cancel-button" onClick={closeDeleteDialog}>Cancel</button><button className="danger-button" onClick={confirmDelete}>Delete context</button></div></section></div>}
    </>
  );
}

function OverviewPage({ onBack, onClip, petName, saved, onSaved }: { onBack: () => void; onClip: () => void; petName: string; saved: OwnerContext | null; onSaved: () => void }) {
  const heights = [49, 70, 58, 84, 5, 74, 91];
  return (
    <>
      <DetailHeader title="Afternoon rest" eyebrow="TODAY · POSSIBLE CHANGE" onBack={onBack} />
      <section className="insight-card"><strong>Rest looked longer this week</strong><b>4 of 7 observed afternoons</b><p>Compared with {petName}’s recent 4-week record.</p></section>
      {saved && <button className="overview-owner-context" onClick={onSaved}><small>OWNER CONTEXT ADDED</small><strong>{interpretationLabels[saved.interpretation]}</strong><span>{saved.note}</span><em>View or undo →</em></button>}
      <section className="chart-card"><strong>Recent afternoons</strong><p>Recorded rest &nbsp;·&nbsp; missing data</p><div className="bars">{heights.map((height, i) => <div className="bar-col" key={i}><span className={`bar ${i === 4 ? 'missing' : ''}`} style={{ height }} /><small>{'MTWTFSS'[i]}</small></div>)}</div><p className="coverage">5 of 7 days have usable coverage</p></section>
      <div className="section-heading supporting-title"><h2>Supporting moments</h2><span>2 clips + 1 note</span></div>
      <div className="evidence-grid">
        <button className="evidence-tile" onClick={onClip}><img src={asset('overview-window.png')} alt={`${petName} resting by the window`} /><span><strong>Window rest</strong><small>{formatShortDate()} · clip</small></span></button>
        <button className="evidence-tile" onClick={onClip}><img src={asset('overview-rest.png')} alt={`${petName} resting in another selected clip`} /><span><strong>Another rest</strong><small>Recent day · clip</small></span></button>
      </div>
      <StickyAction label="See supporting moments" onClick={onClip} hint="This is a comparison, not a cause or diagnosis." />
    </>
  );
}

function ClipPage({ onBack, onContext, petName, ownerName}: { onBack: () => void; onContext: () => void ;petName: string; ownerName: string;}) {
  const [playing, setPlaying] = useState(false);
  return (
    <>
      <DetailHeader title="Window rest" eyebrow={`SELECTED CLIP · ${formatShortDate().toUpperCase()}`} onBack={onBack} />
      <section className="clip-player">
        <div className="clip-image"><img src={asset('clip-still.png')} alt={`${petName} in the selected camera clip`} /><button aria-label={playing ? 'Pause clip preview' : 'Play clip preview'} onClick={() => setPlaying(!playing)}><img src={asset('play.svg')} alt="" /></button></div>
        <div className="clip-progress"><span style={{ width: playing ? '62%' : '38%' }} /></div>
        <small>{playing ? '0:19' : '0:12'} / 0:28</small>
      </section>
      <section className="detail-card"><strong>From the home camera</strong><p>{formatShortDate()} · 11:35 AM–11:36 AM</p></section>
      <section className="detail-card warm"><strong>What the clip shows</strong><p>{petName} rested beside the window during this recorded moment.</p></section>
      <section className="detail-card"><strong>{ownerName}’s note · today</strong><p>“Visitors were at home.” This is owner context, not an AI conclusion.</p></section>
      <StickyAction label="Add your context" onClick={onContext} hint="Your words will stay separate from the clip." />
    </>
  );
}

function ContextAttachmentList({ attachments, onRemove }: { attachments: ContextAttachment[]; onRemove?: (kind: ContextAttachment['kind']) => void }) {
  if (!attachments.length) return null;
  return <div className="context-attachments">{attachments.map((attachment) => <div className={`context-attachment ${attachment.kind}`} key={attachment.kind}>{attachment.kind === 'photo' ? <img src={attachment.url} alt="Attached photo" /> : <><audio src={attachment.url} controls aria-label={attachment.name} /><span>{attachment.name}</span></>}{onRemove && <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => onRemove(attachment.kind)}>×</button>}</div>)}</div>;
}

function ContextPage({ moment, note, setNote, interpretation, setInterpretation, attachments, setAttachments, petName, onBack, onReview }: {
  moment: MomentRecord;
  note: string;
  setNote: (value: string) => void;
  interpretation: Interpretation;
  setInterpretation: (value: Interpretation) => void;
  attachments: ContextAttachment[];
  setAttachments: (attachments: ContextAttachment[]) => void;
  petName: string;
  onBack: () => void;
  onReview: () => void;
}) {
  const [attachmentError, setAttachmentError] = useState('');

  function attachFile(file: File | undefined, kind: ContextAttachment['kind']) {
    if (!file) return;
    const expectedType = kind === 'photo' ? 'image/' : 'audio/';
    if (!file.type.startsWith(expectedType)) {
      setAttachmentError(kind === 'photo' ? 'Choose an image file.' : 'Choose an audio file.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setAttachmentError('Choose a file smaller than 1 MB for this prototype.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setAttachmentError('This attachment could not be read. Please try another one.');
        return;
      }
      setAttachments([...attachments.filter((attachment) => attachment.kind !== kind), { kind, name: file.name, type: file.type, url: reader.result }]);
      setAttachmentError('');
    };
    reader.onerror = () => setAttachmentError('This attachment could not be read. Please try another one.');
    reader.readAsDataURL(file);
  }

  return (
    <>
      <DetailHeader title="Add context" eyebrow="YOUR WORDS · OWNER INPUT" onBack={onBack} />
      <div className="linked-evidence"><StoryMediaView src={moment.image} type={moment.mediaType} alt={`${petName} · ${moment.title}`} /><span><strong>{moment.title}</strong><small>{moment.time} · one moment</small></span></div>
      <h2 className="question-heading">What else was happening?</h2>
      <div className={`writing-field ${attachments.length ? 'has-attachments' : ''}`}><textarea aria-label={`Your context for ${petName}’s ${moment.title}`} value={note} onChange={(event) => setNote(event.target.value)} placeholder={`What was happening around ${moment.title.toLowerCase()}?`} maxLength={500} /><ContextAttachmentList attachments={attachments} onRemove={(kind) => setAttachments(attachments.filter((attachment) => attachment.kind !== kind))} /><div className="context-attachment-tools"><label><input type="file" accept="image/*" onChange={(event) => { attachFile(event.target.files?.[0], 'photo'); event.currentTarget.value = ''; }} /><span>＋ Photo</span></label><label><input type="file" accept="audio/*" capture onChange={(event) => { attachFile(event.target.files?.[0], 'voice'); event.currentTarget.value = ''; }} /><span>◉ Voice note</span></label></div>{attachmentError && <p className="context-attachment-error" role="alert">{attachmentError}</p>}</div>
      <fieldset className="choice-card"><legend>How should Pawsona treat this?</legend>{(Object.keys(interpretationLabels) as Interpretation[]).map((value) => <label key={value}><input type="radio" name="interpretation" value={value} checked={interpretation === value} onChange={() => setInterpretation(value)} />{interpretationLabels[value]}</label>)}</fieldset>
      <StickyAction label="Review what will be saved" onClick={onReview} disabled={!note.trim()} hint="You can leave this pattern open." />
    </>
  );
}

function ConfirmPage({ moment, note, interpretation, attachments, petName, ownerName, ownerRole, saveError, onBack, onSave }: { moment: MomentRecord; note: string; interpretation: Interpretation; attachments: ContextAttachment[]; petName: string; ownerName: string; ownerRole: string; saveError: string; onBack: () => void; onSave: () => void }) {
  return (
    <>
      <DetailHeader title="Confirm" eyebrow="REVIEW BEFORE SAVING" onBack={onBack} />
      <section className="confirm-card"><small>OWNER CORRECTION</small><h2>{interpretationLabels[interpretation]}</h2><p>“{note}”</p><span>{ownerName} · {ownerRole} · Today</span></section>
      <div className="linked-evidence"><StoryMediaView src={moment.image} type={moment.mediaType} alt={`${petName} · ${moment.title}`} /><span><strong>{moment.title}</strong><small>1 linked moment{attachments.length ? ` + ${attachments.length} ${attachments.length === 1 ? 'attachment' : 'attachments'}` : ''}</small></span></div>
      <ContextAttachmentList attachments={attachments} />
      <section className="detail-card effects-card"><strong>After you save</strong><p>✓ &nbsp;Your context stays attributed to you</p><p>✓ &nbsp;The original observations stay available</p><p>○ &nbsp;Baseline is not changed automatically</p></section>
      <button className="text-link standalone" onClick={onBack}>Edit words or choice</button>
      {saveError && <p className="inline-save-error" role="alert">{saveError}</p>}
      <StickyAction label="Save owner correction" onClick={onSave} />
    </>
  );
}

function SavedPage({ saved, onBack, onReturnStory, onUndo, onEvidence, onEdit, petName, ownerName}: { saved: OwnerContext; onBack: () => void; onReturnStory: () => void; onUndo: () => void; onEvidence: () => void; onEdit: () => void; petName: string; ownerName: string}) {
  return (
    <>
      <DetailHeader title="Saved" eyebrow="OWNER CORRECTION SAVED" onBack={onBack} />
      <section className="saved-banner"><h2>✓ &nbsp;Context saved</h2><p>{petName}’s baseline was not changed automatically.</p></section>
      <section className="saved-result"><small>{ownerName.toUpperCase()}’S CONTEXT</small><strong>{interpretationLabels[saved.interpretation]}</strong><p>{saved.note}</p><ContextAttachmentList attachments={saved.attachments ?? []} /><div className="saved-result-meta">Linked to {saved.momentTitle}{saved.attachments?.length ? ` + ${saved.attachments.length} ${saved.attachments.length === 1 ? 'attachment' : 'attachments'}` : ''} · saved {formatRelativeDate(saved.savedAt).toLowerCase()}</div><span>Owner-confirmed context</span></section>
      <section className="detail-card"><strong>What happens next?</strong><p>Future reviews can show this context alongside new observations.</p></section>
      <div className="saved-links"><button className="text-link" onClick={onUndo}>Undo correction</button><button className="text-link" onClick={onEvidence}>Review linked evidence</button><button className="text-link" onClick={onEdit}>Edit your context</button></div>
      <StickyAction label="Return to Story" onClick={onReturnStory} />
    </>
  );
}

function UndonePage({ petName, onBack, onReturnToday, onReview }: {petName: string; onBack: () => void; onReturnToday: () => void; onReview: () => void }) {
  return (
    <>
      <DetailHeader title="Correction undone" eyebrow="OWNER CONTEXT REMOVED" onBack={onBack} />
      <section className="saved-banner"><h2>✓ &nbsp;Correction undone</h2><p>Your saved context has been removed from this pattern.</p></section>
      <section className="detail-card"><strong>Original observations remain</strong><p>The selected clips and {petName}’s Story are still available for review.</p></section>
      <button className="text-link standalone" onClick={onReview}>Review the evidence again</button>
      <StickyAction label="Return to Today" onClick={onReturnToday} />
    </>
  );
}

const askMessagesKey = 'pawsona-ask-messages-v1';

function readAskMessages(): AskMessage[] {
  try {
    const value = localStorage.getItem(askMessagesKey);
    const parsed: unknown = value ? JSON.parse(value) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry): entry is AskMessage => {
      if (typeof entry !== 'object' || entry === null) return false;
      const message = entry as Partial<AskMessage>;
      if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.text !== 'string') return false;
      if (!message.attachment) return true;
      const attachment = message.attachment as Partial<AskAttachment>;
      return typeof attachment.url === 'string' &&
        typeof attachment.name === 'string' &&
        (attachment.kind === 'image' || attachment.kind === 'audio') &&
        typeof attachment.type === 'string';
    });
  } catch {
    return [];
  }
}

const prototypeSessionKey = 'pawsona-prototype-session-v1';

function defaultCareMembers(ownerName: string): CareMember[] {
  return [
    { id: 'emily', name: ownerName, role: 'Primary owner', detail: 'manages the profile' },
    { id: 'mom', name: 'Mom', role: 'Caregiver', detail: 'can add observations' },
    { id: 'dad', name: 'Dad', role: 'Caregiver', detail: 'can add observations' },
  ];
}

function emptyPetWorkspace(ownerName: string): PetWorkspace {
  return {
    contexts: [],
    observations: [],
    drafts: [],
    visibility: null,
    askMessages: [],
    careMembers: defaultCareMembers(ownerName),
    careEvent: null,
  };
}

function currentLegacyWorkspace(ownerName: string): PetWorkspace {
  return {
    contexts: readSavedContexts(),
    observations: readStoryObservations(),
    drafts: readStoryDrafts(),
    visibility: readStoryVisibility(),
    askMessages: readAskMessages(),
    careMembers: readCareMembers() ?? defaultCareMembers(ownerName),
    careEvent: readCareEvent(),
  };
}

function normalizeWorkspace(value: unknown, ownerName: string): PetWorkspace {
  const fallback = emptyPetWorkspace(ownerName);
  if (typeof value !== 'object' || value === null) return fallback;
  const workspace = value as Partial<PetWorkspace>;
  return {
    contexts: Array.isArray(workspace.contexts) ? workspace.contexts : [],
    observations: Array.isArray(workspace.observations) ? workspace.observations : [],
    drafts: Array.isArray(workspace.drafts) ? workspace.drafts : [],
    visibility: workspace.visibility === null || (Array.isArray(workspace.visibility) && workspace.visibility.every((id) => typeof id === 'string')) ? workspace.visibility : null,
    askMessages: Array.isArray(workspace.askMessages) ? workspace.askMessages : [],
    careMembers: Array.isArray(workspace.careMembers) ? workspace.careMembers : fallback.careMembers,
    careEvent: typeof workspace.careEvent === 'object' ? workspace.careEvent ?? null : null,
  };
}

function createInitialPrototypeSession(): PrototypeSession {
  const ownerName = readStorageString('pawsona-owner-name', 'Emily');
  const petName = readStorageString('pawsona-pet-name', 'Luna');
  const accountId = 'account-primary';
  const petId = 'pet-primary';
  return {
    activeAccountId: accountId,
    accounts: [{
      id: accountId,
      name: ownerName,
      email: `${ownerName.toLowerCase().replace(/[^a-z0-9]+/g, '.') || 'owner'}@pawsona.local`,
      role: readStorageString('pawsona-owner-role', 'Primary caregiver'),
      avatar: readStorageString('pawsona-owner-avatar', ''),
      preference: readStorageString('pawsona-owner-preference', 'Manage your profile details here.'),
      activePetId: petId,
      pets: [{
        id: petId,
        name: petName,
        breed: readStorageString('pawsona-pet-breed', 'Golden Retriever'),
        age: readStorageString('pawsona-pet-age', '3'),
        avatar: readStorageString('pawsona-pet-avatar', ''),
        hasDemoMoments: true,
        workspace: currentLegacyWorkspace(ownerName),
      }],
    }],
  };
}

function readPrototypeSession(): PrototypeSession {
  try {
    const value = localStorage.getItem(prototypeSessionKey);
    if (!value) return createInitialPrototypeSession();
    const parsed = JSON.parse(value) as Partial<PrototypeSession>;
    if (!Array.isArray(parsed.accounts)) return createInitialPrototypeSession();
    const accounts = parsed.accounts.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) return [];
      const account = entry as Partial<PrototypeAccount>;
      if (typeof account.id !== 'string' || typeof account.name !== 'string' || typeof account.email !== 'string' || !Array.isArray(account.pets)) return [];
      const accountName = account.name;
      const pets = account.pets.flatMap((petEntry) => {
        if (typeof petEntry !== 'object' || petEntry === null) return [];
        const pet = petEntry as Partial<PrototypePet>;
        if (typeof pet.id !== 'string' || typeof pet.name !== 'string') return [];
        return [{
          id: pet.id,
          name: pet.name,
          breed: typeof pet.breed === 'string' ? pet.breed : 'Mixed breed',
          age: typeof pet.age === 'string' ? pet.age : '1',
          avatar: typeof pet.avatar === 'string' ? pet.avatar : '',
          hasDemoMoments: typeof pet.hasDemoMoments === 'boolean' ? pet.hasDemoMoments : pet.id === 'pet-primary',
          workspace: normalizeWorkspace(pet.workspace, accountName),
        }];
      });
      if (!pets.length) return [];
      return [{
        id: account.id,
        name: account.name,
        email: account.email,
        role: typeof account.role === 'string' ? account.role : 'Primary caregiver',
        avatar: typeof account.avatar === 'string' ? account.avatar : '',
        preference: typeof account.preference === 'string' ? account.preference : 'Manage your profile details here.',
        pets,
        activePetId: pets.some((pet) => pet.id === account.activePetId) ? account.activePetId as string : pets[0].id,
      }];
    });
    return {
      accounts,
      activeAccountId: accounts.some((account) => account.id === parsed.activeAccountId) ? parsed.activeAccountId as string : null,
    };
  } catch {
    return createInitialPrototypeSession();
  }
}

function persistPrototypeSession(session: PrototypeSession) {
  localStorage.setItem(prototypeSessionKey, JSON.stringify(session));
}

function writeLegacyWorkspace(workspace: PetWorkspace) {
  localStorage.setItem(storageKey, JSON.stringify(workspace.contexts));
  localStorage.setItem('pawsona-story-observations-v1', JSON.stringify(workspace.observations));
  localStorage.setItem(storyDraftsKey, JSON.stringify(workspace.drafts));
  localStorage.setItem(askMessagesKey, JSON.stringify(workspace.askMessages));
  localStorage.setItem(careMembersKey, JSON.stringify(workspace.careMembers));
  if (workspace.visibility === null) localStorage.removeItem(storyVisibilityKey);
  else localStorage.setItem(storyVisibilityKey, JSON.stringify(workspace.visibility));
  if (workspace.careEvent === null) localStorage.removeItem(careEventKey);
  else localStorage.setItem(careEventKey, JSON.stringify(workspace.careEvent));
}

function writeLegacyProfiles(account: PrototypeAccount, pet: PrototypePet) {
  localStorage.setItem('pawsona-owner-name', account.name);
  localStorage.setItem('pawsona-owner-role', account.role);
  localStorage.setItem('pawsona-owner-avatar', account.avatar);
  localStorage.setItem('pawsona-owner-preference', account.preference);
  localStorage.setItem('pawsona-pet-name', pet.name);
  localStorage.setItem('pawsona-pet-breed', pet.breed);
  localStorage.setItem('pawsona-pet-age', pet.age);
  localStorage.setItem('pawsona-pet-avatar', pet.avatar);
}

function AskPage({ onEvidence, onContext, onPetsNavigate, petName, petAvatar, messages, messageEndRef, hasDemoMoments }: { onEvidence: () => void; onContext: () => void; onPetsNavigate: () => void; petName: string; petAvatar: string; messages: AskMessage[]; messageEndRef: RefObject<HTMLDivElement | null>; hasDemoMoments: boolean }) {
  return (
    <div className="ask-page">
      <MainHeader eyebrow="ASK AI · OBSERVATION DIALOGUE" title="Ask Pawsona" onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} />
      <p className="ask-prototype-notice" role="note">Prototype mode · replies are simulated. No AI backend is connected yet.</p>
      {hasDemoMoments && <div className="linked-evidence ask-status"><span className="loading-ring" /><span><strong>Reviewing afternoon rest</strong><small>Linked to Today’s Story · 2 clips + your note</small></span></div>}
      <section className="ask-thread" aria-label="Conversation with Pawsona">
        {hasDemoMoments ? <><article className="chat-message ai">{petName} rested longer this afternoon than in the recent clips available. I can’t tell why—or know exactly how {petName} felt. Would you like to check the evidence or add what happened at home?<button className="text-link" onClick={onEvidence}>View evidence →</button></article><article className="chat-message owner">My family had visitors today. {petName} often settles down after that.</article><article className="chat-message ai">Would you like to add this as owner context? You can review the clips before anything is saved.<div className="chat-choices"><button onClick={onContext}>Yes</button><button onClick={onEvidence}>No</button></div></article></> : messages.length === 0 && <article className="chat-message ai">Ask a question or share context after you add moments for {petName}. Prototype replies are simulated and saved only in this pet profile.</article>}
        {messages.map((message, index) => message.role === 'user'
          ? <article className="chat-message owner" key={`user-${index}`}>{message.attachment && (message.attachment.kind === 'audio' ? <audio className="chat-attachment-audio" src={message.attachment.url} controls aria-label={message.attachment.name} /> : <img className="chat-attachment" src={message.attachment.url} alt={message.attachment.name} />)}{message.text && <span>{message.text}</span>}</article>
          : <article className="chat-message ai dynamic-answer" key={`assistant-${index}`}>{message.text}{hasDemoMoments && <button className="text-link" onClick={onEvidence}>View linked evidence →</button>}</article>)}
        <div ref={messageEndRef} />
      </section>
    </div>
  );
}

function AskComposer({ value, onValue, onSend, onQuickContext, saveError }: { value: string; onValue: (value: string) => void; onSend: (attachment?: AskAttachment) => boolean; onQuickContext: (value: string) => void; saveError: string }) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [attachment, setAttachment] = useState<AskAttachment | undefined>();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');

  useEffect(() => () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      recorder.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function replaceAttachment(next: AskAttachment) {
    setAttachment(next);
    setRecordingError('');
    onValue(value);
  }

  function attachFile(file: File | undefined, kind: AskAttachment['kind']) {
    if (!file) return;
    const expectedType = kind === 'image' ? 'image/' : 'audio/';
    if (!file.type.startsWith(expectedType)) {
      setRecordingError(kind === 'image' ? 'Choose an image file.' : 'Choose an audio file.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setRecordingError('Choose a file smaller than 1 MB so this conversation can be saved.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setRecordingError('This attachment could not be read. Please try another one.');
        return;
      }
      replaceAttachment({ url: reader.result, name: file.name, kind, type: file.type });
    };
    reader.onerror = () => setRecordingError('This attachment could not be read. Please try another one.');
    reader.readAsDataURL(file);
  }

  function stopMediaStream() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('Live recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      const preferredType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setRecordingError('The recording could not be completed. Choose an audio file instead.');
        setIsRecording(false);
        stopMediaStream();
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || preferredType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type });
        if (blob.size) {
          const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
          if (blob.size > 1024 * 1024) {
            setRecordingError('This recording is too large to save. Record a shorter voice note.');
          } else {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') replaceAttachment({ url: reader.result, name: `voice-note.${extension}`, kind: 'audio', type });
              else setRecordingError('This recording could not be read. Please try again.');
            };
            reader.onerror = () => setRecordingError('This recording could not be read. Please try again.');
            reader.readAsDataURL(blob);
          }
        } else {
          setRecordingError('No audio was captured. Please try again.');
        }
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);
        stopMediaStream();
      };
      recorder.start();
      setRecordingError('');
      setIsRecording(true);
    } catch {
      setRecordingError('Microphone access was not available. Choose an audio file instead.');
      setIsRecording(false);
      stopMediaStream();
    }
  }

  function removeAttachment() {
    setAttachment(undefined);
    onValue(value);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (audioInputRef.current) audioInputRef.current.value = '';
  }
  function send() {
    if (isRecording) return;
    if (!onSend(attachment)) return;
    setAttachment(undefined);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (audioInputRef.current) audioInputRef.current.value = '';
  }
  const hasComposerNotice = Boolean(attachment || isRecording || recordingError || saveError);
  return (
    <section className={`ask-dock${hasComposerNotice ? ' has-attachment' : ''}`} aria-label="Ask Pawsona a question">
      <div className="quick-context-label">Quick context</div>
      <div className="quick-chips">
        <button onClick={() => onQuickContext('Food changed')}>Food changed</button>
        <button onClick={() => onQuickContext('Routine changed')}>Routine changed</button>
        <button onClick={() => onQuickContext('Not sure yet')}>Not sure yet</button>
      </div>
      <div className={`ask-input-box${hasComposerNotice ? ' has-attachment' : ''}`}>
        {isRecording && <div className="ask-recording-status" role="status"><span aria-hidden="true" />Recording… tap the microphone to stop</div>}
        {!isRecording && attachment && !saveError && <div className="ask-attachment-preview"><div className={`ask-attachment-tile ${attachment.kind}`}>{attachment.kind === 'audio' ? <audio src={attachment.url} controls aria-label={attachment.name} /> : <img src={attachment.url} alt={attachment.name} />}<button type="button" aria-label={`Remove ${attachment.kind} attachment`} onClick={removeAttachment}>×</button></div></div>}
        {!isRecording && (recordingError || saveError) && <div className="ask-recording-error" role="alert"><span>{recordingError || saveError}</span>{saveError && attachment ? <button type="button" onClick={removeAttachment}>Remove attachment</button> : recordingError && <button type="button" onClick={() => audioInputRef.current?.click()}>Choose audio file</button>}</div>}
        <textarea aria-label="What would you like to ask Pawsona?" placeholder="What would you like to know?" value={value} onChange={(event) => onValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !isRecording) { event.preventDefault(); send(); } }} />
        <div className="ask-input-tools">
          <button aria-label="Attach an image" disabled={isRecording} onClick={() => imageInputRef.current?.click()}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="m5 17 5-5 3 3 2-2 5 5" /></svg></button>
          <button aria-label="Add context" onClick={() => onQuickContext('Please include this context: ')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 6-6 6 6 6M16 6l6 6-6 6" /></svg></button>
          <button className={isRecording ? 'is-recording' : ''} aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'} aria-pressed={isRecording} onClick={toggleRecording}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" /></svg></button>
          <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { attachFile(event.target.files?.[0], 'image'); event.currentTarget.value = ''; }} />
          <input ref={audioInputRef} type="file" accept="audio/*" capture hidden onChange={(event) => { attachFile(event.target.files?.[0], 'audio'); event.currentTarget.value = ''; }} />
          <button className="ask-send-button" aria-label="Send message" disabled={isRecording || (!value.trim() && !attachment)} onClick={send}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg></button>
        </div>
      </div>
    </section>
  );
}

function AccountAccessPage({ accounts, error, onSignIn, onRegister, onDelete }: { accounts: PrototypeAccount[]; error: string; onSignIn: (id: string) => void; onRegister: (name: string, email: string, petName: string) => string; onDelete: (id: string) => string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [petName, setPetName] = useState('');
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PrototypeAccount | null>(null);

  function register(event: FormEvent) {
    event.preventDefault();
    setFormError(onRegister(name.trim(), email.trim(), petName.trim()));
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    setFormError(onDelete(pendingDelete.id));
    setPendingDelete(null);
  }

  return <section className="account-access-page">
    <div className="account-brand"><span className="account-brand-mark">♥</span><p className="eyebrow">PAWSONA PROTOTYPE</p><h1>Welcome back</h1><p>Your locally saved accounts and pet spaces stay on this device.</p></div>
    {accounts.length > 0 && <section className="account-access-section"><h2>Continue with a saved account</h2><div className="account-choice-list">{accounts.map((account) => <div className="account-choice-row" key={account.id}><button className="account-choice-button" onClick={() => onSignIn(account.id)}><OwnerAvatar src={account.avatar} name={account.name} /><span><strong>{account.name}</strong><small>{account.email}</small></span><i>›</i></button><button className="account-delete-button" aria-label={`Delete ${account.name} account`} onClick={() => { setFormError(''); setPendingDelete(account); }}>Delete</button></div>)}</div></section>}
    <form className="account-register-card" onSubmit={register}>
      <div><h2>Create an account</h2><small>Prototype only · no password or cloud account is created.</small></div>
      <label><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="e.g. Anna" /></label>
      <label><span>Email</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="anna@example.com" /></label>
      <label><span>First pet</span><input value={petName} onChange={(event) => setPetName(event.target.value)} placeholder="e.g. Coco" /></label>
      {(formError || error) && <p className="account-form-error" role="alert">{formError || error}</p>}
      <button className="primary-button full" disabled={!name.trim() || !email.trim() || !petName.trim()}>Create local account</button>
    </form>
    {pendingDelete && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title" onClick={(event) => event.stopPropagation()}><h2 id="delete-account-title">Delete {pendingDelete.name}?</h2><p>This permanently removes this local account and every pet, timeline, Story, context and Ask AI conversation saved inside it. Other accounts will not be changed.</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-button" onClick={confirmDelete}>Delete account</button></div></section></div>}
  </section>;
}

function AccountSwitcher({ accounts, activeAccountId, onClose, onSwitch, onRegister, onRequestSignOut }: { accounts: PrototypeAccount[]; activeAccountId: string; onClose: () => void; onSwitch: (id: string) => void; onRegister: (name: string, email: string, petName: string) => string; onRequestSignOut: () => void }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [petName, setPetName] = useState('');
  const [error, setError] = useState('');

  function register(event: FormEvent) {
    event.preventDefault();
    const nextError = onRegister(name.trim(), email.trim(), petName.trim());
    setError(nextError);
    if (!nextError) onClose();
  }

  return <div className="profile-dialog-backdrop" role="presentation" onClick={onClose}><section className="profile-dialog switcher-dialog" role="dialog" aria-modal="true" aria-labelledby="account-switcher-title" onClick={(event) => event.stopPropagation()}><button className="profile-dialog-close" aria-label="Close" onClick={onClose}>×</button><h2 id="account-switcher-title">Accounts</h2><p>Switching accounts also switches its saved pet spaces.</p><div className="switcher-list">{accounts.map((account) => <button key={account.id} className={account.id === activeAccountId ? 'selected' : ''} onClick={() => { if (account.id !== activeAccountId) onSwitch(account.id); onClose(); }}><OwnerAvatar src={account.avatar} name={account.name} /><span><strong>{account.name}</strong><small>{account.email}</small></span><em>{account.id === activeAccountId ? 'Current' : 'Switch'}</em></button>)}</div>{creating ? <form className="switcher-form" onSubmit={register}><label><span>Your name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span>First pet</span><input value={petName} onChange={(event) => setPetName(event.target.value)} /></label>{error && <p className="account-form-error" role="alert">{error}</p>}<div className="member-removal-actions"><button type="button" className="cancel-button" onClick={() => { setCreating(false); setError(''); }}>Cancel</button><button className="primary-button" disabled={!name.trim() || !email.trim() || !petName.trim()}>Create</button></div></form> : <><button className="cancel-button full" onClick={() => setCreating(true)}>Create another account</button><button className="account-signout-link" onClick={onRequestSignOut}>Sign out of this account</button></>}</section></div>;
}

function PetSwitcher({ pets, activePetId, onClose, onSwitch, onAdd, onDelete }: { pets: PrototypePet[]; activePetId: string; onClose: () => void; onSwitch: (id: string) => void; onAdd: (name: string, breed: string, age: string) => string; onDelete: (id: string) => string }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('1');
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PrototypePet | null>(null);

  function add(event: FormEvent) {
    event.preventDefault();
    const nextError = onAdd(name.trim(), breed.trim(), age.trim());
    setError(nextError);
    if (!nextError) onClose();
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const nextError = onDelete(pendingDelete.id);
    setError(nextError);
    if (!nextError) onClose();
    setPendingDelete(null);
  }

  return <div className="profile-dialog-backdrop" role="presentation" onClick={onClose}><section className="profile-dialog switcher-dialog" role="dialog" aria-modal="true" aria-labelledby="pet-switcher-title" onClick={(event) => event.stopPropagation()}><button className="profile-dialog-close" aria-label="Close" onClick={onClose}>×</button><h2 id="pet-switcher-title">Pet profiles</h2><p>Choose which pet’s Today, Story and context you want to view.</p><div className="switcher-list pet-switcher-list">{pets.map((pet) => <div key={pet.id} className={`pet-switcher-row ${pet.id === activePetId ? 'selected' : ''}`}><button className="pet-switcher-choice" onClick={() => { if (pet.id !== activePetId) onSwitch(pet.id); onClose(); }}><Avatar name={pet.name} src={pet.avatar} /><span><strong>{pet.name}</strong><small>{pet.breed} · {formatPetAge(pet.age)}</small></span><em>{pet.id === activePetId ? 'Current' : 'Switch'}</em></button><button className="pet-profile-delete" disabled={pets.length === 1} aria-label={pets.length === 1 ? `${pet.name} is the only pet and cannot be deleted` : `Delete ${pet.name}`} title={pets.length === 1 ? 'Add another pet before deleting this one' : `Delete ${pet.name}`} onClick={() => { setError(''); setPendingDelete(pet); }}>Delete</button></div>)}</div>{pets.length === 1 && <p className="pet-delete-help">Add another pet before deleting this profile.</p>}{error && !adding && <p className="account-form-error" role="alert">{error}</p>}{adding ? <form className="switcher-form" onSubmit={add}><label><span>Pet name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Breed</span><input value={breed} onChange={(event) => setBreed(event.target.value)} placeholder="Mixed breed" /></label><label><span>Age</span><input type="number" min="0" max="40" value={age} onChange={(event) => setAge(event.target.value)} /></label>{error && <p className="account-form-error" role="alert">{error}</p>}<div className="member-removal-actions"><button type="button" className="cancel-button" onClick={() => { setAdding(false); setError(''); }}>Cancel</button><button className="primary-button" disabled={!name.trim() || !breed.trim() || !age.trim()}>Add pet</button></div></form> : <button className="cancel-button full" onClick={() => setAdding(true)}>Add another pet</button>}{pendingDelete && <div className="nested-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}><section className="profile-dialog member-removal-dialog pet-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-pet-title" onClick={(event) => event.stopPropagation()}><h2 id="delete-pet-title">Delete {pendingDelete.name}?</h2><p>This permanently removes this pet profile and its timeline, Story, context and Ask AI history from this device. Other pets will not be changed.</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-button" onClick={confirmDelete}>Delete pet</button></div></section></div>}</section></div>;
}

function SimplePage({ kind, petName, petAvatar, petBreed, petAge, ownerName, ownerRole = 'Primary caregiver', ownerAvatar = '', ownerPreference = 'Manage your profile details here.', pets, activePetId, onPetsNavigate, onSettingsNavigate, onPetEdit, onProfileEdit, onPetSwitcher, onAction, careMembers, primaryMemberId, onMemberClick, onCareMembers, onPatternHistory, onCareEvent }: { kind: 'pets' | 'you'; petName: string; petAvatar: string; petBreed: string; petAge: string; ownerName: string; ownerRole?: string; ownerAvatar?: string; ownerPreference?: string; pets: PrototypePet[]; activePetId: string; onPetsNavigate: () => void; onSettingsNavigate: () => void; onPetEdit: () => void; onProfileEdit: () => void; onPetSwitcher: () => void; onAction: (title: string, detail: string) => void; careMembers: CareMember[]; primaryMemberId: string; onMemberClick: (id: string) => void; onCareMembers: () => void; onPatternHistory: () => void; onCareEvent: () => void }) {
  const isPrimaryCaregiver = primaryMemberId === 'emily';
  const petDetailsLabel = `${petBreed} · ${formatPetAge(petAge)}`;
  return kind === 'pets' ? (
    <div className="profile-page pets-page">
      <MainHeader eyebrow="PET PROFILE" title="Pet profile" onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} />
      <section className="pet-profile-hero">
        <Avatar name={petName} src={petAvatar} />
        <div className="profile-hero-copy"><strong>{petName}</strong><small>{petDetailsLabel}</small><div className="pet-hero-actions"><button className="mini-action" onClick={onPetEdit}><span>✎</span> Edit details</button><button className="mini-action" onClick={onPetSwitcher}>⇄ Switch pet</button></div></div>
      </section>

      <section className="profile-section care-section">
        <h2>Who looks after {petName}?</h2>
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
          <button className="knowledge-row" onClick={() => onAction('Likes the rope toy', 'Added by a caregiver.')}><span className="knowledge-icon">♥</span><span><strong>Likes the rope toy</strong><small>Added by a caregiver</small></span><i>›</i></button>
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
      <MainHeader eyebrow="YOUR SPACE" title="My Profile" onPetsNavigate={onPetsNavigate} onSettingsNavigate={onSettingsNavigate} petName={petName} petAvatar={petAvatar} />
      <button className="account-profile-hero" onClick={onProfileEdit}>
        <OwnerAvatar src={ownerAvatar} name={ownerName} className="account-avatar" />
        <span className="profile-hero-copy"><strong>{ownerName}</strong><small>{ownerPreference}</small><span className="mini-action"><b>✎</b> Edit my profile</span></span>
      </button>

      <section className="profile-section you-section">
        <div className="profile-section-heading"><h2>My pets</h2><button className="profile-link" onClick={onPetSwitcher}>Switch or add →</button></div>
        <div className="profile-card you-list pets-list">
          {pets.map((pet) => <button className="you-row" key={pet.id} onClick={() => pet.id === activePetId ? onPetEdit() : onPetSwitcher()}><Avatar name={pet.name} src={pet.avatar} /><span><strong>{pet.name}</strong><small>{pet.breed} · {formatPetAge(pet.age)}</small></span><em>{pet.id === activePetId ? 'Active' : 'Switch'}</em></button>)}
        </div>
      </section>

      <section className="profile-section you-section media-section">
        <div className="profile-section-heading"><h2>Connected media</h2><button className="profile-link" onClick={() => onAction('Add source', 'Choose a photo album or connect a supported camera source.')}>Add source +</button></div>
        <div className="profile-card you-list media-list">
          <button className="media-row" onClick={() => onAction('Selected photo album', 'Only the album you chose is connected.')}><span className="media-icon">▦</span><span><strong>Selected photo album</strong><small>Only the album you chose</small></span><em className="connected">Connected</em></button>
          <button className="media-row" onClick={() => onAction('Home camera', 'Only the living room camera you chose is connected.')}><span className="media-icon">◉</span><span><strong>Home camera</strong><small>Living room camera only</small></span><em className="connected">Connected</em></button>
          <button className="media-row" onClick={() => onAction('Smart feeder', 'Equipment can be added when you are ready to connect it.')}><span className="media-icon">◇</span><span><strong>Smart feeder</strong><small>Equipment can be added</small></span><em className="not-connected">Not linked</em></button>
        </div>
      </section>

    </div>
  );
}

function SettingsHubPage({ accounts, activeAccountId, onBack, onSwitchAccount, onRegister, onSignOut, onAction }: { accounts: PrototypeAccount[]; activeAccountId: string; onBack: () => void; onSwitchAccount: (id: string) => void; onRegister: (name: string, email: string, petName: string) => string; onSignOut: () => void; onAction: (title: string, detail: string) => void }) {
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPetName, setNewPetName] = useState('');
  const [createError, setCreateError] = useState('');

  function createAccount(event: FormEvent) {
    event.preventDefault();
    const error = onRegister(newName.trim(), newEmail.trim(), newPetName.trim());
    setCreateError(error);
    if (!error) setCreatingAccount(false);
  }
  const orderedAccounts = [...accounts].sort((a, b) => Number(b.id === activeAccountId) - Number(a.id === activeAccountId));

  return <section className="settings-hub-page">
    <header className="settings-hub-header"><button className="back-button" aria-label="Go back" onClick={onBack}>←</button><h1>Settings</h1></header>
    <div className="settings-hub-content">
      <section className="settings-hub-section"><h2>Account</h2><div className="profile-card settings-account-list">
        {orderedAccounts.map((account) => <button key={account.id} className={`settings-account-row ${account.id === activeAccountId ? 'current' : ''}`} aria-current={account.id === activeAccountId ? 'true' : undefined} onClick={() => { if (account.id !== activeAccountId) onSwitchAccount(account.id); }}><OwnerAvatar src={account.avatar} name={account.name} /><span><strong>{account.name}</strong><small>{account.email}</small></span><em>{account.id === activeAccountId ? 'Current' : 'Switch'}</em></button>)}
        {!creatingAccount ? <button className="settings-create-account" onClick={() => { setCreateError(''); setCreatingAccount(true); }}>＋ Create another account</button> : <form className="settings-create-form" onSubmit={createAccount}>
        <label><span>Your name</span><input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} /></label>
        <label><span>Email</span><input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label>
        <label><span>First pet</span><input value={newPetName} onChange={(event) => setNewPetName(event.target.value)} /></label>
        {createError && <p className="account-form-error" role="alert">{createError}</p>}
        <div className="member-removal-actions"><button type="button" className="cancel-button" onClick={() => setCreatingAccount(false)}>Cancel</button><button className="primary-button" disabled={!newName.trim() || !newEmail.trim() || !newPetName.trim()}>Create account</button></div>
        </form>}
      </div>
      <button className="settings-signout-row" onClick={onSignOut}><span className="settings-signout-icon" aria-hidden="true">↪</span><span><strong>Sign out</strong><small>Your local data will stay on this device</small></span><i>›</i></button></section>
      <section className="settings-hub-section"><div className="profile-section-heading"><h2>Privacy &amp; support</h2><button className="profile-link" onClick={() => onAction('Privacy & support', 'Review data permissions, sharing, retention and accessibility preferences.')}>Open →</button></div><div className="profile-card you-list privacy-list">
        <button className="media-row" onClick={() => onAction('Data, sharing & retention', 'Review permissions, access and deletion.')}><span className="media-icon">▤</span><span><strong>Data, sharing &amp; retention</strong><small>Review permissions, access and deletion</small></span><i>›</i></button>
        <button className="media-row" onClick={() => onAction('Accessibility & feedback', 'Text size, captions, help and suggestions.')}><span className="media-icon">◎</span><span><strong>Accessibility &amp; feedback</strong><small>Text size, captions, help and suggestions</small></span><i>›</i></button>
      </div></section>
    </div>
  </section>;
}

function SettingsPage({ kind, initialName, initialBreed = 'Golden Retriever', initialAge = '3', initialAvatar = '', initialPreference = 'Manage your profile details here.', onBack, onSaved, onPetSaved, onProfileSaved }: { kind: 'petDetails' | 'profile'; initialName: string; initialBreed?: string; initialAge?: string; initialAvatar?: string; initialPreference?: string; onBack: () => void; onSaved: (name: string) => void; onPetSaved?: (profile: { name: string; breed: string; age: string; avatar: string }) => void; onProfileSaved?: (profile: { name: string; avatar: string; preference: string }) => void }) {
  const pet = kind === 'petDetails';
  const [name, setName] = useState(initialName);
  const [breed, setBreed] = useState(initialBreed);
  const [age, setAge] = useState(initialAge);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [preference, setPreference] = useState(initialPreference);
  const nameIsEmpty = name.trim().length === 0;
  const breedIsEmpty = breed.trim().length === 0;
  const numericAge = Number(age);
  const ageIsInvalid = age.trim().length === 0 || !Number.isInteger(numericAge) || numericAge < 0 || numericAge > 40;
  const saveDisabled = nameIsEmpty || (pet && (breedIsEmpty || ageIsInvalid));
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  function save() {
    const nextName = name.trim();
    const nextBreed = breed.trim();
    const nextAge = age.trim();
    try {
      localStorage.setItem(pet ? 'pawsona-pet-name' : 'pawsona-owner-name', nextName);
      if (pet) {
        localStorage.setItem('pawsona-pet-breed', nextBreed);
        localStorage.setItem('pawsona-pet-age', nextAge);
        localStorage.setItem('pawsona-pet-avatar', avatar);
      } else {
        localStorage.setItem('pawsona-owner-avatar', avatar);
        localStorage.setItem('pawsona-owner-preference', preference);
      }
    } catch { setSaveFailed(true); return; }
    onSaved(nextName);
    if (pet) {
      onPetSaved?.({ name: nextName, breed: nextBreed, age: nextAge, avatar });
      onBack();
    } else {
      onProfileSaved?.({ name: nextName, avatar, preference });
      onBack();
    }
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
        <button className="back-button" aria-label={pet ? 'Back to Pets' : 'Back to You'} onClick={onBack}>←</button>
        <h1>{pet ? `${name || 'Luna'}’s details` : 'My profile'}</h1>
      </header>
      <p className="settings-eyebrow">{pet ? 'PET PROFILE' : 'YOUR SPACE'}</p>
      <section className="settings-summary profile-summary">
        <label className="profile-avatar-upload" aria-label={pet ? 'Upload pet photo' : 'Upload profile photo'}>
          {pet ? <img className="profile-edit-avatar pet-edit-avatar" src={avatar || asset('luna-avatar.png')} alt={name || 'Pet'} /> : <OwnerAvatar src={avatar} name={name} className="profile-edit-avatar" />}
          <span className="avatar-edit-badge" aria-hidden="true">✎</span>
          <input type="file" accept="image/*" aria-label={pet ? 'Choose pet photo' : 'Choose profile photo'} onChange={(event) => readAvatar(event.target.files?.[0])} />
        </label>
        <div className="profile-summary-copy">
        <strong>{pet ? name || 'Luna' : name || 'Emily'}</strong>
        <p>{pet ? `Keep the details that help carers recognise ${name || 'this pet'}.` : preference}</p>
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
          <label className="settings-field"><strong>Breed</strong><input value={breed} onChange={(event) => { setBreed(event.target.value); setSaved(false); }} aria-label="Pet breed" /></label>
          <label className={`settings-field${ageIsInvalid ? ' has-error' : ''}`}><strong>Age</strong><input type="number" min="0" max="40" step="1" value={age} onChange={(event) => { setAge(event.target.value); setSaved(false); }} aria-label="Pet age in years" aria-invalid={ageIsInvalid} />{ageIsInvalid && <small className="settings-validation" role="alert">Enter a whole number from 0 to 40.</small>}</label>
        </> : <>
          <label className="settings-field profile-preference-field"><strong>Preferences</strong><input value={preference} onChange={(event) => { setPreference(event.target.value); setSaved(false); }} aria-label="Preferences" /></label>
        </>}
      </div>
      <div className="settings-action">
        <button className="primary-button full" onClick={save} disabled={saveDisabled}>{pet ? 'Save details' : 'Save profile'}</button>
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

function PetSecondaryPage({ kind, petName, ownerName, ownerRole = 'Primary caregiver', ownerAvatar = '', careMembers, primaryMemberId, isPrimaryCaregiver, onBack, onReviewEvidence, onSaveEvent, onMemberClick, onRemoveMember, onAddMember }: { kind: 'careMembers' | 'patternHistory' | 'careEvent'; petName: string; ownerName: string; ownerRole?: string; ownerAvatar?: string; careMembers: CareMember[]; primaryMemberId: string; isPrimaryCaregiver: boolean; onBack: () => void; onReviewEvidence: () => void; onSaveEvent: (event: CareEvent) => boolean; onMemberClick: (id: string) => void; onRemoveMember: (id: string) => void; onAddMember: (name: string, role: string) => void }) {
  const [eventType, setEventType] = useState('Routine change');
  const [when, setWhen] = useState('Today');
  const [customDate, setCustomDate] = useState('');
  const [note, setNote] = useState('');
  const [openPicker, setOpenPicker] = useState<'type' | 'when' | null>(null);
  const [savedEvent, setSavedEvent] = useState(false);
  const [eventSaveError, setEventSaveError] = useState('');
  const [lastSavedEvent, setLastSavedEvent] = useState<CareEvent | null>(readCareEvent);
  const [openMemberMenu, setOpenMemberMenu] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<CareMember | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Caregiver');
  const isCareMembers = kind === 'careMembers';
  const isPatternHistory = kind === 'patternHistory';
  const careMemberCount = careMembers.length;
  const careMemberCountLabel = careMemberCount === 1 ? 'One person' : `${careMemberCount} people`;
  const title = isCareMembers ? `Who cares for ${petName}?` : isPatternHistory ? 'Typical patterns' : 'Life & care event';
  const eyebrow = isCareMembers ? 'SHARED CARE' : isPatternHistory ? 'OWNER-CONFIRMED KNOWLEDGE' : 'OWNER RECORD';
  const summaryTitle = isCareMembers ? 'Care circle' : isPatternHistory ? 'Patterns over time' : `Add context to ${petName}’s life`;
  const summaryNote = isCareMembers ? `${careMemberCountLabel} can add context to ${petName}’s day.` : isPatternHistory ? 'Compare observations by time period and source.' : 'Your note stays attributed to you.';

  function chooseField(which: 'type' | 'when', value: string) {
    if (which === 'type') setEventType(value); else setWhen(value);
    setOpenPicker(null);
    setSavedEvent(false);
    setEventSaveError('');
  }

  return (
    <section className="settings-page pet-subpage">
      <header className="settings-header">
        <button className="back-button" aria-label="Back to pet profile" onClick={onBack}>←</button>
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
        <article className="settings-field"><strong>Rope toy play</strong><p>Added by a caregiver</p></article>
      </div> : <div className="care-event-details">
        <div className="event-picker-wrap">
          <button className="settings-field event-picker" aria-expanded={openPicker === 'type'} onClick={() => setOpenPicker(openPicker === 'type' ? null : 'type')}><strong>Event type</strong><span>{eventType}</span></button>
          {openPicker === 'type' && <div className="event-picker-menu" role="listbox" aria-label="Event type">{['Routine change', 'Life-stage change', 'Health & care', 'Care handover'].map((option) => <button key={option} role="option" aria-selected={eventType === option} onClick={() => chooseField('type', option)}>{option}</button>)}</div>}
        </div>
        <div className="event-picker-wrap">
          <button className="settings-field event-picker" aria-expanded={openPicker === 'when'} onClick={() => setOpenPicker(openPicker === 'when' ? null : 'when')}><strong>When</strong><span>{when}</span></button>
          {openPicker === 'when' && <div className="event-picker-menu" role="listbox" aria-label="When">{['Today', 'Yesterday', 'This week', 'Choose a date'].map((option) => <button key={option} role="option" aria-selected={when === option} onClick={() => chooseField('when', option)}>{option}</button>)}</div>}
        </div>
        {when === 'Choose a date' && (
          <label className="settings-field event-date-field">
            <strong>Date</strong>
            <input
              type="date"
              value={customDate}
              onChange={(event) => {
                setCustomDate(event.target.value);
                setSavedEvent(false);
              }}
            />
          </label>
        )}
        <label className="settings-field event-note-field"><strong>What changed?</strong><textarea aria-label="What changed?" placeholder="Write what happened and why it may matter." value={note} onChange={(event) => { setNote(event.target.value); setSavedEvent(false); setEventSaveError(''); }} /></label>
        {lastSavedEvent && (
          <section className="settings-field saved-care-event">
            <strong>Last saved event</strong>
            <p>
              {lastSavedEvent.type} · {lastSavedEvent.when}
            </p>
            <small>{lastSavedEvent.note}</small>
          </section>
        )}
      </div>}
      {!isCareMembers && <div className="settings-action">
        <button className="primary-button full" disabled={!isPatternHistory && (!note.trim() || (when === 'Choose a date' && !customDate))} onClick={isPatternHistory ? onReviewEvidence : () => { const nextEvent: CareEvent = { type: eventType, when: when === 'Choose a date' ? customDate : when, note: note.trim(), }; if (onSaveEvent(nextEvent)) { setLastSavedEvent(nextEvent); setSavedEvent(true); setEventSaveError(''); } else { setSavedEvent(false); setEventSaveError('This care event could not be saved on this device. Please free some browser storage and try again.'); } }}>{isPatternHistory ? 'Review recent evidence' : savedEvent ? 'Event saved' : 'Save event'}</button>
        {savedEvent && <p role="status">Your care event has been saved.</p>}
        {eventSaveError && <p className="inline-save-error" role="alert">{eventSaveError}</p>}
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
    <header className="settings-header"><button className="back-button" aria-label="Back to pet profile" onClick={onBack}>←</button><h1>Account details</h1></header>
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
    <header className="settings-header"><button className="back-button" aria-label="Back to pet profile" onClick={onBack}>←</button><h1>Account details</h1></header>
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
  const [prototypeSession, setPrototypeSession] = useState<PrototypeSession>(readPrototypeSession);
  const [view, setView] = useState<View>('today');
  const [petName, setPetName] = useState(() => readStorageString('pawsona-pet-name', 'Luna'));
  const [petAvatar, setPetAvatar] = useState(() => readStorageString('pawsona-pet-avatar', ''));
  const [petBreed, setPetBreed] = useState(() => readStorageString('pawsona-pet-breed', 'Golden Retriever'));
  const [petAge, setPetAge] = useState(() => {
    const storedAge = readStorageString('pawsona-pet-age', '3');
    const numericAge = Number(storedAge);
    return Number.isInteger(numericAge) && numericAge >= 0 && numericAge <= 40 ? storedAge : '3';
  });
  const [ownerName, setOwnerName] = useState(() => readStorageString('pawsona-owner-name', 'Emily'));
  const [ownerRole, setOwnerRole] = useState(() => readStorageString('pawsona-owner-role', 'Primary caregiver'));
  const [ownerAvatar, setOwnerAvatar] = useState(() => readStorageString('pawsona-owner-avatar', ''));
  const [ownerPreference, setOwnerPreference] = useState(() => readStorageString('pawsona-owner-preference', 'Manage your profile details here.'));
  const [profileSaveNotice, setProfileSaveNotice] = useState('');
  const [contextSavedNotice, setContextSavedNotice] = useState(false);
  const [storyDraftSavedNotice, setStoryDraftSavedNotice] = useState(false);
  const [savedContexts, setSavedContexts] = useState<OwnerContext[]>(readSavedContexts);
  const [storyObservations, setStoryObservations] = useState<StoryObservation[]>(readStoryObservations);
  const [storyDrafts, setStoryDrafts] = useState<StoryDraft[]>(readStoryDrafts);
  const [includedStoryMoments, setIncludedStoryMoments] = useState<string[] | null>(readStoryVisibility);
  const [editingStoryObservationId, setEditingStoryObservationId] = useState<string | null>(null);
  const [activeStoryDraftId, setActiveStoryDraftId] = useState<string | null>(null);
  const [showStoryAddOptions, setShowStoryAddOptions] = useState(false);
  const [draftMoments, setDraftMoments] = useState<string[]>([]);
  const [draftUploadedMedia, setDraftUploadedMedia] = useState<StoryMedia | null>(null);
  const [draftObservationTitle, setDraftObservationTitle] = useState('');
  const [draftMomentAt, setDraftMomentAt] = useState(() => toLocalDateTimeInput(new Date()));
  const [draftRelatedPhotos, setDraftRelatedPhotos] = useState<StoryMedia[]>([]);
  const [draftObservation, setDraftObservation] = useState('');
  const [draftObservationContext, setDraftObservationContext] = useState('');
  const [draftPrivateRecord, setDraftPrivateRecord] = useState(false);
  const [selectedMomentId, setSelectedMomentId] = useState('window');
  const [editingContextId, setEditingContextId] = useState<string | null>(null);
  const [lastSavedContextId, setLastSavedContextId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [interpretation, setInterpretation] = useState<Interpretation>('normal');
  const [contextAttachments, setContextAttachments] = useState<ContextAttachment[]>([]);
  const [contextSaveError, setContextSaveError] = useState('');
  const [storySaveError, setStorySaveError] = useState('');
  const [profileAction, setProfileAction] = useState<{ title: string; detail: string } | null>(null);
  const [careMembers, setCareMembers] = useState<CareMember[]>(() =>
    readCareMembers() ?? [
    { id: 'emily', name: ownerName, role: 'Primary owner', detail: 'manages the profile' },
    { id: 'mom', name: 'Mom', role: 'Caregiver', detail: 'can add observations' },
    { id: 'dad', name: 'Dad', role: 'Caregiver', detail: 'can add observations' },
  ]);
  const primaryMemberId = ownerRole === 'Primary caregiver' ? 'emily' : '';
  const [selectedCareMemberId, setSelectedCareMemberId] = useState('emily');
  const [askInput, setAskInput] = useState('');
  const [askMessages, setAskMessages] = useState<AskMessage[]>(readAskMessages);
  const [askSaveError, setAskSaveError] = useState('');
  const [accountActionError, setAccountActionError] = useState('');
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showPetSwitcher, setShowPetSwitcher] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const askEndRef = useRef<HTMLDivElement>(null);
  const navigationHistory = useRef<View[]>([]);
  const contextReturnView = useRef<View>('momentDetail');
  const activeAccount = prototypeSession.accounts.find((account) => account.id === prototypeSession.activeAccountId) ?? null;
  const activePetRecord = activeAccount?.pets.find((pet) => pet.id === activeAccount.activePetId) ?? activeAccount?.pets[0] ?? null;

  function workspaceFromState(): PetWorkspace {
    return {
      contexts: savedContexts,
      observations: storyObservations,
      drafts: storyDrafts,
      visibility: includedStoryMoments,
      askMessages,
      careMembers,
      careEvent: readCareEvent(),
    };
  }

  function captureCurrentSpace(session: PrototypeSession): PrototypeSession {
    if (!session.activeAccountId) return session;
    return {
      ...session,
      accounts: session.accounts.map((account) => {
        if (account.id !== session.activeAccountId) return account;
        return {
          ...account,
          name: ownerName,
          role: ownerRole,
          avatar: ownerAvatar,
          preference: ownerPreference,
          pets: account.pets.map((pet) => pet.id === account.activePetId ? {
            ...pet,
            name: petName,
            breed: petBreed,
            age: petAge,
            avatar: petAvatar,
            workspace: workspaceFromState(),
          } : pet),
        };
      }),
    };
  }

  function applyAccountSpace(session: PrototypeSession, accountId: string, petId: string): string {
    const account = session.accounts.find((entry) => entry.id === accountId);
    const pet = account?.pets.find((entry) => entry.id === petId);
    if (!account || !pet) return 'That saved profile is no longer available.';
    const nextSession: PrototypeSession = {
      ...session,
      activeAccountId: account.id,
      accounts: session.accounts.map((entry) => entry.id === account.id ? { ...entry, activePetId: pet.id } : entry),
    };
    try {
      writeLegacyProfiles(account, pet);
      writeLegacyWorkspace(pet.workspace);
      persistPrototypeSession(nextSession);
    } catch {
      const previousAccount = session.accounts.find((entry) => entry.id === session.activeAccountId);
      const previousPet = previousAccount?.pets.find((entry) => entry.id === previousAccount.activePetId);
      if (previousAccount && previousPet) {
        try {
          writeLegacyProfiles(previousAccount, previousPet);
          writeLegacyWorkspace(previousPet.workspace);
        } catch {
          /* The caller will keep the current in-memory space active. */
        }
      }
      return 'This profile could not be opened because browser storage is unavailable.';
    }
    setPrototypeSession(nextSession);
    setOwnerName(account.name);
    setOwnerRole(account.role);
    setOwnerAvatar(account.avatar);
    setOwnerPreference(account.preference);
    setPetName(pet.name);
    setPetBreed(pet.breed);
    setPetAge(pet.age);
    setPetAvatar(pet.avatar);
    setSavedContexts(pet.workspace.contexts);
    setStoryObservations(pet.workspace.observations);
    setStoryDrafts(pet.workspace.drafts);
    setIncludedStoryMoments(pet.workspace.visibility);
    setAskMessages(pet.workspace.askMessages);
    setCareMembers(pet.workspace.careMembers);
    setEditingStoryObservationId(null);
    setActiveStoryDraftId(null);
    setEditingContextId(null);
    setLastSavedContextId(null);
    setSelectedMomentId('window');
    setAskInput('');
    setAccountActionError('');
    navigationHistory.current = [];
    setView('today');
    return '';
  }

  function switchAccount(accountId: string) {
    const captured = captureCurrentSpace(prototypeSession);
    const account = captured.accounts.find((entry) => entry.id === accountId);
    const error = account ? applyAccountSpace(captured, account.id, account.activePetId) : 'That saved account is no longer available.';
    setAccountActionError(error);
  }

  function registerAccount(name: string, email: string, firstPetName: string): string {
    const normalizedEmail = email.trim().toLowerCase();
    if (!name || !firstPetName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return 'Enter a name, a valid email and your pet’s name.';
    const captured = captureCurrentSpace(prototypeSession);
    if (captured.accounts.some((account) => account.email.toLowerCase() === normalizedEmail)) return 'An account with this email is already saved on this device.';
    const stamp = Date.now();
    const accountId = `account-${stamp}`;
    const petId = `pet-${stamp}`;
    const account: PrototypeAccount = {
      id: accountId,
      name,
      email: normalizedEmail,
      role: 'Primary caregiver',
      avatar: '',
      preference: 'Manage your profile details here.',
      activePetId: petId,
      pets: [{ id: petId, name: firstPetName, breed: 'Mixed breed', age: '1', avatar: '', hasDemoMoments: false, workspace: emptyPetWorkspace(name) }],
    };
    return applyAccountSpace({ ...captured, accounts: [...captured.accounts, account] }, accountId, petId);
  }

  function deleteSavedAccount(accountId: string): string {
    if (!prototypeSession.accounts.some((account) => account.id === accountId)) return 'That saved account is no longer available.';
    const next: PrototypeSession = {
      ...prototypeSession,
      activeAccountId: prototypeSession.activeAccountId === accountId ? null : prototypeSession.activeAccountId,
      accounts: prototypeSession.accounts.filter((account) => account.id !== accountId),
    };
    try {
      persistPrototypeSession(next);
    } catch {
      return 'This account could not be deleted because browser storage is unavailable.';
    }
    setPrototypeSession(next);
    setAccountActionError('');
    return '';
  }

  function switchPet(petId: string) {
    if (!activeAccount) return;
    const captured = captureCurrentSpace(prototypeSession);
    const error = applyAccountSpace(captured, activeAccount.id, petId);
    setAccountActionError(error);
  }

  function addPet(name: string, breed: string, age: string): string {
    if (!activeAccount) return 'Sign in before adding a pet.';
    const numericAge = Number(age);
    if (!name || !breed || !Number.isInteger(numericAge) || numericAge < 0 || numericAge > 40) return 'Enter a name, breed and an age from 0 to 40.';
    const captured = captureCurrentSpace(prototypeSession);
    const petId = `pet-${Date.now()}`;
    const next = {
      ...captured,
      accounts: captured.accounts.map((account) => account.id === activeAccount.id ? {
        ...account,
        activePetId: petId,
        pets: [...account.pets, { id: petId, name, breed, age, avatar: '', hasDemoMoments: false, workspace: emptyPetWorkspace(account.name) }],
      } : account),
    };
    return applyAccountSpace(next, activeAccount.id, petId);
  }

  function deletePet(petId: string): string {
    if (!activeAccount) return 'Sign in before deleting a pet.';
    const captured = captureCurrentSpace(prototypeSession);
    const account = captured.accounts.find((entry) => entry.id === activeAccount.id);
    if (!account) return 'That account is no longer available.';
    if (account.pets.length <= 1) return 'Add another pet before deleting this profile.';
    if (!account.pets.some((pet) => pet.id === petId)) return 'That pet profile is no longer available.';
    const remainingPets = account.pets.filter((pet) => pet.id !== petId);
    const nextPetId = account.activePetId === petId ? remainingPets[0].id : account.activePetId;
    const next: PrototypeSession = {
      ...captured,
      accounts: captured.accounts.map((entry) => entry.id === account.id ? {
        ...entry,
        pets: remainingPets,
        activePetId: nextPetId,
      } : entry),
    };
    if (account.activePetId === petId) return applyAccountSpace(next, account.id, nextPetId);
    try {
      persistPrototypeSession(next);
    } catch {
      return 'This pet could not be deleted because browser storage is unavailable.';
    }
    setPrototypeSession(next);
    return '';
  }

  function signOut() {
    const captured = captureCurrentSpace(prototypeSession);
    const next = { ...captured, activeAccountId: null };
    try {
      persistPrototypeSession(next);
    } catch {
      setAccountActionError('Could not sign out because browser storage is unavailable.');
      return;
    }
    setPrototypeSession(next);
    setShowAccountSwitcher(false);
    setShowSignOutConfirm(false);
    navigationHistory.current = [];
    setView('today');
  }

  function updateActivePetRecord(profile: { name: string; breed: string; age: string; avatar: string }) {
    setPrototypeSession((current) => {
      if (!current.activeAccountId) return current;
      const next = {
        ...current,
        accounts: current.accounts.map((account) => account.id === current.activeAccountId ? {
          ...account,
          pets: account.pets.map((pet) => pet.id === account.activePetId ? { ...pet, ...profile } : pet),
        } : account),
      };
      try { persistPrototypeSession(next); } catch { setAccountActionError('Pet details were saved, but the account index could not be updated.'); }
      return next;
    });
  }

  function updateActiveAccountRecord(profile: { name: string; avatar: string; preference: string }) {
    setPrototypeSession((current) => {
      if (!current.activeAccountId) return current;
      const next = {
        ...current,
        accounts: current.accounts.map((account) => account.id === current.activeAccountId ? { ...account, ...profile } : account),
      };
      try { persistPrototypeSession(next); } catch { setAccountActionError('Profile details were saved, but the account index could not be updated.'); }
      return next;
    });
  }

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
    try {
      persistPrototypeSession(prototypeSession);
    } catch {
      setAccountActionError('Account changes could not be saved on this device.');
    }
  }, [prototypeSession]);

  useEffect(() => {
    if (!profileSaveNotice) return;
    const timer = window.setTimeout(() => setProfileSaveNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [profileSaveNotice]);

  useEffect(() => {
    if (!contextSavedNotice) return;
    const timer = window.setTimeout(() => setContextSavedNotice(false), 2000);
    return () => window.clearTimeout(timer);
  }, [contextSavedNotice]);

  useEffect(() => {
    if (!storyDraftSavedNotice) return;
    const timer = window.setTimeout(() => setStoryDraftSavedNotice(false), 2000);
    return () => window.clearTimeout(timer);
  }, [storyDraftSavedNotice]);

  useEffect(() => {
    if (view === 'ask' && askMessages.length && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [askMessages, view]);

  const selectedMoment = resolveMoment(selectedMomentId, storyObservations);
  const selectedMomentContexts = savedContexts.filter((context) => context.momentId === selectedMomentId);
  const lastSavedContext = savedContexts.find((context) => context.id === lastSavedContextId) ?? null;

  function startContextForMoment(momentId: string, existing?: OwnerContext) {
    const target = resolveMoment(momentId, storyObservations);
    contextReturnView.current = view;
    setSelectedMomentId(target.id);
    setEditingContextId(existing?.id ?? null);
    setNote(existing?.note ?? '');
    setInterpretation(existing?.interpretation ?? 'normal');
    setContextAttachments(existing?.attachments ?? []);
    setContextSaveError('');
    navigateTo('context');
  }

  function openMomentDetail(momentId: string) {
    setSelectedMomentId(momentId);
    navigateTo('momentDetail');
  }

  function saveContext() {
    const nextContext: OwnerContext = { id: editingContextId ?? `owner-context-${Date.now()}`, momentId: selectedMoment.id, momentTitle: selectedMoment.title, momentImage: selectedMoment.image, note: note.trim(), interpretation, savedAt: new Date().toISOString(), attachments: contextAttachments };
    const next = [nextContext, ...savedContexts.filter((entry) => entry.id !== nextContext.id)];
    setContextSaveError('');
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setContextSaveError('Your correction could not be saved on this device. Remove a large attachment or free some browser storage, then try again.');
      return;
    }
    setSavedContexts(next);
    setEditingContextId(null);
    setLastSavedContextId(nextContext.id);
    setContextSavedNotice(true);
    navigationHistory.current.pop();
    navigationHistory.current.pop();
    setView(contextReturnView.current);
  }

  function undoContext(contextId: string) {
    const next = savedContexts.filter((context) => context.id !== contextId);
    setSavedContexts(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Local state still works. */ }
    setLastSavedContextId(null);
    navigateTo('undone');
  }

  function deleteOwnerContext(contextId: string): boolean {
    const next = savedContexts.filter((context) => context.id !== contextId);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      return false;
    }
    setSavedContexts(next);
    if (lastSavedContextId === contextId) setLastSavedContextId(null);
    return true;
  }

  function startStoryObservation() {
    setStorySaveError('');
    setEditingStoryObservationId(null);
    setActiveStoryDraftId(null);
    setDraftMoments([]);
    setDraftUploadedMedia(null);
    setDraftObservationTitle('');
    setDraftMomentAt(toLocalDateTimeInput(new Date()));
    setDraftRelatedPhotos([]);
    setDraftObservation('');
    setDraftObservationContext('');
    setDraftPrivateRecord(false);
    navigateTo('addMoments');
  }

  function cancelStoryObservation() {
    const isUntouchedNewObservation =
      activeStoryDraftId === null &&
      editingStoryObservationId === null &&
      draftObservation === '' &&
      draftObservationTitle === '' &&
      draftObservationContext === '' &&
      !draftPrivateRecord &&
      draftUploadedMedia === null &&
      draftRelatedPhotos.length === 0 &&
      draftMoments.length === 0;

    const returnView: View = view === 'addSaved' && draftPrivateRecord ? 'today' : 'story';
    if (
      view !== 'addSaved' &&
      !isUntouchedNewObservation &&
      (draftObservation.trim() || draftObservationTitle.trim() || draftMoments.length || draftRelatedPhotos.length)
    ) {
      const draft: StoryDraft = { id: activeStoryDraftId ?? `story-draft-${Date.now()}`, selectedMoments: draftMoments, note: draftObservation, title: draftObservationTitle, momentAt: draftMomentAt, relatedPhotos: draftRelatedPhotos, context: draftObservationContext, savedAt: new Date().toISOString(), privateRecord: draftPrivateRecord, uploadedMedia: draftUploadedMedia ?? undefined };
      setStoryDrafts((current) => {
        const next = [draft, ...current.filter((entry) => entry.id !== draft.id)];
        try { localStorage.setItem(storyDraftsKey, JSON.stringify(next)); } catch { /* Keep the draft for this session. */ }
        return next;
      });
      setStoryDraftSavedNotice(true);
    }
    setActiveStoryDraftId(null);
    setEditingStoryObservationId(null);
    navigationHistory.current = navigationHistory.current.filter((previous) => !(['addMoments', 'addCompose', 'addPreview', 'addSaved', 'storyEdit'] as View[]).includes(previous));
    setView(returnView);
  }

  function saveStoryObservation() {
    setStorySaveError('');
    const selected = momentChoices.filter((moment) => draftMoments.includes(moment.id));
    const selectedNotes = getNoteChoices(petName).filter((entry) => draftMoments.includes(entry.id));
    const uploadedSelected = Boolean(draftUploadedMedia && draftMoments.includes('uploaded'));
    const existing = storyObservations.find((entry) => entry.id === editingStoryObservationId);
    const generatedTitle = selected[0]?.title ?? (uploadedSelected ? `A moment with ${petName}` : titleFromObservation(selectedNotes[0]?.text ?? draftObservation));
    const title = draftObservationTitle.trim() || generatedTitle;
    const observation: StoryObservation = {
      id: existing?.id ?? `story-observation-${Date.now()}`,
      note: draftObservation.trim(),
      title,
      image: uploadedSelected && draftUploadedMedia ? draftUploadedMedia.url : asset(selected[0]?.image ?? 'story-window.png'),
      mediaType: uploadedSelected ? draftUploadedMedia?.type : undefined,
      relatedPhotos: draftRelatedPhotos,
      momentCount: selected.length + selectedNotes.length + (uploadedSelected ? 1 : 0),
      momentIds: draftMoments,
      sourceNotes: selectedNotes,
      context: draftObservationContext,
      privateRecord: draftPrivateRecord,
      savedAt: draftMomentAt ? new Date(draftMomentAt).toISOString() : new Date().toISOString(),
    };
    const next = [observation, ...storyObservations.filter((entry) => entry.id !== observation.id)];
    let nextDrafts: StoryDraft[] | null = null;
    if (draftPrivateRecord) {
      const draft: StoryDraft = { id: activeStoryDraftId ?? `story-draft-${Date.now()}`, selectedMoments: draftMoments, note: draftObservation, title: draftObservationTitle, momentAt: draftMomentAt, relatedPhotos: draftRelatedPhotos, context: draftObservationContext, savedAt: new Date().toISOString(), privateRecord: true, uploadedMedia: draftUploadedMedia ?? undefined };
      nextDrafts = [draft, ...storyDrafts.filter((entry) => entry.id !== draft.id)];
    } else if (activeStoryDraftId) {
      nextDrafts = storyDrafts.filter((entry) => entry.id !== activeStoryDraftId);
    }
    try {
      localStorage.setItem('pawsona-story-observations-v1', JSON.stringify(next));
      if (nextDrafts) localStorage.setItem(storyDraftsKey, JSON.stringify(nextDrafts));
    } catch {
      setStorySaveError('This observation could not be saved on this device. Remove a large photo or video, then try again.');
      return;
    }
    setStoryObservations(next);
    if (nextDrafts) setStoryDrafts(nextDrafts);
    setActiveStoryDraftId(null);
    setIncludedStoryMoments((current) => current ? [observation.id, ...current] : null);
    navigateTo('addSaved');
  }

  function sendAskMessage(attachment?: AskAttachment): boolean {
    const text = askInput.trim();
    if (!text && !attachment) return false;
    const next: AskMessage[] = [...askMessages, { role: 'user', text, attachment }, { role: 'assistant', text: 'Thanks for sharing. I’ll keep that in context. Would you like to review the linked observations together?' }];
    try {
      localStorage.setItem(askMessagesKey, JSON.stringify(next));
    } catch {
      setAskSaveError('This message could not be saved on this device. Remove the attachment or free some browser storage, then try again.');
      return false;
    }
    setAskMessages(next);
    setAskInput('');
    setAskSaveError('');
    return true;
  }

  const mainView = (['today', 'story', 'ask', 'pets', 'you'] as View[]).includes(view);
  const activeNav: View = view === 'petDetails' ? 'pets' : view === 'profile' ? 'you' : mainView ? view : 'today';
  const isPrimaryCaregiver = ownerRole === 'Primary caregiver' && primaryMemberId === 'emily';
  const selectedCareMember = careMembers.find((member) => member.id === selectedCareMemberId) ?? careMembers[0];
  function openCareMember(id: string) {
    setSelectedCareMemberId(id);
    navigateTo('memberDetails');
  }
  function updateOwnerRole(role: string) {
    try { localStorage.setItem('pawsona-owner-role', role); } catch { /* Keep this selection active for the current session. */ }
    setOwnerRole(role);
    setPrototypeSession((current) => {
      if (!current.activeAccountId) return current;
      const next = { ...current, accounts: current.accounts.map((account) => account.id === current.activeAccountId ? { ...account, role } : account) };
      try { persistPrototypeSession(next); } catch { setAccountActionError('The role changed for this session, but could not be saved.'); }
      return next;
    });
  }
  function editStoryRow(row: StoryEditRow) {
    const existing = storyObservations.find((entry) => entry.id === row.id);
    setEditingStoryObservationId(existing?.id ?? null);
    setDraftMoments(existing?.momentIds ?? (existing ? [] : [row.id]));
    setDraftUploadedMedia(existing?.mediaType ? { name: 'Uploaded media', type: existing.mediaType, url: existing.image } : null);
    setDraftObservation(existing?.note ?? row.note ?? '');
    setDraftObservationTitle(existing?.title ?? row.title);
    setDraftMomentAt(toLocalDateTimeInput(existing ? new Date(existing.savedAt) : new Date()));
    setDraftRelatedPhotos(existing?.relatedPhotos ?? []);
    setDraftObservationContext(existing?.context ?? '');
    setDraftPrivateRecord(false);
    navigateTo('addCompose');
  }
  function resumeStoryDraft(draft: StoryDraft) {
    setActiveStoryDraftId(draft.id);
    setEditingStoryObservationId(null);
    setDraftMoments(draft.selectedMoments.slice(0, 1));
    setDraftUploadedMedia(draft.uploadedMedia ?? null);
    setDraftObservation(draft.note);
    setDraftObservationTitle(draft.title ?? '');
    setDraftMomentAt(draft.momentAt ?? toLocalDateTimeInput(new Date()));
    setDraftRelatedPhotos(draft.relatedPhotos ?? []);
    setDraftObservationContext(draft.context);
    setDraftPrivateRecord(Boolean(draft.privateRecord));
    navigateTo('addCompose');
  }
  function deleteStoryDraft(id: string): boolean {
    const next = storyDrafts.filter((draft) => draft.id !== id);
    try {
      localStorage.setItem(storyDraftsKey, JSON.stringify(next));
    } catch {
      return false;
    }
    setStoryDrafts(next);
    if (activeStoryDraftId === id) setActiveStoryDraftId(null);
    return true;
  }
  function deleteStoryRow(id: string) {
    if (!id.startsWith('story-observation-')) return;
    setStoryObservations((current) => {
      const next = current.filter((entry) => entry.id !== id);
      try { localStorage.setItem('pawsona-story-observations-v1', JSON.stringify(next)); } catch { /* Keep the deletion active for this session. */ }
      return next;
    });
  }
  function deleteStoryMoment(id: string): string {
    const isObservation = storyObservations.some((entry) => entry.id === id);
    const defaultVisibleIds = [
      ...storyObservations.filter((entry) => !entry.privateRecord).map((entry) => entry.id),
      ...(activePetRecord?.hasDemoMoments ? ['breakfast', 'window', 'toy'] : []),
    ];
    const nextVisibility = (includedStoryMoments ?? defaultVisibleIds).filter((momentId) => momentId !== id);
    const nextObservations = isObservation ? storyObservations.filter((entry) => entry.id !== id) : storyObservations;
    const nextContexts = isObservation ? savedContexts.filter((entry) => entry.momentId !== id) : savedContexts;
    try {
      localStorage.setItem(storyVisibilityKey, JSON.stringify(nextVisibility));
      if (isObservation) {
        localStorage.setItem('pawsona-story-observations-v1', JSON.stringify(nextObservations));
        localStorage.setItem(storageKey, JSON.stringify(nextContexts));
      }
    } catch {
      return 'This moment could not be deleted from this device. Please try again.';
    }
    setIncludedStoryMoments(nextVisibility);
    if (isObservation) {
      setStoryObservations(nextObservations);
      setSavedContexts(nextContexts);
    }
    return '';
  }
  function navigate(view: View) {
    navigateTo(view);
  }

  if (!activeAccount || !activePetRecord) {
    return <div className="app-stage"><div className="phone"><main className="screen-scroll account-access-scroll"><StatusBar /><AccountAccessPage accounts={prototypeSession.accounts} error={accountActionError} onSignIn={switchAccount} onRegister={registerAccount} onDelete={deleteSavedAccount} /></main></div></div>;
  }

  return (
    <div className="app-stage">
      <div className="phone">
        <main ref={scrollRef} className={`screen-scroll ${view === 'today' ? 'home-screen' : ''} ${view.startsWith('add') ? 'add-flow-scroll' : ''}`}>
          <StatusBar />
          <div className={`screen-content ${mainView ? 'main-content' : 'detail-content'} ${view === 'ask' ? 'ask-content' : ''} ${view.startsWith('add') ? 'add-flow-content' : ''}`}>
            {view === 'today' && <TodayPage petName={petName} petAvatar={petAvatar} hasDemoMoments={activePetRecord.hasDemoMoments} onStory={() => navigateTo('story')} onMoment={openMomentDetail} onEvidence={() => navigateTo('overview')} onPetsNavigate={() => navigateTo('pets')} saved={savedContexts.find((context) => context.momentId === 'window') ?? null} />}
            {view === 'story' && <StoryPage onMoment={openMomentDetail} onEditStory={() => navigateTo('storyEdit')} onEditMoment={(item) => editStoryRow({ id: item.id, image: item.image, mediaType: item.mediaType, title: item.title, meta: `${item.time} · story moment`, note: item.note })} onDeleteMoment={deleteStoryMoment} onPetsNavigate={() => navigateTo('pets')} petName={petName} petAvatar={petAvatar} ownerName={ownerName} contexts={savedContexts} observations={storyObservations} includedMoments={includedStoryMoments} hasDemoMoments={activePetRecord.hasDemoMoments} />}
            {view === 'storyEdit' && <StoryEditPage observations={storyObservations} includedMoments={includedStoryMoments} petName={petName} hasDemoMoments={activePetRecord.hasDemoMoments} onBack={() => goBack('story')} onEdit={editStoryRow} onDelete={deleteStoryRow} onSave={(ids) => { setIncludedStoryMoments(ids);try {
              localStorage.setItem(
                storyVisibilityKey,
                JSON.stringify(ids)
              );
            } catch {
              /* Keep the selection for this session. */
            } navigateTo('story'); }} />}
            {view === 'drafts' && <StoryDraftsPage drafts={storyDrafts} onBack={() => goBack('story')} onResume={resumeStoryDraft} onDelete={deleteStoryDraft} />}
            {view === 'addMoments' && <StoryAddPage step="moments" saveError={storySaveError} onBack={cancelStoryObservation} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} uploadedMedia={draftUploadedMedia} setUploadedMedia={setDraftUploadedMedia} title={draftObservationTitle} setTitle={setDraftObservationTitle} momentAt={draftMomentAt} setMomentAt={setDraftMomentAt} relatedPhotos={draftRelatedPhotos} setRelatedPhotos={setDraftRelatedPhotos} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} petName={petName} ownerName={ownerName} hasDemoMoments={activePetRecord.hasDemoMoments} onSave={saveStoryObservation} onEdit={() => navigateTo('addCompose')} />}
            {view === 'addCompose' && <StoryAddPage step="compose" saveError={storySaveError} onBack={() => goBack('addMoments')} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} uploadedMedia={draftUploadedMedia} setUploadedMedia={setDraftUploadedMedia} title={draftObservationTitle} setTitle={setDraftObservationTitle} momentAt={draftMomentAt} setMomentAt={setDraftMomentAt} relatedPhotos={draftRelatedPhotos} setRelatedPhotos={setDraftRelatedPhotos} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} petName={petName} ownerName={ownerName} hasDemoMoments={activePetRecord.hasDemoMoments} onSave={saveStoryObservation} onEdit={() => navigateTo('addPreview')} />}
            {view === 'addPreview' && <StoryAddPage step="preview" saveError={storySaveError} onBack={() => goBack('addCompose')} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} uploadedMedia={draftUploadedMedia} setUploadedMedia={setDraftUploadedMedia} title={draftObservationTitle} setTitle={setDraftObservationTitle} momentAt={draftMomentAt} setMomentAt={setDraftMomentAt} relatedPhotos={draftRelatedPhotos} setRelatedPhotos={setDraftRelatedPhotos} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} petName={petName} ownerName={ownerName} hasDemoMoments={activePetRecord.hasDemoMoments} onSave={saveStoryObservation} onEdit={() => navigateTo('addCompose')} />}
            {view === 'addSaved' && <StoryAddPage step="saved" saveError={storySaveError} onBack={() => goBack('addPreview')} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} uploadedMedia={draftUploadedMedia} setUploadedMedia={setDraftUploadedMedia} title={draftObservationTitle} setTitle={setDraftObservationTitle} momentAt={draftMomentAt} setMomentAt={setDraftMomentAt} relatedPhotos={draftRelatedPhotos} setRelatedPhotos={setDraftRelatedPhotos} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} petName={petName} ownerName={ownerName} hasDemoMoments={activePetRecord.hasDemoMoments} onSave={saveStoryObservation} onEdit={() => navigateTo('addCompose')} />}
            {view === 'momentDetail' && <MomentDetailPage moment={selectedMoment} contexts={selectedMomentContexts} ownerName={ownerName} ownerAvatar={ownerAvatar} petName={petName} onBack={() => goBack('story')} onAddContext={() => startContextForMoment(selectedMoment.id)} onEditContext={(context) => startContextForMoment(selectedMoment.id, context)} onDeleteContext={deleteOwnerContext} />}
            {view === 'overview' && <OverviewPage onBack={() => goBack('today')} onClip={() => { setSelectedMomentId('window'); navigateTo('clip'); }} saved={savedContexts.find((context) => context.momentId === 'window') ?? null} onSaved={() => openMomentDetail('window')} petName={petName}/>}
            {view === 'clip' && <ClipPage onBack={() => goBack('overview')} onContext={() => startContextForMoment('window')}  petName={petName} ownerName={ownerName} />}
            {view === 'context' && <ContextPage moment={selectedMoment} petName={petName} note={note} setNote={setNote} interpretation={interpretation} setInterpretation={setInterpretation} attachments={contextAttachments} setAttachments={setContextAttachments} onBack={() => goBack('momentDetail')} onReview={() => navigateTo('confirm')} />}
            {view === 'confirm' && <ConfirmPage moment={selectedMoment} note={note} interpretation={interpretation} attachments={contextAttachments} petName={petName} ownerName={ownerName} ownerRole={ownerRole} saveError={contextSaveError} onBack={() => goBack('context')} onSave={saveContext} />}
            {view === 'saved' && lastSavedContext && <SavedPage saved={lastSavedContext} onBack={() => goBack('confirm')} onReturnStory={() => navigateTo('story')} onUndo={() => undoContext(lastSavedContext.id)} onEvidence={() => openMomentDetail(lastSavedContext.momentId)} onEdit={() => startContextForMoment(lastSavedContext.momentId, lastSavedContext)} petName={petName} ownerName={ownerName} />}
            {view === 'undone' && <UndonePage onBack={() => goBack('saved')} onReturnToday={() => navigateTo('today')} onReview={() => navigateTo('overview')} petName={petName} />}
            {view === 'ask' && <AskPage onEvidence={() => navigateTo('overview')} onContext={() => startContextForMoment('window')} onPetsNavigate={() => navigateTo('pets')} petName={petName} petAvatar={petAvatar} messages={askMessages} messageEndRef={askEndRef} hasDemoMoments={activePetRecord.hasDemoMoments} />}
            {(view === 'pets' || view === 'you') && <SimplePage kind={view} petName={petName} petAvatar={petAvatar} petBreed={petBreed} petAge={petAge} ownerName={ownerName} ownerRole={ownerRole} ownerAvatar={ownerAvatar} ownerPreference={ownerPreference} pets={activeAccount.pets} activePetId={activePetRecord.id} onPetsNavigate={() => navigateTo('pets')} onSettingsNavigate={() => navigateTo('settings')} onPetEdit={() => navigateTo('petDetails')} onProfileEdit={() => navigateTo('profile')} onPetSwitcher={() => setShowPetSwitcher(true)} onAction={(title, detail) => setProfileAction({ title, detail })} careMembers={careMembers} primaryMemberId={primaryMemberId} onMemberClick={openCareMember} onCareMembers={() => navigateTo('careMembers')} onPatternHistory={() => navigateTo('patternHistory')} onCareEvent={() => navigateTo('careEvent')} />}
            {view === 'settings' && <SettingsHubPage accounts={prototypeSession.accounts} activeAccountId={activeAccount.id} onBack={() => goBack('you')} onSwitchAccount={switchAccount} onRegister={registerAccount} onSignOut={() => setShowSignOutConfirm(true)} onAction={(title, detail) => setProfileAction({ title, detail })} />}
            {view === 'petDetails' && <SettingsPage kind="petDetails" initialName={petName} initialAvatar={petAvatar} initialBreed={petBreed} initialAge={petAge} onSaved={setPetName} onPetSaved={({ name, breed, age, avatar }) => { setPetName(name); setPetBreed(breed); setPetAge(age); setPetAvatar(avatar); updateActivePetRecord({ name, breed, age, avatar }); setProfileSaveNotice('Pet details saved successfully'); }} onBack={() => goBack('pets')} />}
            {view === 'profile' && <SettingsPage kind="profile" initialName={ownerName} initialAvatar={ownerAvatar} initialPreference={ownerPreference} onSaved={setOwnerName} onProfileSaved={({ name, avatar, preference }) => { setOwnerName(name); setOwnerAvatar(avatar); setOwnerPreference(preference); updateActiveAccountRecord({ name, avatar, preference }); setProfileSaveNotice('Profile saved successfully'); }} onBack={() => goBack('you')} />}
            {view === 'memberDetails' && selectedCareMember && <CareMemberDetailsPage member={selectedCareMember} ownerName={ownerName} ownerRole={ownerRole} ownerAvatar={ownerAvatar} ownerPreference={ownerPreference} onOwnerRoleChange={updateOwnerRole} primaryMemberId={primaryMemberId} petName={petName} onBack={() => goBack('careMembers')} />}
            {(view === 'careMembers' ||
              view === 'patternHistory' ||
              view === 'careEvent') && (
              <PetSecondaryPage
                kind={view}
                petName={petName}
                ownerName={ownerName}
                ownerRole={ownerRole}
                ownerAvatar={ownerAvatar}
                careMembers={careMembers}
                primaryMemberId={primaryMemberId}
                isPrimaryCaregiver={isPrimaryCaregiver}
                onMemberClick={openCareMember}
                onRemoveMember={(id) => {
                  setCareMembers((members) => {
                    const next = members.filter(
                      (member) => member.id !== id
                    );

                    saveCareMembersToStorage(next);
                    return next;
                  });
                }}
                onAddMember={(name, role) => {
                  setCareMembers((members) => {
                    const next = [
                      ...members,
                      {
                        id: `member-${Date.now()}`,
                        name,
                        role,
                        detail: 'can add observations',
                      },
                    ];

                    saveCareMembersToStorage(next);
                    return next;
                  });
                }}
                onBack={() => goBack('pets')}
                onReviewEvidence={() => navigateTo('overview')}
                onSaveEvent={(event) => {
                  try {
                    localStorage.setItem(
                      careEventKey,
                      JSON.stringify(event)
                    );
                    return true;
                  } catch {
                    return false;
                  }
                }}
              />
            )}
          </div>
        </main>
        {view === 'story' && <button className={`floating-add ${showStoryAddOptions ? 'is-open' : ''}`} aria-expanded={showStoryAddOptions} onClick={() => setShowStoryAddOptions((open) => !open)}><span className="add-icon" aria-hidden="true">+</span><span className="add-label">Add</span></button>}
        {view === 'story' && showStoryAddOptions && <div className="story-add-menu-backdrop" role="presentation" onClick={() => setShowStoryAddOptions(false)}><div className="story-add-choices" role="menu" aria-label="Add to Story" onClick={(event) => event.stopPropagation()}><button className="story-add-choice story-add-choice-new" role="menuitem" onClick={() => { setShowStoryAddOptions(false); startStoryObservation(); }}>New moment</button><button className="story-add-choice story-add-choice-drafts" role="menuitem" onClick={() => { setShowStoryAddOptions(false); navigateTo('drafts'); }}>Drafts{storyDrafts.length > 0 ? ` (${storyDrafts.length})` : ''}</button></div></div>}
        {view === 'ask' && <AskComposer value={askInput} onValue={(value) => { setAskInput(value); if (askSaveError) setAskSaveError(''); }} onSend={sendAskMessage} saveError={askSaveError} onQuickContext={(value) => { setAskSaveError(''); setAskInput((current) => current ? `${current} ${value}` : value); }} />}
        {profileAction && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setProfileAction(null)}><section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" onClick={(event) => event.stopPropagation()}><button className="profile-dialog-close" aria-label="Close" onClick={() => setProfileAction(null)}>×</button><h2 id="profile-dialog-title">{profileAction.title}</h2><p>{profileAction.detail}</p><button className="primary-button" onClick={() => setProfileAction(null)}>Done</button></section></div>}
        {showAccountSwitcher && <AccountSwitcher accounts={prototypeSession.accounts} activeAccountId={activeAccount.id} onClose={() => setShowAccountSwitcher(false)} onSwitch={switchAccount} onRegister={registerAccount} onRequestSignOut={() => { setShowAccountSwitcher(false); setShowSignOutConfirm(true); }} />}
        {showPetSwitcher && <PetSwitcher pets={activeAccount.pets} activePetId={activePetRecord.id} onClose={() => setShowPetSwitcher(false)} onSwitch={switchPet} onAdd={addPet} onDelete={deletePet} />}
        {showSignOutConfirm && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setShowSignOutConfirm(false)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="signout-title" onClick={(event) => event.stopPropagation()}><h2 id="signout-title">Sign out of Pawsona?</h2><p>Your accounts, pet profiles and prototype data will remain saved on this device.</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setShowSignOutConfirm(false)}>Cancel</button><button className="danger-button" onClick={signOut}>Sign out</button></div></section></div>}
        {accountActionError && <button className="account-error-toast" role="alert" onClick={() => setAccountActionError('')}>{accountActionError}<span>Dismiss</span></button>}
        {contextSavedNotice && <div className="context-saved-toast" role="status"><span aria-hidden="true">✓</span> Context saved</div>}
        {storyDraftSavedNotice && <div className="context-saved-toast" role="status"><span aria-hidden="true">✓</span> Saved to drafts</div>}
        {profileSaveNotice && <div className="profile-save-toast" role="status">{profileSaveNotice}</div>}
        {mainView && <BottomNav active={activeNav} onNavigate={navigate} />}
      </div>
    </div>
  );
}



