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
/** A failed Storage reference is media with an error, not a text-only record. */
export function isUnavailableMedia(value: string): boolean {
  return value.startsWith('data:image/svg+xml') && value.split('#')[1]?.startsWith(encodeURIComponent('pawsona-media://')) === true;
}
export function unavailableMediaPlaceholder(reference: string, avatar = false): string {
  const picture = '<rect x="30" y="36" width="100" height="78" rx="8" fill="none" stroke="#748b7a" stroke-width="5"/><circle cx="58" cy="59" r="9" fill="#a8b9ac"/><path d="m36 104 27-28 20 20 18-17 23 25" fill="none" stroke="#748b7a" stroke-width="5"/><text x="80" y="144" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#52675a">Media unavailable</text>';
  const person = '<circle cx="80" cy="60" r="24" fill="#a8b9ac"/><path d="M32 139a48 48 0 0 1 96 0" fill="#a8b9ac"/>';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="24" fill="#e7efe8"/>' + (avatar ? person : picture) + '</svg>';
  // Preserve the stable reference so saving a fallback cannot erase the upload.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}#${encodeURIComponent(reference)}`;
}
