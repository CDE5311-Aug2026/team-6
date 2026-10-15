type Writer<T> = (payload: T, revision: number | null) => Promise<number>;
export type SyncState = 'saved' | 'saving' | 'error';

/** One write at a time; retain the newest edit while a request is in flight. */
export class CloudSync<T extends object> {
  private pending: T | null = null;
  private running: Promise<void> | null = null;
  private lastQueued: string;
  private stopped = false;
  private failure: Error | null = null;
  constructor(private revision: number | null, initial: T, private writer: Writer<T>, private onState: (state: SyncState, message?: string) => void) {
    this.lastQueued = revision === null ? '' : JSON.stringify(initial);
  }
  get dirty() { return !!this.pending || !!this.running || !!this.failure; }
  enqueue(payload: T) {
    if (this.stopped) return;
    const serialized = JSON.stringify(payload);
    if (serialized === this.lastQueued) return;
    this.lastQueued = serialized;
    this.pending = structuredClone(payload);
    if (!this.failure) void this.drain().catch(() => {});
  }
  async drain(): Promise<void> {
    if (this.running) return this.running;
    if (this.stopped) throw new Error('This workspace is closed.');
    if (this.failure) throw this.failure;
    this.running = (async () => {
      while (this.pending && !this.stopped) {
        const payload = this.pending;
        this.pending = null;
        this.onState('saving');
        try { this.revision = await this.writer(payload, this.revision); }
        catch (cause) {
          this.pending = this.pending ?? payload;
          this.failure = cause instanceof Error ? cause : new Error(cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : 'Cloud save failed.');
          if (!this.stopped) this.onState('error', this.failure.message);
          throw this.failure;
        }
      }
      if (!this.stopped) this.onState('saved');
    })();
    try { await this.running; } finally { this.running = null; if (this.pending && !this.failure && !this.stopped) queueMicrotask(() => { void this.drain().catch(() => {}); }); }
  }
  async retry() { this.failure = null; await this.drain(); }
  stop() { this.stopped = true; }
}
