Warning: truncated output (original token count: 117673)
Total output lines: 5249

import { SetupWizard, GuidedTour, HelpPage } from './Onboarding';
import { QUICK_QUESTIONS, TOUR_STEPS, type SetupValues } from './gettingStarted';
import TodayCare from './TodayCare';
import MomentCarousel from './MomentCarousel';
import BreedPicker from './BreedPicker';
import { breedAvatar, normalizePetSex, type PetSex } from './petBreeds';
import ThinkingAvatar from './ThinkingAvatar';
import PatternSuggestions from './PatternSuggestions';
import SettingsPanels, { readPreferences } from './SettingsPanels';
import { activityCategoryLabel, activityCategoryRecords, activityInsightReviewFor, activityInsightReviewId, activityPeriodFor, activityRecordsOnDate, activityRecordsThroughDate, activitySummaryDateWindow, activitySummaryIdentity, attentionActivityInsights, dialAttentionActivityInsights, compareActivityWeeks, rankDailyActivityInsights, selectWeeklyInsight, type ActivityInsightReview, type ActivityInsightReviewStatus, type ActivityPeriod, type RankedDailyActivityInsight } from './activitySummary';
import { clockMinute, type DailyPattern } from '../supabase/functions/_shared/dailyPatterns';
import Welcome from './Welcome';
import { requestAskAI } from './askAI';
import { searchCareAccounts, type CareAccountSearchResult, type CloudCareGroup, type CloudCareInvitation } from './cloud';
import { visibleStoryObservations } from './storyVisibility';
import { buildRollingStorySimulation, isSyntheticSunnyProfile } from './storySimulation';
import { mergeSharedStoryObservations } from './sharedStoryObservations';
import { careRhythmForDate, careTaskTiming, canToggleCareTaskCompletion, toggleCareTaskCompletion, appendCareTaskEvent, canViewCareTaskEvent, careTaskAttentionCount, careTaskUnreadCount, careTasksForDate, isObservationSkippedForToday, markCareTaskEventsRead, releaseAcceptedCareTask, takeOverDeclinedCareTask, type CareTask, type CareTaskEvent, type CareTaskEventType } from './careTasks';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactElement, type ReactNode, type RefObject } from 'react';

type View =
  | 'help'
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
type StoryObservation = { careTaskId?: string; id: string; note: string; title: string; image: string; mediaType?: string; relatedPhotos?: StoryMedia[]; momentCount: number; momentIds?: string[]; sourceNotes?: StorySourceNote[]; context: string; foodType?: string; privateRecord: boolean; sourceKind?: string; savedAt: string; authorId?: string; authorName?: string; authorAvatar?: string; synthetic?: boolean; observationKind?: 'meal' | 'walk' | 'play' | 'rest' | string; simulationKey?: string; metrics?: Record<string, number> };
type StoryDraft = { id: string; selectedMoments: string[]; note: string; title?: string; momentAt?: string; momentEndAt?: string; intakeAmount?: string; foodType?: string; relatedPhotos?: StoryMedia[]; context: string; savedAt: string; privateRecord?: boolean; uploadedMedia?: StoryMedia };
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
  setupStatus?: 'pending' | 'completed' | 'skipped';
  guideStatus?: 'pending' | 'completed' | 'skipped';
  careGoals?: string[];
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
  details?: string[];
};
type MomentEngagement = { likes: string[]; favorites: string[] };
type MomentEngagementById = Record<string, MomentEngagement>;
type ProfileActivityCategory = 'records' | 'likes' | 'favorites' | 'contexts';

function observationBelongsToAccount(pet: PrototypePet, observation: StoryObservation, accountId: string) {
  return observation.authorId === accountId || (!observation.authorId && (!pet.sharedGroupId || pet.sharedOwnerAccountId === accountId));
}

function observationCompletedByAccount(pet: PrototypePet, observation: StoryObservation, accountId: string, accountName?: string) {
  const normalizedAccountName = accountName?.trim().toLocaleLowerCase();
  const task = pet.workspace.careTasks.find((entry) => entry.sourceObservationId === observation.id);
  if (task?.status === 'skipped') return false;
  if (task?.status === 'done') return task.completedBy === accountId || (task.autoCompleted === true && !!normalizedAccountName && task.completedByName?.trim().toLocaleLowerCase() === normalizedAccountName);
  if (!observation.synthetic || new Date(observation.savedAt).getTime() > Date.now()) return false;
  const completerId = task?.assignedTo && ['open', 'accepted'].includes(task.status) ? task.assignedTo : observation.authorId || 'simulation';
  const completerName = completerId === (observation.authorId || 'simulation') ? observation.authorName : undefined;
  return completerId === accountId || (!observation.authorId && !!normalizedAccountName && completerName?.trim().toLocaleLowerCase() === normalizedAccountName);
}

function itemCountForPet(pet: PrototypePet, category: ProfileActivityCategory, accountId: string, accountName?: string) {
  if (category === 'records') return pet.workspace.observations.filter((entry) => observationCompletedByAccount(pet, entry, accountId, accountName) && (!entry.privateRecord || observationBelongsToAccount(pet, entry, accountId))).length;
  if (category === 'contexts') return pet.workspace.contexts.filter((context) => context.authorId === accountId).length;
  return Object.values(pet.workspace.momentEngagement ?? {}).filter((entry) => (category === 'likes' ? entry.likes : entry.favorites).includes(accountId)).length;
}

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
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === active));
  return (
    <nav className="bottom-nav" aria-label="Main navigation" style={{ '--active-nav-index': activeIndex } as CSSProperties}>
      <span className="bottom-nav-slider" aria-hidden="true" />
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
  if (observation) {
    const details: string[] = [];
    if (observation.metrics?.durationMinutes != null) details.push(`Duration: ${formatActivityDuration(observation.metrics.durationMinutes)}`);
    const recordedFoodGrams = observation.metrics?.foodGrams ?? observation.metrics?.consumedGrams;
    if (recordedFoodGrams != null) details.push(`Food eaten: ${recordedFoodGrams} g`);
    if (observation.foodType) details.push(`Food type: ${observation.foodType}`);
    if (observation.metrics?.waterMilliliters != null) details.push(`Water drunk: ${observation.metrics.waterMilliliters} ml`);
    return {
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
    details,
  };
  }
  const base = baseMomentDefinitions.find((entry) => entry.id === momentId) ?? baseMomentDefinitions[1];
  return { ...base, image: asset(base.image) };
}


