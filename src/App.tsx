import Welcome from './Welcome';
import { requestAskAI } from './askAI';
import { searchCareAccounts, type CareAccountSearchResult, type CloudCareGroup, type CloudCareInvitation } from './cloud';
import { useEffect, useRef, useState, type FormEvent, type ReactElement, type ReactNode, type RefObject } from 'react';

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
  | 'connectedMedia'
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
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  attachments?: ContextAttachment[];
  likes?: string[];
  comments?: ContextComment[];
};

type ContextComment = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  replyTo?: string;
};

type CareMember = { id: string; name: string; role: string; detail: string; email?: string; avatar?: string; access?: 'editor' | 'viewer'; expiresAt?: string };
type CareInvitation = { id: string; groupId: string; ownerAccountId: string; ownerName: string; petId: string; petName: string; petBreed: string; petAge: string; petAvatar: string; petSpecies?: 'Dog' | 'Cat'; email: string; recipientAccountId?: string; role: 'Caregiver' | 'Viewer'; status: 'pending' | 'accepted' | 'declined' | 'cancelled'; createdAt: string };

function displayCareInvitation(invite: CloudCareInvitation): CareInvitation {
  return { id: invite.id, groupId: invite.groupId, ownerAccountId: invite.inviterId, ownerName: invite.ownerName, petId: invite.petId,
    petName: invite.petName, petBreed: invite.petBreed, petAge: invite.petAge, petAvatar: invite.petAvatar, petSpecies: invite.petSpecies,
    email: '@' + invite.inviteeUsername, recipientAccountId: invite.inviteeId, role: invite.role, status: 'pending', createdAt: invite.createdAt };
}

function careMembersFromCloudGroup(group: CloudCareGroup): CareMember[] {
  const members = Array.isArray(group.members) ? group.members : [];
  return members.map((entry) => ({
    id: entry.id, name: entry.name, email: entry.email || undefined,
    avatar: entry.avatar,
    role: entry.isOwner ? 'Primary caregiver' : entry.role,
    access: entry.role === 'Viewer' ? 'viewer' : 'editor',
    detail: entry.isOwner ? 'manages the profile' : entry.role === 'Viewer' ? 'can view shared records' : 'can add observations',
  }));
}

type CareEvent = {
  type: string;
  when: string;
  note: string;
};

type MediaSource = {
  id: string;
  title: string;
  detail: string;
  status: 'connected' | 'not-linked';
  lastSync?: string;
};

type TypicalPattern = {
  id: string;
  title: string;
  detail: string;
  evidence: string;
  confirmedBy: string;
  updatedAt: string;
  status: 'confirmed' | 'archived';
};

type LifeCareEvent = {
  id: string;
  category: 'life' | 'health';
  type: string;
  title: string;
  startDate: string;
  endDate?: string;
  ongoing: boolean;
  note: string;
  useForAsk: boolean;
  savedAt: string;
  authorId?: string;
  authorName?: string;
};

const mediaSourcesKey = 'pawsona-media-sources-v1';
const typicalPatternsKey = 'pawsona-typical-patterns-v1';
const lifeCareEventsKey = 'pawsona-life-care-events-v1';
const careInvitationsKey = 'pawsona-care-invitations-v1';

function readCareInvitations(): CareInvitation[] {
  try {
    const value = localStorage.getItem(careInvitationsKey);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed as CareInvitation[] : [];
  } catch { return []; }
}

function saveCareInvitations(invites: CareInvitation[]) {
  try { localStorage.setItem(careInvitationsKey, JSON.stringify(invites)); } catch { /* Keep invitations for this session. */ }
}

function defaultMediaSources(hasDemoData: boolean): MediaSource[] {
  return [
    { id: 'album', title: 'Selected photo album', detail: hasDemoData ? 'Chosen pet album' : 'Choose a pet album', status: hasDemoData ? 'connected' : 'not-linked', lastSync: hasDemoData ? '10 minutes ago' : undefined },
    { id: 'camera', title: 'Home camera', detail: hasDemoData ? 'Living room camera' : 'Choose a supported camera', status: hasDemoData ? 'connected' : 'not-linked', lastSync: hasDemoData ? 'Online' : undefined },
    { id: 'feeder', title: 'Smart feeder', detail: 'Equipment can be added', status: 'not-linked' },
  ];
}

function defaultTypicalPatterns(ownerName: string, hasDemoData: boolean): TypicalPattern[] {
  if (!hasDemoData) return [];
  const now = new Date().toISOString();
  return [
    { id: 'pattern-morning', title: 'Active mornings', detail: 'Usually active between 7–10 AM', evidence: 'Based on selected records and owner notes', confirmedBy: ownerName, updatedAt: now, status: 'confirmed' },
    { id: 'pattern-rest', title: 'Quiet afternoon rest', detail: 'Usually rests between 1–4 PM', evidence: 'Compared by time period, not one fixed “normal”', confirmedBy: ownerName, updatedAt: now, status: 'confirmed' },
    { id: 'pattern-toy', title: 'Likes the rope toy', detail: 'Often chooses the rope toy during play', evidence: 'Added by a caregiver', confirmedBy: ownerName, updatedAt: now, status: 'confirmed' },
  ];
}

function readCollection<T>(key: string): T[] | null {
  try {
    const value = localStorage.getItem(key);
    const parsed: unknown = value ? JSON.parse(value) : null;
    return Array.isArray(parsed) ? parsed as T[] : null;
  } catch {
    return null;
  }
}

function readMediaSources(hasDemoData = true) { return readCollection<MediaSource>(mediaSourcesKey) ?? defaultMediaSources(hasDemoData); }
function readTypicalPatterns(ownerName: string, hasDemoData = true) { return readCollection<TypicalPattern>(typicalPatternsKey) ?? defaultTypicalPatterns(ownerName, hasDemoData); }
function readLifeCareEvents() { return readCollection<LifeCareEvent>(lifeCareEventsKey) ?? []; }

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
type StoryObservation = { id: string; note: string; title: string; image: string; mediaType?: string; relatedPhotos?: StoryMedia[]; momentCount: number; momentIds?: string[]; sourceNotes?: StorySourceNote[]; context: string; privateRecord: boolean; savedAt: string; authorId?: string; authorName?: string; authorAvatar?: string };
type StoryDraft = { id: string; selectedMoments: string[]; note: string; title?: string; momentAt?: string; relatedPhotos?: StoryMedia[]; context: string; savedAt: string; privateRecord?: boolean; uploadedMedia?: StoryMedia };
type AskAttachment = { url: string; name: string; kind: 'image' | 'audio'; type: string };
type AskMessage = { role: 'user' | 'assistant'; text: string; attachment?: AskAttachment };
type PetWorkspace = {
  groupName: string;
  contexts: OwnerContext[];
  observations: StoryObservation[];
  momentEngagement: MomentEngagementById;
  drafts: StoryDraft[];
  visibility: string[] | null;
  askMessages: AskMessage[];
  askOwnerAccountId?: string;
  careMembers: CareMember[];
  careEvent: CareEvent | null;
  mediaSources: MediaSource[];
  patterns: TypicalPattern[];
  lifeEvents: LifeCareEvent[];
};
type PrototypePet = {
  id: string;
  name: string;
  breed: string;
  species?: 'Dog' | 'Cat';
  age: string;
  avatar: string;
  hasDemoMoments: boolean;
  isEmptyProfile?: boolean;
  sharedGroupId?: string;
  sharedOwnerAccountId?: string;
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
export type PrototypeSession = {
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
type MomentEngagement = { likes: string[]; favorites: string[] };
type MomentEngagementById = Record<string, MomentEngagement>;

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

async function mediaDataUrl(file: Blob): Promise<string> {
  let storedFile = file;
  if (file.type.startsWith('image/') && file.type !== 'image/gif' && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      if (scale < 1 || file.size > 350 * 1024) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (context) {
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.72));
          if (compressed && compressed.size < file.size) storedFile = compressed;
        }
      }
      bitmap.close();
    } catch { /* Keep the original if this browser cannot resize the image. */ }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unreadable file'));
    reader.onerror = () => reject(new Error('Unreadable file'));
    reader.readAsDataURL(storedFile);
  });
}
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
        authorId: typeof saved.authorId === 'string' ? saved.authorId : undefined,
        authorName: typeof saved.authorName === 'string' ? saved.authorName : undefined,
        authorAvatar: typeof saved.authorAvatar === 'string' ? saved.authorAvatar : undefined,
        attachments: Array.isArray(saved.attachments) ? saved.attachments : [],
      }];
    });
  } catch {
    // The demo can still run if browser storage is unavailable.
  }
  return [];
}

