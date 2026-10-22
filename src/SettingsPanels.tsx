import { useState } from 'react';

export type DevicePreferences = { largeText: boolean; reducedMotion: boolean; includeHistory: boolean };
export function readPreferences(): DevicePreferences {
  try {
    const value = JSON.parse(localStorage.getItem('pawsona-device-preferences') || '{}');
    return { largeText: value.largeText === true, reducedMotion: value.reducedMotion === true, includeHistory: value.includeHistory !== false };
  } catch { return { largeText: false, reducedMotion: false, includeHistory: true }; }
}
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function SettingsPanels({ title, onClose, preferences, onPreferences, workspace, petName, cloud }: {
  title: string; onClose: () => void; preferences: DevicePreferences; onPreferences: (value: DevicePreferences) => void;
  workspace: unknown; petName: string; cloud: boolean;
}) {
  const [feedback, setFeedback] = useState(() => { try { return localStorage.getItem('pawsona-feedback-draft') || ''; } catch { return ''; } });
  const [notice, setNotice] = useState('');
  const accessibility = title === 'Accessibility & feedback';
  return <div className="profile-dialog-backdrop settings-panel-backdrop" onClick={onClose}><section className="profile-dialog settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-panel-title" onClick={e => e.stopPropagation()}>
    <header className="settings-panel-header"><h2 id="settings-panel-title">{title}</h2><button className="profile-dialog-close" aria-label="Close" onClick={onClose}>×</button></header>
    <div className="settings-panel-body">
    {!accessibility ? <>
      <h3>Your data</h3><p>{cloud ? 'Profiles, Story records, owner context and chat history are saved to your Supabase account. Care-circle members can access shared records according to their role.' : 'Guest records stay in this browser. Clearing browser data can remove them.'}</p>
      <h3>What Ask AI uses</h3><p>OpenAI receives pet basics, up to 12 recent messages (1,500 characters per earlier message, up to 4,000 for your current question), and up to 3 attached chat images. With history enabled, it also receives a text extract: up to 28 public moments from the last 7 days, 8 linked owner notes, 5 confirmed patterns and 5 permitted recent or ongoing life events. The extract is capped at 12,000 characters. Historical photos, videos and private notes are excluded.</p>
      <label className="settings-choice"><input type="checkbox" checked={preferences.includeHistory} onChange={e => onPreferences({ ...preferences, includeHistory: e.target.checked })} /><span>Use recent Story history in Ask AI on this device</span></label>
      <p>Switching this off affects future requests. Earlier chat messages may still contain details you shared. Requests use OpenAI's store:false option; this is not a promise of zero provider retention.</p>
      <h3>Retention and deletion</h3><p>Records remain until you delete them. Signing out does not delete synced records. Use each Story record's menu to delete it; use the owner-context menu for notes. Deletion has no in-app undo and does not remove copies in existing conversations or exports. Full account deletion is not available in this course prototype; contact the study team for assistance.</p>
      <h3>Export a copy</h3><p>Download the current workspace for {petName}'s records. Media links may expire; original media files are not bundled. This is a data copy, not a restorable backup.</p>
      <button className="primary-button" onClick={() => { download('pawsona-records.json', { exportedAt: new Date().toISOString(), pet: petName, workspace }); setNotice('Records downloaded. Keep this file private.'); }}>Download pet records</button>
    </> : <>
      <p>These preferences apply to this browser and can be changed at any time.</p>
      <label className="settings-choice"><input type="checkbox" checked={preferences.largeText} onChange={e => onPreferences({ ...preferences, largeText: e.target.checked })} /><span>Larger reading text</span></label>
      <label className="settings-choice"><input type="checkbox" checked={preferences.reducedMotion} onChange={e => onPreferences({ ...preferences, reducedMotion: e.target.checked })} /><span>Reduce motion</span></label>
      <h3>Help</h3><p>Use Story to add a written moment or media. Open a moment to add context. Daily Rhythm compares confirmed time windows with recorded moments. Typical patterns offers AI drafts from up to 100 recent records for a person to review. Missing footage is not proof of missed care or a health problem. Ask AI may be mistaken and cannot diagnose your pet. Audio transcription and automatic captions are not available.</p>
      <h3>Feedback for the study team</h3><label className="settings-field settings-feedback-field"><span>What happened, and what did you expect?</span><textarea aria-describedby="feedback-privacy-note" value={feedback} maxLength={2000} onChange={e => setFeedback(e.target.value)} /></label>
      <p id="feedback-privacy-note">Your feedback stays on this device. Download it and share it with the study facilitator; it is not sent automatically. Avoid personal or medical details.</p>
      <div className="settings-panel-actions"><button className="cancel-button" onClick={() => { try { localStorage.setItem('pawsona-feedback-draft', feedback); setNotice('Feedback draft saved on this device.'); } catch { setNotice('Could not save the draft. Download a copy instead.'); } }}>Save draft</button><button className="primary-button" disabled={!feedback.trim()} onClick={() => { download('pawsona-feedback.json', { date: new Date().toISOString(), feedback }); setNotice('Feedback downloaded. Share it with your facilitator.'); }}>Download feedback</button></div>
    </>}
    {notice && <p role="status">{notice}</p>}
    </div>
    <footer className="settings-panel-footer"><button className="primary-button full" onClick={onClose}>Done</button></footer>
  </section></div>;
}
