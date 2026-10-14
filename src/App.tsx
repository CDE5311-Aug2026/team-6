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
type StoryObservation = { id: string; note: string; title: string; image: string; mediaType?: string; momentCount: number; momentIds?: string[]; sourceNotes?: StorySourceNote[]; context: string; privateRecord: boolean; savedAt: string };
type StoryDraft = { id: string; selectedMoments: string[]; note: string; context: string; savedAt: string; privateRecord?: boolean; uploadedMedia?: StoryMedia };

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

function Avatar({ name, src = '' }: { name: string; src?: string }) {
  return <img className="avatar" src={src || asset('luna-avatar.png')} alt={name} />;
}

function StoryMediaView({ src, type, alt, controls = false }: { src: string; type?: string; alt: string; controls?: boolean }) {
  return type?.startsWith('video/')
    ? <video src={src} aria-label={alt} controls={controls} muted playsInline preload="metadata" />
    : <img src={src} alt={alt} />;
}

function OwnerAvatar({ src, name, className = '' }: { src: string; name: string; className?: string }) {
  return <span className={`member-avatar emily-avatar owner-avatar ${className}`}>{src ? <img src={src} alt="" /> : name.slice(0, 1).toUpperCase()}</span>;
}

function MainHeader({ eyebrow, title, subtitle, petName, petAvatar = '', onPetsNavigate }: { eyebrow: string; title: string; subtitle?: string; petName: string; petAvatar?: string; onPetsNavigate?: () => void }) {
  return (
    <header className="main-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p className="main-subtitle">{subtitle}</p>}
      </div>
      <button className="header-avatar-button" type="button" aria-label="Open Pets" onClick={onPetsNavigate}><Avatar name={petName} src={petAvatar} /></button>
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

function TodayPage({ onStory, onEvidence, onPetsNavigate, petName, petAvatar, saved }: { onStory: () => void; onEvidence: () => void; onPetsNavigate: () => void; petName: string; petAvatar: string; saved: OwnerContext | null }) {
  return (
    <>
      <MainHeader eyebrow={`A little window into ${petName}’s day.`} title={`Hello, ${petName}!`} subtitle={formatPageDate()} onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} />
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
          <button className="moment-card" onClick={onStory}>
            <img src={asset('toy-chase.png')} alt={`${petName} with a toy on a blue background`} />
            <span className="moment-card-copy"><strong>The toy chase</strong><small>Video · 0:18 · 4:20 PM</small></span>
          </button>
          <button className="moment-card" onClick={onStory}>
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
    </>
  );
}

type StoryTimelineItem = { id: string; time: string; title: string; note: string; image: string; mediaType?: string };

function StoryTimelineRow({ item, menuOpen, onMenuToggle, onView, onEdit, editLabel }: { item: StoryTimelineItem; menuOpen: boolean; onMenuToggle: () => void; onView: () => void; onEdit: () => void; editLabel: string }) {
  return <div className="timeline-row">
    <span className="timeline-time">{item.time.replace(' ', '\n')}</span>
    <div className="timeline-card">
      <button className="timeline-card-main" aria-label={`View details for ${item.title}`} onClick={onView}>
        <StoryMediaView src={item.image} type={item.mediaType} alt="" />
        <span><strong>{item.title}</strong><small>{item.note}</small></span>
      </button>
      <button className="timeline-more" aria-label={`More actions for ${item.title}`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={onMenuToggle}>···</button>
      {menuOpen && <div className="timeline-action-menu" role="menu"><button role="menuitem" onClick={onView}>View details</button><button role="menuitem" onClick={onEdit}>{editLabel}</button></div>}
    </div>
  </div>;
}

function StoryPage({ onEvidence, onEditStory, onEditObservation, onPetsNavigate, petName, petAvatar, ownerName, saved, observations, includedMoments }: { onEvidence: () => void; onEditStory: () => void; onEditObservation: (observation: StoryObservation) => void; onPetsNavigate: () => void; petName: string; petAvatar: string; ownerName: string; saved: OwnerContext | null; observations: StoryObservation[]; includedMoments: string[] | null }) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const moments = [
    { id: 'breakfast', time: '8:10 AM', title: 'Breakfast time', note: 'Observed eating as usual', image: asset('story-breakfast.png') },
    { id: 'window', time: '11:35 AM', title: 'Rest by the window', note: saved ? `${ownerName} added context to this moment` : 'A quiet moment to remember', image: asset('story-window.png') },
    { id: 'toy', time: '4:20 PM', title: 'Favourite toy chase', note: 'One of today’s highlights!', image: asset('story-toy.png') },
  ];
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

  const totalMomentCount =
    todayObservations.length + visibleMoments.length;
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
          {todayObservations.map((observation) => <StoryTimelineRow key={observation.id} item={{ id: observation.id, time: formatObservationTime(observation.savedAt), title: observation.title, note: observation.note, image: observation.image, mediaType: observation.mediaType }} menuOpen={openMenuId === observation.id} onMenuToggle={() => setOpenMenuId(openMenuId === observation.id ? null : observation.id)} onView={() => { setOpenMenuId(null); onEvidence(); }} onEdit={() => { setOpenMenuId(null); onEditObservation(observation); }} editLabel="Edit observation" />)}
          {visibleMoments.map((moment) => <StoryTimelineRow key={moment.id} item={moment} menuOpen={openMenuId === moment.id} onMenuToggle={() => setOpenMenuId(openMenuId === moment.id ? null : moment.id)} onView={() => { setOpenMenuId(null); onEvidence(); }} onEdit={() => { setOpenMenuId(null); onEditStory(); }} editLabel="Edit Story selection" />)}
        </div>
      </section>
      {earlierObservations.length > 0 && <section className="timeline-section earlier-timeline-section"><div className="section-heading"><h2>Earlier moments</h2></div><div className="timeline-list">{earlierObservations.map((observation) => <StoryTimelineRow key={observation.id} item={{ id: observation.id, time: formatObservationTime(observation.savedAt), title: observation.title, note: observation.note, image: observation.image, mediaType: observation.mediaType }} menuOpen={openMenuId === observation.id} onMenuToggle={() => setOpenMenuId(openMenuId === observation.id ? null : observation.id)} onView={() => { setOpenMenuId(null); onEvidence(); }} onEdit={() => { setOpenMenuId(null); onEditObservation(observation); }} editLabel="Edit observation" />)}</div></section>}
      {saved && <button className="story-owner-note" onClick={onEvidence}><strong>{ownerName}’s context · {formatRelativeDate(saved.savedAt)}</strong><span>{saved.note}</span></button>}
      {openMenuId && <button className="timeline-menu-dismiss" aria-label="Close moment actions" onClick={() => setOpenMenuId(null)} />}
    </>
  );
}