function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);
  useEffect(() => {
    type BatteryLike = EventTarget & { level: number };
    const batteryNavigator = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    if (!batteryNavigator.getBattery) return;
    let battery: BatteryLike | null = null;
    const update = () => { if (battery) setBatteryLevel(battery.level); };
    void batteryNavigator.getBattery().then((result) => {
      battery = result;
      update();
      battery.addEventListener('levelchange', update);
    }).catch(() => {});
    return () => { battery?.removeEventListener('levelchange', update); };
  }, []);
  const systemTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now);
  return (
    <div className="status-bar" aria-hidden="true">
      <span>{systemTime}</span>
      <svg className={`status-icons ${online ? '' : 'is-offline'}`} viewBox="0 0 143 54" role="img" aria-label={online ? 'Online' : 'Offline'}>
        <rect x="32" y="32" width="4" height="4" rx="1" />
        <rect x="40" y="27" width="4" height="9" rx="1" />
        <rect x="48" y="22" width="4" height="14" rx="1" />
        <rect x="56" y="17" width="4" height="19" rx="1" />
        <g className="status-wifi" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M66 22c6-6 16-6 22 0" /><path d="M70 27c4-4 10-4 14 0" /><path d="M75 32c1-1 3-1 4 0" />
        </g>
        <rect className="status-battery-outline" x="96" y="18" width="29" height="17" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M127 23v7a3.5 3.5 0 0 0 0-7" />
        {batteryLevel !== null && <rect x="99" y="21" width={Math.max(1, 23 * batteryLevel)} height="11" rx="2" />}
      </svg>
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

function LinkedEvidenceCard({ moment, petName, detail }: { moment: MomentRecord; petName: string; detail: string }) {
  const hasMedia = Boolean(moment.image?.trim());
  return <div className={`linked-evidence ${hasMedia ? '' : 'linked-evidence-text-only'}`}>
    {hasMedia && <StoryMediaView src={moment.image} type={moment.mediaType} alt={`${petName} · ${moment.title}`} />}
    <span><strong>{moment.title}</strong><small>{detail}</small></span>
  </div>;
}

function OwnerAvatar({ src, name, className = '' }: { src: string; name: string; className?: string }) {
  return <span className={`member-avatar emily-avatar owner-avatar ${className}`}>{src ? <img src={src} alt="" /> : name.slice(0, 1).toUpperCase()}</span>;
}

function MainHeader({ eyebrow, title, subtitle, petName, petAvatar = '', hasPet = true, onPetsNavigate, onSettingsNavigate }: { eyebrow: string; title: string; subtitle?: string; petName: string; petAvatar?: string; hasPet?: boolean; onPetsNavigate?: () => void; onSettingsNavigate?: () => void }) {
  return (
    <header className="main-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p className="main-subtitle">{subtitle}</p>}
      </div>
      {onSettingsNavigate ? <button className="header-settings-button" type="button" aria-label="Open settings" onClick={onSettingsNavigate}><span aria-hidden="true">⚙</span></button> : <button className={`header-avatar-button ${hasPet ? '' : 'is-empty'}`} type="button" aria-label="Open Pets" onClick={onPetsNavigate}>{hasPet ? <Avatar name={petName} src={petAvatar} /> : <span className="header-avatar-placeholder" aria-hidden="true" />}</button>}
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

function StickyAction({ label, onClick, disabled = false, className = '' }: { label: string; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <div className={`sticky-action ${className}`}>
      <button className="primary-button full" onClick={onClick} disabled={disabled}>{label}</button>
    </div>
  );
}

const baseMomentDefinitions: MomentRecord[] = [
  { id: 'breakfast', time: '8:10 AM', title: 'Breakfast time', summary: 'Observed eating as usual', description: 'Breakfast was recorded at the usual time, with no change noted in appetite or routine.', image: 'story-breakfast.png', source: 'Home camera · 8:10 AM' },
  { id: 'window', time: '11:35 AM', title: 'Rest by the window', summary: 'A quiet moment to remember', description: 'A calm rest beside the window was recorded after visitors had been at home.', image: 'story-window.png', source: 'Home camera · 11:35 AM' },
  { id: 'toy', time: '4:20 PM', title: 'Favourite toy chase', summary: 'One of today’s highlights!', description: 'An afternoon play session with a favourite toy was captured as an active, playful moment.', image: 'story-toy.png', source: 'Selected video · 4:20 PM' },
];

function observationHasPrimaryMedia(observation: StoryObservation) {
  if (!observation.image || observation.sourceNotes?.length) return false;
  if (Array.isArray(observation.momentIds) && (observation.momentIds.length === 0 || observation.momentIds.every((id) => id.startsWith('note-')))) return false;
  return true;
}

function resolveMoment(momentId: string, observations: StoryObservation[]): MomentRecord {
  const observation = observations.find((entry) => entry.id === momentId);
  if (observation) return {
    id: observation.id,
    time: formatObservationTime(observation.savedAt).replace('\n', ' · '),
    title: observation.title,
    summary: observation.note || 'Owner observation',
    description: observation.note || 'This moment was added as an owner observation.',
    image: observationHasPrimaryMedia(observation) ? observation.image : '',
    mediaType: observation.mediaType,
    relatedPhotos: observation.relatedPhotos,
    source: `Owner observation · ${formatRelativeDate(observation.savedAt)}`,
    observationContext: observation.context,
  };
  const base = baseMomentDefinitions.find((entry) => entry.id === momentId) ?? baseMomentDefinitions[1];
  return { ...base, image: asset(base.image) };
}

function TodayPage({ onStory, onMoment, onEvidence, onPetsNavigate, onAddPet, petName, petAvatar, saved, hasDemoMoments, noPetYet, observations, includedMoments }: { onStory: () => void; onMoment: (momentId: string) => void; onEvidence: () => void; onPetsNavigate: () => void; onAddPet: () => void; petName: string; petAvatar: string; saved: OwnerContext | null; hasDemoMoments: boolean; noPetYet: boolean; observations: StoryObservation[]; includedMoments: string[] | null }) {
  const displayName = petName.replace(/\s*\(Test[^)]*\)$/, '');
  const visibleRecords = observations.filter(record => !record.privateRecord && (!includedMoments || includedMoments.includes(record.id)))
    .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime());
  const todayRecords = visibleRecords.filter(record => isSameLocalDay(record.savedAt));
  const featured = todayRecords.length ? todayRecords : visibleRecords.filter(record => new Date(record.savedAt).toDateString() === new Date(visibleRecords[0]?.savedAt).toDateString());
  const first = featured.at(-1);
  const last = featured[0];
  const clock = (value: string) => formatObservationTime(value).split('\n').at(-1);
  const storyHeading = `${featured.length} ${featured.length === 1 ? 'moment' : 'moments'} from ${displayName}’s day.`;
  const reviewRecord = featured.find(record => /rest/i.test(record.title)) ?? last;

  return (
    <>
      <MainHeader eyebrow={noPetYet ? 'YOUR SPACE' : `A little window into ${displayName}’s day.`} title={noPetYet ? 'My space' : `Hello, ${displayName}!`} subtitle={formatPageDate()} onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} hasPet={!noPetYet} />
      {!hasDemoMoments && !visibleRecords.length ? noPetYet ? <section className="today-empty-state"><span>＋</span><h2>You haven’t added a pet yet</h2><p>Add one to get started.</p><button className="primary-button" onClick={onAddPet}>Add a pet</button></section> : <section className="today-empty-state"><span>♡</span><h2>Start {petName}’s first story</h2><p>Add a photo, video or written observation. This pet’s records will stay separate from your other pet profiles.</p><button className="primary-button" onClick={onStory}>Open {petName}’s Story →</button></section> : <>
      <section className="today-hero">
        <span className="story-badge">✦ &nbsp; {hasDemoMoments || todayRecords.length ? 'TODAY’S STORY' : 'LATEST STORY'}</span>
        <img className="hero-sparkle" src={asset('sparkle.svg')} alt="" />
        <h2>{hasDemoMoments ? 'Sunny naps, a playful afternoon, and one very good toy.' : storyHeading}</h2>
        <p>{hasDemoMoments ? '9:00 AM–6:00 PM' : first && last ? `${todayRecords.length ? '' : formatPageDate(new Date(last.savedAt)) + ' · '}${clock(first.savedAt)}–${clock(last.savedAt)}` : ''}</p>
        <button className="primary-button" onClick={onStory}>Read {displayName}’s story →</button>
      </section>

      <section className="today-section">
        <h2>Moments you might love</h2>
        <div className="moment-grid">
          {!hasDemoMoments ? featured.slice(0, 2).map(record => <button className="moment-card" key={record.id} onClick={() => onMoment(record.id)}>
            {observationHasPrimaryMedia(record) ? <StoryMediaView src={record.image} type={record.mediaType} alt={record.title} /> : <span className="moment-text-preview" aria-hidden="true">✦</span>}
            <span className="moment-card-copy"><strong>{record.title}</strong><small>{observationHasPrimaryMedia(record) ? record.mediaType?.startsWith('video/') ? 'Video' : record.mediaType?.startsWith('audio/') ? 'Audio' : 'Photo' : 'Written observation'} · {clock(record.savedAt)}</small></span>
          </button>) : <>

          <button className="moment-card" onClick={() => onMoment('toy')}>
            <img src={asset('toy-chase.png')} alt={`${petName} with a toy on a blue background`} />
            <span className="moment-card-copy"><strong>The toy chase</strong><small>Video · 0:18 · 4:20 PM</small></span>
          </button>
          <button className="moment-card" onClick={() => onMoment('window')}>
            <img src={asset('sunny-nap.png')} alt={`${petName} resting on a yellow background`} />
            <span className="moment-card-copy"><strong>A sunny window nap</strong><small>Photo · 11:35 AM</small></span>
          </button>
        </>}
        </div>
      </section>

      <section className="today-section closer-look">
        <h2>Worth a closer look</h2>
        <button className="notice-card" onClick={hasDemoMoments ? onEvidence : () => reviewRecord && onMoment(reviewRecord.id)}>
          <img src={asset('warning.png')} alt="" />
          <span><strong>{!hasDemoMoments ? `Review ${reviewRecord?.title.toLowerCase() ?? 'today’s moments'}` : saved ? 'Your context is now linked' : 'Afternoon rest looked a little longer'}</strong><small>{!hasDemoMoments ? 'Explore the observation and its owner context.' : saved ? 'Review the clips and your note.' : 'It may be ordinary. Review the clips.'}</small></span>
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

function StoryTimelineRow({ item, showTime = true, canEdit, menuOpen, onMenuToggle, onView, onEdit, onDelete }: { item: StoryTimelineItem; showTime?: boolean; canEdit: boolean; menuOpen: boolean; onMenuToggle: () => void; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const [date, time] = item.time.split('\n');
  return <div className="timeline-row">
    <span className="timeline-time">{showTime && <><span className="timeline-date">{date}</span><span>{time}</span></>}</span>
    <div className={`timeline-card ${item.image ? '' : 'text-only-timeline-card'}`}>
      <button className={`timeline-card-main ${item.image ? '' : 'no-media'}`} aria-label={`View details for ${item.title}`} onClick={onView}>
        {item.image && <StoryMediaView src={item.image} type={item.mediaType} alt="" />}
        <span><strong>{item.title}</strong><small>{item.note}</small></span>
      </button>
      {item.contexts && item.contexts.length > 0 && <TimelineContextTicker contexts={item.contexts} />}
      {canEdit && <button className="timeline-more" aria-label={`More actions for ${item.title}`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={onMenuToggle}>···</button>}
      {canEdit && menuOpen && <div className="timeline-action-menu" role="menu"><button role="menuitem" onClick={onEdit}>Edit</button><button className="danger-menu-item" role="menuitem" onClick={onDelete}>Delete</button></div>}
    </div>
  </div>;
}

function StoryPage({ onMoment, onEditStory, onEditMoment, onDeleteMoment, onPetsNavigate, onAddPet, petName, petAvatar, ownerName, accounts, contexts, observations, includedMoments, hasDemoMoments, noPetYet, canEdit }: { onMoment: (momentId: string) => void; onEditStory: () => void; onEditMoment: (item: StoryTimelineItem) => void; onDeleteMoment: (momentId: string) => string; onPetsNavigate: () => void; onAddPet: () => void; petName: string; petAvatar: string; ownerName: string; accounts: PrototypeAccount[]; contexts: OwnerContext[]; observations: StoryObservation[]; includedMoments: string[] | null; hasDemoMoments: boolean; noPetYet: boolean; canEdit: boolean }) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StoryTimelineItem | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const getTimelineContexts = (momentId: string) => contexts.filter((entry) => entry.momentId === momentId).map((entry) => ({ author: (entry.authorId && accounts.find((account) => account.id === entry.authorId)?.name) || entry.authorName || ownerName, text: entry.note }));
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
    ...todayObservations.map((observation) => ({ id: observation.id, time: formatObservationTime(observation.savedAt), title: observation.title, note: observation.note, image: observationHasPrimaryMedia(observation) ? observation.image : '', mediaType: observation.mediaType, contexts: getTimelineContexts(observation.id) })),
    ...visibleMoments,
  ];
  const earlierTimelineItems = earlierObservations.map((observation) => ({ id: observation.id, time: formatObservationTime(observation.savedAt), title: observation.title, note: observation.note, image: observationHasPrimaryMedia(observation) ? observation.image : '', mediaType: observation.mediaType, contexts: getTimelineContexts(observation.id) }));

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
      <MainHeader eyebrow={noPetYet ? 'DAILY STORY' : `${petName.toUpperCase()} · DAILY STORY`} title="Daily moments" subtitle={formatPageDate()} onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} hasPet={!noPetYet} />
      {noPetYet ? <section className="today-empty-state pets-empty-state story-empty-state"><span>＋</span><h2>You haven’t added a pet yet</h2><p>Add one to get started.</p><button className="primary-button" onClick={onAddPet}>Add a pet</button></section> : <>
      {totalMomentCount > 0 && <div className="story-summary"><img src={asset('story-heart.png')} alt="" /><strong>
        {totalMomentCount === 0 ? (
          'No moments yet'
        ) : (
          <>
            {totalMomentCount}{' '}
            {totalMomentCount === 1 ? 'moment' : 'moments'}, one lovely day
          </>
        )}
      </strong></div>}
      <section className="timeline-section">
        <div className="section-heading"><h2>Today’s timeline</h2>{canEdit && <button className="text-link" onClick={onEditStory}>Edit story ✎</button>}</div>
        {todayTimelineItems.length ? <div className="timeline-list">
          {todayTimelineItems.map((item) => { return <StoryTimelineRow key={item.id} item={item} canEdit={canEdit} menuOpen={openMenuId === item.id} onMenuToggle={() => setOpenMenuId(openMenuId === item.id ? null : item.id)} onView={() => { setOpenMenuId(null); onMoment(item.id); }} onEdit={() => { setOpenMenuId(null); onEditMoment(item); }} onDelete={() => { setOpenMenuId(null); setDeleteError(''); setPendingDelete(item); }} />; })}
        </div> : <><div className="story-summary timeline-empty-summary"><img src={asset('story-heart.png')} alt="" /><strong>No moments yet</strong></div><p className="timeline-empty-state">No moments today yet</p></>}
      </section>
      {earlierTimelineItems.length > 0 && <section className="timeline-section earlier-timeline-section"><div className="section-heading"><h2>Earlier moments</h2></div><div className="timeline-list">{earlierTimelineItems.map((item) => { return <StoryTimelineRow key={item.id} item={item} canEdit={canEdit} menuOpen={openMenuId === item.id} onMenuToggle={() => setOpenMenuId(openMenuId === item.id ? null : item.id)} onView={() => { setOpenMenuId(null); onMoment(item.id); }} onEdit={() => { setOpenMenuId(null); onEditMoment(item); }} onDelete={() => { setOpenMenuId(null); setDeleteError(''); setPendingDelete(item); }} />; })}</div></section>}
      {openMenuId && <button className="timeline-menu-dismiss" aria-label="Close moment actions" onClick={() => setOpenMenuId(null)} />}
      {pendingDelete && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-story-moment-title" onClick={(event) => event.stopPropagation()}><h2 id="delete-story-moment-title">Delete “{pendingDelete.title}”?</h2><p>{observations.some((entry) => entry.id === pendingDelete.id) ? 'This permanently removes this moment and its linked owner context from this pet’s Story.' : 'This removes this moment from the current Story. You can add it again later from Edit story.'}</p>{deleteError && <p className="inline-save-error" role="alert">{deleteError}</p>}<div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-button" onClick={confirmDelete}>Delete</button></div></section></div>}
      </>}
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
    ...observations.filter((entry) => !entry.privateRecord).map((entry) => ({ id: entry.id, image: observationHasPrimaryMedia(entry) ? entry.image : '', mediaType: entry.mediaType, title: entry.title, meta: `${formatObservationTime(entry.savedAt)} · written observation`, note: entry.note, context: entry.context })),
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
    <div className="story-edit-rows">{rows.filter((row) => !removedIds.includes(row.id)).map((row) => <div className="story-edit-item" key={row.id} onPointerDown={() => beginLongPress(row.id)} onPointerUp={clearLongPress} onPointerLeave={clearLongPress} onPointerCancel={clearLongPress} onContextMenu={(event) => { event.preventDefault(); clearLongPress(); suppressClick.current = true; setOpenMenuId(row.id); }}><button type="button" className={`story-edit-row ${included.includes(row.id) ? 'included' : ''} ${row.image ? '' : 'no-media'}`} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setOpenMenuId(null); setIncluded((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]); }}>{row.image && <StoryMediaView src={row.image} type={row.mediaType} alt="" />}<span className="story-edit-row-copy"><strong>{row.title}</strong><small>{row.meta}</small></span><span className="story-edit-check" aria-hidden="true">{included.includes(row.id) ? '✓' : ''}</span></button>{openMenuId === row.id && <div className="story-row-action-bubble" role="menu"><button role="menuitem" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); clearLongPress(); setOpenMenuId(null); suppressClick.current = false; onEdit(row); }}>Edit</button><button role="menuitem" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); clearLongPress(); removeRow(row.id); suppressClick.current = false; }}>Delete</button></div>}</div>)}</div>
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
  const isWrittenObservation = !uploadedSelected && selectedMoments.length === 0;
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
    Promise.all(chosenFiles.map(async (file) => ({ name: file.name, type: file.type, url: await mediaDataUrl(file) }))).then((media) => {
      setRelatedPhotos([...relatedPhotos, ...media]);
      setUploadError('');
    }).catch(() => setUploadError('An attachment could not be read. Please try another file.'));
  }

  async function uploadMedia(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setUploadError('Choose an image or video file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Choose a file smaller than 2 MB for this prototype.');
      return;
    }

    try {
      const url = await mediaDataUrl(file);
      setUploadedMedia({ name: file.name, type: file.type, url });
      setSelectedMoments(['uploaded']);
      setNote(defaultObservationForSource('uploaded', petName));
      setTitle(`A moment with ${petName}`);
      setUploadError('');
    } catch {
      setUploadError('This file could not be read. Please try another one.');
    }
  }

  if (step === 'moments') return <div className="add-flow-page">
    {header('Choose a moment', '1 OF 3 · SELECT A MAIN MOMENT')}
    <div className="source-tabs" role="tablist" aria-label="Moment sources">{(['Photos', 'Clips', 'Notes'] as const).map((tab) => <button key={tab} className={sourceTab === tab ? 'active' : ''} role="tab" aria-selected={sourceTab === tab} onClick={() => chooseSourceTab(tab)}>{tab}</button>)}</div>
    <div className={`moment-picker-grid ${sourceTab === 'Notes' ? 'notes-picker-grid' : ''}`}>
      {sourceTab === 'Notes' ? noteChoices.map((entry) => { const chosen = selectedMoments.includes(entry.id); return <button className={`moment-choice note-moment-choice ${chosen ? 'selected' : ''}`} key={entry.id} onClick={() => { toggleMomentSource(entry.id, entry.text); if (!chosen) setTitle(titleFromObservation(entry.text)); }}><span>{entry.text}</span>{chosen && <span className="moment-check">✓</span>}<small>{entry.label}</small></button>; }) : availableMomentChoices.map((moment, index) => { const chosen = selectedMoments.includes(moment.id); const label = sourceTab === 'Clips' ? ['Clip · 0:12', 'Clip · 0:18', 'Clip · 0:08'][index] : `${moment.time} · ${moment.title}`; return <button className={`moment-choice ${chosen ? 'selected' : ''}`} key={moment.id} onClick={() => { toggleMomentSource(moment.id, defaultObservationForSource(moment.id, petName)); if (!chosen) setTitle(moment.title); }}><img src={asset(moment.image)} alt="" />{chosen && <span className="moment-check">✓</span>}<small>{label}</small></button>; })}
      {sourceTab === 'Notes' && <button className="moment-choice written-observation-choice" onClick={() => { setUploadedMedia(null); setSelectedMoments([]); setTitle(''); setRelatedPhotos([]); setNote(''); onEdit(); }}><span className="written-observation-plus" aria-hidden="true">＋</span><small>Written observation</small></button>}
      {!hasDemoMoments && <p className="empty-source-message">No saved {sourceTab.toLowerCase()} yet. Add one from this device or start with a written observation.</p>}
      {sourceTab !== 'Notes' && uploadedMedia && <div role="button" tabIndex={0} aria-pressed={uploadedSelected} className={`moment-choice uploaded-device-choice ${uploadedSelected ? 'selected' : ''}`} onClick={() => { setSelectedMoments(uploadedSelected ? [] : ['uploaded']); if (!uploadedSelected && !title.trim()) setTitle(`A moment with ${petName}`); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedMoments(uploadedSelected ? [] : ['uploaded']); } }}><StoryMediaView src={uploadedMedia.url} type={uploadedMedia.type} alt={uploadedMedia.name} />{uploadedSelected && <span className="moment-check">✓</span>}<button type="button" className="remove-uploaded-media" aria-label={`Remove ${uploadedMedia.name}`} onClick={(event) => { event.stopPropagation(); setUploadedMedia(null); setSelectedMoments(selectedMoments.filter((id) => id !== 'uploaded')); }}>×</button><small>{uploadedMedia.name}</small></div>}
      {sourceTab !== 'Notes' && <label className="moment-choice add-device-choice"><input type="file" accept="image/*,video/*" onChange={(event) => { uploadMedia(event.target.files?.[0]); event.currentTarget.value = ''; }} /><span className="add-device-plus">＋</span><span>{uploadedSelected ? 'Replace photo or video' : 'Add photo or video'}</span></label>}
      {uploadError && <p className="upload-error" role="alert">{uploadError}</p>}
    </div>
    <div className="sticky-action add-moment-sticky-action"><button className="primary-button full" onClick={onEdit} disabled={!selectedMoments.length}>{selectedMoments.length > 1 ? 'Continue with selected sources' : `Continue with this ${sourceTab === 'Notes' ? 'note' : sourceTab === 'Clips' ? 'clip' : 'moment'}`}</button></div>
  </div>;

  if (step === 'compose') return <div className="add-flow-page">
    {header('Write a moment', '2 OF 3 · ADD YOUR WORDS')}
    {hasVisual || selectedNotes.length > 0 ? <><div className="compose-section-label"><strong>Selected moment</strong></div>{hasVisual ? <div className="selected-moments-strip">{selected.map((moment) => <img key={moment.id} src={asset(moment.image)} alt={moment.title} />)}{uploadedSelected && uploadedMedia && <StoryMediaView src={uploadedMedia.url} type={uploadedMedia.type} alt={uploadedMedia.name} />}</div> : <div className="selected-note-strip">{selectedNotes.map((entry) => <div key={entry.id}><span>{entry.text}</span><small>{entry.label}</small></div>)}</div>}</> : <><div className="written-observation-mode"><strong>Written observation</strong></div><div className="written-observation-note"><strong>A note is enough</strong><span>You can describe a moment without a photo or camera clip.</span></div></>}
    {isOwnerCreatedMoment && <MomentDateTimePicker value={momentAt} onChange={setMomentAt} />}
    <label className="observation-title-field"><strong>Title</strong><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a title for this moment" maxLength={70} /></label>
    <section className="observation-writing-card"><strong>What happened with {petName}?</strong><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe what you noticed…" />{relatedPhotos.length > 0 && <div className="related-photos-strip">{relatedPhotos.map((media, index) => <div className={media.type.startsWith('audio/') ? 'audio-attachment-thumb' : ''} key={`${media.name}-${index}`}><StoryMediaView src={media.url} type={media.type} alt={media.name} controls={media.type.startsWith('audio/')} /><button type="button" aria-label={`Remove attachment ${index + 1}`} onClick={() => setRelatedPhotos(relatedPhotos.filter((_, mediaIndex) => mediaIndex !== index))}>×</button></div>)}</div>}{uploadError && <p className="upload-error" role="alert">{uploadError}</p>}<div className="observation-writing-tools">{!isWrittenObservation && <label aria-label="Add photos"><input type="file" accept="image/*" multiple onChange={(event) => { addRelatedPhotos(event.target.files); event.currentTarget.value = ''; }} /><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="m5 17 5-5 3 3 2-2 5 5" /></svg></label>}<label aria-label="Add a voice note"><input type="file" accept="audio/*" capture onChange={(event) => { addRelatedPhotos(event.target.files); event.currentTarget.value = ''; }} /><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" /></svg></label><span className="observation-attachment-hint">{isWrittenObservation ? 'You can add a voice note too.' : 'You can add more photos or voice notes too.'}</span></div></section>
    <section className="add-context-choices"><strong>Add context</strong><div>{['Visitors at home', 'Routine changed', 'Not sure yet'].map((item) => <button key={item} className={context === item ? 'active' : ''} onClick={() => setContext(context === item ? '' : item)}>{item}</button>)}</div></section>
    <div className="sticky-action"><button className="primary-button full" onClick={onEdit} disabled={!note.trim()}>Preview observation</button></div>
  </div>;

  if (step === 'preview') return <div className="add-flow-page">
    {header('Preview', '3 OF 3 · CHECK BEFORE SAVING')}
    <article className={`observation-preview-card ${!hasVisual ? 'note-observation-preview' : ''}`}>{hasVisual ? <StoryMediaView src={image} type={mediaType} alt={petName} controls={mediaType?.startsWith('video/')} /> : <div className="observation-note-visual"><strong>A note from {ownerName}</strong><p>{note || 'A moment with ' + petName + '.'}</p></div>}{relatedPhotos.length > 0 && <div className="preview-related-photos">{relatedPhotos.map((media, index) => <StoryMediaView key={`${media.name}-${index}`} src={media.url} type={media.type} alt={`Related attachment ${index + 1}`} controls={media.type.startsWith('audio/')} />)}</div>}<div className="observation-preview-copy"><small>{petName} · Today</small><strong>{observationTitle}</strong><p>{note || 'A moment with ' + petName + '.'}</p>{selectedNotes.length > 0 && <div className="preview-source-notes"><strong>Saved note sources</strong>{selectedNotes.map((entry) => <span key={entry.id}>{entry.text}<small>{entry.label}</small></span>)}</div>}<div>{selectedMoments.length} selected {selectedMoments.length === 1 ? 'source' : 'sources'} · {hasVisual ? 'owner observation' : `Written observation · ${ownerName}`}</div><span>Owner-provided context{context ? ` · ${context}` : ''}</span></div></article>
    <section className="observation-destination"><strong>Where this goes</strong><button className={!privateRecord ? 'selected' : ''} onClick={() => setPrivateRecord(false)}><span className="destination-radio">{!privateRecord && <i />}</span>Add to {petName}'s Story</button><button className={privateRecord ? 'selected' : ''} onClick={() => setPrivateRecord(true)}><span className="destination-radio">{privateRecord && <i />}</span>Keep as a private record</button><small>{privateRecord ? 'Only you can see this record until you choose to share it.' : 'You choose which sources and words are saved.'}</small></section>
    {saveError && <p className="inline-save-error" role="alert">{saveError}</p>}
    <div className="sticky-action"><button className="primary-button full" onClick={onSave}>{privateRecord ? 'Save private note' : 'Save observation'}</button></div>
  </div>;

  return <div className="add-flow-page">
    {header(privateRecord ? 'Saved privately' : 'Moment saved', privateRecord ? 'SAVED TO PRIVATE RECORDS' : 'ADDED TO ' + petName.toUpperCase() + '’S STORY')}
    <section className="observation-saved-banner"><strong>✓ &nbsp;{privateRecord ? 'Your private note is saved' : 'Your observation is saved'}</strong><span>{privateRecord ? `Visible only to you · Added by ${ownerName}` : `Added by ${ownerName}`} · Today</span></section>
    <article className="observation-preview-card saved-observation-card">{latestHasVisual ? <StoryMediaView src={image} type={mediaType} alt={petName} controls={mediaType?.startsWith('video/')} /> : <div className="observation-note-visual"><strong>A note from {ownerName}</strong><p>{observationText || 'A moment with ' + petName + '.'}</p></div>}{latest?.relatedPhotos && latest.relatedPhotos.length > 0 && <div className="preview-related-photos">{latest.relatedPhotos.map((media, index) => <StoryMediaView key={`${media.name}-${index}`} src={media.url} type={media.type} alt={`Related attachment ${index + 1}`} controls={media.type.startsWith('audio/')} />)}</div>}<div className="observation-preview-copy"><strong>{observationTitle}</strong><p>{observationText || 'A moment with ' + petName + '.'}</p>{savedSourceNotes.length > 0 && <div className="preview-source-notes"><strong>Saved note sources</strong>{savedSourceNotes.map((entry) => <span key={entry.id}>{entry.text}<small>{entry.label}</small></span>)}</div>}<div>{(latest?.momentCount ?? selectedMoments.length) === 0 ? `Written observation · ${ownerName}` : `${latest?.momentCount ?? selectedMoments.length} selected ${(latest?.momentCount ?? selectedMoments.length) === 1 ? 'source' : 'sources'} · owner observation`}</div><span>{privateRecord ? 'Private record · not in ' + petName + '’s Story' : `Owner-provided context${latest?.context ? ` · ${latest.context}` : ''}`}</span></div></article>
    <div className="saved-observation-links"><button className="text-link" onClick={onEdit}>Edit observation</button></div>
    <div className="sticky-action"><button className="primary-button full" onClick={onCancel}>{privateRecord ? 'Return to Today' : 'View in Story'}</button></div>
  </div>;
}

function MomentContextCard({ context, accounts, ownerName, ownerAvatar, currentAccountId, groupOwnerAccountId, canContribute, canInteract, onEditContext, onDeleteContext, onToggleLike, onAddComment, onEditOwnComment, onDeleteOwnComment }: { context: OwnerContext; accounts: PrototypeAccount[]; ownerName: string; ownerAvatar: string; currentAccountId: string; groupOwnerAccountId?: string; canContribute: boolean; canInteract: boolean; onEditContext: (context: OwnerContext) => void; onDeleteContext: () => void; onToggleLike: (id: string) => void; onAddComment: (id: string, body: string) => boolean; onEditOwnComment: (contextId: string, commentId: string, body: string) => boolean; onDeleteOwnComment: (contextId: string, commentId: string) => boolean }) {
  const [comment, setComment] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showCommentComposer, setShowCommentComposer] = useState(false);
  const [showCommentMenuId, setShowCommentMenuId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const commentPressTimer = useRef<number | null>(null);
  const authorAccount = context.authorId ? accounts.find((account) => account.id === context.authorId) : undefined;
  const authorName = authorAccount?.name ?? context.authorName ?? ownerName;
  const authorAvatar = authorAccount ? authorAccount.avatar : context.authorAvatar ?? (context.authorId ? '' : ownerAvatar);
  const isAuthor = context.authorId ? context.authorId === currentAccountId : (!groupOwnerAccountId || groupOwnerAccountId === currentAccountId);
  const canDelete = canContribute && (isAuthor || (!!groupOwnerAccountId && currentAccountId === groupOwnerAccountId));
  const likes = context.likes ?? [];
  const comments = context.comments ?? [];
  const commentAuthorName = (entry: ContextComment) => accounts.find((account) => account.id === entry.authorId)?.name ?? entry.authorName;
  useEffect(() => {
    if (showCommentComposer) commentInputRef.current?.focus();
  }, [showCommentComposer]);
  useEffect(() => {
    if (!showContextMenu) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setShowContextMenu(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [showContextMenu]);
  function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim() || !onAddComment(context.id, comment.trim())) return;
    setComment('');
  }
  function saveCommentEdit(event: FormEvent, entry: ContextComment) {
    event.preventDefault();
    if (!editingCommentText.trim() || !onEditOwnComment(context.id, entry.id, editingCommentText.trim())) return;
    setEditingCommentId(null);
    setEditingCommentText('');
  }
  function startCommentLongPress(entry: ContextComment) {
    if (entry.authorId !== currentAccountId) return;
    if (commentPressTimer.current !== null) window.clearTimeout(commentPressTimer.current);
    commentPressTimer.current = window.setTimeout(() => setShowCommentMenuId(entry.id), 500);
  }
  function cancelCommentLongPress() {
    if (commentPressTimer.current !== null) window.clearTimeout(commentPressTimer.current);
    commentPressTimer.current = null;
  }
  function deleteOwnComment(entry: ContextComment) {
    if (onDeleteOwnComment(context.id, entry.id)) setShowCommentMenuId(null);
  }
  function renderComment(entry: ContextComment): ReactElement {
    const isOwnComment = entry.authorId === currentAccountId;
    return <div className={`context-comment ${isOwnComment ? 'own-context-comment' : ''}`} key={entry.id} onPointerDown={() => startCommentLongPress(entry)} onPointerUp={cancelCommentLongPress} onPointerLeave={cancelCommentLongPress} onPointerCancel={cancelCommentLongPress} onContextMenu={(event) => { if (isOwnComment) { event.preventDefault(); cancelCommentLongPress(); setShowCommentMenuId(entry.id); } }}>
      <div className="context-comment-body">
        <span className="context-comment-meta"><strong>{commentAuthorName(entry)}</strong><time>{formatObservationTime(entry.createdAt)}</time></span>
        {editingCommentId === entry.id ? <form className="context-comment-edit-form" onSubmit={(event) => saveCommentEdit(event, entry)}><input autoFocus aria-label="Edit your comment" value={editingCommentText} onChange={(event) => setEditingCommentText(event.target.value)} maxLength={300} /><button type="submit" disabled={!editingCommentText.trim()}>Save</button><button type="button" onClick={() => { setEditingCommentId(null); setEditingCommentText(''); }}>Cancel</button></form> : <span className="context-comment-text">{entry.body}</span>}
      </div>
      {isOwnComment && showCommentMenuId === entry.id && editingCommentId !== entry.id && <div className="context-comment-menu" role="menu"><button type="button" role="menuitem" onClick={() => { setEditingCommentId(entry.id); setEditingCommentText(entry.body); setShowCommentMenuId(null); }}>Edit</button><button type="button" role="menuitem" onClick={() => deleteOwnComment(entry)}>Delete</button></div>}
    </div>;
  }

  return <article className="detail-card moment-context-card">
    <div className="moment-context-head"><div className="moment-context-author"><OwnerAvatar src={authorAvatar} name={authorName} className="moment-context-avatar" /><span><strong>{authorName}</strong><small>{formatObservationTime(context.savedAt).replace('\n', ' · ')}</small></span></div><span className={`context-kind-tag ${context.interpretation}`}>{interpretationLabels[context.interpretation]}</span></div>
    <p>{context.note}</p><ContextAttachmentList attachments={context.attachments ?? []} />
    {(canInteract || canDelete || (isAuthor && canContribute)) && <div className="context-social-actions">
      {canInteract && <button type="button" className={`context-like-button ${likes.includes(currentAccountId) ? 'liked' : ''}`} aria-label={likes.includes(currentAccountId) ? 'Unlike context' : 'Like context'} aria-pressed={likes.includes(currentAccountId)} onClick={() => onToggleLike(context.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 5.9l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.3 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>{likes.length > 0 && <b>{likes.length}</b>}</button>}
      {canInteract && <button type="button" className={`context-comment-count ${showCommentComposer ? 'active' : ''}`} aria-label={`${showCommentComposer ? 'Hide' : 'Show'} comment field; ${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`} aria-expanded={showCommentComposer} onClick={() => setShowCommentComposer((open) => !open)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.7-.8L3 20l1.7-4.4A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></svg>{comments.length > 0 && <b>{comments.length}</b>}</button>}
      {(isAuthor && canContribute || canDelete) && <div className="context-more-wrap" ref={contextMenuRef}>
        <button type="button" className="context-more-button" aria-label="More context options" aria-haspopup="menu" aria-expanded={showContextMenu} onClick={() => setShowContextMenu(open => !open)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
        </button>
        {showContextMenu && <div className="context-action-menu" role="menu">
          {isAuthor && canContribute && <button type="button" role="menuitem" onClick={() => { setShowContextMenu(false); onEditContext(context); }}>Edit</button>}
          {canDelete && <button type="button" role="menuitem" onClick={() => { setShowContextMenu(false); onDeleteContext(); }}>Delete</button>}
        </div>}
      </div>}
    </div>}
    {canInteract && (comments.length > 0 || showCommentComposer) && <div className="context-comment-thread">
      <div className="context-comment-list">{comments.map(renderComment)}</div>
      {showCommentComposer && <form className="context-comment-form" onSubmit={submitComment}><div><input ref={commentInputRef} aria-label="Write a comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment…" maxLength={300} /><button type="submit" disabled={!comment.trim()} aria-label="Send comment"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 16-8-5 16-3-6-8-2Zm8 2 8-10" /></svg></button></div></form>}
    </div>}
  </article>;
}

function MomentDetailPage({ moment, contexts, accounts, ownerName, ownerAvatar, currentAccountId, groupOwnerAccountId, petName, canContribute, canInteract, engagement, onToggleMomentLike, onToggleMomentFavorite, onBack, onAddContext, onEditContext, onDeleteContext, onToggleLike, onAddComment, onEditOwnComment, onDeleteOwnComment }: { moment: MomentRecord; contexts: OwnerContext[]; accounts: PrototypeAccount[]; ownerName: string; ownerAvatar: string; currentAccountId: string; groupOwnerAccountId?: string; petName: string; canContribute: boolean; canInteract: boolean; engagement: MomentEngagement; onToggleMomentLike: () => void; onToggleMomentFavorite: () => void; onBack: () => void; onAddContext: () => void; onEditContext: (context: OwnerContext) => void; onDeleteContext: (id: string) => boolean; onToggleLike: (contextId: string) => void; onAddComment: (contextId: string, body: string) => boolean; onEditOwnComment: (contextId: string, commentId: string, body: string) => boolean; onDeleteOwnComment: (contextId: string, commentId: string) => boolean }) {
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
      <article className={`moment-detail-card ${moment.image ? '' : 'note-only-moment-card'}`}>
        {moment.image && <section className="moment-detail-media"><StoryMediaView src={moment.image} type={moment.mediaType} alt={`${petName} · ${moment.title}`} controls={moment.mediaType?.startsWith('video/')} /></section>}
        <section className="moment-summary-card"><div className="moment-summary-mini moment-source-mini"><strong>{moment.source}</strong><p>{moment.time}</p></div><div className="moment-summary-mini moment-description-mini"><strong>What this moment shows</strong><p>{moment.description}</p></div></section>
      </article>
      {canInteract && <div className="moment-engagement-actions"><button type="button" className={`moment-engagement-button like ${engagement.likes.includes(currentAccountId) ? 'active' : ''}`} aria-label={engagement.likes.includes(currentAccountId) ? 'Unlike this moment' : 'Like this moment'} aria-pressed={engagement.likes.includes(currentAccountId)} onClick={onToggleMomentLike}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 5.9l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.3 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>{engagement.likes.length > 0 && <b>{engagement.likes.length}</b>}</button><button type="button" className={`moment-engagement-button favorite ${engagement.favorites.includes(currentAccountId) ? 'active' : ''}`} aria-label={engagement.favorites.includes(currentAccountId) ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={engagement.favorites.includes(currentAccountId)} onClick={onToggleMomentFavorite}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>{engagement.favorites.length > 0 && <b>{engagement.favorites.length}</b>}</button></div>}
      {moment.relatedPhotos && moment.relatedPhotos.length > 0 && <section className="moment-related-photos"><strong>Related photos</strong><div>{moment.relatedPhotos.map((media, index) => <StoryMediaView key={`${media.name}-${index}`} src={media.url} type={media.type} alt={`Related attachment ${index + 1}`} controls={media.type.startsWith('audio/')} />)}</div></section>}
      {moment.observationContext && <section className="observation-context-summary"><strong>Context saved with this observation</strong><span>{moment.observationContext}</span></section>}
      <section className="moment-context-section">
        <div className="section-heading"><h2>Owner context</h2>{contexts.length > 0 && <span>{contexts.length} saved</span>}</div>
        {contexts.length ? <div className="moment-context-list">{contexts.map((context) => <MomentContextCard key={context.id} context={context} accounts={accounts} ownerName={ownerName} ownerAvatar={ownerAvatar} currentAccountId={currentAccountId} groupOwnerAccountId={groupOwnerAccountId} canContribute={canContribute} canInteract={canInteract} onEditContext={onEditContext} onDeleteContext={() => { setDeleteError(''); setPendingDelete(context); }} onToggleLike={onToggleLike} onAddComment={onAddComment} onEditOwnComment={onEditOwnComment} onDeleteOwnComment={onDeleteOwnComment} />)}</div> : <div className="empty-context-state"><strong>No context has been added</strong><p>Add what was happening around this specific moment. It will stay attached here.</p></div>}
      </section>
      {canContribute && <StickyAction className="moment-detail-action" label="Add context to this moment" onClick={onAddContext} />}
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
      <StickyAction label="See supporting moments" onClick={onClip} />
    </>
  );
}

function ClipPage({ onBack, onContext, petName, ownerName, canContribute }: { onBack: () => void; onContext: () => void; petName: string; ownerName: string; canContribute: boolean }) {
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
      {canContribute && <StickyAction label="Add your context" onClick={onContext} />}
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

  async function attachFile(file: File | undefined, kind: ContextAttachment['kind']) {
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

    try {
      const url = await mediaDataUrl(file);
      setAttachments([...attachments.filter((attachment) => attachment.kind !== kind), { kind, name: file.name, type: file.type, url }]);
      setAttachmentError('');
    } catch {
      setAttachmentError('This attachment could not be read. Please try another one.');
    }
  }

  return (
    <>
      <DetailHeader title="Add context" eyebrow="YOUR WORDS · OWNER INPUT" onBack={onBack} />
      <LinkedEvidenceCard moment={moment} petName={petName} detail={`${moment.time} · one moment`} />
      <h2 className="question-heading">What else was happening?</h2>
      <div className={`writing-field ${attachments.length ? 'has-attachments' : ''}`}><textarea aria-label={`Your context for ${petName}’s ${moment.title}`} value={note} onChange={(event) => setNote(event.target.value)} placeholder={`What was happening around ${moment.title.toLowerCase()}?`} maxLength={500} /><ContextAttachmentList attachments={attachments} onRemove={(kind) => setAttachments(attachments.filter((attachment) => attachment.kind !== kind))} /><div className="context-attachment-tools"><label><input type="file" accept="image/*" aria-label="Add photo" onChange={(event) => { attachFile(event.target.files?.[0], 'photo'); event.currentTarget.value = ''; }} /><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="m5 17 5-5 3 3 2-2 5 5" /></svg></label><label><input type="file" accept="audio/*" capture aria-label="Add voice note" onChange={(event) => { attachFile(event.target.files?.[0], 'voice'); event.currentTarget.value = ''; }} /><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" /></svg></label></div>{attachmentError && <p className="context-attachment-error" role="alert">{attachmentError}</p>}</div>
      <fieldset className="choice-card"><legend>How should Pawsona treat this?</legend>{(Object.keys(interpretationLabels) as Interpretation[]).map((value) => <label key={value}><input type="radio" name="interpretation" value={value} checked={interpretation === value} onChange={() => setInterpretation(value)} />{interpretationLabels[value]}</label>)}</fieldset>
      <StickyAction label="Review what will be saved" onClick={onReview} disabled={!note.trim()} />
    </>
  );
}

function ConfirmPage({ moment, note, interpretation, attachments, petName, ownerName, ownerRole, saveError, onBack, onSave }: { moment: MomentRecord; note: string; interpretation: Interpretation; attachments: ContextAttachment[]; petName: string; ownerName: string; ownerRole: string; saveError: string; onBack: () => void; onSave: () => void }) {
  return (
    <>
      <DetailHeader title="Confirm" eyebrow="REVIEW BEFORE SAVING" onBack={onBack} />
      <section className="confirm-card"><small>OWNER CORRECTION</small><h2>{interpretationLabels[interpretation]}</h2><p>“{note}”</p><span>{ownerName} · {ownerRole} · Today</span></section>
      <LinkedEvidenceCard moment={moment} petName={petName} detail={`1 linked moment${attachments.length ? ` + ${attachments.length} ${attachments.length === 1 ? 'attachment' : 'attachments'}` : ''}`} />
      <ContextAttachmentList attachments={attachments} />
      {saveError && <p className="inline-save-error" role="alert">{saveError}</p>}
      <section className="confirm-effects-card">
        <strong>After you save</strong>
        <p><span className="confirm-effect-icon is-complete" aria-hidden="true"><svg viewBox="0 0 18 18"><path d="m4.5 9.2 3 3 6-6.4" /></svg></span>Your context stays attributed to you</p>
        <p><span className="confirm-effect-icon is-complete" aria-hidden="true"><svg viewBox="0 0 18 18"><path d="m4.5 9.2 3 3 6-6.4" /></svg></span>The original observations stay available</p>
        <p><span className="confirm-effect-icon is-unchanged" aria-hidden="true"><svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="6.2" /><path d="M6.3 9h5.4" /></svg></span>Baseline is not changed automatically</p>
      </section>
      <StickyAction className="confirm-sticky-action" label="Save owner context" onClick={onSave} />
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

function releaseMirroredMediaCopies(session: PrototypeSession, previousSession: PrototypeSession | null) {
  const mirrored = new Map<string, Set<string>>();
  function add(key: string, value: unknown) {
    if (value === undefined || value === null) return;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (!serialized || serialized.length < 1024) return;
    if (!mirrored.has(key)) mirrored.set(key, new Set());
    mirrored.get(key)?.add(serialized);
  }
  for (const source of [session, previousSession].filter((entry): entry is PrototypeSession => entry !== null)) {
    for (const account of source.accounts) {
      add('pawsona-owner-avatar', account.avatar);
      for (const pet of account.pets) {
        add('pawsona-pet-avatar', pet.avatar);
        add(storageKey, pet.workspace.contexts);
        add('pawsona-story-observations-v1', pet.workspace.observations);
        add(storyDraftsKey, pet.workspace.drafts);
        add(askMessagesKey, pet.workspace.askMessages);
      }
    }
  }
  for (const [key, copies] of mirrored) {
    try {
      const stored = localStorage.getItem(key);
      if (stored && copies.has(stored)) localStorage.removeItem(key);
    } catch { /* Storage cleanup is best effort; the original session stays intact. */ }
  }
}

