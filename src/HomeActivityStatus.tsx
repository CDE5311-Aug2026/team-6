/** A fixed activity status beside the moving moments, linking to full insights. */
export default function HomeActivityStatus({ needsAttention, onOpenInsights }: {
  needsAttention: boolean;
  onOpenInsights: () => void;
}) {
  return <button type="button" className={`home-activity-status ${needsAttention ? 'needs-attention' : 'no-attention'}`}
    aria-label={needsAttention ? 'Activity needs a closer look. View activity insights' : 'No activity changes flagged today. View activity insights'}
    onClick={onOpenInsights}>
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2" />
      {needsAttention ? <><path d="M16 9v9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><circle cx="16" cy="23" r="1.5" fill="currentColor" /></>
        : <path d="m10 16 4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  </button>;
}
