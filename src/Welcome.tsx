import { useState, type FormEvent } from 'react';
import { rememberMeKey } from './cloud';

type Props = {
  error: string;
  cloud?: boolean;
  accountSwitchMode?: boolean;
  initialPage?: 'welcome' | 'register' | 'login';
  initialIdentifier?: string;
  onCancel?: () => void;
  onGuest: () => void;
  onRegister: (name: string, email: string, password: string) => string | Promise<string>;
  onLogin: (email: string, password: string) => string | Promise<string>;
};

export default function Welcome({ error, cloud = false, accountSwitchMode = false, initialPage = 'welcome', initialIdentifier = '', onCancel, onGuest, onRegister, onLogin }: Props) {
  const [page, setPage] = useState<'welcome' | 'register' | 'login'>(initialPage);
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try { return localStorage.getItem(rememberMeKey) !== 'false'; }
    catch { return true; }
  });
  const [busy, setBusy] = useState(false);
  const go = (next: typeof page) => { if (busy) return; setPage(next); setMessage(''); setPassword(''); setConfirmPassword(''); };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (cloud && page === 'register' && password !== confirmPassword) { setMessage('The passwords do not match. Please check both fields.'); return; }
    setBusy(true); setMessage('');
    try {
      if (cloud && page === 'login') {
        try { localStorage.setItem(rememberMeKey, String(rememberMe)); } catch { /* Session storage remains available where supported. */ }
      }
      const result = await (page === 'register' ? onRegister(cloud ? identifier.trim() : name.trim(), identifier.trim(), cloud ? password : '') : onLogin(identifier.trim(), password));
      if (accountSwitchMode && cloud && page === 'register' && !result) {
        setPage('login');
        setPassword('');
        setMessage('Account created. Log in to switch to it.');
      } else setMessage(result);
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not connect. Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className="app-stage"><div className="phone entrance-phone">
    <main className="entrance">
      {page !== 'welcome' && <button className="entrance-back" disabled={busy} onClick={() => {
        if (!accountSwitchMode) go('welcome');
        else if (page === 'register') go('login');
        else onCancel?.();
      }} aria-label={accountSwitchMode ? page === 'register' ? 'Back to log in' : 'Back to settings' : 'Back to welcome'}>←</button>}
      <div className="entrance-brand"><span className="entrance-dot" aria-hidden="true" /><h1>Pawsona</h1></div>
      {page === 'welcome' ? <>
        <div className="entrance-intro"><h2>Know them better.<br />Care with confidence.</h2></div>
        <div className="entrance-actions">
          <button className="primary-button full" onClick={() => go('register')}>Create account</button>
          <button className="entrance-secondary" onClick={() => go('login')}>Log in</button>
          <button className="entrance-guest" disabled={busy} onClick={onGuest}>Continue as guest <span aria-hidden="true">→</span></button>
          <p className="entrance-hint">Try Pawsona with Luna’s example.<br />Guest data stays in this browser.</p>
          {error && <p className="entrance-error" role="alert">{error}</p>}
        </div>
      </> : <>
        <div className="entrance-form-heading"><h2>{page === 'register' ? 'Your care story starts here.' : 'Welcome back.'}</h2><p>{page === 'register' ? 'Make a little space for you and your pet.' : 'Pick up where you and your pet left off.'}</p></div>
        <form className="entrance-form" onSubmit={submit}>
          {!cloud && page === 'register' && <label>Your name<input required maxLength={60} autoComplete="name" placeholder="What should we call you?" value={name} onChange={e => setName(e.target.value)} /></label>}
          {cloud ? <label>Username<input required type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" title="3–24 letters, numbers or underscores" placeholder="Choose a username" value={identifier} onChange={event => setIdentifier(event.target.value)} /><small className="entrance-field-hint">3–24 letters, numbers or underscores. Not case-sensitive.</small></label> : <label>Email address<input required type="email" autoComplete="email" placeholder="you@example.com" value={identifier} onChange={event => setIdentifier(event.target.value)} /></label>}
          {cloud && <label>Password<span className="password-entry"><input required type={showPassword ? 'text' : 'password'} minLength={page === 'register' ? 8 : 1} maxLength={128} autoComplete={page === 'register' ? 'new-password' : 'current-password'} placeholder={page === 'register' ? 'At least 8 characters' : 'Your password'} value={password} onChange={event => setPassword(event.target.value)} /><button className="password-reveal-button" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onPointerDown={event => { event.preventDefault(); setShowPassword(true); }} onPointerUp={() => setShowPassword(false)} onPointerLeave={() => setShowPassword(false)} onPointerCancel={() => setShowPassword(false)} onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setShowPassword(true); } }} onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') setShowPassword(false); }} onBlur={() => setShowPassword(false)} onContextMenu={event => event.preventDefault()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="M4 4l16 16" />}</svg></button></span></label>}
          {cloud && page === 'register' && <label>Confirm password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Enter your password again" /></label>}
          {cloud && page === 'register' && <p className="entrance-next-steps">1. Create account · 2. Set up your space · 3. Take a quick tour<br />Setup and the tour are optional.</p>}
          {cloud && page === 'login' && <label className="remember-me-option"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} /><span>Remember me</span></label>}
          <p className="entrance-local-note">{cloud ? (page === 'register' ? 'Save your pet’s records to your account. One active login at a time. No email needed. Keep your username and password safe.' : 'Log in to access your personal cloud records.') : <>Prototype access · Saved in this browser only.<br />{page === 'register' ? 'No password needed. Cloud accounts are coming later.' : 'Use the email of a profile created in this browser.'}</>}</p>
          {(message || error) && <p className="entrance-error" role="alert">{message || error}</p>}
          <button className="primary-button full" type="submit" disabled={busy}>{busy ? 'Please wait…' : page === 'register' ? 'Create account' : 'Log in'}</button>
        </form>
        <p className="entrance-switch">{page === 'register' ? 'Already have an account?' : accountSwitchMode ? 'Don’t have an account yet?' : 'New to Pawsona?'} <button onClick={() => go(page === 'register' ? 'login' : 'register')}>{page === 'register' ? 'Log in' : accountSwitchMode ? 'Sign up' : 'Create account'}</button></p>
        {!accountSwitchMode && <button className="entrance-guest" disabled={busy} onClick={onGuest}>Continue as guest <span aria-hidden="true">→</span></button>}
      </>}
    </main>
  </div></div>;
}