type StoryEditRow = { id: string; image: string; mediaType?: string; title: string; meta: string; note?: string; context?: string };

function StoryEditPage({ observations, includedMoments, petName, onBack, onAdd, onSave, onEdit, onDelete }: { observations: StoryObservation[]; includedMoments: string[] | null; petName: string; onBack: () => void; onAdd: () => void; onSave: (ids: string[]) => void; onEdit: (row: StoryEditRow) => void; onDelete: (id: string) => void }) {
  const [included, setIncluded] = useState<string[]>(() =>
    includedMoments
      ? [...includedMoments]
      : [
          ...observations
            .filter((entry) => !entry.privateRecord)
            .map((entry) => entry.id),
          'breakfast',
          'window',
          'toy',
        ]
  );
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const rows: StoryEditRow[] = [
    ...observations.filter((entry) => !entry.privateRecord).map((entry) => ({ id: entry.id, image: entry.image, mediaType: entry.mediaType, title: entry.title, meta: `${formatObservationTime(entry.savedAt)} · written observation`, note: entry.note, context: entry.context })),
    { id: 'breakfast', image: asset('story-breakfast.png'), title: 'Breakfast time', meta: '08:10 · selected clip', note: 'Observed eating as usual' },
    {
      id: 'window',
      image: asset('story-window.png'),
      title: 'Rest by the window',
      meta: '11:35 · selected clip',
      note: 'A quiet moment to remember',
    },
    { id: 'toy', image: asset('story-toy.png'), title: 'Favourite toy chase', meta: '16:20 · selected clip', note: 'One of today’s highlights!' },
  ];
  const clearLongPress = () => { if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current); longPressTimer.current = null; };
  const beginLongPress = (id: string) => { clearLongPress(); longPressTimer.current = window.setTimeout(() => { suppressClick.current = true; setOpenMenuId(id); }, 520); };
  const removeRow = (id: string) => { setRemovedIds((current) => [...current, id]); setIncluded((current) => current.filter((entry) => entry !== id)); setOpenMenuId(null); onDelete(id); };
  return <section className="story-edit-page">
    <header className="story-edit-header"><button className="back-button" aria-label="Go back" onClick={onBack}>←</button><h1>Edit story</h1></header>
    <div className="story-edit-rows">{rows.filter((row) => !removedIds.includes(row.id)).map((row) => <div className="story-edit-item" key={row.id} onPointerDown={() => beginLongPress(row.id)} onPointerUp={clearLongPress} onPointerLeave={clearLongPress} onPointerCancel={clearLongPress} onContextMenu={(event) => { event.preventDefault(); clearLongPress(); suppressClick.current = true; setOpenMenuId(row.id); }}><button type="button" className={`story-edit-row ${included.includes(row.id) ? 'included' : ''}`} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setOpenMenuId(null); setIncluded((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]); }}><StoryMediaView src={row.image} type={row.mediaType} alt="" /><span className="story-edit-row-copy"><strong>{row.title}</strong><small>{row.meta}</small></span><span className="story-edit-check" aria-hidden="true">{included.includes(row.id) ? '✓' : ''}</span></button>{openMenuId === row.id && <div className="story-row-action-bubble" role="menu"><button role="menuitem" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); clearLongPress(); setOpenMenuId(null); suppressClick.current = false; onEdit(row); }}>Edit</button><button role="menuitem" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); clearLongPress(); removeRow(row.id); suppressClick.current = false; }}>Delete</button></div>}</div>)}</div>
    <section className="story-visibility-card"><strong>Story visibility</strong><p>Keep selected moments in {petName}'s Story.<br/>Hidden moments remain in your records.</p><small>Sharing uses only moments you choose.</small></section>
    <button className="story-add-another" onClick={onAdd}>+ Add another observation</button>
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
    {drafts.length ? <div className="story-drafts-list">{drafts.map((draft) => <div className="story-draft-row" key={draft.id}><button className="story-draft-card" onClick={() => onResume(draft)}><strong>{draft.note.trim() ? draft.note : 'Untitled observation'}</strong><span>{draft.privateRecord ? 'Private note' : `${draft.selectedMoments.length} selected ${draft.selectedMoments.length === 1 ? 'moment' : 'moments'}`}{draft.context ? ` · ${draft.context}` : ''}</span><small>Saved {formatObservationTime(draft.savedAt).replace('\n', ' · ')}</small></button><button className="story-draft-delete" aria-label={`Delete draft ${draft.note.trim() || 'Untitled observation'}`} onClick={() => { setDeleteError(''); setPendingDelete(draft); }}>Delete</button></div>)}</div> : <div className="story-drafts-empty">No drafts yet.</div>}
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