function defaultCareMembers(ownerName: string): CareMember[] {
  return [{ id: 'emily', name: ownerName, role: 'Primary owner', detail: 'manages the profile' }];
}

function withoutExampleCareMembers(members: CareMember[]): CareMember[] {
  return members.filter((member) => !((member.id === 'mom' && member.name === 'Mom') || (member.id === 'dad' && member.name === 'Dad')));
}

function emptyPetWorkspace(ownerName: string): PetWorkspace {
  return {
    groupName: 'Care circle',
    contexts: [],
    observations: [],
    momentEngagement: {},
    drafts: [],
    visibility: null,
    askMessages: [],
    careMembers: defaultCareMembers(ownerName),
    careEvent: null,
    mediaSources: defaultMediaSources(false),
    patterns: [],
    lifeEvents: [],
  };
}

function currentLegacyWorkspace(ownerName: string): PetWorkspace {
  return {
    groupName: 'Care circle',
    contexts: readSavedContexts(),
    observations: readStoryObservations(),
    momentEngagement: {},
    drafts: readStoryDrafts(),
    visibility: readStoryVisibility(),
    askMessages: readAskMessages(),
    careMembers: withoutExampleCareMembers(readCareMembers() ?? defaultCareMembers(ownerName)),
    careEvent: readCareEvent(),
    mediaSources: readMediaSources(true),
    patterns: readTypicalPatterns(ownerName, true),
    lifeEvents: readLifeCareEvents(),
  };
}

function normalizeWorkspace(value: unknown, ownerName: string, hasDemoData: boolean): PetWorkspace {
  const fallback = emptyPetWorkspace(ownerName);
  if (typeof value !== 'object' || value === null) return fallback;
  const workspace = value as Partial<PetWorkspace>;
  return {
    groupName: typeof workspace.groupName === 'string' && workspace.groupName.trim() ? workspace.groupName : 'Care circle',
    contexts: Array.isArray(workspace.contexts) ? workspace.contexts : [],
    observations: Array.isArray(workspace.observations) ? workspace.observations : [],
    momentEngagement: workspace.momentEngagement && typeof workspace.momentEngagement === 'object' ? workspace.momentEngagement : {},
    drafts: Array.isArray(workspace.drafts) ? workspace.drafts : [],
    visibility: workspace.visibility === null || (Array.isArray(workspace.visibility) && workspace.visibility.every((id) => typeof id === 'string')) ? workspace.visibility : null,
    askMessages: Array.isArray(workspace.askMessages) ? workspace.askMessages : [],
    askOwnerAccountId: typeof workspace.askOwnerAccountId === 'string' ? workspace.askOwnerAccountId : undefined,
    careMembers: Array.isArray(workspace.careMembers) ? withoutExampleCareMembers(workspace.careMembers) : fallback.careMembers,
    careEvent: typeof workspace.careEvent === 'object' ? workspace.careEvent ?? null : null,
    mediaSources: Array.isArray(workspace.mediaSources) ? workspace.mediaSources : defaultMediaSources(hasDemoData),
    patterns: Array.isArray(workspace.patterns) ? workspace.patterns : defaultTypicalPatterns(ownerName, hasDemoData),
    lifeEvents: Array.isArray(workspace.lifeEvents) ? workspace.lifeEvents : [],
  };
}

