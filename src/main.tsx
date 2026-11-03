import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/rubik-bubbles/latin-400.css';
import CloudRoot from './CloudRoot';
import './styles.css';

type StartupBoundaryState = { error: Error | null };

class StartupBoundary extends React.Component<React.PropsWithChildren, StartupBoundaryState> {
  state: StartupBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StartupBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Pawsona failed to render after startup.', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return <main role="alert" style={{
      boxSizing: 'border-box', minHeight: '100dvh', display: 'grid', placeItems: 'center',
      padding: 24, background: '#f9f8f3', color: '#1a2921', fontFamily: 'Poppins, sans-serif',
    }}>
      <section style={{
        width: 'min(100%, 420px)', padding: 28, border: '1px solid #e5e9df', borderRadius: 24,
        background: '#fffdf8', boxShadow: '0 12px 36px #1a29210d',
      }}>
        <p style={{ margin: '0 0 8px', color: '#c28d00', fontSize: 12, fontWeight: 700, letterSpacing: '.12em' }}>PAWSONA</p>
        <h1 style={{ margin: '0 0 12px', fontSize: 24 }}>This page couldn’t load</h1>
        <p style={{ margin: '0 0 20px', color: '#75644e', lineHeight: 1.55 }}>
          Something went wrong while opening the app. Reload the page to try again.
        </p>
        <button type="button" onClick={() => window.location.reload()} style={{
          width: '100%', minHeight: 48, border: 0, borderRadius: 999, background: '#ffcf29',
          color: '#1a2921', font: '600 15px Poppins, sans-serif', cursor: 'pointer',
        }}>Reload Pawsona</button>
        <details style={{ marginTop: 18, color: '#78644a', fontSize: 12 }}>
          <summary>Technical details</summary>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{this.state.error.message}</pre>
        </details>
      </section>
    </main>;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StartupBoundary>
      <CloudRoot />
    </StartupBoundary>
  </React.StrictMode>,
);