function StoryAddPage({ step, onBack, onCancel, selectedMoments, setSelectedMoments, uploadedMedia, setUploadedMedia, note, setNote, context, setContext, privateRecord, setPrivateRecord, observations, petName, ownerName, saveError, onSave, onEdit }: {
  step: 'moments' | 'compose' | 'preview' | 'saved';
  onBack: () => void;
  onCancel: () => void;
  selectedMoments: string[];
  setSelectedMoments: (ids: string[]) => void;
  uploadedMedia: StoryMedia | null;
  setUploadedMedia: (media: StoryMedia | null) => void;
  note: string;
  setNote: (value: string) => void;
  context: string;
  setContext: (value: string) => void;
  privateRecord: boolean;
  setPrivateRecord: (value: boolean) => void;
  observations: StoryObservation[];
  petName: string;
  ownerName: string;
  saveError: string;
  onSave: () => void;
  onEdit: () => void;
}) {
  const [sourceTab, setSourceTab] = useState<'Photos' | 'Clips' | 'Notes'>('Photos');
  const [uploadError, setUploadError] = useState('');
  const latest = observations[0];
  const selected = momentChoices.filter((moment) => selectedMoments.includes(moment.id));
  const noteChoices = getNoteChoices(petName);
  const selectedNotes = noteChoices.filter((entry) => selectedMoments.includes(entry.id));
  const savedSourceNotes = latest?.sourceNotes ?? selectedNotes;
  const uploadedSelected = Boolean(uploadedMedia && selectedMoments.includes('uploaded'));
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
  const observationTitle = latest?.title || (selected.length ? 'A window rest after visitors' : uploadedSelected ? `A new moment with ${petName}` : 'A quiet moment after visitors');
  const cancel = <button className="add-cancel" onClick={onCancel}>Cancel</button>;
  const header = (title: string, eyebrow: string) => <header className="add-flow-header"><div className="add-flow-title"><button className="back-button" aria-label="Go back" onClick={onBack}>←</button><h1>{title}</h1>{cancel}</div><p className="eyebrow">{eyebrow}</p></header>;

  function chooseSourceTab(tab: 'Photos' | 'Clips' | 'Notes') {
    setSourceTab(tab);
    setUploadedMedia(null);
    setUploadError('');
    setSelectedMoments(tab === 'Notes' ? ['note-visitors'] : ['window', 'toy']);
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
      setSelectedMoments([...selectedMoments.filter((id) => id !== 'uploaded'), 'uploaded']);
      setUploadError('');
    };
    reader.onerror = () => setUploadError('This file could not be read. Please try another one.');
    reader.readAsDataURL(file);
  }

  if (step === 'moments') return <div className="add-flow-page">
    {header('Choose moments', '1 OF 3 · SELECT SOURCES')}
    <div className="source-tabs" role="tablist" aria-label="Moment sources">{(['Photos', 'Clips', 'Notes'] as const).map((tab) => <button key={tab} className={sourceTab === tab ? 'active' : ''} role="tab" aria-selected={sourceTab === tab} onClick={() => chooseSourceTab(tab)}>{tab}</button>)}</div>
    <div className={`moment-picker-grid ${sourceTab === 'Notes' ? 'notes-picker-grid' : ''}`}>
      {sourceTab === 'Notes' ? noteChoices.map((entry) => { const chosen = selectedMoments.includes(entry.id); return <button className={`moment-choice note-moment-choice ${chosen ? 'selected' : ''}`} key={entry.id} onClick={() => setSelectedMoments(chosen ? selectedMoments.filter((id) => id !== entry.id) : [...selectedMoments, entry.id])}><span>{entry.text}</span>{chosen && <span className="moment-check">✓</span>}<small>{entry.label}</small></button>; }) : momentChoices.map((moment, index) => { const chosen = selectedMoments.includes(moment.id); const label = sourceTab === 'Clips' ? ['Clip · 0:12', 'Clip · 0:18', 'Clip · 0:08'][index] : `${moment.time} · ${moment.title}`; return <button className={`moment-choice ${chosen ? 'selected' : ''}`} key={moment.id} onClick={() => setSelectedMoments(chosen ? selectedMoments.filter((id) => id !== moment.id) : [...selectedMoments, moment.id])}><img src={asset(moment.image)} alt="" />{chosen && <span className="moment-check">✓</span>}<small>{label}</small></button>; })}
      {sourceTab !== 'Notes' && uploadedSelected && uploadedMedia && <div className="moment-choice uploaded-device-choice selected"><StoryMediaView src={uploadedMedia.url} type={uploadedMedia.type} alt={uploadedMedia.name} /><span className="moment-check">✓</span><button type="button" className="remove-uploaded-media" aria-label={`Remove ${uploadedMedia.name}`} onClick={() => { setUploadedMedia(null); setSelectedMoments(selectedMoments.filter((id) => id !== 'uploaded')); }}>×</button><small>{uploadedMedia.name}</small></div>}
      {sourceTab !== 'Notes' && <label className="moment-choice add-device-choice"><input type="file" accept="image/*,video/*" onChange={(event) => { uploadMedia(event.target.files?.[0]); event.currentTarget.value = ''; }} /><span className="add-device-plus">＋</span><span>{uploadedSelected ? 'Replace photo or video' : 'Add photo or video'}</span></label>}
      {uploadError && <p className="upload-error" role="alert">{uploadError}</p>}
    </div>
    <button className="text-only-option" onClick={() => { setUploadedMedia(null); setSelectedMoments([]); onEdit(); }}><strong>Start with a written observation</strong><span>No photo or clip needed to remember this moment.</span></button>
    <div className="sticky-action"><button className="primary-button full" onClick={onEdit} disabled={!selectedMoments.length}>Continue with {selectedMoments.length} {sourceTab === 'Notes' ? (selectedMoments.length === 1 ? 'note' : 'notes') : sourceTab === 'Clips' ? (selectedMoments.length === 1 ? 'clip' : 'clips') : (selectedMoments.length === 1 ? 'moment' : 'moments')}</button><p>Only what you select will be added.</p></div>
  </div>;

  if (step === 'compose') return <div className="add-flow-page">
    {header('Write a moment', '2 OF 3 · ADD YOUR WORDS')}
    {hasVisual || selectedNotes.length > 0 ? <><div className="compose-section-label"><strong>Selected moments</strong></div>{hasVisual ? <div className="selected-moments-strip">{selected.map((moment) => <img key={moment.id} src={asset(moment.image)} alt={moment.title} />)}{uploadedSelected && uploadedMedia && <StoryMediaView src={uploadedMedia.url} type={uploadedMedia.type} alt={uploadedMedia.name} />}</div> : <div className="selected-note-strip">{selectedNotes.map((entry) => <div key={entry.id}><span>{entry.text}</span><small>{entry.label}</small></div>)}</div>}</> : <><div className="written-observation-mode"><strong>Written observation</strong></div><div className="written-observation-note"><strong>A note is enough</strong><span>You can describe a moment without a photo or camera clip.</span></div></>}
    <label className="observation-writing-card"><strong>What happened with {petName}?</strong><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe what you noticed…" /></label>
    <section className="add-context-choices"><strong>Add context</strong><div>{['Visitors at home', 'Routine changed', 'Not sure yet'].map((item) => <button key={item} className={context === item ? 'active' : ''} onClick={() => setContext(context === item ? '' : item)}>{item}</button>)}</div></section>
    <div className="sticky-action"><button className="primary-button full" onClick={onEdit} disabled={!note.trim()}>Preview observation</button><p>Your note is shown as your own words.</p></div>
  </div>;

  if (step === 'preview') return <div className="add-flow-page">
    {header('Preview', '3 OF 3 · CHECK BEFORE SAVING')}
    <article className={`observation-preview-card ${!hasVisual ? 'note-observation-preview' : ''}`}>{hasVisual ? <StoryMediaView src={image} type={mediaType} alt={petName} controls={mediaType?.startsWith('video/')} /> : <div className="observation-note-visual"><strong>A note from {ownerName}</strong><p>{note || 'A moment with ' + petName + '.'}</p></div>}<div className="observation-preview-copy"><small>{petName} · Today</small><strong>{observationTitle}</strong><p>{note || 'A moment with ' + petName + '.'}</p>{selectedNotes.length > 0 && <div className="preview-source-notes"><strong>Saved note sources</strong>{selectedNotes.map((entry) => <span key={entry.id}>{entry.text}<small>{entry.label}</small></span>)}</div>}<div>{selectedMoments.length} selected {selectedMoments.length === 1 ? 'source' : 'sources'} · {hasVisual ? 'owner observation' : `Written observation · ${ownerName}`}</div><span>Owner-provided context{context ? ` · ${context}` : ''}</span></div></article>
    <section className="observation-destination"><strong>Where this goes</strong><button className={!privateRecord ? 'selected' : ''} onClick={() => setPrivateRecord(false)}><span className="destination-radio">{!privateRecord && <i />}</span>Add to {petName}'s Story</button><button className={privateRecord ? 'selected' : ''} onClick={() => setPrivateRecord(true)}><span className="destination-radio">{privateRecord && <i />}</span>Keep as a private record</button><small>{privateRecord ? 'Only you can see this record until you choose to share it.' : 'You choose which sources and words are saved.'}</small></section>
    {saveError && <p className="inline-save-error" role="alert">{saveError}</p>}
    <div className="sticky-action"><button className="primary-button full" onClick={onSave}>{privateRecord ? 'Save private note' : 'Save observation'}</button>{!privateRecord && <p>Nothing updates {petName}'s baseline automatically.</p>}</div>
  </div>;

  return <div className="add-flow-page">
    {header(privateRecord ? 'Saved privately' : 'Moment saved', privateRecord ? 'SAVED TO PRIVATE RECORDS' : 'ADDED TO ' + petName.toUpperCase() + '’S STORY')}
    <section className="observation-saved-banner"><strong>✓ &nbsp;{privateRecord ? 'Your private note is saved' : 'Your observation is saved'}</strong><span>{privateRecord ? `Visible only to you · Added by ${ownerName}` : `Added by ${ownerName}`} · Today</span></section>
    <article className="observation-preview-card saved-observation-card">{latestHasVisual ? <StoryMediaView src={image} type={mediaType} alt={petName} controls={mediaType?.startsWith('video/')} /> : <div className="observation-note-visual"><strong>A note from {ownerName}</strong><p>{observationText || 'A moment with ' + petName + '.'}</p></div>}<div className="observation-preview-copy"><strong>{observationTitle}</strong><p>{observationText || 'A moment with ' + petName + '.'}</p>{savedSourceNotes.length > 0 && <div className="preview-source-notes"><strong>Saved note sources</strong>{savedSourceNotes.map((entry) => <span key={entry.id}>{entry.text}<small>{entry.label}</small></span>)}</div>}<div>{(latest?.momentCount ?? selectedMoments.length) === 0 ? `Written observation · ${ownerName}` : `${latest?.momentCount ?? selectedMoments.length} selected ${(latest?.momentCount ?? selectedMoments.length) === 1 ? 'source' : 'sources'} · owner observation`}</div><span>{privateRecord ? 'Private record · not in ' + petName + '’s Story' : `Owner-provided context${latest?.context ? ` · ${latest.context}` : ''}`}</span></div></article>
    <div className="saved-observation-links"><button className="text-link" onClick={onEdit}>Edit observation</button></div>
    <div className="sticky-action"><button className="primary-button full" onClick={onCancel}>{privateRecord ? 'Return to Today' : 'View in Story'}</button><p>You can edit or remove this observation later.</p></div>
  </div>;
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
  return <div className="context-attachments">{attachments.map((attachment) => <div className={`context-attachment ${attachment.kind}`} key={attachment.kind}>{attachment.kind === 'photo' ? <img src={attachment.url} alt={attachment.name} /> : <audio src={attachment.url} controls aria-label={attachment.name} />}<span>{attachment.name}</span>{onRemove && <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => onRemove(attachment.kind)}>×</button>}</div>)}</div>;
}