function privateAskMessagesFor(pet: PrototypePet | undefined, accountId: string | undefined): AskMessage[] {
  if (!pet) return readAskMessages();
  if (!pet.sharedGroupId) return pet.workspace.askMessages;
  const historyOwnerId = pet.workspace.askOwnerAccountId;
  const belongsToAccount = historyOwnerId ? historyOwnerId === accountId : accountId === pet.sharedOwnerAccountId;
  return belongsToAccount ? pet.workspace.askMessages : [];
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
        const hasDemoMoments = typeof pet.hasDemoMoments === 'boolean' ? pet.hasDemoMoments : pet.id === 'pet-primary';
        const inferredEmptyProfile = pet.name === 'My pet' && !hasDemoMoments && typeof pet.sharedGroupId !== 'string';
        return [{
          id: pet.id,
          name: pet.name,
          breed: typeof pet.breed === 'string' ? pet.breed : 'Mixed breed',
          species: (pet.species === 'Cat' ? 'Cat' : 'Dog') as 'Dog' | 'Cat',
          age: typeof pet.age === 'string' ? pet.age : '1',
          avatar: typeof pet.avatar === 'string' ? pet.avatar : '',
          hasDemoMoments,
          isEmptyProfile: inferredEmptyProfile || pet.isEmptyProfile === true,
          sharedGroupId: typeof pet.sharedGroupId === 'string' ? pet.sharedGroupId : undefined,
          sharedOwnerAccountId: typeof pet.sharedOwnerAccountId === 'string' ? pet.sharedOwnerAccountId : undefined,
          workspace: normalizeWorkspace(pet.workspace, accountName, hasDemoMoments),
        }];
      });
      if (!pets.length) return [];
      // Older invitation flows could leave the account's empty placeholder beside
      // the newly shared pet. A real pet replaces that placeholder.
      const availablePets = pets.some((pet) => !pet.isEmptyProfile) ? pets.filter((pet) => !pet.isEmptyProfile) : pets;
      return [{
        id: account.id,
        name: account.name,
        email: account.email,
        role: typeof account.role === 'string' ? account.role : 'Primary caregiver',
        avatar: typeof account.avatar === 'string' ? account.avatar : '',
        preference: typeof account.preference === 'string' ? account.preference : 'Manage your profile details here.',
        pets: availablePets,
        activePetId: availablePets.some((pet) => pet.id === account.activePetId) ? account.activePetId as string : availablePets[0].id,
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

function persistLocalPrototypeSession(session: PrototypeSession) {
  const serialized = JSON.stringify(session);
  try {
    localStorage.setItem(prototypeSessionKey, serialized);
  } catch (error) {
    let previousSession: PrototypeSession | null = null;
    try {
      const stored = localStorage.getItem(prototypeSessionKey);
      previousSession = stored ? JSON.parse(stored) as PrototypeSession : null;
    } catch { /* Preserve the current session and continue with best-effort cleanup. */ }
    releaseMirroredMediaCopies(session, previousSession);
    localStorage.setItem(prototypeSessionKey, serialized);
  }
}

function AskPage({ onPetsNavigate, petName, petAvatar, messages, messageEndRef, noPetYet, busy, pending, live }: { onPetsNavigate: () => void; petName: string; petAvatar: string; messages: AskMessage[]; messageEndRef: RefObject<HTMLDivElement | null>; noPetYet: boolean; busy: boolean; pending: AskMessage | null; live: boolean }) {
  return <div className="ask-page">
    <MainHeader eyebrow="ASK AI · OBSERVATION DIALOGUE" title="Ask Pawsona" onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} hasPet={!noPetYet} />
    <p className="ask-ai-notice">{!live ? 'Log in to chat with Pawsona. Guest conversations are available to review only.' : noPetYet ? 'Add your pet profile to start a conversation.' : 'Ask a question or share a photo. Your messages, photos and pet basics are sent to OpenAI to generate replies. AI observations can be mistaken.'}</p>
    <section className="ask-thread" aria-label="Conversation with Pawsona" aria-busy={busy}>
      {messages.length === 0 && <article className="chat-message ai">Hi! What would you like to know about {petName}? You can ask a question or attach a photo. I can help describe what is visible, but a photo alone cannot tell me how your pet feels or establish a diagnosis.</article>}
      {[...messages, ...(pending ? [pending] : [])].map((message, index) => <article className={`chat-message ${message.role === 'user' ? 'owner' : 'ai dynamic-answer'}`} key={index}>
        {message.attachment && (message.attachment.kind === 'image' ? <img className="chat-attachment" src={message.attachment.url} alt={message.attachment.name} /> : <audio src={message.attachment.url} controls aria-label={message.attachment.name} />)}
        <span>{message.text}</span>
      </article>)}
      {busy && <article className="chat-message ai ask-thinking" role="status"><span className="loading-ring" /> Pawsona is thinking…</article>}
      <div ref={messageEndRef} />
    </section>
  </div>;
}

function AskComposer({ value, onValue, onSend, onQuickContext, saveError, busy, enabled }: { value: string; onValue: (value: string) => void; onSend: (attachment?: AskAttachment) => Promise<boolean>; onQuickContext: (value: string) => void; saveError: string; busy: boolean; enabled: boolean }) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const dock = dockRef.current; const phone = dock?.closest<HTMLElement>('.phone');
    if (!dock || !phone) return;
    const observer = new ResizeObserver(() => phone.style.setProperty('--ask-dock-height', `${dock.offsetHeight}px`));
    observer.observe(dock);
    return () => { observer.disconnect(); phone.style.removeProperty('--ask-dock-height'); };
  }, []);
  const [attachment, setAttachment] = useState<AskAttachment | undefined>();
  const [attachmentError, setAttachmentError] = useState('');
  const sendingRef = useRef(false);
  const [reading, setReading] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function attach(file?: File) {
    if (!file) return;
    setAttachmentError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      setAttachmentError('Choose a JPEG, PNG or WebP image smaller than 1 MB.'); return;
    }
    setReading(true);
    try {
      const url = await mediaDataUrl(file);
      if (mounted.current) setAttachment({ kind: 'image', name: file.name, type: file.type, url });
    } catch { if (mounted.current) setAttachmentError('Could not read this image. Please try another one.'); }
    finally { if (mounted.current) setReading(false); }
  }
  async function send() {
    if (busy || reading || !enabled || sendingRef.current) return;
    sendingRef.current = true;
    try { if (await onSend(attachment) && mounted.current) setAttachment(undefined); }
    finally { sendingRef.current = false; }
  }
  const disabled = busy || reading || !enabled;
  const notice = Boolean(attachment || attachmentError || saveError);
  return <section ref={dockRef} className={`ask-dock${notice ? ' has-attachment' : ''}`} aria-label="Ask Pawsona a question">
    <div className="quick-context-label">Quick questions</div>
    <div className="quick-chips">{['What can you observe?', 'What should I watch for?', 'Help me understand'].map(text => <button key={text} disabled={disabled} onClick={() => onQuickContext(text)}>{text}</button>)}</div>
    <div className={`ask-input-box${notice ? ' has-attachment' : ''}`}>
      {attachment && <div className="ask-attachment-preview"><div className="ask-attachment-tile image"><img src={attachment.url} alt={attachment.name} /><button type="button" disabled={busy} aria-label="Remove image attachment" onClick={() => { setAttachment(undefined); setAttachmentError(''); }}>×</button></div></div>}
      {(attachmentError || saveError) && <div className="ask-recording-error" role="alert"><span>{attachmentError || saveError}</span></div>}
      <textarea aria-label="What would you like to ask Pawsona?" placeholder={!enabled ? 'Log in and add a pet to start chatting' : 'Ask a question or share a photo…'} value={value} disabled={disabled} maxLength={4000} onChange={event => onValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
      <div className="ask-input-tools">
        <button aria-label="Attach an image" disabled={disabled} onClick={() => imageInputRef.current?.click()}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="m5 17 5-5 3 3 2-2 5 5" /></svg></button>
        <small className="ask-image-hint">{reading ? 'Reading image…' : 'JPG, PNG, WebP · up to 1 MB'}</small>
        <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { void attach(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        <button className="ask-send-button" aria-label={busy ? 'Waiting for reply' : saveError ? 'Retry message' : 'Send message'} disabled={disabled || (!value.trim() && !attachment)} onClick={() => void send()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg></button>
      </div>
    </div>
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

  return <div className="profile-dialog-backdrop" role="presentation" onClick={onClose}><section className="profile-dialog switcher-dialog" role="dialog" aria-modal="true" aria-labelledby="account-switcher-title" onClick={(event) => event.stopPropagation()}><button className="profile-dialog-close" aria-label="Close" onClick={onClose}>×</button><h2 id="account-switcher-title">Accounts</h2><p>Switching accounts also switches its saved pet spaces.</p><div className="switcher-list">{accounts.map((account) => <button key={account.id} className={account.id === activeAccountId ? 'selected' : ''} onClick={() => { if (account.id !== activeAccountId) onSwitch(account.id); onClose(); }}><OwnerAvatar src={account.avatar} name={account.name} /><span><strong>{account.name}</strong><small>{account.email}</small></span><em>{account.id === activeAccountId ? 'Current' : 'Switch'}</em></button>)}</div>{creating ? <form className="switcher-form" onSubmit={register}><label><span>Your name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span>First pet (optional)</span><input value={petName} onChange={(event) => setPetName(event.target.value)} placeholder="You can add a pet later" /></label>{error && <p className="account-form-error" role="alert">{error}</p>}<div className="member-removal-actions"><button type="button" className="cancel-button" onClick={() => { setCreating(false); setError(''); }}>Cancel</button><button className="primary-button" disabled={!name.trim() || !email.trim()}>Create</button></div></form> : <><button className="cancel-button full" onClick={() => setCreating(true)}>Create another account</button><button className="account-signout-link" onClick={onRequestSignOut}>Sign out of this account</button></>}</section></div>;
}

function PetSwitcher({ pets, activePetId, onClose, onSwitch, onAdd, onDelete, initialAdding = false }: { pets: PrototypePet[]; activePetId: string; onClose: () => void; onSwitch: (id: string) => void; onAdd: (name: string, breed: string, age: string, species: 'Dog' | 'Cat', avatar: string) => string; onDelete: (id: string) => string; initialAdding?: boolean }) {
  const visiblePets = pets.filter((pet) => !pet.isEmptyProfile);
  const [adding, setAdding] = useState(initialAdding);
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [species, setSpecies] = useState<'Dog' | 'Cat'>('Dog');
  const [avatar, setAvatar] = useState('');
  const [age, setAge] = useState('1');
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PrototypePet | null>(null);

  function add(event: FormEvent) {
    event.preventDefault();
    const nextError = onAdd(name.trim(), breed.trim(), age.trim(), species, avatar);
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

  function readPetAvatar(file?: File) {
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
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  return <div className="profile-dialog-backdrop" role="presentation" onClick={onClose}><section className="profile-dialog switcher-dialog" role="dialog" aria-modal="true" aria-labelledby="pet-switcher-title" onClick={(event) => event.stopPropagation()}><button className="profile-dialog-close" aria-label="Close" onClick={onClose}>×</button><h2 id="pet-switcher-title">Pet profiles</h2><p>{visiblePets.length ? 'Choose which pet’s Today, Story and context you want to view.' : 'Add a pet profile to continue to Today, Story and context.'}</p>{visiblePets.length > 0 && <div className="switcher-list pet-switcher-list">{visiblePets.map((pet) => <div key={pet.id} className={`pet-switcher-row ${pet.id === activePetId ? 'selected' : ''}`}><button className="pet-switcher-choice" onClick={() => { if (pet.id !== activePetId) onSwitch(pet.id); onClose(); }}><Avatar name={pet.name} src={pet.avatar} /><span><strong>{pet.name}</strong><small>{pet.breed} · {formatPetAge(pet.age)}</small></span><em>{pet.id === activePetId ? 'Current' : 'Switch'}</em></button><button className="pet-profile-delete" disabled={visiblePets.length === 1} aria-label={visiblePets.length === 1 ? `${pet.name} is the only pet and cannot be deleted` : `Delete ${pet.name}`} title={visiblePets.length === 1 ? 'Add another pet before deleting this one' : `Delete ${pet.name}`} onClick={() => { setError(''); setPendingDelete(pet); }}>Delete</button></div>)}</div>}{visiblePets.length === 1 && <p className="pet-delete-help">Add another pet before deleting this profile.</p>}{error && !adding && <p className="account-form-error" role="alert">{error}</p>}{adding ? <form className="switcher-form" onSubmit={add}><div className="pet-photo-field"><label className="profile-avatar-upload" aria-label="Upload pet photo">{avatar ? <img className="profile-edit-avatar pet-edit-avatar" src={avatar} alt={name || 'Pet'} /> : <span className="profile-edit-avatar pet-edit-avatar pet-photo-placeholder" aria-hidden="true">＋</span>}<span className="avatar-edit-badge" aria-hidden="true">✎</span><input type="file" accept="image/*" aria-label="Choose pet photo" onChange={(event) => readPetAvatar(event.target.files?.[0])} /></label><span>Add a pet photo</span></div><fieldset className="pet-species-field"><legend>Pet type</legend><div className="pet-species-options">{(['Dog', 'Cat'] as const).map((option) => <button key={option} type="button" aria-pressed={species === option} className={species === option ? 'selected' : ''} onClick={() => setSpecies(option)}>{option === 'Dog' ? '🐕 Dog' : '🐈 Cat'}</button>)}</div></fieldset><label><span>Pet name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Breed</span><input value={breed} onChange={(event) => setBreed(event.target.value)} placeholder="Mixed breed" /></label><label><span>Age</span><input type="number" min="0" max="40" value={age} onChange={(event) => setAge(event.target.value)} /></label>{error && <p className="account-form-error" role="alert">{error}</p>}<div className="member-removal-actions"><button type="button" className="cancel-button" onClick={() => { setAdding(false); setError(''); }}>Cancel</button><button className="primary-button" disabled={!name.trim() || !breed.trim() || !age.trim()}>Add pet</button></div></form> : <button className="cancel-button full" onClick={() => setAdding(true)}>Add a pet</button>}{pendingDelete && <div className="nested-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}><section className="profile-dialog member-removal-dialog pet-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-pet-title" onClick={(event) => event.stopPropagation()}><h2 id="delete-pet-title">Delete {pendingDelete.name}?</h2><p>This permanently removes this pet profile and its timeline, Story, context and Ask AI history from this device. Other pets will not be changed.</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-button" onClick={() => { setPendingDelete(null); confirmDelete(); }}>Delete pet</button></div></section></div>}</section></div>;
}

function SimplePage({ kind, petName, petAvatar, petBreed, petAge, ownerName, ownerRole = 'Primary caregiver', ownerAvatar = '', ownerPreference = 'Manage your profile details here.', pets, activePetId, onPetsNavigate, onSettingsNavigate, onPetEdit, onProfileEdit, onPetSwitcher, careMembers, accounts, primaryMemberId, onMemberClick, onCareMembers, patterns, lifeEvents, mediaSources, onPatternHistory, onPattern, onLifeCare, onConnectedMedia, invitations = [], onAcceptInvitation, onDeclineInvitation, careOwnerName = ownerName, careOwnerAvatar = ownerAvatar, careOwnerRole = ownerRole, groupName = 'Care circle', canManageCareGroup = primaryMemberId === 'emily', canEditPetDetails = true, canAddLifeCare = true, canManageConnectedMedia = true, noPetYet = false }: { kind: 'pets' | 'you'; petName: string; petAvatar: string; petBreed: string; petAge: string; ownerName: string; ownerRole?: string; ownerAvatar?: string; ownerPreference?: string; pets: PrototypePet[]; activePetId: string; accounts: PrototypeAccount[]; onPetsNavigate: () => void; onSettingsNavigate: () => void; onPetEdit: () => void; onProfileEdit: () => void; onPetSwitcher: () => void; careMembers: CareMember[]; primaryMemberId: string; onMemberClick: (id: string) => void; onCareMembers: () => void; patterns: TypicalPattern[]; lifeEvents: LifeCareEvent[]; mediaSources: MediaSource[]; onPatternHistory: () => void; onPattern: (id: string) => void; onLifeCare: (category?: 'life' | 'health') => void; onConnectedMedia: (sourceId?: string) => void; invitations?: CareInvitation[]; onAcceptInvitation?: (invite: CareInvitation) => void; onDeclineInvitation?: (inviteId: string) => void; careOwnerName?: string; careOwnerAvatar?: string; careOwnerRole?: string; groupName?: string; canManageCareGroup?: boolean; canEditPetDetails?: boolean; canAddLifeCare?: boolean; canManageConnectedMedia?: boolean; noPetYet?: boolean }) {
  const petDetailsLabel = `${petBreed} · ${formatPetAge(petAge)}`;
  const displayPets = pets.filter((pet) => !pet.isEmptyProfile);
  const confirmedPatterns = patterns.filter((pattern) => pattern.status === 'confirmed');
  return kind === 'pets' ? (
    <div className="profile-page pets-page">
      <MainHeader eyebrow="PET PROFILE" title="Pet profile" onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} hasPet={!noPetYet} />
      {noPetYet ? <section className="today-empty-state pets-empty-state"><span>＋</span><h2>You haven’t added a pet yet</h2><p>Add one to get started.</p><button className="primary-button" onClick={onPetSwitcher}>Add a pet</button></section> : <>
      <section className="pet-profile-hero">
        <Avatar name={petName} src={petAvatar} />
        <div className="profile-hero-copy"><strong>{petName}</strong><small>{petDetailsLabel}</small><div className="pet-hero-actions">{canEditPetDetails && <button className="mini-action" onClick={onPetEdit}><span>✎</span> Edit details</button>}<button className="mini-action" onClick={onPetSwitcher}>⇄ Switch pet</button></div></div>
      </section>

      <section className="profile-section care-section">
        <h2>Who looks after {petName}?</h2>
        <div className="profile-card care-card">
          <div className="card-topline"><strong>{groupName}</strong>{canManageCareGroup && <button className="profile-link" onClick={onCareMembers}>Manage members →</button>}</div>
        {careMembers.map((member) => { const linkedAccount = accounts.find((account) => account.id === member.id || (!!member.email && account.email.toLowerCase() === member.email.toLowerCase())); const memberName = member.id === primaryMemberId ? careOwnerName : linkedAccount?.name ?? member.name; const memberAvatar = member.id === primaryMemberId ? careOwnerAvatar : linkedAccount?.avatar ?? member.avatar ?? ''; return <button className="member-row" key={member.id} onClick={() => onMemberClick(member.id)}><OwnerAvatar src={memberAvatar} name={memberName} className={member.id === primaryMemberId ? '' : `${member.id}-avatar`} /><span><strong>{memberName}</strong>{member.id === primaryMemberId && <small>{careOwnerRole}</small>}</span><i>›</i></button>; })}
        </div>
      </section>

      <section className="profile-section">
        <div className="profile-section-heading"><h2>Typical patterns</h2><button className="profile-link" onClick={onPatternHistory}>View history →</button></div>
        <div className="profile-card pattern-card">
          <strong className="card-caption">Owner-confirmed knowledge</strong>
          {confirmedPatterns.map((pattern, index) => <button className="knowledge-row" key={pattern.id} onClick={() => onPattern(pattern.id)}><span className="knowledge-icon">{index % 3 === 0 ? '☼' : index % 3 === 1 ? '☁' : '♥'}</span><span><strong>{pattern.title}</strong><small>{pattern.evidence}</small></span><i>›</i></button>)}
          {!confirmedPatterns.length && <div className="knowledge-empty"><strong>No confirmed patterns yet</strong><small>Patterns appear only after an owner confirms them.</small></div>}
        </div>
      </section>

      <section className="profile-section context-section">
        <div className="profile-section-heading"><h2>Life &amp; care context</h2>{canAddLifeCare && <button className="profile-link" onClick={() => onLifeCare()}>Add event +</button>}</div>
        <div className="profile-card context-card">
          <button className="knowledge-row" onClick={() => onLifeCare('life')}><span className="knowledge-icon">≡</span><span><strong>Life-stage notes</strong><small>{lifeEvents.filter((event) => event.category === 'life').length || 'No'} saved events · routine and care changes</small></span><i>›</i></button>
          <button className="knowledge-row" onClick={() => onLifeCare('health')}><span className="knowledge-icon">＋</span><span><strong>Health &amp; care notes</strong><small>{lifeEvents.filter((event) => event.category === 'health').length || 'No'} owner records · not an AI diagnosis</small></span><i>›</i></button>
        </div>
      </section>
      </>}
    </div>
  ) : (
    <div className="profile-page you-page">
      <MainHeader eyebrow="MY SPACE" title="My Profile" onPetsNavigate={onPetsNavigate} onSettingsNavigate={onSettingsNavigate} petName={petName} petAvatar={petAvatar} hasPet={!noPetYet} />
      <button className="account-profile-hero" onClick={onProfileEdit}>
        <OwnerAvatar src={ownerAvatar} name={ownerName} className="account-avatar" />
        <span className="profile-hero-copy"><strong>{ownerName}</strong><small>{ownerPreference}</small><span className="mini-action"><b>✎</b> Edit my profile</span></span>
      </button>

      <section className="profile-section you-section">
        <div className="profile-section-heading"><h2>My pets</h2>{invitations.length > 0 && <span className="invitation-count">{invitations.length} invitation{invitations.length === 1 ? '' : 's'}</span>}<button className="profile-link" onClick={onPetSwitcher}>Switch or add →</button></div>
        <div className="profile-card you-list pets-list">
          {displayPets.length ? displayPets.map((pet) => <button className="you-row" key={pet.id} onClick={() => pet.id === activePetId && canEditPetDetails ? onPetEdit() : onPetSwitcher()}><Avatar name={pet.name} src={pet.avatar} /><span><strong>{pet.name}</strong><small>{pet.breed} · {formatPetAge(pet.age)}</small></span><em>{pet.id === activePetId ? 'Active' : 'Switch'}</em></button>) : <div className="management-empty"><strong>You haven’t added a pet yet</strong><p>Add one to get started.</p><button className="profile-link" onClick={onPetSwitcher}>Add a pet →</button></div>}
        </div>
        {invitations.length > 0 && <div className="care-invitation-list" aria-label="Care group invitations">{invitations.map((invite) => <article className="care-invitation-card" key={invite.id}><div className="care-invitation-pet"><Avatar name={invite.petName} src={invite.petAvatar} /><span><strong>{invite.petName}’s care group</strong><small>Invited by <b>{invite.ownerName}</b></small></span></div><p><strong>{invite.ownerName}</strong> invited you to help care for <strong>{invite.petName}</strong> as a {invite.role.toLowerCase()}.</p><div className="care-invitation-actions"><button className="cancel-button" onClick={() => onDeclineInvitation?.(invite.id)}>Decline</button><button className="primary-button" onClick={() => onAcceptInvitation?.(invite)}>Accept invitation</button></div></article>)}</div>}
      </section>

      <section className="profile-section you-section media-section">
        <div className="profile-section-heading"><h2>Connected media</h2>{canManageConnectedMedia && <button className="profile-link" onClick={() => onConnectedMedia()}>Add source +</button>}</div>
        <div className="profile-card you-list media-list">
          {mediaSources.map((source) => <button className="media-row" key={source.id} disabled={!canManageConnectedMedia} onClick={() => canManageConnectedMedia && onConnectedMedia(source.id)}><span className="media-icon">{source.id === 'album' ? '▦' : source.id === 'camera' ? '◉' : '◇'}</span><span><strong>{source.title}</strong><small>{source.detail}{source.lastSync ? ` · ${source.lastSync}` : ''}</small></span><em className={source.status === 'connected' ? 'connected' : 'not-connected'}>{source.status === 'connected' ? 'Connected' : 'Not linked'}</em></button>)}
        </div>
      </section>

    </div>
  );
}

function ConnectedMediaPage({ petName, sources, initialSourceId, onBack, onUpdate, onDelete }: { petName: string; sources: MediaSource[]; initialSourceId: string | null; onBack: () => void; onUpdate: (source: MediaSource) => string; onDelete: (id: string) => string }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSourceId);
  const [adding, setAdding] = useState(initialSourceId === null);
  const [newTitle, setNewTitle] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [pendingDisconnect, setPendingDisconnect] = useState<MediaSource | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MediaSource | null>(null);
  const [saveError, setSaveError] = useState('');
  const selected = sources.find((source) => source.id === selectedId) ?? null;
  function connect(source: MediaSource) {
    const detail = source.id === 'album' ? `${petName} album` : source.id === 'camera' ? 'Living room camera' : source.id === 'feeder' ? `${petName} smart feeder` : source.detail;
    setSaveError(onUpdate({ ...source, detail, status: 'connected', lastSync: source.id === 'camera' ? 'Online' : 'Just now' }));
  }
  function addSource(event: FormEvent) {
    event.preventDefault();
    const source: MediaSource = { id: `media-${Date.now()}`, title: newTitle.trim(), detail: newDetail.trim() || 'Custom media source', status: 'not-linked' };
    const error = onUpdate(source); setSaveError(error);
    if (!error) { setSelectedId(source.id); setAdding(false); setNewTitle(''); setNewDetail(''); }
  }
  function disconnect() {
    if (!pendingDisconnect) return;
    const error = onUpdate({ ...pendingDisconnect, status: 'not-linked', lastSync: undefined, detail: pendingDisconnect.id === 'album' ? 'Choose a pet album' : pendingDisconnect.id === 'camera' ? 'Choose a supported camera' : pendingDisconnect.id === 'feeder' ? 'Equipment can be added' : pendingDisconnect.detail });
    setSaveError(error); if (!error) setPendingDisconnect(null);
  }
  function deleteSource() {
    if (!pendingDelete) return;
    const error = onDelete(pendingDelete.id); setSaveError(error);
    if (!error) { setPendingDelete(null); setSelectedId(null); }
  }
  return <section className="settings-page pet-subpage knowledge-management-page">
    <header className="settings-header"><button className="back-button" aria-label="Back to profile" onClick={onBack}>←</button><h1>Connected media</h1></header>
    <div className="settings-eyebrow-row"><p className="settings-eyebrow">{petName.toUpperCase()} · MEDIA SOURCES</p><button className="profile-link" onClick={() => { setAdding(true); setSelectedId(null); setSaveError(''); }}>Add source +</button></div>
    <section className="settings-summary"><strong>Choose what Pawsona can use</strong><p>Connections belong only to {petName}. This prototype simulates permissions and syncing.</p></section>
    {adding && <form className="source-detail-card management-add-form" onSubmit={addSource}><p className="settings-eyebrow">NEW SOURCE</p><label><span>Source name</span><input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="e.g. Garden camera" /></label><label><span>Description</span><input value={newDetail} onChange={(event) => setNewDetail(event.target.value)} placeholder="Where or what this source is" /></label>{saveError && <p className="inline-save-error" role="alert">{saveError}</p>}<div className="source-detail-actions"><button type="button" className="cancel-button" onClick={() => setAdding(false)}>Cancel</button><button className="primary-button" disabled={!newTitle.trim()}>Add source</button></div></form>}
    <div className="source-management-list">{sources.map((source) => <button className={`source-management-row ${selectedId === source.id ? 'selected' : ''}`} key={source.id} onClick={() => { setSelectedId(source.id); setAdding(false); setSaveError(''); }}><span className="media-icon">{source.id === 'album' ? '▦' : source.id === 'camera' ? '◉' : source.id === 'feeder' ? '◇' : '+'}</span><span><strong>{source.title}</strong><small>{source.detail}{source.lastSync ? ` · ${source.lastSync}` : ''}</small></span><em className={source.status === 'connected' ? 'connected' : 'not-connected'}>{source.status === 'connected' ? 'Connected' : 'Not linked'}</em></button>)}{!sources.length && !adding && <div className="management-empty"><strong>No media sources</strong><p>Add an album or device for {petName}.</p></div>}</div>
    {selected && <section className="source-detail-card"><p className="settings-eyebrow">SOURCE DETAILS</p><h2>{selected.title}</h2><p>{selected.status === 'connected' ? `Only this selected source is connected to ${petName}. Existing Story moments stay in place if you disconnect or delete the source.` : `Connect this source to start adding new media for ${petName}.`}</p><div className="source-detail-actions">{selected.status === 'connected' ? <><button className="cancel-button" onClick={() => setSaveError(onUpdate({ ...selected, lastSync: 'Just now' }))}>Sync now</button><button className="danger-outline-button" onClick={() => setPendingDisconnect(selected)}>Disconnect</button></> : <button className="primary-button" onClick={() => connect(selected)}>Connect source</button>}<button className="danger-outline-button" onClick={() => setPendingDelete(selected)}>Delete</button></div>{saveError && <p className="inline-save-error" role="alert">{saveError}</p>}</section>}
    {pendingDisconnect && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDisconnect(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="disconnect-source-title" onClick={(event) => event.stopPropagation()}><h2 id="disconnect-source-title">Disconnect {pendingDisconnect.title}?</h2><p>Future media will stop syncing. Moments already saved in {petName}’s Story will remain.</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDisconnect(null)}>Cancel</button><button className="danger-button" onClick={disconnect}>Disconnect</button></div></section></div>}
    {pendingDelete && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-source-title" onClick={(event) => event.stopPropagation()}><h2 id="delete-source-title">Delete {pendingDelete.title}?</h2><p>This removes the source from {petName}’s profile. Existing Story moments will remain.</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-button" onClick={deleteSource}>Delete source</button></div></section></div>}
  </section>;
}

function PatternKnowledgePage({ petName, ownerName, patterns, initialPatternId, canManage, onBack, onSave, onDelete }: { petName: string; ownerName: string; patterns: TypicalPattern[]; initialPatternId: string | null; canManage: boolean; onBack: () => void; onSave: (pattern: TypicalPattern) => string; onDelete: (id: string) => string }) {
  const [selectedId, setSelectedId] = useState(initialPatternId);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDetail, setDraftDetail] = useState('');
  const [draftEvidence, setDraftEvidence] = useState('');
  const [pendingDelete, setPendingDelete] = useState<TypicalPattern | null>(null);
  const [saveError, setSaveError] = useState('');
  const visible = patterns.filter((pattern) => showArchived || pattern.status === 'confirmed');
  const selected = patterns.find((pattern) => pattern.id === selectedId) ?? null;
  function startAdd() { setAdding(true); setSelectedId(null); setEditing(false); setDraftTitle(''); setDraftDetail(''); setDraftEvidence(''); setSaveError(''); }
  function startEdit(pattern: TypicalPattern) { setDraftTitle(pattern.title); setDraftDetail(pattern.detail); setDraftEvidence(pattern.evidence); setEditing(true); setAdding(false); setSaveError(''); }
  function addPattern(event: FormEvent) {
    event.preventDefault();
    if (!draftTitle.trim() || !draftDetail.trim()) return;
    const pattern: TypicalPattern = { id: `pattern-${Date.now()}`, title: draftTitle.trim(), detail: draftDetail.trim(), evidence: draftEvidence.trim() || 'Added directly by the owner', confirmedBy: ownerName, updatedAt: new Date().toISOString(), status: 'confirmed' };
    const error = onSave(pattern); setSaveError(error);
    if (!error) { setSelectedId(pattern.id); setAdding(false); setDraftTitle(''); setDraftDetail(''); setDraftEvidence(''); }
  }
  function saveEdit() {
    if (!selected || !draftTitle.trim() || !draftDetail.trim()) return;
    const error = onSave({ ...selected, title: draftTitle.trim(), detail: draftDetail.trim(), evidence: draftEvidence.trim() || selected.evidence, updatedAt: new Date().toISOString() });
    setSaveError(error); if (!error) setEditing(false);
  }
  function toggleArchive(pattern: TypicalPattern) {
    const error = onSave({ ...pattern, status: pattern.status === 'archived' ? 'confirmed' : 'archived', updatedAt: new Date().toISOString() });
    setSaveError(error); if (!error) setSelectedId(null);
  }
  function deletePattern() {
    if (!pendingDelete) return;
    const error = onDelete(pendingDelete.id); setSaveError(error);
    if (!error) { setPendingDelete(null); setSelectedId(null); setEditing(false); }
  }
  return <section className="settings-page pet-subpage knowledge-management-page">
    <header className="settings-header"><button className="back-button" aria-label="Back to pet profile" onClick={onBack}>←</button><h1>Typical patterns</h1></header>
    <div className="settings-eyebrow-row"><p className="settings-eyebrow">OWNER-CONFIRMED KNOWLEDGE</p>{canManage && <div className="settings-eyebrow-actions"><button className="profile-link" onClick={startAdd}>Add pattern +</button><button className="profile-link" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Current only' : 'Show archived'}</button></div>}</div>
    <section className="settings-summary"><strong>Patterns over time</strong><p>Only patterns confirmed by a person appear as knowledge about {petName}.</p></section>
    {adding && <form className="pattern-detail-card management-add-form" onSubmit={addPattern}><p className="settings-eyebrow">NEW PATTERN</p><label><span>Pattern name</span><input autoFocus value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="e.g. Evening play burst" /></label><label><span>Description</span><textarea value={draftDetail} onChange={(event) => setDraftDetail(event.target.value)} placeholder="Describe what usually happens and when." /></label><label><span>Supporting information</span><textarea value={draftEvidence} onChange={(event) => setDraftEvidence(event.target.value)} placeholder="Owner notes or selected records" /></label>{saveError && <p className="inline-save-error" role="alert">{saveError}</p>}<div className="source-detail-actions"><button type="button" className="cancel-button" onClick={() => setAdding(false)}>Cancel</button><button className="primary-button" disabled={!draftTitle.trim() || !draftDetail.trim()}>Add pattern</button></div></form>}
    <div className="pattern-management-list">{visible.map((pattern) => <button key={pattern.id} className={`pattern-management-row ${selectedId === pattern.id ? 'selected' : ''}`} onClick={() => { setSelectedId(pattern.id); setAdding(false); setEditing(false); setSaveError(''); }}><span><strong>{pattern.title}</strong><small>{pattern.detail}</small></span><em className={pattern.status}>{pattern.status === 'archived' ? 'Archived' : 'Confirmed'}</em></button>)}{!visible.length && !adding && <div className="management-empty"><strong>No patterns here</strong><p>Add a pattern after an owner has confirmed it.</p></div>}</div>
    {selected && <section className="pattern-detail-card">{editing && canManage ? <><label><span>Pattern name</span><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} /></label><label><span>Description</span><textarea value={draftDetail} onChange={(event) => setDraftDetail(event.target.value)} /></label><label><span>Supporting information</span><textarea value={draftEvidence} onChange={(event) => setDraftEvidence(event.target.value)} /></label><div className="source-detail-actions"><button className="cancel-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-button" onClick={saveEdit}>Save changes</button></div></> : <><p className="settings-eyebrow">{selected.status.toUpperCase()}</p><h2>{selected.title}</h2><p>{selected.detail}</p><div className="pattern-evidence"><strong>Supporting information</strong><span>{selected.evidence}</span><small>Confirmed by {selected.confirmedBy} · {new Date(selected.updatedAt).toLocaleDateString('en-AU')}</small></div>{canManage && <div className="source-detail-actions"><button className="cancel-button" onClick={() => startEdit(selected)}>Edit pattern</button><button className="danger-outline-button" onClick={() => toggleArchive(selected)}>{selected.status === 'archived' ? 'Restore' : 'Archive'}</button><button className="danger-outline-button" onClick={() => setPendingDelete(selected)}>Delete</button></div>}</>}{saveError && <p className="inline-save-error" role="alert">{saveError}</p>}</section>}
    {pendingDelete && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-pattern-title" onClick={(event) => event.stopPropagation()}><h2 id="delete-pattern-title">Delete “{pendingDelete.title}”?</h2><p>This permanently removes the pattern from {petName}’s owner-confirmed knowledge.</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-button" onClick={deletePattern}>Delete pattern</button></div></section></div>}
  </section>;
}

function LifeCarePage({ petName, ownerName, primaryOwnerName, currentAccountId, events, initialCategory, startAdding, canAdd, canManageAll, onBack, onSave, onDelete }: { petName: string; ownerName: string; primaryOwnerName: string; currentAccountId: string; events: LifeCareEvent[]; initialCategory: 'life' | 'health' | null; startAdding: boolean; canAdd: boolean; canManageAll: boolean; onBack: () => void; onSave: (event: LifeCareEvent) => string; onDelete: (id: string) => string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [filter, setFilter] = useState<'all' | 'life' | 'health'>(initialCategory ?? 'all');
  const [showForm, setShowForm] = useState(startAdding);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState<'life' | 'health'>(initialCategory ?? 'life');
  const [type, setType] = useState('Routine change');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [ongoing, setOngoing] = useState(false);
  const [note, setNote] = useState('');
  const [useForAsk, setUseForAsk] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<LifeCareEvent | null>(null);
  const [saveError, setSaveError] = useState('');
  const visible = events.filter((event) => filter === 'all' || event.category === filter).sort((a, b) => b.startDate.localeCompare(a.startDate));
  function resetForm(nextCategory = initialCategory ?? 'life') { setEditingId(null); setCategory(nextCategory); setType(nextCategory === 'health' ? 'Health & care' : 'Routine change'); setTitle(''); setStartDate(today); setEndDate(''); setOngoing(false); setNote(''); setUseForAsk(true); setSaveError(''); }
  function canManageEvent(event: LifeCareEvent) { return canManageAll || (canAdd && event.authorId === currentAccountId); }
  function editEvent(event: LifeCareEvent) { if (!canManageEvent(event)) return; setEditingId(event.id); setCategory(event.category); setType(event.type); setTitle(event.title); setStartDate(event.startDate); setEndDate(event.endDate ?? ''); setOngoing(event.ongoing); setNote(event.note); setUseForAsk(event.useForAsk); setShowForm(true); setSaveError(''); }
  function saveEvent(event: FormEvent) {
    event.preventDefault();
    if (!canAdd) return;
    const existing = editingId ? events.find((entry) => entry.id === editingId) : undefined;
    if (existing && !canManageEvent(existing)) return;
    const next: LifeCareEvent = { id: editingId ?? `life-event-${Date.now()}`, category, type, title: title.trim(), startDate, endDate: ongoing ? undefined : endDate || undefined, ongoing, note: note.trim(), useForAsk, savedAt: new Date().toISOString(), authorId: existing?.authorId ?? currentAccountId, authorName: existing?.authorName ?? ownerName };
    const error = onSave(next); setSaveError(error); if (!error) { setFilter(category); setShowForm(false); resetForm(category); }
  }
  function confirmDelete() { if (!pendingDelete) return; const error = onDelete(pendingDelete.id); setSaveError(error); if (!error) setPendingDelete(null); }
  return <section className="settings-page pet-subpage knowledge-management-page life-care-page">
    <header className="settings-header"><button className="back-button" aria-label="Back to pet profile" onClick={onBack}>←</button><h1>Life &amp; care context</h1></header>
    <div className="settings-eyebrow-row"><p className="settings-eyebrow">OWNER RECORDS</p>{canAdd && <button className="profile-link" onClick={() => { resetForm(filter === 'health' ? 'health' : 'life'); setShowForm(true); }}>Add event +</button>}</div>
    <section className="settings-summary"><strong>Context beyond one moment</strong><p>Save changes that may matter across several days. A moment context still belongs to one specific Story card.</p></section>
    <div className="context-filter-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); setShowForm(false); }}>All</button><button className={filter === 'life' ? 'active' : ''} onClick={() => { setFilter('life'); setShowForm(false); }}>Life-stage</button><button className={filter === 'health' ? 'active' : ''} onClick={() => { setFilter('health'); setShowForm(false); }}>Health &amp; care</button></div>
    {showForm && canAdd && <form className="life-event-form" onSubmit={saveEvent}><div className="life-event-form-grid"><label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value as 'life' | 'health')}><option value="life">Life-stage</option><option value="health">Health &amp; care</option></select></label><label><span>Event type</span><select value={type} onChange={(event) => setType(event.target.value)}><option>Routine change</option><option>Life-stage change</option><option>Food change</option><option>Care handover</option><option>Health &amp; care</option><option>Other</option></select></label></div><label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Started a new food" /></label><div className="life-event-form-grid"><label><span>Start date</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>End date</span><input type="date" value={endDate} disabled={ongoing} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label></div><label className="context-checkbox"><input type="checkbox" checked={ongoing} onChange={(event) => setOngoing(event.target.checked)} /><span>Ongoing</span></label><label><span>What changed?</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write what happened and why it may matter." /></label><label className="context-checkbox"><input type="checkbox" checked={useForAsk} onChange={(event) => setUseForAsk(event.target.checked)} /><span>Allow Ask AI to use this owner-provided context</span></label>{saveError && <p className="inline-save-error" role="alert">{saveError}</p>}<div className="source-detail-actions"><button type="button" className="cancel-button" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button><button className="primary-button" disabled={!title.trim() || !startDate || !note.trim()}>{editingId ? 'Save changes' : 'Save event'}</button></div></form>}
    <div className="life-event-list">{visible.map((event) => { const manageable = canManageEvent(event); return <article className="life-event-card" key={event.id}><div><span className={`event-category ${event.category}`}>{event.category === 'health' ? 'Health & care' : 'Life-stage'}</span><strong>{event.title}</strong><small>{event.startDate}{event.ongoing ? ' · Ongoing' : event.endDate ? ` – ${event.endDate}` : ''}</small></div><p>{event.note}</p><small>Recorded by {event.authorName ?? primaryOwnerName}{event.useForAsk ? ' · Available to Ask AI' : ' · Private owner record'}</small>{manageable && <div className="life-event-actions"><button onClick={() => editEvent(event)}>Edit</button><button onClick={() => setPendingDelete(event)}>Delete</button></div>}</article>; })}{!visible.length && !showForm && <div className="management-empty"><strong>No events saved</strong><p>{canAdd ? `Add a dated life or care event for ${petName}.` : `No life or care events have been shared for ${petName}.`}</p></div>}</div>
    {pendingDelete && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-life-event-title" onClick={(event) => event.stopPropagation()}><h2 id="delete-life-event-title">Delete “{pendingDelete.title}”?</h2><p>This removes the event from {petName}’s life and care context. Moment notes and Story cards will not be changed.</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-button" onClick={confirmDelete}>Delete event</button></div></section></div>}
  </section>;
}

function SettingsHubPage({ accounts, activeAccountId, onBack, onSwitchAccount, onRegister, onDeleteAccount, onSignOut, onAction }: { accounts: PrototypeAccount[]; activeAccountId: string; onBack: () => void; onSwitchAccount: (id: string) => void; onRegister: (name: string, email: string, petName: string) => string; onDeleteAccount: (id: string) => string; onSignOut: () => void; onAction: (title: string, detail: string) => void }) {
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPetName, setNewPetName] = useState('');
  const [createError, setCreateError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PrototypeAccount | null>(null);
  const [deleteError, setDeleteError] = useState('');

  function createAccount(event: FormEvent) {
    event.preventDefault();
    const error = onRegister(newName.trim(), newEmail.trim(), newPetName.trim());
    setCreateError(error);
    if (!error) setCreatingAccount(false);
  }
  function confirmDeleteAccount() {
    if (!pendingDelete) return;
    const error = onDeleteAccount(pendingDelete.id);
    setDeleteError(error);
    if (!error) setPendingDelete(null);
  }
  const orderedAccounts = [...accounts].sort((a, b) => Number(b.id === activeAccountId) - Number(a.id === activeAccountId));

  return <section className="settings-hub-page">
    <header className="settings-hub-header"><button className="back-button" aria-label="Go back" onClick={onBack}>←</button><h1>Settings</h1></header>
    <div className="settings-hub-content">
      <section className="settings-hub-section"><h2>Account</h2><div className="profile-card settings-account-list">
        {orderedAccounts.map((account) => <div key={account.id} className={`settings-account-row ${account.id === activeAccountId ? 'current' : ''}`}><button className="settings-account-switch" aria-current={account.id === activeAccountId ? 'true' : undefined} onClick={() => { if (account.id !== activeAccountId) onSwitchAccount(account.id); }}><OwnerAvatar src={account.avatar} name={account.name} /><span><strong>{account.name}</strong><small>{account.email}</small></span><em>{account.id === activeAccountId ? 'Current' : 'Switch'}</em></button><button className="settings-account-delete" aria-label={`Delete ${account.name} account`} title={`Delete ${account.name} account`} onClick={() => { setDeleteError(''); setPendingDelete(account); }}>Delete</button></div>)}
        {!creatingAccount ? <button className="settings-create-account" onClick={() => { setCreateError(''); setCreatingAccount(true); }}>＋ Create another account</button> : <form className="settings-create-form" onSubmit={createAccount}>
        <label><span>Your name</span><input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} /></label>
        <label><span>Email</span><input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label>
        <label><span>First pet (optional)</span><input value={newPetName} onChange={(event) => setNewPetName(event.target.value)} placeholder="You can add a pet later" /></label>
        {createError && <p className="account-form-error" role="alert">{createError}</p>}
        <div className="member-removal-actions"><button type="button" className="cancel-button" onClick={() => setCreatingAccount(false)}>Cancel</button><button className="primary-button" disabled={!newName.trim() || !newEmail.trim()}>Create account</button></div>
        </form>}
      </div>
      <button className="settings-signout-row" onClick={onSignOut}><span className="settings-signout-icon" aria-hidden="true">↪</span><span><strong>Sign out</strong><small>Your local data will stay on this device</small></span><i>›</i></button></section>
      <section className="settings-hub-section"><div className="profile-section-heading"><h2>Privacy &amp; support</h2><button className="profile-link" onClick={() => onAction('Privacy & support', 'Review data permissions, sharing, retention and accessibility preferences.')}>Open →</button></div><div className="profile-card you-list privacy-list">
        <button className="media-row" onClick={() => onAction('Data, sharing & retention', 'Review permissions, access and deletion.')}><span className="media-icon">▤</span><span><strong>Data, sharing &amp; retention</strong><small>Review permissions, access and deletion</small></span><i>›</i></button>
        <button className="media-row" onClick={() => onAction('Accessibility & feedback', 'Text size, captions, help and suggestions.')}><span className="media-icon">◎</span><span><strong>Accessibility &amp; feedback</strong><small>Text size, captions, help and suggestions</small></span><i>›</i></button>
      </div></section>
    </div>
    {pendingDelete && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="settings-delete-account-title" onClick={(event) => event.stopPropagation()}><h2 id="settings-delete-account-title">Delete {pendingDelete.name}?</h2><p>This permanently removes this local account and the pets, moments and context saved inside it.</p>{deleteError && <p className="account-form-error" role="alert">{deleteError}</p>}<div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-button" onClick={confirmDeleteAccount}>Delete account</button></div></section></div>}
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

  function save() {
    const nextName = name.trim();
    const nextBreed = breed.trim();
    const nextAge = age.trim();
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
      <p className="settings-eyebrow">{pet ? 'PET PROFILE' : 'MY SPACE'}</p>
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
    </section>
  );
}

function PetSecondaryPage({ kind, petName, ownerName, ownerEmail, ownerAvatar = '', onTransferPrimary, groupName, onGroupNameChange, careMembers, primaryMemberId, isPrimaryCaregiver, onBack, onReviewEvidence, onSaveEvent, onMemberClick, onRemoveMember, onAddMember, accounts, activeAccountId, invitations, onChangeAccess, onChangeRole, onChangeExpiry, onCancelInvitation, cloudSearchEnabled = false }: { kind: 'careMembers' | 'patternHistory' | 'careEvent'; petName: string; ownerName: string; ownerEmail: string; ownerAvatar?: string; onTransferPrimary: (memberId: string) => string; groupName: string; onGroupNameChange: (name: string) => void; careMembers: CareMember[]; primaryMemberId: string; isPrimaryCaregiver: boolean; onBack: () => void; onReviewEvidence: () => void; onSaveEvent: (event: CareEvent) => boolean; onMemberClick: (id: string) => void; onRemoveMember: (id: string) => void; onAddMember: (name: string, email: string, role: 'Caregiver' | 'Viewer', recipientAccountId?: string) => string | Promise<string>; accounts: PrototypeAccount[]; activeAccountId: string; invitations: CareInvitation[]; onChangeAccess: (id: string, access: 'editor' | 'viewer') => void; onChangeRole: (id: string, role: 'Caregiver' | 'Temporary caregiver') => void; onChangeExpiry: (id: string, expiresAt: string) => void; onCancelInvitation: (id: string) => void; cloudSearchEnabled?: boolean }) {
  const [eventType, setEventType] = useState('Routine change');
  const [when, setWhen] = useState('Today');
  const [customDate, setCustomDate] = useState('');
  const [note, setNote] = useState('');
  const [openPicker, setOpenPicker] = useState<'type' | 'when' | null>(null);
  const [savedEvent, setSavedEvent] = useState(false);
  const [eventSaveError, setEventSaveError] = useState('');
  const [lastSavedEvent, setLastSavedEvent] = useState<CareEvent | null>(readCareEvent);
  const [pendingRemoval, setPendingRemoval] = useState<CareMember | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [draftGroupName, setDraftGroupName] = useState(groupName);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedInviteAccountId, setSelectedInviteAccountId] = useState('');
  const [cloudInviteResults, setCloudInviteResults] = useState<CareAccountSearchResult[]>([]);
  const [cloudInviteSearchState, setCloudInviteSearchState] = useState<'idle' | 'searching' | 'ready' | 'error'>('idle');
  const [newMemberRole, setNewMemberRole] = useState<'Caregiver' | 'Viewer'>('Caregiver');
  const [inviteError, setInviteError] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [showTransferPrimary, setShowTransferPrimary] = useState(false);
  const [nextPrimaryId, setNextPrimaryId] = useState('');
  const [transferError, setTransferError] = useState('');
  const isCareMembers = kind === 'careMembers';
  const isPatternHistory = kind === 'patternHistory';
  const careMemberCount = careMembers.length;
  const careMemberCountLabel = careMemberCount === 1 ? 'One person' : `${careMemberCount} people`;
  const title = isCareMembers ? `Who cares for ${petName}?` : isPatternHistory ? 'Typical patterns' : 'Life & care event';
  const eyebrow = isCareMembers ? 'SHARED CARE' : isPatternHistory ? 'OWNER-CONFIRMED KNOWLEDGE' : 'OWNER RECORD';
  const summaryTitle = isCareMembers ? 'Care circle' : isPatternHistory ? 'Patterns over time' : `Add context to ${petName}’s life`;
  const summaryNote = isCareMembers ? `${careMemberCountLabel} can add context to ${petName}’s day.` : isPatternHistory ? 'Compare observations by time period and source.' : 'Your note stays attributed to you.';
  const primaryCandidates = careMembers.filter((member) => member.id !== primaryMemberId && member.access !== 'viewer' && member.role !== 'Temporary caregiver' && accounts.some((account) => account.id === member.id || (!!member.email && account.email.toLowerCase() === member.email.toLowerCase())));

  useEffect(() => {
    if (!inviteNotice) return;
    const timer = window.setTimeout(() => setInviteNotice(''), 2000);
    return () => window.clearTimeout(timer);
  }, [inviteNotice]);

  useEffect(() => {
    const query = memberSearch.trim();
    setSelectedInviteAccountId('');
    if (!cloudSearchEnabled) {
      setCloudInviteResults([]);
      setCloudInviteSearchState(query ? 'ready' : 'idle');
      return;
    }
    if (query.length < 2) {
      setCloudInviteResults([]);
      setCloudInviteSearchState('idle');
      return;
    }
    let cancelled = false;
    setCloudInviteSearchState('searching');
    const timer = window.setTimeout(() => {
      void searchCareAccounts(query).then((results) => {
        if (!cancelled) {
          setCloudInviteResults(results.filter((account) => account.id !== activeAccountId));
          setCloudInviteSearchState('ready');
        }
      }).catch(() => {
        if (!cancelled) {
          setCloudInviteResults([]);
          setCloudInviteSearchState('error');
        }
      });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [memberSearch, activeAccountId, cloudSearchEnabled, accounts]);

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
      <div className="settings-eyebrow-row">{isCareMembers ? <>{editingGroupName ? <form className="care-group-name-form" onSubmit={(event) => { event.preventDefault(); onGroupNameChange(draftGroupName); setEditingGroupName(false); }}><input autoFocus aria-label="Group name" maxLength={40} value={draftGroupName} onChange={(event) => setDraftGroupName(event.target.value)} /><button type="submit" className="group-name-save" aria-label="Save group name"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.3 3.6 3.5 7.5-7.6" /></svg></button><button type="button" className="group-name-cancel" aria-label="Cancel editing group name" onClick={() => setEditingGroupName(false)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 5.5 9 9m0-9-9 9" /></svg></button></form> : <div className="care-group-name"><strong>{groupName}</strong>{isPrimaryCaregiver && <button className="group-name-edit" aria-label="Edit group name" onClick={() => { setDraftGroupName(groupName); setEditingGroupName(true); }}>✎</button>}</div>}</> : <p className="settings-eyebrow">{eyebrow}</p>}{isCareMembers && isPrimaryCaregiver && <div className="care-members-actions"><button className="profile-link" onClick={() => { setShowGroupSettings(true); setInviteNotice(''); }}>Group settings</button><button className="profile-link care-add-member" onClick={() => { setShowAddMember(true); setMemberSearch(''); setSelectedInviteAccountId(''); setInviteError(''); }}>Add +</button></div>}</div>
      {!isCareMembers && <section className="settings-summary">
        <strong>{summaryTitle}</strong>
        <p>{summaryNote}</p>
      </section>}
      {isCareMembers && inviteNotice && <div className="context-saved-toast" role="status"><span aria-hidden="true">✓</span>{inviteNotice}</div>}
      {isCareMembers ? <div className="care-member-details">
        {careMembers.map((member) => { const linkedAccount = accounts.find((account) => account.id === member.id || (!!member.email && account.email.toLowerCase() === member.email.toLowerCase())); const memberName = member.id === primaryMemberId ? ownerName : linkedAccount?.name ?? member.name; const memberAvatar = member.id === primaryMemberId ? ownerAvatar : linkedAccount?.avatar ?? member.avatar ?? ''; return <div className="care-person-wrap" key={member.id}>
          <button className="care-person-card" onClick={() => onMemberClick(member.id)}>
            <OwnerAvatar src={memberAvatar} name={memberName} className={`care-person-avatar ${member.id === primaryMemberId ? '' : `${member.id}-avatar`}`} />
            <span className="care-person-copy"><strong>{memberName}</strong><small>{member.email ?? (member.id === primaryMemberId ? ownerEmail : linkedAccount?.email ?? 'No linked account')}</small><span>{member.id === primaryMemberId ? 'Primary caregiver · Manages the profile' : (member.access ?? 'editor') === 'viewer' ? 'View shared records' : `${member.role} · Can add observations`}{member.role === 'Temporary caregiver' && member.expiresAt ? ` · Until ${member.expiresAt}` : ''}</span></span>
          </button>
        </div>; })}
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
      {pendingRemoval && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingRemoval(null)}><section className="profile-dialog member-removal-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-member-title" onClick={(event) => event.stopPropagation()}><h2 id="remove-member-title">Remove {pendingRemoval.name}?</h2><p>They will no longer be able to access {petName}’s care group.</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingRemoval(null)}>Cancel</button><button className="danger-button" onClick={() => { onRemoveMember(pendingRemoval.id); setPendingRemoval(null); }}>Remove member</button></div></section></div>}
      {showGroupSettings && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setShowGroupSettings(false)}>
        <section className="profile-dialog group-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="group-settings-title" onClick={(event) => event.stopPropagation()}>
          <h2 id="group-settings-title">Group settings</h2>
          <p className="group-settings-intro">Manage member accounts and what they can do for {petName}.</p>
          <div className="group-settings-list">{careMembers.map((member) => <div className="group-settings-row" key={member.id}>
            <div className="group-settings-identity"><strong>{member.id === primaryMemberId ? ownerName : member.name}</strong><small>{member.email ?? (member.id === primaryMemberId ? ownerEmail : 'No linked account')}</small></div>
            {member.id === primaryMemberId ? <>
              <span className="group-owner-tag">Primary caregiver</span>
              <div className="group-settings-controls"><button className="group-role-select group-transfer-button" disabled={!primaryCandidates.length} onClick={() => { setShowGroupSettings(false); setNextPrimaryId(primaryCandidates[0]?.id ?? ''); setTransferError(''); setShowTransferPrimary(true); }}>Transfer primary</button></div>
            </> : <>
              <div className="group-settings-controls">
                <select className="group-role-select" aria-label={`Role for ${member.name}`} value={member.role === 'Temporary caregiver' ? 'Temporary caregiver' : 'Caregiver'} onChange={(event) => onChangeRole(member.id, event.target.value as 'Caregiver' | 'Temporary caregiver')}><option value="Caregiver">Caregiver</option><option value="Temporary caregiver">Temporary</option></select>
                <select className="group-access-select" aria-label={`Permission for ${member.name}`} value={member.access ?? 'editor'} onChange={(event) => onChangeAccess(member.id, event.target.value as 'editor' | 'viewer')}><option value="editor">Can add</option><option value="viewer">View only</option></select>
                <button className="group-remove-button" onClick={() => { setPendingRemoval(member); setShowGroupSettings(false); }}>Remove</button>
              </div>
              {member.role === 'Temporary caregiver' && <label className="temporary-expiry-field"><span>Temporary access until</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={member.expiresAt ?? ''} onChange={(event) => onChangeExpiry(member.id, event.target.value)} /></label>}
            </>}
          </div>)}</div>
          {!primaryCandidates.length && <p className="group-settings-intro">Promote a linked member to regular Caregiver with Can add access before transferring the Primary caregiver role.</p>}
          {invitations.filter((invite) => invite.status === 'pending').length > 0 && <div className="group-pending-invites"><strong>Pending invitations</strong>{invitations.filter((invite) => invite.status === 'pending').map((invite) => <div key={invite.id}><span>{invite.email}<small>{invite.role}</small></span><button onClick={() => onCancelInvitation(invite.id)}>Cancel invite</button></div>)}</div>}
          <div className="member-removal-actions"><button className="primary-button" onClick={() => setShowGroupSettings(false)}>Done</button></div>
        </section>
      </div>}
      {showTransferPrimary && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setShowTransferPrimary(false)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="transfer-primary-title" onClick={(event) => event.stopPropagation()}><h2 id="transfer-primary-title">Transfer Primary caregiver?</h2><p>Choose who will become the main person responsible for {petName}. You will become a Caregiver after the transfer.</p><label className="settings-field"><strong>New Primary caregiver</strong><select value={nextPrimaryId} onChange={(event) => { setNextPrimaryId(event.target.value); setTransferError(''); }}>{primaryCandidates.map((member) => <option value={member.id} key={member.id}>{accounts.find((account) => account.id === member.id)?.name ?? member.name}</option>)}</select></label>{transferError && <p className="account-form-error" role="alert">{transferError}</p>}<div className="member-removal-actions"><button className="cancel-button" onClick={() => setShowTransferPrimary(false)}>Cancel</button><button className="danger-button" disabled={!nextPrimaryId} onClick={() => { const error = onTransferPrimary(nextPrimaryId); setTransferError(error); if (!error) setShowTransferPrimary(false); }}>Transfer primary</button></div></section></div>}
      {showAddMember && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setShowAddMember(false)}><form className="profile-dialog add-member-dialog" role="dialog" aria-modal="true" aria-labelledby="add-member-title" onClick={(event) => event.stopPropagation()} onSubmit={async (event) => { event.preventDefault(); const localRecipient = accounts.find((account) => account.id === selectedInviteAccountId && account.id !== activeAccountId); const cloudRecipient = cloudSearchEnabled ? cloudInviteResults.find((account) => account.id === selectedInviteAccountId) : undefined; if (cloudSearchEnabled ? !cloudRecipient : !localRecipient) { setInviteError('Choose an existing account from the search results.'); return; } const targetName = cloudRecipient?.displayName ?? localRecipient!.name; const targetEmail = cloudRecipient ? cloudRecipient.username + '@users.pawsona.invalid' : localRecipient!.email; const result = await onAddMember(targetName, targetEmail, newMemberRole, selectedInviteAccountId); if (result) { setInviteError(result); return; } setInviteNotice('Invitation sent to ' + targetName + '.'); setMemberSearch(''); setSelectedInviteAccountId(''); setNewMemberRole('Caregiver'); setInviteError(''); setShowAddMember(false); }}><h2 id="add-member-title">Invite to care group</h2><p className="group-settings-intro">Search for a registered account by name, username, or email, then select it.</p><label className="settings-field"><strong>Name, username, or email</strong><input autoFocus value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); setSelectedInviteAccountId(''); setInviteError(''); }} placeholder="Search name, username, or email" /></label>{memberSearch.trim() && <div className="invite-search-results">{cloudSearchEnabled ? cloudInviteSearchState === 'searching' ? <p>Searching registered accounts…</p> : cloudInviteSearchState === 'error' ? <p role="alert">Account search is unavailable. Apply the latest database migration and try again.</p> : cloudInviteSearchState === 'idle' ? <p>Enter at least 2 characters to search.</p> : cloudInviteResults.length ? cloudInviteResults.map((account) => <button type="button" className={selectedInviteAccountId === account.id ? 'selected' : ''} key={account.id} onClick={() => setSelectedInviteAccountId(account.id)}><strong>{account.displayName}</strong><small>@{account.username}</small></button>) : <p>No registered account found.</p> : (() => { const results = accounts.filter((account) => account.id !== activeAccountId && (account.name + ' ' + account.email).toLowerCase().includes(memberSearch.toLowerCase())); return results.length ? results.map((account) => <button type="button" className={selectedInviteAccountId === account.id ? 'selected' : ''} key={account.id} onClick={() => setSelectedInviteAccountId(account.id)}><strong>{account.name}</strong><small>{account.email}</small></button>) : <p>No saved account found. Invitations are limited to existing accounts.</p>; })()}</div>}<label className="settings-field"><strong>Permission</strong><select value={newMemberRole} onChange={(event) => setNewMemberRole(event.target.value as 'Caregiver' | 'Viewer')}><option value="Caregiver">Can add observations</option><option value="Viewer">View only</option></select></label>{inviteError && <p className="account-form-error" role="alert">{inviteError}</p>}<div className="member-removal-actions"><button type="button" className="cancel-button" onClick={() => setShowAddMember(false)}>Cancel</button><button type="submit" className="primary-button" disabled={!selectedInviteAccountId}>Send invitation</button></div></form></div>}
    </section>
  );
}

