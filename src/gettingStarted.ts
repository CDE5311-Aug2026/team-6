export const QUICK_QUESTIONS = [
  'What can you observe?', 'What should I watch for?', 'Help me understand',
  'What changed in the recent records?', 'How can I improve our daily routine?',
  'What should I record about appetite?', 'How can I keep my pet engaged at home?',
  'How should I prepare a temporary caregiver?', 'What should I note before a vet visit?',
  'Can you summarize the recent Story records?'
];

export const TOUR_STEPS = [
  { view: 'today', target: '.daily-rhythm-card', title: 'Start with their day', text: 'Daily Rhythm brings recorded moments and confirmed routine times together. A missing record does not mean care was missed.' },
  { view: 'today', target: '.today-care-action', title: 'Turn a plan into action', text: 'Check today’s care tasks and times. Tick a task when you have completed it, or use the bell to remind a caregiver. Check first to avoid repeating care.' },
  { view: 'pets', target: '.pets-page', title: 'Build your pet’s profile', text: 'Add your pet’s details, review Typical patterns and invite your care circle. AI-suggested routines only become confirmed knowledge after a person reviews them.' },
  { view: 'story', target: '.story-page', title: 'Record what happened', text: 'Use Add a moment to log care or an observation, with an optional photo or video. A record’s details let you add context. This tour will not save a sample record.' },
  { view: 'careTasks', target: '.care-tasks-page', title: 'Share the care', text: 'Ask a caregiver for help, accept or decline requests, and see who completed a task. Shared updates need to finish syncing; reminders appear inside Pawsona.' },
  { view: 'ask', target: '.ask-page', title: 'Ask a useful question', text: 'Try a Quick question or write your own. You can edit it before sending. Ask AI can use permitted recent Story text, but it cannot diagnose your pet. Add a pet profile first.' },
  { view: 'you', target: '.you-page', title: 'Your space, and help', text: 'Review your activity, edit your profile and open Help & getting started. You can return there to review this guide or finish setup at any time.' }
] as const;
export type SetupValues = { name: string; relationship: string; petName: string; species: 'Dog' | 'Cat'; goals: string[]; largeText: boolean; reducedMotion: boolean; includeHistory: boolean };