function ContextPage({ note, setNote, interpretation, setInterpretation, attachments, setAttachments, petName, onBack, onReview }: {
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
      <div className="linked-evidence"><img src={asset('context-clip.png')} alt={`Selected clip of ${petName}`} /><span><strong>Afternoon rest</strong><small>2 clips · selected sources</small></span></div>
      <h2 className="question-heading">What else was happening?</h2>
      <div className={`writing-field ${attachments.length ? 'has-attachments' : ''}`}><textarea aria-label={`Your context for ${petName}’s afternoon rest`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did you notice at home?" maxLength={500} /><ContextAttachmentList attachments={attachments} onRemove={(kind) => setAttachments(attachments.filter((attachment) => attachment.kind !== kind))} /><div className="context-attachment-tools"><label><input type="file" accept="image/*" onChange={(event) => { attachFile(event.target.files?.[0], 'photo'); event.currentTarget.value = ''; }} /><span>＋ Photo</span></label><label><input type="file" accept="audio/*" capture onChange={(event) => { attachFile(event.target.files?.[0], 'voice'); event.currentTarget.value = ''; }} /><span>◉ Voice note</span></label></div>{attachmentError && <p className="context-attachment-error" role="alert">{attachmentError}</p>}</div>
      <fieldset className="choice-card"><legend>How should Pawsona treat this?</legend>{(Object.keys(interpretationLabels) as Interpretation[]).map((value) => <label key={value}><input type="radio" name="interpretation" value={value} checked={interpretation === value} onChange={() => setInterpretation(value)} />{interpretationLabels[value]}</label>)}</fieldset>
      <StickyAction label="Review what will be saved" onClick={onReview} disabled={!note.trim()} hint="You can leave this pattern open." />
    </>
  );
}

function ConfirmPage({ note, interpretation, attachments, petName, ownerName, ownerRole, saveError, onBack, onSave }: { note: string; interpretation: Interpretation; attachments: ContextAttachment[]; petName: string; ownerName: string; ownerRole: string; saveError: string; onBack: () => void; onSave: () => void }) {
  return (
    <>
      <DetailHeader title="Confirm" eyebrow="REVIEW BEFORE SAVING" onBack={onBack} />
      <section className="confirm-card"><small>OWNER CORRECTION</small><h2>{interpretationLabels[interpretation]}</h2><p>“{note}”</p><span>{ownerName} · {ownerRole} · Today</span></section>
      <div className="linked-evidence"><img src={asset('context-clip.png')} alt={`Selected clip of ${petName}`} /><span><strong>Linked evidence</strong><small>2 selected clips + owner note{attachments.length ? ` + ${attachments.length} ${attachments.length === 1 ? 'attachment' : 'attachments'}` : ''}</small></span></div>
      <ContextAttachmentList attachments={attachments} />
      <section className="detail-card effects-card"><strong>After you save</strong><p>✓ &nbsp;Your context stays attributed to you</p><p>✓ &nbsp;The original observations stay available</p><p>○ &nbsp;Baseline is not changed automatically</p></section>
      <button className="text-link standalone" onClick={onBack}>Edit words or choice</button>
      {saveError && <p className="inline-save-error" role="alert">{saveError}</p>}
      <StickyAction label="Save owner correction" onClick={onSave} />
    </>
  );
}

function SavedPage({ saved, onBack, onReturnToday, onUndo, onEvidence, onEdit, petName, ownerName}: { saved: OwnerContext; onBack: () => void; onReturnToday: () => void; onUndo: () => void; onEvidence: () => void; onEdit: () => void; petName: string; ownerName: string}) {
  return (
    <>
      <DetailHeader title="Saved" eyebrow="OWNER CORRECTION SAVED" onBack={onBack} />
      <section className="saved-banner"><h2>✓ &nbsp;Context saved</h2><p>{petName}’s baseline was not changed automatically.</p></section>
      <section className="saved-result"><small>{ownerName.toUpperCase()}’S CONTEXT</small><strong>{interpretationLabels[saved.interpretation]}</strong><p>{saved.note}</p><ContextAttachmentList attachments={saved.attachments ?? []} /><div className="saved-result-meta">Linked to 2 selected clips{saved.attachments?.length ? ` + ${saved.attachments.length} ${saved.attachments.length === 1 ? 'attachment' : 'attachments'}` : ''} · saved {formatRelativeDate(saved.savedAt).toLowerCase()}</div><span>Owner-confirmed context</span></section>
      <section className="detail-card"><strong>What happens next?</strong><p>Future reviews can show this context alongside new observations.</p></section>
      <div className="saved-links"><button className="text-link" onClick={onUndo}>Undo correction</button><button className="text-link" onClick={onEvidence}>Review linked evidence</button><button className="text-link" onClick={onEdit}>Edit your context</button></div>
      <StickyAction label="Return to Today" onClick={onReturnToday} />
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

type AskAttachment = { url: string; name: string; kind: 'image' | 'audio'; type: string };
type AskMessage = { role: 'user' | 'assistant'; text: string; attachment?: AskAttachment };

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

function AskPage({ onEvidence, onContext, onPetsNavigate, petName, petAvatar, messages, messageEndRef }: { onEvidence: () => void; onContext: () => void; onPetsNavigate: () => void; petName: string; petAvatar: string; messages: AskMessage[]; messageEndRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="ask-page">
      <MainHeader eyebrow="ASK AI · OBSERVATION DIALOGUE" title="Ask Pawsona" onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} />
      <div className="linked-evidence ask-status"><span className="loading-ring" /><span><strong>Reviewing afternoon rest</strong><small>Linked to Today’s Story · 2 clips + your note</small></span></div>
      <section className="ask-thread" aria-label="Conversation with Pawsona">
        <article className="chat-message ai">{petName} rested longer this afternoon than in the recent clips available. I can’t tell why—or know exactly how {petName} felt. Would you like to check the evidence or add what happened at home?<button className="text-link" onClick={onEvidence}>View evidence →</button></article>
        <article className="chat-message owner">My family had visitors today. {petName} often settles down after that.</article>
        <article className="chat-message ai">Would you like to add this as owner context? You can review the clips before anything is saved.<div className="chat-choices"><button onClick={onContext}>Yes</button><button onClick={onEvidence}>No</button></div></article>
        {messages.map((message, index) => message.role === 'user'
          ? <article className="chat-message owner" key={`user-${index}`}>{message.attachment && (message.attachment.kind === 'audio' ? <audio className="chat-attachment-audio" src={message.attachment.url} controls aria-label={message.attachment.name} /> : <img className="chat-attachment" src={message.attachment.url} alt={message.attachment.name} />)}{message.text && <span>{message.text}</span>}</article>
          : <article className="chat-message ai dynamic-answer" key={`assistant-${index}`}>{message.text}<button className="text-link" onClick={onEvidence}>View linked evidence →</button></article>)}
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

function SimplePage({ kind, petName, petAvatar, petBreed, petAge, ownerName, ownerRole = 'Primary caregiver', ownerAvatar = '', ownerPreference = 'Manage your profile details here.', onPetsNavigate, onPetEdit, onProfileEdit, onAction, careMembers, primaryMemberId, onMemberClick, onCareMembers, onPatternHistory, onCareEvent }: { kind: 'pets' | 'you'; petName: string; petAvatar: string; petBreed: string; petAge: string; ownerName: string; ownerRole?: string; ownerAvatar?: string; ownerPreference?: string; onPetsNavigate: () => void; onPetEdit: () => void; onProfileEdit: () => void; onAction: (title: string, detail: string) => void; careMembers: CareMember[]; primaryMemberId: string; onMemberClick: (id: string) => void; onCareMembers: () => void; onPatternHistory: () => void; onCareEvent: () => void }) {
  const isPrimaryCaregiver = primaryMemberId === 'emily';
  const petDetailsLabel = `${petBreed} · ${formatPetAge(petAge)}`;
  return kind === 'pets' ? (
    <div className="profile-page pets-page">
      <MainHeader eyebrow="PET PROFILE" title="Pet profile" onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} />
      <section className="pet-profile-hero">
        <Avatar name={petName} src={petAvatar} />
        <div className="profile-hero-copy"><strong>{petName}</strong><small>{petDetailsLabel}</small><button className="mini-action" onClick={onPetEdit}><span>✎</span> Edit pet details</button></div>
        <button className="sort-action" aria-label="Reorder pets" onClick={() => onAction('Reorder pets', petName +
      ' is your current pet profile. You can change the order as you add pets.')}>⇄</button>
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
      <MainHeader eyebrow="YOUR SPACE" title="My Profile" onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} />
      <button className="account-profile-hero" onClick={onProfileEdit}>
        <OwnerAvatar src={ownerAvatar} name={ownerName} className="account-avatar" />
        <span className="profile-hero-copy"><strong>{ownerName}</strong><small>{ownerPreference}</small><span className="mini-action"><b>✎</b> Edit my profile</span></span>
      </button>

      <section className="profile-section you-section">
        <div className="profile-section-heading"><h2>My pets</h2><button className="profile-link" onClick={() => onAction('Add Pets', 'Add a pet profile to your Pawsona space.')}>Add Pets +</button></div>
        <div className="profile-card you-list pets-list">
          <button className="you-row" onClick={onPetEdit}><Avatar name={petName} src={petAvatar} /><span><strong>{petName}</strong><small>{petDetailsLabel}</small></span><em>Family</em></button>
          <button className="you-row" onClick={() => onAction('Cat', 'British Shorthair · 2 years old · Solo')}><span className="cat-avatar">🐈‍⬛</span><span><strong>Cat</strong><small>British Shorthair · 2 years old</small></span><em>Solo</em></button>
        </div>
      </section>

      <section className="profile-section you-section media-section">
        <div className="profile-section-heading"><h2>Connected media</h2><button className="profile-link" onClick={() => onAction('Add source', 'Choose a photo album or connect a supported camera source.')}>Add source +</button></div>
        <div className="profile-card you-list media-list">
          <button className="media-row" onClick={() => onAction('Selected photo album', 'Only the album you chose is connected.')}><span className="media-icon">▦</span><span><strong>Selected photo album</strong><small>Only the album you chose</small></span><em className="connected">Connected</em></button>
          <button
            className="media-row"
            onClick={() =>
              onAction(
                'Home camera',
                'Only the living room camera you chose is connected.'
              )
            }
          >
            <span className="media-icon">◉</span>
            <span>
              <strong>Home camera</strong>
              <small>Living room camera only</small>
            </span>
            <em className="connected">Connected</em>
          </button>
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
  const [saved, setSaved] = useState<OwnerContext | null>(readSavedContext);
  const [storyObservations, setStoryObservations] = useState<StoryObservation[]>(readStoryObservations);
  const [storyDrafts, setStoryDrafts] = useState<StoryDraft[]>(readStoryDrafts);
  const [includedStoryMoments, setIncludedStoryMoments] = useState<string[] | null>(readStoryVisibility);
  const [editingStoryObservationId, setEditingStoryObservationId] = useState<string | null>(null);
  const [activeStoryDraftId, setActiveStoryDraftId] = useState<string | null>(null);
  const [showStoryAddOptions, setShowStoryAddOptions] = useState(false);
  const [draftMoments, setDraftMoments] = useState<string[]>(['window', 'toy']);
  const [draftUploadedMedia, setDraftUploadedMedia] = useState<StoryMedia | null>(null);
  const [draftObservation, setDraftObservation] = useState(`${petName} rested by the window after our visitors left, then played with a rope toy in the afternoon.`);
  const [draftObservationContext, setDraftObservationContext] = useState('Visitors at home');
  const [draftPrivateRecord, setDraftPrivateRecord] = useState(false);
  const [note, setNote] = useState(saved?.note ?? 'Visitors were at home today. ' + petName + ' often rests afterward.');
  const [interpretation, setInterpretation] = useState<Interpretation>(saved?.interpretation ?? 'normal');
  const [contextAttachments, setContextAttachments] = useState<ContextAttachment[]>(saved?.attachments ?? []);
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
    const timer = window.setTimeout(() => setProfileSaveNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [profileSaveNotice]);

  useEffect(() => {
    if (view === 'ask' && askMessages.length && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [askMessages, view]);

  function saveContext() {
    const next: OwnerContext = { note: note.trim(), interpretation, savedAt: new Date().toISOString(), attachments: contextAttachments };
    setContextSaveError('');
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setContextSaveError('Your correction could not be saved on this device. Remove a large attachment or free some browser storage, then try again.');
      return;
    }
    setSaved(next);
    navigateTo('saved');
  }

  function undoContext() {
    setSaved(null);
    try { localStorage.removeItem(storageKey); } catch { /* Local state still works. */ }
    navigateTo('undone');
  }

  function startStoryObservation() {
    setStorySaveError('');
    setEditingStoryObservationId(null);
    setActiveStoryDraftId(null);
    setDraftMoments(['window', 'toy']);
    setDraftUploadedMedia(null);
    setDraftObservation(`${petName} rested by the window after our visitors left, then played with a rope toy in the afternoon.`);
    setDraftObservationContext('Visitors at home');
    setDraftPrivateRecord(false);
    navigateTo('addMoments');
  }

  function cancelStoryObservation() {
    const isUntouchedNewObservation =
      activeStoryDraftId === null &&
      editingStoryObservationId === null &&
      draftObservation ===
        `${petName} rested by the window after our visitors left, then played with a rope toy in the afternoon.` &&
      draftObservationContext === 'Visitors at home' &&
      !draftPrivateRecord &&
      draftUploadedMedia === null &&
      draftMoments.length === 2 &&
      draftMoments.includes('window') &&
      draftMoments.includes('toy');

    const returnView: View = view === 'addSaved' && draftPrivateRecord ? 'today' : 'story';
    if (
      view !== 'addSaved' &&
      !isUntouchedNewObservation &&
      (draftObservation.trim() || draftMoments.length)
    ) {
      const draft: StoryDraft = { id: activeStoryDraftId ?? `story-draft-${Date.now()}`, selectedMoments: draftMoments, note: draftObservation, context: draftObservationContext, savedAt: new Date().toISOString(), privateRecord: draftPrivateRecord, uploadedMedia: draftUploadedMedia ?? undefined };
      setStoryDrafts((current) => {
        const next = [draft, ...current.filter((entry) => entry.id !== draft.id)];
        try { localStorage.setItem(storyDraftsKey, JSON.stringify(next)); } catch { /* Keep the draft for this session. */ }
        return next;
      });
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
    const title = selected[0]?.id === 'breakfast' ? 'Breakfast time' : selected[0]?.id === 'toy' ? 'Favourite toy chase' : selected.length ? 'A window rest after visitors' : uploadedSelected ? `A new moment with ${petName}` : 'A quiet moment after visitors';
    const observation: StoryObservation = {
      id: existing?.id ?? `story-observation-${Date.now()}`,
      note: draftObservation.trim(),
      title,
      image: uploadedSelected && draftUploadedMedia ? draftUploadedMedia.url : asset(selected[0]?.image ?? 'story-window.png'),
      mediaType: uploadedSelected ? draftUploadedMedia?.type : undefined,
      momentCount: selected.length + selectedNotes.length + (uploadedSelected ? 1 : 0),
      momentIds: draftMoments,
      sourceNotes: selectedNotes,
      context: draftObservationContext,
      privateRecord: draftPrivateRecord,
      savedAt: new Date().toISOString(),
    };
    const next = [observation, ...storyObservations.filter((entry) => entry.id !== observation.id)];
    let nextDrafts: StoryDraft[] | null = null;
    if (draftPrivateRecord) {
      const draft: StoryDraft = { id: activeStoryDraftId ?? `story-draft-${Date.now()}`, selectedMoments: draftMoments, note: draftObservation, context: draftObservationContext, savedAt: new Date().toISOString(), privateRecord: true, uploadedMedia: draftUploadedMedia ?? undefined };
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
  }
  function editStoryRow(row: StoryEditRow) {
    const existing = storyObservations.find((entry) => entry.id === row.id);
    setEditingStoryObservationId(existing?.id ?? null);
    setDraftMoments(existing?.momentIds ?? (existing ? [] : [row.id]));
    setDraftUploadedMedia(existing?.mediaType ? { name: 'Uploaded media', type: existing.mediaType, url: existing.image } : null);
    setDraftObservation(existing?.note ?? row.note ?? '');
    setDraftObservationContext(existing?.context ?? '');
    setDraftPrivateRecord(false);
    navigateTo('addCompose');
  }
  function resumeStoryDraft(draft: StoryDraft) {
    setActiveStoryDraftId(draft.id);
    setEditingStoryObservationId(null);
    setDraftMoments(draft.selectedMoments);
    setDraftUploadedMedia(draft.uploadedMedia ?? null);
    setDraftObservation(draft.note);
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
  function navigate(view: View) {
    navigateTo(view);
  }

  return (
    <div className="app-stage">
      <div className="phone">
        <main ref={scrollRef} className={`screen-scroll ${view === 'today' ? 'home-screen' : ''} ${view.startsWith('add') ? 'add-flow-scroll' : ''}`}>
          <StatusBar />
          <div className={`screen-content ${mainView ? 'main-content' : 'detail-content'} ${view === 'ask' ? 'ask-content' : ''} ${view.startsWith('add') ? 'add-flow-content' : ''}`}>
            {view === 'today' && <TodayPage petName={petName} petAvatar={petAvatar} onStory={() => navigateTo('story')} onEvidence={() => navigateTo('overview')} onPetsNavigate={() => navigateTo('pets')} saved={saved} />}
            {view === 'story' && <StoryPage onEvidence={() => navigateTo('overview')} onEditStory={() => navigateTo('storyEdit')} onEditObservation={(observation) => editStoryRow({ id: observation.id, image: observation.image, mediaType: observation.mediaType, title: observation.title, meta: formatObservationTime(observation.savedAt), note: observation.note, context: observation.context })} onPetsNavigate={() => navigateTo('pets')} petName={petName} petAvatar={petAvatar} ownerName={ownerName} saved={saved} observations={storyObservations} includedMoments={includedStoryMoments} />}
            {view === 'storyEdit' && <StoryEditPage observations={storyObservations} includedMoments={includedStoryMoments} petName={petName} onBack={() => goBack('story')} onAdd={startStoryObservation} onEdit={editStoryRow} onDelete={deleteStoryRow} onSave={(ids) => { setIncludedStoryMoments(ids);try {
              localStorage.setItem(
                storyVisibilityKey,
                JSON.stringify(ids)
              );
            } catch {
              /* Keep the selection for this session. */
            } navigateTo('story'); }} />}
            {view === 'drafts' && <StoryDraftsPage drafts={storyDrafts} onBack={() => goBack('story')} onResume={resumeStoryDraft} onDelete={deleteStoryDraft} />}
            {view === 'addMoments' && <StoryAddPage step="moments" saveError={storySaveError} onBack={cancelStoryObservation} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} uploadedMedia={draftUploadedMedia} setUploadedMedia={setDraftUploadedMedia} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} petName={petName} ownerName={ownerName} onSave={saveStoryObservation} onEdit={() => navigateTo('addCompose')} />}
            {view === 'addCompose' && <StoryAddPage step="compose" saveError={storySaveError} onBack={() => goBack('addMoments')} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} uploadedMedia={draftUploadedMedia} setUploadedMedia={setDraftUploadedMedia} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} petName={petName} ownerName={ownerName} onSave={saveStoryObservation} onEdit={() => navigateTo('addPreview')} />}
            {view === 'addPreview' && <StoryAddPage step="preview" saveError={storySaveError} onBack={() => goBack('addCompose')} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} uploadedMedia={draftUploadedMedia} setUploadedMedia={setDraftUploadedMedia} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} petName={petName} ownerName={ownerName} onSave={saveStoryObservation} onEdit={() => navigateTo('addCompose')} />}
            {view === 'addSaved' && <StoryAddPage step="saved" saveError={storySaveError} onBack={() => goBack('addPreview')} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} uploadedMedia={draftUploadedMedia} setUploadedMedia={setDraftUploadedMedia} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} petName={petName} ownerName={ownerName} onSave={saveStoryObservation} onEdit={() => navigateTo('addCompose')} />}
            {view === 'overview' && <OverviewPage onBack={() => goBack('today')} onClip={() => navigateTo('clip')} saved={saved} onSaved={() => navigateTo('saved')} petName={petName}/>}
            {view === 'clip' && <ClipPage onBack={() => goBack('overview')} onContext={() => navigateTo('context')}  petName={petName} ownerName={ownerName} />}
            {view === 'context' && <ContextPage petName={petName} note={note} setNote={setNote} interpretation={interpretation} setInterpretation={setInterpretation} attachments={contextAttachments} setAttachments={setContextAttachments} onBack={() => goBack('clip')} onReview={() => navigateTo('confirm')} />}
            {view === 'confirm' && <ConfirmPage note={note} interpretation={interpretation} attachments={contextAttachments} petName={petName} ownerName={ownerName} ownerRole={ownerRole} saveError={contextSaveError} onBack={() => goBack('context')} onSave={saveContext} />}
            {view === 'saved' && saved && <SavedPage saved={saved} onBack={() => goBack('confirm')} onReturnToday={() => navigateTo('today')} onUndo={undoContext} onEvidence={() => navigateTo('clip')} onEdit={() => navigateTo('context')} petName={petName} ownerName={ownerName} />}
            {view === 'undone' && <UndonePage onBack={() => goBack('saved')} onReturnToday={() => navigateTo('today')} onReview={() => navigateTo('overview')} petName={petName} />}
            {view === 'ask' && <AskPage onEvidence={() => navigateTo('overview')} onContext={() => navigateTo('context')} onPetsNavigate={() => navigateTo('pets')} petName={petName} petAvatar={petAvatar} messages={askMessages} messageEndRef={askEndRef} />}
            {(view === 'pets' || view === 'you') && <SimplePage kind={view} petName={petName} petAvatar={petAvatar} petBreed={petBreed} petAge={petAge} ownerName={ownerName} ownerRole={ownerRole} ownerAvatar={ownerAvatar} ownerPreference={ownerPreference} onPetsNavigate={() => navigateTo('pets')} onPetEdit={() => navigateTo('petDetails')} onProfileEdit={() => navigateTo('profile')} onAction={(title, detail) => setProfileAction({ title, detail })} careMembers={careMembers} primaryMemberId={primaryMemberId} onMemberClick={openCareMember} onCareMembers={() => navigateTo('careMembers')} onPatternHistory={() => navigateTo('patternHistory')} onCareEvent={() => navigateTo('careEvent')} />}
            {view === 'petDetails' && <SettingsPage kind="petDetails" initialName={petName} initialAvatar={petAvatar} initialBreed={petBreed} initialAge={petAge} onSaved={setPetName} onPetSaved={({ name, breed, age, avatar }) => { setPetName(name); setPetBreed(breed); setPetAge(age); setPetAvatar(avatar); setProfileSaveNotice('Pet details saved successfully'); }} onBack={() => goBack('pets')} />}
            {view === 'profile' && <SettingsPage kind="profile" initialName={ownerName} initialAvatar={ownerAvatar} initialPreference={ownerPreference} onSaved={setOwnerName} onProfileSaved={({ name, avatar, preference }) => { setOwnerName(name); setOwnerAvatar(avatar); setOwnerPreference(preference); setProfileSaveNotice('Profile saved successfully'); }} onBack={() => goBack('you')} />}
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
        {profileSaveNotice && <div className="profile-save-toast" role="status">{profileSaveNotice}</div>}
        {mainView && <BottomNav active={activeNav} onNavigate={navigate} />}
      </div>
    </div>
  );
}


