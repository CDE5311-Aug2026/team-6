import { useCallback, useEffect, useRef, useState } from 'react';
import App, { createCloudSession, type PrototypeSession } from './App';
import Welcome from './Welcome';
import { createCloudAccount, registerCloudAccount, loginCloudAccount, logoutCloudAccount, readCloudWorkspace, supabase, verifiedUser, writeCloudWorkspace, saveCloudProfile, initializeCloudWorkspace, listCloudCareGroups, listCloudCareInvitations, sendCloudCareInvitation, respondToCloudCareInvitation, cancelCloudCareInvitation, removeCloudCareMember, updateCloudCareMember, saveCloudCareGroup } from './cloud';
import { CloudMedia } from './cloudMedia';
import { CloudSync, type SyncState } from './cloudSync';
import { isSyntheticSunnyProfile } from './storySimulation';

type Workspace = {
  id: string;
  initialSession: PrototypeSession;
  media: CloudMedia;
  sync: CloudSync<PrototypeSession>;
};

type DeviceCloudAccount = { username: string; name: string };

function usableMediaUrl(value: unknown, media: CloudMedia): value is string {
  return typeof value === 'string' && value.length > 0 && (!value.startsWith('blob:') || media.isLiveObjectUrl(value));
}

function attachCloudCareGroups(session: PrototypeSession, groups: Awaited<ReturnType<typeof listCloudCareGroups>>, media: CloudMedia): PrototypeSession {
  if (!session.accounts.length) return session;
  const allowedGroupIds = new Set(groups.map(group => group.groupId));
  const pets = [...session.accounts[0].pets];
  for (let i = pets.length - 1; i >= 0; i--) if (pets[i].sharedGroupId && !allowedGroupIds.has(pets[i].sharedGroupId!)) pets.splice(i, 1);
  for (const group of groups) {
    const workspace: Record<string, unknown> = {
      ...group.workspace,
      groupName: group.groupName,
      careMembers: group.members.map(member => ({
        id: member.id, name: member.name, email: member.email || undefined,
        avatar: member.avatar,
        role: member.isOwner ? 'Primary caregiver' : member.role,
        access: member.role === 'Viewer' ? 'viewer' as const : 'editor' as const,
        detail: member.isOwner ? 'manages the profile' : member.role === 'Viewer' ? 'can view shared records' : 'can add observations',
      })),
    };
    const groupObservations = Array.isArray(workspace.observations) ? workspace.observations : [];
    const groupVisibility = workspace.visibility;
    if (Array.isArray(groupVisibility) && groupVisibility.length > 0 && !groupObservations.some((value) => {
      return !!value && typeof value === 'object' && groupVisibility.includes(String((value as Record<string, unknown>).id ?? ''));
    })) workspace.visibility = null;
    if (group.isOwner) {
      const index = pets.findIndex(pet => pet.id === group.petId);
      if (index >= 0) {
        const ownerPet = pets[index];
        const ownerObservations = new Map(ownerPet.workspace.observations.map(observation => [observation.id, observation]));
        const ownerMediaByMoment = new Map(ownerPet.workspace.observations.map(observation => {
          const timestamp = new Date(observation.savedAt).getTime();
          const key = `${observation.title.trim().toLowerCase()}|${Number.isFinite(timestamp) ? timestamp : observation.savedAt}`;
          return [key, observation] as const;
        }));
        const sharedObservations = Array.isArray(workspace.observations) ? workspace.observations.map(value => {
          if (!value || typeof value !== 'object') return value;
          const observation = value as Record<string, unknown>;
          const timestamp = new Date(String(observation.savedAt ?? '')).getTime();
          const mediaKey = `${String(observation.title ?? '').trim().toLowerCase()}|${Number.isFinite(timestamp) ? timestamp : String(observation.savedAt ?? '')}`;
          const ownerObservation = ownerObservations.get(String(observation.id)) ?? ownerMediaByMoment.get(mediaKey);
          if (!ownerObservation) return value;
          const restored = { ...observation };
          if (!usableMediaUrl(restored.image, media)) restored.image = usableMediaUrl(ownerObservation.image, media) ? ownerObservation.image : '';
          if (Array.isArray(restored.relatedPhotos) && Array.isArray(ownerObservation.relatedPhotos)) {
            restored.relatedPhotos = restored.relatedPhotos.map((photo, photoIndex) => {
              if (!photo || typeof photo !== 'object') return photo;
              const photoUrl = (photo as Record<string, unknown>).url;
              if (usableMediaUrl(photoUrl, media)) return photo;
              const savedPhoto = ownerObservation.relatedPhotos?.find(candidate => candidate.name === (photo as Record<string, unknown>).name)
                ?? ownerObservation.relatedPhotos?.[photoIndex];
              return savedPhoto ? { ...(photo as Record<string, unknown>), url: savedPhoto.url } : photo;
            });
          }
          return restored;
        }) : [];
        const recoveredWorkspace = { ...workspace, observations: sharedObservations };
        const groupAvatar = usableMediaUrl(group.petAvatar, media) ? group.petAvatar : '';
        const ownerAvatar = usableMediaUrl(ownerPet.avatar, media) ? ownerPet.avatar : '';
        const observationAvatar = sharedObservations.find(value => value && typeof value === 'object' && usableMediaUrl((value as Record<string, unknown>).image, media));
        const storyAvatar = observationAvatar ? String((observationAvatar as Record<string, unknown>).image) : '';
        const preferGoldenStoryImage = isSyntheticSunnyProfile({ id: group.petId, name: group.petName, breed: group.petBreed });
        pets[index] = { ...ownerPet, sharedGroupId: group.groupId, sharedOwnerAccountId: group.ownerId,
          name: group.petName, breed: group.petBreed, age: group.petAge,
          // The shared care-group avatar can be stale (for example, left over
          // from another test profile). Prefer the pet's own Storage-backed
          // Story image so Sunny's header stays tied to the Golden Retriever
          // records loaded for this workspace.
          avatar: preferGoldenStoryImage ? storyAvatar || ownerAvatar || groupAvatar : groupAvatar || ownerAvatar || storyAvatar,
          workspace: recoveredWorkspace as typeof pets[number]['workspace'] };
      }
    } else {
      const sharedPetId = 'shared-' + group.groupId;
      const index = pets.findIndex(pet => pet.sharedGroupId === group.groupId);
      const observationAvatar = groupObservations.find(value => value && typeof value === 'object' && usableMediaUrl((value as Record<string, unknown>).image, media));
      const storyAvatar = observationAvatar ? String((observationAvatar as Record<string, unknown>).image) : '';
      const preferGoldenStoryImage = isSyntheticSunnyProfile({ id: group.petId, name: group.petName, breed: group.petBreed });
      const sharedPet = { id: sharedPetId, sharedGroupId: group.groupId, sharedOwnerAccountId: group.ownerId,
        name: group.petName, breed: group.petBreed, age: group.petAge,
        avatar: preferGoldenStoryImage ? storyAvatar || (usableMediaUrl(group.petAvatar, media) ? group.petAvatar : '') : (usableMediaUrl(group.petAvatar, media) ? group.petAvatar : '') || storyAvatar, hasDemoMoments: false,
        workspace: workspace as typeof pets[number]['workspace'] };
      if (index >= 0) pets[index] = { ...pets[index], ...sharedPet };
      else pets.push(sharedPet);
    }
  }
  if (!pets.length) {
    const oldPet = session.accounts[0].pets[0];
    const blank = oldPet ? { ...oldPet.workspace, observations: [], contexts: [], drafts: [], visibility: [], askMessages: [], careMembers: [] } : undefined;
    const emptyPetId = 'empty-' + session.accounts[0].id;
    pets.push({ id: emptyPetId, name: 'My pet', breed: 'Mixed breed', age: '1', avatar: '', hasDemoMoments: false, isEmptyProfile: true,
      workspace: (blank ?? {}) as typeof session.accounts[0]['pets'][number]['workspace'] });
  }
  return { ...session, accounts: [{ ...session.accounts[0], pets, activePetId: pets.some(pet => pet.id === session.accounts[0].activePetId) ? session.accounts[0].activePetId : pets[0]?.id ?? '' }] };
}
const DEVICE_ACCOUNTS_KEY = 'pawsona:device-cloud-accounts:v1';

