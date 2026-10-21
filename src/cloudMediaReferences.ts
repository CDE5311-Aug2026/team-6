/** Resolve a temporary media URL to its stable Storage reference before saving. */
export function stableReferenceForBlob(value: string, encoded: ReadonlyMap<string, string>): string {
  const stable = encoded.get(value);
  if (stable) return stable;
  throw new Error('An image is no longer available to save. Please reload the workspace and re-upload that image.');
}

/** Missing or inaccessible optional media must not block account loading. */
export function isUnavailableMediaError(error: { statusCode?: string | number; status?: number; message?: string }): boolean {
  return ['403', '404'].includes(String(error.statusCode ?? error.status)) || /^(object not found|the resource was not found)$/i.test(error.message ?? '');
}
export function unavailableMediaPlaceholder(reference: string): string {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="24" fill="#e7efe8"/><circle cx="80" cy="60" r="24" fill="#a8b9ac"/><path d="M32 139a48 48 0 0 1 96 0" fill="#a8b9ac"/></svg>';
  // A distinct display URL for each reference prevents later saves from
  // replacing one inaccessible avatar with another avatar's Storage path.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}#${encodeURIComponent(reference)}`;
}
