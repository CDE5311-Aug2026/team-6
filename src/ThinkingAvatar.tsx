export default function ThinkingAvatar({ species }: { species: 'Dog' | 'Cat' }) {
  const animal = species === 'Cat' ? 'cat' : 'dog';
  const base = `${import.meta.env.BASE_URL}assets/ai-thinking-${animal}`;
  return <picture className="ask-thinking-avatar" aria-hidden="true">
    <source media="(prefers-reduced-motion: reduce)" srcSet={`${base}.png`} />
    <img src={`${base}.gif`} width="32" height="32" alt="" />
  </picture>;
}
