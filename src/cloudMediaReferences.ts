/** Resolve a temporary media URL to its stable Storage reference before saving. */
export function stableReferenceForBlob(value: string, encoded: ReadonlyMap<string, string>): string {
  const stable = encoded.get(value);
  if (stable) return stable;
  throw new Error('An image is no longer available to save. Please reload the workspace and re-upload that image.');
}
