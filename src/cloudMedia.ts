import { supabase, verifiedUser } from './cloud';

const prefix = 'pawsona-media://';
const mediaKeys = new Set(['avatar', 'url', 'image', 'petAvatar', 'authorAvatar', 'momentImage']);

/** Stable storage paths in Postgres; temporary object URLs in the rendered app. */
export class CloudMedia {
  private encoded = new Map<string, string>();
  private decoded = new Map<string, string>();
  private uploads = new Map<string, Promise<string>>();
  private objectUrls: string[] = [];
  constructor(private userId: string) {}

  private async upload(value: string) {
    const existing = this.uploads.get(value);
    if (existing) return existing;
    const task = (async () => {
      const user = await verifiedUser();
      if (user.id !== this.userId) throw new Error('Your account changed. Reload before saving.');
      const response = await fetch(value);
      const blob = await response.blob();
      if (blob.size > 10 * 1024 * 1024) throw new Error('Choose media smaller than 10 MB.');
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      const path = this.userId + '/' + hash;
      const { error } = await supabase!.storage.from('pawsona-media').upload(path, blob, { contentType: blob.type, upsert: false });
      if (error && !/already exists|duplicate/i.test(error.message)) throw error;
      const stable = prefix + path;
      this.encoded.set(value, stable);
      return stable;
    })();
    this.uploads.set(value, task);
    try { return await task; } catch (error) { this.uploads.delete(value); throw error; }
  }

  private async walk(value: unknown, direction: 'encode' | 'decode', key = ''): Promise<unknown> {
    if (typeof value === 'string' && mediaKeys.has(key)) {
      if (direction === 'encode') {
        const cached = this.encoded.get(value);
        if (cached) return cached;
        if (value.startsWith('data:')) return this.upload(value);
        // A blob URL from an older app session cannot be uploaded again. Drop the
        // stale reference so it does not block unrelated profile/group saves.
        if (value.startsWith('blob:')) return '';
      } else if (value.startsWith(prefix)) {
        const cached = this.decoded.get(value);
        if (cached) return cached;
        const path = value.slice(prefix.length);
        // Shared care-group workspaces can reference media uploaded by their owner.
        // The private Storage RLS policy still decides whether this member may read it.
        const { data, error } = await supabase!.storage.from('pawsona-media').download(path);
        if (error) throw error;
        const display = URL.createObjectURL(data);
        this.objectUrls.push(display);
        this.decoded.set(value, display);
        this.encoded.set(display, value);
        return display;
      }
      return value;
    }
    if (Array.isArray(value)) {
      const result = [];
      for (const entry of value) result.push(await this.walk(entry, direction, key));
      return result;
    }
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [childKey, entry] of Object.entries(value)) result[childKey] = await this.walk(entry, direction, childKey);
      return result;
    }
    return value;
  }

  async encode<T>(value: T): Promise<T> { return await this.walk(value, 'encode') as T; }
  async decode<T>(value: T): Promise<T> { return await this.walk(value, 'decode') as T; }
  backup<T>(value: T): T {
    const walk = (entry: unknown): unknown => {
      if (typeof entry === 'string') return this.encoded.get(entry) ?? entry;
      if (Array.isArray(entry)) return entry.map(walk);
      if (entry && typeof entry === 'object') return Object.fromEntries(Object.entries(entry).map(([key, item]) => [key, walk(item)]));
      return entry;
    };
    return walk(value) as T;
  }
  dispose() { this.objectUrls.forEach(url => URL.revokeObjectURL(url)); this.objectUrls = []; }
}
