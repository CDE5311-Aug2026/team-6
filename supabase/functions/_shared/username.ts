export function normalizeUsername(input: string): string {
  const username = input.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    throw new Error('Use 3–24 letters, numbers or underscores for your username.');
  }
  return username;
}

// This address is an internal Auth identifier, never an actual email recipient.
export function usernameEmail(input: string): string {
  return normalizeUsername(input) + '@users.pawsona.invalid';
}