function readDeviceAccounts(): DeviceCloudAccount[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DEVICE_ACCOUNTS_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is DeviceCloudAccount => !!item && typeof item.username === 'string' && typeof item.name === 'string');
  } catch { return []; }
}

function rememberDeviceAccount(accounts: DeviceCloudAccount[], username: string, name: string): DeviceCloudAccount[] {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return accounts;
  const next = [{ username: normalized, name: name.trim() || normalized }, ...accounts.filter(account => account.username.toLowerCase() !== normalized)];
  try { localStorage.setItem(DEVICE_ACCOUNTS_KEY, JSON.stringify(next)); } catch { /* Account remains usable if browser storage is unavailable. */ }
  return next;
}

function forgetDeviceAccount(accounts: DeviceCloudAccount[], username: string): DeviceCloudAccount[] {
  const next = accounts.filter(account => account.username.toLowerCase() !== username.toLowerCase());
  try { localStorage.setItem(DEVICE_ACCOUNTS_KEY, JSON.stringify(next)); } catch { /* In-memory state still updates. */ }
  return next;
}

function validSession(value: unknown, userId: string): value is PrototypeSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as PrototypeSession;
  return session.activeAccountId === userId && Array.isArray(session.accounts) && session.accounts.length === 1
    && session.accounts[0].id === userId && Array.isArray(session.accounts[0].pets) && session.accounts[0].pets.length > 0
    && session.accounts[0].pets.every(pet => typeof pet.id === 'string' && typeof pet.name === 'string'
      && pet.workspace && Array.isArray(pet.workspace.observations) && Array.isArray(pet.workspace.contexts));
}