function DailyRhythmCard({ petName, moments, scheduledMoments, onOpenActivitySummary, onOpenInsights, standoutActivity, dialStandoutActivity, rankedActivities, insightReviews, patterns, careTasks, careMembers, onOpenCareTasks, onPatterns, dayOffset, onDayOffsetChange }: { petName: string; moments: StoryObservation[]; scheduledMoments: StoryObservation[]; onOpenActivitySummary: (moment: StoryObservation) => void; onOpenInsights: () => void; standoutActivity?: RankedDailyActivityInsight; dialStandoutActivity?: RankedDailyActivityInsight; rankedActivities: RankedDailyActivityInsight[]; insightReviews: ActivityInsightReview[]; patterns: TypicalPattern[]; careTasks: CareTask[]; careMembers: CareMember[]; onOpenCareTasks: () => void; onPatterns: (patternId?: string) => void; dayOffset: number; onDayOffsetChange: (offset: number) => void }) {
  const [revealedActivityId, setRevealedActivityId] = useState<string | null>(null);
  const [fullDayDial, setFullDayDial] = useState(false);
  const [isRevealingFullDay, setIsRevealingFullDay] = useState(false);
  const [isRevealingHalfDay, setIsRevealingHalfDay] = useState(false);
  const [isCenterCopyHidden, setIsCenterCopyHidden] = useState(false);
  const centerCopyTimer = useRef<number | null>(null);
  const dialChartRef = useRef<HTMLDivElement | null>(null);
  const previousDayOffset = useRef(dayOffset);
  const [dialRotationOverride, setDialRotationOverride] = useState<number | null>(null);
  const dialRotationFrame = useRef<number | null>(null);
  const [dialTimeOffset, setDialTimeOffset] = useState(0);
  const dialDrag = useRef<{ x: number; offset: number; timer: number; active: boolean; pointerId: number; target: HTMLDivElement } | null>(null);
  useLayoutEffect(() => {
    const changedDay = previousDayOffset.current !== dayOffset;
    const revealFullDay = previousDayOffset.current === 0 && dayOffset < 0;
    const revealHalfDay = previousDayOffset.current < 0 && dayOffset === 0;
    previousDayOffset.current = dayOffset;
    if (changedDay) {
      if (centerCopyTimer.current !== null) window.clearTimeout(centerCopyTimer.current);
      setIsCenterCopyHidden(true);
      centerCopyTimer.current = window.setTimeout(() => {
        centerCopyTimer.current = null;
        setIsCenterCopyHidden(false);
      }, 760);
    }
    setRevealedActivityId(null);
    setFullDayDial(revealHalfDay ? true : dayOffset !== 0);
    setIsRevealingFullDay(revealFullDay);
    setIsRevealingHalfDay(revealHalfDay);
    if (revealFullDay || revealHalfDay) {
      const timeout = window.setTimeout(() => {
        setIsRevealingFullDay(false);
        setIsRevealingHalfDay(false);
        if (revealHalfDay) setFullDayDial(false);
      }, 760);
      return () => window.clearTimeout(timeout);
    }
  }, [dayOffset]);
  useLayoutEffect(() => {
    const chart = dialChartRef.current;
    if (!isRevealingHalfDay || !chart) return;
    const fullHeight = chart.getBoundingClientRect().height;
    chart.style.height = `${fullHeight}px`;
    void chart.offsetHeight;
    const frame = requestAnimationFrame(() => {
    chart.style.height = `${chart.clientWidth * 300 / 600}px`;
    });
    return () => {
      cancelAnimationFrame(frame);
      chart.style.height = '';
    };
  }, [isRevealingHalfDay]);
  const dragStart = useRef<number | null>(null);
  const navStart = useRef<'previous' | 'newer' | null>(null);
  const pressedMomentId = useRef<string | null>(null);
  const suppressNavClick = useRef(false);
  const clockTick = useCurrentTime();
  const now = new Date(Math.max(clockTick.getTime(), Date.now()));
  const displayName = petName.replace(/\s*[（(]test[^）)]*[）)]$/i, '');
  const selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  const timedPatterns = patterns.filter(p => p.status === 'confirmed' && p.activity && Number.isFinite(p.startMinute) && Number.isFinite(p.endMinute) && p.startMinute! >= 0 && p.endMinute! <= 1440 && p.startMinute! < p.endMinute!);
  const patternById = new Map(timedPatterns.map(p => [p.id, p]));
  const patternMoments: StoryObservation[] = timedPatterns.map(p => {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, (p.startMinute! + p.endMinute!) / 2);
    return { id: p.id, title: p.activity!, note: p.detail, image: '', momentCount: 0, context: '', privateRecord: false, savedAt: at.toISOString(), observationKind: /Breakfast|Lunch|Dinner/.test(p.activity!) ? 'meal' : p.activity!.toLowerCase() };
  });
  const rhythm = careRhythmForDate(moments, careTasks, selectedDate, now, Object.fromEntries(careMembers.map(member => [member.id,member.name])));
  const completedMoments: StoryObservation[] = rhythm.completions.map(marker => ({ ...marker, image: '', momentCount: 0, context: '', privateRecord: false, sourceKind: 'care-task' }));
  const selectedMoments: StoryObservation[] = [...rhythm.records, ...completedMoments];
  const openActivity = (moment: StoryObservation) => {
    if (revealedActivityId !== moment.id) { setRevealedActivityId(moment.id); return; }
    if (patternById.has(moment.id)) onPatterns(moment.id); else if (moment.careTaskId) onOpenCareTasks(); else onOpenActivitySummary(moment);
  };
  const routineTasks = careTasksForDate(patterns, scheduledMoments, careTasks, selectedDate, now, displayName);
  const datedTasks = careTasks.filter(task => !task.sourcePatternId && !task.sourceObservationId && isSameLocalDay(task.dueAt, selectedDate) && task.status !== 'declined');
  const dayCareTasks = [...routineTasks, ...datedTasks].sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const isToday = dayOffset === 0;
  const dayTitle = isToday ? 'TODAY' : dayOffset === -1 ? 'YESTERDAY' : new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(selectedDate).toUpperCase();
  const selectedDateLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(selectedDate);
  const dayProgress = (minutes: number) => {
    const clampedMinutes = Math.max(0, Math.min(1440, minutes));
    return clampedMinutes / 1440;
  };
  // Today and Pattern share one angular scale and a common circle center below
  // the visible chart, so their arcs remain genuinely concentric.
  const dialCenter = { x: 300, y: 450 };
  const todayTrackRadius = 350;
  const patternTrackOuterRadius = 350;
  const patternTrackInnerRadius = 336;
  const patternTrackRadius = (patternTrackOuterRadius + patternTrackInnerRadius) / 2;
  const patternTrackWidth = patternTrackOuterRadius - patternTrackInnerRadius;
  const dialStartAngle = Math.acos(-300 / todayTrackRadius);
  const dialEndAngle = Math.acos(300 / todayTrackRadius);
  const dialAngle = (progress: number) => dialStartAngle + (dialEndAngle - dialStartAngle) * Math.max(0, Math.min(1, progress));
  const pointAtProgress = (progress: number, radius: number) => {
    const angle = dialAngle(progress);
    return { x: dialCenter.x + radius * Math.cos(angle), y: dialCenter.y - radius * Math.sin(angle) };
  };
  const dialArcPath = (radius: number, startProgress = 0, endProgress = 1) => {
    const start = pointAtProgress(startProgress, radius);
    const end = pointAtProgress(endProgress, radius);
    return `M${start.x} ${start.y} A${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
  };
  const arcBetweenAngles = (radius: number, startAngle: number, endAngle: number, sweep: 0 | 1) => {
    const start = { x: dialCenter.x + radius * Math.cos(startAngle), y: dialCenter.y - radius * Math.sin(startAngle) };
    const end = { x: dialCenter.x + radius * Math.cos(endAngle), y: dialCenter.y - radius * Math.sin(endAngle) };
    return `M${start.x} ${start.y} A${radius} ${radius} 0 0 ${sweep} ${end.x} ${end.y}`;
  };
  const patternBandBasePath = arcBetweenAngles(patternTrackRadius, Math.acos(-300 / patternTrackOuterRadius), Math.acos(300 / patternTrackOuterRadius), 1);
  const circleCenter = { x: 300, y: 300 };
  const circlePoint = (minute: number, radius: number) => {
    const angle = minute / 1440 * Math.PI * 2 - Math.PI / 2;
    return { x: circleCenter.x + Math.cos(angle) * radius, y: circleCenter.y + Math.sin(angle) * radius };
  };
  const circleArcPath = (startMinute: number, endMinute: number, radius: number) => {
    const start = circlePoint(startMinute, radius);
    const end = circlePoint(endMinute, radius);
    const span = endMinute - startMinute;
    return `M${start.x} ${start.y} A${radius} ${radius} 0 ${span > 720 ? 1 : 0} 1 ${end.x} ${end.y}`;
  };
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const pointerTip = circlePoint(currentMinute, 258);
  const dialRotation = (((isToday ? 1320 - currentMinute : 720) - dialTimeOffset) / 4 + 360) % 360;
  const wheelRotation = dialRotationOverride ?? (isToday && !fullDayDial ? dialRotation : 0);
  const navigateToDay = (nextOffset: number) => {
    if (dialRotationFrame.current !== null) cancelAnimationFrame(dialRotationFrame.current);
    const startAngle = wheelRotation;
    const targetAngle = nextOffset === 0 ? (((1320 - currentMinute - dialTimeOffset) / 4) % 360 + 360) % 360 : 0;
    const delta = ((targetAngle - startAngle + 540) % 360) - 180;
    const startedAt = performance.now();
    const duration = 720;
    setDialRotationOverride(startAngle);
    const tick = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDialRotationOverride(startAngle + delta * eased);
      if (progress < 1) dialRotationFrame.current = requestAnimationFrame(tick);
      else {
        dialRotationFrame.current = null;
        if (nextOffset === 0) setFullDayDial(false);
        setDialRotationOverride(null);
      }
    };
    dialRotationFrame.current = requestAnimationFrame(tick);
    onDayOffsetChange(nextOffset);
  };
  const transitionDialMode = (nextFullDay: boolean) => {
    const isReturningToNow = !nextFullDay && !fullDayDial && dialTimeOffset !== 0;
    const isSwitchingToNow = fullDayDial && !nextFullDay;
    if (fullDayDial === nextFullDay && !isReturningToNow) return;
    if (dialRotationFrame.current !== null) cancelAnimationFrame(dialRotationFrame.current);
    const startAngle = wheelRotation;
    const targetAngle = nextFullDay ? 0 : (((1320 - currentMinute) / 4 + 360) % 360);
    const delta = ((targetAngle - startAngle + 540) % 360) - 180;
    const startedAt = performance.now();
    const duration = 740;
    if (centerCopyTimer.current !== null) window.clearTimeout(centerCopyTimer.current);
    centerCopyTimer.current = null;
    setIsCenterCopyHidden(true);
    setDialRotationOverride(startAngle);
    if (nextFullDay) {
      setFullDayDial(true);
      setIsRevealingFullDay(true);
    } else if (isSwitchingToNow) {
      setIsRevealingHalfDay(true);
    }
    setDialTimeOffset(0);
    const tick = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / duration);
      const eased = (1 - Math.cos(progress * Math.PI)) / 2;
      setDialRotationOverride(startAngle + delta * eased);
      if (progress < 1) dialRotationFrame.current = requestAnimationFrame(tick);
      else {
        dialRotationFrame.current = null;
        if (isSwitchingToNow) setFullDayDial(false);
        setIsRevealingFullDay(false);
        setIsRevealingHalfDay(false);
        setDialRotationOverride(null);
        centerCopyTimer.current = window.setTimeout(() => {
          centerCopyTimer.current = null;
          setIsCenterCopyHidden(false);
        }, 35);
      }
    };
    dialRotationFrame.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => {
    if (dialRotationFrame.current !== null) cancelAnimationFrame(dialRotationFrame.current);
    if (centerCopyTimer.current !== null) window.clearTimeout(centerCopyTimer.current);
  }, []);
  const startDialDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (fullDayDial) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.currentTarget;
    const drag = { x: event.clientX, offset: dialTimeOffset, timer: 0, active: false, pointerId: event.pointerId, target };
    drag.timer = window.setTimeout(() => {
      if (dialDrag.current !== drag) return;
      drag.active = true;
      target.setPointerCapture(drag.pointerId);
    }, 180);
    dialDrag.current = drag;
  };
  const moveDialDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dialDrag.current;
    if (!drag) return;
    const distance = event.clientX - drag.x;
    if (!drag.active) return;
    event.preventDefault();
    setDialTimeOffset(drag.offset - Math.round(distance * 3));
  };
  const endDialDrag = () => {
    const drag = dialDrag.current;
    if (drag) window.clearTimeout(drag.timer);
    dialDrag.current = null;
    if (drag?.target.hasPointerCapture(drag.pointerId)) drag.target.releasePointerCapture(drag.pointerId);
  };
  const centerTimeLabel = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(now);
  const timeLabel = (date: Date) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  const activityGlyphFor = (title: string, kind?: string) => kind === 'water' || /\bwater\b|hydration|drinking/i.test(title) ? '💧'
    : kind === 'meal' ? '🥣'
    : kind === 'walk' ? '🐾'
      : kind === 'rest' ? '💤'
        : kind === 'play' ? '🎾'
          : /food|dinner|breakfast|lunch/i.test(title) ? '🥣'
            : /walk/i.test(title) ? '🐾'
              : /rest|sleep/i.test(title) ? '💤' : /play|toy|fetch/i.test(title) ? '🎾' : '✨';
  const activityGlyph = (moment: StoryObservation) => activityGlyphFor(moment.title, moment.observationKind);
  const visibleDayCareTasks = dayCareTasks.filter(task => task.status !== 'skipped');
  const linkedObservationIds = new Set(visibleDayCareTasks.flatMap(task => task.sourceObservationId ? [task.sourceObservationId] : []));
  const taskTimelineItems = visibleDayCareTasks.map(task => {
    const linkedMoment = selectedMoments.find(moment => moment.careTaskId === task.id || moment.id === task.sourceObservationId);
    const at = task.status === 'done' ? linkedMoment?.savedAt ?? task.completedAt ?? task.dueAt : task.dueAt;
    const pattern = task.sourcePatternId ? patternById.get(task.sourcePatternId) : undefined;
    const timeHint = task.status === 'done'
      ? timeLabel(new Date(at))
      : pattern ? `By ${clockMinute(pattern.endMinute!)}` : '';
    const timing = careTaskTiming(task, now);
    const state: 'done' | 'upcoming' | 'soon' | 'attention' = task.status === 'done' ? 'done' : timing === 'due' || timing === 'overdue' ? 'attention' : timing === 'soon' ? 'soon' : 'upcoming';
    const stateLabel = state === 'done' ? 'Done' : state === 'attention' ? timing === 'due' ? 'Due now' : 'Check first' : state === 'soon' ? 'Due soon' : 'Upcoming';
    return { id: task.id, title: task.title, at, state, stateLabel, glyph: activityGlyphFor(task.title), timeHint, moment: linkedMoment };
  });
  const unplannedTimelineItems = selectedMoments
    .filter(moment => !moment.careTaskId && !linkedObservationIds.has(moment.id))
    .map(moment => ({ id: `record-${moment.id}`, title: moment.title, at: moment.savedAt, state: 'done' as const, stateLabel: 'Recorded', glyph: activityGlyph(moment), timeHint: timeLabel(new Date(moment.savedAt)), moment }));
  const todayTimelineItems = [...taskTimelineItems, ...unplannedTimelineItems].sort((left, right) => left.at.localeCompare(right.at));
  const todayTrackRef = useRef<HTMLDivElement | null>(null);
  const todayCardRefs = useRef(new Map<string, HTMLButtonElement>());
  const todayDrag = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const suppressTodayItemClick = useRef(false);
  useEffect(() => {
    if (dayOffset !== 0 || !todayTimelineItems.length) return;
    const targetIndex = todayTimelineItems.findIndex(item => item.state !== 'done');
    const index = targetIndex < 0 ? todayTimelineItems.length - 1 : Math.max(0, targetIndex - 1);
    const card = todayCardRefs.current.get(todayTimelineItems[index]?.id);
    card?.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'auto' });
  }, [dayOffset, todayTimelineItems.map(item => `${item.id}:${item.state}`).join('|')]);
  const startTodayDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const track = todayTrackRef.current;
    if (!track) return;
    todayDrag.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: track.scrollLeft, moved: false };
  };
  const moveTodayDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = todayDrag.current;
    const track = todayTrackRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !track) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4) {
      drag.moved = true;
      suppressTodayItemClick.current = true;
      track.classList.add('is-dragging');
      track.setPointerCapture(event.pointerId);
    }
    if (drag.moved) track.scrollLeft = drag.startScrollLeft - distance;
  };
  const endTodayDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = todayDrag.current;
    const track = todayTrackRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      track?.classList.remove('is-dragging');
      if (track?.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      window.setTimeout(() => { suppressTodayItemClick.current = false; }, 0);
    }
    todayDrag.current = null;
  };
  const revealedPatternMoment = patternMoments.find(moment => moment.id === revealedActivityId);
  const revealedSelection = revealedPatternMoment ? { moment: revealedPatternMoment, time: `${clockMinute(patternById.get(revealedPatternMoment.id)!.startMinute!)}–${clockMinute(patternById.get(revealedPatternMoment.id)!.endMinute!)}` } : undefined;
  const goToPreviousDay = () => navigateToDay(dayOffset - 1);
  const goToNewerDay = () => { if (dayOffset < 0) navigateToDay(dayOffset + 1); };
  return <section className="daily-rhythm-card daily-rhythm-split" aria-labelledby="daily-rhythm-title">
    <header className="daily-rhythm-header">
      <div><p className="eyebrow">DAILY RHYTHM</p><h2 id="daily-rhythm-title">{displayName}’s day</h2></div>
      <div className="daily-rhythm-date-nav" aria-label="Selected day">
        {!isToday && <button type="button" className="daily-rhythm-today-button" onClick={() => navigateToDay(0)}>Today</button>}
        <button type="button" aria-label="Show previous day" onClick={goToPreviousDay}>‹</button>
        <span>{selectedDateLabel}</span>
        <button type="button" aria-label="Show newer day" disabled={isToday} onClick={goToNewerDay}>›</button>
      </div>
    </header>
    <>
    <div className="daily-rhythm-circle-heading"><span className="rhythm-circle-legend"><span><i className="pattern-key"/>Typical window</span><span><i className="done-key"/>Done</span><span><i className="upcoming-key"/>Upcoming</span><span className="attention-legend"><i className="pending-key" aria-hidden="true"/>Needs attention</span></span><span className="daily-rhythm-dial-controls">{isToday ? <span className={`daily-rhythm-dial-toggle ${fullDayDial && !isRevealingHalfDay ? 'is-full-day' : ''} ${isRevealingHalfDay ? 'is-instant' : ''}`} role="group" aria-label="Dial view"><span className="daily-rhythm-dial-toggle-thumb" aria-hidden="true"/><button type="button" aria-pressed={!fullDayDial || isRevealingHalfDay} onClick={() => transitionDialMode(false)}>Now</button><button type="button" aria-pressed={fullDayDial && !isRevealingHalfDay} onClick={() => transitionDialMode(true)}>Full day</button></span> : <span className="daily-rhythm-dial-toggle-spacer" aria-hidden="true"/>}<button type="button" onClick={() => onPatterns()}>{timedPatterns.length ? 'Patterns →' : 'Set up →'}</button></span></div>
    <div ref={dialChartRef} className={`daily-rhythm-circle-chart ${fullDayDial ? 'is-full-day' : 'is-half-day'} ${isRevealingFullDay ? 'is-revealing-full-day' : ''} ${isRevealingHalfDay ? 'is-revealing-half-day' : ''}`} onPointerDown={startDialDrag} onPointerMove={moveDialDrag} onPointerUp={endDialDrag} onPointerCancel={endDialDrag}>
      <svg viewBox={fullDayDial ? '0 0 600 600' : '0 0 600 300'} role="img" aria-label={`${displayName}’s ${fullDayDial ? 'full-day' : '12-hour'} activity timeline`}>
      <defs>
        <clipPath id="daily-rhythm-dial-clip"><rect x="0" y="0" width="600" height={fullDayDial ? 600 : 300}/></clipPath>
        <radialGradient id="daily-rhythm-atmosphere-fade" cx="300" cy="300" r="245" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="white" stopOpacity="1"/>
          <stop offset=".35" stopColor="white" stopOpacity=".99"/>
          <stop offset=".5" stopColor="white" stopOpacity=".9"/>
          <stop offset=".62" stopColor="white" stopOpacity=".66"/>
          <stop offset=".74" stopColor="white" stopOpacity=".34"/>
          <stop offset=".86" stopColor="white" stopOpacity=".08"/>
          <stop offset="1" stopColor="white" stopOpacity="0"/>
        </radialGradient>
        <mask id="daily-rhythm-atmosphere-mask" x="0" y="0" width="600" height="600" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"><rect width="600" height="600" fill="url(#daily-rhythm-atmosphere-fade)"/></mask>
        <linearGradient id="daily-rhythm-now-hand" x1="300" y1="300" x2={circlePoint(currentMinute,258).x} y2={circlePoint(currentMinute,258).y} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e5a900" stopOpacity="0"/>
          <stop offset=".22" stopColor="#e5a900" stopOpacity=".12"/>
          <stop offset=".52" stopColor="#e5a900" stopOpacity=".55"/>
          <stop offset="1" stopColor="#e5a900" stopOpacity="1"/>
        </linearGradient>
      </defs>
      <g clipPath="url(#daily-rhythm-dial-clip)"><g transform={`rotate(${wheelRotation} 300 300)`}>
      <image className="daily-rhythm-atmosphere" href="/assets/dial-atmosphere.png" x="85" y="85" width="430" height="430" preserveAspectRatio="xMidYMid meet" mask="url(#daily-rhythm-atmosphere-mask)" aria-hidden="true"/>
      <circle className="rhythm-circle-guide outer" cx="300" cy="300" r="238"/><circle className="rhythm-circle-guide inner" cx="300" cy="300" r="165"/>
      {[0,360,720,1080].map(minute => { const point = circlePoint(minute, 290); const label = minute === 0 ? ['12', 'AM'] : minute === 360 ? ['6', 'AM'] : minute === 720 ? ['12', 'PM'] : ['6', 'PM']; const radians = wheelRotation * Math.PI / 180; const shownX = 300 + (point.x - 300) * Math.cos(radians) - (point.y - 300) * Math.sin(radians); const shownY = 300 + (point.x - 300) * Math.sin(radians) + (point.y - 300) * Math.cos(radians); const anchor = shownX < 60 ? 'start' : shownX > 540 ? 'end' : 'middle'; const labelY = point.y + (shownY < 40 ? 14 : -6); return <g key={minute}><line className="rhythm-circle-tick" x1={circlePoint(minute,242).x} y1={circlePoint(minute,242).y} x2={circlePoint(minute,258).x} y2={circlePoint(minute,258).y}/><text className="rhythm-circle-label" x={point.x} y={labelY} textAnchor={anchor} transform={wheelRotation ? `rotate(${-wheelRotation} ${point.x} ${point.y})` : undefined}><tspan className="rhythm-circle-label-hour">{label[0]}</tspan><tspan className="rhythm-circle-label-period">{' ' + label[1]}</tspan></text></g>; })}
      {timedPatterns.map(pattern => { const middle = (pattern.startMinute! + pattern.endMinute!) / 2; const point = circlePoint(middle,238); const icon = activityGlyphFor(pattern.activity!); return <g key={pattern.id} className="rhythm-circle-pattern" role="button" tabIndex={0} aria-label={`${pattern.activity}, ${clockMinute(pattern.startMinute!)} to ${clockMinute(pattern.endMinute!)}`} onClick={() => onPatterns(pattern.id)}><path d={circleArcPath(pattern.startMinute!,pattern.endMinute!,238)}/><circle cx={point.x} cy={point.y} r="20"/><text x={point.x} y={point.y+1} textAnchor="middle" dominantBaseline="middle" transform={wheelRotation ? `rotate(${-wheelRotation} ${point.x} ${point.y})` : undefined}>{icon}</text></g>; })}
      {todayTimelineItems.map(item => { const date = new Date(item.at); const minute = date.getHours()*60+date.getMinutes(); const point = circlePoint(minute,165); const activityKey = item.moment ? activitySummaryIdentity(item.moment).key : ''; const matchingReview = isToday && activityKey ? rankedActivities.filter(insight => insight.activityKey === activityKey).map(insight => activityInsightReviewFor(insightReviews, insight)).filter((review): review is ActivityInsightReview => Boolean(review)).sort((left, right) => right.reviewedAt.localeCompare(left.reviewedAt))[0] : undefined; const isDefaultInsight = isToday && Boolean(dialStandoutActivity && activityKey === dialStandoutActivity.activityKey); const hasInsight = isDefaultInsight && !matchingReview; const reviewedAttention = matchingReview?.status === 'watch'; const reviewedNormal = matchingReview?.status === 'normal'; const attentionLabel = reviewedAttention ? ', marked to keep an eye on' : reviewedNormal ? ', marked as normal' : hasInsight ? ', worth a closer look' : ''; const counterRotation = wheelRotation ? `rotate(${-wheelRotation} ${point.x} ${point.y})` : undefined; return <g key={item.id} className={`rhythm-circle-today is-${item.state} ${hasInsight ? 'has-insight' : ''} ${reviewedAttention ? 'is-review-watch' : ''} ${reviewedNormal ? 'is-review-normal' : ''}`} role="button" tabIndex={0} aria-label={`${item.title}${item.timeHint ? `, ${item.timeHint}` : ''}, ${item.stateLabel}${attentionLabel}`} onClick={() => item.moment ? (hasInsight ? onOpenInsights() : onOpenActivitySummary(item.moment)) : onOpenCareTasks()} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.moment ? (hasInsight ? onOpenInsights() : onOpenActivitySummary(item.moment)) : onOpenCareTasks(); } }}><circle className="rhythm-circle-today-halo" cx={point.x} cy={point.y} r="22"/>{hasInsight && <circle className="rhythm-circle-insight-pulse" cx={point.x} cy={point.y} r="22" aria-hidden="true"/>}<circle className="rhythm-circle-today-main" cx={point.x} cy={point.y} r="16"/><text x={point.x} y={point.y+1} textAnchor="middle" dominantBaseline="middle" transform={counterRotation}>{item.glyph}</text>{hasInsight && <g className="rhythm-circle-alert is-insight" role="button" tabIndex={0} aria-label="Worth a closer look" transform={counterRotation} onClick={event => { event.stopPropagation(); onOpenInsights(); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onOpenInsights(); } }}><circle cx={point.x+13} cy={point.y-13} r="10"/><text x={point.x+13} y={point.y-9} textAnchor="middle">!</text></g>}<title>{item.title} · {item.timeHint || item.stateLabel}{attentionLabel}</title></g>; })}
      {isToday && <><line className="rhythm-circle-now" stroke="url(#daily-rhythm-now-hand)" x1="300" y1="300" x2={pointerTip.x} y2={pointerTip.y}/><circle className="rhythm-circle-now-dot" cx={pointerTip.x} cy={pointerTip.y} r="5"/></>}
      </g><g className={`rhythm-circle-center-copy ${isCenterCopyHidden ? 'is-hidden' : ''}`} aria-hidden={isCenterCopyHidden} transform="translate(0 -20)"><text className="rhythm-circle-center-kicker" x="300" y={fullDayDial ? isToday ? 277 : 290 : 238} textAnchor="middle">{dayTitle}</text><text className="rhythm-circle-center-date" x="300" y={fullDayDial ? isToday ? 303 : 320 : 260} textAnchor="middle">{selectedDateLabel}</text>{isToday && !isRevealingHalfDay && <text className="rhythm-circle-center-time" x="300" y={fullDayDial ? 354 : 288} textAnchor="middle">{centerTimeLabel}</text>}</g>
      </g>
    </svg></div>
    {isToday && (!fullDayDial || isRevealingHalfDay) && standoutActivity && <div className="daily-rhythm-insight-row"><button type="button" className="daily-rhythm-insight-link" onClick={onOpenInsights}>Worth a closer look →</button></div>}
    <div className="daily-rhythm-lane-heading"><span>TYPICAL PATTERN</span><button type="button" onClick={() => onPatterns()}>{timedPatterns.length ? 'View →' : 'Set up →'}</button></div>
    <div className="daily-rhythm-chart">
      {dayOffset < 0 && <button type="button" className="daily-rhythm-go-today" onClick={() => navigateToDay(0)}>Today</button>}
      {revealedSelection && <button type="button" className="daily-rhythm-selected-banner" aria-label={`Open details for ${revealedSelection.moment.title} at ${revealedSelection.time}`} onClick={() => openActivity(revealedSelection.moment)}>
        <span className="daily-rhythm-selected-banner-icon" aria-hidden="true">{activityGlyph(revealedSelection.moment)}</span>
        <span className="daily-rhythm-selected-banner-title">{revealedSelection.moment.title}</span>
        <span className="daily-rhythm-selected-banner-time">{revealedSelection.time}</span>
        <span className="daily-rhythm-selected-banner-arrow" aria-hidden="true">→</span>
      </button>}
      <svg viewBox="0 48 600 235" role="application" tabIndex={0} aria-label={`${displayName}’s confirmed typical activity times. Select a pattern to reveal its time window.`}
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
            const selected = selectedMoments.find(moment => moment.id === clickedMomentId) ?? patternMoments.find(moment => moment.id === clickedMomentId);
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
          <clipPath id="rhythm-upper-half"><rect x="0" y="0" width="600" height="350"/></clipPath>
        </defs>
        <g clipPath="url(#rhythm-upper-half)">
        <foreignObject x="0" y="0" width="600" height="350" aria-hidden="true"><div className="daily-rhythm-daylight-bg" /></foreignObject>
          <circle className="daily-rhythm-horizon-backdrop" cx="300" cy="450" r="156" aria-hidden="true"/>
        <g className="daily-rhythm-landscape" transform="translate(0 -40)" aria-hidden="true">
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
        <g className="daily-rhythm-wheel">
          <path className="daily-rhythm-band-shadow" d={dialArcPath(todayTrackRadius)}/>
          <path className="daily-rhythm-band" d={dialArcPath(todayTrackRadius)}/>
          <circle className="daily-rhythm-horizon-fill" cx="300" cy="450" r="156"/>
          <circle className="daily-rhythm-orb-highlight" cx="300" cy="450" r="156"/>
          <path className="daily-rhythm-inner-arc" d={dialArcPath(156)}/>
          <path className="daily-rhythm-inner-arc inner-arc-two" d={dialArcPath(136)}/>
          {timedPatterns.length > 0 && <path className="daily-rhythm-pattern-band-base" d={patternBandBasePath} strokeWidth={patternTrackWidth} aria-hidden="true"/>}
          {timedPatterns.map(p => {
            const startProgress = dayProgress(p.startMinute!);
            const endProgress = dayProgress(p.endMinute!);
            const middle = pointAtProgress((startProgress + endProgress) / 2, patternTrackRadius);
            const path = dialArcPath(patternTrackRadius, startProgress, endProgress);
            const patternMoment = patternMoments.find(moment => moment.id === p.id);
            return <g key={`${p.id}-window`} className={`daily-pattern-segment ${revealedActivityId === p.id ? 'is-revealed' : ''}`} data-moment-trigger={p.id} role="button" tabIndex={0} aria-label={`${p.activity} · ${clockMinute(p.startMinute!)}–${clockMinute(p.endMinute!)}`} aria-pressed={revealedActivityId === p.id} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (patternMoment) openActivity(patternMoment); } }}>
              <path className="daily-pattern-window" d={path} strokeWidth={patternTrackWidth}><title>{p.activity} · {clockMinute(p.startMinute!)}–{clockMinute(p.endMinute!)}</title></path>
              <circle className="daily-pattern-node" cx={middle.x} cy={middle.y} r="19" aria-hidden="true" />
              {patternMoment && <text className="daily-pattern-node-glyph" x={middle.x} y={middle.y + 1} textAnchor="middle" dominantBaseline="middle" aria-hidden="true">{activityGlyph(patternMoment)}</text>}
            </g>;
          })}
        </g>
        </g>
    </svg>
    </div>
    <section className="daily-rhythm-today-lane" aria-label={`${dayTitle.toLowerCase()} activities`}>
      <div className="daily-rhythm-lane-heading"><span>{dayTitle}</span><small>{todayTimelineItems.filter(item => item.state === 'done').length} of {todayTimelineItems.length} complete</small></div>
      {todayTimelineItems.length ? <div className="daily-rhythm-today-scroll-shell">
        <div className="daily-rhythm-today-track" ref={todayTrackRef} role="list" aria-label={`${dayTitle.toLowerCase()} activity timeline`} onPointerDown={startTodayDrag} onPointerMove={moveTodayDrag} onPointerUp={endTodayDrag} onPointerCancel={endTodayDrag}>{todayTimelineItems.map(item => <button type="button" role="listitem" ref={element => { if (element) todayCardRefs.current.set(item.id, element); else todayCardRefs.current.delete(item.id); }} className={`daily-rhythm-today-item is-${item.state}`} key={item.id} aria-label={`${item.title}${item.timeHint ? `, ${item.timeHint}` : ''}, ${item.stateLabel}`} onClick={event => { if (suppressTodayItemClick.current) { event.preventDefault(); event.stopPropagation(); suppressTodayItemClick.current = false; return; } if (item.moment) onOpenActivitySummary(item.moment); else onOpenCareTasks(); }}>
          <span className="daily-rhythm-today-glyph" aria-hidden="true">{item.glyph}</span>
          <span className="daily-rhythm-today-title"><strong>{item.title}</strong><strong aria-hidden="true">{item.title}</strong></span>
          {item.timeHint && <time>{item.timeHint}</time>}
          <small><span aria-hidden="true">{item.state === 'done' ? '✓' : item.state === 'soon' ? '◷' : item.state === 'attention' ? '!' : '○'}</span>{item.stateLabel}</small>
        </button>)}</div>
      </div> : <button type="button" className="daily-rhythm-today-empty" onClick={onOpenCareTasks}>No activities planned for this day · View care plan →</button>}
    </section>
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
  // Older simulated records use `consumedGrams`; newer manually saved meals use `foodGrams`.
  const foodAmount = (entry: StoryObservation) => Math.max(0, Number(entry.metrics?.foodGrams ?? entry.metrics?.consumedGrams) || 0);
  const isFoodSummary = summaryIdentity.kind === 'meal';
  const isWaterSummary = summaryIdentity.kind === 'water';
  const amountForSummary = (entry: StoryObservation) => isWaterSummary
    ? Math.max(0, Number(entry.metrics?.waterMilliliters) || 0)
    : foodAmount(entry);
  const amountUnit = isWaterSummary ? 'ml' : 'g';
  const totalMinutes = recordsThroughSelectedDate.reduce((sum, entry) => sum + duration(entry), 0);
  const totalFoodAmount = recordsThroughSelectedDate.reduce((sum, entry) => sum + amountForSummary(entry), 0);
  const selectedDayMoments = activityRecordsOnDate(categoryRecords, selectedDate);
  const selectedDayMinutes = selectedDayMoments.reduce((sum, entry) => sum + duration(entry), 0);
  const selectedDayFoodAmount = selectedDayMoments.reduce((sum, entry) => sum + amountForSummary(entry), 0);
  const category = summaryIdentity.label;
  const statCategory = activityCategoryLabel(summaryIdentity.kind);
  const days = activitySummaryDateWindow(selectedDate);
  const weeklyComparison = compareActivityWeeks(related, selectedDate);
  const weeklyHighlight = isFoodSummary
    ? selectWeeklyInsight({ ...weeklyComparison.current, durationRecordCount: 0 }, { ...weeklyComparison.previous, durationRecordCount: 0 })
    : selectWeeklyInsight(weeklyComparison.current, weeklyComparison.previous);
  const wallClockToday = new Date();
  const wallClockYesterday = new Date(wallClockToday);
  wallClockYesterday.setDate(wallClockYesterday.getDate() - 1);
  const isSelectedToday = isSameLocalDay(moment.savedAt, wallClockToday);
  const isSelectedYesterday = isSameLocalDay(moment.savedAt, wallClockYesterday);
  const selectedDayLabel = isSelectedToday ? 'Today' : isSelectedYesterday ? 'Yesterday' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(selectedDate);
  const selectedDayTitle = isFoodSummary || isWaterSummary
    ? isSelectedToday ? `Today’s ${isWaterSummary ? 'water amount' : 'food amount'}`
      : isSelectedYesterday ? `Yesterday’s ${isWaterSummary ? 'water amount' : 'food amount'}`
        : `${isWaterSummary ? 'Water' : 'Food'} amount · ${selectedDayLabel}`
    : isSelectedToday ? `Today’s ${statCategory} time`
      : isSelectedYesterday ? `Yesterday’s ${statCategory} time`
        : `${statCategory} time · ${selectedDayLabel}`;
  const selectedDayCountLabel = `${selectedDayMoments.length} ${selectedDayMoments.length === 1 ? 'moment' : 'moments'} ${isSelectedToday ? 'today' : isSelectedYesterday ? 'yesterday' : `on ${selectedDayLabel}`}`;
  const formatSummaryDate = (date: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  const weeklyEvidence = `${formatSummaryDate(weeklyComparison.current.startDate)}–${formatSummaryDate(weeklyComparison.current.endDate)} vs ${formatSummaryDate(weeklyComparison.previous.startDate)}–${formatSummaryDate(weeklyComparison.previous.endDate)}`;
  const formatDelta = (value: number) => `${value > 0 ? '+' : ''}${value}`;
  const weeklyMetrics = [
    { label: 'Records/week', current: weeklyComparison.current.recordCount, previous: weeklyComparison.previous.recordCount, unit: '' },
    ...(!isFoodSummary && weeklyComparison.current.durationRecordCount && weeklyComparison.previous.durationRecordCount ? [{ label: 'Avg min/record', current: weeklyComparison.current.durationMinutes / weeklyComparison.current.durationRecordCount, previous: weeklyComparison.previous.durationMinutes / weeklyComparison.previous.durationRecordCount, unit: 'm' }] : []),
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
  const hasFoodAmounts = related.some(entry => amountForSummary(entry) > 0);
  const hasDurations = !isFoodSummary && !isWaterSummary && related.some(entry => duration(entry) > 0);
  const isAmountSummary = isFoodSummary || isWaterSummary;
  const formatSummaryValue = (value: number) => isAmountSummary
    ? hasFoodAmounts ? `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 })} ${amountUnit}` : 'Not recorded'
    : formatActivityDuration(value);
  const trendMetricLabel = isFoodSummary ? 'food amount' : isWaterSummary ? 'water amount' : hasDurations ? 'duration' : 'recorded moments';
  const periodFor = activityPeriodFor;
  const periodSummary = (entries: StoryObservation[]) => (['morning', 'afternoon', 'evening'] as const).map(period => {
    const matches = entries.filter(entry => periodFor(entry) === period);
    return { period, count: matches.length, value: matches.reduce((sum, entry) => sum + (isAmountSummary ? amountForSummary(entry) : duration(entry)), 0) };
  });
  const totalPeriodSummary = periodSummary(recordsThroughSelectedDate);
  const selectedDayPeriodSummary = periodSummary(selectedDayMoments);
  const trend = days.map(date => {
    const entries = related.filter(entry => isSameLocalDay(entry.savedAt, date));
    const valueForPeriod = (period: 'morning' | 'afternoon' | 'evening') => {
      const periodEntries = entries.filter(entry => periodFor(entry) === period);
      if (isAmountSummary) return periodEntries.reduce((sum, entry) => sum + amountForSummary(entry), 0);
      return hasDurations ? periodEntries.reduce((sum, entry) => sum + duration(entry), 0) : periodEntries.length;
    };
    return {
      date,
      total: isAmountSummary ? entries.reduce((sum, entry) => sum + amountForSummary(entry), 0) : hasDurations ? entries.reduce((sum, entry) => sum + duration(entry), 0) : entries.length,
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
    if (isAmountSummary) return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 })} ${amountUnit}`;
    if (!hasDurations) return `${value} ${value === 1 ? 'moment' : 'moments'}`;
    const minutes = Math.round(value);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours && remainder) return `${hours}h ${remainder}m`;
    if (hours) return `${hours}h`;
    return `${remainder}m`;
  };
  const activityIcon = (entry: StoryObservation) => entry.observationKind === 'water' || /\bwater\b|hydration|drinking/i.test(entry.title) ? '💧'
    : entry.observationKind === 'meal' ? '🥣'
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
    <section className="activity-summary-stats" aria-label={isFoodSummary ? 'Food amount' : isWaterSummary ? 'Water amount' : 'Activity duration'}>
      {([ 
        { key: 'total' as const, title: isAmountSummary ? `Total ${isWaterSummary ? 'Water' : 'Food'} Amount` : `Total ${statCategory} time`, value: isAmountSummary ? totalFoodAmount : totalMinutes, count: recordsThroughSelectedDate.length, label: `${recordsThroughSelectedDate.length} recorded ${recordsThroughSelectedDate.length === 1 ? 'moment' : 'moments'}`, breakdown: totalPeriodSummary },
        { key: 'today' as const, title: selectedDayTitle, value: isAmountSummary ? selectedDayFoodAmount : selectedDayMinutes, count: selectedDayMoments.length, label: selectedDayCountLabel, breakdown: selectedDayPeriodSummary },
      ]).map(card => <button type="button" key={card.key} className={`activity-summary-stat-flip ${flippedStats[card.key] ? 'is-flipped' : ''}`} aria-pressed={flippedStats[card.key]} aria-label={`${card.title}. ${flippedStats[card.key] ? 'Show total' : 'Show morning, afternoon and evening breakdown'}`} onClick={() => setFlippedStats(current => ({ ...current, [card.key]: !current[card.key] }))}>
        <span className="activity-summary-stat-face activity-summary-stat-front" aria-hidden={flippedStats[card.key]}>
          <span>{card.title}</span><strong>{formatSummaryValue(card.value)}</strong><small>{card.label}</small>
        </span>
        <span className="activity-summary-stat-face activity-summary-stat-back" aria-hidden={!flippedStats[card.key]}>
          {card.breakdown.map(row => <span className="activity-summary-stat-period" key={row.period}><span><b>{row.period[0].toUpperCase() + row.period.slice(1)}</b><small>{row.count} {row.count === 1 ? 'record' : 'records'}</small></span><strong>{formatSummaryValue(row.value)}</strong></span>)}
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
      <div className="activity-summary-section-heading"><div><h2>Activity trend</h2><p>Last 7 days · {trendMetricLabel}</p></div></div>
      <div className="activity-summary-chart-legend" aria-label="Chart series">
        {trendSeries.map(series => <button className={`activity-summary-legend-item ${series.key} ${focusedTrendSeries && focusedTrendSeries !== series.key ? 'is-muted' : ''} ${focusedTrendSeries === series.key ? 'is-focused' : ''}`} key={series.key} type="button" aria-pressed={focusedTrendSeries === series.key} aria-label={`${focusedTrendSeries === series.key ? 'Show all curves; currently highlighting' : 'Highlight'} ${series.label}`} onClick={() => setFocusedTrendSeries(current => current === series.key ? null : series.key)}><i aria-hidden="true"/>{series.label}</button>)}
      </div>
      <p className="activity-summary-period-note">By start time · Morning 05:00–12:00 · Afternoon 12:00–17:30 · Evening 17:30–05:00</p>
      <svg viewBox="0 0 360 132" role="img" aria-label={`Activity trend for the last seven days, in ${trendMetricLabel}. Total: ${trend.map(entry => formatTrendValue(entry.total)).join(', ')}.`}>
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
          {(isAmountSummary ? amountForSummary(displayedMoment) > 0 : duration(displayedMoment) > 0) && <small>{formatSummaryValue(isAmountSummary ? amountForSummary(displayedMoment) : duration(displayedMoment))}</small>}
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
            <div><time dateTime={entry.savedAt}>{recordDateLabel(entry)}</time><strong>{entry.title}</strong><p>{entry.note || 'No additional notes for this moment.'}</p>{(isAmountSummary ? amountForSummary(entry) > 0 : duration(entry) > 0) && <small>{formatSummaryValue(isAmountSummary ? amountForSummary(entry) : duration(entry))}</small>}</div>
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
        <div className="activity-insight-main"><span className="activity-insight-rank" aria-label={`Rank ${index + 1}`}>{index + 1}</span><div className="activity-insight-copy"><h2><span className="activity-insight-icon" aria-hidden="true">{activityIcon(insight.activityLabel)}</span>{insight.activityLabel}</h2><p>Today’s {insight.label.toLowerCase()} {direction} {Math.round(Math.abs(insight.relativeChange) * 100)}% vs usual</p><strong>{currentValue} vs {previousValue} {insight.unit}</strong><small>Today: {insight.currentSampleSize} {insight.currentSampleSize === 1 ? 'record' : 'records'} · baseline: {insight.baselineSampleSize} records across {insight.baselineDays} recorded days</small><small>Ranked #{index + 1} by relative change</small></div>{record && <button className="activity-insight-link" type="button" onClick={() => onActivitySummary(record)}>View activity →</button>}</div>
        <div className="activity-insight-review"><p>How does this look to you?</p><div className="activity-insight-review-actions" role="group" aria-label={`Review ${insight.activityLabel}`}><button type="button" className={review?.status === 'watch' ? 'is-selected watch' : ''} aria-pressed={review?.status === 'watch'} disabled={!canReview} onClick={() => onReview(insight, 'watch')}>Keep an eye on it</button><button type="button" className={review?.status === 'normal' ? 'is-selected normal' : ''} aria-pressed={review?.status === 'normal'} disabled={!canReview} onClick={() => onReview(…67673 tokens truncated…. Some changes may not be saved after refresh.';
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
      setupStatus: 'pending', guideStatus: 'pending',
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
    setDraftMomentEndAt('');
    setDraftIntakeAmount('');
    setDraftFoodType('');
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

  function saveStoryDraft() {
    if (!canContributeToSharedPet || editingStoryObservationId || !(draftObservationTitle.trim() || draftObservation.trim() || draftMoments.length || draftUploadedMedia)) return;
    setStorySaveError('');
    const draft: StoryDraft = { id: activeStoryDraftId ?? `story-draft-${Date.now()}`, selectedMoments: draftMoments, note: draftObservation, title: draftObservationTitle, momentAt: draftMomentAt, momentEndAt: draftMomentEndAt, intakeAmount: draftIntakeAmount, foodType: draftFoodType, relatedPhotos: draftRelatedPhotos, context: draftObservationContext, savedAt: new Date().toISOString(), privateRecord: draftPrivateRecord, uploadedMedia: draftUploadedMedia ?? undefined };
    const next = [draft, ...storyDrafts.filter((entry) => entry.id !== draft.id)];
    if (!persistWorkspacePatch({ drafts: next })) {
      setStorySaveError('This draft could not be saved on this device. Remove a large photo or video, then try again.');
      return;
    }
    setStoryDrafts(next);
    cancelStoryObservation();
    setStoryDraftSavedNotice(true);
  }

  function saveStoryObservation() {
    if (!canContributeToSharedPet) return;
    setStorySaveError('');
    const existing = storyObservations.find((entry) => entry.id === editingStoryObservationId);
    const isMeal = draftObservationTitle === 'Meal';
    const start = new Date(draftMomentAt || existing?.savedAt || Date.now());
    const end = draftMomentEndAt ? new Date(draftMomentEndAt) : null;
    if (end && (end.getTime() < start.getTime() || end.toDateString() !== start.toDateString() || end.getTime() > Date.now())) {
      setStorySaveError('Choose an end time after the start, on the same day and no later than now.');
      return;
    }
    const intakeUnit = draftObservationTitle === 'Meal' ? 'foodGrams' : draftObservationTitle === 'Water' ? 'waterMilliliters' : null;
    const amount = draftIntakeAmount.trim() ? Number(draftIntakeAmount) : null;
    if (intakeUnit && (((isMeal || draftObservationTitle === 'Water') && amount === null) || (amount !== null && (!Number.isFinite(amount) || amount <= 0)))) {
      setStorySaveError('Enter an amount greater than zero.');
      return;
    }
    const selected = momentChoices.filter((moment) => draftMoments.includes(moment.id));
    const selectedNotes = getNoteChoices(petName).filter((entry) => draftMoments.includes(entry.id));
    const uploadedSelected = Boolean(draftUploadedMedia && draftMoments.includes('uploaded'));
    const generatedTitle = selected[0]?.title ?? (uploadedSelected ? `A moment with ${petName}` : titleFromObservation(selectedNotes[0]?.text ?? draftObservation));
    const title = draftObservationTitle.trim() || generatedTitle;
    const metrics = { ...(existing?.metrics ?? {}) };
    delete metrics.durationMinutes;
    delete metrics.foodGrams;
    delete metrics.waterMilliliters;
    if (end) metrics.durationMinutes = (end.getTime() - start.getTime()) / 60000;
    if (intakeUnit && amount !== null) metrics[intakeUnit] = amount;
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
      foodType: isMeal ? draftFoodType.trim() || undefined : undefined,
      privateRecord: draftPrivateRecord,
      savedAt: start.toISOString(),
      metrics,
      authorId: existing?.authorId ?? activeAccount?.id ?? undefined,
      authorName: existing?.authorName ?? ownerName,
      authorAvatar: existing?.authorAvatar ?? ownerAvatar,
    };
    const next = [observation, ...storyObservations.filter((entry) => entry.id !== observation.id)];
    const nextDrafts = activeStoryDraftId ? storyDrafts.filter((entry) => entry.id !== activeStoryDraftId) : null;
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
    setDraftMomentEndAt(existing?.metrics?.durationMinutes ? toLocalDateTimeInput(new Date(new Date(existing.savedAt).getTime() + existing.metrics.durationMinutes * 60000)) : '');
    setDraftIntakeAmount(String(existing?.metrics?.foodGrams ?? existing?.metrics?.waterMilliliters ?? ''));
    setDraftFoodType(existing?.foodType ?? '');
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
    setDraftMomentEndAt(draft.momentEndAt ?? '');
    setDraftIntakeAmount(draft.intakeAmount ?? '');
    setDraftFoodType(draft.foodType ?? '');
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
  function requestCareTask(task: CareTask, recipientId: string): boolean {
    const actorId = activeAccount?.id;
    const now = new Date();
    const recipient = displayedCareMembers.find(member => member.id === recipientId);
    const current = careTasks.find(entry => entry.id === task.id) ?? task;
    if (!canContributeToSharedPet || !actorId || !recipient || recipientId === actorId
      || recipient.access === 'viewer' || recipient.role === 'Viewer'
      || (recipient.expiresAt && Date.parse(recipient.expiresAt) <= +now)
      || !['open', 'declined'].includes(current.status)
      || (!isPrimaryCaregiver && (current.status === 'declined' || current.assignedTo && current.assignedTo !== actorId))) return false;
    const createdAt = now.toISOString();
    const eventType: CareTaskEventType = current.status === 'declined' ? 'reassigned' : 'requested';
    const requested = appendCareTaskEvent({
      ...current,
      assignedTo: recipientId,
      assignedBy: actorId,
      status: 'requested',
      acceptedAt: undefined,
      declinedAt: undefined,
      declinedBy: undefined,
      requestNote: undefined,
    }, { type: eventType, actorId, targetId: recipientId, createdAt });
    return saveCareTasks(careTasks.some(entry => entry.id === current.id)
      ? careTasks.map(entry => entry.id === current.id ? requested : entry) : [requested, ...careTasks]);
  }
  function toggleCareTask(task: CareTask) {
    const currentAccountId = activeAccount?.id;
    if (!canContributeToSharedPet || !currentAccountId) return;
    const nextTask = toggleCareTaskCompletion(task,currentAccountId,activeAccount.name,isPrimaryCaregiver);
    if (!nextTask) return;
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
            {view === 'today' && <TodayPage onRequestCareTask={requestCareTask} hasDemoMoments={activePetRecord.hasDemoMoments} onActivitySummary={moment => { returnScrollPosition.current = scrollRef.current?.scrollTop ?? 0; setSelectedActivityMoment(moment); navigateTo('activitySummary'); }} onOpenMomentDetail={openMomentDetail} onOpenInsights={() => navigateTo('activityInsights')} onCareTasks={() => navigateTo('careTasks')} onToggleCareTask={toggleCareTask} careTasks={careTasks} careMembers={displayedCareMembers} insightReviews={insightReviews} currentUserId={activeAccount.id} canAct={canContributeToSharedPet} isPrimary={isPrimaryCaregiver} observations={storyObservations} includedMoments={includedStoryMoments} petName={petName} petAvatar={petAvatar} patterns={typicalPatterns} dayOffset={dailyRhythmDayOffset} onDayOffsetChange={setDailyRhythmDayOffset} scenarioDate={activePetRecord.workspace.scenarioDate} noPetYet={activePetRecord.isEmptyProfile ?? false} onAddPet={openAddPetForm} onStory={() => navigateTo('story')} onPetsNavigate={() => navigateTo('pets')} onPatterns={openPatternKnowledge} />}
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
            {view === 'addMoments' && <StoryAddPage step="moments" saveError={storySaveError} onBack={cancelStoryObservation} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} uploadedMedia={draftUploadedMedia} setUploadedMedia={setDraftUploadedMedia} title={draftObservationTitle} setTitle={setDraftObservationTitle} momentAt={draftMomentAt} setMomentAt={setDraftMomentAt} momentEndAt={draftMomentEndAt} setMomentEndAt={setDraftMomentEndAt} intakeAmount={draftIntakeAmount} setIntakeAmount={setDraftIntakeAmount} foodType={draftFoodType} setFoodType={setDraftFoodType} relatedPhotos={draftRelatedPhotos} setRelatedPhotos={setDraftRelatedPhotos} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} petName={petName} ownerName={ownerName} hasDemoMoments={activePetRecord.hasDemoMoments} canSaveDraft={!editingStoryObservationId && Boolean(draftObservationTitle.trim() || draftObservation.trim() || draftMoments.length || draftUploadedMedia)} onSaveDraft={saveStoryDraft} onSave={saveStoryObservation} onEdit={() => navigateTo('addCompose')} />}
            {view === 'addCompose' && <StoryAddPage step="compose" saveError={storySaveError} onBack={() => goBack('addMoments')} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} uploadedMedia={draftUploadedMedia} setUploadedMedia={setDraftUploadedMedia} title={draftObservationTitle} setTitle={setDraftObservationTitle} momentAt={draftMomentAt} setMomentAt={setDraftMomentAt} momentEndAt={draftMomentEndAt} setMomentEndAt={setDraftMomentEndAt} intakeAmount={draftIntakeAmount} setIntakeAmount={setDraftIntakeAmount} foodType={draftFoodType} setFoodType={setDraftFoodType} relatedPhotos={draftRelatedPhotos} setRelatedPhotos={setDraftRelatedPhotos} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} petName={petName} ownerName={ownerName} hasDemoMoments={activePetRecord.hasDemoMoments} canSaveDraft={!editingStoryObservationId && Boolean(draftObservationTitle.trim() || draftObservation.trim() || draftMoments.length || draftUploadedMedia)} onSaveDraft={saveStoryDraft} onSave={saveStoryObservation} onEdit={() => navigateTo('addPreview')} />}
            {view === 'addPreview' && <StoryAddPage step="preview" saveError={storySaveError} onBack={() => goBack('addCompose')} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} uploadedMedia={draftUploadedMedia} setUploadedMedia={setDraftUploadedMedia} title={draftObservationTitle} setTitle={setDraftObservationTitle} momentAt={draftMomentAt} setMomentAt={setDraftMomentAt} momentEndAt={draftMomentEndAt} setMomentEndAt={setDraftMomentEndAt} intakeAmount={draftIntakeAmount} setIntakeAmount={setDraftIntakeAmount} foodType={draftFoodType} setFoodType={setDraftFoodType} relatedPhotos={draftRelatedPhotos} setRelatedPhotos={setDraftRelatedPhotos} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} petName={petName} ownerName={ownerName} hasDemoMoments={activePetRecord.hasDemoMoments} canSaveDraft={!editingStoryObservationId && Boolean(draftObservationTitle.trim() || draftObservation.trim() || draftMoments.length || draftUploadedMedia)} onSaveDraft={saveStoryDraft} onSave={saveStoryObservation} onEdit={() => navigateTo('addCompose')} />}
            {view === 'addSaved' && <StoryAddPage savedObservation={savedStoryObservation} step="saved" saveError={storySaveError} onBack={() => goBack('addPreview')} onCancel={cancelStoryObservation} selectedMoments={draftMoments} setSelectedMoments={setDraftMoments} uploadedMedia={draftUploadedMedia} setUploadedMedia={setDraftUploadedMedia} title={draftObservationTitle} setTitle={setDraftObservationTitle} momentAt={draftMomentAt} setMomentAt={setDraftMomentAt} momentEndAt={draftMomentEndAt} setMomentEndAt={setDraftMomentEndAt} intakeAmount={draftIntakeAmount} setIntakeAmount={setDraftIntakeAmount} foodType={draftFoodType} setFoodType={setDraftFoodType} relatedPhotos={draftRelatedPhotos} setRelatedPhotos={setDraftRelatedPhotos} note={draftObservation} setNote={setDraftObservation} context={draftObservationContext} setContext={setDraftObservationContext} privateRecord={draftPrivateRecord} setPrivateRecord={setDraftPrivateRecord} observations={storyObservations} petName={petName} ownerName={ownerName} hasDemoMoments={activePetRecord.hasDemoMoments} canSaveDraft={!editingStoryObservationId && Boolean(draftObservationTitle.trim() || draftObservation.trim() || draftMoments.length || draftUploadedMedia)} onSaveDraft={saveStoryDraft} onSave={saveStoryObservation} onEdit={() => navigateTo('addCompose')} />}
            {view === 'momentDetail' && <MomentDetailPage moment={selectedMoment} contexts={selectedMomentContexts} accounts={prototypeSession.accounts} careMembers={displayedCareMembers} ownerName={ownerName} ownerAvatar={ownerAvatar} currentAccountId={activeAccount.id} groupOwnerAccountId={activePetRecord.sharedGroupId ? groupOwnerAccountId : undefined} petName={petName} canContribute={canContributeToSharedPet} canInteract={canInteractWithGroupContext} engagement={momentEngagement[selectedMoment.id] ?? { likes: [], favorites: [] }} onToggleMomentLike={() => toggleMomentEngagement(selectedMoment.id, 'likes')} onToggleMomentFavorite={() => toggleMomentEngagement(selectedMoment.id, 'favorites')} onBack={() => goBack('story')} onAddContext={() => startContextForMoment(selectedMoment.id)} onEditContext={(context) => startContextForMoment(selectedMoment.id, context)} onDeleteContext={deleteOwnerContext} onToggleLike={toggleContextLike} onAddComment={addContextComment} onEditOwnComment={editOwnContextComment} onDeleteOwnComment={deleteOwnContextComment} />}
            {view === 'overview' && <OverviewPage onBack={() => goBack('today')} onClip={() => { setSelectedMomentId('window'); navigateTo('clip'); }} saved={savedContexts.find((context) => context.momentId === 'window') ?? null} onSaved={() => openMomentDetail('window')} petName={petName}/>}
            {view === 'clip' && <ClipPage onBack={() => goBack('overview')} onContext={() => startContextForMoment('window')} petName={petName} ownerName={ownerName} canContribute={canContributeToSharedPet} />}
            {view === 'context' && <ContextPage moment={selectedMoment} petName={petName} note={note} setNote={setNote} interpretation={interpretation} setInterpretation={setInterpretation} attachments={contextAttachments} setAttachments={setContextAttachments} onBack={() => goBack('momentDetail')} onReview={() => navigateTo('confirm')} />}
            {view === 'confirm' && <ConfirmPage moment={selectedMoment} note={note} interpretation={interpretation} attachments={contextAttachments} petName={petName} ownerName={ownerName} ownerRole={ownerRole} saveError={contextSaveError} onBack={() => goBack('context')} onSave={saveContext} />}
            {view === 'saved' && lastSavedContext && <SavedPage saved={lastSavedContext} onBack={() => goBack('confirm')} onReturnStory={() => navigateTo('story')} onUndo={() => undoContext(lastSavedContext.id)} onEvidence={() => openMomentDetail(lastSavedContext.momentId)} onEdit={() => startContextForMoment(lastSavedContext.momentId, lastSavedContext)} petName={petName} ownerName={ownerName} />}
            {view === 'undone' && <UndonePage onBack={() => goBack('saved')} onReturnToday={() => navigateTo('today')} onReview={() => navigateTo('overview')} petName={petName} />}
            {view === 'ask' && <AskPage petSpecies={petSpecies} onPetsNavigate={() => navigateTo('pets')} petName={petName} petAvatar={petAvatar} messages={askMessages} messageEndRef={askEndRef} noPetYet={activePetRecord.isEmptyProfile ?? false} busy={askBusy} pending={askPending} live={Boolean(cloud)} />}
            {(view === 'pets' || view === 'you') && <SimplePage kind={view} petName={petName} petAvatar={petAvatar} petBreed={petBreed} petAge={petAge} ownerName={ownerName} ownerRole={ownerRole} ownerAvatar={ownerAvatar} ownerPreference={ownerPreference} pets={activeAccount.pets} activePetId={activePetRecord.id} accounts={prototypeSession.accounts} onOpenActivity={(category) => { setProfileActivityCategory(category); navigateTo('favorites'); }} onPetsNavigate={() => navigateTo('pets')} onSettingsNavigate={() => navigateTo('settings')} onPetEdit={() => navigateTo('petDetails')} onProfileEdit={() => navigateTo('profile')} onPetSwitcher={activePetRecord.isEmptyProfile ? openAddPetForm : () => setShowPetSwitcher(true)} careMembers={orderedCareMembers} primaryMemberId={primaryMemberId} onMemberClick={openCareMember} onCareMembers={() => navigateTo('careMembers')} patterns={typicalPatterns} lifeEvents={lifeCareEvents} mediaSources={mediaSources} onPatternHistory={() => openPatternKnowledge()} onPattern={(id) => openPatternKnowledge(id)} onLifeCare={openLifeCare} onConnectedMedia={openConnectedMedia} invitations={view === 'you' ? receivedCareInvitations : []} onAcceptInvitation={acceptCareInvitation} onDeclineInvitation={(id) => updateInvitationStatus(id, 'declined')} careOwnerName={groupOwnerAccount?.name ?? groupOwnerMember?.name ?? ownerName} careOwnerAvatar={primaryCaregiverAvatar} careOwnerRole="Primary caregiver" groupName={activeGroupName} canManageCareGroup={isPrimaryCaregiver} canEditPetDetails={isPrimaryCaregiver} canAddLifeCare={canManageLongTermCare} canManageConnectedMedia={canManageLongTermCare} noPetYet={activePetRecord.isEmptyProfile ?? false} />}
            {view === 'help' && <HelpPage onBack={() => goBack('settings')} onReview={reviewGuide} onSetup={() => setSetupOpen(true)} />}
            {view === 'favorites' && <ProfileActivityPage pets={activeAccount.pets.map((pet) => pet.id === activePetRecord.id ? { ...pet, workspace: { ...pet.workspace, observations: storyObservations, momentEngagement, contexts: savedContexts, careTasks } } : pet)} initialPetId={activePetRecord.id} initialCategory={profileActivityCategory} currentAccountId={activeAccount.id} currentAccountName={activeAccount.name} onBack={() => goBack('you')} onOpenMoment={openFavoriteMoment} onRemoveFavorites={removeFavoriteMoments} />}
            {view === 'connectedMedia' && <ConnectedMediaPage petName={petName} sources={mediaSources} initialSourceId={selectedMediaSourceId} onBack={() => goBack('you')} onUpdate={saveMediaSource} onDelete={deleteMediaSource} />}
            {view === 'patternHistory' && <PatternKnowledgePage onMoment={openMomentDetail} petId={activePetRecord.id} records={visibleStoryObservations(storyObservations, includedStoryMoments)} live={Boolean(cloud)} petName={petName} ownerName={ownerName} patterns={typicalPatterns} initialPatternId={selectedPatternId} canManage={isPrimaryCaregiver} onBack={() => goBack('pets')} onSave={saveTypicalPattern} onDelete={deleteTypicalPattern} />}
            {view === 'careEvent' && <LifeCarePage petName={petName} ownerName={ownerName} primaryOwnerName={groupOwnerAccount?.name ?? groupOwnerMember?.name ?? ownerName} currentAccountId={activeAccount.id} events={lifeCareEvents} initialCategory={lifeCareInitialCategory} startAdding={lifeCareStartAdding} canAdd={canManageLongTermCare} canManageAll={isPrimaryCaregiver} onBack={() => goBack('pets')} onSave={saveLifeCareEvent} onDelete={deleteLifeCareEvent} />}
            {view === 'settings' && !cloud && <SettingsHubPage accounts={prototypeSession.accounts} activeAccountId={activeAccount.id} onBack={() => goBack('you')} onSwitchAccount={switchAccount} onRegister={registerAccount} onDeleteAccount={deleteSavedAccount} onSignOut={() => setShowSignOutConfirm(true)} onAction={(title, detail) => setProfileAction({ title, detail })} onHelp={() => navigateTo('help')} />}
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
                    <button className="media-row" onClick={() => navigateTo('help')}><span className="media-icon">?</span><span><strong>Help &amp; getting started</strong><small>How Pawsona works · Review the guide</small></span><i>›</i></button>
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
        {view === 'ask' && <AskComposer key={askIdentity} busy={askBusy} enabled={Boolean(cloud && activePetRecord && !activePetRecord.isEmptyProfile)} value={askInput} onValue={(value) => { setAskInput(value); if (askSaveError) setAskSaveError(''); }} onSend={sendAskMessage} saveError={askSaveError} onQuickContext={(value) => { setAskSaveError(''); setAskInput((current) => current ? `${current} ${value}` : value); }} messageEndRef={askEndRef} />}
        {setupOpen && <SetupWizard key={activeAccount.id} allowPetEdit={!activePetRecord.sharedGroupId} initial={{name:ownerName,relationship:activeAccount.careProfile?.relationship ?? '',petName:activePetRecord.isEmptyProfile ? '' : petName,species:petSpecies,goals:activeAccount.careGoals ?? [],...devicePreferences}} onFinish={finishSetup} onSkip={() => finishSetup()} />}
        {!setupOpen && tourIndex !== null && <GuidedTour index={tourIndex} onStep={tourStep} onClose={closeTour} />}
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







