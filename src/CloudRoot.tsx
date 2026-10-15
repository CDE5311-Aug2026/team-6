import { useCallback, useEffect, useRef, useState } from 'react';
import App, { createCloudSession, type PrototypeSession } from './App';
import Welcome from './Welcome';
import { createCloudAccount, loginCloudAccount, logoutCloudAccount, readCloudWorkspace, supabase, verifiedUser, writeCloudWorkspace, saveCloudProfile, initializeCloudWorkspace } from './cloud';
import { CloudMedia } from './cloudMedia';
import { CloudSync, type SyncState } from './cloudSync';

type Workspace = {
  id: string;
  initialSession: PrototypeSession;
  media: CloudMedia;
  sync: CloudSync<PrototypeSession>;
};

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
    if (current.current && (!expectedId || current.current.id === expectedId)) { setMode('cloud'); setLoading(false); return; }
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
      if (row && !validSession(row.payload, user.id)) throw new Error('Your workspace could not be read safely. Please contact the project team.');
      media = new CloudMedia(user.id);
      const initialSession = await media.decode(row.payload);
      if (ticket !== generation.current) { media.dispose(); return; }
      const codec = media;
      const sync = new CloudSync(row.revision, initialSession, async (payload, revision) => {
        if (!validSession(payload, user.id)) throw new Error('Account mismatch. Reload before saving.');
        const encoded = await codec.encode(payload);
        await saveCloudProfile(encoded.accounts[0].name, user.id);
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
          setWorkspace(null); setMode('entry'); setLoading(false);
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
  if (mode === 'cloud' && workspace) return <App key={workspace.id}
    cloud={{ synced: syncState === 'saved', initialSession: workspace.initialSession, save, signOut: () => { void signOut(); } }}
    notice={syncNoticeVisible && <div className={'cloud-sync-bar ' + syncState} role="status">
      <span>{syncState === 'saving' ? 'Saving to your account…' : syncState === 'error' ? 'Not synced · ' + syncError : 'Saved to your account'}</span>
      {syncState === 'error' && <><button onClick={() => { void workspace.sync.retry().catch(() => {}); }}>Retry</button><button onClick={downloadBackup}>Download backup</button></>}
    </div>}
  />;
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
