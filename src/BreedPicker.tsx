import { useState } from 'react';
import { PET_BREEDS, breedAvatar } from './petBreeds';
export default function BreedPicker({ species, value, onChange }: { species: 'Dog' | 'Cat'; value: string; onChange: (breed: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listed = PET_BREEDS[species].includes(value);
  return <section className="pet-breed-picker"><strong>Breed</strong>
    <button type="button" className="breed-current" aria-expanded={open} onClick={() => setOpen(!open)}><img src={breedAvatar(species, value)} alt=""/><span>{value || 'Choose a breed'}</span><span aria-hidden="true">⌄</span></button>
    {open && <div className="breed-options-panel"><input aria-label="Search breeds" placeholder="Search breeds…" value={query} onChange={e => setQuery(e.target.value)} /><div className="breed-options" role="group" aria-label={`${species} breeds`}>{PET_BREEDS[species].filter(b => b.toLowerCase().includes(query.toLowerCase())).map(b => <button type="button" key={b} className={b === value ? 'selected' : ''} aria-pressed={b === value} onClick={() => { onChange(b); setOpen(false); setQuery(''); }}><img src={breedAvatar(species, b)} alt={`${b} illustration`} /><span>{b}</span></button>)}</div><small>Example illustrations, not a photo of your pet.</small></div>}
    {(!listed || value === 'Other breed') && <input aria-label="Custom pet breed" placeholder="Enter breed, if known" value={value === 'Other breed' ? '' : value} onChange={e => onChange(e.target.value)} />}
  </section>;
}