function CareMemberDetailsPage({ member, ownerName, ownerRole, ownerAvatar, ownerPreference, memberAvatar = '', memberPreference = '', primaryMemberId, isPrimaryCaregiver, petName, onBack }: { member: CareMember; ownerName: string; ownerRole: string; ownerAvatar: string; ownerPreference: string; memberAvatar?: string; memberPreference?: string; primaryMemberId: string; isPrimaryCaregiver: boolean; petName: string; onBack: () => void }) {
  const name = member.id === primaryMemberId ? ownerName : member.name;
  const primary = member.id === primaryMemberId;
  const avatar = primary ? ownerAvatar : memberAvatar;
  const preference = primary ? ownerPreference : memberPreference;
  if (primary && isPrimaryCaregiver) return <section className="settings-page pet-subpage">
    <header className="settings-header"><button className="back-button" aria-label="Back to pet profile" onClick={onBack}>←</button><h1>Account details</h1></header>
    <p className="settings-eyebrow">CARE MEMBER</p>
    <section className="settings-summary profile-summary"><OwnerAvatar src={avatar} name={name} className="profile-edit-avatar" /><div className="profile-summary-copy"><strong>{name}</strong><p>{preference}</p></div></section>
    <div className="care-event-details member-account-details">
      <div className="settings-field"><strong>Name</strong><p>{ownerName}</p></div>
      <div className="settings-field"><strong>Role</strong><p>{ownerRole}</p></div>
      <div className="settings-field"><strong>Preferences</strong><p>{ownerPreference}</p></div>
      <div className="settings-field"><strong>Care access</strong><p>{primary ? 'Manages the profile' : member.access === 'viewer' ? 'View shared records' : 'Can add observations'}</p></div>
    </div>
  </section>;
  return <section className="settings-page pet-subpage">
    <header className="settings-header"><button className="back-button" aria-label="Back to pet profile" onClick={onBack}>←</button><h1>Account details</h1></header>
    <p className="settings-eyebrow">CARE MEMBER</p>
    <section className="settings-summary profile-summary"><OwnerAvatar src={avatar} name={name} className="profile-edit-avatar" /><div className="profile-summary-copy"><strong>{name}</strong><p>{preference || `Care profile for ${petName}’s care circle.`}</p></div></section>
    <div className="care-event-details member-account-details">
      <div className="settings-field"><strong>Name</strong><p>{name}</p></div>
      <div className="settings-field"><strong>Role</strong><p>{primary ? member.role || 'Primary caregiver' : member.role}</p></div>
      <div className="settings-field"><strong>Care access</strong><p>{primary ? 'Manages the profile' : member.access === 'viewer' ? 'View shared records' : member.role === 'Temporary caregiver' ? 'Can add daily observations and moment context' : 'Can add observations and manage long-term care records'}</p></div>
      {member.role === 'Temporary caregiver' && <div className="settings-field"><strong>Access until</strong><p>{member.expiresAt || 'No end date set'}</p></div>}
    </div>
  </section>;
}

type AppProps = {
  notice?: ReactNode;
  cloud?: {
    initialSession: PrototypeSession; save: (session: PrototypeSession) => void; signOut: () => void; addAnotherAccount: () => void;
    accounts: { username: string; name: string }[]; switchAccount: (username: string) => void; removeAccount: (username: string) => Promise<void>;
    listInvitations: () => Promise<CloudCareInvitation[]>;
    listGroups: () => Promise<CloudCareGroup[]>;
    sendInvitation: (input: { groupId: string; recipientId: string; role: 'Caregiver' | 'Viewer'; petId: string; petName: string; petBreed: string; petAge: string; petAvatar: string; petSpecies: 'Dog' | 'Cat'; groupName: string; workspace: Record<string, unknown> }) => Promise<string>;
    respondInvitation: (id: string, response: 'accepted' | 'declined') => Promise<CloudCareGroup | null>;
    cancelInvitation: (id: string) => Promise<void>;
    removeCareMember: (groupId: string, memberId: string) => Promise<void>;
    updateCareMember: (groupId: string, memberId: string, role: 'Caregiver' | 'Viewer') => Promise<void>;
    saveCareGroup: (groupId: string, pet: { name: string; breed: string; age: string; avatar: string; species: 'Dog' | 'Cat' }, groupName: string, workspace: Record<string, unknown>) => Promise<void>;
  };
  guest?: boolean;
  onExit?: () => void;
};

export function createCloudSession(id: string, email: string, name: string): PrototypeSession {
  const petId = 'pet-' + crypto.randomUUID();
  return { activeAccountId: id, accounts: [{ id, email, name, role: 'Primary caregiver', avatar: '', preference: '', activePetId: petId,
    pets: [{ id: petId, name: 'My pet', breed: 'Mixed breed', age: '1', avatar: '', hasDemoMoments: false, isEmptyProfile: true, workspace: emptyPetWorkspace(name) }] }] };
}

