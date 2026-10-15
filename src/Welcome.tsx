import { useState, type FormEvent } from 'react';

type Props = {
  error: string;
  onGuest: () => void;
  onRegister: (name: string, email: string, petName: string) => string;
  onLogin: (email: string) => string;
};

export default function Welcome({ error, onGuest, onRegister, onLogin }: Props) {
  const [page, setPage] = useState<'welcome' | 'register' | 'login'>('welcome');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const go = (next: typeof page) => { setPage(next); setMessage(''); };
  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(page === 'register' ? onRegister(name.trim(), email.trim(), '') : onLogin(email.trim()));
  }
  return <div className="app-stage"><div className="phone entrance-phone">
    <main className="entrance">
      {page !== 'welcome' && <button className="entrance-back" onClick={() => go('welcome')} aria-label="Back to welcome">←</button>}
      <div className="entrance-brand"><span className="entrance-dot" aria-hidden="true" /><h1>Pawsona</h1></div>
      {page === 'welcome' ? <>
        <div className="entrance-intro"><h2>Know them better.<br />Care with confidence.</h2></div>
        <div className="entrance-actions">
          <button className="primary-button full" onClick={() => go('register')}>Create account</button>
          <button className="entrance-secondary" onClick={() => go('login')}>Log in</button>
          <button className="entrance-guest" onClick={onGuest}>Continue as guest <span aria-hidden="true">→</span></button>
          <p className="entrance-hint">Try Pawsona with Luna’s example.<br />Guest data stays in this browser.</p>
          {error && <p className="entrance-error" role="alert">{error}</p>}
        </div>
      </> : <>
        <div className="entrance-form-heading"><h2>{page === 'register' ? 'Your care story starts here.' : 'Welcome back.'}</h2><p>{page === 'register' ? 'Make a little space for you and your pet.' : 'Pick up where you and your pet left off.'}</p></div>
        <form className="entrance-form" onSubmit={submit}>
          {page === 'register' && <label>Your name<input required maxLength={60} autoComplete="name" placeholder="What should we call you?" value={name} onChange={e => setName(e.target.value)} /></label>}
          <label>Email address<input required type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <p className="entrance-local-note">Prototype access · Saved in this browser only.<br />{page === 'register' ? 'No password needed. Cloud accounts are coming later.' : 'Use the email of a profile created in this browser.'}</p>
          {(message || error) && <p className="entrance-error" role="alert">{message || error}</p>}
          <button className="primary-button full" type="submit">{page === 'register' ? 'Create account' : 'Log in'}</button>
        </form>
        <p className="entrance-switch">{page === 'register' ? 'Already have an account?' : 'New to Pawsona?'} <button onClick={() => go(page === 'register' ? 'login' : 'register')}>{page === 'register' ? 'Log in' : 'Create account'}</button></p>
        <button className="entrance-guest" onClick={onGuest}>Continue as guest <span aria-hidden="true">→</span></button>
      </>}
    </main>
  </div></div>;
}
