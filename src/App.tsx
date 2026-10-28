import BreedPicker from './BreedPicker';
import { breedAvatar, normalizePetSex, type PetSex } from './petBreeds';
import ThinkingAvatar from './ThinkingAvatar';
import MomentCarousel from './MomentCarousel';
import PatternSuggestions from './PatternSuggestions';
import SettingsPanels, { readPreferences } from './SettingsPanels';
import { activityCategoryLabel, activityCategoryRecords, activityInsightReviewFor, activityInsightReviewId, activityPeriodFor, activityRecordsOnDate, activityRecordsThroughDate, activitySummaryDateWindow, activitySummaryIdentity, attentionActivityInsights, compareActivityWeeks, rankDailyActivityInsights, selectWeeklyInsight, type ActivityInsightReview, type ActivityInsightReviewStatus, type ActivityPeriod, type RankedDailyActivityInsight } from './activitySummary';
import { clockMinute, type DailyPattern } from '../supabase/functions/_shared/dailyPatterns';
import Welcome from './Welcome';
import { requestAskAI } from './askAI';
import { searchCareAccounts, type CareAccountSearchResult, type CloudCareGroup, type CloudCareInvitation } from './cloud';
import { visibleStoryObservations } from './storyVisibility';
import { buildRollingStorySimulation, isSyntheticSunnyProfile } from './storySimulation';
import { mergeSharedStoryObservations } from './sharedStoryObservations';
import { appendCareTaskEvent, careTaskAttentionCount, careTaskSummaryTasks, careTaskUnreadCount, careTasksForDate, isObservationSkippedForToday, markCareTaskEventsRead, releaseAcceptedCareTask, takeOverDeclinedCareTask, type CareTask, type CareTaskEvent, type CareTaskEventType } from './careTasks';
import { useEffect, useRef, useState, type FormEvent, type ReactElement, type ReactNode, type RefObject } from 'react';

type View =
  | 'today'
  | 'story'
  | 'ask'
  | 'pets'
  | 'you'
  | 'favorites'
  | 'settings'
  | 'petDetails'
  | 'profile'
  | 'memberDetails'
  | 'careMembers'
  | 'careTasks'
  | 'patternHistory'
  | 'careEvent'
  | 'connectedMedia'
  | 'activitySummary'
  | 'activityInsights'
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

type TypicalPattern = DailyPattern;

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
  recordDetails?: Record<string, string>;
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
type StoryObservation = { id: string; note: string; title: string; image: string; mediaType?: string; relatedPhotos?: StoryMedia[]; momentCount: number; momentIds?: string[]; sourceNotes?: StorySourceNote[]; context: string; privateRecord: boolean; sourceKind?: string; savedAt: string; authorId?: string; authorName?: string; authorAvatar?: string; synthetic?: boolean; observationKind?: 'meal' | 'walk' | 'play' | 'rest' | string; simulationKey?: string; metrics?: Record<string, number> };
type StoryDraft = { id: string; selectedMoments: string[]; note: string; title?: string; momentAt?: string; relatedPhotos?: StoryMedia[]; context: string; savedAt: string; privateRecord?: boolean; uploadedMedia?: StoryMedia };
type AskAttachment = { url: string; name: string; kind: 'image' | 'audio'; type: string };
type AskMessage = { role: 'user' | 'assistant'; text: string; attachment?: AskAttachment };
type PetWorkspace = {
  sunnyVaccinationSeeded?: boolean;
  groupName: string;
  contexts: OwnerContext[];
  observations: StoryObservation[];
  momentEngagement: MomentEngagementById;
  drafts: StoryDraft[];
  visibility: string[] | null;
  askMessages: AskMessage[];
  askOwnerAccountId?: string;
  careMembers: CareMember[];
  careTasks: CareTask[];
  careEvent: CareEvent | null;
  mediaSources: MediaSource[];
  patterns: TypicalPattern[];
  lifeEvents: LifeCareEvent[];
  insightReviews: ActivityInsightReview[];
  scenarioDate?: string;
  sharedUpdatedAt?: string;
  petSex?: PetSex;
};
type PrototypePet = {
  id: string;
  name: string;
  breed: string;
  species?: 'Dog' | 'Cat';
  sex?: PetSex;
  age: string;
  avatar: string;
  hasDemoMoments: boolean;
  isEmptyProfile?: boolean;
  sharedGroupId?: string;
  sharedOwnerAccountId?: string;
  workspace: PetWorkspace;
};


type OwnerCareProfile = { relationship: string; routine: string; tasks: string[] };
function normalizeOwnerCareProfile(value?: Partial<OwnerCareProfile>): OwnerCareProfile {
  return { relationship: typeof value?.relationship === 'string' ? value.relationship.slice(0, 80) : '', routine: typeof value?.routine === 'string' ? value.routine.slice(0, 160) : '', tasks: Array.isArray(value?.tasks) ? value.tasks.filter((task): task is string => typeof task === 'string').slice(0, 6) : [] };
}
type PrototypeAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  preference: string;
  careProfile?: OwnerCareProfile;
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

function formatTimelineDate(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date);
  const dayAndMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
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

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function useCurrentTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 15_000);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  return now;
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

function careIdentityLabel(email?: string) {
  if (!email) return 'Care group member';
  return email.toLowerCase().endsWith('@users.pawsona.invalid') ? `@${email.split('@')[0]}` : email;
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
  const [failedSrc, setFailedSrc] = useState('');
  const showImage = Boolean(src) && failedSrc !== src;
  return <span className={`member-avatar emily-avatar owner-avatar ${className}`}>{showImage ? <img src={src} alt="" onError={() => setFailedSrc(src)} /> : name.slice(0, 1).toUpperCase()}</span>;
}

function MainHeader({ eyebrow, title, subtitle, petName, petAvatar = '', hasPet = true, onPetsNavigate, onSettingsNavigate, className = '' }: { eyebrow: string; title: string; subtitle?: string; petName: string; petAvatar?: string; hasPet?: boolean; onPetsNavigate?: () => void; onSettingsNavigate?: () => void; className?: string }) {
  return (
    <header className={`main-header ${className}`}>
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

function BottomNav({ active, onNavigate, unreadCareCount = 0 }: { active: View; onNavigate: (view: View) => void; unreadCareCount?: number }) {
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
          aria-label={item.id === 'today' && unreadCareCount > 0 ? `Today, ${unreadCareCount} unread care ${unreadCareCount === 1 ? 'notification' : 'notifications'}` : item.label}
        >
          <span className="nav-icon">
            {item.icon === 'paw' ? <svg className="paw-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="5.2" cy="9" rx="2.1" ry="2.8" /><ellipse cx="10" cy="5.7" rx="2" ry="2.7" /><ellipse cx="15.2" cy="5.8" rx="2" ry="2.7" /><ellipse cx="19" cy="9.8" rx="2" ry="2.7" /><path d="M12 10.2c-2.1 0-3.1 1.9-4.5 3.4-1.2 1.3-2.2 2.6-1.7 4.1.6 1.7 2.2 1.7 3.8 1.2.9-.3 1.6-.5 2.5-.5s1.7.2 2.6.5c1.5.5 3.1.5 3.7-1.2.5-1.5-.5-2.8-1.7-4.1-1.4-1.5-2.5-3.4-4.7-3.4Z" /></svg> : item.icon ? <img src={asset(item.icon)} alt="" /> : <span className="you-icon" />}
            {item.id === 'today' && unreadCareCount > 0 && <span className="nav-unread-dot" aria-hidden="true" />}
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
  return Boolean(observation.image);
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
    source: `${observation.sourceKind === 'camera' ? 'Simulated camera clip' : 'Owner observation'} · ${formatRelativeDate(observation.savedAt)}`,
    observationContext: observation.context,
  };
  const base = baseMomentDefinitions.find((entry) => entry.id === momentId) ?? baseMomentDefinitions[1];
  return { ...base, image: asset(base.image) };
}


function DailyRhythmCard({ petName, petAvatar, moments, scheduledMoments, onOpenActivitySummary, patterns, careTasks, careMembers, currentUserId, canAct, isPrimary, onToggleCareTask, onSkipCareTask, onOpenCareTasks, onPatterns, dayOffset, onDayOffsetChange }: { petName: string; petAvatar: string; moments: StoryObservation[]; scheduledMoments: StoryObservation[]; onOpenActivitySummary: (moment: StoryObservation) => void; patterns: TypicalPattern[]; careTasks: CareTask[]; careMembers: CareMember[]; currentUserId: string; canAct: boolean; isPrimary: boolean; onToggleCareTask: (task: CareTask) => void; onSkipCareTask: (task: CareTask) => void; onOpenCareTasks: () => void; onPatterns: (patternId?: string) => void; dayOffset: number; onDayOffsetChange: (offset: number) => void; scenarioDate?: string }) {
  const [view, setView] = useState<'today' | 'pattern'>('today');
  const [revealedActivityId, setRevealedActivityId] = useState<string | null>(null);
  const wheelRef = useRef<SVGGElement | null>(null);
  useEffect(() => setRevealedActivityId(null), [view, dayOffset]);
  const dragStart = useRef<number | null>(null);
  const todayButtonDragStart = useRef<number | null>(null);
  const suppressTodayClick = useRef(false);
  const navStart = useRef<'previous' | 'newer' | null>(null);
  const pressedMomentId = useRef<string | null>(null);
  const suppressNavClick = useRef(false);
  const now = useCurrentTime();
  const displayName = petName.replace(/\s*[（(]test[^）)]*[）)]$/i, '');
  const selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  const isPattern = view === 'pattern';
  const timedPatterns = patterns.filter(p => p.status === 'confirmed' && p.activity && Number.isFinite(p.startMinute) && Number.isFinite(p.endMinute) && p.startMinute! >= 0 && p.endMinute! <= 1440 && p.startMinute! < p.endMinute!);
  const patternById = new Map(timedPatterns.map(p => [p.id, p]));
  const selectedMoments: StoryObservation[] = isPattern ? timedPatterns.map(p => {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, (p.startMinute! + p.endMinute!) / 2);
    return { id: p.id, title: p.activity!, note: p.detail, image: '', momentCount: 0, context: '', privateRecord: false, savedAt: at.toISOString(), observationKind: /Breakfast|Lunch|Dinner/.test(p.activity!) ? 'meal' : p.activity!.toLowerCase() };
  }) : moments.filter(moment => isSameLocalDay(moment.savedAt, selectedDate));
  const openActivity = (moment: StoryObservation) => {
    if (revealedActivityId !== moment.id) { setRevealedActivityId(moment.id); return; }
    if (isPattern) onPatterns(moment.id); else onOpenActivitySummary(moment);
  };
  const displayTime = (moment: StoryObservation, date: Date) => isPattern ? `${clockMinute(patternById.get(moment.id)!.startMinute!)}–${clockMinute(patternById.get(moment.id)!.endMinute!)}` : timeLabel(date);
  const routineTasks = careTasksForDate(patterns, scheduledMoments, careTasks, selectedDate, now, displayName);
  const datedTasks = careTasks.filter(task => !task.sourcePatternId && !task.sourceObservationId && isSameLocalDay(task.dueAt, selectedDate) && task.status !== 'declined');
  const dayCareTasks = [...routineTasks, ...datedTasks].sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const summaryCareTasks = careTaskSummaryTasks(dayCareTasks, now);
  const allCareTasksComplete = dayCareTasks.length > 0 && dayCareTasks.every(task => task.status === 'done');
  const memberName = (id: string, fallback?: string) => id === 'simulation' ? 'Pawsona' : careMembers.find(member => member.id === id)?.name ?? fallback ?? 'Caregiver';
  const requestAttentionCount = careTaskAttentionCount(careTasks, currentUserId, isPrimary);
  const unreadRequestCount = careTaskUnreadCount(careTasks, currentUserId);
  const isToday = !isPattern && dayOffset === 0;
  const dayTitle = isToday ? 'TODAY' : dayOffset === -1 ? 'YESTERDAY' : new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(selectedDate).toUpperCase();
  const selectedDateLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(selectedDate);
  const currentPetAvatar = petAvatar || asset('luna-avatar.png');
  const dayProgress = (minutes: number) => {
    const clampedMinutes = Math.max(0, Math.min(1440, minutes));
    return clampedMinutes / 1440;
  };
  const pointAtProgress = (progress: number, radius: number) => {
    const angle = Math.PI - Math.max(0, Math.min(1, progress)) * Math.PI;
    return { x: 300 + radius * Math.cos(angle), y: 390 - radius * Math.sin(angle) };
  };
  const pointOnDial = (minutes: number, radius: number) => pointAtProgress(dayProgress(minutes), radius);
  const timeLabel = (date: Date) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  const chronologicalMoments = selectedMoments.map(moment => {
    const date = new Date(moment.savedAt);
    const minutes = date.getHours() * 60 + date.getMinutes();
    return { moment, minutes, progress: dayProgress(minutes), time: displayTime(moment, date) };
  }).sort((left, right) => left.minutes - right.minutes);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowProgress = dayProgress(nowMinutes);
  const beforeNow = isToday ? chronologicalMoments.filter(entry => entry.minutes < nowMinutes) : [];
  const afterNow = isToday ? chronologicalMoments.filter(entry => entry.minutes >= nowMinutes) : [];
  const allMoments = isToday ? [] : chronologicalMoments;
  const maxProgressGap = 14 / 180;
  const progressGap = isToday
    ? Math.min(maxProgressGap, beforeNow.length ? nowProgress / beforeNow.length : maxProgressGap, afterNow.length ? (1 - nowProgress) / afterNow.length : maxProgressGap)
    : Math.min(maxProgressGap, allMoments.length > 1 ? 1 / (allMoments.length - 1) : maxProgressGap);
  const fitProgressGroup = (entries: typeof chronologicalMoments, lower: number, upper: number) => {
    if (!entries.length) return new Map<string, number>();
    const blocks: Array<{ start: number; end: number; sum: number; count: number }> = [];
    entries.forEach((entry, index) => {
      blocks.push({ start: index, end: index, sum: entry.progress - index * progressGap, count: 1 });
      while (blocks.length > 1) {
        const right = blocks[blocks.length - 1];
        const left = blocks[blocks.length - 2];
        if (left.sum / left.count <= right.sum / right.count) break;
        blocks.splice(-2, 2, { start: left.start, end: right.end, sum: left.sum + right.sum, count: left.count + right.count });
      }
    });
    const positions = new Map<string, number>();
    blocks.forEach(block => {
      const fittedProgress = Math.max(lower, Math.min(upper, block.sum / block.count));
      for (let index = block.start; index <= block.end; index += 1) {
        positions.set(entries[index].moment.id, fittedProgress + index * progressGap);
      }
    });
    return positions;
  };
  const adjustedProgress = isToday
    ? new Map([
      ...fitProgressGroup(beforeNow, 0, nowProgress - beforeNow.length * progressGap),
      ...fitProgressGroup(afterNow, nowProgress + progressGap, 1 - Math.max(0, afterNow.length - 1) * progressGap),
    ])
    : fitProgressGroup(allMoments, 0, 1 - Math.max(0, allMoments.length - 1) * progressGap);
  const momentPoints = selectedMoments.map(moment => {
    const date = new Date(moment.savedAt);
    const minutes = date.getHours() * 60 + date.getMinutes();
    return { moment, ...pointAtProgress(adjustedProgress.get(moment.id) ?? dayProgress(minutes), 220), minutes, time: displayTime(moment, date) };
  });
  const activityLabelRadius = 270;
  const activityMarkers = momentPoints.map(point => {
    const radialX = (point.x - 300) / 220;
    const radialY = (point.y - 390) / 220;
    const iconX = 300 + radialX * activityLabelRadius;
    const iconY = 390 + radialY * activityLabelRadius;
    return { ...point, iconX, iconY };
  });
  const placedTimeBoxes: Array<{ id: string; left: number; right: number; top: number; bottom: number }> = [];
  const timeLabelPositions = new Map<string, { timeX: number; timeY: number }>();
  [...activityMarkers].sort((left, right) => left.minutes - right.minutes).forEach(marker => {
    const outward = marker.iconX < 300 ? -1 : 1;
    const offsets = [outward * 28, outward * 56, 0, -outward * 28, outward * 84, -outward * 56, -outward * 84];
    const verticalOffsets = [0, -18, 18, -36, 36];
    const candidates = offsets.flatMap(offset => verticalOffsets.map(verticalOffset => {
      const timeX = Math.max(34, Math.min(566, marker.iconX + offset));
      const timeY = marker.iconY - 40 + verticalOffset;
      const halfWidth = Math.max(29, marker.time.length * 5.8);
      return { timeX, timeY, halfWidth, cost: Math.abs(offset - outward * 28) + Math.abs(verticalOffset) * 1.5 };
    })).sort((left, right) => left.cost - right.cost);
    const isClear = (candidate: typeof candidates[number]) => {
      const box = { left: candidate.timeX - candidate.halfWidth, right: candidate.timeX + candidate.halfWidth, top: candidate.timeY - 12, bottom: candidate.timeY + 12 };
      if (box.left < 4 || box.right > 596 || box.top < 20 || box.bottom > 382) return false;
      if (placedTimeBoxes.some(placed => box.left < placed.right + 8 && box.right + 8 > placed.left && box.top < placed.bottom + 6 && box.bottom + 6 > placed.top)) return false;
      return activityMarkers.every(other => other.moment.id === marker.moment.id ||
        !(box.left < other.iconX + 23 && box.right > other.iconX - 23 && box.top < other.iconY + 23 && box.bottom > other.iconY - 23));
    };
    const chosen = candidates.find(isClear) ?? candidates[0];
    timeLabelPositions.set(marker.moment.id, { timeX: chosen.timeX, timeY: chosen.timeY });
    placedTimeBoxes.push({ left: chosen.timeX - chosen.halfWidth, right: chosen.timeX + chosen.halfWidth, top: chosen.timeY - 12, bottom: chosen.timeY + 12, id: marker.moment.id });
  });
  const labeledMomentPoints = activityMarkers.map(point => ({ ...point, label: { iconX: point.iconX, iconY: point.iconY, ...timeLabelPositions.get(point.moment.id)! } }));
  const timeLabelLeaders = labeledMomentPoints.map(({ moment, x, y, label }) => {
    const radialX = (x - 300) / 220;
    const radialY = (y - 390) / 220;
    return {
      id: moment.id,
      x1: x + radialX * 9,
      y1: y + radialY * 9,
      x2: label.iconX - radialX * 26,
      y2: label.iconY - radialY * 26,
    };
  });
  const activityGlyph = (moment: StoryObservation) => moment.observationKind === 'meal' ? '🥣'
    : moment.observationKind === 'walk' ? '🐾'
      : moment.observationKind === 'rest' ? '💤'
        : moment.observationKind === 'play' ? '🎾'
          : /food|dinner|breakfast|lunch/i.test(moment.title) ? '🥣'
            : /walk/i.test(moment.title) ? '🐾'
              : /rest|sleep/i.test(moment.title) ? '💤' : /play|toy|fetch/i.test(moment.title) ? '🎾' : '✨';
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const currentPoint = pointOnDial(currentMinute, isPattern ? 180 : 220);
  const patternPointerOuter = pointOnDial(currentMinute, 207);
  const revealedMarker = labeledMomentPoints.find(point => point.moment.id === revealedActivityId);
  const activityLabelsOnTop = revealedMarker
    ? [...labeledMomentPoints.filter(point => point.moment.id !== revealedActivityId), revealedMarker]
    : labeledMomentPoints;
  const animateWheel = (direction: 'clockwise' | 'counterclockwise') => {
    const wheel = wheelRef.current;
    if (!wheel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    wheel.getAnimations().forEach(animation => animation.cancel());
    const endingAngle = direction === 'counterclockwise' ? -360 : 360;
    wheel.animate(
      [{ transform: 'rotate(0deg)' }, { transform: `rotate(${endingAngle}deg)` }],
      { duration: 720, easing: 'cubic-bezier(.2,.7,.25,1)' },
    );
  };
  const goToPreviousDay = () => { if (!isPattern) { animateWheel('clockwise'); onDayOffsetChange(dayOffset - 1); } };
  const goToNewerDay = () => { if (!isPattern && dayOffset < 0) { animateWheel('counterclockwise'); onDayOffsetChange(dayOffset + 1); } };
  const handleNavKey = (event: React.KeyboardEvent<SVGGElement>, direction: 'previous' | 'newer') => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (direction === 'previous') goToPreviousDay(); else goToNewerDay();
  };
  return <section className={`daily-rhythm-card ${isPattern ? 'is-pattern' : ''}`} aria-labelledby="daily-rhythm-title">
    <header className="daily-rhythm-header">
      <div><p className="eyebrow">DAILY RHYTHM</p><h2 id="daily-rhythm-title">{displayName}’s day</h2></div>
      <div className={`daily-rhythm-toggle ${isPattern ? 'is-pattern' : ''}`} role="tablist" aria-label="Daily rhythm view">
        <button type="button" role="tab" aria-selected={view === 'today'} className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>Today</button>
        <button type="button" role="tab" aria-selected={view === 'pattern'} className={view === 'pattern' ? 'active' : ''} onClick={() => setView('pattern')}>Pattern</button>
      </div>
    </header>
    <>
    <div className="daily-rhythm-chart">
      {!isPattern && dayOffset < 0 && <button type="button" className="daily-rhythm-go-today" onPointerDown={event => { todayButtonDragStart.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={event => { const startX = todayButtonDragStart.current; todayButtonDragStart.current = null; if (startX === null) return; const deltaX = event.clientX - startX; if (deltaX > 32 || deltaX < -32) { suppressTodayClick.current = true; if (deltaX > 32) goToPreviousDay(); else goToNewerDay(); window.setTimeout(() => { suppressTodayClick.current = false; }, 0); } }} onPointerCancel={() => { todayButtonDragStart.current = null; }} onClick={() => { if (suppressTodayClick.current) { suppressTodayClick.current = false; return; } onDayOffsetChange(0); }}>Today</button>}
      {revealedMarker && <button type="button" className="daily-rhythm-selected-banner" aria-label={`Open details for ${revealedMarker.moment.title} at ${revealedMarker.time}`} onClick={() => openActivity(revealedMarker.moment)}>
        <span className="daily-rhythm-selected-banner-icon" aria-hidden="true">{activityGlyph(revealedMarker.moment)}</span>
        <span className="daily-rhythm-selected-banner-title">{revealedMarker.moment.title}</span>
        <span className="daily-rhythm-selected-banner-time">{revealedMarker.time}</span>
        <span className="daily-rhythm-selected-banner-arrow" aria-hidden="true">→</span>
      </button>}
      <svg viewBox="0 0 600 424" role="application" tabIndex={0} aria-label={isPattern ? `Confirmed daily patterns for ${displayName}. Select an activity to reveal its time window, then select again for details.` : `Daily moments for ${dayTitle.toLowerCase()} on a true 24-hour scale. Select an activity to reveal its time, then select again for details. Swipe right to view the previous day or swipe left to view a newer day.`}
        onPointerDown={event => {
          const target = event.target as Element;
          dragStart.current = event.clientX;
          navStart.current = target.closest('[data-day-nav]')?.getAttribute('data-day-nav') as 'previous' | 'newer' | null;
          const momentTrigger = target.closest('[data-moment-trigger]')?.getAttribute('data-moment-trigger');
          pressedMomentId.current = momentTrigger ?? null;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={event => {
          const startX = dragStart.current;
          const clickedNav = navStart.current;
          const clickedMomentId = pressedMomentId.current;
          dragStart.current = null;
          navStart.current = null;
          pressedMomentId.current = null;
          if (startX !== null) {
            const deltaX = event.clientX - startX;
            if (deltaX > 32) { suppressNavClick.current = true; goToPreviousDay(); window.setTimeout(() => { suppressNavClick.current = false; }, 0); }
            else if (deltaX < -32) { suppressNavClick.current = true; goToNewerDay(); window.setTimeout(() => { suppressNavClick.current = false; }, 0); }
            else if (clickedMomentId) {
              const selected = selectedMoments.find(moment => moment.id === clickedMomentId);
              if (selected) openActivity(selected);
            }
            else if (clickedNav) { suppressNavClick.current = true; if (clickedNav === 'previous') goToPreviousDay(); else if (!isToday) goToNewerDay(); window.setTimeout(() => { suppressNavClick.current = false; }, 0); }
          }
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { dragStart.current = null; navStart.current = null; pressedMomentId.current = null; }}
        >
        <defs>
          <linearGradient id="rhythm-gradient" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#e3ad22"/><stop offset=".35" stopColor="#f4c52f"/><stop offset=".68" stopColor="#ffdc61"/><stop offset="1" stopColor="#eab522"/></linearGradient>
          <linearGradient id="rhythm-horizon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff6d1" stopOpacity=".8"/><stop offset="1" stopColor="#fffdf7" stopOpacity=".1"/></linearGradient>
          <radialGradient id="rhythm-orb-surface" cx="36%" cy="22%" r="82%"><stop offset="0" stopColor="#fffef9"/><stop offset=".38" stopColor="#fff9e9"/><stop offset=".72" stopColor="#f6eccf"/><stop offset="1" stopColor="#e5d5ae"/></radialGradient>
          <radialGradient id="rhythm-orb-gloss" cx="36%" cy="20%" r="78%"><stop offset="0" stopColor="#fff" stopOpacity=".62"/><stop offset=".3" stopColor="#fff" stopOpacity=".22"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient>
          <marker id="rhythm-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M2 1.5 7 5 2 8.5" fill="none" stroke="#ffcf29" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></marker>
          <clipPath id="rhythm-current-avatar-clip" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath>
          <clipPath id="rhythm-upper-half"><rect x="0" y="0" width="600" height="390"/></clipPath>
        </defs>
        <g clipPath="url(#rhythm-upper-half)">
        <foreignObject x="0" y="0" width="600" height="390" aria-hidden="true"><div className="daily-rhythm-daylight-bg" /></foreignObject>
        <circle className="daily-rhythm-horizon-backdrop" cx="300" cy="390" r="156" aria-hidden="true"/>
        <g className="daily-rhythm-landscape" aria-hidden="true">
          <path className="daily-rhythm-landscape-hill-back" d="M18 350 Q76 315 138 346 Q198 318 256 347 Q310 318 368 346 Q430 315 490 346 Q542 318 582 348 L600 390 L0 390 Z"/>
          <path className="daily-rhythm-landscape-hill-front" d="M0 369 Q68 333 132 365 Q194 342 248 365 Q300 343 352 365 Q416 337 476 365 Q540 336 600 367 L600 390 L0 390 Z"/>
          <path className="daily-rhythm-landscape-ray" d="M300 302 V292 M276 310 L269 302 M324 310 L331 302"/>
          <circle className="daily-rhythm-landscape-sun" cx="300" cy="329" r="25"/>
          <path className="daily-rhythm-landscape-trunk" d="M72 372 V348 M95 373 V340 M505 372 V343 M529 372 V350"/>
          <ellipse className="daily-rhythm-landscape-tree" cx="72" cy="344" rx="11" ry="17"/>
          <ellipse className="daily-rhythm-landscape-tree" cx="95" cy="335" rx="13" ry="20"/>
          <ellipse className="daily-rhythm-landscape-tree" cx="505" cy="338" rx="12" ry="18"/>
          <ellipse className="daily-rhythm-landscape-tree" cx="529" cy="346" rx="10" ry="15"/>
        </g>
        <g ref={wheelRef} className="daily-rhythm-wheel">
          <circle className="daily-rhythm-band-shadow" cx="300" cy="390" r="220"/>
          <circle className="daily-rhythm-band" cx="300" cy="390" r="220"/>
          <circle className="daily-rhythm-horizon-fill" cx="300" cy="390" r="156"/>
          <circle className="daily-rhythm-orb-highlight" cx="300" cy="390" r="156"/>
          <circle className="daily-rhythm-inner-arc" cx="300" cy="390" r="156"/>
          <circle className="daily-rhythm-inner-arc inner-arc-two" cx="300" cy="390" r="136"/>
          {isPattern && <path className="daily-rhythm-pattern-current-track" d="M120 390 A180 180 0 0 1 480 390" aria-hidden="true"/>}
          {isPattern && timedPatterns.map(p => { const start = pointOnDial(p.startMinute!, 220), end = pointOnDial(p.endMinute!, 220); return <path key={`${p.id}-window`} className="daily-pattern-window" d={`M${start.x} ${start.y} A220 220 0 0 1 ${end.x} ${end.y}`}>{revealedActivityId === p.id && <title>{p.activity} · {clockMinute(p.startMinute!)}–{clockMinute(p.endMinute!)}</title>}</path>; })}
          {timeLabelLeaders.map(line => <line key={`${line.id}-leader`} className="daily-rhythm-leader-line" x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} aria-hidden="true"/>)}
          {momentPoints.map(({ moment, x, y, time }) => <g className="daily-rhythm-point" key={moment.id} data-moment-trigger={moment.id} role="button" tabIndex={0} aria-label={revealedActivityId === moment.id ? `Open details for ${moment.title} at ${time}` : `Show time for ${moment.title}`} aria-pressed={revealedActivityId === moment.id} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openActivity(moment); } }}>
            <circle className="daily-rhythm-point-hit" cx={x} cy={y} r="28"/>
            <circle className="daily-rhythm-point-marker" cx={x} cy={y} r="7"/>
            <circle className="daily-rhythm-point-core" cx={x} cy={y} r="2.5"/>
          </g>)}
          {(isToday || isPattern) && <g className="daily-rhythm-current-point" aria-label={`Current time ${timeLabel(now)}`}>
            <title>Now · {timeLabel(now)}</title>
            {isPattern && <line className="daily-rhythm-pattern-current-pointer" x1={currentPoint.x} y1={currentPoint.y} x2={patternPointerOuter.x} y2={patternPointerOuter.y} aria-hidden="true"/>}
            <circle className="daily-rhythm-current-avatar-outer" cx={currentPoint.x} cy={currentPoint.y} r="23"/>
            <circle className="daily-rhythm-current-avatar-inner" cx={currentPoint.x} cy={currentPoint.y} r="20"/>
            <image href={currentPetAvatar} x={currentPoint.x - 18.5} y={currentPoint.y - 18.5} width="37" height="37" preserveAspectRatio="xMidYMid slice" clipPath="url(#rhythm-current-avatar-clip)"/>
          </g>}
          {activityLabelsOnTop.map(({ moment, label, time }) => <g className={`daily-rhythm-time-trigger daily-rhythm-activity-label ${moment.observationKind ?? 'other'} ${revealedActivityId === moment.id ? 'is-revealed' : ''}`} key={`${moment.id}-label`} data-moment-trigger={moment.id} role="button" tabIndex={0} aria-label={revealedActivityId === moment.id ? `Open details for ${moment.title} at ${time}` : `Show time for ${moment.title}`} aria-pressed={revealedActivityId === moment.id} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openActivity(moment); } }}>
            <rect className="daily-rhythm-time-hit" x={label.iconX - 37} y={label.iconY - 37} width="74" height="88"/>
            <circle className="daily-rhythm-activity-badge" cx={label.iconX} cy={label.iconY} r="27"/>
            <text className="daily-rhythm-activity-glyph" x={label.iconX} y={label.iconY + 1} textAnchor="middle" dominantBaseline="middle">{activityGlyph(moment)}</text>

          </g>)}
        </g>
        </g>
        <text className="daily-rhythm-time daily-rhythm-end-time" x="52" y="410" textAnchor="middle" dominantBaseline="middle">00:00</text>
        <text className="daily-rhythm-time daily-rhythm-end-time" x="548" y="410" textAnchor="middle" dominantBaseline="middle">00:00</text>
        {!isPattern && <><g className="daily-rhythm-nav-arrow" data-day-nav="previous" role="button" tabIndex={0} aria-label="Show previous day" onClick={() => { if (!suppressNavClick.current) goToPreviousDay(); }} onKeyDown={event => handleNavKey(event, 'previous')}>
          <path className="daily-rhythm-arrow-hit" d="M230 276 A136 136 0 0 0 176 336"/>
          <path className="daily-rhythm-arrow" d="M230 276 A136 136 0 0 0 176 336" markerEnd="url(#rhythm-arrow)"/>
        </g>
        <g className={`daily-rhythm-nav-arrow ${isToday ? 'disabled' : ''}`} data-day-nav="newer" role="button" tabIndex={isToday ? -1 : 0} aria-disabled={isToday} aria-label="Show newer day" onClick={() => { if (!suppressNavClick.current && !isToday) goToNewerDay(); }} onKeyDown={event => { if (!isToday) handleNavKey(event, 'newer'); }}>
          <path className="daily-rhythm-arrow-hit" d="M370 276 A136 136 0 0 1 424 336"/>
          <path className="daily-rhythm-arrow" d="M370 276 A136 136 0 0 1 424 336" markerEnd="url(#rhythm-arrow)"/>
        </g>
        </>}
        <g className="daily-rhythm-center-selection" {...(revealedMarker ? { role: 'button', tabIndex: 0, 'data-moment-trigger': revealedMarker.moment.id, 'aria-label': `Open details for ${revealedMarker.moment.title}`, onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openActivity(revealedMarker.moment); } } } : {})}>
          <text className="daily-rhythm-center-title" x="300" y="306" textAnchor="middle">{isPattern ? 'PATTERN' : dayTitle}</text>
          <text className="daily-rhythm-center-date" x="300" y="332" textAnchor="middle">{isPattern ? 'Select an activity' : selectedDateLabel}</text>
        </g>
    </svg>
    </div>
    {isPattern ? <div className="daily-pattern-summary"><span>{timedPatterns.length ? `${timedPatterns.length} confirmed daily patterns · Usual time windows` : 'No confirmed activity times yet.'}</span><button type="button" className="profile-link" onClick={() => onPatterns()}>{timedPatterns.length ? 'View pattern evidence →' : 'Set up typical patterns →'}</button></div> : <section className="daily-rhythm-care" aria-label="Care tasks for selected day">
      <div className="daily-rhythm-care-heading"><div><strong><svg className="daily-rhythm-care-title-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg><span>{isToday ? 'Today’s care' : `Care · ${selectedDateLabel}`}</span></strong><small>{dayCareTasks.length ? `${dayCareTasks.filter(task => task.status === 'done').length} of ${dayCareTasks.length} done${dayCareTasks.some(task => task.status === 'skipped') ? ` · ${dayCareTasks.filter(task => task.status === 'skipped').length} not today` : ''}` : 'Based on today’s planned activities'}</small></div><button type="button" onClick={onOpenCareTasks}>{unreadRequestCount > 0 && <span className="care-request-unread-dot" aria-label={`${unreadRequestCount} unread care ${unreadRequestCount === 1 ? 'notification' : 'notifications'}`} />}{requestAttentionCount ? `Requests · ${requestAttentionCount}` : unreadRequestCount ? 'Requests' : 'View all →'}</button></div>
      {dayCareTasks.length ? <div className="daily-rhythm-care-list">{summaryCareTasks.map(task => {
        const canComplete = canAct && !task.autoCompleted && task.status !== 'requested' && task.status !== 'skipped' && (task.status === 'done' ? isPrimary || task.completedBy === currentUserId : !task.assignedTo || task.assignedTo === currentUserId);
        const time = task.sourcePatternId ? task.note.replace(/^Usual window /, '') : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(task.dueAt));
        const detail = task.status === 'skipped' ? 'Not today · hidden from Story' : task.autoCompleted ? `Activity recorded · Completed by ${memberName(task.completedBy ?? 'simulation', task.completedByName)}` : task.status === 'done' ? `Completed by ${memberName(task.completedBy ?? '', task.completedByName)}` : task.status === 'requested' ? `Waiting for ${memberName(task.assignedTo)}` : task.assignedTo ? `Assigned to ${memberName(task.assignedTo)}` : task.sourceObservationId ? 'Planned simulated activity' : 'Shared routine';
        return <div className={`daily-rhythm-care-row ${task.status === 'done' ? 'is-done' : ''} ${task.status === 'skipped' ? 'is-skipped' : ''}`} key={task.id}><button type="button" className={`daily-rhythm-care-check ${task.status === 'done' ? 'is-done' : ''} ${task.status === 'skipped' ? 'is-skipped' : ''}`} aria-label={task.status === 'done' ? `${task.title} completed` : task.status === 'skipped' ? `${task.title} is not planned today` : `Mark ${task.title} complete`} disabled={!canComplete} onClick={() => onToggleCareTask(task)}>{task.status === 'done' ? '✓' : task.status === 'skipped' ? '—' : ''}</button><span className="daily-rhythm-care-copy"><strong>{task.title}</strong><small>{time} · {detail}</small></span>{canAct && task.sourceObservationId && (task.status === 'open' || task.status === 'skipped') && <button type="button" className="daily-rhythm-care-skip" onClick={() => onSkipCareTask(task)}>{task.status === 'skipped' ? 'Add back' : 'Not today'}</button>}</div>;
      })}</div> : <p className="daily-rhythm-care-empty">No planned activities for this day.</p>}
      {(!dayCareTasks.length || allCareTasksComplete || dayCareTasks.length > summaryCareTasks.length) && <div className="daily-rhythm-care-footer">{!dayCareTasks.length && <button type="button" onClick={() => setView('pattern')}>Review Pattern →</button>}{allCareTasksComplete ? <span>All activities completed</span> : dayCareTasks.length > summaryCareTasks.length && <span>+{dayCareTasks.length - summaryCareTasks.length} more activities</span>}</div>}
    </section>}
    </>
  </section>;
}