export default function App({ cloud, guest = false, onExit, notice }: AppProps) {
  function persistPrototypeSession(session: PrototypeSession) {
    if (cloud) cloud.save(session);
    else persistLocalPrototypeSession(session);
  }
  const [entranceOpen, setEntranceOpen] = useState(!cloud && !guest);
  const [prototypeSession, setPrototypeSession] = useState<PrototypeSession>(() => {
    if (cloud) return cloud.initialSession;
    const session = readPrototypeSession();
    if (guest) {
      const demo = session.accounts.find(account => account.pets.some(pet => pet.hasDemoMoments));
      if (demo) return { ...session, activeAccountId: demo.id, accounts: session.accounts.map(account => account.id === demo.id ? { ...account, activePetId: account.pets.find(pet => pet.hasDemoMoments)!.id } : account) };
      const fresh = createInitialPrototypeSession();
      fresh.accounts[0].pets[0].name = 'Luna';
      return { ...fresh, accounts: [...session.accounts, ...fresh.accounts] };
    }
    return session;
  });
  const [view, setView] = useState<View>('today');
  const initialAccount = prototypeSession.accounts.find((entry) => entry.id === prototypeSession.activeAccountId);
  const initialPet = initialAccount?.pets.find((entry) => entry.id === initialAccount.activePetId) ?? initialAccount?.pets[0];
  const initialWorkspace = initialPet?.workspace;
  const initialSharedOwnerWorkspace = initialPet?.sharedGroupId
    ? prototypeSession.accounts.find((entry) => entry.id === initialPet.sharedOwnerAccountId)?.pets.find((pet) => pet.sharedGroupId === initialPet.sharedGroupId)?.workspace
    : undefined;
  const initialSharedWorkspace = initialSharedOwnerWorkspace ?? initialWorkspace;
  const [petName, setPetName] = useState(() => initialPet?.name ?? readStorageString('pawsona-pet-name', 'Luna'));
  const [petAvatar, setPetAvatar] = useState(() => initialPet?.avatar ?? readStorageString('pawsona-pet-avatar', ''));
  const [petBreed, setPetBreed] = useState(() => initialPet?.breed ?? readStorageString('pawsona-pet-breed', 'Golden Retriever'));
  const [petAge, setPetAge] = useState(() => {
    const storedAge = initialPet?.age ?? readStorageString('pawsona-pet-age', '3');
    const numericAge = Number(storedAge);
    return Number.isInteger(numericAge) && numericAge >= 0 && numericAge <= 40 ? storedAge : '3';
  });
  const [ownerName, setOwnerName] = useState(() => initialAccount?.name ?? readStorageString('pawsona-owner-name', 'Emily'));
  const [ownerRole, setOwnerRole] = useState(() => initialAccount?.role ?? readStorageString('pawsona-owner-role', 'Primary caregiver'));
  const [ownerAvatar, setOwnerAvatar] = useState(() => initialAccount?.avatar ?? readStorageString('pawsona-owner-avatar', ''));
  const [ownerPreference, setOwnerPreference] = useState(() => initialAccount?.preference ?? readStorageString('pawsona-owner-preference', 'Manage your profile details here.'));
  const [profileSaveNotice, setProfileSaveNotice] = useState('');
  const [contextSavedNotice, setContextSavedNotice] = useState(false);
  const [storyDraftSavedNotice, setStoryDraftSavedNotice] = useState(false);
  const [savedContexts, setSavedContexts] = useState<OwnerContext[]>(() => {
    const account = prototypeSession.accounts.find((entry) => entry.id === prototypeSession.activeAccountId);
    const pet = account?.pets.find((entry) => entry.id === account.activePetId) ?? account?.pets[0];
    if (pet?.sharedGroupId) {
      const groupContexts = prototypeSession.accounts.flatMap((entry) => entry.pets.filter((groupPet) => groupPet.sharedGroupId === pet.sharedGroupId).flatMap((groupPet) => groupPet.workspace.contexts));
      return [...new Map(groupContexts.map((context) => [context.id, context])).values()].sort((left, right) => right.savedAt.localeCompare(left.savedAt));
    }
    return pet?.workspace.contexts ?? readSavedContexts();
  });
  const [storyObservations, setStoryObservations] = useState<StoryObservation[]>(initialWorkspace?.observations ?? readStoryObservations());
  const [momentEngagement, setMomentEngagement] = useState<MomentEngagementById>(() => initialWorkspace?.momentEngagement ?? {});
  const [storyDrafts, setStoryDrafts] = useState<StoryDraft[]>(initialWorkspace?.drafts ?? readStoryDrafts());
  const [includedStoryMoments, setIncludedStoryMoments] = useState<string[] | null>(initialWorkspace?.visibility ?? readStoryVisibility());
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
    initialSharedWorkspace?.careMembers ?? readCareMembers() ?? [
    { id: 'emily', name: ownerName, role: 'Primary owner', detail: 'manages the profile' },
    { id: 'mom', name: 'Mom', role: 'Caregiver', detail: 'can add observations' },
    { id: 'dad', name: 'Dad', role: 'Caregiver', detail: 'can add observations' },
  ]);
  const [careInvitations, setCareInvitations] = useState<CareInvitation[]>(() => cloud ? [] : readCareInvitations());
  async function refreshCareInvitations() {
    if (!cloud) return careInvitations;
    const current = (await cloud.listInvitations()).map(displayCareInvitation);
    setCareInvitations(current);
    return current;
  }
  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    void cloud.listInvitations().then((rows) => { if (alive) setCareInvitations(rows.map(displayCareInvitation)); })
      .catch((error) => { if (alive) setAccountActionError(error instanceof Error ? error.message : 'Could not load care-group invitations.'); });
    return () => { alive = false; };
  }, [cloud]);
  const [mediaSources, setMediaSources] = useState<MediaSource[]>(() => initialSharedWorkspace?.mediaSources ?? readMediaSources(true));
  const [typicalPatterns, setTypicalPatterns] = useState<TypicalPattern[]>(() => initialSharedWorkspace?.patterns ?? readTypicalPatterns(ownerName, true));
  const [lifeCareEvents, setLifeCareEvents] = useState<LifeCareEvent[]>(initialSharedWorkspace?.lifeEvents ?? readLifeCareEvents());
  const [selectedMediaSourceId, setSelectedMediaSourceId] = useState<string | null>(null);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [lifeCareInitialCategory, setLifeCareInitialCategory] = useState<'life' | 'health' | null>(null);
  const [lifeCareStartAdding, setLifeCareStartAdding] = useState(false);
  const [selectedCareMemberId, setSelectedCareMemberId] = useState('emily');
  const [askInput, setAskInput] = useState('');
  const [askMessages, setAskMessages] = useState<AskMessage[]>(() => privateAskMessagesFor(initialPet, initialAccount?.id));
  const [askSaveError, setAskSaveError] = useState('');
  const [askBusy, setAskBusy] = useState(false);
  const [askPending, setAskPending] = useState<AskMessage | null>(null);
  const askRequest = useRef<AbortController | null>(null);
  const [accountActionError, setAccountActionError] = useState('');
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showPetSwitcher, setShowPetSwitcher] = useState(false);
  const [petSwitcherStartsAdding, setPetSwitcherStartsAdding] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [pendingDeviceAccountRemoval, setPendingDeviceAccountRemoval] = useState<{ username: string; name: string } | null>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const askEndRef = useRef<HTMLDivElement>(null);
  const navigationHistory = useRef<View[]>([]);
  const contextReturnView = useRef<View>('momentDetail');
  const activeAccount = prototypeSession.accounts.find((account) => account.id === prototypeSession.activeAccountId) ?? null;
  const activePetRecord = activeAccount?.pets.find((pet) => pet.id === activeAccount.activePetId) ?? activeAccount?.pets[0] ?? null;
  const latestSessionRef = useRef(prototypeSession);
  latestSessionRef.current = prototypeSession;
  const askIdentity = `${activeAccount?.id}:${activePetRecord?.id}`;
  const askIdentityRef = useRef(askIdentity);
  askIdentityRef.current = askIdentity;
  useEffect(() => {
    askRequest.current?.abort(); askRequest.current = null;
    setAskBusy(false); setAskPending(null); setAskSaveError('');
    return () => { askRequest.current?.abort(); };
  }, [askIdentity]);
  const groupOwnerAccountId = activePetRecord?.sharedOwnerAccountId ?? (activePetRecord?.sharedGroupId ? activePetRecord.sharedGroupId.split(':')[0] : undefined);
  const groupOwnerAccount = prototypeSession.accounts.find((account) => account.id === groupOwnerAccountId);
  const groupOwnerMember = careMembers.find((member) => member.id === groupOwnerAccountId);
  const groupOwnerPet = activePetRecord?.sharedGroupId ? groupOwnerAccount?.pets.find((pet) => pet.sharedGroupId === activePetRecord.sharedGroupId) : activePetRecord;
  const activeGroupName = groupOwnerPet?.workspace.groupName ?? activePetRecord?.workspace.groupName ?? 'Care circle';
  const primaryMemberId = activePetRecord?.sharedGroupId ? groupOwnerAccountId ?? '' : 'emily';
  const petSpecies = activePetRecord?.species === 'Cat' ? 'Cat' : 'Dog';
  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    const refreshSharedCare = async () => {
      try {
        const [groups, invites] = await Promise.all([cloud.listGroups(), cloud.listInvitations()]);
        if (!alive) return;
        const currentGroup = activePetRecord?.sharedGroupId ? groups.find((group) => group.groupId === activePetRecord.sharedGroupId) : undefined;
        if (currentGroup) setCareMembers(careMembersFromCloudGroup(currentGroup));
        setCareInvitations(invites.map(displayCareInvitation));
      } catch { /* Keep the current view usable while the network is unavailable. */ }
    };
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshSharedCare(); }, 7000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [cloud, activePetRecord?.sharedGroupId]);

  function workspaceFromState(): PetWorkspace {
    return {
      contexts: savedContexts,
      groupName: activePetRecord?.workspace.groupName ?? 'Care circle',
      observations: storyObservations,
      momentEngagement,
      drafts: storyDrafts,
      visibility: includedStoryMoments,
      askMessages,
      askOwnerAccountId: activeAccount?.id,
      careMembers,
      careEvent: activePetRecord?.workspace.careEvent ?? (cloud ? null : readCareEvent()),
      mediaSources,
      patterns: typicalPatterns,
      lifeEvents: lifeCareEvents,
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

  function persistWorkspacePatch(patch: Partial<PetWorkspace>): boolean {
    if (!activeAccount || !activePetRecord) return false;
    const captured = captureCurrentSpace(prototypeSession);
    const nextSession: PrototypeSession = {
      ...captured,
      accounts: captured.accounts.map((account) => account.id !== activeAccount.id ? account : {
        ...account,
        pets: account.pets.map((pet) => pet.id === activePetRecord.id ? { ...pet, workspace: { ...pet.workspace, ...patch } } : pet),
      }),
    };
    try {
      persistPrototypeSession(nextSession);
    } catch {
      return false;
    }
    setPrototypeSession(nextSession);
    return true;
  }

  function persistSharedWorkspacePatch(patch: Partial<Pick<PetWorkspace, 'mediaSources' | 'patterns' | 'lifeEvents' | 'momentEngagement'>>): boolean {
    if (!activeAccount || !activePetRecord) return false;
    const captured = captureCurrentSpace(prototypeSession);
    const groupId = activePetRecord.sharedGroupId;
    const nextSession: PrototypeSession = {
      ...captured,
      accounts: captured.accounts.map((account) => ({
        ...account,
        pets: account.pets.map((pet) => {
          const belongsToActivePet = account.id === activeAccount.id && pet.id === activePetRecord.id;
          const belongsToSharedGroup = !!groupId && pet.sharedGroupId === groupId;
          return belongsToActivePet || belongsToSharedGroup
            ? { ...pet, workspace: { ...pet.workspace, ...patch } }
            : pet;
        }),
      })),
    };
    try {
      persistPrototypeSession(nextSession);
    } catch {
      return false;
    }
    setPrototypeSession(nextSession);
    return true;
  }

  function saveContextsToCurrentGroup(contexts: OwnerContext[], mergeGroupCopies = false): boolean {
    if (!activeAccount || !activePetRecord) return false;
    const captured = captureCurrentSpace(prototypeSession);
    const groupId = activePetRecord.sharedGroupId;
    const groupContexts = mergeGroupCopies && groupId
      ? captured.accounts.flatMap((account) => account.pets.filter((pet) => pet.sharedGroupId === groupId).flatMap((pet) => pet.workspace.contexts))
      : [];
    const contextsToSave = mergeGroupCopies
      ? [...new Map([...groupContexts, ...contexts].map((context) => [context.id, context])).values()].sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      : contexts;
    const nextSession: PrototypeSession = {
      ...captured,
      accounts: captured.accounts.map((account) => ({
        ...account,
        pets: account.pets.map((pet) => {
          const belongsToActivePet = account.id === activeAccount.id && pet.id === activePetRecord.id;
          const belongsToSharedGroup = !!groupId && pet.sharedGroupId === groupId;
          const isGroupOwnerPet = account.id === (activePetRecord.sharedOwnerAccountId ?? groupId?.split(':')[0]);
          return belongsToActivePet || belongsToSharedGroup
            ? { ...pet, workspace: { ...pet.workspace, contexts: groupId && !isGroupOwnerPet ? [] : contextsToSave } }
            : pet;
        }),
      })),
    };
    try {
      persistPrototypeSession(nextSession);
    } catch {
      return false;
    }
    setPrototypeSession(nextSession);
    setSavedContexts(contextsToSave);
    return true;
  }

  function saveObservationsToCurrentGroup(observations: StoryObservation[], replacedId?: string): boolean {
    if (!activeAccount || !activePetRecord) return false;
    const captured = captureCurrentSpace(prototypeSession);
    const groupId = activePetRecord.sharedGroupId;
    const sharedPublic = groupId
      ? captured.accounts.flatMap((account) => account.pets.filter((pet) => pet.sharedGroupId === groupId).flatMap((pet) => pet.workspace.observations.filter((entry) => !entry.privateRecord && entry.id !== replacedId)))
      : observations.filter((entry) => !entry.privateRecord && entry.id !== replacedId);
    const replacement = replacedId ? observations.find((entry) => entry.id === replacedId && !entry.privateRecord) : undefined;
    const sharedObservations = [...new Map([...sharedPublic, ...(replacement ? [replacement] : [])].map((entry) => [entry.id, entry])).values()].sort((left, right) => right.savedAt.localeCompare(left.savedAt));
    const nextSession: PrototypeSession = {
      ...captured,
      accounts: captured.accounts.map((account) => ({
        ...account,
        pets: account.pets.map((pet) => {
          const belongsToActivePet = account.id === activeAccount.id && pet.id === activePetRecord.id;
          const belongsToSharedGroup = !!groupId && pet.sharedGroupId === groupId;
          if (!belongsToActivePet && !belongsToSharedGroup) return pet;
          const privateObservations = belongsToActivePet ? observations.filter((entry) => entry.privateRecord) : pet.workspace.observations.filter((entry) => entry.privateRecord);
          const visibility = pet.workspace.visibility && replacedId
            ? [...new Set([...pet.workspace.visibility.filter((id) => id !== replacedId), ...(replacement ? [replacement.id] : [])])]
            : pet.workspace.visibility;
          return { ...pet, workspace: { ...pet.workspace, observations: [...privateObservations, ...sharedObservations].sort((left, right) => right.savedAt.localeCompare(left.savedAt)), visibility } };
        }),
      })),
    };
    const activeObservations = groupId
      ? [...observations.filter((entry) => entry.privateRecord), ...sharedObservations].sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      : observations;
    try {
      persistPrototypeSession(nextSession);
    } catch {
      return false;
    }
    setPrototypeSession(nextSession);
    setStoryObservations(activeObservations);
    return true;
  }

  function applyAccountSpace(session: PrototypeSession, accountId: string, petId: string, allowSessionOnly = false): string {
    const account = session.accounts.find((entry) => entry.id === accountId);
    const pet = account?.pets.find((entry) => entry.id === petId);
    if (!account || !pet) return 'That saved profile is no longer available.';
    const nextSession: PrototypeSession = {
      ...session,
      activeAccountId: account.id,
      accounts: session.accounts.map((entry) => entry.id === account.id ? { ...entry, activePetId: pet.id } : entry),
    };
    let storageWarning = '';
    try {
      persistPrototypeSession(nextSession);
    } catch {
      if (!allowSessionOnly) return 'This profile could not be opened because browser storage is unavailable.';
      storageWarning = 'This account is open for this session, but browser storage is full. Some changes may not be saved after refresh.';
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
    const sharedOwnerWorkspace = pet.sharedGroupId
      ? session.accounts.find((entry) => entry.id === pet.sharedOwnerAccountId)?.pets.find((groupPet) => groupPet.sharedGroupId === pet.sharedGroupId)?.workspace
      : undefined;
    const sharedWorkspace = sharedOwnerWorkspace ?? pet.workspace;
    const sharedContexts = pet.sharedGroupId
      ? session.accounts.flatMap((entry) => entry.pets.filter((groupPet) => groupPet.sharedGroupId === pet.sharedGroupId).flatMap((groupPet) => groupPet.workspace.contexts))
      : pet.workspace.contexts;
    setSavedContexts([...new Map(sharedContexts.map((context) => [context.id, context])).values()].sort((left, right) => right.savedAt.localeCompare(left.savedAt)));
    setStoryObservations(pet.workspace.observations);
    setMomentEngagement(sharedWorkspace.momentEngagement ?? {});
    setStoryDrafts(pet.workspace.drafts);
    setIncludedStoryMoments(pet.workspace.visibility);
    setAskMessages(privateAskMessagesFor(pet, account.id));
    setCareMembers(sharedWorkspace.careMembers);
    setMediaSources(sharedWorkspace.mediaSources);
    setTypicalPatterns(sharedWorkspace.patterns);
    setLifeCareEvents(sharedWorkspace.lifeEvents);
    setEditingStoryObservationId(null);
    setActiveStoryDraftId(null);
    setEditingContextId(null);
    setLastSavedContextId(null);
    setSelectedMomentId('window');
    setAskInput('');
    setAccountActionError(storageWarning);
    navigationHistory.current = [];
    setView('today');
    return storageWarning;
  }

  function switchAccount(accountId: string) {
    if (cloud) return;
    const captured = captureCurrentSpace(prototypeSession);
    const account = captured.accounts.find((entry) => entry.id === accountId);
    const error = account ? applyAccountSpace(captured, account.id, account.activePetId, true) : 'That saved account is no longer available.';
    setAccountActionError(error);
  }

  function registerAccount(name: string, email: string, firstPetName: string): string {
    if (cloud) return 'Sign out before creating a different cloud account.';
    const normalizedEmail = email.trim().toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return 'Enter a name and a valid email.';
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
      pets: [{ id: petId, name: firstPetName.trim() || 'My pet', breed: 'Mixed breed', age: '1', avatar: '', hasDemoMoments: false, isEmptyProfile: !firstPetName.trim(), workspace: emptyPetWorkspace(name) }],
    };
    return applyAccountSpace({ ...captured, accounts: [...captured.accounts, account] }, accountId, petId);
  }

  function deleteSavedAccount(accountId: string): string {
    if (cloud) return 'Cloud accounts cannot be deleted from this prototype.';
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

  function openAddPetForm() {
    setPetSwitcherStartsAdding(true);
    setShowPetSwitcher(true);
  }

  function addPet(name: string, breed: string, age: string, species: 'Dog' | 'Cat', avatar: string): string {
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
        pets: [...account.pets.filter((pet) => !pet.isEmptyProfile), { id: petId, name, breed, species, age, avatar, hasDemoMoments: false, workspace: emptyPetWorkspace(account.name) }],
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
    if (cloud) { cloud.signOut(); return; }
    if (onExit) { onExit(); return; }
    const captured = captureCurrentSpace(prototypeSession);
    const next = { ...captured, activeAccountId: null };
    try {
      persistPrototypeSession(next);
    } catch {
      setAccountActionError('Could not sign out because browser storage is unavailable.');
      return;
    }
    setPrototypeSession(next);
    setEntranceOpen(true);
    setShowAccountSwitcher(false);
    setShowSignOutConfirm(false);
    navigationHistory.current = [];
    setView('today');
  }

  async function confirmRemoveDeviceAccount() {
    if (!cloud || !pendingDeviceAccountRemoval) return;
    try {
      await cloud.removeAccount(pendingDeviceAccountRemoval.username);
      setPendingDeviceAccountRemoval(null);
    } catch (error) {
      setAccountActionError(error instanceof Error ? error.message : 'Could not remove this account from the device.');
      setPendingDeviceAccountRemoval(null);
    }
  }

  function updateActivePetRecord(profile: { name: string; breed: string; age: string; avatar: string }) {
    setPrototypeSession((current) => {
      if (!current.activeAccountId) return current;
      const groupId = activePetRecord?.sharedGroupId;
      const next = {
        ...current,
        accounts: current.accounts.map((account) => ({
          ...account,
          pets: account.pets.map((pet) => groupId ? pet.sharedGroupId === groupId ? { ...pet, ...profile, isEmptyProfile: false } : pet : account.id === current.activeAccountId && pet.id === account.activePetId ? { ...pet, ...profile, isEmptyProfile: false } : pet),
        })),
      };
      try { persistPrototypeSession(next); } catch { setAccountActionError('Pet details were saved, but the account index could not be updated.'); }
      return next;
    });
  }

  function updateActiveAccountRecord(profile: { name: string; avatar: string; preference: string }) {
    const renamedPatterns = profile.name !== ownerName ? typicalPatterns.map((pattern) => pattern.confirmedBy === ownerName ? { ...pattern, confirmedBy: profile.name } : pattern) : typicalPatterns;
    if (renamedPatterns !== typicalPatterns) setTypicalPatterns(renamedPatterns);
    setPrototypeSession((current) => {
      if (!current.activeAccountId) return current;
      const groupId = activePetRecord?.sharedGroupId;
      const next = {
        ...current,
        accounts: current.accounts.map((account) => ({
          ...(account.id === current.activeAccountId ? { ...account, ...profile } : account),
          pets: account.pets.map((pet) => groupId && pet.sharedGroupId === groupId ? { ...pet, workspace: { ...pet.workspace, patterns: renamedPatterns } } : pet),
        })),
      };
      try { persistPrototypeSession(next); } catch { setAccountActionError('Profile details were saved, but the account index could not be updated.'); }
      return next;
    });
  }

  async function sendCareInvitation(_name: string, email: string, role: 'Caregiver' | 'Viewer', recipientAccountId?: string): Promise<string> {
    if (!activeAccount || !activePetRecord) return 'Open a pet profile before inviting a caregiver.';
    if (cloud) {
      if (!recipientAccountId) return 'Choose a registered account from the search results.';
      const groupId = activePetRecord.sharedGroupId ?? crypto.randomUUID();
      try {
        await cloud.sendInvitation({ groupId, recipientId: recipientAccountId, role, petId: activePetRecord.id, petName, petBreed, petAge, petAvatar, petSpecies, groupName: activeGroupName, workspace: workspaceFromState() });
        if (!activePetRecord.sharedGroupId) {
          const captured = captureCurrentSpace(prototypeSession);
          const next = { ...captured, accounts: captured.accounts.map((account) => account.id !== activeAccount.id ? account : { ...account, pets: account.pets.map((pet) => pet.id === activePetRecord.id ? { ...pet, sharedGroupId: groupId, sharedOwnerAccountId: activeAccount.id } : pet) }) };
          setPrototypeSession(next);
          persistPrototypeSession(next);
        }
        const pending = await refreshCareInvitations();
        setCareInvitations(pending);
        return '';
      } catch (error) { return error instanceof Error ? error.message : 'Could not send this invitation. Please try again.'; }
    }
    if (!recipientAccountId || !prototypeSession.accounts.some((account) => account.id === recipientAccountId && account.email.toLowerCase() === email.toLowerCase())) return 'Choose an existing account from the search results.';
    const normalizedEmail = email.trim().toLowerCase();
    const groupId = activePetRecord.sharedGroupId ?? `${activeAccount.id}:${activePetRecord.id}`;
    if (normalizedEmail === activeAccount.email.toLowerCase()) return 'You cannot invite your own account.';
    if (careInvitations.some((invite) => invite.groupId === groupId && invite.email === normalizedEmail && ['pending', 'accepted'].includes(invite.status))) return 'This account already has an active invitation or membership.';
    const captured = captureCurrentSpace(prototypeSession);
    const members = careMembers.map((member) => member.id === 'emily' ? { ...member, id: activeAccount.id, name: activeAccount.name, email: activeAccount.email, role: 'Primary caregiver' } : member);
    const nextSession: PrototypeSession = { ...captured, accounts: captured.accounts.map((account) => account.id !== activeAccount.id ? account : { ...account, pets: account.pets.map((pet) => pet.id === activePetRecord.id ? { ...pet, sharedGroupId: groupId, sharedOwnerAccountId: activeAccount.id, workspace: { ...pet.workspace, careMembers: members } } : pet) }) };
    const invitation: CareInvitation = { id: `invite-${Date.now()}`, groupId, ownerAccountId: activeAccount.id, ownerName: activeAccount.name, petId: activePetRecord.id, petName: petName, petBreed, petAge, petAvatar, email: normalizedEmail, recipientAccountId, role, status: 'pending', createdAt: new Date().toISOString() };
    const nextInvitations = [...careInvitations, invitation];
    setPrototypeSession(nextSession);
    setCareMembers(members);
    saveCareMembersToStorage(members);
    setCareInvitations(nextInvitations);
    saveCareInvitations(nextInvitations);
    try { persistPrototypeSession(nextSession); } catch { return 'The invitation could not be saved on this device. Please try again.'; }
    return '';
  }

  function updateCareGroupMember(memberId: string, change: { access?: 'editor' | 'viewer'; role?: 'Caregiver' | 'Temporary caregiver'; expiresAt?: string; remove?: boolean }) {
    if (!activeAccount || !activePetRecord) return;
    const captured = captureCurrentSpace(prototypeSession);
    const groupId = activePetRecord.sharedGroupId ?? `${activeAccount.id}:${activePetRecord.id}`;
    const updateMembers = (members: CareMember[]) => {
      const linked = members.map((member) => member.id === 'emily' ? { ...member, id: activeAccount.id, name: activeAccount.name, email: activeAccount.email, role: 'Primary caregiver' } : member);
      return change.remove ? linked.filter((member) => member.id !== memberId) : linked.map((member) => {
        if (member.id !== memberId) return member;
        if (change.access) return { ...member, access: change.access, role: change.access === 'editor' && member.role === 'Viewer' ? 'Caregiver' : member.role, detail: change.access === 'viewer' ? 'can view shared records' : 'can add observations' };
        if (change.role) {
          const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          return { ...member, role: change.role, expiresAt: change.role === 'Temporary caregiver' ? member.expiresAt ?? defaultExpiry : undefined };
        }
        if (change.expiresAt !== undefined) return { ...member, expiresAt: change.expiresAt || undefined };
        return member;
      });
    };
    const nextMembers = updateMembers(careMembers);
    if (cloud && activePetRecord.sharedGroupId) {
      if (change.remove) void cloud.removeCareMember(activePetRecord.sharedGroupId, memberId).catch((error) => setAccountActionError(error instanceof Error ? error.message : 'Could not remove this care-group member.'));
      if (change.access) void cloud.updateCareMember(activePetRecord.sharedGroupId, memberId, change.access === 'viewer' ? 'Viewer' : 'Caregiver').catch((error) => setAccountActionError(error instanceof Error ? error.message : 'Could not update this member’s permission.'));
    }
    const nextSession: PrototypeSession = { ...captured, accounts: captured.accounts.map((account) => {
      let pets = account.pets.flatMap((pet) => {
      const inGroup = pet.sharedGroupId === groupId || (account.id === activeAccount.id && pet.id === activePetRecord.id);
      if (change.remove && account.id === memberId && pet.sharedGroupId === groupId) return [];
      return inGroup ? [{ ...pet, sharedGroupId: groupId, sharedOwnerAccountId: groupOwnerAccountId ?? activeAccount.id, workspace: { ...pet.workspace, careMembers: updateMembers(pet.workspace.careMembers) } }] : [pet];
      });
      if (change.remove && account.id === memberId && pets.length === 0) {
        pets = [{ id: `empty-${account.id}`, name: 'My pet', breed: 'Mixed breed', age: '1', avatar: '', hasDemoMoments: false, isEmptyProfile: true, workspace: emptyPetWorkspace(account.name) }];
      }
      // Removing someone from a shared group must not leave their standalone account
      // pointing at the deleted shared pet. Keep their last remaining pet active.
      const activePetId = pets.some((pet) => pet.id === account.activePetId) ? account.activePetId : pets[0]?.id ?? account.activePetId;
      return { ...account, pets, activePetId };
    }) };
    setCareMembers(nextMembers);
    saveCareMembersToStorage(nextMembers);
    setPrototypeSession(nextSession);
    if (change.remove) {
      const nextInvitations = careInvitations.map((invite) => invite.groupId === groupId && invite.recipientAccountId === memberId ? { ...invite, status: 'cancelled' as const } : invite);
      setCareInvitations(nextInvitations);
      saveCareInvitations(nextInvitations);
    }
  }

  function updateCareGroupName(nextName: string) {
    if (!activeAccount || !activePetRecord) return;
    const name = nextName.trim().slice(0, 40) || 'Care circle';
    const captured = captureCurrentSpace(prototypeSession);
    const groupId = activePetRecord.sharedGroupId ?? `${activeAccount.id}:${activePetRecord.id}`;
    const nextSession: PrototypeSession = {
      ...captured,
      accounts: captured.accounts.map((account) => ({
        ...account,
        pets: account.pets.map((pet) => pet.sharedGroupId === groupId || (account.id === activeAccount.id && pet.id === activePetRecord.id)
          ? { ...pet, workspace: { ...pet.workspace, groupName: name } }
          : pet),
      })),
    };
    setPrototypeSession(nextSession);
    try { persistPrototypeSession(nextSession); } catch { setAccountActionError('The group name changed for this session, but could not be saved.'); }
  }

  async function acceptCareInvitation(invite: CareInvitation) {
    if (cloud) {
      try {
        const group = await cloud.respondInvitation(invite.id, 'accepted');
        if (!group || !activeAccount) return;
        const members = careMembersFromCloudGroup(group);
        const sharedPetId = 'shared-' + group.groupId;
        const workspace = { ...emptyPetWorkspace(group.ownerId), ...(group.workspace as Partial<PetWorkspace>), groupName: group.groupName, careMembers: members, askMessages: [] } as PetWorkspace;
        const sharedPet: PrototypePet = { id: sharedPetId, sharedGroupId: group.groupId, sharedOwnerAccountId: group.ownerId,
          name: group.petName, breed: group.petBreed, age: group.petAge, avatar: group.petAvatar, hasDemoMoments: false, isEmptyProfile: false, workspace };
        const captured = captureCurrentSpace(prototypeSession);
        const next = { ...captured, accounts: captured.accounts.map((account) => account.id !== activeAccount.id ? account : {
          ...account, pets: [...account.pets.filter((pet) => !pet.isEmptyProfile && pet.sharedGroupId !== group.groupId), sharedPet], activePetId: sharedPetId,
        }) };
        setCareMembers(members);
        await refreshCareInvitations();
        const error = applyAccountSpace(next, activeAccount.id, sharedPetId, true);
        if (error) setAccountActionError(error);
      } catch (error) { setAccountActionError(error instanceof Error ? error.message : 'Could not accept this invitation. Please try again.'); }
      return;
    }
    if (!activeAccount || activeAccount.email.toLowerCase() !== invite.email.toLowerCase()) {
      setAccountActionError('Sign in with the email address that received this invitation.');
      return;
    }
    const captured = captureCurrentSpace(prototypeSession);
    const owner = captured.accounts.find((account) => account.id === invite.ownerAccountId);
    const ownerPet = owner?.pets.find((pet) => pet.id === invite.petId);
    if (!owner || !ownerPet || owner.id === activeAccount.id) return;
    const member: CareMember = { id: activeAccount.id, name: activeAccount.name, email: activeAccount.email, role: invite.role, access: invite.role === 'Viewer' ? 'viewer' : 'editor', detail: invite.role === 'Viewer' ? 'can view shared records' : 'can add observations' };
    const linkedMembers = ownerPet.workspace.careMembers.map((entry) => entry.id === 'emily' ? { ...entry, id: owner.id, name: owner.name, email: owner.email, role: 'Primary caregiver' } : entry);
    const members = [...linkedMembers.filter((entry) => entry.id !== member.id), member];
    const sharedPetId = `shared-${invite.id}`;
    const nextSession: PrototypeSession = { ...captured, accounts: captured.accounts.map((account) => {
      if (account.id === owner.id) return { ...account, pets: account.pets.map((pet) => pet.id === ownerPet.id ? { ...pet, sharedGroupId: invite.groupId, sharedOwnerAccountId: owner.id, workspace: { ...pet.workspace, askOwnerAccountId: owner.id, careMembers: members } } : pet) };
      if (account.id === activeAccount.id && !account.pets.some((pet) => pet.sharedGroupId === invite.groupId)) {
        const ownPets = account.pets.filter((pet) => !pet.isEmptyProfile);
        const sharedPet: PrototypePet = { id: sharedPetId, sharedGroupId: invite.groupId, sharedOwnerAccountId: owner.id, name: invite.petName, breed: invite.petBreed, age: invite.petAge, avatar: invite.petAvatar, hasDemoMoments: true, workspace: { ...ownerPet.workspace, askMessages: [], askOwnerAccountId: activeAccount.id, careMembers: members } };
        const pets = [...ownPets, sharedPet];
        return { ...account, pets, activePetId: sharedPetId };
      }
      return account;
    }) };
    const nextInvitations = careInvitations.map((entry) => entry.id === invite.id ? { ...entry, status: 'accepted' as const, recipientAccountId: activeAccount.id } : entry);
    setCareInvitations(nextInvitations);
    saveCareInvitations(nextInvitations);
    const openError = applyAccountSpace(nextSession, activeAccount.id, sharedPetId, true);
    if (openError) setAccountActionError(openError);
  }

  async function updateInvitationStatus(inviteId: string, status: 'declined' | 'cancelled') {
    if (cloud) {
      try {
        if (status === 'declined') await cloud.respondInvitation(inviteId, 'declined');
        else await cloud.cancelInvitation(inviteId);
        await refreshCareInvitations();
      } catch (error) { setAccountActionError(error instanceof Error ? error.message : 'Could not update this invitation.'); }
      return;
    }
    const next = careInvitations.map((invite) => invite.id === inviteId ? { ...invite, status } : invite);
    setCareInvitations(next);
    saveCareInvitations(next);
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
    if (view === 'ask' && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [askMessages, view, askBusy, askPending]);

  const selectedMoment = resolveMoment(selectedMomentId, storyObservations);
  const selectedMomentContexts = savedContexts.filter((context) => context.momentId === selectedMomentId);
  const lastSavedContext = savedContexts.find((context) => context.id === lastSavedContextId) ?? null;

  function startContextForMoment(momentId: string, existing?: OwnerContext) {
    if (!canContributeToSharedPet) return;
    if (existing?.authorId && existing.authorId !== activeAccount?.id && activePetRecord?.sharedGroupId) return;
    if (existing && !existing.authorId && activePetRecord?.sharedGroupId && activeAccount?.id !== groupOwnerAccountId) return;
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
    if (!canContributeToSharedPet) return;
    const previous = editingContextId ? savedContexts.find((entry) => entry.id === editingContextId) : undefined;
    if (previous && (previous.authorId ? previous.authorId !== activeAccount?.id : (!!activePetRecord?.sharedGroupId && activeAccount?.id !== groupOwnerAccountId))) return;
    const nextContext: OwnerContext = { id: editingContextId ?? `owner-context-${Date.now()}`, momentId: selectedMoment.id, momentTitle: selectedMoment.title, momentImage: selectedMoment.image, note: note.trim(), interpretation, savedAt: previous?.savedAt ?? new Date().toISOString(), authorId: previous?.authorId ?? activeAccount?.id, authorName: previous?.authorName ?? ownerName, authorAvatar: previous?.authorAvatar ?? ownerAvatar, attachments: contextAttachments };
    const next = [nextContext, ...savedContexts.filter((entry) => entry.id !== nextContext.id)];
    setContextSaveError('');
    if (!saveContextsToCurrentGroup(next, true)) {
      setContextSaveError('Your correction could not be saved on this device. Remove a large attachment or free some browser storage, then try again.');
      return;
    }
    setEditingContextId(null);
    setLastSavedContextId(nextContext.id);
    setContextSavedNotice(true);
    navigationHistory.current.pop();
    navigationHistory.current.pop();
    setView(contextReturnView.current);
  }

  function undoContext(contextId: string) {
    if (!canContributeToSharedPet) return;
    const next = savedContexts.filter((context) => context.id !== contextId);
    saveContextsToCurrentGroup(next);
    setLastSavedContextId(null);
    navigateTo('undone');
  }

  function deleteOwnerContext(contextId: string): boolean {
    if (!canContributeToSharedPet) return false;
    const context = savedContexts.find((entry) => entry.id === contextId);
    if (!context) return false;
    const canDelete = context.authorId ? context.authorId === activeAccount?.id || (!!groupOwnerAccountId && activeAccount?.id === groupOwnerAccountId) : (!activePetRecord?.sharedGroupId || activeAccount?.id === groupOwnerAccountId);
    if (!canDelete) return false;
    const next = savedContexts.filter((context) => context.id !== contextId);
    if (!saveContextsToCurrentGroup(next)) return false;
    if (lastSavedContextId === contextId) setLastSavedContextId(null);
    return true;
  }

  function toggleContextLike(contextId: string) {
    if (!activeAccount) return;
    const next = savedContexts.map((context) => {
      if (context.id !== contextId) return context;
      const likes = context.likes ?? [];
      return { ...context, likes: likes.includes(activeAccount.id) ? likes.filter((id) => id !== activeAccount.id) : [...likes, activeAccount.id] };
    });
    saveContextsToCurrentGroup(next);
  }

  function toggleMomentEngagement(momentId: string, type: 'likes' | 'favorites') {
    if (!activeAccount || !canInteractWithGroupContext) return;
    const current = momentEngagement[momentId] ?? { likes: [], favorites: [] };
    const values = current[type];
    const nextEngagement = {
      ...current,
      [type]: values.includes(activeAccount.id) ? values.filter((id) => id !== activeAccount.id) : [...values, activeAccount.id],
    };
    const next = { ...momentEngagement, [momentId]: nextEngagement };
    if (!persistSharedWorkspacePatch({ momentEngagement: next })) return;
    setMomentEngagement(next);
  }

  function addContextComment(contextId: string, body: string): boolean {
    if (!activeAccount || !body.trim()) return false;
    const next = savedContexts.map((context) => context.id !== contextId ? context : {
      ...context,
      comments: [...(context.comments ?? []), { id: `context-comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, authorId: activeAccount.id, authorName: activeAccount.name, body: body.trim(), createdAt: new Date().toISOString() }],
    });
    return saveContextsToCurrentGroup(next);
  }

  function editOwnContextComment(contextId: string, commentId: string, body: string): boolean {
    if (!activeAccount || !body.trim()) return false;
    const context = savedContexts.find((entry) => entry.id === contextId);
    const comment = context?.comments?.find((entry) => entry.id === commentId);
    if (!comment || comment.authorId !== activeAccount.id) return false;
    const next = savedContexts.map((entry) => entry.id !== contextId ? entry : {
      ...entry,
      comments: (entry.comments ?? []).map((item) => item.id === commentId ? { ...item, body: body.trim() } : item),
    });
    return saveContextsToCurrentGroup(next);
  }

  function deleteOwnContextComment(contextId: string, commentId: string): boolean {
    if (!activeAccount) return false;
    const context = savedContexts.find((entry) => entry.id === contextId);
    const comment = context?.comments?.find((entry) => entry.id === commentId);
    if (!comment || comment.authorId !== activeAccount.id) return false;
    const next = savedContexts.map((entry) => entry.id !== contextId ? entry : {
      ...entry,
      comments: (entry.comments ?? []).filter((item) => item.id !== commentId),
    });
    return saveContextsToCurrentGroup(next);
  }

  function startStoryObservation() {
    if (!canContributeToSharedPet) return;
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
      const next = [draft, ...storyDrafts.filter((entry) => entry.id !== draft.id)];
      if (!persistWorkspacePatch({ drafts: next })) setAccountActionError('The draft is available in this session, but browser storage is full.');
      setStoryDrafts(next);
      setStoryDraftSavedNotice(true);
    }
    setActiveStoryDraftId(null);
    setEditingStoryObservationId(null);
    navigationHistory.current = navigationHistory.current.filter((previous) => !(['addMoments', 'addCompose', 'addPreview', 'addSaved', 'storyEdit'] as View[]).includes(previous));
    setView(returnView);
  }

  function saveStoryObservation() {
    if (!canContributeToSharedPet) return;
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
      image: uploadedSelected && draftUploadedMedia ? draftUploadedMedia.url : selected[0] ? asset(selected[0].image) : '',
      mediaType: uploadedSelected ? draftUploadedMedia?.type : undefined,
      relatedPhotos: draftRelatedPhotos,
      momentCount: selected.length + selectedNotes.length + (uploadedSelected ? 1 : 0),
      momentIds: draftMoments,
      sourceNotes: selectedNotes,
      context: draftObservationContext,
      privateRecord: draftPrivateRecord,
      savedAt: draftMomentAt ? new Date(draftMomentAt).toISOString() : new Date().toISOString(),
      authorId: existing?.authorId ?? activeAccount?.id ?? undefined,
      authorName: existing?.authorName ?? ownerName,
      authorAvatar: existing?.authorAvatar ?? ownerAvatar,
    };
    const next = [observation, ...storyObservations.filter((entry) => entry.id !== observation.id)];
    let nextDrafts: StoryDraft[] | null = null;
    if (draftPrivateRecord) {
      const draft: StoryDraft = { id: activeStoryDraftId ?? `story-draft-${Date.now()}`, selectedMoments: draftMoments, note: draftObservation, title: draftObservationTitle, momentAt: draftMomentAt, relatedPhotos: draftRelatedPhotos, context: draftObservationContext, savedAt: new Date().toISOString(), privateRecord: true, uploadedMedia: draftUploadedMedia ?? undefined };
      nextDrafts = [draft, ...storyDrafts.filter((entry) => entry.id !== draft.id)];
    } else if (activeStoryDraftId) {
      nextDrafts = storyDrafts.filter((entry) => entry.id !== activeStoryDraftId);
    }
    if (!saveObservationsToCurrentGroup(next, observation.id)) {
      setStorySaveError('This observation could not be saved on this device. Remove a large photo or video, then try again.');
      return;
    }
    if (nextDrafts) {
      if (!persistWorkspacePatch({ drafts: nextDrafts })) setAccountActionError('The observation was saved, but browser storage is full and its draft may return after refresh.');
      setStoryDrafts(nextDrafts);
    }
    setActiveStoryDraftId(null);
    const nextVisibility = includedStoryMoments ? (observation.privateRecord ? includedStoryMoments.filter((id) => id !== observation.id) : [observation.id, ...includedStoryMoments]) : null;
    if (!persistWorkspacePatch({ visibility: nextVisibility })) setAccountActionError('The observation was saved, but browser storage is full.');
    setIncludedStoryMoments(nextVisibility);
    navigateTo('addSaved');
  }

  async function sendAskMessage(attachment?: AskAttachment): Promise<boolean> {
    const text = askInput.trim();
    if ((!text && !attachment) || askRequest.current || !cloud || !activePetRecord || activePetRecord.isEmptyProfile || !activeAccount) return false;
    if (attachment?.kind === 'audio') { setAskSaveError('Please send text or an image. Audio is not supported yet.'); return false; }
    const identity = askIdentity;
    const accountId = activeAccount.id;
    const petId = activePetRecord.id;
    const controller = new AbortController();
    askRequest.current = controller;
    setAskBusy(true); setAskSaveError('');
    const userMessage: AskMessage = { role: 'user', text, attachment };
    setAskPending(userMessage);
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const answer = await requestAskAI(petId, [...askMessages, userMessage], controller.signal);
      if (controller.signal.aborted || askIdentityRef.current !== identity) return false;
      const next: AskMessage[] = [...askMessages, userMessage, { role: 'assistant', text: answer }];
      // Use the latest workspace after awaiting: profile edits during a reply must survive.
      const current = latestSessionRef.current;
      const nextSession: PrototypeSession = { ...current, accounts: current.accounts.map(account => account.id !== accountId ? account : {
        ...account, pets: account.pets.map(pet => pet.id !== petId ? pet : { ...pet, workspace: { ...pet.workspace, askMessages: next, askOwnerAccountId: accountId } }),
      }) };
      persistPrototypeSession(nextSession);
      latestSessionRef.current = nextSession;
      setPrototypeSession(nextSession); setAskMessages(next); setAskInput('');
      return true;
    } catch (error) {
      if (askIdentityRef.current === identity) setAskSaveError(controller.signal.aborted ? 'The reply took too long. Your message is still here; please retry.' : error instanceof Error ? error.message : 'Could not get a reply. Please try again.');
      return false;
    } finally {
      clearTimeout(timer);
      if (askRequest.current === controller) { askRequest.current = null; setAskBusy(false); setAskPending(null); }
    }
  }

  const mainView = (['today', 'story', 'ask', 'pets', 'you'] as View[]).includes(view);
  const activeNav: View = view === 'petDetails' ? 'pets' : view === 'profile' ? 'you' : mainView ? view : 'today';
  const isPrimaryCaregiver = activePetRecord?.sharedGroupId ? groupOwnerAccountId === activeAccount?.id : true;
  const currentCareMember = activeAccount ? careMembers.find((member) => member.id === activeAccount.id || (!!member.email && member.email.toLowerCase() === activeAccount.email.toLowerCase())) : undefined;
  const temporaryAccessExpired = currentCareMember?.role === 'Temporary caregiver' && !!currentCareMember.expiresAt && currentCareMember.expiresAt < new Date().toISOString().slice(0, 10);
  const canContributeToSharedPet = isPrimaryCaregiver || !activePetRecord?.sharedGroupId || (currentCareMember?.access === 'editor' && !temporaryAccessExpired);
  const canInteractWithGroupContext = isPrimaryCaregiver || (!!activePetRecord?.sharedGroupId && !!currentCareMember && !temporaryAccessExpired);
  const canManageLongTermCare = isPrimaryCaregiver || !activePetRecord?.sharedGroupId || (currentCareMember?.access === 'editor' && currentCareMember.role !== 'Temporary caregiver');
  useEffect(() => {
    if (!cloud || !activePetRecord?.sharedGroupId || !canContributeToSharedPet) return;
    const timer = window.setTimeout(() => {
      void cloud.saveCareGroup(activePetRecord.sharedGroupId!, {
        name: petName, breed: petBreed, age: petAge, avatar: petAvatar, species: petSpecies,
      }, activeGroupName, workspaceFromState()).catch((error) => {
        setAccountActionError(error instanceof Error ? error.message : 'Shared care changes could not be synced.');
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [cloud, prototypeSession, activePetRecord?.sharedGroupId, canContributeToSharedPet, petName, petBreed, petAge, petAvatar, petSpecies, activeGroupName]);
  const orderedCareMembers = [...careMembers].sort((left, right) => {
    const rank = (member: CareMember) => member.id === activeAccount?.id ? 0 : member.id === primaryMemberId ? 1 : 2;
    return rank(left) - rank(right);
  });
  const selectedCareMember = orderedCareMembers.find((member) => member.id === selectedCareMemberId) ?? orderedCareMembers[0];
  const selectedMemberAccount = selectedCareMember ? prototypeSession.accounts.find((account) => account.id === selectedCareMember.id || (!!selectedCareMember.email && account.email.toLowerCase() === selectedCareMember.email.toLowerCase())) : undefined;
  const receivedCareInvitations = activeAccount ? careInvitations.filter((invite) => invite.status === 'pending' && (cloud ? invite.recipientAccountId === activeAccount.id : invite.email.toLowerCase() === activeAccount.email.toLowerCase())) : [];
  const activeCareGroupId = activeAccount && activePetRecord ? activePetRecord.sharedGroupId ?? `${activeAccount.id}:${activePetRecord.id}` : '';
  const activeGroupInvitations = careInvitations.filter((invite) => invite.groupId === activeCareGroupId && invite.status === 'pending');
  function openCareMember(id: string) {
    setSelectedCareMemberId(id);
    navigateTo('memberDetails');
  }
  function transferPrimaryCaregiver(nextPrimaryId: string): string {
    if (!activeAccount || !activePetRecord || !isPrimaryCaregiver) return 'Only the current Primary caregiver can transfer this role.';
    const nextPrimaryMember = careMembers.find((member) => member.id === nextPrimaryId);
    const nextPrimaryAccount = prototypeSession.accounts.find((account) => account.id === nextPrimaryId);
    if (!nextPrimaryMember || !nextPrimaryAccount || nextPrimaryMember.access === 'viewer' || nextPrimaryMember.role === 'Temporary caregiver') return 'Choose a regular Caregiver with Can add access before transferring this role.';
    const currentPrimaryId = groupOwnerAccountId ?? activeAccount.id;
    const groupId = activePetRecord.sharedGroupId ?? `${activeAccount.id}:${activePetRecord.id}`;
    const nextMembers = careMembers.map((member) => member.id === currentPrimaryId
      ? { ...member, role: 'Caregiver', access: 'editor' as const, detail: 'can add observations' }
      : member.id === nextPrimaryId
        ? { ...member, role: 'Primary caregiver', access: 'editor' as const, detail: 'manages the profile' }
        : member);
    const captured = captureCurrentSpace(prototypeSession);
    const nextSession: PrototypeSession = {
      ...captured,
      accounts: captured.accounts.map((account) => ({
        ...account,
        role: account.id === currentPrimaryId ? 'Caregiver' : account.id === nextPrimaryId ? 'Primary caregiver' : account.role,
        pets: account.pets.map((pet) => {
          if (!(pet.sharedGroupId === groupId || (account.id === activeAccount.id && pet.id === activePetRecord.id))) return pet;
          const ownsAskHistory = pet.workspace.askOwnerAccountId
            ? pet.workspace.askOwnerAccountId === account.id
            : account.id === currentPrimaryId;
          return {
            ...pet,
            sharedGroupId: groupId,
            sharedOwnerAccountId: nextPrimaryId,
            workspace: {
              ...pet.workspace,
              askMessages: ownsAskHistory ? pet.workspace.askMessages : [],
              askOwnerAccountId: account.id,
              careMembers: nextMembers,
              mediaSources,
              patterns: typicalPatterns,
              lifeEvents: lifeCareEvents,
            },
          };
        }),
      })),
    };
    const nextInvitations = careInvitations.map((invite) => invite.groupId === groupId ? { ...invite, ownerAccountId: nextPrimaryId, ownerName: nextPrimaryAccount.name } : invite);
    try {
      persistPrototypeSession(nextSession);
      saveCareInvitations(nextInvitations);
      saveCareMembersToStorage(nextMembers);
    } catch {
      return 'The Primary caregiver could not be transferred on this device.';
    }
    setPrototypeSession(nextSession);
    setCareInvitations(nextInvitations);
    setCareMembers(nextMembers);
    setOwnerRole('Caregiver');
    return '';
  }
  function editStoryRow(row: StoryEditRow) {
    if (!canContributeToSharedPet) return;
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
    if (!persistWorkspacePatch({ drafts: next })) return false;
    setStoryDrafts(next);
    if (activeStoryDraftId === id) setActiveStoryDraftId(null);
    return true;
  }
  function deleteStoryRow(id: string) {
    if (!canContributeToSharedPet) return;
    if (!id.startsWith('story-observation-')) return;
    const next = storyObservations.filter((entry) => entry.id !== id);
    saveObservationsToCurrentGroup(next, id);
  }
  function deleteStoryMoment(id: string): string {
    if (!canContributeToSharedPet) return 'View-only members cannot change this Story.';
    const isObservation = storyObservations.some((entry) => entry.id === id);
    const defaultVisibleIds = [
      ...storyObservations.filter((entry) => !entry.privateRecord).map((entry) => entry.id),
      ...(activePetRecord?.hasDemoMoments ? ['breakfast', 'window', 'toy'] : []),
    ];
    const nextVisibility = (includedStoryMoments ?? defaultVisibleIds).filter((momentId) => momentId !== id);
    const nextObservations = isObservation ? storyObservations.filter((entry) => entry.id !== id) : storyObservations;
    const nextContexts = isObservation ? savedContexts.filter((entry) => entry.momentId !== id) : savedContexts;
    if (isObservation) {
      if (!saveObservationsToCurrentGroup(nextObservations, id)) return 'This moment could not be deleted from this device. Please try again.';
    }
    if (!persistWorkspacePatch({ visibility: nextVisibility, ...(isObservation ? { contexts: nextContexts } : {}) })) return 'This moment could not be deleted from this device. Please try again.';
    setIncludedStoryMoments(nextVisibility);
    if (isObservation) setSavedContexts(nextContexts);
    return '';
  }
  function saveMediaSource(source: MediaSource): string {
    if (!canManageLongTermCare) return 'Only the Primary caregiver or a regular Caregiver can manage connected media.';
    const exists = mediaSources.some((entry) => entry.id === source.id);
    const next = exists ? mediaSources.map((entry) => entry.id === source.id ? source : entry) : [...mediaSources, source];
    if (!persistSharedWorkspacePatch({ mediaSources: next })) return 'This source could not be updated on this device.';
    setMediaSources(next);
    return '';
  }
  function deleteMediaSource(id: string): string {
    if (!canManageLongTermCare) return 'Only the Primary caregiver or a regular Caregiver can manage connected media.';
    const next = mediaSources.filter((source) => source.id !== id);
    if (!persistSharedWorkspacePatch({ mediaSources: next })) return 'This source could not be deleted from this device.';
    setMediaSources(next);
    return '';
  }
  function saveTypicalPattern(pattern: TypicalPattern): string {
    if (!isPrimaryCaregiver) return 'Only the Primary caregiver can manage Typical patterns.';
    const exists = typicalPatterns.some((entry) => entry.id === pattern.id);
    const next = exists ? typicalPatterns.map((entry) => entry.id === pattern.id ? pattern : entry) : [...typicalPatterns, pattern];
    if (!persistSharedWorkspacePatch({ patterns: next })) return 'This pattern could not be saved on this device.';
    setTypicalPatterns(next);
    return '';
  }
  function deleteTypicalPattern(id: string): string {
    if (!isPrimaryCaregiver) return 'Only the Primary caregiver can manage Typical patterns.';
    const next = typicalPatterns.filter((pattern) => pattern.id !== id);
    if (!persistSharedWorkspacePatch({ patterns: next })) return 'This pattern could not be deleted from this device.';
    setTypicalPatterns(next);
    return '';
  }
  function saveLifeCareEvent(event: LifeCareEvent): string {
    if (!canManageLongTermCare || !activeAccount) return 'Only the Primary caregiver or a regular Caregiver can add life and care events.';
    const existing = lifeCareEvents.find((entry) => entry.id === event.id);
    if (existing && !isPrimaryCaregiver && existing.authorId !== activeAccount.id) return 'You can only edit events you added.';
    const savedEvent = { ...event, authorId: existing?.authorId ?? activeAccount.id, authorName: existing?.authorName ?? activeAccount.name };
    const next = [savedEvent, ...lifeCareEvents.filter((entry) => entry.id !== event.id)];
    if (!persistSharedWorkspacePatch({ lifeEvents: next })) return 'This event could not be saved on this device.';
    setLifeCareEvents(next);
    return '';
  }
  function deleteLifeCareEvent(id: string): string {
    const existing = lifeCareEvents.find((event) => event.id === id);
    if (!canManageLongTermCare || !existing || !activeAccount || (!isPrimaryCaregiver && existing.authorId !== activeAccount.id)) return 'You can only delete life and care events you are allowed to manage.';
    const next = lifeCareEvents.filter((event) => event.id !== id);
    if (!persistSharedWorkspacePatch({ lifeEvents: next })) return 'This event could not be deleted from this device.';
    setLifeCareEvents(next);
    return '';
  }
  function openConnectedMedia(sourceId?: string) {
    if (!canManageLongTermCare) return;
    setSelectedMediaSourceId(sourceId ?? null);
    navigateTo('connectedMedia');
  }
  function openPatternKnowledge(patternId?: string) {
    setSelectedPatternId(patternId ?? null);
    navigateTo('patternHistory');
  }
  function openLifeCare(category?: 'life' | 'health') {
    setLifeCareInitialCategory(category ?? null);
    setLifeCareStartAdding(category === undefined && canContributeToSharedPet);
    navigateTo('careEvent');
  }
  function navigate(view: View) {
    navigateTo(view);
  }

  if (entranceOpen || !activeAccount || !activePetRecord) {
    return <Welcome error={accountActionError} onGuest={() => {
      const captured = captureCurrentSpace(prototypeSession);
      let demo = captured.accounts.find(account => account.pets.some(pet => pet.hasDemoMoments));
      if (!demo) {
        demo = createInitialPrototypeSession().accounts[0];
        demo = { ...demo, id: `guest-${Date.now()}`, name: 'Emily', email: 'guest@pawsona.local', pets: demo.pets.map(pet => ({ ...pet, name: 'Luna', hasDemoMoments: true })) };
        captured.accounts = [...captured.accounts, demo];
      }
      const pet = demo.pets.find(pet => pet.hasDemoMoments)!;
      const error = applyAccountSpace(captured, demo.id, pet.id);
      setAccountActionError(error);
      if (!error) setEntranceOpen(false);
    }} onRegister={(name, email, petName) => {
      const error = registerAccount(name, email, petName);
      if (!error) setEntranceOpen(false);
      return error;
    }} onLogin={email => {
      const account = prototypeSession.accounts.find(entry => entry.email.toLowerCase() === email.toLowerCase());
      if (!account) return 'No profile with this email is saved in this browser. Create an account or continue as guest.';
      const error = applyAccountSpace(captureCurrentSpace(prototypeSession), account.id, account.activePetId);
      setAccountActionError(error);
      if (!error) setEntranceOpen(false);
      return error;
    }} />;
  }

  return (
    <div className="app-stage">
      <div className="phone">
        {notice}
        <main ref={scrollRef} className={`screen-scroll ${view === 'today' ? 'home-screen' : ''} ${view.startsWith('add') ? 'add-flow-scroll' : ''}`}>
          <StatusBar />
          <div className={`screen-content ${mainView ? 'main-content' : 'detail-content'} ${view === 'ask' ? 'ask-content' : ''} ${view.startsWith('add') ? 'add-flow-content' : ''}`}>
            {view === 'today' && <TodayPage observations={storyObservations} includedMoments={includedStoryMoments} petName={petName} petAvatar={petAvatar} hasDemoMoments={activePetRecord.hasDemoMoments} noPetYet={activePetRecord.isEmptyProfile ?? false} onAddPet={openAddPetForm} onStory={() => navigateTo('story')} onMoment={openMomentDetail} onEvidence={() => navigateTo('overview')} onPetsNavigate={() => navigateTo('pets')} saved={savedContexts.find((context) => context.momentId === 'window') ?? null} />}
            {view === 'story' && <StoryPage onMoment={openMomentDetail} onEditStory={() => navigateTo('storyEdit')} onEditMoment={(item) => editStoryRow({ id: item.id, image: item.image, mediaType: item.mediaType, title: item.title, meta: `${item.time} · story moment`, note: item.note })} onDeleteMoment={deleteStoryMoment} onPetsNavigate={() => navigateTo('pets')} onAddPet={openAddPetForm} petName={petName} petAvatar={petAvatar} ownerName={ownerName} accounts={prototypeSession.accounts} contexts={savedContexts} observations={storyObservations} includedMoments={includedStoryMoments} hasDemoMoments={activePetRecord.hasDemoMoments} noPetYet={activePetRecord.isEmptyProfile ?? false} canEdit={canContributeToSharedPet} />}
            {view === 'storyEdit' && <StoryEditPage observations={storyObservations} includedMoments={includedStoryMoments} petName={petName} hasDemoMoments={activePetRecord.hasDemoMoments} onBack={() => goBack('story')} onEdit={editStoryRow} onDelete={deleteStoryRow} onSave={(ids) => { if (!persistWorkspacePatch({ visibility: ids })) return; setIncludedStoryMoments(ids); if (!cloud) try {
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
            {view === 'momentDetail' && <MomentDetailPage moment={selectedMoment} contexts={selectedMomentContexts} accounts={prototypeSession.accounts} ownerName={ownerName} ownerAvatar={ownerAvatar} currentAccountId={activeAccount.id} groupOwnerAccountId={activePetRecord.sharedGroupId ? groupOwnerAccountId : undefined} petName={petName} canContribute={canContributeToSharedPet} canInteract={canInteractWithGroupContext} engagement={momentEngagement[selectedMoment.id] ?? { likes: [], favorites: [] }} onToggleMomentLike={() => toggleMomentEngagement(selectedMoment.id, 'likes')} onToggleMomentFavorite={() => toggleMomentEngagement(selectedMoment.id, 'favorites')} onBack={() => goBack('story')} onAddContext={() => startContextForMoment(selectedMoment.id)} onEditContext={(context) => startContextForMoment(selectedMoment.id, context)} onDeleteContext={deleteOwnerContext} onToggleLike={toggleContextLike} onAddComment={addContextComment} onEditOwnComment={editOwnContextComment} onDeleteOwnComment={deleteOwnContextComment} />}
            {view === 'overview' && <OverviewPage onBack={() => goBack('today')} onClip={() => { setSelectedMomentId('window'); navigateTo('clip'); }} saved={savedContexts.find((context) => context.momentId === 'window') ?? null} onSaved={() => openMomentDetail('window')} petName={petName}/>}
            {view === 'clip' && <ClipPage onBack={() => goBack('overview')} onContext={() => startContextForMoment('window')} petName={petName} ownerName={ownerName} canContribute={canContributeToSharedPet} />}
            {view === 'context' && <ContextPage moment={selectedMoment} petName={petName} note={note} setNote={setNote} interpretation={interpretation} setInterpretation={setInterpretation} attachments={contextAttachments} setAttachments={setContextAttachments} onBack={() => goBack('momentDetail')} onReview={() => navigateTo('confirm')} />}
            {view === 'confirm' && <ConfirmPage moment={selectedMoment} note={note} interpretation={interpretation} attachments={contextAttachments} petName={petName} ownerName={ownerName} ownerRole={ownerRole} saveError={contextSaveError} onBack={() => goBack('context')} onSave={saveContext} />}
            {view === 'saved' && lastSavedContext && <SavedPage saved={lastSavedContext} onBack={() => goBack('confirm')} onReturnStory={() => navigateTo('story')} onUndo={() => undoContext(lastSavedContext.id)} onEvidence={() => openMomentDetail(lastSavedContext.momentId)} onEdit={() => startContextForMoment(lastSavedContext.momentId, lastSavedContext)} petName={petName} ownerName={ownerName} />}
            {view === 'undone' && <UndonePage onBack={() => goBack('saved')} onReturnToday={() => navigateTo('today')} onReview={() => navigateTo('overview')} petName={petName} />}
            {view === 'ask' && <AskPage onPetsNavigate={() => navigateTo('pets')} petName={petName} petAvatar={petAvatar} messages={askMessages} messageEndRef={askEndRef} noPetYet={activePetRecord.isEmptyProfile ?? false} busy={askBusy} pending={askPending} live={Boolean(cloud)} />}
            {(view === 'pets' || view === 'you') && <SimplePage kind={view} petName={petName} petAvatar={petAvatar} petBreed={petBreed} petAge={petAge} ownerName={ownerName} ownerRole={ownerRole} ownerAvatar={ownerAvatar} ownerPreference={ownerPreference} pets={activeAccount.pets} activePetId={activePetRecord.id} accounts={prototypeSession.accounts} onPetsNavigate={() => navigateTo('pets')} onSettingsNavigate={() => navigateTo('settings')} onPetEdit={() => navigateTo('petDetails')} onProfileEdit={() => navigateTo('profile')} onPetSwitcher={activePetRecord.isEmptyProfile ? openAddPetForm : () => setShowPetSwitcher(true)} careMembers={orderedCareMembers} primaryMemberId={primaryMemberId} onMemberClick={openCareMember} onCareMembers={() => navigateTo('careMembers')} patterns={typicalPatterns} lifeEvents={lifeCareEvents} mediaSources={mediaSources} onPatternHistory={() => openPatternKnowledge()} onPattern={(id) => openPatternKnowledge(id)} onLifeCare={openLifeCare} onConnectedMedia={openConnectedMedia} invitations={view === 'you' ? receivedCareInvitations : []} onAcceptInvitation={acceptCareInvitation} onDeclineInvitation={(id) => updateInvitationStatus(id, 'declined')} careOwnerName={groupOwnerAccount?.name ?? groupOwnerMember?.name ?? ownerName} careOwnerAvatar={groupOwnerAccount?.avatar ?? groupOwnerMember?.avatar ?? (groupOwnerAccountId === activeAccount.id ? ownerAvatar : '')} careOwnerRole="Primary caregiver" groupName={activeGroupName} canManageCareGroup={isPrimaryCaregiver} canEditPetDetails={isPrimaryCaregiver} canAddLifeCare={canManageLongTermCare} canManageConnectedMedia={canManageLongTermCare} noPetYet={activePetRecord.isEmptyProfile ?? false} />}
            {view === 'connectedMedia' && <ConnectedMediaPage petName={petName} sources={mediaSources} initialSourceId={selectedMediaSourceId} onBack={() => goBack('you')} onUpdate={saveMediaSource} onDelete={deleteMediaSource} />}
            {view === 'patternHistory' && <PatternKnowledgePage petName={petName} ownerName={ownerName} patterns={typicalPatterns} initialPatternId={selectedPatternId} canManage={isPrimaryCaregiver} onBack={() => goBack('pets')} onSave={saveTypicalPattern} onDelete={deleteTypicalPattern} />}
            {view === 'careEvent' && <LifeCarePage petName={petName} ownerName={ownerName} primaryOwnerName={groupOwnerAccount?.name ?? groupOwnerMember?.name ?? ownerName} currentAccountId={activeAccount.id} events={lifeCareEvents} initialCategory={lifeCareInitialCategory} startAdding={lifeCareStartAdding} canAdd={canManageLongTermCare} canManageAll={isPrimaryCaregiver} onBack={() => goBack('pets')} onSave={saveLifeCareEvent} onDelete={deleteLifeCareEvent} />}
            {view === 'settings' && !cloud && <SettingsHubPage accounts={prototypeSession.accounts} activeAccountId={activeAccount.id} onBack={() => goBack('you')} onSwitchAccount={switchAccount} onRegister={registerAccount} onDeleteAccount={deleteSavedAccount} onSignOut={() => setShowSignOutConfirm(true)} onAction={(title, detail) => setProfileAction({ title, detail })} />}
            {view === 'settings' && cloud && <section className="settings-hub-page">
              <header className="settings-hub-header"><button className="back-button" aria-label="Go back" onClick={() => goBack('you')}>←</button><h1>Settings</h1></header>
              <div className="settings-hub-content">
                <section className="settings-hub-section">
                  <h2>Account</h2>
                  <div className="profile-card settings-account-list">
                    {cloud.accounts.map(account => {
                      const currentUsername = activeAccount.email.endsWith('@users.pawsona.invalid') ? activeAccount.email.split('@')[0].toLowerCase() : activeAccount.email.toLowerCase();
                      const isCurrent = account.username.toLowerCase() === currentUsername;
                      return <div key={account.username} className={`settings-account-row ${isCurrent ? 'current' : ''}`}>
                        <button className="settings-account-switch" aria-current={isCurrent ? 'true' : undefined} onClick={() => { if (!isCurrent) cloud.switchAccount(account.username); }}>
                          <OwnerAvatar src={isCurrent ? ownerAvatar : ''} name={isCurrent ? ownerName : account.name} />
                          <span><strong>{isCurrent ? ownerName : account.name}</strong><small>{account.username}</small></span>
                          <em>{isCurrent ? 'Current' : 'Switch'}</em>
                        </button>
                        <button className="settings-account-delete" aria-label={`Remove ${account.name} from this device`} title="Remove from this device" onClick={() => setPendingDeviceAccountRemoval(account)}>Remove</button>
                      </div>;
                    })}
                    <button className="settings-create-account" onClick={cloud.addAnotherAccount}>＋ Add another account</button>
                  </div>
                  <button className="settings-signout-row" onClick={() => setShowSignOutConfirm(true)}><span className="settings-signout-icon" aria-hidden="true">↪</span><span><strong>Sign out</strong><small>Your cloud records will remain in your account</small></span><i>›</i></button>
                </section>
                <section className="settings-hub-section">
                  <div className="profile-section-heading"><h2>Privacy &amp; support</h2><button className="profile-link" onClick={() => setProfileAction({ title: 'Privacy & support', detail: 'Review data permissions, sharing, retention and accessibility preferences.' })}>Open →</button></div>
                  <div className="profile-card you-list privacy-list">
                    <button className="media-row" onClick={() => setProfileAction({ title: 'Data, sharing & retention', detail: 'Review permissions, access and deletion.' })}><span className="media-icon">▤</span><span><strong>Data, sharing &amp; retention</strong><small>Review permissions, access and deletion</small></span><i>›</i></button>
                    <button className="media-row" onClick={() => setProfileAction({ title: 'Accessibility & feedback', detail: 'Text size, captions, help and suggestions.' })}><span className="media-icon">◎</span><span><strong>Accessibility &amp; feedback</strong><small>Text size, captions, help and suggestions</small></span><i>›</i></button>
                  </div>
                </section>
              </div>
            </section>}
            {view === 'petDetails' && <SettingsPage kind="petDetails" initialName={petName} initialAvatar={petAvatar} initialBreed={petBreed} initialAge={petAge} onSaved={setPetName} onPetSaved={({ name, breed, age, avatar }) => { setPetName(name); setPetBreed(breed); setPetAge(age); setPetAvatar(avatar); updateActivePetRecord({ name, breed, age, avatar }); setProfileSaveNotice('Pet details saved successfully'); }} onBack={() => goBack('pets')} />}
            {view === 'profile' && <SettingsPage kind="profile" initialName={ownerName} initialAvatar={ownerAvatar} initialPreference={ownerPreference} onSaved={setOwnerName} onProfileSaved={({ name, avatar, preference }) => { setOwnerName(name); setOwnerAvatar(avatar); setOwnerPreference(preference); updateActiveAccountRecord({ name, avatar, preference }); setProfileSaveNotice('Profile saved successfully'); }} onBack={() => goBack('you')} />}
            {view === 'memberDetails' && selectedCareMember && <CareMemberDetailsPage member={selectedCareMember} ownerName={groupOwnerAccount?.name ?? groupOwnerMember?.name ?? ownerName} ownerRole={groupOwnerAccount?.role ?? 'Primary caregiver'} ownerAvatar={groupOwnerAccount?.avatar ?? groupOwnerMember?.avatar ?? (groupOwnerAccountId === activeAccount.id ? ownerAvatar : '')} ownerPreference={groupOwnerAccount?.preference ?? ownerPreference} memberAvatar={selectedMemberAccount?.avatar ?? selectedCareMember.avatar ?? ''} memberPreference={selectedMemberAccount?.preference ?? ''} primaryMemberId={primaryMemberId} isPrimaryCaregiver={isPrimaryCaregiver} petName={petName} onBack={() => goBack('careMembers')} />}
            {view === 'careMembers' && (
              <PetSecondaryPage
                kind={view}
                petName={petName}
                ownerName={groupOwnerAccount?.name ?? groupOwnerMember?.name ?? ownerName}
                ownerEmail={groupOwnerAccount?.email ?? groupOwnerMember?.email ?? (groupOwnerAccountId === activeAccount.id ? activeAccount.email : 'Account email hidden')}
                ownerAvatar={groupOwnerAccount?.avatar ?? groupOwnerMember?.avatar ?? (groupOwnerAccountId === activeAccount.id ? ownerAvatar : '')}
                onTransferPrimary={transferPrimaryCaregiver}
                groupName={activeGroupName}
                onGroupNameChange={updateCareGroupName}
                careMembers={orderedCareMembers}
                primaryMemberId={primaryMemberId}
                isPrimaryCaregiver={isPrimaryCaregiver}
                accounts={prototypeSession.accounts}
                activeAccountId={activeAccount.id}
                invitations={activeGroupInvitations}
                onChangeAccess={(id, access) => updateCareGroupMember(id, { access })}
                onChangeRole={(id, role) => updateCareGroupMember(id, { role })}
                onChangeExpiry={(id, expiresAt) => updateCareGroupMember(id, { expiresAt })}
                onCancelInvitation={(id) => updateInvitationStatus(id, 'cancelled')}
                cloudSearchEnabled={Boolean(cloud)}
                onMemberClick={openCareMember}
                onRemoveMember={(id) => updateCareGroupMember(id, { remove: true })}
                onAddMember={sendCareInvitation}
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
        {view === 'story' && canContributeToSharedPet && <button className={`floating-add ${showStoryAddOptions ? 'is-open' : ''}`} aria-expanded={showStoryAddOptions} onClick={() => setShowStoryAddOptions((open) => !open)}><span className="add-icon" aria-hidden="true">+</span><span className="add-label">Add</span></button>}
        {view === 'story' && canContributeToSharedPet && showStoryAddOptions && <div className="story-add-menu-backdrop" role="presentation" onClick={() => setShowStoryAddOptions(false)}><div className="story-add-choices" role="menu" aria-label="Add to Story" onClick={(event) => event.stopPropagation()}><button className="story-add-choice story-add-choice-new" role="menuitem" onClick={() => { setShowStoryAddOptions(false); startStoryObservation(); }}>New moment</button><button className="story-add-choice story-add-choice-drafts" role="menuitem" onClick={() => { setShowStoryAddOptions(false); navigateTo('drafts'); }}>Drafts{storyDrafts.length > 0 ? ` (${storyDrafts.length})` : ''}</button></div></div>}
        {view === 'ask' && <AskComposer key={askIdentity} busy={askBusy} enabled={Boolean(cloud && activePetRecord && !activePetRecord.isEmptyProfile)} value={askInput} onValue={(value) => { setAskInput(value); if (askSaveError) setAskSaveError(''); }} onSend={sendAskMessage} saveError={askSaveError} onQuickContext={(value) => { setAskSaveError(''); setAskInput((current) => current ? `${current} ${value}` : value); }} />}
        {profileAction && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setProfileAction(null)}><section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" onClick={(event) => event.stopPropagation()}><button className="profile-dialog-close" aria-label="Close" onClick={() => setProfileAction(null)}>×</button><h2 id="profile-dialog-title">{profileAction.title}</h2><p>{profileAction.detail}</p><button className="primary-button" onClick={() => setProfileAction(null)}>Done</button></section></div>}
        {pendingDeviceAccountRemoval && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDeviceAccountRemoval(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-device-account-title" onClick={(event) => event.stopPropagation()}><h2 id="remove-device-account-title">Remove {pendingDeviceAccountRemoval.name} from this device?</h2><p>{pendingDeviceAccountRemoval.username.toLowerCase() === (activeAccount.email.endsWith('@users.pawsona.invalid') ? activeAccount.email.split('@')[0].toLowerCase() : activeAccount.email.toLowerCase()) ? 'You will be signed out of this account. Its cloud account and records will not be deleted.' : 'This only removes the remembered username from this device. The cloud account and its records will not be deleted.'}</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDeviceAccountRemoval(null)}>Cancel</button><button className="danger-button" onClick={() => { void confirmRemoveDeviceAccount(); }}>Remove from device</button></div></section></div>}
        {showAccountSwitcher && <AccountSwitcher accounts={prototypeSession.accounts} activeAccountId={activeAccount.id} onClose={() => setShowAccountSwitcher(false)} onSwitch={switchAccount} onRegister={registerAccount} onRequestSignOut={() => { setShowAccountSwitcher(false); setShowSignOutConfirm(true); }} />}
        {showPetSwitcher && <PetSwitcher pets={activeAccount.pets} activePetId={activePetRecord.id} initialAdding={petSwitcherStartsAdding} onClose={() => { setShowPetSwitcher(false); setPetSwitcherStartsAdding(false); }} onSwitch={switchPet} onAdd={addPet} onDelete={deletePet} />}
        {showSignOutConfirm && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setShowSignOutConfirm(false)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="signout-title" onClick={(event) => event.stopPropagation()}><h2 id="signout-title">Sign out of Pawsona?</h2><p>{cloud ? "Synced records remain in your cloud account. Pending changes must finish syncing before you sign out." : "Your guest records will remain in this browser."}</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setShowSignOutConfirm(false)}>Cancel</button><button className="danger-button" onClick={signOut}>Sign out</button></div></section></div>}
        {accountActionError && <button className="account-error-toast" role="alert" onClick={() => setAccountActionError('')}>{accountActionError}<span>Dismiss</span></button>}
        {contextSavedNotice && <div className="context-saved-toast" role="status"><span aria-hidden="true">✓</span> Context saved</div>}
        {storyDraftSavedNotice && <div className="context-saved-toast" role="status"><span aria-hidden="true">✓</span> Saved to drafts</div>}
        {profileSaveNotice && <div className="profile-save-toast" role="status">{profileSaveNotice}</div>}
        {mainView && <BottomNav active={activeNav} onNavigate={navigate} />}
      </div>
    </div>
  );
}