export default function CloudRoot() {
  const [mode, setMode] = useState<'entry' | 'guest' | 'cloud'>('entry');
  const [accountLoginOpen, setAccountLoginOpen] = useState(false);
  const [accountLoginUsername, setAccountLoginUsername] = useState('');
  const [deviceAccounts, setDeviceAccounts] = useState<DeviceCloudAccount[]>(readDeviceAccounts);
  const [loading, setLoading] = useState(!!supabase);
  const [error, setError] = useState('');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('saved');
  const [syncError, setSyncError] = useState('');
  const [syncNoticeVisible, setSyncNoticeVisible] = useState(false);
  useEffect(() => {
    if (mode !== 'cloud' || !workspace) { setSyncNoticeVisible(false); return; }
    setSyncNoticeVisible(true);
    if (syncState !== 'saved') return;
    const timer = window.setTimeout(() => setSyncNoticeVisible(false), 2500);
    return () => window.clearTimeout(timer);
  }, [syncState, mode, workspace?.id]);
  const current = useRef<Workspace | null>(null);
  const generation = useRef(0);
  const choice = useRef<'guest' | null>(null);
  const latest = useRef<PrototypeSession | null>(null);

  const openCloud = useCallback(async (expectedId?: string) => {
    if (!supabase || choice.current === 'guest') return;
    if (current.current && (!expectedId || current.current.id === expectedId)) { setMode('cloud'); setAccountLoginOpen(false); setLoading(false); return; }
    setAccountLoginOpen(false);
    if (current.current) { current.current.sync.stop(); current.current.media.dispose(); current.current = null; setWorkspace(null); setMode('entry'); }
    const ticket = ++generation.current;
    setLoading(true); setError('');
    let media: CloudMedia | null = null;
    try {
      const user = await verifiedUser();
      if (ticket !== generation.current) return;
      const row = await readCloudWorkspace<PrototypeSession>() ?? await initializeCloudWorkspace(
        createCloudSession(user.id, user.email ?? '', String(user.user_metadata.display_name ?? 'Pet caregiver').slice(0, 120)), user.id,
      );
      const username = (user.email ?? '').split('@')[0];
      setDeviceAccounts(accounts => rememberDeviceAccount(accounts, username, row?.payload.accounts?.[0]?.name ?? String(user.user_metadata.display_name ?? username)));
      if (row && !validSession(row.payload, user.id)) throw new Error('Your workspace could not be read safely. Please contact the project team.');
      media = new CloudMedia(user.id);
      const decodedSession = await media.decode(row.payload);
      let initialSession = decodedSession;
      try { initialSession = attachCloudCareGroups(decodedSession, await media.decode(await listCloudCareGroups()), media); }
      catch { /* A not-yet-applied care-group migration must not block account sign-in. */ }
      if (ticket !== generation.current) { media.dispose(); return; }
      const codec = media;
      const sync = new CloudSync(row.revision, initialSession, async (payload, revision) => {
        if (!validSession(payload, user.id)) throw new Error('Account mismatch. Reload before saving.');
        const encoded = await codec.encode(payload);
        await saveCloudProfile(encoded.accounts[0].name, encoded.accounts[0].avatar, user.id);
        return writeCloudWorkspace(encoded, revision, user.id);
      }, (state, message) => {
        if (ticket === generation.current) { setSyncState(state); setSyncError(message ?? ''); }
      });
      const next = { id: user.id, initialSession, sync, media };
      current.current = next; latest.current = initialSession;
      setWorkspace(next); setSyncState('saved'); setSyncError(''); setMode('cloud');
    } catch (cause) {
      if (ticket === generation.current) { setError(cause instanceof Error ? cause.message : 'Could not load your cloud records.'); setMode('entry'); }
      media?.dispose();
    } finally { if (ticket === generation.current) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer network requests until the auth callback releases its lock.
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!active) return;
        if (event === 'SIGNED_OUT') {
          ++generation.current;
          current.current?.sync.stop(); current.current?.media.dispose(); current.current = null;
          setWorkspace(null); setMode('entry'); setAccountLoginOpen(false); setLoading(false);
        } else if (session && choice.current !== 'guest' && current.current?.id !== session.user.id) { void openCloud(session.user.id); }
        else { setLoading(false); }
      }, 0);
      timers.add(timer);
    });
    return () => {
      active = false; ++generation.current;
      timers.forEach(clearTimeout); subscription.unsubscribe();
      current.current?.sync.stop(); current.current?.media.dispose(); current.current = null;
    };
  }, [openCloud]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (current.current?.sync.dirty) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const signOut = async () => {
    try {
      await current.current?.sync.drain();
      await logoutCloudAccount();
    } catch (cause) { setSyncError(cause instanceof Error ? cause.message : 'Could not sign out.'); setSyncState('error'); }
  };
  const addAnotherAccount = async () => {
    try {
      await current.current?.sync.drain();
      setError('');
      setAccountLoginUsername('');
      setAccountLoginOpen(true);
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause.message : 'Could not save your account before continuing.');
      setSyncState('error');
    }
  };
  const switchToDeviceAccount = (username: string) => {
    setError('');
    setAccountLoginUsername(username);
    setAccountLoginOpen(true);
  };
  const removeDeviceAccount = async (username: string) => {
    const currentUsername = current.current?.initialSession.accounts[0]?.email.split('@')[0].toLowerCase();
    if (currentUsername === username.toLowerCase()) {
      await current.current?.sync.drain();
      await logoutCloudAccount();
    }
    setDeviceAccounts(accounts => forgetDeviceAccount(accounts, username));
  };
  const save = useCallback((session: PrototypeSession) => {
    latest.current = session;
    current.current?.sync.enqueue(session);
  }, []);
  function downloadBackup() {
    if (!latest.current) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(current.current?.media.backup(latest.current) ?? latest.current, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'pawsona-workspace-backup.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (mode === 'guest') return <App guest onExit={() => { choice.current = null; setMode('entry'); }} />;
  if (mode === 'cloud' && workspace) return <>
    <App key={workspace.id}
      cloud={{
        initialSession: workspace.initialSession, save, signOut: () => { void signOut(); }, addAnotherAccount: () => { void addAnotherAccount(); },
        accounts: deviceAccounts, switchAccount: switchToDeviceAccount, removeAccount: removeDeviceAccount,
        listInvitations: async () => workspace.media.decode(await listCloudCareInvitations()),
        listGroups: async () => workspace.media.decode(await listCloudCareGroups()),
        sendInvitation: async (input) => sendCloudCareInvitation(await workspace.media.encode(input)),
        respondInvitation: async (id, response) => {
          const group = await respondToCloudCareInvitation(id, response);
          return group ? workspace.media.decode(group) : null;
        },
        cancelInvitation: cancelCloudCareInvitation,
        removeCareMember: removeCloudCareMember,
        updateCareMember: updateCloudCareMember,
        saveCareGroup: async (groupId, pet, groupName, groupWorkspace) => saveCloudCareGroup(
          groupId,
          await workspace.media.encode(pet),
          groupName,
          await workspace.media.encode(groupWorkspace),
        ),
      }}
      notice={syncNoticeVisible && syncState === 'error' && <div className="cloud-sync-bar error" role="alert">
        <span>Not synced · {syncError}</span>
        {syncState === 'error' && <><button onClick={() => { void workspace.sync.retry().catch(() => {}); }}>Retry</button><button onClick={downloadBackup}>Download backup</button></>}
      </div>}
    />
    {accountLoginOpen && <div className="account-switch-overlay"><Welcome key={accountLoginUsername} cloud accountSwitchMode initialPage="login" initialIdentifier={accountLoginUsername} error={error}
      onCancel={() => { setError(''); setAccountLoginOpen(false); setAccountLoginUsername(''); }}
      onGuest={() => {}}
      onRegister={async (_name, username, password) => { await registerCloudAccount(username, password); return ''; }}
      onLogin={async (username, password) => { await loginCloudAccount(username, password); await openCloud(); return ''; }} />
    </div>}
  </>;
  return <>{loading && <div className="cloud-loading" role="status">Loading your account…</div>}
    <Welcome cloud error={error}
      onGuest={() => { choice.current = 'guest'; ++generation.current; setLoading(false); setError(''); setMode('guest'); }}
      onRegister={async (_name, username, password) => {
        if (!supabase) return 'Cloud accounts are not configured yet. Continue as guest.';
        await createCloudAccount(username, password);
        await openCloud();
        return '';
      }}
      onLogin={async (username, password) => { await loginCloudAccount(username, password); await openCloud(); return ''; }} />
    {error && <div className="cloud-entry-recovery"><button onClick={() => { void openCloud(); }}>Retry loading</button><button onClick={() => { void logoutCloudAccount().catch(() => {}); }}>Sign out</button></div>}
  </>;
}
