export const activityGlyphFor = (title: string, kind?: string) => kind === 'water' || /\bwater\b|hydration|drinking/i.test(title) ? '💧'
    : kind === 'meal' ? '🥣'
    : kind === 'walk' ? '🐾'
      : kind === 'rest' ? '💤'
        : kind === 'play' ? '🎾'
          : /food|dinner|breakfast|lunch/i.test(title) ? '🥣'
            : /walk/i.test(title) ? '🐾'
              : /rest|sleep/i.test(title) ? '💤' : /play|toy|fetch/i.test(title) ? '🎾' : '✨';
