export type PetSex = 'Female' | 'Male' | 'Unknown';
export const normalizePetSex = (value: unknown): PetSex => value === 'Female' || value === 'Male' ? value : 'Unknown';
export const PET_BREEDS = {
  Dog: ['Golden Retriever', 'Labrador Retriever', 'Shiba Inu', 'Corgi', 'Poodle', 'Beagle', 'French Bulldog', 'Border Collie', 'Mixed breed', 'Other breed'],
  Cat: ['Domestic Shorthair', 'British Shorthair', 'Ragdoll', 'Siamese', 'Persian', 'Maine Coon', 'Bengal', 'Scottish Fold', 'Mixed breed', 'Other breed'],
};
export function breedAvatar(species: 'Dog' | 'Cat', breed: string) {
  const index = PET_BREEDS[species].indexOf(breed);
  return `${import.meta.env.BASE_URL}assets/breeds/${species.toLowerCase()}-${index < 0 ? 9 : index}.svg`;
}