function formatActivityDuration(minutes: number) {
  if (!minutes) return 'Not recorded';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours} hr ${remainder} min`;
  if (hours) return `${hours} hr`;
  return `${remainder} min`;
}

function PetActivitySummaryPage({ moment, moments, petId, petName, petAvatar, onBack }: { moment: StoryObservation; moments: StoryObservation[]; petId: string; petName: string; petAvatar: string; onBack: () => void }) {
  const summaryIdentity = activitySummaryIdentity(moment);
  const [selectedTrendPoint, setSelectedTrendPoint] = useState<{ index: number; series: 'total' | 'morning' | 'afternoon' | 'evening' } | null>(null);
  const [focusedTrendSeries, setFocusedTrendSeries] = useState<'total' | ActivityPeriod | null>(summaryIdentity.defaultPeriod);
  const [flippedStats, setFlippedStats] = useState({ total: false, today: false });
  const [momentPeriod, setMomentPeriod] = useState<'total' | ActivityPeriod>(summaryIdentity.defaultPeriod);
  const [showMoreRecords, setShowMoreRecords] = useState(false);
  const [weeklyInsight, setWeeklyInsight] = useState('');
  const [showWeeklyWhy, setShowWeeklyWhy] = useState(false);
  const [weeklyInsightBusy, setWeeklyInsightBusy] = useState(false);
  const [weeklyInsightError, setWeeklyInsightError] = useState('');
  const weeklyInsightController = useRef<AbortController | null>(null);
  useEffect(() => () => {
    const controller = weeklyInsightController.current;
    weeklyInsightController.current = null;
    controller?.abort();
  }, []);
  useEffect(() => {
    setFocusedTrendSeries(summaryIdentity.defaultPeriod);
    setMomentPeriod(summaryIdentity.defaultPeriod);
    setShowMoreRecords(false);
    setSelectedTrendPoint(null);
  }, [summaryIdentity.key, summaryIdentity.defaultPeriod]);
  const selectedDate = new Date(moment.savedAt);
  selectedDate.setHours(0, 0, 0, 0);
  const categoryRecords = activityCategoryRecords(moments, summaryIdentity);
  const related = activityRecordsThroughDate(categoryRecords, selectedDate);
  const recordsThroughSelectedDate = related;
  const duration = (entry: StoryObservation) => Math.max(0, Number(entry.metrics?.durationMinutes) || 0);
  const totalMinutes = recordsThroughSelectedDate.reduce((sum, entry) => sum + duration(entry), 0);
  const selectedDayMoments = activityRecordsOnDate(categoryRecords, selectedDate);
  const selectedDayMinutes = selectedDayMoments.reduce((sum, entry) => sum + duration(entry), 0);
  const category = summaryIdentity.label;
  const statCategory = activityCategoryLabel(summaryIdentity.kind);
  const days = activitySummaryDateWindow(selectedDate);
  const weeklyComparison = compareActivityWeeks(related, selectedDate);
  const weeklyHighlight = selectWeeklyInsight(weeklyComparison.current, weeklyComparison.previous);
  const wallClockToday = new Date();
  const wallClockYesterday = new Date(wallClockToday);
  wallClockYesterday.setDate(wallClockYesterday.getDate() - 1);
  const isSelectedToday = isSameLocalDay(moment.savedAt, wallClockToday);
  const isSelectedYesterday = isSameLocalDay(moment.savedAt, wallClockYesterday);
  const selectedDayLabel = isSelectedToday ? 'Today' : isSelectedYesterday ? 'Yesterday' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(selectedDate);
  const selectedDayTitle = isSelectedToday ? `Today’s ${statCategory} time`
    : isSelectedYesterday ? `Yesterday’s ${statCategory} time`
      : `${statCategory} time · ${selectedDayLabel}`;
  const selectedDayCountLabel = `${selectedDayMoments.length} ${selectedDayMoments.length === 1 ? 'moment' : 'moments'} ${isSelectedToday ? 'today' : isSelectedYesterday ? 'yesterday' : `on ${selectedDayLabel}`}`;
  const formatSummaryDate = (date: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  const weeklyEvidence = `${formatSummaryDate(weeklyComparison.current.startDate)}–${formatSummaryDate(weeklyComparison.current.endDate)} vs ${formatSummaryDate(weeklyComparison.previous.startDate)}–${formatSummaryDate(weeklyComparison.previous.endDate)}`;
  const formatDelta = (value: number) => `${value > 0 ? '+' : ''}${value}`;
  const weeklyMetrics = [
    { label: 'Records/week', current: weeklyComparison.current.recordCount, previous: weeklyComparison.previous.recordCount, unit: '' },
    ...(weeklyComparison.current.durationRecordCount && weeklyComparison.previous.durationRecordCount ? [{ label: 'Avg min/record', current: weeklyComparison.current.durationMinutes / weeklyComparison.current.durationRecordCount, previous: weeklyComparison.previous.durationMinutes / weeklyComparison.previous.durationRecordCount, unit: 'm' }] : []),
    ...(weeklyComparison.current.consumptionRecordCount && weeklyComparison.previous.consumptionRecordCount ? [{ label: 'Avg g/record', current: weeklyComparison.current.consumedGrams / weeklyComparison.current.consumptionRecordCount, previous: weeklyComparison.previous.consumedGrams / weeklyComparison.previous.consumptionRecordCount, unit: 'g' }] : []),
  ];
  const weeklyInsightLabel = weeklyHighlight?.key === 'duration' ? 'Average duration per record'
    : weeklyHighlight?.key === 'food' ? 'Average food per record'
      : weeklyHighlight?.key === 'records' ? 'Record frequency' : '';
  const computedWeeklyConclusion = weeklyHighlight
    ? `${weeklyInsightLabel} ${weeklyHighlight.relativeChange > 0 ? 'increased' : 'decreased'} ${Math.round(Math.abs(weeklyHighlight.relativeChange) * 100)}% vs the previous week.`
    : 'No standout change in recorded activity this week.';
  const requestWeeklyInsight = async () => {
    if (!weeklyComparison.canCompare || weeklyInsightBusy) return;
    const controller = new AbortController();
    weeklyInsightController.current = controller;
    setWeeklyInsightBusy(true);
    setWeeklyInsightError('');
    const timeout = setTimeout(() => controller.abort(), 45000);
    const summarize = (stats: typeof weeklyComparison.current) => ({
      startDate: formatSummaryDate(stats.startDate),
      endDate: formatSummaryDate(stats.endDate),
      recordedDays: stats.daysWithRecords,
      recordCount: stats.recordCount,
      durationMinutes: stats.durationRecordCount ? stats.durationMinutes : null,
      recordsWithDuration: stats.durationRecordCount,
      averageDurationMinutes: stats.averageDurationMinutes,
      consumedGrams: stats.consumptionRecordCount ? stats.consumedGrams : null,
      recordsWithConsumption: stats.consumptionRecordCount,
    });
    const currentStats = summarize(weeklyComparison.current);
    const previousStats = summarize(weeklyComparison.previous);
    const comparison = {
      current7Days: currentStats,
      previous7Days: previousStats,
      precomputedChanges: {
        recordCount: currentStats.recordCount - previousStats.recordCount,
        recordedDays: currentStats.recordedDays - previousStats.recordedDays,
        durationMinutes: currentStats.durationMinutes === null || previousStats.durationMinutes === null ? null : currentStats.durationMinutes - previousStats.durationMinutes,
        averageDurationMinutes: currentStats.averageDurationMinutes === null || previousStats.averageDurationMinutes === null ? null : currentStats.averageDurationMinutes - previousStats.averageDurationMinutes,
        consumedGrams: currentStats.consumedGrams === null || previousStats.consumedGrams === null ? null : currentStats.consumedGrams - previousStats.consumedGrams,
      },
    };
    try {
      const answer = await requestAskAI(petId, [{
        role: 'user',
        text: `Write one concise English headline (maximum 12 words) stating which selected metric increased or decreased and by what rounded percentage versus the previous week. Use the exact direction and percentage from the selected metric. Do not add an explanation, cause, health claim, or other metrics. Return plain text only. Selected metric: ${JSON.stringify(weeklyHighlight)}. Comparison context: ${JSON.stringify(comparison)}`,
      }], controller.signal, false);
      if (weeklyInsightController.current === controller) {
        const headline = answer.trim().split(/(?<=[.!?])\s+/)[0].slice(0, 110);
        const expectedChange = `${Math.round(Math.abs(weeklyHighlight?.relativeChange ?? 0) * 100)}%`;
        const expectedDirection = (weeklyHighlight?.relativeChange ?? 0) > 0 ? 'increased' : 'decreased';
        setWeeklyInsight(headline.includes(expectedChange) && headline.toLowerCase().includes(expectedDirection) ? headline : computedWeeklyConclusion);
      }
    } catch (cause) {
      if (weeklyInsightController.current === controller) {
        setWeeklyInsightError(controller.signal.aborted ? 'The summary took too long. Please try again.' : cause instanceof Error ? cause.message : 'AI summary is unavailable. Please try again.');
      }
    } finally {
      clearTimeout(timeout);
      if (weeklyInsightController.current === controller) {
        weeklyInsightController.current = null;
        setWeeklyInsightBusy(false);
      }
    }
  };
  const hasDurations = related.some(entry => duration(entry) > 0);
  const periodFor = activityPeriodFor;
  const periodSummary = (entries: StoryObservation[]) => (['morning', 'afternoon', 'evening'] as const).map(period => {
    const matches = entries.filter(entry => periodFor(entry) === period);
    return { period, count: matches.length, minutes: matches.reduce((sum, entry) => sum + duration(entry), 0) };
  });
  const totalPeriodSummary = periodSummary(recordsThroughSelectedDate);
  const selectedDayPeriodSummary = periodSummary(selectedDayMoments);
  const trend = days.map(date => {
    const entries = related.filter(entry => isSameLocalDay(entry.savedAt, date));
    const valueForPeriod = (period: 'morning' | 'afternoon' | 'evening') => {
      const periodEntries = entries.filter(entry => periodFor(entry) === period);
      return hasDurations ? periodEntries.reduce((sum, entry) => sum + duration(entry), 0) : periodEntries.length;
    };
    return {
      date,
      total: hasDurations ? entries.reduce((sum, entry) => sum + duration(entry), 0) : entries.length,
      morning: valueForPeriod('morning'),
      afternoon: valueForPeriod('afternoon'),
      evening: valueForPeriod('evening'),
    };
  });
  const maxTrend = Math.max(0, ...trend.map(entry => entry.total));
  const chartMax = maxTrend ? Math.max(2, Math.ceil(maxTrend / 2) * 2) : 0;
  const chartY = (value: number) => 96 - (chartMax ? value / chartMax * 68 : 0);
  const trendX = (index: number) => 50 + index * 45;
  const formatTrendValue = (value: number) => {
    if (!hasDurations) return `${value} ${value === 1 ? 'moment' : 'moments'}`;
    const minutes = Math.round(value);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours && remainder) return `${hours}h ${remainder}m`;
    if (hours) return `${hours}h`;
    return `${remainder}m`;
  };
  const activityIcon = (entry: StoryObservation) => entry.observationKind === 'meal' ? '🥣'
    : entry.observationKind === 'walk' ? '🐾'
      : entry.observationKind === 'rest' ? '💤'
        : entry.observationKind === 'play' ? '🎾'
          : /food|dinner|breakfast|lunch/i.test(entry.title) ? '🥣'
            : /walk/i.test(entry.title) ? '🐾'
              : /rest|sleep/i.test(entry.title) ? '💤' : /play|toy|fetch/i.test(entry.title) ? '🎾' : '✨';
  const recordDateLabel = (entry: StoryObservation) => {
    const date = new Date(entry.savedAt);
    return `${new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date)} · ${formatObservationTime(entry.savedAt).replace('\n', ' · ')}`;
  };
  const periodRecords = momentPeriod === 'total' ? related : related.filter(entry => periodFor(entry) === momentPeriod);
  const displayedMoment = momentPeriod === 'total' ? moment : [...periodRecords].sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime())[0];
  const displayedOtherRecords = periodRecords.filter(entry => entry.id !== displayedMoment?.id).sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime());
  const trendSeries = [
    { key: 'total' as const, label: 'Total', values: trend.map(entry => entry.total) },
    { key: 'morning' as const, label: 'Morning', values: trend.map(entry => entry.morning) },
    { key: 'afternoon' as const, label: 'Afternoon', values: trend.map(entry => entry.afternoon) },
    { key: 'evening' as const, label: 'Evening', values: trend.map(entry => entry.evening) },
  ];
  const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(moment.savedAt));
  return <section className="activity-summary-page">
    <header className="activity-summary-header">
      <button className="back-button" type="button" aria-label="Back to daily rhythm" onClick={onBack}>←</button>
      <div><p className="eyebrow">PET ACTIVITY</p><h1>{category} summary</h1></div>
    </header>
    <div className="activity-summary-pet"><Avatar name={petName} src={petAvatar} /><span><strong>{petName}</strong><small>{dateLabel} · {formatObservationTime(moment.savedAt).replace('\n', ' · ')}</small></span></div>
    <section className="activity-summary-stats" aria-label="Activity duration">
      {([
        { key: 'total' as const, title: `Total ${statCategory} time`, value: totalMinutes, count: recordsThroughSelectedDate.length, label: `${recordsThroughSelectedDate.length} recorded ${recordsThroughSelectedDate.length === 1 ? 'moment' : 'moments'}`, breakdown: totalPeriodSummary },
        { key: 'today' as const, title: selectedDayTitle, value: selectedDayMinutes, count: selectedDayMoments.length, label: selectedDayCountLabel, breakdown: selectedDayPeriodSummary },
      ]).map(card => <button type="button" key={card.key} className={`activity-summary-stat-flip ${flippedStats[card.key] ? 'is-flipped' : ''}`} aria-pressed={flippedStats[card.key]} aria-label={`${card.title}. ${flippedStats[card.key] ? 'Show total' : 'Show morning, afternoon and evening breakdown'}`} onClick={() => setFlippedStats(current => ({ ...current, [card.key]: !current[card.key] }))}>
        <span className="activity-summary-stat-face activity-summary-stat-front" aria-hidden={flippedStats[card.key]}>
          <span>{card.title}</span><strong>{formatActivityDuration(card.value)}</strong><small>{card.label}</small>
        </span>
        <span className="activity-summary-stat-face activity-summary-stat-back" aria-hidden={!flippedStats[card.key]}>
          {card.breakdown.map(row => <span className="activity-summary-stat-period" key={row.period}><span><b>{row.period[0].toUpperCase() + row.period.slice(1)}</b><small>{row.count} {row.count === 1 ? 'record' : 'records'}</small></span><strong>{row.minutes ? formatActivityDuration(row.minutes) : '0 min'}</strong></span>)}
        </span>
      </button>)}
    </section>
    <section className="activity-summary-ai">
      <div className="activity-summary-ai-top">
        <div className="activity-summary-ai-copy"><span className="activity-summary-ai-icon" aria-hidden="true">✦</span><div><h2>AI summary</h2></div></div>
        {weeklyComparison.canCompare && weeklyHighlight && <div className="activity-summary-ai-actions"><button type="button" className="activity-summary-ai-action" aria-expanded={showWeeklyWhy} aria-controls="activity-summary-ai-details" onClick={() => setShowWeeklyWhy(value => !value)}>{showWeeklyWhy ? 'Hide' : 'Why?'}</button><button type="button" className="activity-summary-ai-action" onClick={() => void requestWeeklyInsight()} disabled={weeklyInsightBusy}>{weeklyInsightBusy ? 'Refreshing…' : 'Refresh'}</button></div>}
      </div>
      <p className="activity-summary-ai-conclusion">{weeklyInsight || computedWeeklyConclusion}</p>
      {weeklyComparison.canCompare && showWeeklyWhy && <div id="activity-summary-ai-details"><div className="activity-summary-ai-metrics" aria-label="Current week compared with previous week">{weeklyMetrics.map(metric => <div className="activity-summary-ai-metric" key={metric.label}><span>{metric.label}</span><strong>{metric.current.toLocaleString('en-US', { maximumFractionDigits: 1 })}{metric.unit} <i>vs</i> {metric.previous.toLocaleString('en-US', { maximumFractionDigits: 1 })}{metric.unit}</strong><small>{metric.previous ? formatDelta(Number(((metric.current - metric.previous) / metric.previous * 100).toFixed(1))) : '0'}%</small></div>)}</div><p className="activity-summary-ai-evidence">{weeklyEvidence}</p></div>}
      {weeklyInsightError && <p className="activity-summary-ai-error" role="alert">{weeklyInsightError}</p>}
    </section>
    <section className="activity-summary-trend">
      <div className="activity-summary-section-heading"><div><h2>Activity trend</h2><p>Last 7 days · {hasDurations ? 'duration' : 'recorded moments'}</p></div></div>
      <div className="activity-summary-chart-legend" aria-label="Chart series">
        {trendSeries.map(series => <button className={`activity-summary-legend-item ${series.key} ${focusedTrendSeries && focusedTrendSeries !== series.key ? 'is-muted' : ''} ${focusedTrendSeries === series.key ? 'is-focused' : ''}`} key={series.key} type="button" aria-pressed={focusedTrendSeries === series.key} aria-label={`${focusedTrendSeries === series.key ? 'Show all curves; currently highlighting' : 'Highlight'} ${series.label}`} onClick={() => setFocusedTrendSeries(current => current === series.key ? null : series.key)}><i aria-hidden="true"/>{series.label}</button>)}
      </div>
      <p className="activity-summary-period-note">By start time · Morning 05:00–12:00 · Afternoon 12:00–17:30 · Evening 17:30–05:00</p>
      <svg viewBox="0 0 360 132" role="img" aria-label={`Activity trend for the last seven days, in ${hasDurations ? 'duration' : 'recorded moments'}. Total: ${trend.map(entry => formatTrendValue(entry.total)).join(', ')}.`}>
        <path className="activity-summary-chart-grid" d="M44 28H344 M44 62H344 M44 96H344" />
        {[chartMax, chartMax / 2, 0].map((value, index) => <text key={`y-${index}`} className="activity-summary-chart-axis-label" x="38" y={31 + index * 34} textAnchor="end">{formatTrendValue(value)}</text>)}
        {trendSeries.map(series => <polyline className={`activity-summary-chart-line ${series.key} ${focusedTrendSeries && focusedTrendSeries !== series.key ? 'is-muted' : ''}`} key={`${series.key}-line`} points={series.values.map((value, index) => `${trendX(index)},${chartY(value)}`).join(' ')} />)}
        {trend.map((entry, index) => <text key={`${entry.date.toISOString()}-day`} className="activity-summary-chart-day-label" x={trendX(index)} y="122" textAnchor="middle">{new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(entry.date)}</text>)}
        {trendSeries.flatMap(series => trend.map((entry, index) => {
          const value = series.values[index];
          if (series.key !== 'total' && value === 0) return null;
          const x = trendX(index);
          const y = chartY(value);
          const selected = selectedTrendPoint?.index === index && selectedTrendPoint.series === series.key;
          const dateText = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(entry.date);
          return <g key={`${series.key}-${entry.date.toISOString()}`} className={`activity-summary-chart-day ${series.key} ${selected ? 'is-selected' : ''} ${focusedTrendSeries && focusedTrendSeries !== series.key ? 'is-muted' : ''}`} role="button" tabIndex={0} aria-pressed={selected} aria-label={`${series.label}, ${dateText}: ${formatTrendValue(value)}`} onClick={() => setSelectedTrendPoint({ index, series: series.key })} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedTrendPoint({ index, series: series.key }); } }}>
            {selected && <text className="activity-summary-chart-value" x={x} y={Math.max(14, y - 11)} textAnchor="middle">{series.label} · {formatTrendValue(value)}</text>}
            <circle className="activity-summary-chart-hit" cx={x} cy={y} r="13" />
            <circle className="activity-summary-chart-point" cx={x} cy={y} r={selected ? 5 : 4} />
          </g>;
        }))}
      </svg>
      {!related.length && <p className="activity-summary-empty">No activity moments have been recorded yet.</p>}
    </section>
    <section className="activity-summary-moment-card">
      <span className="eyebrow">SELECTED MOMENT</span>
      <div className="activity-summary-moment-periods" role="group" aria-label="Filter records by time of day">
        {(['total', 'morning', 'afternoon', 'evening'] as const).map(period => <button type="button" key={period} className={momentPeriod === period ? 'is-active' : ''} aria-pressed={momentPeriod === period} onClick={() => setMomentPeriod(period)}>{period === 'total' ? 'Total' : period[0].toUpperCase() + period.slice(1)}</button>)}
      </div>
      {!displayedMoment ? <p className="activity-summary-period-empty">No {momentPeriod} records for this activity in the available history.</p> : <>
      <article className="activity-summary-selected-record">
        <div className="activity-summary-record-copy">
          <time dateTime={displayedMoment.savedAt}>{recordDateLabel(displayedMoment)}</time>
          <h2>{displayedMoment.title}</h2>
          <p>{displayedMoment.note || 'No additional notes for this moment.'}</p>
          {duration(displayedMoment) > 0 && <small>{formatActivityDuration(duration(displayedMoment))}</small>}
        </div>
        {displayedMoment.image ? <img className="activity-summary-selected-image" src={displayedMoment.image} alt="" /> : <span className="activity-summary-record-fallback" aria-hidden="true">{activityIcon(displayedMoment)}</span>}
      </article>
      {displayedOtherRecords.length > 0 && <>
        <button className="activity-summary-more-toggle" type="button" aria-expanded={showMoreRecords} aria-controls="activity-summary-more-records" onClick={() => setShowMoreRecords(open => !open)}>
          {showMoreRecords ? 'Show fewer records' : `Show more records · ${displayedOtherRecords.length}`}
          <span aria-hidden="true">{showMoreRecords ? '↑' : '↓'}</span>
        </button>
        {showMoreRecords && <div className="activity-summary-more-records" id="activity-summary-more-records">
          {displayedOtherRecords.map(entry => <article className="activity-summary-more-record" key={entry.id}>
            {entry.image ? <img src={entry.image} alt="" /> : <span className="activity-summary-record-fallback" aria-hidden="true">{activityIcon(entry)}</span>}
            <div><time dateTime={entry.savedAt}>{recordDateLabel(entry)}</time><strong>{entry.title}</strong><p>{entry.note || 'No additional notes for this moment.'}</p>{duration(entry) > 0 && <small>{formatActivityDuration(duration(entry))}</small>}</div>
          </article>)}
        </div>}
      </>}
      </>}
    </section>
  </section>;
}

function ActivityInsightsPage({ records, petName, reviews, canReview, onReview, onBack, onActivitySummary }: { records: StoryObservation[]; petName: string; reviews: ActivityInsightReview[]; canReview: boolean; onReview: (insight: RankedDailyActivityInsight, status: ActivityInsightReviewStatus) => void; onBack: () => void; onActivitySummary: (record: StoryObservation) => void }) {
  const referenceDate = useCurrentTime();
  const observedRecords = records.filter(record => new Date(record.savedAt).getTime() <= referenceDate.getTime());
  const rankedInsights = rankDailyActivityInsights(observedRecords, referenceDate);
  const topInsights = rankedInsights.slice(0, 3);
  const activityIcon = (label: string) => /food|dinner|breakfast|lunch|meal|feed/i.test(label) ? '🥣'
    : /walk|stroll|outdoor|potty/i.test(label) ? '🐾'
      : /rest|sleep/i.test(label) ? '💤'
        : /play|toy|fetch|game/i.test(label) ? '🎾' : '✨';
  const formatDate = (date: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  const formatReviewTime = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  const latestRecordFor = (activityKey: string, date: Date) => observedRecords
    .filter(record => activitySummaryIdentity(record).key === activityKey && isSameLocalDay(record.savedAt, date))
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())[0];

  return <section className="activity-summary-page activity-insights-page">
    <header className="activity-summary-header"><button className="back-button" aria-label="Go back" onClick={onBack}>←</button><div><p className="eyebrow">PET ACTIVITY</p><h1>Worth a closer look</h1></div></header>
    <p className="activity-insights-intro">{petName}’s standout recorded changes today · {topInsights[0] ? `${formatDate(topInsights[0].currentDate)} vs recorded history (${formatDate(topInsights[0].baselineStartDate)}–${formatDate(topInsights[0].baselineEndDate)})` : 'Today compared with prior recorded history'}</p>
    {topInsights.length ? <div className="activity-insights-list">{topInsights.map((insight, index) => {
      const direction = insight.relativeChange > 0 ? 'increased' : 'decreased';
      const currentValue = insight.current.toFixed(1);
      const previousValue = insight.previous.toFixed(1);
      const record = latestRecordFor(insight.activityKey, insight.currentDate);
      const review = activityInsightReviewFor(reviews, insight);
      return <article className="activity-insight-card" key={insight.activityKey}>
        <div className="activity-insight-main"><span className="activity-insight-rank" aria-label={`Rank ${index + 1}`}>{index + 1}</span><div className="activity-insight-copy"><h2><span className="activity-insight-icon" aria-hidden="true">{activityIcon(insight.activityLabel)}</span>{insight.activityLabel}</h2><p>Today’s {insight.label.toLowerCase()} {direction} {Math.round(Math.abs(insight.relativeChange) * 100)}% vs usual</p><strong>{currentValue} vs {previousValue} {insight.unit}</strong><small>Today: {insight.currentSampleSize} {insight.currentSampleSize === 1 ? 'record' : 'records'} · baseline: {insight.baselineSampleSize} records across {insight.baselineDays} recorded days</small><small>{insight.meetsThreshold ? 'Meets the main change threshold' : 'Smaller shift · shown to complete the daily list'}</small><small>Ranked #{index + 1} by relative change</small></div>{record && <button className="activity-insight-link" type="button" onClick={() => onActivitySummary(record)}>View activity →</button>}</div>
        <div className="activity-insight-review"><p>How does this look to you?</p><div className="activity-insight-review-actions" role="group" aria-label={`Review ${insight.activityLabel}`}><button type="button" className={review?.status === 'watch' ? 'is-selected watch' : ''} aria-pressed={review?.status === 'watch'} disabled={!canReview} onClick={() => onReview(insight, 'watch')}>Keep an eye on it</button><button type="button" className={review?.status === 'normal' ? 'is-selected normal' : ''} aria-pressed={review?.status === 'normal'} disabled={!canReview} onClick={() => onReview(insight, 'normal')}>Looks normal for {petName}</button></div>{review && <small className={`activity-insight-review-meta ${review.status}`}>{review.status === 'watch' ? 'Marked for attention' : `Marked as normal for ${petName}`} by {review.reviewerName} · {formatReviewTime(review.reviewedAt)}</small>}{!canReview && !review && <small className="activity-insight-review-meta">View-only members can’t review changes.</small>}</div>
      </article>;
    })}</div> : <div className="activity-insights-empty"><span aria-hidden="true">✦</span><p>No standout change today. Metrics need recorded values on at least 3 prior days and must exceed the change thresholds.</p></div>}
    <details className="activity-insights-method"><summary>How we rank these</summary><p>For each behavior, we compare today’s average duration or food per record with its average daily value across all prior recorded days through yesterday. Days with no record are excluded, not counted as zero. A metric needs recorded values on at least 3 prior days. We show up to 3 changes: those meeting the main thresholds come first; if fewer than 3 qualify, smaller non-zero shifts fill the remaining spots. These smaller shifts may be normal variation, not an unusual change. Record count is context, not ranked by itself. Main thresholds: duration 10% and 1 minute; food 10% and 15 grams.</p></details>
    <p className="activity-insights-health-note">This highlights changes in recorded activity, not a health assessment. If you notice other concerning signs or are worried, consult your veterinarian.</p>
  </section>;
}

function TodayPage({ onStory, onMoment, onPetsNavigate, onAddPet, onActivitySummary, onOpenInsights, onCareTasks, onToggleCareTask, onSkipCareTask, careTasks, careMembers, insightReviews, currentUserId, canAct, isPrimary, petName, petAvatar, hasDemoMoments, noPetYet, observations, includedMoments, patterns, onPatterns, dayOffset, onDayOffsetChange }: { onStory: () => void; onMoment: (momentId: string) => void; onPetsNavigate: () => void; onAddPet: () => void; onActivitySummary: (moment: StoryObservation) => void; onOpenInsights: () => void; onCareTasks: () => void; onToggleCareTask: (task: CareTask) => void; onSkipCareTask: (task: CareTask) => void; careTasks: CareTask[]; careMembers: CareMember[]; insightReviews: ActivityInsightReview[]; currentUserId: string; canAct: boolean; isPrimary: boolean; petName: string; petAvatar: string; hasDemoMoments: boolean; noPetYet: boolean; observations: StoryObservation[]; includedMoments: string[] | null; patterns: TypicalPattern[]; onPatterns: (patternId?: string) => void; dayOffset: number; onDayOffsetChange: (offset: number) => void; scenarioDate?: string }) {
  const now = useCurrentTime();
  const displayName = petName.replace(/\s*[（(]test[^）)]*[）)]$/i, '');
  const visibleRecords = visibleStoryObservations(observations.filter(record => !isObservationSkippedForToday(record, careTasks)), includedMoments)
    .filter(record => new Date(record.savedAt).getTime() <= now.getTime())
    .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime());
  const todayRecords = visibleRecords.filter(record => isSameLocalDay(record.savedAt));
  const featured = todayRecords.length ? todayRecords : visibleRecords.filter(record => new Date(record.savedAt).toDateString() === new Date(visibleRecords[0]?.savedAt).toDateString());
  const clock = (value: string) => formatObservationTime(value).split('\n').at(-1);
  const rankedActivities = rankDailyActivityInsights(visibleRecords, now);
  const standoutActivity = attentionActivityInsights(rankedActivities, insightReviews)[0];
  const allChangesLookNormal = rankedActivities.length > 0 && !standoutActivity;

  return (
    <>
      <MainHeader eyebrow={noPetYet ? 'YOUR SPACE' : `A little window into ${displayName}’s day.`} title={noPetYet ? 'My space' : `Hello, ${displayName}!`} subtitle={formatPageDate()} onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} hasPet={!noPetYet} />
      {!hasDemoMoments && !visibleRecords.length ? noPetYet ? <section className="today-empty-state"><span>＋</span><h2>You haven’t added a pet yet</h2><p>Add one to get started.</p><button className="primary-button" onClick={onAddPet}>Add a pet</button></section> : <section className="today-empty-state"><span>♡</span><h2>Start {petName}’s first story</h2><p>Add a photo, video or written observation. This pet’s records will stay separate from your other pet profiles.</p><button className="primary-button" onClick={onStory}>Open {petName}’s Story →</button></section> : <>
      <DailyRhythmCard petName={petName} petAvatar={petAvatar} moments={visibleRecords} scheduledMoments={observations} onOpenActivitySummary={onActivitySummary} patterns={patterns} careTasks={careTasks} careMembers={careMembers} currentUserId={currentUserId} canAct={canAct} isPrimary={isPrimary} onToggleCareTask={onToggleCareTask} onSkipCareTask={onSkipCareTask} onOpenCareTasks={onCareTasks} onPatterns={onPatterns} dayOffset={dayOffset} onDayOffsetChange={onDayOffsetChange} />
      <section className="today-section">
        <h2>Moments you might love</h2>
        <MomentCarousel>
          {!hasDemoMoments ? featured.map(record => <button className="moment-card" key={record.id} onClick={() => onMoment(record.id)}>
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
        </MomentCarousel>
      </section>

      <section className="today-section closer-look">
        <h2>Worth a closer look</h2>
        <button className="notice-card" onClick={onOpenInsights}>
          {allChangesLookNormal ? <span className="notice-card-reviewed" aria-hidden="true">✓</span> : <img src={asset('warning.png')} alt="" />}
          <span><strong>{standoutActivity ? `${standoutActivity.activityLabel} · ${standoutActivity.key === 'duration' ? 'avg duration' : 'avg food/record'} ${standoutActivity.relativeChange > 0 ? '+' : '−'}${Math.round(Math.abs(standoutActivity.relativeChange) * 100)}% today` : allChangesLookNormal ? 'No changes need your attention today' : 'No change recorded today'}</strong><small>{standoutActivity ? `${standoutActivity.current.toFixed(1)} vs ${standoutActivity.previous.toFixed(1)} ${standoutActivity.unit} · ${standoutActivity.meetsThreshold ? 'meets main threshold' : 'small shift'} vs recorded history` : allChangesLookNormal ? `All reviewed changes look normal for ${petName}.` : 'No measured change to compare against prior recorded history.'}</small></span>
        </button>
      </section>
      </>}
    </>
  );
}

type StoryTimelineItem = { id: string; time: string; title: string; note: string; image: string; dateKey: string; timestamp: number; mediaType?: string; contexts?: { author: string; text: string }[] };

function CareTasksPage({ tasks, patterns, observations, members, currentUserId, currentUserName, petName, dayOffset, isPrimary, canAct, onBack, onPatterns, onToggleTask, onSkipTask, onSave }: { tasks: CareTask[]; patterns: TypicalPattern[]; observations: StoryObservation[]; members: CareMember[]; currentUserId: string; currentUserName: string; petName: string; dayOffset: number; isPrimary: boolean; canAct: boolean; onBack: () => void; onPatterns: () => void; onToggleTask: (task: CareTask) => void; onSkipTask: (task: CareTask) => void; onSave: (tasks: CareTask[]) => boolean }) {
  const now = useCurrentTime();
  const selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  const selectedDateLabel = dayOffset === 0 ? 'Today’s' : dayOffset === -1 ? 'Yesterday’s' : `${formatTimelineDate(selectedDate)}`;
  const incoming = tasks.filter(task => task.assignedTo === currentUserId && task.status === 'requested');
  const attentionCount = careTaskAttentionCount(tasks, currentUserId, isPrimary);
  const unreadCount = careTaskUnreadCount(tasks, currentUserId);
  const [tab, setTab] = useState<'tasks' | 'requests'>(attentionCount || unreadCount ? 'requests' : 'tasks');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [dueAt, setDueAt] = useState(() => { const date = new Date(Date.now() + 60 * 60 * 1000); date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); });
  const [assignedTo, setAssignedTo] = useState('');
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [helpTaskId, setHelpTaskId] = useState<string | null>(null);
  const [helpAssignee, setHelpAssignee] = useState('');
  const [helpNote, setHelpNote] = useState('');
  const [releaseTaskId, setReleaseTaskId] = useState<string | null>(null);
  const selectedRoutine = careTasksForDate(patterns, observations, tasks, selectedDate, now, petName);
  const visibleTasks = tasks.filter(task => !task.sourcePatternId && !task.sourceObservationId && isSameLocalDay(task.dueAt, selectedDate) && (isPrimary || task.assignedTo === currentUserId)).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const activeRoutineTasks = selectedRoutine.filter(task => task.status !== 'done' && task.status !== 'skipped');
  const completedRoutineTasks = selectedRoutine.filter(task => task.status === 'done');
  const skippedRoutineTasks = selectedRoutine.filter(task => task.status === 'skipped');
  const completedPlanTasks = [...completedRoutineTasks, ...visibleTasks.filter(task => task.status === 'done')].sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const skippedPlanTasks = [...skippedRoutineTasks, ...visibleTasks.filter(task => task.status === 'skipped')].sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const activeVisibleTasks = visibleTasks.filter(task => task.status !== 'done' && task.status !== 'skipped');
  const canEditSelectedDay = canAct && dayOffset === 0;
  const releaseTask = [...selectedRoutine, ...visibleTasks].find(task => task.id === releaseTaskId);
  const helperCandidates = members.filter(member => member.id !== currentUserId && member.access !== 'viewer' && member.role !== 'Viewer');
  const people = (id: string) => id === 'simulation' ? 'Pawsona' : members.find(member => member.id === id)?.name ?? (id === currentUserId ? currentUserName : 'Caregiver');
  const declinedAttention = isPrimary ? tasks.filter(task => task.status === 'declined') : [];
  const needsAttention = [...incoming, ...declinedAttention].filter((task, index, list) => list.findIndex(entry => entry.id === task.id) === index);
  const historyTasks = [...selectedRoutine, ...visibleTasks, ...tasks].filter((task, index, list) => list.findIndex(entry => entry.id === task.id) === index);
  const eventHistory = historyTasks.flatMap(task => (task.events ?? []).map(event => ({ task, event }))).filter(({ event }) => isPrimary || event.actorId === currentUserId || event.targetId === currentUserId).sort((left, right) => right.event.createdAt.localeCompare(left.event.createdAt));
  const saveGeneratedTask = (task: CareTask, patch: Partial<CareTask>) => {
    const nextTask = { ...task, ...patch };
    return onSave(tasks.some(entry => entry.id === task.id) ? tasks.map(entry => entry.id === task.id ? nextTask : entry) : [nextTask, ...tasks]);
  };
  const saveTransition = (task: CareTask, patch: Partial<CareTask>, event: Omit<CareTaskEvent, 'id'>) => saveGeneratedTask(task, appendCareTaskEvent({ ...task, ...patch }, event));
  const eventLabel = (type: CareTaskEventType) => ({ assigned: 'Task assigned', requested: 'Help requested', reassigned: 'Request reassigned', accepted: 'Request accepted', declined: 'Help declined', released: 'Task released', taken_over: 'Task taken over', completed: 'Completed', reopened: 'Reopened', skipped: 'Not today', restored: 'Added back', auto_completed: 'Activity recorded' }[type]);
  const eventDetail = (event: CareTaskEvent) => ({
    assigned: `${people(event.actorId)} assigned this to ${people(event.targetId ?? '')}`,
    requested: `${people(event.actorId)} asked ${people(event.targetId ?? '')} for help`,
    reassigned: `${people(event.actorId)} asked ${people(event.targetId ?? '')} instead`,
    accepted: `${people(event.actorId)} accepted the task`,
    declined: `${people(event.actorId)} couldn’t help`,
    released: `${people(event.actorId)} stepped back after accepting`,
    taken_over: `${people(event.actorId)} took over the task`,
    completed: `${people(event.actorId)} marked the task complete`,
    reopened: `${people(event.actorId)} reopened the task`,
    skipped: `${people(event.actorId)} marked the activity not today`,
    restored: `${people(event.actorId)} added the activity back`,
    auto_completed: `The activity record completed ${people(event.actorId)}’s task`,
  }[event.type]);
  useEffect(() => {
    if (tab !== 'requests') return;
    const next = markCareTaskEventsRead(tasks, currentUserId);
    if (next !== tasks) onSave(next);
  }, [tab, tasks, currentUserId]);
  function startHelpRequest(task: CareTask) {
    setHelpTaskId(task.id);
    setHelpAssignee(task.status === 'declined' ? '' : task.assignedTo);
    setHelpNote(task.requestNote ?? '');
  }
  function sendHelpRequest(event: React.FormEvent, task: CareTask) {
    event.preventDefault();
    if (!helpAssignee) return;
    const requestedAt = new Date().toISOString();
    const eventType: CareTaskEventType = task.status === 'declined' ? 'reassigned' : 'requested';
    if (saveTransition(task, { assignedTo: helpAssignee, assignedBy: currentUserId, status: 'requested', requestNote: helpNote.trim().slice(0, 240), acceptedAt: undefined }, { type: eventType, actorId: currentUserId, targetId: helpAssignee, createdAt: requestedAt })) {
      setHelpTaskId(null);
      setHelpAssignee('');
      setHelpNote('');
    }
  }
  function takeOverTask(task: CareTask) {
    const next = takeOverDeclinedCareTask(task, currentUserId);
    saveGeneratedTask(task, appendCareTaskEvent(next, { type: 'taken_over', actorId: currentUserId, targetId: task.declinedBy ?? task.assignedTo, createdAt: new Date().toISOString() }));
  }
  function confirmReleaseTask() {
    if (!releaseTask) return;
    const releasedAt = new Date().toISOString();
    const next = releaseAcceptedCareTask(releaseTask, currentUserId, releasedAt);
    if (saveGeneratedTask(releaseTask, appendCareTaskEvent(next, { type: 'released', actorId: currentUserId, targetId: releaseTask.assignedBy, createdAt: releasedAt }))) setReleaseTaskId(null);
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !dueAt || !assignedTo) return;
    const createdAt = new Date().toISOString();
    const task: CareTask = { id: `care-task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: title.trim().slice(0, 80), note: note.trim().slice(0, 240), dueAt: new Date(dueAt).toISOString(), assignedTo, assignedBy: currentUserId, status: needsAcceptance && assignedTo !== currentUserId ? 'requested' : 'open', createdAt };
    const nextTask = task.status === 'requested'
      ? appendCareTaskEvent(task, { type: 'requested', actorId: currentUserId, targetId: assignedTo, createdAt })
      : assignedTo !== currentUserId
        ? appendCareTaskEvent(task, { type: 'assigned', actorId: currentUserId, targetId: assignedTo, createdAt })
        : task;
    if (onSave([nextTask, ...tasks])) { setTitle(''); setNote(''); setShowForm(false); setNeedsAcceptance(false); }
  }
  return <section className="care-tasks-page">
    <header className="detail-header"><div className="detail-title-row"><button className="back-button" aria-label="Back to Today" onClick={onBack}>←</button><h1>Care tasks</h1></div><p className="eyebrow">SHARED CARE · {petName.toUpperCase()}</p></header>
    <p className="care-tasks-intro">A clear plan for who’s doing what—and when.</p>
    <div className="care-task-tabs" role="tablist" aria-label="Care tasks and requests"><button role="tab" aria-selected={tab === 'tasks'} onClick={() => setTab('tasks')}>{isPrimary ? 'Care plan' : 'My tasks'}</button><button role="tab" aria-selected={tab === 'requests'} onClick={() => setTab('requests')}>Requests{(unreadCount > 0 || attentionCount > 0) && <span className={unreadCount > 0 ? 'is-unread' : ''} aria-label={unreadCount > 0 ? `${unreadCount} unread` : `${attentionCount} needs attention`}>{unreadCount > 0 ? unreadCount : attentionCount}</span>}</button></div>
    {isPrimary && dayOffset === 0 && tab === 'tasks' && <button type="button" className="care-task-add" onClick={() => { setShowForm(value => !value); setTab('tasks'); }}>＋ Add one-off task or ask for help</button>}
    {showForm && isPrimary && dayOffset === 0 && <form className="care-task-form" onSubmit={submit}><h2>One-off task for {petName}</h2><label>What needs to be done?<input autoFocus maxLength={80} value={title} onChange={event => setTitle(event.target.value)} placeholder={`e.g. ${petName}’s lunch`} required /></label><label>When?<input type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} required /></label><label>Assign to<select value={assignedTo} onChange={event => setAssignedTo(event.target.value)} required><option value="">Choose a caregiver</option>{members.filter(member => member.access !== 'viewer' && member.role !== 'Viewer').map(member => <option key={member.id} value={member.id}>{member.id === currentUserId ? `${member.name} (me)` : member.name}{member.role === 'Temporary caregiver' ? ' · Temporary caregiver' : ''}</option>)}</select></label><label>Instructions (optional)<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={240} placeholder="Add any helpful details" /></label>{assignedTo !== currentUserId && <label className="care-request-toggle"><input type="checkbox" checked={needsAcceptance} onChange={event => setNeedsAcceptance(event.target.checked)} /><span><strong>Ask them to accept first</strong><small>They’ll receive a request and can accept or decline.</small></span></label>}<div className="care-task-form-actions"><button type="button" className="cancel-button" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-button" disabled={!title.trim() || !assignedTo}>{needsAcceptance && assignedTo !== currentUserId ? 'Send request' : 'Create task'}</button></div></form>}
    {tab === 'requests' ? <div className="care-request-inbox">
      <section className="care-request-section" aria-labelledby="care-needs-attention"><div className="care-request-section-heading"><h2 id="care-needs-attention">Needs attention</h2><span>{needsAttention.length}</span></div>{needsAttention.length ? <div className="care-task-list">{needsAttention.map(task => {
        const awaitingCurrentUser = task.status === 'requested' && task.assignedTo === currentUserId;
        const composingRequest = helpTaskId === task.id;
        return <article className="care-task-card care-request-attention" key={task.id}><div className="care-task-card-top"><span className={`care-task-status ${awaitingCurrentUser ? 'request' : 'declined'}`}>{awaitingCurrentUser ? 'Needs your response' : 'Caregiver stepped back'}</span><time>{new Date(task.dueAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</time></div><h2>{task.title}</h2>{(task.requestNote || task.note) && <p>{task.requestNote || task.note}</p>}<small>{awaitingCurrentUser ? `Asked by ${people(task.assignedBy)}` : `${people(task.declinedBy ?? task.assignedTo)} can’t complete this task`}</small>{composingRequest && <form className="care-help-form" onSubmit={event => sendHelpRequest(event, task)}><label>Who can help?<select autoFocus value={helpAssignee} onChange={event => setHelpAssignee(event.target.value)} required><option value="">Choose a caregiver</option>{helperCandidates.map(member => <option key={member.id} value={member.id}>{member.name}{member.role === 'Temporary caregiver' ? ' · Temporary caregiver' : ''}</option>)}</select></label><label>Message (optional)<textarea value={helpNote} onChange={event => setHelpNote(event.target.value)} maxLength={240} placeholder={`Could you take care of ${task.title.toLowerCase()} today?`} /></label><div className="care-task-form-actions"><button type="button" className="cancel-button" onClick={() => setHelpTaskId(null)}>Cancel</button><button type="submit" className="primary-button" disabled={!helpAssignee}>Send request</button></div></form>}{!composingRequest && canAct && <div className="care-task-card-actions">{awaitingCurrentUser ? <><button className="cancel-button" onClick={() => { const declinedAt = new Date().toISOString(); saveTransition(task, { status: 'declined', declinedBy: currentUserId, declinedAt }, { type: 'declined', actorId: currentUserId, targetId: task.assignedBy, createdAt: declinedAt }); }}>Can’t do it</button><button className="primary-button" onClick={() => { const acceptedAt = new Date().toISOString(); saveTransition(task, { status: 'accepted', acceptedAt }, { type: 'accepted', actorId: currentUserId, targetId: task.assignedBy, createdAt: acceptedAt }); }}>Accept</button></> : <><button className="care-task-ask" onClick={() => startHelpRequest(task)}>Ask someone else</button><button className="care-task-complete" onClick={() => takeOverTask(task)}>I’ll do it</button></>}</div>}</article>;
      })}</div> : <div className="care-tasks-empty compact"><span>✓</span><strong>Nothing needs your attention</strong><p>New requests and tasks that need reassignment will appear here.</p></div>}</section>
      <section className="care-request-section" aria-labelledby="care-request-history"><div className="care-request-section-heading"><h2 id="care-request-history">History</h2><span>{eventHistory.length}</span></div>{eventHistory.length ? <div className="care-request-history">{eventHistory.map(({ task, event }) => <article className={`care-request-event ${event.targetId === currentUserId && !(event.readBy ?? []).includes(currentUserId) ? 'is-unread' : ''}`} key={event.id}><span className={`care-request-event-dot ${event.type}`} aria-hidden="true"/><span><strong>{eventLabel(event.type)} · {task.title}</strong><small>{eventDetail(event)}</small></span><time>{new Date(event.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></article>)}</div> : <div className="care-tasks-empty compact"><span>✉</span><strong>No request history yet</strong><p>Requests and responsibility changes will be recorded here.</p></div>}</section>
    </div> : <div className="care-task-list">
      {selectedRoutine.length > 0 && <section className="care-routine-section"><div className="care-routine-heading"><div><h2>{selectedDateLabel} activities</h2></div></div>{activeRoutineTasks.map(task => {
        const canComplete = canEditSelectedDay && !task.autoCompleted && (task.status === 'done' ? isPrimary || task.completedBy === currentUserId : !task.assignedTo || task.assignedTo === currentUserId);
        const canAskForHelp = isPrimary && canEditSelectedDay && !!task.sourceObservationId && helperCandidates.length > 0 && ['open', 'declined'].includes(task.status);
        const composingRequest = helpTaskId === task.id;
        const time = task.sourcePatternId ? task.note.replace(/^Usual window /, '') : new Date(task.dueAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const statusLabel = task.status === 'done' ? 'Completed' : task.status === 'skipped' ? 'Not today' : task.status === 'requested' ? 'Awaiting response' : task.status === 'accepted' ? 'Assigned' : task.status === 'declined' ? 'Help declined' : task.sourceObservationId ? 'Scheduled' : 'Routine';
        const detail = task.status === 'skipped' ? 'Not today · hidden from Story' : task.autoCompleted ? `Completed by ${task.completedByName ?? people(task.completedBy ?? 'simulation')} when the activity was recorded` : task.status === 'done' ? `Completed by ${task.completedByName ?? people(task.completedBy ?? '')} · ${task.completedAt ? new Date(task.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}` : task.status === 'requested' ? `Waiting for ${people(task.assignedTo)} to respond` : task.status === 'accepted' ? `${people(task.assignedTo)} is handling this activity` : task.status === 'declined' ? `${people(task.assignedTo)} couldn’t help · ask someone else` : task.sourceObservationId ? 'Scheduled simulated activity' : 'Shared routine · check off when done';
        return <article className="care-task-card" key={task.id}><div className="care-task-card-top"><span className={`care-task-status ${task.status}`}>{statusLabel}</span><time>{time}</time></div><h2>{task.title}</h2><small>{detail}</small>{composingRequest && <form className="care-help-form" onSubmit={event => sendHelpRequest(event, task)}><label>Who can help?<select autoFocus value={helpAssignee} onChange={event => setHelpAssignee(event.target.value)} required><option value="">Choose a caregiver</option>{helperCandidates.map(member => <option key={member.id} value={member.id}>{member.name}{member.role === 'Temporary caregiver' ? ' · Temporary caregiver' : ''}</option>)}</select></label><label>Message (optional)<textarea value={helpNote} onChange={event => setHelpNote(event.target.value)} maxLength={240} placeholder={`Could you take care of ${task.title.toLowerCase()} today?`} /></label><div className="care-task-form-actions"><button type="button" className="cancel-button" onClick={() => setHelpTaskId(null)}>Cancel</button><button type="submit" className="primary-button" disabled={!helpAssignee}>Send request</button></div></form>}{!composingRequest && <div className="care-task-action-stack">{canEditSelectedDay && task.sourceObservationId && task.status === 'open' && <button className="care-task-not-today" onClick={() => onSkipTask(task)}>Not today</button>}<div className="care-task-card-actions">{canAskForHelp && <button className="care-task-ask" onClick={() => startHelpRequest(task)}>Ask a caregiver</button>}{isPrimary && canEditSelectedDay && task.status === 'declined' && <button className="care-task-complete" onClick={() => takeOverTask(task)}>I’ll do it</button>}{canEditSelectedDay && task.status === 'accepted' && task.assignedTo === currentUserId && <button className="cancel-button" onClick={() => setReleaseTaskId(task.id)}>Can’t do it</button>}{canComplete && ['open', 'accepted'].includes(task.status) && <button className="care-task-complete" onClick={() => onToggleTask(task)}>Mark as done ✓</button>}</div></div>}</article>;
      })}{completedPlanTasks.length > 0 && <details className="care-task-archive" open={dayOffset !== 0}><summary><span>Completed</span><em>{completedPlanTasks.length}</em></summary><div className="care-task-archive-list">{completedPlanTasks.map(task => <article className="care-task-card is-complete" key={task.id}><div className="care-task-card-top"><span className="care-task-status done">Completed</span><time>{new Date(task.dueAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div><h2>{task.title}</h2><small>Completed by {task.completedByName ?? people(task.completedBy ?? '')}{task.completedAt ? ` · ${new Date(task.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</small></article>)}</div></details>}{skippedPlanTasks.length > 0 && <details className="care-task-archive" open={dayOffset !== 0}><summary><span>Not today</span><em>{skippedPlanTasks.length}</em></summary><div className="care-task-archive-list">{skippedPlanTasks.map(task => <article className="care-task-card is-skipped" key={task.id}><div className="care-task-card-top"><span className="care-task-status skipped">Not today</span><time>{new Date(task.dueAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div><h2>{task.title}</h2><small>Hidden from Story for this day</small>{canEditSelectedDay && <button className="care-task-restore" onClick={() => onSkipTask(task)}>Add back to today</button>}</article>)}</div></details>}</section>}
      {(selectedRoutine.length ? activeVisibleTasks : visibleTasks).map(task => <article className={`care-task-card ${task.status === 'done' ? 'is-complete' : ''}`} key={task.id}><div className="care-task-card-top"><span className={`care-task-status ${task.status}`}>{task.status === 'done' ? 'Completed' : task.status === 'requested' ? 'Awaiting response' : task.status === 'declined' ? 'Declined' : task.status === 'accepted' ? 'Accepted' : 'To do'}</span><time>{new Date(task.dueAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></div><h2>{task.title}</h2>{task.note && <p>{task.note}</p>}<small>{task.status === 'done' ? `Completed by ${people(task.completedBy ?? '')} · ${task.completedAt ? new Date(task.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}` : `Assigned to ${people(task.assignedTo)} · from ${people(task.assignedBy)}`}</small>{canEditSelectedDay && task.assignedTo === currentUserId && ['open', 'accepted'].includes(task.status) && <div className="care-task-card-actions">{task.status === 'accepted' && <button className="cancel-button" onClick={() => setReleaseTaskId(task.id)}>Can’t do it</button>}<button className="care-task-complete" onClick={() => { const completedAt = new Date().toISOString(); saveTransition(task, { status: 'done', completedBy: currentUserId, completedAt }, { type: 'completed', actorId: currentUserId, targetId: task.assignedBy === currentUserId ? undefined : task.assignedBy, createdAt: completedAt }); }}>Mark as done ✓</button></div>}</article>)}
      {!selectedRoutine.length && !visibleTasks.length && <div className="care-tasks-empty"><span>✓</span><strong>No activities scheduled for this day</strong><p>{isPrimary ? 'Simulated activities—or confirmed Patterns when there is no simulation—appear here for the selected day.' : 'Care tasks assigned to you for this day will appear here.'}</p>{isPrimary && <button className="profile-link" onClick={onPatterns}>Review Patterns →</button>}</div>}
    </div>}
    {releaseTask && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setReleaseTaskId(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="release-care-task-title" onClick={event => event.stopPropagation()}><h2 id="release-care-task-title">Can’t complete this task?</h2><p>The Primary caregiver will see that you can’t complete “{releaseTask.title}” and can take over or ask someone else.</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setReleaseTaskId(null)}>Keep task</button><button className="danger-button" onClick={confirmReleaseTask}>Can’t do it</button></div></section></div>}
  </section>;
}

function TimelineContextTicker({ contexts }: { contexts: { author: string; text: string }[] }) {
  const latest = contexts[0];
  return <div className="timeline-card-contexts" aria-label="Latest owner context"><span className="timeline-context-line"><strong>{latest.author}:</strong> {latest.text}</span></div>;
}

function StoryTimelineRow({ item, showTime = true, canEdit, menuOpen, onMenuToggle, onView, onEdit, onDelete }: { item: StoryTimelineItem; showTime?: boolean; canEdit: boolean; menuOpen: boolean; onMenuToggle: () => void; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const [date, time] = item.time.split('\n');
  return <div className="timeline-row" data-story-date={item.dateKey}>
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

function StoryCalendar({ now, selectedDate, daysWithRecords, onSelect }: { now: Date; selectedDate: Date | null; daysWithRecords: Set<string>; onSelect: (date: Date) => void }) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  useEffect(() => {
    if (!selectedDate) setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }, [now.getFullYear(), now.getMonth(), selectedDate]);
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1 - mondayOffset + index));
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthIsCurrent = visibleMonth.getFullYear() === now.getFullYear() && visibleMonth.getMonth() === now.getMonth();
  const selectedKey = localDayKey(selectedDate ?? now);

  return <section className="story-calendar-section">
    <div className="section-heading"><div><h2>Story calendar</h2><p>Choose a day to revisit its moments.</p></div></div>
    <div className="story-calendar-card">
      <div className="story-calendar-heading">
        <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>‹</button>
        <strong>{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(visibleMonth)}</strong>
        <button type="button" aria-label="Next month" disabled={monthIsCurrent} onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>›</button>
      </div>
      <div className="story-calendar-grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span className="story-calendar-weekday" key={`${day}-${index}`}>{day}</span>)}
        {days.map((day, index) => {
          const key = localDayKey(day);
          const hasRecords = daysWithRecords.has(key);
          const future = day.getTime() > todayStart.getTime();
          const inMonth = day.getMonth() === visibleMonth.getMonth();
          return <button key={`${key}-${index}`} type="button" disabled={future} aria-pressed={key === selectedKey} aria-label={`${formatPageDate(day)}${hasRecords ? ', has records' : ''}`} className={`${inMonth ? '' : 'outside-month'} ${key === selectedKey ? 'selected' : ''} ${key === localDayKey(now) ? 'today' : ''} ${hasRecords ? 'has-records' : ''}`} onClick={() => { setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1)); onSelect(day); }}>
            {day.getDate()}
          </button>;
        })}
      </div>
      <div className="story-calendar-legend"><span />Days with records</div>
    </div>
  </section>;
}

function preferredScrollBehavior(): ScrollBehavior {
  return document.querySelector('.phone.reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function StoryPage({ onMoment, onEditStory, onEditMoment, onDeleteMoment, onPetsNavigate, onAddPet, petName, petAvatar, ownerName, accounts, contexts, observations, careTasks, includedMoments, hasDemoMoments, noPetYet, canEdit }: { onMoment: (momentId: string) => void; onEditStory: (dateKey?: string) => void; onEditMoment: (item: StoryTimelineItem) => void; onDeleteMoment: (momentId: string) => string; onPetsNavigate: () => void; onAddPet: () => void; petName: string; petAvatar: string; ownerName: string; accounts: PrototypeAccount[]; contexts: OwnerContext[]; observations: StoryObservation[]; careTasks: CareTask[]; includedMoments: string[] | null; hasDemoMoments: boolean; noPetYet: boolean; canEdit: boolean }) {
  const now = useCurrentTime();
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StoryTimelineItem | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const selectedDay = selectedDate ?? now;
  const selectedKey = localDayKey(selectedDay);
  const todayKey = localDayKey(now);
  const [summaryDateKey, setSummaryDateKey] = useState(todayKey);
  const [summaryCompact, setSummaryCompact] = useState(false);
  const getTimelineContexts = (momentId: string) => contexts.filter((entry) => entry.momentId === momentId).map((entry) => ({ author: (entry.authorId && accounts.find((account) => account.id === entry.authorId)?.name) || entry.authorName || ownerName, text: entry.note }));
  const visibleObservations = visibleStoryObservations(observations.filter(observation => !isObservationSkippedForToday(observation, careTasks)), includedMoments)
    .filter((observation) => new Date(observation.savedAt).getTime() <= now.getTime());
  const hasGeneratedSimulation = observations.some((observation) => observation.synthetic === true);
  const moments = (hasDemoMoments && !hasGeneratedSimulation ? baseMomentDefinitions : []).map((moment) => {
    const [clock, period] = moment.time.split(' ');
    const [hour, minute] = clock.split(':').map(Number);
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    date.setHours((hour % 12) + (period === 'PM' ? 12 : 0), minute, 0, 0);
    return { id: moment.id, time: formatObservationTime(date.toISOString()), title: moment.title, note: moment.summary, image: asset(moment.image), dateKey: localDayKey(date), timestamp: date.getTime(), contexts: getTimelineContexts(moment.id) };
  }).filter((moment) => !includedMoments || includedMoments.includes(moment.id));
  const timelineItems: StoryTimelineItem[] = [
    ...visibleObservations.map((observation) => { const date = new Date(observation.savedAt); return { id: observation.id, time: formatObservationTime(observation.savedAt), title: observation.title, note: observation.note, image: observationHasPrimaryMedia(observation) ? observation.image : '', mediaType: observation.mediaType, contexts: getTimelineContexts(observation.id), dateKey: localDayKey(date), timestamp: date.getTime() }; }),
    ...moments,
  ].sort((left, right) => right.timestamp - left.timestamp);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  const recentGroups = new Map<string, StoryTimelineItem[]>();
  const earlierItems: StoryTimelineItem[] = [];
  timelineItems.forEach((item) => {
    if (item.timestamp < weekStart) earlierItems.push(item);
    else recentGroups.set(item.dateKey, [...(recentGroups.get(item.dateKey) ?? []), item]);
  });
  const timelineGroups = [
    ...Array.from(recentGroups, ([dateKey, items]) => ({ id: dateKey, title: dateKey === todayKey ? 'Today’s timeline' : `${formatTimelineDate(new Date(`${dateKey}T12:00:00`))} timeline`, items })),
    ...(earlierItems.length ? [{ id: 'earlier', title: 'Earlier timeline', items: earlierItems }] : []),
  ];
  const timelineGroupKey = timelineGroups.map((group) => group.id).join('|');
  useEffect(() => {
    if (selectedDate) return;
    const scroller = document.querySelector('.screen-scroll');
    const summary = document.getElementById('story-summary-card');
    if (!scroller || !summary) return;
    let frame = 0;
    const updateSummaryDate = () => {
      setSummaryCompact((current) => current === (scroller.scrollTop > 8) ? current : scroller.scrollTop > 8);
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const threshold = summary.getBoundingClientRect().bottom + 20;
        let nextDateKey = todayKey;
        document.querySelectorAll<HTMLElement>('[data-story-date]').forEach((element) => {
          if (element.getBoundingClientRect().top <= threshold) nextDateKey = element.dataset.storyDate ?? todayKey;
        });
        setSummaryDateKey((current) => current === nextDateKey ? current : nextDateKey);
      });
    };
    scroller.addEventListener('scroll', updateSummaryDate, { passive: true });
    window.addEventListener('resize', updateSummaryDate);
    updateSummaryDate();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', updateSummaryDate);
      window.removeEventListener('resize', updateSummaryDate);
    };
  }, [todayKey, timelineGroupKey, selectedDate]);
  const summaryCount = timelineItems.filter((item) => item.dateKey === (selectedDate ? selectedKey : summaryDateKey)).length;
  const displayedGroups = selectedDate ? [{ id: selectedKey, title: `${formatTimelineDate(selectedDay)} timeline`, items: timelineItems.filter(item => item.dateKey === selectedKey) }].filter(group => group.items.length) : timelineGroups;
  const daysWithRecords = new Set(visibleObservations.map((observation) => localDayKey(new Date(observation.savedAt))));
  if (hasDemoMoments) daysWithRecords.add(todayKey);

  function selectCalendarDate(date: Date) {
    setSelectedDate(date);
    setCalendarOpen(false);
    const key = localDayKey(date);
    setSummaryDateKey(key);
    document.querySelector<HTMLElement>('.screen-scroll')?.scrollTo({ top: 0, behavior: 'auto' });
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const nextError = onDeleteMoment(pendingDelete.id);
    setDeleteError(nextError);
    if (!nextError) setPendingDelete(null);
  }
  return (
    <>
      <MainHeader eyebrow={noPetYet ? 'DAILY STORY' : `${petName.toUpperCase()} · DAILY STORY`} title="Daily moments" subtitle={selectedDate ? formatPageDate(selectedDay) : 'All recorded days'} onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} hasPet={!noPetYet} className="story-main-header" />
      {noPetYet ? <section className="today-empty-state pets-empty-state story-empty-state"><span>＋</span><h2>You haven’t added a pet yet</h2><p>Add one to get started.</p><button className="primary-button" onClick={onAddPet}>Add a pet</button></section> : <>
      <div id="story-summary-card" className={`story-summary-wrap ${summaryCompact ? 'is-compact' : ''} ${calendarOpen ? 'calendar-open' : ''}`}>
        <div className="story-summary"><img src={asset('story-heart.png')} alt="" /><strong>{summaryCount} {summaryCount === 1 ? 'moment' : 'moments'} {summaryDateKey === todayKey ? 'today' : 'on this day'}</strong><button className="story-calendar-toggle" type="button" aria-label={calendarOpen ? 'Close story calendar' : 'Open story calendar'} aria-expanded={calendarOpen} onClick={() => setCalendarOpen((open) => !open)}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M7.5 3v4M16.5 3v4M4 9.5h16M7.5 13h2M12 13h2M7.5 16.5h2M12 16.5h2"/></svg></button></div>
        {calendarOpen && <StoryCalendar now={now} selectedDate={selectedDate} daysWithRecords={daysWithRecords} onSelect={selectCalendarDate} />}
      </div>
      <button className="profile-link" onClick={() => { setSelectedDate(selectedDate ? null : new Date()); setSummaryDateKey(todayKey); }}>{selectedDate ? 'View all recorded days' : 'Show today only'}</button>
      <section className="timeline-section">
        {displayedGroups.length ? displayedGroups.map((group, groupIndex) => <section className={`timeline-day-group ${selectedDate && localDayKey(selectedDate) === group.id && summaryDateKey === group.id ? 'calendar-target' : ''}`} id={`story-day-${group.id}`} key={group.id}>
          <div className="section-heading" data-story-date={group.id === 'earlier' ? undefined : group.id}><h2>{group.title}</h2>{canEdit && groupIndex === 0 && <button className="text-link" onClick={() => onEditStory(selectedDate ? selectedKey : undefined)}>Edit story ✎</button>}</div>
          <div className="timeline-list">{group.items.map((item) => <StoryTimelineRow key={item.id} item={item} canEdit={canEdit} menuOpen={openMenuId === item.id} onMenuToggle={() => setOpenMenuId(openMenuId === item.id ? null : item.id)} onView={() => { setOpenMenuId(null); onMoment(item.id); }} onEdit={() => { setOpenMenuId(null); onEditMoment(item); }} onDelete={() => { setOpenMenuId(null); setDeleteError(''); setPendingDelete(item); }} />)}</div>
      </section>) : <><div className="section-heading"><h2>{selectedKey === todayKey ? 'Today’s timeline' : `${formatTimelineDate(selectedDay)} timeline`}</h2>{canEdit && <button className="text-link" onClick={() => onEditStory(selectedDate ? selectedKey : undefined)}>Edit story ✎</button>}</div><p className="timeline-empty-state">{selectedKey === todayKey ? 'No moments today yet' : 'No moments recorded on this day'}</p></>}
      </section>
      {((selectedDate && selectedKey !== todayKey) || summaryDateKey !== todayKey) && <button className="story-back-top" type="button" aria-label="Back to today" title="Back to today" onClick={() => { setSelectedDate(new Date()); setSummaryDateKey(todayKey); document.querySelector<HTMLElement>('.screen-scroll')?.scrollTo({ top: 0, behavior: preferredScrollBehavior() }); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg></button>}
      {openMenuId && <button className="timeline-menu-dismiss" aria-label="Close moment actions" onClick={() => setOpenMenuId(null)} />}
      {pendingDelete && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-story-moment-title" onClick={(event) => event.stopPropagation()}><h2 id="delete-story-moment-title">Delete “{pendingDelete.title}”?</h2><p>{observations.some((entry) => entry.id === pendingDelete.id) ? 'This permanently removes this moment and its linked owner context from this pet’s Story.' : 'This removes this moment from the current Story. You can add it again later from Edit story.'}</p>{deleteError && <p className="inline-save-error" role="alert">{deleteError}</p>}<div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-button" onClick={confirmDelete}>Delete</button></div></section></div>}
      </>}
    </>
  );
}

type StoryEditRow = { id: string; image: string; mediaType?: string; title: string; meta: string; note?: string; context?: string };

function StoryEditPage({ observations, includedMoments, petName, hasDemoMoments, dateKey, onBack, onSave, onEdit, onDelete }: { observations: StoryObservation[]; includedMoments: string[] | null; petName: string; hasDemoMoments: boolean; dateKey?: string | null; onBack: () => void; onSave: (ids: string[]) => void; onEdit: (row: StoryEditRow) => void; onDelete: (id: string) => void }) {
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
  const displayedRows = dateKey
    ? rows.filter((row) => {
        if (row.id === 'breakfast' || row.id === 'window' || row.id === 'toy') return dateKey === localDayKey(new Date());
        const observation = observations.find((entry) => entry.id === row.id);
        return observation ? localDayKey(new Date(observation.savedAt)) === dateKey : false;
      })
    : rows;
  const clearLongPress = () => { if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current); longPressTimer.current = null; };
  const beginLongPress = (id: string) => { clearLongPress(); longPressTimer.current = window.setTimeout(() => { suppressClick.current = true; setOpenMenuId(id); }, 520); };
  const removeRow = (id: string) => { setRemovedIds((current) => [...current, id]); setIncluded((current) => current.filter((entry) => entry !== id)); setOpenMenuId(null); onDelete(id); };
  return <section className="story-edit-page">
    <header className="story-edit-header"><button className="back-button" aria-label="Go back" onClick={onBack}>←</button><h1>Edit story</h1></header>
    <section className="story-visibility-card"><strong>Story visibility</strong><p>Keep selected moments in {petName}'s Story.<br/>Hidden moments remain in your records.</p><small>Sharing uses only moments you choose.</small></section>
    <div className="story-edit-rows">{displayedRows.filter((row) => !removedIds.includes(row.id)).map((row) => <div className="story-edit-item" key={row.id} onPointerDown={() => beginLongPress(row.id)} onPointerUp={clearLongPress} onPointerLeave={clearLongPress} onPointerCancel={clearLongPress} onContextMenu={(event) => { event.preventDefault(); clearLongPress(); suppressClick.current = true; setOpenMenuId(row.id); }}><button type="button" className={`story-edit-row ${included.includes(row.id) ? 'included' : ''} ${row.image ? '' : 'no-media'}`} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setOpenMenuId(null); setIncluded((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]); }}>{row.image && <StoryMediaView src={row.image} type={row.mediaType} alt="" />}<span className="story-edit-row-copy"><strong>{row.title}</strong><small>{row.meta}</small></span><span className="story-edit-check" aria-hidden="true">{included.includes(row.id) ? '✓' : ''}</span></button>{openMenuId === row.id && <div className="story-row-action-bubble" role="menu"><button role="menuitem" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); clearLongPress(); setOpenMenuId(null); suppressClick.current = false; onEdit(row); }}>Edit</button><button role="menuitem" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); clearLongPress(); removeRow(row.id); suppressClick.current = false; }}>Delete</button></div>}</div>)}</div>
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

function StoryAddPage({ step, onBack, onCancel, selectedMoments, setSelectedMoments, uploadedMedia, setUploadedMedia, title, setTitle, momentAt, setMomentAt, relatedPhotos, setRelatedPhotos, note, setNote, context, setContext, privateRecord, setPrivateRecord, petName, ownerName, hasDemoMoments, saveError, savedObservation, onSave, onEdit }: {
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
  savedObservation?: StoryObservation | null;
  petName: string;
  ownerName: string;
  hasDemoMoments: boolean;
  saveError: string;
  onSave: () => void;
  onEdit: () => void;
}) {
  const [uploadError, setUploadError] = useState('');
  const quickActivities = [
    { label: 'Meal', icon: '🥣', text: `${petName} had a meal.` },
    { label: 'Water', icon: '💧', text: `${petName} drank water.` },
    { label: 'Walk', icon: '🐾', text: `${petName} went for a walk.` },
    { label: 'Play', icon: '🎾', text: `${petName} played.` },
    { label: 'Rest', icon: '💤', text: `${petName} rested.` },
    { label: 'Toilet', icon: '🚽', text: `${petName} had a toilet break.` },
    // The comb emoji is not available in many system emoji fonts and renders as a missing-glyph box.
    { label: 'Grooming', icon: '✂️', text: `${petName} had a grooming session.` },
    { label: 'Training', icon: '🏅', text: `${petName} had a training session.` },
  ];
  const selectedActivity = selectedMoments.length === 0 && !uploadedMedia
    ? quickActivities.find((activity) => title === activity.label) : undefined;
  function startWrittenMoment() {
    setUploadedMedia(null); setSelectedMoments([]); setTitle('');
    setRelatedPhotos([]); setNote(''); onEdit();
  }
  const latest = savedObservation ?? null;
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
    const maxBytes = file.type.startsWith('video/') ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(file.type.startsWith('video/') ? 'Choose a video up to 5 MB. Trim it or export at 720p before uploading.' : 'Choose an image up to 2 MB.');
      return;
    }

    try {
      const url = await mediaDataUrl(file);
      setUploadedMedia({ name: file.name, type: file.type, url });
      setSelectedMoments(['uploaded']);
      if (!note.trim()) setNote(defaultObservationForSource('uploaded', petName));
      if (!title.trim()) setTitle(`A moment with ${petName}`);
      setUploadError('');
    } catch {
      setUploadError('This file could not be read. Please try another one.');
    }
  }

  if (step === 'moments') return <div className="add-flow-page">
    {header('Add a moment', `A LITTLE MOMENT WITH ${petName.toUpperCase()}`)}
    <div className="quick-moment-intro"><strong>What has {petName} been up to?</strong><p>Pick an activity and save. No photo or typing needed.</p></div>
    <section className="quick-moment-content">
      <div className="quick-activity-grid" aria-label="Common pet activities">{quickActivities.map((activity) => <button type="button" key={activity.label} aria-pressed={selectedActivity?.label === activity.label} className={`quick-activity ${selectedActivity?.label === activity.label ? 'selected' : ''}`} onClick={() => { setUploadedMedia(null); setSelectedMoments([]); setRelatedPhotos([]); setTitle(activity.label); setNote(activity.text); }}><span aria-hidden="true">{activity.icon}</span><strong>{activity.label}</strong>{selectedActivity?.label === activity.label && <span className="quick-activity-check" aria-hidden="true">✓</span>}</button>)}</div>
      <button type="button" className="quick-custom-moment" onClick={startWrittenMoment}>＋ Something else</button>
      {selectedActivity && <div className="quick-moment-summary"><strong>Ready to save</strong><p aria-live="polite">{note}</p><MomentDateTimePicker value={momentAt} onChange={setMomentAt} /><button type="button" className="quick-details-button" onClick={onEdit}>＋ Add details or photo/video</button><label className="quick-private-choice"><input type="checkbox" checked={privateRecord} onChange={(event) => setPrivateRecord(event.target.checked)} />Keep as a private record</label><small>{privateRecord ? 'Only you can see this moment.' : `Visible in ${petName}’s Story to your care group.`}</small></div>}
    </section>
    {saveError && <p className="inline-save-error" role="alert">{saveError}</p>}
    <div className="sticky-action add-moment-sticky-action"><button className="primary-button full" onClick={onSave} disabled={!selectedActivity || !note.trim()}>{privateRecord ? 'Save private moment' : 'Save moment'}</button></div>
  </div>;

  if (step === 'compose') return <div className="add-flow-page">
    {header('Moment details', 'ADD ONLY WHAT MATTERS')}
    {hasVisual || selectedNotes.length > 0 ? <><div className="compose-section-label"><strong>Selected moment</strong></div>{hasVisual ? <div className="selected-moments-strip">{selected.map((moment) => <img key={moment.id} src={asset(moment.image)} alt={moment.title} />)}{uploadedSelected && uploadedMedia && <StoryMediaView src={uploadedMedia.url} type={uploadedMedia.type} alt={uploadedMedia.name} />}</div> : <div className="selected-note-strip">{selectedNotes.map((entry) => <div key={entry.id}><span>{entry.text}</span><small>{entry.label}</small></div>)}</div>}</> : <><div className="written-observation-mode"><strong>Written observation</strong></div><div className="written-observation-note"><strong>A note is enough</strong><span>You can describe a moment without a photo or camera clip.</span></div></>}
    <label className="moment-media-button">＋ {uploadedSelected ? 'Replace photo/video' : 'Add photo/video'}<input type="file" accept="image/*,video/*" onChange={(event) => { uploadMedia(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
    {isOwnerCreatedMoment && <MomentDateTimePicker value={momentAt} onChange={setMomentAt} />}
    <label className="observation-title-field"><strong>Title</strong><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a title for this moment" maxLength={70} /></label>
    <section className="observation-writing-card"><strong>What happened with {petName}?</strong><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe what you noticed…" />{relatedPhotos.length > 0 && <div className="related-photos-strip">{relatedPhotos.map((media, index) => <div className={media.type.startsWith('audio/') ? 'audio-attachment-thumb' : ''} key={`${media.name}-${index}`}><StoryMediaView src={media.url} type={media.type} alt={media.name} controls={media.type.startsWith('audio/')} /><button type="button" aria-label={`Remove attachment ${index + 1}`} onClick={() => setRelatedPhotos(relatedPhotos.filter((_, mediaIndex) => mediaIndex !== index))}>×</button></div>)}</div>}{uploadError && <p className="upload-error" role="alert">{uploadError}</p>}<div className="observation-writing-tools">{<label aria-label="Add photos"><input type="file" accept="image/*" multiple onChange={(event) => { addRelatedPhotos(event.target.files); event.currentTarget.value = ''; }} /><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="m5 17 5-5 3 3 2-2 5 5" /></svg></label>}<label aria-label="Add a voice note"><input type="file" accept="audio/*" capture onChange={(event) => { addRelatedPhotos(event.target.files); event.currentTarget.value = ''; }} /><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" /></svg></label><span className="observation-attachment-hint">Photos and voice notes are optional.</span></div></section>
    <section className="add-context-choices"><strong>Add context</strong><div>{['Visitors at home', 'Routine changed', 'Not sure yet'].map((item) => <button key={item} className={context === item ? 'active' : ''} onClick={() => setContext(context === item ? '' : item)}>{item}</button>)}</div></section>
    <label className="quick-private-choice compose-private-choice"><input type="checkbox" checked={privateRecord} onChange={(event) => setPrivateRecord(event.target.checked)} />Keep as a private record</label>
    <p className="compose-visibility">{privateRecord ? 'Only you can see this moment.' : `Visible in ${petName}’s Story to your care group.`}</p>
    {saveError && <p className="inline-save-error" role="alert">{saveError}</p>}
    <div className="sticky-action"><button className="primary-button full" onClick={onSave} disabled={!note.trim()}>{privateRecord ? 'Save private moment' : 'Save moment'}</button></div>
  </div>;

  if (step === 'preview') return <div className="add-flow-page">
    {header('Preview', 'CHECK BEFORE SAVING')}
    <article className={`observation-preview-card ${!hasVisual ? 'note-observation-preview' : ''}`}>{hasVisual ? <StoryMediaView src={image} type={mediaType} alt={petName} controls={mediaType?.startsWith('video/')} /> : <div className="observation-note-visual"><strong>A note from {ownerName}</strong><p>{note || 'A moment with ' + petName + '.'}</p></div>}{relatedPhotos.length > 0 && <div className="preview-related-photos">{relatedPhotos.map((media, index) => <StoryMediaView key={`${media.name}-${index}`} src={media.url} type={media.type} alt={`Related attachment ${index + 1}`} controls={media.type.startsWith('audio/')} />)}</div>}<div className="observation-preview-copy"><small>{petName} · {formatRelativeDate(new Date(momentAt).toISOString())}</small><strong>{observationTitle}</strong><p>{note || 'A moment with ' + petName + '.'}</p>{selectedNotes.length > 0 && <div className="preview-source-notes"><strong>Saved note sources</strong>{selectedNotes.map((entry) => <span key={entry.id}>{entry.text}<small>{entry.label}</small></span>)}</div>}<div>{selectedMoments.length} selected {selectedMoments.length === 1 ? 'source' : 'sources'} · {hasVisual ? 'owner observation' : `Written observation · ${ownerName}`}</div><span>Owner-provided context{context ? ` · ${context}` : ''}</span></div></article>
    <section className="observation-destination"><strong>Where this goes</strong><button className={!privateRecord ? 'selected' : ''} onClick={() => setPrivateRecord(false)}><span className="destination-radio">{!privateRecord && <i />}</span>Add to {petName}'s Story</button><button className={privateRecord ? 'selected' : ''} onClick={() => setPrivateRecord(true)}><span className="destination-radio">{privateRecord && <i />}</span>Keep as a private record</button><small>{privateRecord ? 'Only you can see this record until you choose to share it.' : 'You choose which sources and words are saved.'}</small></section>
    {saveError && <p className="inline-save-error" role="alert">{saveError}</p>}
    <div className="sticky-action"><button className="primary-button full" onClick={onSave}>{privateRecord ? 'Save private note' : 'Save observation'}</button></div>
  </div>;

  return <div className="add-flow-page">
    {header(privateRecord ? 'Saved privately' : 'Moment saved', privateRecord ? 'SAVED TO PRIVATE RECORDS' : 'ADDED TO ' + petName.toUpperCase() + '’S STORY')}
    <section className="observation-saved-banner"><strong>✓ &nbsp;{privateRecord ? 'Your private note is saved' : 'Your observation is saved'}</strong><span>{privateRecord ? `Visible only to you · Added by ${ownerName}` : `Added by ${ownerName}`} · {latest ? formatRelativeDate(latest.savedAt) : 'Today'}</span></section>
    <article className="observation-preview-card saved-observation-card">{latestHasVisual ? <StoryMediaView src={image} type={mediaType} alt={petName} controls={mediaType?.startsWith('video/')} /> : <div className="observation-note-visual"><strong>A note from {ownerName}</strong><p>{observationText || 'A moment with ' + petName + '.'}</p></div>}{latest?.relatedPhotos && latest.relatedPhotos.length > 0 && <div className="preview-related-photos">{latest.relatedPhotos.map((media, index) => <StoryMediaView key={`${media.name}-${index}`} src={media.url} type={media.type} alt={`Related attachment ${index + 1}`} controls={media.type.startsWith('audio/')} />)}</div>}<div className="observation-preview-copy"><strong>{observationTitle}</strong><p>{observationText || 'A moment with ' + petName + '.'}</p>{savedSourceNotes.length > 0 && <div className="preview-source-notes"><strong>Saved note sources</strong>{savedSourceNotes.map((entry) => <span key={entry.id}>{entry.text}<small>{entry.label}</small></span>)}</div>}<div>{(latest?.momentCount ?? selectedMoments.length) === 0 ? `Written observation · ${ownerName}` : `${latest?.momentCount ?? selectedMoments.length} selected ${(latest?.momentCount ?? selectedMoments.length) === 1 ? 'source' : 'sources'} · owner observation`}</div><span>{privateRecord ? 'Private record · not in ' + petName + '’s Story' : `Owner-provided context${latest?.context ? ` · ${latest.context}` : ''}`}</span></div></article>
    <div className="saved-observation-links"><button className="text-link" onClick={onEdit}>Edit observation</button></div>
    <div className="sticky-action"><button className="primary-button full" onClick={onCancel}>{privateRecord ? 'Return to Today' : 'View in Story'}</button></div>
  </div>;
}

function MomentContextCard({ context, accounts, careMembers, ownerName, ownerAvatar, currentAccountId, groupOwnerAccountId, canContribute, canInteract, onEditContext, onDeleteContext, onToggleLike, onAddComment, onEditOwnComment, onDeleteOwnComment }: { context: OwnerContext; accounts: PrototypeAccount[]; careMembers: CareMember[]; ownerName: string; ownerAvatar: string; currentAccountId: string; groupOwnerAccountId?: string; canContribute: boolean; canInteract: boolean; onEditContext: (context: OwnerContext) => void; onDeleteContext: () => void; onToggleLike: (id: string) => void; onAddComment: (id: string, body: string) => boolean; onEditOwnComment: (contextId: string, commentId: string, body: string) => boolean; onDeleteOwnComment: (contextId: string, commentId: string) => boolean }) {
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
  const authorMember = context.authorId ? careMembers.find((member) => member.id === context.authorId) : undefined;
  const authorName = authorAccount?.name ?? authorMember?.name ?? context.authorName ?? ownerName;
  const authorAvatar = authorAccount?.avatar || authorMember?.avatar || context.authorAvatar || (context.authorId ? '' : ownerAvatar);
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

function MomentDetailPage({ moment, contexts, accounts, careMembers, ownerName, ownerAvatar, currentAccountId, groupOwnerAccountId, petName, canContribute, canInteract, engagement, onToggleMomentLike, onToggleMomentFavorite, onBack, onAddContext, onEditContext, onDeleteContext, onToggleLike, onAddComment, onEditOwnComment, onDeleteOwnComment }: { moment: MomentRecord; contexts: OwnerContext[]; accounts: PrototypeAccount[]; careMembers: CareMember[]; ownerName: string; ownerAvatar: string; currentAccountId: string; groupOwnerAccountId?: string; petName: string; canContribute: boolean; canInteract: boolean; engagement: MomentEngagement; onToggleMomentLike: () => void; onToggleMomentFavorite: () => void; onBack: () => void; onAddContext: () => void; onEditContext: (context: OwnerContext) => void; onDeleteContext: (id: string) => boolean; onToggleLike: (contextId: string) => void; onAddComment: (contextId: string, body: string) => boolean; onEditOwnComment: (contextId: string, commentId: string, body: string) => boolean; onDeleteOwnComment: (contextId: string, commentId: string) => boolean }) {
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
        {canInteract && <div className="moment-engagement-actions"><button type="button" className={`moment-engagement-button like ${engagement.likes.includes(currentAccountId) ? 'active' : ''}`} aria-label={engagement.likes.includes(currentAccountId) ? 'Unlike this moment' : 'Like this moment'} aria-pressed={engagement.likes.includes(currentAccountId)} onClick={onToggleMomentLike}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 5.9l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.3 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>{engagement.likes.length > 0 && <b>{engagement.likes.length}</b>}</button><button type="button" className={`moment-engagement-button favorite ${engagement.favorites.includes(currentAccountId) ? 'active' : ''}`} aria-label={engagement.favorites.includes(currentAccountId) ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={engagement.favorites.includes(currentAccountId)} onClick={onToggleMomentFavorite}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>{engagement.favorites.length > 0 && <b>{engagement.favorites.length}</b>}</button></div>}
      </article>
      {moment.relatedPhotos && moment.relatedPhotos.length > 0 && <section className="moment-related-photos"><strong>Related photos</strong><div>{moment.relatedPhotos.map((media, index) => <StoryMediaView key={`${media.name}-${index}`} src={media.url} type={media.type} alt={`Related attachment ${index + 1}`} controls={media.type.startsWith('audio/')} />)}</div></section>}
      {moment.observationContext && <section className="observation-context-summary"><strong>Context saved with this observation</strong><span>{moment.observationContext}</span></section>}
      <section className="moment-context-section">
        <div className="section-heading"><h2>Owner context</h2>{contexts.length > 0 && <span>{contexts.length} saved</span>}</div>
        {contexts.length ? <div className="moment-context-list">{contexts.map((context) => <MomentContextCard key={context.id} context={context} accounts={accounts} careMembers={careMembers} ownerName={ownerName} ownerAvatar={ownerAvatar} currentAccountId={currentAccountId} groupOwnerAccountId={groupOwnerAccountId} canContribute={canContribute} canInteract={canInteract} onEditContext={onEditContext} onDeleteContext={() => { setDeleteError(''); setPendingDelete(context); }} onToggleLike={onToggleLike} onAddComment={onAddComment} onEditOwnComment={onEditOwnComment} onDeleteOwnComment={onDeleteOwnComment} />)}</div> : <div className="empty-context-state"><strong>No context has been added</strong><p>Add what was happening around this specific moment. It will stay attached here.</p></div>}
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
    careTasks: [],
    careEvent: null,
    mediaSources: defaultMediaSources(false),
    patterns: [],
    lifeEvents: [],
    insightReviews: [],
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
    careTasks: [],
    careEvent: readCareEvent(),
    mediaSources: readMediaSources(true),
    patterns: readTypicalPatterns(ownerName, true),
    lifeEvents: readLifeCareEvents(),
    insightReviews: [],
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
    careTasks: Array.isArray(workspace.careTasks) ? workspace.careTasks.filter((task): task is CareTask => Boolean(task && typeof task === 'object' && typeof task.id === 'string' && typeof task.title === 'string' && typeof task.dueAt === 'string' && typeof task.assignedTo === 'string' && typeof task.assignedBy === 'string' && ['open', 'requested', 'accepted', 'declined', 'done', 'skipped'].includes(task.status))) : [],
    careEvent: typeof workspace.careEvent === 'object' ? workspace.careEvent ?? null : null,
    mediaSources: Array.isArray(workspace.mediaSources) ? workspace.mediaSources : defaultMediaSources(hasDemoData),
    patterns: Array.isArray(workspace.patterns) ? workspace.patterns : defaultTypicalPatterns(ownerName, hasDemoData),
    lifeEvents: Array.isArray(workspace.lifeEvents) ? workspace.lifeEvents : [],
    insightReviews: Array.isArray(workspace.insightReviews) ? workspace.insightReviews.filter((review): review is ActivityInsightReview => Boolean(review && typeof review === 'object' && typeof review.id === 'string' && typeof review.activityKey === 'string' && ['duration', 'food'].includes(review.metricKey) && typeof review.dateKey === 'string' && ['watch', 'normal'].includes(review.status) && typeof review.reviewerId === 'string' && typeof review.reviewerName === 'string' && typeof review.reviewedAt === 'string')) : [],
    petSex: normalizePetSex(workspace.petSex),
    scenarioDate: typeof workspace.scenarioDate === 'string' ? workspace.scenarioDate : undefined,
    sharedUpdatedAt: typeof workspace.sharedUpdatedAt === 'string' ? workspace.sharedUpdatedAt : undefined,
  };
}

function privateAskMessagesFor(pet: PrototypePet | undefined, accountId: string | undefined): AskMessage[] {
  const messages = pet && Array.isArray(pet.workspace.askMessages) ? pet.workspace.askMessages : pet ? [] : readAskMessages();
  if (!pet || !pet.sharedGroupId) return messages;
  const historyOwnerId = pet.workspace.askOwnerAccountId;
  const belongsToAccount = historyOwnerId ? historyOwnerId === accountId : accountId === pet.sharedOwnerAccountId;
  return belongsToAccount ? messages : [];
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
          sex: normalizePetSex(pet.sex),
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
        preference: typeof account.preference === 'string' ? account.preference : '',
        careProfile: normalizeOwnerCareProfile(account.careProfile),
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

function AskPage({ onPetsNavigate, petName, petAvatar, petSpecies, messages, messageEndRef, noPetYet, busy, pending, live }: { onPetsNavigate: () => void; petName: string; petAvatar: string; messages: AskMessage[]; messageEndRef: RefObject<HTMLDivElement | null>; noPetYet: boolean; busy: boolean; pending: AskMessage | null; live: boolean; petSpecies: 'Dog' | 'Cat' }) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  return <div className="ask-page">
    <MainHeader eyebrow="ASK AI · OBSERVATION DIALOGUE" title="Ask Pawsona" onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} hasPet={!noPetYet} />
    <p className="ask-ai-notice">{!live ? 'Log in to chat with Pawsona. Guest conversations are available to review only.' : noPetYet ? 'Add your pet profile to start a conversation.' : 'Ask a question or share a photo. Your messages, attached photos and pet basics are sent to OpenAI. When enabled in Settings, a limited recent Story text extract is included too. AI observations can be mistaken.'}</p>
    <section className="ask-thread" aria-label="Conversation with Pawsona" aria-busy={busy}>
      {safeMessages.length === 0 && <article className="chat-message ai">Hi! What would you like to know about {petName}? You can ask a question or attach a photo. I can help describe what is visible, but a photo alone cannot tell me how your pet feels or establish a diagnosis.</article>}
      {[...safeMessages, ...(pending ? [pending] : [])].map((message, index) => <article className={`chat-message ${message.role === 'user' ? 'owner' : 'ai dynamic-answer'}`} key={index}>
        {message.attachment && (message.attachment.kind === 'image' ? <img className="chat-attachment" src={message.attachment.url} alt={message.attachment.name} /> : <audio src={message.attachment.url} controls aria-label={message.attachment.name} />)}
        <span>{message.text}</span>
      </article>)}
      {busy && <article className="chat-message ai ask-thinking" role="status"><ThinkingAvatar species={petSpecies} /> Pawsona is thinking…</article>}
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

function SimplePage({ kind, petName, petAvatar, petBreed, petAge, ownerName, ownerRole = 'Primary caregiver', ownerAvatar = '', ownerPreference = 'Manage your profile details here.', pets, activePetId, currentAccountId, onOpenFavorites, onPetsNavigate, onSettingsNavigate, onPetEdit, onProfileEdit, onPetSwitcher, careMembers, accounts, primaryMemberId, onMemberClick, onCareMembers, patterns, lifeEvents, mediaSources, onPatternHistory, onPattern, onLifeCare, onConnectedMedia, invitations = [], onAcceptInvitation, onDeclineInvitation, careOwnerName = ownerName, careOwnerAvatar = ownerAvatar, careOwnerRole = ownerRole, groupName = 'Care circle', canManageCareGroup = primaryMemberId === 'emily', canEditPetDetails = true, canAddLifeCare = true, canManageConnectedMedia = true, noPetYet = false }: { kind: 'pets' | 'you'; petName: string; petAvatar: string; petBreed: string; petAge: string; ownerName: string; ownerRole?: string; ownerAvatar?: string; ownerPreference?: string; pets: PrototypePet[]; activePetId: string; currentAccountId: string; onOpenFavorites: () => void; accounts: PrototypeAccount[]; onPetsNavigate: () => void; onSettingsNavigate: () => void; onPetEdit: () => void; onProfileEdit: () => void; onPetSwitcher: () => void; careMembers: CareMember[]; primaryMemberId: string; onMemberClick: (id: string) => void; onCareMembers: () => void; patterns: TypicalPattern[]; lifeEvents: LifeCareEvent[]; mediaSources: MediaSource[]; onPatternHistory: () => void; onPattern: (id: string) => void; onLifeCare: (category?: 'life' | 'health') => void; onConnectedMedia: (sourceId?: string) => void; invitations?: CareInvitation[]; onAcceptInvitation?: (invite: CareInvitation) => void; onDeclineInvitation?: (inviteId: string) => void; careOwnerName?: string; careOwnerAvatar?: string; careOwnerRole?: string; groupName?: string; canManageCareGroup?: boolean; canEditPetDetails?: boolean; canAddLifeCare?: boolean; canManageConnectedMedia?: boolean; noPetYet?: boolean }) {
  void canManageCareGroup;
  const shownSex = normalizePetSex(pets.find(p => p.id === activePetId)?.sex);
  const petDetailsLabel = `${petBreed} · ${formatPetAge(petAge)}${shownSex === 'Unknown' ? '' : ` · ${shownSex}`}`;
  const displayPets = pets.filter((pet) => !pet.isEmptyProfile).sort((left, right) => Number(right.id === activePetId) - Number(left.id === activePetId));
  const confirmedPatterns = patterns.filter((pattern) => pattern.status === 'confirmed');
  const favoriteMomentsFor = (pet: PrototypePet) => {
    const favoriteIds = Object.entries(pet.workspace.momentEngagement ?? {})
      .filter(([, engagement]) => Array.isArray(engagement.favorites) && engagement.favorites.includes(currentAccountId))
      .map(([momentId]) => momentId);
    return favoriteIds.map((id) => {
      const observation = pet.workspace.observations.find((entry) => entry.id === id && (!entry.privateRecord || entry.authorId === currentAccountId));
      if (observation) return { id, title: observation.title, note: observation.note, image: observation.image, mediaType: observation.mediaType, savedAt: observation.savedAt };
      const base = baseMomentDefinitions.find((entry) => entry.id === id);
      return base ? { id, title: base.title, note: base.description, image: asset(base.image), mediaType: undefined, savedAt: '' } : null;
    }).filter((moment): moment is NonNullable<typeof moment> => moment !== null)
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  };
  return kind === 'pets' ? (
    <div className="profile-page pets-page">
      <MainHeader eyebrow="PET PROFILE" title="Pet profile" onPetsNavigate={onPetsNavigate} petName={petName} petAvatar={petAvatar} hasPet={!noPetYet} />
      {noPetYet ? <section className="today-empty-state pets-empty-state"><span>＋</span><h2>You haven’t added a pet yet</h2><p>Add one to get started.</p><button className="primary-button" onClick={onPetSwitcher}>Add a pet</button></section> : <>
      <section className="pet-profile-hero">
        <Avatar name={petName} src={petAvatar} />
        <div className="profile-hero-copy"><strong>{petName}</strong><small>{petDetailsLabel}</small><div className="pet-hero-actions"><button className="mini-action" onClick={onPetEdit}><span>✎</span> Edit details</button><button className="mini-action" onClick={onPetSwitcher}>⇄ Switch pet</button></div></div>
      </section>

      <section className="profile-section care-section">
        <h2>Who looks after {petName}?</h2>
        <div className="profile-card care-card">
          <div className="card-topline"><strong>{groupName}</strong><button className="profile-link" onClick={onCareMembers}>Manage members →</button></div>
        {careMembers.map((member) => { const linkedAccount = accounts.find((account) => account.id === member.id || (!!member.email && account.email.toLowerCase() === member.email.toLowerCase())); const memberName = member.id === primaryMemberId ? careOwnerName : linkedAccount?.name ?? member.name; const memberAvatar = member.id === primaryMemberId ? careOwnerAvatar : linkedAccount?.avatar ?? member.avatar ?? ''; return <button className="member-row" key={member.id} onClick={() => onMemberClick(member.id)}><OwnerAvatar src={memberAvatar} name={memberName} className={member.id === primaryMemberId ? '' : `${member.id}-avatar`} /><span><strong>{memberName}</strong><small>{member.id === primaryMemberId ? careOwnerRole : member.access === 'viewer' ? 'Viewer' : member.role || 'Caregiver'}</small></span><i>›</i></button>; })}
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
        <div className="profile-section-heading"><h2>Health &amp; care records</h2>{canAddLifeCare && <button className="profile-link" onClick={() => onLifeCare()}>Add record +</button>}</div>
        <div className="profile-card context-card">
          <button className="knowledge-row" onClick={() => onLifeCare('health')}><span className="knowledge-icon">＋</span><span><strong>Medical history &amp; care</strong><small>Vet visits, neutering, medication &amp; vaccines</small><small>{lifeEvents.filter(event => event.category === 'health').length} saved records</small></span><i>›</i></button>
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
          {displayPets.length ? displayPets.map((pet) => <button className="you-row" key={pet.id} onClick={() => pet.id === activePetId && canEditPetDetails ? onPetEdit() : onPetSwitcher()}><Avatar name={pet.name} src={pet.avatar} /><span><strong>{pet.name}</strong><small>{pet.breed} · {formatPetAge(pet.age)}</small></span><em className={pet.id === activePetId ? 'active' : 'inactive'}>{pet.id === activePetId ? 'Active' : 'Switch'}</em></button>) : <div className="management-empty"><strong>You haven’t added a pet yet</strong><p>Add one to get started.</p><button className="profile-link" onClick={onPetSwitcher}>Add a pet →</button></div>}
        </div>
        {invitations.length > 0 && <div className="care-invitation-list" aria-label="Care group invitations">{invitations.map((invite) => <article className="care-invitation-card" key={invite.id}><div className="care-invitation-pet"><Avatar name={invite.petName} src={invite.petAvatar} /><span><strong>{invite.petName}’s care group</strong><small>Invited by <b>{invite.ownerName}</b></small></span></div><p><strong>{invite.ownerName}</strong> invited you to help care for <strong>{invite.petName}</strong> as a {invite.role.toLowerCase()}.</p><div className="care-invitation-actions"><button className="cancel-button" onClick={() => onDeclineInvitation?.(invite.id)}>Decline</button><button className="primary-button" onClick={() => onAcceptInvitation?.(invite)}>Accept invitation</button></div></article>)}</div>}
      </section>

      <section className="profile-section you-section favorites-section">
        <div className="profile-section-heading"><h2>Favorite moments</h2><span className="favorite-total">{displayPets.reduce((total, pet) => total + favoriteMomentsFor(pet).length, 0)} saved</span></div>
        <button type="button" className="profile-card favorite-entry-card" onClick={onOpenFavorites}><span className="favorite-entry-icon" aria-hidden="true">★</span><span><strong>Saved moments</strong><small>{displayPets.length} pet folders · tap to view your collection</small></span><i aria-hidden="true">→</i></button>
      </section>

      <section className="profile-section you-section media-section">
        <div className="profile-section-heading"><h2>Connected media</h2>{canManageConnectedMedia && <button className="profile-link" onClick={() => onConnectedMedia()}>Add source +</button>}</div>
        <div className="profile-card you-list media-list">
          {mediaSources.length ? mediaSources.map((source) => <button className="media-row" key={source.id} disabled={!canManageConnectedMedia} onClick={() => canManageConnectedMedia && onConnectedMedia(source.id)}><span className="media-icon">{source.id === 'album' ? '▦' : source.id === 'camera' ? '◉' : '◇'}</span><span><strong>{source.title}</strong><small>{source.detail}{source.lastSync ? ` · ${source.lastSync}` : ''}</small></span><em className={source.status === 'connected' ? 'connected' : 'not-connected'}>{source.status === 'connected' ? 'Connected' : 'Not linked'}</em></button>) : <div className="knowledge-empty media-empty"><strong>No devices connected</strong><small>Connect an album or device to see it here.</small></div>}
        </div>
      </section>

    </div>
  );
}

function FavoritesPage({ pets, initialPetId, currentAccountId, onBack, onOpenMoment, onRemoveFavorites }: { pets: PrototypePet[]; initialPetId: string; currentAccountId: string; onBack: () => void; onOpenMoment: (petId: string, momentId: string) => void; onRemoveFavorites: (petId: string, momentIds: string[]) => void }) {
  const visiblePets = pets.filter((pet) => !pet.isEmptyProfile).sort((left, right) => Number(right.id === initialPetId) - Number(left.id === initialPetId));
  const [selectedPetId, setSelectedPetId] = useState(initialPetId);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMomentIds, setSelectedMomentIds] = useState<string[]>([]);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const selectedPet = visiblePets.find((pet) => pet.id === selectedPetId) ?? visiblePets[0];
  const favorites = selectedPet ? Object.entries(selectedPet.workspace.momentEngagement ?? {})
    .filter(([, engagement]) => Array.isArray(engagement.favorites) && engagement.favorites.includes(currentAccountId))
    .map(([id]) => {
      const observation = selectedPet.workspace.observations.find((entry) => entry.id === id && (!entry.privateRecord || entry.authorId === currentAccountId));
      if (observation) return { id, title: observation.title, note: observation.note, image: observation.image, mediaType: observation.mediaType, savedAt: observation.savedAt };
      const base = baseMomentDefinitions.find((entry) => entry.id === id);
      return base ? { id, title: base.title, note: base.description, image: asset(base.image), mediaType: undefined, savedAt: '' } : null;
    })
    .filter((moment): moment is NonNullable<typeof moment> => moment !== null)
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt)) : [];

  function clearLongPressTimer() {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }
  function beginLongPress(momentId: string) {
    if (selectionMode) return;
    clearLongPressTimer();
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      setSelectionMode(true);
      setSelectedMomentIds([momentId]);
    }, 480);
  }
  function toggleSelected(momentId: string) {
    setSelectedMomentIds((current) => current.includes(momentId) ? current.filter((id) => id !== momentId) : [...current, momentId]);
  }
  function leaveSelectionMode() {
    setSelectionMode(false);
    setSelectedMomentIds([]);
  }
  function choosePet(petId: string) {
    clearLongPressTimer();
    setSelectedPetId(petId);
    leaveSelectionMode();
  }
  function handleMomentClick(momentId: string) {
    if (longPressTriggered.current) { longPressTriggered.current = false; return; }
    if (selectionMode) { toggleSelected(momentId); return; }
    if (selectedPet) onOpenMoment(selectedPet.id, momentId);
  }
  function selectAllMoments() {
    setSelectedMomentIds((current) => current.length === favorites.length ? [] : favorites.map((moment) => moment.id));
  }

  return <section className="favorites-page">
    <header className={`favorites-page-header ${selectionMode ? 'selecting' : ''}`}><button className="back-button" aria-label="Back to profile" onClick={onBack}>←</button><div className="favorites-page-title"><span className="eyebrow">MY SPACE</span><h1>Favorite moments</h1></div><div className="favorite-selection-actions">{selectionMode ? <><button type="button" onClick={selectAllMoments}>{selectedMomentIds.length === favorites.length ? 'Clear' : 'Select all'}</button><button type="button" className="favorite-delete-action" disabled={!selectedMomentIds.length} onClick={() => { if (selectedPet && selectedMomentIds.length) onRemoveFavorites(selectedPet.id, selectedMomentIds); leaveSelectionMode(); }}>Delete{selectedMomentIds.length ? ` · ${selectedMomentIds.length}` : ''}</button><button type="button" className="favorite-cancel-action" aria-label="Exit selection mode" onClick={leaveSelectionMode}>×</button></> : <button type="button" className="favorite-select-mode" onClick={() => setSelectionMode(true)}>Select</button>}</div></header>
    <nav className="favorite-pet-tabs" aria-label="Pet favorites folders">{visiblePets.map((pet) => {
      const count = Object.values(pet.workspace.momentEngagement ?? {}).filter((engagement) => Array.isArray(engagement.favorites) && engagement.favorites.includes(currentAccountId)).length;
      const selected = pet.id === selectedPet?.id;
      return <button type="button" key={pet.id} className={`favorite-pet-tab ${selected ? 'active' : ''}`} aria-pressed={selected} onClick={() => choosePet(pet.id)}><Avatar name={pet.name} src={pet.avatar} /><span>{pet.name}</span><small>{count}</small></button>;
    })}</nav>
    <section className="favorite-collection" aria-label={`${selectedPet?.name ?? 'Pet'} saved moments`}>
      <div className="favorite-collection-heading"><div><span>COLLECTION</span><h2>{selectedPet?.name ?? 'Pet'}’s moments</h2></div><strong>{favorites.length}</strong></div>
      {favorites.length ? <div className={`favorite-moments-grid ${selectionMode ? 'selecting' : ''}`}>{favorites.map((moment) => {
        const selected = selectedMomentIds.includes(moment.id);
        return <button type="button" className={`favorite-moment-card ${selected ? 'selected' : ''}`} key={moment.id} aria-pressed={selectionMode ? selected : undefined} onPointerDown={(event) => { if (event.button === 0) beginLongPress(moment.id); }} onPointerUp={clearLongPressTimer} onPointerLeave={clearLongPressTimer} onPointerCancel={clearLongPressTimer} onContextMenu={(event) => event.preventDefault()} onClick={() => handleMomentClick(moment.id)}><span className="favorite-moment-cover">{moment.image ? <StoryMediaView src={moment.image} type={moment.mediaType} alt={`${selectedPet?.name} · ${moment.title}`} /> : <span aria-hidden="true">🐾</span>}{selectionMode && <span className="favorite-selection-mark" aria-hidden="true">{selected && <svg viewBox="0 0 24 24"><path d="m4.5 12.5 5 5L20 7" /></svg>}</span>}</span><span className="favorite-moment-copy"><strong>{moment.title}</strong><small>{moment.note || 'Saved moment'}</small><em>{moment.savedAt ? formatRelativeDate(moment.savedAt) : 'Saved moment'}</em></span></button>;
      })}</div> : <div className="favorite-folder-empty"><span aria-hidden="true">☆</span><p>No saved moments for {selectedPet?.name ?? 'this pet'} yet.</p><small>Star a moment in Story to add it to this folder.</small></div>}
    </section>
  </section>;
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

function PatternKnowledgePage({ petName, ownerName, patterns, initialPatternId, canManage, onBack, onSave, onDelete, petId, records, live, onMoment }: { onMoment: (id: string) => void; petId: string; records: StoryObservation[]; live: boolean; petName: string; ownerName: string; patterns: TypicalPattern[]; initialPatternId: string | null; canManage: boolean; onBack: () => void; onSave: (pattern: TypicalPattern) => string; onDelete: (id: string) => string }) {
  const [selectedId, setSelectedId] = useState(initialPatternId);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDetail, setDraftDetail] = useState('');
  const [draftEvidence, setDraftEvidence] = useState('');
  const [timed, setTimed] = useState(false);
  const [draftActivity, setDraftActivity] = useState('Breakfast');
  const [draftStart, setDraftStart] = useState('09:00');
  const [draftEnd, setDraftEnd] = useState('10:00');
  const minute = (value: string) => { const [h,m] = value.split(':').map(Number); return h*60+m; };
  const timing = timed ? { activity: draftActivity, startMinute: minute(draftStart), endMinute: minute(draftEnd) } : { activity: undefined, startMinute: undefined, endMinute: undefined };
  const windowFields = <div className="pattern-time-editor"><label className="settings-choice"><input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)} />Show a confirmed time window in Daily Rhythm</label>{timed && <><label>Activity<select value={draftActivity} onChange={e => setDraftActivity(e.target.value)}>{['Breakfast','Lunch','Dinner','Walk','Rest','Play'].map(v => <option key={v}>{v}</option>)}</select></label><div className="pattern-time-fields"><label>Window starts<input type="time" value={draftStart} onChange={e => setDraftStart(e.target.value)} /></label><label>Window ends<input type="time" value={draftEnd} onChange={e => setDraftEnd(e.target.value)} /></label></div></>}</div>;
  const [pendingDelete, setPendingDelete] = useState<TypicalPattern | null>(null);
  const [saveError, setSaveError] = useState('');
  const visible = patterns.filter((pattern) => showArchived || pattern.status === 'confirmed');
  const selected = patterns.find((pattern) => pattern.id === selectedId) ?? null;
  function startAdd() { setTimed(false); setAdding(true); setSelectedId(null); setEditing(false); setDraftTitle(''); setDraftDetail(''); setDraftEvidence(''); setSaveError(''); }
  function startEdit(pattern: TypicalPattern) { setTimed(Number.isFinite(pattern.startMinute)); setDraftActivity(pattern.activity || 'Breakfast'); setDraftStart(clockMinute(pattern.startMinute ?? 540)); setDraftEnd(clockMinute(pattern.endMinute ?? 600)); setDraftTitle(pattern.title); setDraftDetail(pattern.detail); setDraftEvidence(pattern.evidence); setEditing(true); setAdding(false); setSaveError(''); }
  function addPattern(event: FormEvent) {
    event.preventDefault();
    if (!draftTitle.trim() || !draftDetail.trim()) return;
    if (timed && (!draftStart || !draftEnd || minute(draftStart) >= minute(draftEnd))) { setSaveError('Choose a valid same-day time window.'); return; }
    const pattern: TypicalPattern = { ...timing, generatedBy: 'owner', id: `pattern-${Date.now()}`, title: draftTitle.trim(), detail: draftDetail.trim(), evidence: draftEvidence.trim() || 'Added directly by the owner', confirmedBy: ownerName, updatedAt: new Date().toISOString(), status: 'confirmed' };
    const error = onSave(pattern); setSaveError(error);
    if (!error) { setSelectedId(pattern.id); setAdding(false); setDraftTitle(''); setDraftDetail(''); setDraftEvidence(''); }
  }
  function saveEdit() {
    if (!selected || !draftTitle.trim() || !draftDetail.trim()) return;
    if (timed && (!draftStart || !draftEnd || minute(draftStart) >= minute(draftEnd))) { setSaveError('Choose a valid same-day time window.'); return; }
    const error = onSave({ ...selected, ...timing, title: draftTitle.trim(), detail: draftDetail.trim(), evidence: draftEvidence.trim() || selected.evidence, updatedAt: new Date().toISOString() });
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
    {adding && <form className="pattern-detail-card management-add-form" onSubmit={addPattern}><p className="settings-eyebrow">NEW PATTERN</p><label><span>Pattern name</span><input autoFocus value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="e.g. Evening play burst" /></label><label><span>Description</span><textarea value={draftDetail} onChange={(event) => setDraftDetail(event.target.value)} placeholder="Describe what usually happens and when." /></label>{windowFields}<label><span>Supporting information</span><textarea value={draftEvidence} onChange={(event) => setDraftEvidence(event.target.value)} placeholder="Owner notes or selected records" /></label>{saveError && <p className="inline-save-error" role="alert">{saveError}</p>}<div className="source-detail-actions"><button type="button" className="cancel-button" onClick={() => setAdding(false)}>Cancel</button><button className="primary-button" disabled={!draftTitle.trim() || !draftDetail.trim()}>Add pattern</button></div></form>}
    <PatternSuggestions petId={petId} records={records} ownerName={ownerName} existing={patterns} onSave={onSave} enabled={live && canManage} />
    <div className="pattern-management-list">{visible.map((pattern) => <button key={pattern.id} className={`pattern-management-row ${selectedId === pattern.id ? 'selected' : ''}`} onClick={() => { setSelectedId(pattern.id); setAdding(false); setEditing(false); setSaveError(''); }}><span><strong>{pattern.title}</strong><small>{pattern.detail}</small></span><em className={pattern.status}>{pattern.status === 'archived' ? 'Archived' : 'Confirmed'}</em></button>)}{!visible.length && !adding && <div className="management-empty"><strong>No patterns here</strong><p>Add a pattern after an owner has confirmed it.</p></div>}</div>
    {selected && <section className="pattern-detail-card">{editing && canManage ? <><label><span>Pattern name</span><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} /></label><label><span>Description</span><textarea value={draftDetail} onChange={(event) => setDraftDetail(event.target.value)} /></label>{windowFields}<label><span>Supporting information</span><textarea value={draftEvidence} onChange={(event) => setDraftEvidence(event.target.value)} /></label><div className="source-detail-actions"><button className="cancel-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-button" onClick={saveEdit}>Save changes</button></div></> : <><p className="settings-eyebrow">{selected.status.toUpperCase()}</p><h2>{selected.title}</h2><p>{selected.detail}</p><div className="pattern-evidence"><strong>Supporting information</strong><span>{selected.evidence}</span><div>{selected.sourceIds?.slice(0,12).map(id => { const r = records.find(r => r.id === id); return r ? <button className="profile-link" key={id} onClick={() => onMoment(id)}>{r.title} · {new Date(r.savedAt).toLocaleDateString('en-GB')} →</button> : null; })}</div><small>Confirmed by {selected.confirmedBy} · {new Date(selected.updatedAt).toLocaleDateString('en-AU')}</small></div>{canManage && <div className="source-detail-actions"><button className="cancel-button" onClick={() => startEdit(selected)}>Edit pattern</button><button className="danger-outline-button" onClick={() => toggleArchive(selected)}>{selected.status === 'archived' ? 'Restore' : 'Archive'}</button><button className="danger-outline-button" onClick={() => setPendingDelete(selected)}>Delete</button></div>}</>}{saveError && <p className="inline-save-error" role="alert">{saveError}</p>}</section>}
    {pendingDelete && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-pattern-title" onClick={(event) => event.stopPropagation()}><h2 id="delete-pattern-title">Delete “{pendingDelete.title}”?</h2><p>This permanently removes the pattern from {petName}’s owner-confirmed knowledge.</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-button" onClick={deletePattern}>Delete pattern</button></div></section></div>}
  </section>;
}

function LifeCarePage({ petName, ownerName, primaryOwnerName, currentAccountId, events, initialCategory, startAdding, canAdd, canManageAll, onBack, onSave, onDelete }: { petName: string; ownerName: string; primaryOwnerName: string; currentAccountId: string; events: LifeCareEvent[]; initialCategory: 'life' | 'health' | null; startAdding: boolean; canAdd: boolean; canManageAll: boolean; onBack: () => void; onSave: (event: LifeCareEvent) => string; onDelete: (id: string) => string }) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const recordTypes = ['Medical history / vet visit', 'Neutering status', 'Medication', 'Vaccination', 'Health observation', 'Other care'];
  const [recordDetails, setRecordDetails] = useState<Record<string, string>>({});
  const [recordFilter, setRecordFilter] = useState('All');
  const detailField = (key: string, label: string, placeholder: string) => <label><span>{label}</span><input value={recordDetails[key] ?? ''} onChange={event => setRecordDetails({ ...recordDetails, [key]: event.target.value })} placeholder={placeholder} /></label>;
  const [filter, setFilter] = useState<'all' | 'life' | 'health'>(initialCategory ?? 'health');
  const [showForm, setShowForm] = useState(startAdding);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState<'life' | 'health'>(initialCategory ?? 'health');
  const [type, setType] = useState('Medical history / vet visit');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [ongoing, setOngoing] = useState(false);
  const [note, setNote] = useState('');
  const [useForAsk, setUseForAsk] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<LifeCareEvent | null>(null);
  const [saveError, setSaveError] = useState('');
  const visible = events.filter((event) => (filter === 'all' || event.category === filter) && (recordFilter === 'All' || event.type === recordFilter)).sort((a, b) => b.startDate.localeCompare(a.startDate));
  function resetForm(nextCategory = initialCategory ?? 'health') { setEditingId(null); setCategory(nextCategory); setType(nextCategory === 'health' ? 'Medical history / vet visit' : 'Routine change'); setRecordDetails({}); setTitle(''); setStartDate(today); setEndDate(''); setOngoing(false); setNote(''); setUseForAsk(true); setSaveError(''); }
  function canManageEvent(event: LifeCareEvent) { return canManageAll || (canAdd && event.authorId === currentAccountId); }
  function editEvent(event: LifeCareEvent) { if (!canManageEvent(event)) return; setEditingId(event.id); setCategory(event.category); setType(event.type); setRecordDetails(event.recordDetails ?? {}); setTitle(event.title); setStartDate(event.startDate); setEndDate(event.endDate ?? ''); setOngoing(event.ongoing); setNote(event.note); setUseForAsk(event.useForAsk); setShowForm(true); setSaveError(''); }
  function saveEvent(event: FormEvent) {
    event.preventDefault();
    if (!canAdd || !title.trim() || !startDate || !note.trim()) return;
    if (endDate && !ongoing && endDate < startDate) { setSaveError('End date must be on or after the record date.'); return; }
    if (type === 'Neutering status' && !recordDetails.status) { setSaveError('Select a neutering status, or choose Unknown.'); return; }
    const existing = editingId ? events.find((entry) => entry.id === editingId) : undefined;
    if (existing && !canManageEvent(existing)) return;
    const next: LifeCareEvent = { id: editingId ?? `life-event-${Date.now()}`, category, type, recordDetails, title: title.trim(), startDate, endDate: ongoing ? undefined : endDate || undefined, ongoing, note: note.trim(), useForAsk, savedAt: new Date().toISOString(), authorId: existing?.authorId ?? currentAccountId, authorName: existing?.authorName ?? ownerName };
    const error = onSave(next); setSaveError(error); if (!error) { setFilter(category); setShowForm(false); resetForm(category); }
  }
  function confirmDelete() { if (!pendingDelete) return; const error = onDelete(pendingDelete.id); setSaveError(error); if (!error) setPendingDelete(null); }
  return <section className="settings-page pet-subpage knowledge-management-page life-care-page">
    <header className="settings-header"><button className="back-button" aria-label="Back to pet profile" onClick={onBack}>←</button><h1>Health &amp; care records</h1></header>
    <div className="settings-eyebrow-row"><p className="settings-eyebrow">PET HEALTH & CARE</p>{canAdd && <button className="profile-link" onClick={() => { resetForm('health'); setFilter('health'); setRecordFilter('All'); setShowForm(true); }}>Add record +</button>}</div>
    <section className="settings-summary"><strong>A health history for {petName}</strong><p>Keep medical history, neutering status, medication and vaccinations together. Record daily activities in Moments.</p></section>
    <div className="context-filter-tabs health-record-filters" aria-label="Filter health records">{['All', ...recordTypes].map(item => <button key={item} aria-pressed={filter === 'health' && recordFilter === item} className={filter === 'health' && recordFilter === item ? 'active' : ''} onClick={() => { setFilter('health'); setRecordFilter(item); setShowForm(false); }}>{item === 'Medical history / vet visit' ? 'Medical history' : item}</button>)}</div>
    {showForm && canAdd && <form className="life-event-form" onSubmit={saveEvent}><label><span>Record type</span><select value={type} onChange={event => { setType(event.target.value); setCategory('health'); setRecordDetails({}); }}>{!recordTypes.includes(type) && <option>{type}</option>}{recordTypes.map(item => <option key={item}>{item}</option>)}</select></label>
      {type === 'Neutering status' && <label><span>Neutering status</span><select value={recordDetails.status ?? ''} onChange={event => setRecordDetails({ ...recordDetails, status: event.target.value })}><option value="">Select status</option><option>Spayed</option><option>Neutered</option><option>Not spayed / neutered</option><option>Unknown</option></select></label>}
      {type === 'Medication' && <>{detailField('medication', 'Medication name', 'Name on the prescription') }<div className="life-event-form-grid">{detailField('dose', 'Prescribed dose (optional)', 'As prescribed')}{detailField('frequency', 'Frequency (optional)', 'As prescribed')}</div></>}
      {type === 'Vaccination' && <>{detailField('vaccine', 'Vaccine name', 'Name on the vaccination record')}{detailField('nextDue', 'Next due date (optional)', 'As recorded by your vet')}</>}
      {(type === 'Medical history / vet visit' || type === 'Neutering status' || type === 'Vaccination') && detailField('clinic', 'Vet / clinic (optional)', 'Clinic or veterinarian name')}
      <label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={type === 'Medication' ? 'e.g. Post-surgery medication' : type === 'Neutering status' ? 'e.g. Spayed — recovery notes' : 'e.g. Annual check-up'} /></label><div className="life-event-form-grid"><label><span>Record / start date</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>End date (optional)</span><input type="date" value={endDate} disabled={ongoing} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label></div><label className="context-checkbox"><input type="checkbox" checked={ongoing} onChange={(event) => setOngoing(event.target.checked)} /><span>Ongoing treatment or care</span></label><label><span>Record details</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={type === 'Medication' ? 'Record the prescribed instructions and any observations.' : 'Add findings, care instructions or observations from this record.'} /></label><label className="context-checkbox"><input type="checkbox" checked={useForAsk} onChange={(event) => setUseForAsk(event.target.checked)} /><span>Allow Ask AI and your care group to use this record</span></label>{saveError && <p className="inline-save-error" role="alert">{saveError}</p>}<div className="source-detail-actions"><button type="button" className="cancel-button" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button><button className="primary-button" disabled={!title.trim() || !startDate || !note.trim()}>{editingId ? 'Save changes' : 'Save record'}</button></div></form>}
    <div className="life-event-list">{visible.map((event) => { const manageable = canManageEvent(event); return <article className="life-event-card" key={event.id}><div><span className={`event-category ${event.category}`}>{event.category === 'health' ? event.type : 'Previous life note'}</span><strong>{event.title}</strong><small>{event.startDate}{event.ongoing ? ' · Ongoing' : event.endDate ? ` – ${event.endDate}` : ''}</small></div><p>{event.note}</p>{event.recordDetails && <dl className="health-record-details">{Object.entries(event.recordDetails).filter(([, value]) => value.trim()).map(([key, value]) => <div key={key}><dt>{{ status: 'Neutering status', medication: 'Medication', dose: 'Prescribed dose', frequency: 'Frequency', vaccine: 'Vaccine', nextDue: 'Next due', clinic: 'Vet / clinic' }[key] ?? key}</dt><dd>{value}</dd></div>)}</dl>}<small>Recorded by {event.authorName ?? primaryOwnerName}{event.useForAsk ? ' · Available to Ask AI' : ' · Private owner record'}</small>{manageable && <div className="life-event-actions"><button onClick={() => editEvent(event)}>Edit</button><button onClick={() => setPendingDelete(event)}>Delete</button></div>}</article>; })}{!visible.length && !showForm && <div className="management-empty"><strong>No records yet</strong><p>{canAdd ? `Add a medical, neutering, medication or vaccination record for ${petName}.` : `No health or care records have been shared for ${petName}.`}</p></div>}</div>
    {pendingDelete && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-life-event-title" onClick={(event) => event.stopPropagation()}><h2 id="delete-life-event-title">Delete “{pendingDelete.title}”?</h2><p>This removes the event from {petName}’s health and care records. Moment notes and Story cards will not be changed.</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-button" onClick={confirmDelete}>Delete record</button></div></section></div>}
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
      <section className="settings-hub-section"><div className="profile-section-heading"><h2>Privacy &amp; support</h2></div><div className="profile-card you-list privacy-list">
        <button className="media-row" onClick={() => onAction('Data, sharing & retention', 'Review permissions, access and deletion.')}><span className="media-icon">▤</span><span><strong>Data, sharing &amp; retention</strong><small>Review permissions, access and deletion</small></span><i>›</i></button>
        <button className="media-row" onClick={() => onAction('Accessibility & feedback', 'Text size, captions, help and suggestions.')}><span className="media-icon">◎</span><span><strong>Accessibility &amp; feedback</strong><small>Text size, captions, help and suggestions</small></span><i>›</i></button>
      </div></section>
    </div>
    {pendingDelete && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="settings-delete-account-title" onClick={(event) => event.stopPropagation()}><h2 id="settings-delete-account-title">Delete {pendingDelete.name}?</h2><p>This permanently removes this local account and the pets, moments and context saved inside it.</p>{deleteError && <p className="account-form-error" role="alert">{deleteError}</p>}<div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger-button" onClick={confirmDeleteAccount}>Delete account</button></div></section></div>}
  </section>;
}

function AvatarCropDialog({ src, onCancel, onSave }: { src: string; onCancel: () => void; onSave: (avatar: string) => void }) {
  const cropRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const frameSize = 260;
  const fitScale = frameSize / Math.min(imageSize.width, imageSize.height);
  const imageWidth = imageSize.width * fitScale * zoom;
  const imageHeight = imageSize.height * fitScale * zoom;

  function crop() {
    const scale = imageWidth / imageSize.width;
    const sx = Math.max(0, Math.min(imageSize.width - frameSize / scale, (imageWidth - frameSize) / 2 / scale - offset.x / scale));
    const sy = Math.max(0, Math.min(imageSize.height - frameSize / scale, (imageHeight - frameSize) / 2 / scale - offset.y / scale));
    const sourceSize = Math.min(frameSize / scale, imageSize.width - sx, imageSize.height - sy);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      canvas.getContext('2d')?.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, 512, 512);
      onSave(canvas.toDataURL('image/jpeg', 0.88));
    };
    image.src = src;
  }

  return <div className="profile-dialog-backdrop avatar-crop-backdrop" role="presentation" onClick={onCancel}><section className="profile-dialog avatar-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title" onClick={event => event.stopPropagation()}>
    <button type="button" className="profile-dialog-close" aria-label="Close" onClick={onCancel}>×</button>
    <h2 id="avatar-crop-title">Adjust your photo</h2>
    <p>Drag to position your photo, then zoom in or out.</p>
    <div ref={cropRef} className="avatar-crop-frame" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); dragStart.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }; }} onPointerMove={event => {
      if (!dragStart.current) return;
      const maxX = Math.max(0, (imageWidth - frameSize) / 2);
      const maxY = Math.max(0, (imageHeight - frameSize) / 2);
      setOffset({ x: Math.max(-maxX, Math.min(maxX, dragStart.current.offsetX + event.clientX - dragStart.current.x)), y: Math.max(-maxY, Math.min(maxY, dragStart.current.offsetY + event.clientY - dragStart.current.y)) });
    }} onPointerUp={() => { dragStart.current = null; }} onPointerCancel={() => { dragStart.current = null; }}>
      <img src={src} alt="Avatar crop preview" onLoad={event => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} style={{ width: imageWidth, height: imageHeight, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }} />
      <span className="avatar-crop-circle" aria-hidden="true" />
    </div>
    <label className="avatar-zoom-control"><span>Zoom</span><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={event => { setZoom(Number(event.target.value)); setOffset({ x: 0, y: 0 }); }} /></label>
    <div className="member-removal-actions"><button type="button" className="cancel-button" onClick={onCancel}>Cancel</button><button type="button" className="primary-button" onClick={crop}>Use photo</button></div>
  </section></div>;
}

function SettingsPage({ kind, initialName, initialSpecies = 'Dog', initialSex = 'Unknown', initialBreed = 'Golden Retriever', initialAge = '3', initialAvatar = '', initialPreference = '', initialCareProfile, onBack, onSaved, onPetSaved, onProfileSaved }: { kind: 'petDetails' | 'profile'; initialName: string; initialSpecies?: 'Dog' | 'Cat'; initialSex?: PetSex; initialBreed?: string; initialAge?: string; initialAvatar?: string; initialPreference?: string; initialCareProfile?: OwnerCareProfile; onBack: () => void; onSaved: (name: string) => void; onPetSaved?: (profile: { name: string; breed: string; species: 'Dog' | 'Cat'; sex: PetSex; age: string; avatar: string }) => void; onProfileSaved?: (profile: { name: string; avatar: string; preference: string; careProfile: OwnerCareProfile }) => void }) {
  const pet = kind === 'petDetails';
  const [name, setName] = useState(initialName);
  const [breed, setBreed] = useState(initialBreed);
  const [species, setSpecies] = useState(initialSpecies);
  const [sex, setSex] = useState<PetSex>(initialSex);
  const [age, setAge] = useState(initialAge);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [preference, setPreference] = useState(initialPreference === 'Manage your profile details here.' ? '' : initialPreference);
  const [careProfile, setCareProfile] = useState(() => normalizeOwnerCareProfile(initialCareProfile));
  const nameIsEmpty = name.trim().length === 0;
  const breedIsEmpty = breed.trim().length === 0;
  const numericAge = Number(age);
  const ageIsInvalid = age.trim().length === 0 || !Number.isInteger(numericAge) || numericAge < 0 || numericAge > 40;
  const saveDisabled = nameIsEmpty || (pet && (breedIsEmpty || ageIsInvalid));
  const [saved, setSaved] = useState(false);
  const [cropSource, setCropSource] = useState('');

  function save() {
    const nextName = name.trim();
    const nextBreed = breed.trim();
    const nextAge = age.trim();
    onSaved(nextName);
    if (pet) {
      onPetSaved?.({ name: nextName, breed: nextBreed, species, sex, age: nextAge, avatar: avatar || breedAvatar(species, nextBreed) });
      onBack();
    } else {
      onProfileSaved?.({ name: nextName, avatar, preference: preference.trim(), careProfile });
      onBack();
    }
  }

  function readAvatar(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const imageDataUrl = reader.result;
      const image = new Image();
      image.onload = () => {
        if (!pet) { setCropSource(imageDataUrl); return; }
        const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        setAvatar(canvas.toDataURL('image/jpeg', 0.82));
        setSaved(false);
      };
      image.src = imageDataUrl;
    };
    reader.readAsDataURL(file);
  }

  return (
    <section className={`settings-page ${pet ? 'pet-details-page' : 'owner-profile-page'}`}>
      <header className="settings-header">
        <button className="back-button" aria-label={pet ? 'Back to Pets' : 'Back to You'} onClick={onBack}>←</button>
        <h1>{pet ? `${name || 'Luna'}’s details` : 'My profile'}</h1>
      </header>
      <p className="settings-eyebrow">{pet ? 'PET PROFILE' : 'MY SPACE'}</p>
      <section className="settings-summary profile-summary">
        <label className="profile-avatar-upload" aria-label={pet ? 'Upload pet photo' : 'Upload profile photo'}>
          {pet ? <img className="profile-edit-avatar pet-edit-avatar" src={avatar || breedAvatar(species, breed)} alt={name || 'Pet'} /> : <OwnerAvatar src={avatar} name={name} className="profile-edit-avatar" />}
          <span className="avatar-edit-badge" aria-hidden="true">✎</span>
          <input type="file" accept="image/*" aria-label={pet ? 'Choose pet photo' : 'Choose profile photo'} onChange={(event) => readAvatar(event.target.files?.[0])} />
        </label>
        <div className="profile-summary-copy">
        <strong>{pet ? name || 'Luna' : name || 'Emily'}</strong>
        <p>{pet ? `${species} · ${breed || 'Choose a breed'}` : 'A little about the person behind the care.'}</p>
        </div>
      </section>
      {cropSource && <AvatarCropDialog src={cropSource} onCancel={() => setCropSource('')} onSave={cropped => { setAvatar(cropped); setCropSource(''); setSaved(false); }} />}
      <div className={`settings-fields${pet ? '' : ' profile-settings-fields'}`}>
        {pet ? <label className="settings-field">
          <strong>Name</strong><input value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} aria-label="Pet name" />
        </label> : <>
          <section className="settings-field profile-edit-field">
            <strong>Display name</strong><div className="profile-field-control"><input maxLength={50} value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} aria-label="Your name" /></div>
          </section>
        </>}
        {pet ? <>
          <section className="pet-type-field"><strong>Pet type</strong><div className="pet-type-options">{(['Dog','Cat'] as const).map(type => <button type="button" key={type} aria-pressed={species === type} className={species === type ? 'selected' : ''} onClick={() => { setSpecies(type); setBreed('Mixed breed'); if (!avatar || avatar.includes('/assets/breeds/')) setAvatar(breedAvatar(type, 'Mixed breed')); }}>{type === 'Dog' ? '🐶 Dog' : '🐱 Cat'}</button>)}</div></section>
          <BreedPicker key={species} species={species} value={breed} onChange={next => { setBreed(next); if (!avatar || avatar.includes('/assets/breeds/')) setAvatar(breedAvatar(species, next)); }} />
          <div className="pet-details-pair"><label className={`settings-field${ageIsInvalid ? ' has-error' : ''}`}><strong>Age (years)</strong><input type="number" min="0" max="40" step="1" value={age} onChange={e => setAge(e.target.value)} aria-label="Pet age in years" aria-invalid={ageIsInvalid} />{ageIsInvalid && <small role="alert">Use 0–40 whole years.</small>}</label><label className="settings-field"><strong>Sex</strong><select value={sex} aria-label="Pet sex" onChange={e => setSex(normalizePetSex(e.target.value))}><option>Unknown</option><option>Female</option><option>Male</option></select></label></div>
          <button type="button" className="profile-link breed-avatar-action" onClick={() => setAvatar(breedAvatar(species, breed))}>Use breed illustration as photo</button>
        </> : <>
          <section className="owner-care-section"><div className="owner-section-heading"><span>♡</span><div><h2>Your care routine</h2><p>Optional details for your own care planning.</p></div></div>
          <label className="settings-field"><strong>Relationship to your pets</strong><select aria-label="Relationship to your pets" value={careProfile.relationship} onChange={e => setCareProfile({...careProfile, relationship: e.target.value})}><option value="">Choose a relationship</option>{['Pet parent', 'Family member', 'Friend', 'Pet sitter', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="settings-field"><strong>Usual availability</strong><input maxLength={160} placeholder="e.g. Weekday evenings and weekends" aria-label="Usual availability" value={careProfile.routine} onChange={e => setCareProfile({...careProfile, routine: e.target.value})} /></label>
          <fieldset className="owner-task-field"><legend>I usually help with</legend><div className="owner-task-options">{['Meals', 'Walks', 'Play', 'Grooming', 'Health care', 'Keeping company'].map(task => <button type="button" key={task} aria-pressed={careProfile.tasks.includes(task)} onClick={() => setCareProfile({...careProfile, tasks: careProfile.tasks.includes(task) ? careProfile.tasks.filter(item => item !== task) : [...careProfile.tasks, task]})}>{careProfile.tasks.includes(task) ? '✓ ' : '+ '}{task}</button>)}</div></fieldset>
          <label className="settings-field owner-notes-field"><strong>Care notes & preferences</strong><textarea maxLength={500} rows={3} placeholder="e.g. I handle the evening walk; Mum usually gives breakfast." value={preference} onChange={e => setPreference(e.target.value)} aria-label="Care notes and preferences" /><small>{preference.length}/500</small></label>
          </section><p className="owner-profile-hint">These details stay in your profile. They don’t change your permissions in a care space.</p>
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
            <span className="care-person-copy"><strong>{memberName}</strong><small>{careIdentityLabel(member.email ?? (member.id === primaryMemberId ? ownerEmail : linkedAccount?.email))}</small><span>{member.id === primaryMemberId ? 'Primary caregiver · Manages the profile' : (member.access ?? 'editor') === 'viewer' ? 'View shared records' : `${member.role} · Can add observations`}{member.role === 'Temporary caregiver' && member.expiresAt ? ` · Until ${member.expiresAt}` : ''}</span></span>
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
            <div className="group-settings-identity"><strong>{member.id === primaryMemberId ? ownerName : member.name}</strong><small>{careIdentityLabel(member.email ?? (member.id === primaryMemberId ? ownerEmail : undefined))}</small></div>
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
    username?: string;
    requestEmailChange?: (email: string) => Promise<void>;
    verifyEmailCode?: (email: string, code: string) => Promise<void>;
    accounts: { id?: string; username: string; name: string; avatar?: string; loginEmail?: string }[]; switchAccount: (username: string, loginEmail?: string) => void; removeAccount: (username: string) => Promise<void>;
    listInvitations: () => Promise<CloudCareInvitation[]>;
    listGroups: () => Promise<CloudCareGroup[]>;
    sendInvitation: (input: { groupId: string; recipientId: string; role: 'Caregiver' | 'Viewer'; petId: string; petName: string; petBreed: string; petAge: string; petAvatar: string; petSpecies: 'Dog' | 'Cat'; groupName: string; workspace: Record<string, unknown> }) => Promise<string>;
    respondInvitation: (id: string, response: 'accepted' | 'declined') => Promise<CloudCareGroup | null>;
    cancelInvitation: (id: string) => Promise<void>;
    removeCareMember: (groupId: string, memberId: string) => Promise<void>;
    updateCareMember: (groupId: string, memberId: string, role: 'Caregiver' | 'Viewer') => Promise<void>;
    saveCareGroup: (groupId: string, pet: { name: string; breed: string; age: string; avatar: string; species: 'Dog' | 'Cat' }, groupName: string, workspace: Record<string, unknown>, expectedUpdatedAt: string) => Promise<string>;
  };
  guest?: boolean;
  onExit?: () => void;
};

function CloudEmailLink({ email, onSubmit, onVerify }: { email: string; onSubmit: (email: string) => Promise<void>; onVerify: (email: string, code: string) => Promise<void> }) {
  const [linkedEmail, setLinkedEmail] = useState(email.endsWith('@users.pawsona.invalid') ? '' : email);
  const isSynthetic = !linkedEmail;
  const [value, setValue] = useState(linkedEmail);
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const sendCode = async (address: string) => {
    setError(''); setNotice(''); setSaving(true);
    try { await onSubmit(address); setPendingEmail(address.trim().toLowerCase()); setNotice('A verification code was sent. Enter it below to finish associating this address.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send a verification code.'); }
    finally { setSaving(false); }
  };
  const verifyCode = async () => {
    setError(''); setNotice(''); setSaving(true);
    try { await onVerify(pendingEmail, code); setLinkedEmail(pendingEmail); setValue(pendingEmail); setPendingEmail(''); setCode(''); setNotice('Email verified and associated successfully.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not verify this code.'); }
    finally { setSaving(false); }
  };
  return <form className="settings-email-link" onSubmit={async event => {
    event.preventDefault();
    if (pendingEmail) await verifyCode(); else await sendCode(value);
  }}>
    <div><strong>Associated email</strong><small>{isSynthetic ? 'No email is associated yet.' : linkedEmail}</small></div>
    {!pendingEmail && <>
      <label><span>Email address</span><input type="email" autoComplete="email" value={value} onChange={event => setValue(event.target.value)} placeholder="you@example.com" required /></label>
      <p>We’ll send a verification code. After verification, use this email to sign in; your username stays the same in Pawsona.</p>
    </>}
    {pendingEmail && <label><span>6-digit verification code sent to {pendingEmail}</span><input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required /></label>}
    {notice && <p className="settings-email-notice" role="status">{notice}</p>}
    {error && <p className="account-form-error" role="alert">{error}</p>}
    {pendingEmail
      ? <div className="settings-email-actions"><button className="settings-email-submit" type="submit" disabled={saving || code.length !== 6}>{saving ? 'Verifying…' : 'Verify code'}</button><button className="settings-email-resend" type="button" disabled={saving} onClick={() => { void sendCode(pendingEmail); }}>Resend code</button></div>
      : <button className="settings-email-submit" type="submit" disabled={saving || !value.trim() || value.trim().toLowerCase() === linkedEmail.toLowerCase()}>{saving ? 'Sending…' : isSynthetic ? 'Associate email' : 'Change email'}</button>}
  </form>;
}

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
  const [dailyRhythmDayOffset, setDailyRhythmDayOffset] = useState(0);
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
  const [storyEditDateKey, setStoryEditDateKey] = useState<string | null>(null);
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
  const [selectedActivityMoment, setSelectedActivityMoment] = useState<StoryObservation | null>(null);
  const [editingContextId, setEditingContextId] = useState<string | null>(null);
  const [lastSavedContextId, setLastSavedContextId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [interpretation, setInterpretation] = useState<Interpretation>('normal');
  const [contextAttachments, setContextAttachments] = useState<ContextAttachment[]>([]);
  const [contextSaveError, setContextSaveError] = useState('');
  const [storySaveError, setStorySaveError] = useState('');
  const [savedStoryObservation, setSavedStoryObservation] = useState<StoryObservation | null>(null);
  const [devicePreferences, setDevicePreferences] = useState(readPreferences);
  const [preferencesError, setPreferencesError] = useState('');
  const [profileAction, setProfileAction] = useState<{ title: string; detail: string } | null>(null);
  const [careMembers, setCareMembers] = useState<CareMember[]>(() =>
    initialSharedWorkspace?.careMembers ?? readCareMembers() ?? [
    { id: 'emily', name: ownerName, role: 'Primary owner', detail: 'manages the profile' },
    { id: 'mom', name: 'Mom', role: 'Caregiver', detail: 'can add observations' },
    { id: 'dad', name: 'Dad', role: 'Caregiver', detail: 'can add observations' },
  ]);
  const [careTasks, setCareTasks] = useState<CareTask[]>(() => initialSharedWorkspace?.careTasks ?? initialWorkspace?.careTasks ?? []);
  const [insightReviews, setInsightReviews] = useState<ActivityInsightReview[]>(() => initialSharedWorkspace?.insightReviews ?? initialWorkspace?.insightReviews ?? []);
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
  const [sharedSaveTick, setSharedSaveTick] = useState(0);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showPetSwitcher, setShowPetSwitcher] = useState(false);
  const [petSwitcherStartsAdding, setPetSwitcherStartsAdding] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [pendingDeviceAccountRemoval, setPendingDeviceAccountRemoval] = useState<{ username: string; name: string } | null>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const returnScrollPosition = useRef<number | null>(null);
  const askEndRef = useRef<HTMLDivElement>(null);
  const navigationHistory = useRef<View[]>([]);
  const pendingFavoriteMomentRef = useRef<{ petId: string; momentId: string } | null>(null);
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
  const displayedCareMembers = careMembers.map((member) => {
    const sessionAccount = prototypeSession.accounts.find((account) => account.id === member.id
      || (!!member.email && account.email.toLowerCase() === member.email.toLowerCase()));
    const cachedAccount = cloud?.accounts.find((account) => account.id === member.id)
      ?? cloud?.accounts.find((account) => account.username.toLowerCase() === member.name.toLowerCase());
    return { ...member, name: cachedAccount?.name || sessionAccount?.name || member.name,
      // The care-group response is the source of truth for a member's current
      // avatar. Remembered device accounts can still contain the previous image.
      avatar: sessionAccount?.avatar || member.avatar || cachedAccount?.avatar || '' };
  });
  const groupOwnerMember = displayedCareMembers.find((member) => member.id === groupOwnerAccountId);
  const primaryCaregiverAvatar = !activePetRecord?.sharedGroupId || groupOwnerAccountId === activeAccount?.id
    ? ownerAvatar
    : groupOwnerAccount?.avatar || groupOwnerMember?.avatar || '';
  const groupOwnerPet = activePetRecord?.sharedGroupId ? groupOwnerAccount?.pets.find((pet) => pet.sharedGroupId === activePetRecord.sharedGroupId) : activePetRecord;
  const activeGroupName = groupOwnerPet?.workspace.groupName ?? activePetRecord?.workspace.groupName ?? 'Care circle';
  const primaryMemberId = activePetRecord?.sharedGroupId ? groupOwnerAccountId ?? '' : 'emily';
  const petSpecies = activePetRecord?.species === 'Cat' ? 'Cat' : 'Dog';
  const petSex = normalizePetSex(activePetRecord?.sex);
  const sharedSync = useRef({ id: '', baseline: '', updatedAt: '', busy: false, failed: false });
  const refreshSharedRef = useRef<() => Promise<void>>(async () => {});


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
      careTasks,
      insightReviews,
      careEvent: activePetRecord?.workspace.careEvent ?? (cloud ? null : readCareEvent()),
      mediaSources,
      patterns: typicalPatterns,
      lifeEvents: lifeCareEvents,
      scenarioDate: activePetRecord?.workspace.scenarioDate,
      sharedUpdatedAt: activePetRecord?.workspace.sharedUpdatedAt,
      petSex,
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

  function persistSharedWorkspacePatch(patch: Partial<Pick<PetWorkspace, 'mediaSources' | 'patterns' | 'lifeEvents' | 'momentEngagement' | 'sunnyVaccinationSeeded' | 'careTasks' | 'insightReviews'>>): boolean {
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

  function saveObservationsToCurrentGroup(observations: StoryObservation[], replacedId?: string, visibilityOverride?: string[] | null): boolean {
    if (!activeAccount || !activePetRecord) return false;
    const captured = captureCurrentSpace(prototypeSession);
    const groupId = activePetRecord.sharedGroupId;
    const sharedPublic = groupId
      ? captured.accounts.flatMap((account) => account.pets.filter((pet) => pet.sharedGroupId === groupId).flatMap((pet) => pet.workspace.observations.filter((entry) => !entry.privateRecord && entry.id !== replacedId)))
      : observations.filter((entry) => !entry.privateRecord && entry.id !== replacedId);
    const replacement = replacedId ? observations.find((entry) => entry.id === replacedId && !entry.privateRecord) : undefined;
    // Include the updated working set: otherwise new records were silently
    // dropped whenever this pet's Story lived in a shared care group.
    const sharedObservations = mergeSharedStoryObservations(sharedPublic, observations, replacedId);
    const nextSession: PrototypeSession = {
      ...captured,
      accounts: captured.accounts.map((account) => ({
        ...account,
        pets: account.pets.map((pet) => {
          const belongsToActivePet = account.id === activeAccount.id && pet.id === activePetRecord.id;
          const belongsToSharedGroup = !!groupId && pet.sharedGroupId === groupId;
          if (!belongsToActivePet && !belongsToSharedGroup) return pet;
          const privateObservations = belongsToActivePet ? observations.filter((entry) => entry.privateRecord) : pet.workspace.observations.filter((entry) => entry.privateRecord);
          const visibility = visibilityOverride !== undefined
            ? visibilityOverride
            : pet.workspace.visibility && replacedId
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

  useEffect(() => {
    if (!activeAccount || !activePetRecord || activePetRecord.isEmptyProfile || activePetRecord.workspace.scenarioDate) return;
    // Only the synthetic Golden Retriever demo profile owns this rolling plan;
    // invited caregivers read the same shared records but must not seed copies.
    if (activePetRecord.sharedGroupId && groupOwnerAccountId !== activeAccount.id) return;
    const isSyntheticSunny = isSyntheticSunnyProfile(activePetRecord);
    if (!isSyntheticSunny && !activePetRecord.hasDemoMoments && !storyObservations.some((observation) => observation.synthetic === true)) return;
    const scheduled = buildRollingStorySimulation(storyObservations, new Date(), activePetRecord.id, activeAccount.id, ownerName);
    // Older versions could save synthetic records without simulationKey and
    // leave Story visibility pointing only at legacy IDs. Reconcile both the
    // new schedule and any already-saved synthetic entries so the calendar and
    // timeline cannot silently hide a valid plan.
    const allObservations = [...storyObservations, ...scheduled];
    const nextVisibility = Array.isArray(includedStoryMoments)
      ? [...new Set([...includedStoryMoments, ...allObservations.filter((entry) => entry.synthetic).map((entry) => entry.id)])]
      : undefined;
    const visibilityNeedsRepair = !!nextVisibility && nextVisibility.length !== includedStoryMoments?.length;
    if (scheduled.length || visibilityNeedsRepair) {
      if (saveObservationsToCurrentGroup(allObservations, undefined, nextVisibility) && nextVisibility) setIncludedStoryMoments(nextVisibility);
    }
  }, [activeAccount?.id, activePetRecord?.id, activePetRecord?.sharedGroupId, groupOwnerAccountId, includedStoryMoments, ownerName, storyObservations]);

  useEffect(() => {
    if (!activeAccount || !activePetRecord || !isSyntheticSunnyProfile(activePetRecord) || activePetRecord.workspace.sunnyVaccinationSeeded) return;
    if (activePetRecord.sharedGroupId && groupOwnerAccountId !== activeAccount.id) return;
    const seed: LifeCareEvent = {"id": "sunny-demo-vaccination-20261008-v1", "category": "health", "type": "Vaccination", "title": "Core combination vaccine booster (demo)", "startDate": "2026-10-08", "ongoing": false, "note": "Synthetic demonstration record for Sunny, not proof of vaccination. Example adult booster for canine distemper, adenovirus and parvovirus (DAP). Actual product, vaccination history and next due date must be confirmed from the veterinary record.", "useForAsk": true, "savedAt": "2026-10-08T03:00:00.000Z", "recordDetails": {"vaccine": "DAP — distemper, adenovirus, parvovirus (demo)", "nextDue": "Confirm from veterinary record", "clinic": "Demo veterinary clinic — fictional"}};
    const exists = lifeCareEvents.some(record => record.id === seed.id);
    if (!persistSharedWorkspacePatch({ lifeEvents: exists ? lifeCareEvents : [seed, ...lifeCareEvents], sunnyVaccinationSeeded: true })) return;
    if (!exists) setLifeCareEvents([seed, ...lifeCareEvents]);
  }, [activeAccount?.id, activePetRecord?.id, activePetRecord?.workspace.sunnyVaccinationSeeded, groupOwnerAccountId, lifeCareEvents]);

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
    setCareTasks(sharedWorkspace.careTasks ?? []);
    setInsightReviews(sharedWorkspace.insightReviews ?? []);
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
    if (sharedWritePending()) { setAccountActionError('Wait for shared changes to sync before switching pets.'); return; }
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
    if (sharedWritePending()) return 'Wait for shared changes to sync before adding another pet.';
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
    if (sharedWritePending()) { setAccountActionError('Shared changes are not synced yet. Keep this page open and resolve any sync error first.'); return; }
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
    if (sharedWritePending()) { setAccountActionError('Wait for shared changes to sync before removing a remembered account.'); return; }
    try {
      await cloud.removeAccount(pendingDeviceAccountRemoval.username);
      setPendingDeviceAccountRemoval(null);
    } catch (error) {
      setAccountActionError(error instanceof Error ? error.message : 'Could not remove this account from the device.');
      setPendingDeviceAccountRemoval(null);
    }
  }

  function updateActivePetRecord(profile: { name: string; breed: string; species: 'Dog' | 'Cat'; sex: PetSex; age: string; avatar: string }) {
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

  function updateActiveAccountRecord(profile: { name: string; avatar: string; preference: string; careProfile: OwnerCareProfile }) {
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
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not send this invitation. Please try again.';
        if (message.toLowerCase().includes('already a group member')) {
          try {
            const groups = await cloud.listGroups();
            const currentGroup = groups.find((group) => group.groupId === groupId);
            if (currentGroup) {
              setCareMembers(careMembersFromCloudGroup(currentGroup));
            } else {
              setAccountActionError('The account is recorded as a member, but this group was not returned by the account’s group list. Reload the page and check that the active account is the group owner.');
            }
          } catch {
            setAccountActionError('The account is already a member, but the member list could not be refreshed. Check your connection and reload the page.');
          }
        }
        return message;
      }
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
          name: group.petName, breed: group.petBreed, species: group.petSpecies, sex: group.petSex, age: group.petAge, avatar: group.petAvatar, hasDemoMoments: false, isEmptyProfile: false, workspace };
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
    if (view === 'today' && returnScrollPosition.current !== null) {
      const top = returnScrollPosition.current;
      returnScrollPosition.current = null;
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top }));
      return;
    }
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
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: preferredScrollBehavior() });
    }
  }, [askMessages, view, askBusy, askPending]);

  const selectedMoment = resolveMoment(selectedMomentId, storyObservations);
  const selectedMomentContexts = savedContexts.filter((context) => context.momentId === selectedMomentId);
  const lastSavedContext = savedContexts.find((context) => context.id === lastSavedContextId) ?? null;

  useEffect(() => {
    const pending = pendingFavoriteMomentRef.current;
    if (!pending || pending.petId !== activePetRecord?.id) return;
    pendingFavoriteMomentRef.current = null;
    setSelectedMomentId(pending.momentId);
    navigateTo('momentDetail');
  }, [activePetRecord?.id]);

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

  function openFavoriteMoment(petId: string, momentId: string) {
    if (petId === activePetRecord?.id) {
      openMomentDetail(momentId);
      return;
    }
    if (sharedWritePending() || !activeAccount?.pets.some((pet) => pet.id === petId)) return;
    pendingFavoriteMomentRef.current = { petId, momentId };
    const error = applyAccountSpace(captureCurrentSpace(prototypeSession), activeAccount.id, petId);
    if (error) {
      pendingFavoriteMomentRef.current = null;
      setAccountActionError(error);
    }
  }

  function removeFavoriteMoments(petId: string, momentIds: string[]) {
    if (!activeAccount || !momentIds.length) return;
    const targetPet = activeAccount.pets.find((pet) => pet.id === petId);
    if (!targetPet) return;
    const captured = captureCurrentSpace(prototypeSession);
    const groupId = targetPet.sharedGroupId;
    const ids = new Set(momentIds);
    const removeFromEngagement = (engagement: MomentEngagementById): MomentEngagementById => Object.fromEntries(
      Object.entries(engagement).map(([id, value]) => [id, ids.has(id) ? { ...value, favorites: value.favorites.filter((accountId) => accountId !== activeAccount.id) } : value]),
    );
    const nextSession: PrototypeSession = {
      ...captured,
      accounts: captured.accounts.map((account) => ({
        ...account,
        pets: account.pets.map((pet) => {
          const isTarget = account.id === activeAccount.id && pet.id === petId;
          const isSharedCopy = Boolean(groupId && pet.sharedGroupId === groupId);
          return isTarget || isSharedCopy ? { ...pet, workspace: { ...pet.workspace, momentEngagement: removeFromEngagement(pet.workspace.momentEngagement ?? {}) } } : pet;
        }),
      })),
    };
    try {
      persistPrototypeSession(nextSession);
    } catch {
      setAccountActionError('Favorites could not be updated on this device.');
      return;
    }
    setPrototypeSession(nextSession);
    if (petId === activePetRecord?.id) {
      const updated = nextSession.accounts.find((account) => account.id === activeAccount.id)?.pets.find((pet) => pet.id === petId)?.workspace.momentEngagement ?? {};
      setMomentEngagement(updated);
    }
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
    setSavedStoryObservation(null);
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
    // Cancel discards this editing session; existing saved records/drafts stay intact.
    const returnView: View = view === 'addSaved' && draftPrivateRecord ? 'today' : 'story';
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
      sourceKind: existing?.sourceKind ?? 'caregiver',
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
    setSavedStoryObservation(observation);
    setEditingStoryObservationId(observation.id);
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
      const answer = await requestAskAI(petId, [...askMessages, userMessage], controller.signal, devicePreferences.includeHistory);
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
  const canInteractWithGroupContext = canContributeToSharedPet;
  const canManageLongTermCare = isPrimaryCaregiver || !activePetRecord?.sharedGroupId || (currentCareMember?.access === 'editor' && currentCareMember.role !== 'Temporary caregiver');
  function sharedSnapshot() {
    const workspace = workspaceFromState();
    const observations = workspace.observations.filter(o => !o.privateRecord);
    const ids = new Set(observations.map(o => o.id));
    return { ...workspace, observations, lifeEvents: workspace.lifeEvents.filter(e => e.useForAsk), contexts: workspace.contexts.filter(c => ids.has(c.momentId)), askMessages: [], drafts: [], careMembers: [], askOwnerAccountId: undefined, sharedUpdatedAt: undefined };
  }
  const stableShared = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
  const sharedPayload = sharedSnapshot();
  const sharedSerialized = stableShared({ workspace: sharedPayload, petName, petBreed, petAge, petAvatar, petSpecies });
  const liveSharedSerialized = useRef(sharedSerialized); liveSharedSerialized.current = sharedSerialized;
  const sharedId = activePetRecord?.sharedGroupId ?? '';
  if (sharedSync.current.id !== sharedId) sharedSync.current = { id: sharedId, baseline: sharedSerialized, updatedAt: activePetRecord?.workspace.sharedUpdatedAt ?? '', busy: false, failed: false };
  refreshSharedRef.current = async () => {
    if (!cloud || !sharedId) return;
    const sync = sharedSync.current;
    if (sync.busy || sync.failed || sharedSerialized !== sync.baseline) return;
    try {
      const [groups, invites] = await Promise.all([cloud.listGroups(), cloud.listInvitations()]);
      if (sharedSync.current !== sync || sync.busy || sync.failed || liveSharedSerialized.current !== sync.baseline) return;
      const group = groups.find(g => g.groupId === sharedId);
      setCareInvitations(invites.map(displayCareInvitation));
      if (!group) { setAccountActionError('Care-group access is no longer available. Reload to update your pets.'); return; }
      setCareMembers(careMembersFromCloudGroup(group));
      if (group.updatedAt === sync.updatedAt) return;
      const remote = normalizeWorkspace({ ...group.workspace, groupName: group.groupName }, ownerName, false);
      const nextWorkspace = { ...remote, petSex: group.petSex, lifeEvents: [...lifeCareEvents.filter(e => !e.useForAsk), ...remote.lifeEvents.filter(e => e.useForAsk)], observations: [...storyObservations.filter(o => o.privateRecord), ...remote.observations.filter(o => !o.privateRecord)], askMessages, askOwnerAccountId: activeAccount!.id, drafts: storyDrafts, sharedUpdatedAt: group.updatedAt };
      sync.updatedAt = group.updatedAt;
      sync.baseline = stableShared({ workspace: { ...nextWorkspace, lifeEvents: nextWorkspace.lifeEvents.filter(e => e.useForAsk), observations: nextWorkspace.observations.filter(o => !o.privateRecord), contexts: nextWorkspace.contexts, askMessages: [], drafts: [], careMembers: [], askOwnerAccountId: undefined, sharedUpdatedAt: undefined }, petName: group.petName, petBreed: group.petBreed, petAge: group.petAge, petAvatar: group.petAvatar, petSpecies: group.petSpecies });
      setPetName(group.petName); setPetBreed(group.petBreed); setPetAge(group.petAge); setPetAvatar(group.petAvatar);
      setStoryObservations(nextWorkspace.observations); setSavedContexts(remote.contexts); setTypicalPatterns(remote.patterns); setLifeCareEvents(nextWorkspace.lifeEvents); setMediaSources(remote.mediaSources); setMomentEngagement(remote.momentEngagement); setIncludedStoryMoments(remote.visibility); setCareTasks(remote.careTasks ?? []); setInsightReviews(remote.insightReviews ?? []);
      setPrototypeSession(session => ({ ...session, accounts: session.accounts.map(a => a.id !== activeAccount!.id ? a : { ...a, pets: a.pets.map(p => p.id !== activePetRecord!.id ? p : { ...p, name: group.petName, breed: group.petBreed, species: group.petSpecies, sex: group.petSex, age: group.petAge, avatar: group.petAvatar, workspace: nextWorkspace }) }) }));
    } catch (cause) { setAccountActionError(cause instanceof Error ? cause.message : 'Shared updates are temporarily unavailable.'); }
  };
  useEffect(() => {
    if (!sharedId) return;
    void refreshSharedRef.current();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshSharedRef.current(); }, 5000);
    return () => clearInterval(timer);
  }, [sharedId]);
  useEffect(() => {
    const sync = sharedSync.current;
    if (!cloud || !sharedId || !canContributeToSharedPet || sync.busy || sync.failed || sharedSerialized === sync.baseline) return;
    const timer = window.setTimeout(async () => {
      if (sync.busy || sync.failed || sharedSync.current !== sync) return;
      sync.busy = true;
      try {
        if (!sync.updatedAt) { const groups = await cloud.listGroups(); sync.updatedAt = groups.find(g => g.groupId === sharedId)?.updatedAt ?? ''; }
        if (!sync.updatedAt) throw new Error('Reload before editing this shared pet.');
        sync.updatedAt = await cloud.saveCareGroup(sharedId, { name: petName, breed: petBreed, age: petAge, avatar: petAvatar, species: petSpecies }, activeGroupName, sharedPayload, sync.updatedAt);
        sync.baseline = sharedSerialized;
      } catch (cause) { sync.failed = true; setAccountActionError(cause instanceof Error ? cause.message : 'Shared changes could not be synced. Your edits remain on this device.'); }
      finally { sync.busy = false; setSharedSaveTick(t => t + 1); }
    }, 700);
    return () => clearTimeout(timer);
  }, [cloud, sharedId, sharedSerialized, canContributeToSharedPet, sharedSaveTick]);

  function sharedWritePending() { return Boolean(cloud && sharedId && (sharedSync.current.busy || sharedSync.current.failed || sharedSerialized !== sharedSync.current.baseline)); }
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (sharedSync.current.id && (sharedSync.current.busy || sharedSync.current.failed || liveSharedSerialized.current !== sharedSync.current.baseline)) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, []);
  const orderedCareMembers = [...displayedCareMembers].sort((left, right) => {
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
    setActiveStoryDraftId(null);
    setEditingStoryObservationId(existing?.id ?? null);
    setDraftMoments(existing?.momentIds ?? (existing ? [] : [row.id]));
    setDraftUploadedMedia(existing?.mediaType ? { name: 'Uploaded media', type: existing.mediaType, url: existing.image } : null);
    setDraftObservation(existing?.note ?? row.note ?? '');
    setDraftObservationTitle(existing?.title ?? row.title);
    setDraftMomentAt(toLocalDateTimeInput(existing ? new Date(existing.savedAt) : new Date()));
    setDraftRelatedPhotos(existing?.relatedPhotos ?? []);
    setDraftObservationContext(existing?.context ?? '');
    setDraftPrivateRecord(existing?.privateRecord ?? false);
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
  function saveCareTasks(next: CareTask[]) {
    if (!canContributeToSharedPet || !persistSharedWorkspacePatch({ careTasks: next })) return false;
    setCareTasks(next);
    return true;
  }
  function reviewActivityInsight(insight: RankedDailyActivityInsight, status: ActivityInsightReviewStatus) {
    if (!canContributeToSharedPet || !activeAccount) return;
    const id = activityInsightReviewId(insight);
    const review: ActivityInsightReview = {
      id,
      activityKey: insight.activityKey,
      metricKey: insight.key,
      dateKey: id.slice(0, 10),
      status,
      reviewerId: activeAccount.id,
      reviewerName: activeAccount.name,
      reviewedAt: new Date().toISOString(),
    };
    const next = [...insightReviews.filter(entry => entry.id !== id), review];
    if (!persistSharedWorkspacePatch({ insightReviews: next })) {
      setAccountActionError('This activity review could not be saved on this device.');
      return;
    }
    setInsightReviews(next);
    setAccountActionError('');
  }
  function toggleCareTask(task: CareTask) {
    const currentAccountId = activeAccount?.id;
    if (!canContributeToSharedPet || !currentAccountId || (!isPrimaryCaregiver && task.assignedTo && task.assignedTo !== currentAccountId)) return;
    const changedAt = new Date().toISOString();
    const changed: CareTask = task.status === 'done'
      ? { ...task, status: 'open', completedBy: undefined, completedAt: undefined }
      : { ...task, status: 'done', completedBy: currentAccountId, completedAt: changedAt };
    const targetId = task.assignedTo && task.assignedTo !== currentAccountId ? task.assignedTo : task.assignedBy && task.assignedBy !== currentAccountId ? task.assignedBy : undefined;
    const nextTask = appendCareTaskEvent(changed, { type: task.status === 'done' ? 'reopened' : 'completed', actorId: currentAccountId, targetId, createdAt: changedAt });
    const exists = careTasks.some(entry => entry.id === task.id);
    saveCareTasks(exists ? careTasks.map(entry => entry.id === task.id ? nextTask : entry) : [nextTask, ...careTasks]);
  }
  function skipCareTask(task: CareTask) {
    const currentAccountId = activeAccount?.id;
    if (!canContributeToSharedPet || !currentAccountId || !task.sourceObservationId) return;
    const changedAt = new Date().toISOString();
    const changed: CareTask = task.status === 'skipped'
      ? { ...task, status: 'open', skippedAt: undefined, skippedBy: undefined }
      : { ...task, status: 'skipped', skippedAt: changedAt, skippedBy: currentAccountId, completedAt: undefined, completedBy: undefined, autoCompleted: undefined };
    const targetId = task.assignedTo && task.assignedTo !== currentAccountId ? task.assignedTo : task.assignedBy && task.assignedBy !== currentAccountId ? task.assignedBy : undefined;
    const nextTask = appendCareTaskEvent(changed, { type: task.status === 'skipped' ? 'restored' : 'skipped', actorId: currentAccountId, targetId, createdAt: changedAt });
    const exists = careTasks.some(entry => entry.id === task.id);
    saveCareTasks(exists ? careTasks.map(entry => entry.id === task.id ? nextTask : entry) : [nextTask, ...careTasks]);
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
      <div className={`phone ${devicePreferences.largeText ? 'large-reading-text' : ''} ${devicePreferences.reducedMotion ? 'reduce-motion' : ''}`}>
        {notice}
        {sharedId && sharedSync.current.failed && sharedWritePending() && <p className="shared-sync-pending" role="status">Shared sync paused. Your local edits are kept; resolve the sync error before leaving.</p>}
        <main ref={scrollRef} className={`screen-scroll ${view === 'today' ? 'home-screen' : ''} ${view.startsWith('add') ? 'add-flow-scroll' : ''}`}>
          <div className={`screen-content ${mainView ? 'main-content' : 'detail-content'} ${view === 'ask' ? 'ask-content' : ''} ${view.startsWith('add') ? 'add-flow-content' : ''}`}>
            {view === 'today' && <TodayPage hasDemoMoments={activePetRecord.hasDemoMoments} onActivitySummary={moment => { returnScrollPosition.current = scrollRef.current?.scrollTop ?? 0; setSelectedActivityMoment(moment); navigateTo('activitySummary'); }} onOpenInsights={() => navigateTo('activityInsights')} onCareTasks={() => navigateTo('careTasks')} onToggleCareTask={toggleCareTask} onSkipCareTask={skipCareTask} careTasks={careTasks} careMembers={displayedCareMembers} insightReviews={insightReviews} currentUserId={activeAccount.id} canAct={canContributeToSharedPet} isPrimary={isPrimaryCaregiver} observations={storyObservations} includedMoments={includedStoryMoments} petName={petName} petAvatar={petAvatar} patterns={typicalPatterns} dayOffset={dailyRhythmDayOffset} onDayOffsetChange={setDailyRhythmDayOffset} scenarioDate={activePetRecord.workspace.scenarioDate} noPetYet={activePetRecord.isEmptyProfile ?? false} onAddPet={openAddPetForm} onStory={() => navigateTo('story')} onMoment={openMomentDetail} onPetsNavigate={() => navigateTo('pets')} onPatterns={openPatternKnowledge} />}
            {view === 'careTasks' && <CareTasksPage tasks={careTasks} patterns={typicalPatterns} observations={storyObservations} members={displayedCareMembers} currentUserId={activeAccount.id} currentUserName={activeAccount.name} petName={petName} dayOffset={dailyRhythmDayOffset} isPrimary={isPrimaryCaregiver} canAct={canContributeToSharedPet} onBack={() => goBack('today')} onPatterns={() => openPatternKnowledge()} onToggleTask={toggleCareTask} onSkipTask={skipCareTask} onSave={saveCareTasks} />}
            {view === 'activityInsights' && <ActivityInsightsPage records={visibleStoryObservations(storyObservations.filter(observation => !isObservationSkippedForToday(observation, careTasks)), includedStoryMoments)} petName={petName} reviews={insightReviews} canReview={canContributeToSharedPet} onReview={reviewActivityInsight} onBack={() => goBack('today')} onActivitySummary={moment => { setSelectedActivityMoment(moment); navigateTo('activitySummary'); }} />}

            {view === 'activitySummary' && selectedActivityMoment && <PetActivitySummaryPage moment={selectedActivityMoment} moments={visibleStoryObservations(storyObservations, includedStoryMoments)} petId={activePetRecord.id} petName={petName} petAvatar={petAvatar} onBack={() => goBack('today')} />}
            {view === 'story' && <StoryPage onMoment={openMomentDetail} onEditStory={(dateKey) => { setStoryEditDateKey(dateKey ?? null); navigateTo('storyEdit'); }} onEditMoment={(item) => editStoryRow({ id: item.id, image: item.image, mediaType: item.mediaType, title: item.title, meta: `${item.time} · story moment`, note: item.note })} onDeleteMoment={deleteStoryMoment} onPetsNavigate={() => navigateTo('pets')} onAddPet={openAddPetForm} petName={petName} petAvatar={petAvatar} ownerName={ownerName} accounts={prototypeSession.accounts} contexts={savedContexts} observations={storyObservations} careTasks={careTasks} includedMoments={includedStoryMoments} hasDemoMoments={activePetRecord.hasDemoMoments} noPetYet={activePetRecord.isEmptyProfile ?? false} canEdit={canContributeToSharedPet} />}
            {view === 'storyEdit' && <StoryEditPage observations={storyObservations} includedMoments={includedStoryMoments} petName={petName} hasDemoMoments={activePetRecord.hasDemoMoments} dateKey={storyEditDateKey} onBack={() => goBack('story')} onEdit={editStoryRow} onDelete={deleteStoryRow} onSave={(ids) => { if (!persistWorkspacePatch({ visibility: ids })) return; setIncludedStoryMoments(ids); if (!cloud) try {
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
            {view === 'addSaved' && <StoryAddPage savedObservation={savedStoryObservation} step="saved" saveError={storySaveError} onBack={() => goBack('addPreview')} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} uploadedMedia={draftUploadedMedia} setUploadedMedia={setDraftUploadedMedia} title={draftObservationTitle} setTitle={setDraftObservationTitle} momentAt={draftMomentAt} setMomentAt={setDraftMomentAt} relatedPhotos={draftRelatedPhotos} setRelatedPhotos={setDraftRelatedPhotos} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} petName={petName} ownerName={ownerName} hasDemoMoments={activePetRecord.hasDemoMoments} onSave={saveStoryObservation} onEdit={() => navigateTo('addCompose')} />}
            {view === 'momentDetail' && <MomentDetailPage moment={selectedMoment} contexts={selectedMomentContexts} accounts={prototypeSession.accounts} careMembers={displayedCareMembers} ownerName={ownerName} ownerAvatar={ownerAvatar} currentAccountId={activeAccount.id} groupOwnerAccountId={activePetRecord.sharedGroupId ? groupOwnerAccountId : undefined} petName={petName} canContribute={canContributeToSharedPet} canInteract={canInteractWithGroupContext} engagement={momentEngagement[selectedMoment.id] ?? { likes: [], favorites: [] }} onToggleMomentLike={() => toggleMomentEngagement(selectedMoment.id, 'likes')} onToggleMomentFavorite={() => toggleMomentEngagement(selectedMoment.id, 'favorites')} onBack={() => goBack('story')} onAddContext={() => startContextForMoment(selectedMoment.id)} onEditContext={(context) => startContextForMoment(selectedMoment.id, context)} onDeleteContext={deleteOwnerContext} onToggleLike={toggleContextLike} onAddComment={addContextComment} onEditOwnComment={editOwnContextComment} onDeleteOwnComment={deleteOwnContextComment} />}
            {view === 'overview' && <OverviewPage onBack={() => goBack('today')} onClip={() => { setSelectedMomentId('window'); navigateTo('clip'); }} saved={savedContexts.find((context) => context.momentId === 'window') ?? null} onSaved={() => openMomentDetail('window')} petName={petName}/>}
            {view === 'clip' && <ClipPage onBack={() => goBack('overview')} onContext={() => startContextForMoment('window')} petName={petName} ownerName={ownerName} canContribute={canContributeToSharedPet} />}
            {view === 'context' && <ContextPage moment={selectedMoment} petName={petName} note={note} setNote={setNote} interpretation={interpretation} setInterpretation={setInterpretation} attachments={contextAttachments} setAttachments={setContextAttachments} onBack={() => goBack('momentDetail')} onReview={() => navigateTo('confirm')} />}
            {view === 'confirm' && <ConfirmPage moment={selectedMoment} note={note} interpretation={interpretation} attachments={contextAttachments} petName={petName} ownerName={ownerName} ownerRole={ownerRole} saveError={contextSaveError} onBack={() => goBack('context')} onSave={saveContext} />}
            {view === 'saved' && lastSavedContext && <SavedPage saved={lastSavedContext} onBack={() => goBack('confirm')} onReturnStory={() => navigateTo('story')} onUndo={() => undoContext(lastSavedContext.id)} onEvidence={() => openMomentDetail(lastSavedContext.momentId)} onEdit={() => startContextForMoment(lastSavedContext.momentId, lastSavedContext)} petName={petName} ownerName={ownerName} />}
            {view === 'undone' && <UndonePage onBack={() => goBack('saved')} onReturnToday={() => navigateTo('today')} onReview={() => navigateTo('overview')} petName={petName} />}
            {view === 'ask' && <AskPage petSpecies={petSpecies} onPetsNavigate={() => navigateTo('pets')} petName={petName} petAvatar={petAvatar} messages={askMessages} messageEndRef={askEndRef} noPetYet={activePetRecord.isEmptyProfile ?? false} busy={askBusy} pending={askPending} live={Boolean(cloud)} />}
            {(view === 'pets' || view === 'you') && <SimplePage kind={view} petName={petName} petAvatar={petAvatar} petBreed={petBreed} petAge={petAge} ownerName={ownerName} ownerRole={ownerRole} ownerAvatar={ownerAvatar} ownerPreference={ownerPreference} pets={activeAccount.pets} activePetId={activePetRecord.id} accounts={prototypeSession.accounts} currentAccountId={activeAccount.id} onOpenFavorites={() => navigateTo('favorites')} onPetsNavigate={() => navigateTo('pets')} onSettingsNavigate={() => navigateTo('settings')} onPetEdit={() => navigateTo('petDetails')} onProfileEdit={() => navigateTo('profile')} onPetSwitcher={activePetRecord.isEmptyProfile ? openAddPetForm : () => setShowPetSwitcher(true)} careMembers={orderedCareMembers} primaryMemberId={primaryMemberId} onMemberClick={openCareMember} onCareMembers={() => navigateTo('careMembers')} patterns={typicalPatterns} lifeEvents={lifeCareEvents} mediaSources={mediaSources} onPatternHistory={() => openPatternKnowledge()} onPattern={(id) => openPatternKnowledge(id)} onLifeCare={openLifeCare} onConnectedMedia={openConnectedMedia} invitations={view === 'you' ? receivedCareInvitations : []} onAcceptInvitation={acceptCareInvitation} onDeclineInvitation={(id) => updateInvitationStatus(id, 'declined')} careOwnerName={groupOwnerAccount?.name ?? groupOwnerMember?.name ?? ownerName} careOwnerAvatar={primaryCaregiverAvatar} careOwnerRole="Primary caregiver" groupName={activeGroupName} canManageCareGroup={isPrimaryCaregiver} canEditPetDetails={isPrimaryCaregiver} canAddLifeCare={canManageLongTermCare} canManageConnectedMedia={canManageLongTermCare} noPetYet={activePetRecord.isEmptyProfile ?? false} />}
            {view === 'favorites' && <FavoritesPage pets={activeAccount.pets} initialPetId={activePetRecord.id} currentAccountId={activeAccount.id} onBack={() => goBack('you')} onOpenMoment={openFavoriteMoment} onRemoveFavorites={removeFavoriteMoments} />}
            {view === 'connectedMedia' && <ConnectedMediaPage petName={petName} sources={mediaSources} initialSourceId={selectedMediaSourceId} onBack={() => goBack('you')} onUpdate={saveMediaSource} onDelete={deleteMediaSource} />}
            {view === 'patternHistory' && <PatternKnowledgePage onMoment={openMomentDetail} petId={activePetRecord.id} records={visibleStoryObservations(storyObservations, includedStoryMoments)} live={Boolean(cloud)} petName={petName} ownerName={ownerName} patterns={typicalPatterns} initialPatternId={selectedPatternId} canManage={isPrimaryCaregiver} onBack={() => goBack('pets')} onSave={saveTypicalPattern} onDelete={deleteTypicalPattern} />}
            {view === 'careEvent' && <LifeCarePage petName={petName} ownerName={ownerName} primaryOwnerName={groupOwnerAccount?.name ?? groupOwnerMember?.name ?? ownerName} currentAccountId={activeAccount.id} events={lifeCareEvents} initialCategory={lifeCareInitialCategory} startAdding={lifeCareStartAdding} canAdd={canManageLongTermCare} canManageAll={isPrimaryCaregiver} onBack={() => goBack('pets')} onSave={saveLifeCareEvent} onDelete={deleteLifeCareEvent} />}
            {view === 'settings' && !cloud && <SettingsHubPage accounts={prototypeSession.accounts} activeAccountId={activeAccount.id} onBack={() => goBack('you')} onSwitchAccount={switchAccount} onRegister={registerAccount} onDeleteAccount={deleteSavedAccount} onSignOut={() => setShowSignOutConfirm(true)} onAction={(title, detail) => setProfileAction({ title, detail })} />}
            {view === 'settings' && cloud && <section className="settings-hub-page">
              <header className="settings-hub-header"><button className="back-button" aria-label="Go back" onClick={() => goBack('you')}>←</button><h1>Settings</h1></header>
              <div className="settings-hub-content">
                <section className="settings-hub-section">
                  <h2>Account</h2>
                  <div className="profile-card settings-account-list">
                    {cloud.accounts.map(account => {
                      const currentUsername = (cloud.username ?? activeAccount.email.split('@')[0]).toLowerCase();
                      const isCurrent = account.username.toLowerCase() === currentUsername;
                      const sharedMember = displayedCareMembers.find(member =>
                        member.name.toLowerCase() === account.name.toLowerCase()
                        || member.name.toLowerCase() === account.username.toLowerCase());
                      return <div key={account.username} className={`settings-account-row ${isCurrent ? 'current' : ''}`}>
                        <button className="settings-account-switch" aria-current={isCurrent ? 'true' : undefined} onClick={() => { if (!isCurrent) { if (sharedWritePending()) setAccountActionError('Wait for shared changes to sync before switching accounts.'); else cloud.switchAccount(account.username, account.loginEmail); } }}>
                          <OwnerAvatar src={isCurrent ? ownerAvatar : account.avatar || sharedMember?.avatar || ''} name={isCurrent ? ownerName : account.name} />
                          <span><strong>{isCurrent ? ownerName : account.name}</strong><small>{account.username}</small></span>
                          <em>{isCurrent ? 'Current' : 'Switch'}</em>
                        </button>
                        <button className="settings-account-delete" aria-label={`Remove ${account.name} from this device`} title="Remove from this device" onClick={() => setPendingDeviceAccountRemoval(account)}>Remove</button>
                      </div>;
                    })}
                    <button className="settings-create-account" onClick={() => { if (sharedWritePending()) setAccountActionError('Wait for shared changes to sync before switching accounts.'); else cloud.addAnotherAccount(); }}>＋ Add another account</button>
                  </div>
                  {cloud.requestEmailChange && cloud.verifyEmailCode ? (
                    <CloudEmailLink email={activeAccount.email} onSubmit={cloud.requestEmailChange} onVerify={cloud.verifyEmailCode} />
                  ) : (
                    <p role="status">Email association is not available yet. Continue using your username and password.</p>
                  )}
                  <button className="settings-signout-row" onClick={() => setShowSignOutConfirm(true)}><span className="settings-signout-icon" aria-hidden="true">↪</span><span><strong>Sign out</strong><small>Your cloud records will remain in your account</small></span><i>›</i></button>
                </section>
                <section className="settings-hub-section">
                  <div className="profile-section-heading"><h2>Privacy &amp; support</h2></div>
                  <div className="profile-card you-list privacy-list">
                    <button className="media-row" onClick={() => setProfileAction({ title: 'Data, sharing & retention', detail: 'Review permissions, access and deletion.' })}><span className="media-icon">▤</span><span><strong>Data, sharing &amp; retention</strong><small>Review permissions, access and deletion</small></span><i>›</i></button>
                    <button className="media-row" onClick={() => setProfileAction({ title: 'Accessibility & feedback', detail: 'Text size, captions, help and suggestions.' })}><span className="media-icon">◎</span><span><strong>Accessibility &amp; feedback</strong><small>Text size, captions, help and suggestions</small></span><i>›</i></button>
                  </div>
                </section>
              </div>
            </section>}
            {view === 'petDetails' && <SettingsPage kind="petDetails" initialName={petName} initialAvatar={petAvatar} initialSpecies={petSpecies} initialSex={petSex} initialBreed={petBreed} initialAge={petAge} onSaved={setPetName} onPetSaved={({ name, breed, species, sex, age, avatar }) => { setPetName(name); setPetBreed(breed); setPetAge(age); setPetAvatar(avatar); updateActivePetRecord({ name, breed, species, sex, age, avatar }); setProfileSaveNotice('Pet details saved successfully'); }} onBack={() => goBack('pets')} />}
            {view === 'profile' && <SettingsPage kind="profile" initialName={ownerName} initialAvatar={ownerAvatar} initialPreference={ownerPreference} initialCareProfile={activeAccount?.careProfile} onSaved={setOwnerName} onProfileSaved={({ name, avatar, preference, careProfile }) => { setOwnerName(name); setOwnerAvatar(avatar); setOwnerPreference(preference); updateActiveAccountRecord({ name, avatar, preference, careProfile }); setProfileSaveNotice('Profile saved successfully'); }} onBack={() => goBack('you')} />}
            {view === 'memberDetails' && selectedCareMember && <CareMemberDetailsPage member={selectedCareMember} ownerName={groupOwnerAccount?.name ?? groupOwnerMember?.name ?? ownerName} ownerRole={groupOwnerAccount?.role ?? 'Primary caregiver'} ownerAvatar={primaryCaregiverAvatar} ownerPreference={groupOwnerAccount?.preference ?? ownerPreference} memberAvatar={selectedMemberAccount?.avatar ?? selectedCareMember.avatar ?? ''} memberPreference={selectedMemberAccount?.preference ?? ''} primaryMemberId={primaryMemberId} isPrimaryCaregiver={isPrimaryCaregiver} petName={petName} onBack={() => goBack('careMembers')} />}
            {view === 'careMembers' && (
              <PetSecondaryPage
                kind={view}
                petName={petName}
                ownerName={groupOwnerAccount?.name ?? groupOwnerMember?.name ?? ownerName}
                ownerEmail={groupOwnerAccount?.email ?? groupOwnerMember?.email ?? (groupOwnerAccountId === activeAccount.id ? activeAccount.email : 'Account email hidden')}
                ownerAvatar={primaryCaregiverAvatar}
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
        {profileAction && <SettingsPanels title={profileAction.title} onClose={() => setProfileAction(null)} preferences={devicePreferences} onPreferences={value => { setDevicePreferences(value); try { localStorage.setItem('pawsona-device-preferences', JSON.stringify(value)); setPreferencesError(''); } catch { setPreferencesError('Preferences apply for this session but could not be saved.'); } }} workspace={captureCurrentSpace(prototypeSession).accounts.find(a => a.id === activeAccount.id)?.pets.find(p => p.id === activePetRecord.id)?.workspace} petName={petName} cloud={Boolean(cloud)} />}
        {preferencesError && <p role="alert">{preferencesError}</p>}
        {pendingDeviceAccountRemoval && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setPendingDeviceAccountRemoval(null)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-device-account-title" onClick={(event) => event.stopPropagation()}><h2 id="remove-device-account-title">Remove {pendingDeviceAccountRemoval.name} from this device?</h2><p>{pendingDeviceAccountRemoval.username.toLowerCase() === (activeAccount.email.endsWith('@users.pawsona.invalid') ? activeAccount.email.split('@')[0].toLowerCase() : activeAccount.email.toLowerCase()) ? 'You will be signed out of this account. Its cloud account and records will not be deleted.' : 'This only removes the remembered username from this device. The cloud account and its records will not be deleted.'}</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setPendingDeviceAccountRemoval(null)}>Cancel</button><button className="danger-button" onClick={() => { void confirmRemoveDeviceAccount(); }}>Remove from device</button></div></section></div>}
        {showAccountSwitcher && <AccountSwitcher accounts={prototypeSession.accounts} activeAccountId={activeAccount.id} onClose={() => setShowAccountSwitcher(false)} onSwitch={switchAccount} onRegister={registerAccount} onRequestSignOut={() => { setShowAccountSwitcher(false); setShowSignOutConfirm(true); }} />}
        {showPetSwitcher && <PetSwitcher pets={activeAccount.pets} activePetId={activePetRecord.id} initialAdding={petSwitcherStartsAdding} onClose={() => { setShowPetSwitcher(false); setPetSwitcherStartsAdding(false); }} onSwitch={switchPet} onAdd={addPet} onDelete={deletePet} />}
        {showSignOutConfirm && <div className="profile-dialog-backdrop" role="presentation" onClick={() => setShowSignOutConfirm(false)}><section className="profile-dialog member-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="signout-title" onClick={(event) => event.stopPropagation()}><h2 id="signout-title">Sign out of Pawsona?</h2><p>{cloud ? "Synced records remain in your cloud account. Pending changes must finish syncing before you sign out." : "Your guest records will remain in this browser."}</p><div className="member-removal-actions"><button className="cancel-button" onClick={() => setShowSignOutConfirm(false)}>Cancel</button><button className="danger-button" onClick={signOut}>Sign out</button></div></section></div>}
        {accountActionError && <button className="account-error-toast" role="alert" onClick={() => setAccountActionError('')}>{accountActionError}<span>Dismiss</span></button>}
        {contextSavedNotice && <div className="context-saved-toast" role="status"><span aria-hidden="true">✓</span> Context saved</div>}
        {storyDraftSavedNotice && <div className="context-saved-toast" role="status"><span aria-hidden="true">✓</span> Saved to drafts</div>}
        {profileSaveNotice && <div className="profile-save-toast" role="status">{profileSaveNotice}</div>}
        {mainView && <BottomNav active={activeNav} onNavigate={navigate} unreadCareCount={careTaskUnreadCount(careTasks, activeAccount.id)} />}
      </div>
    </div>
  );
}






