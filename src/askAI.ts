import { supabase, assertActiveSession } from './cloud';

export type AskTurn = { role: 'user' | 'assistant'; text: string; attachment?: { kind: 'image' | 'audio'; url: string } };

/** Only local image bytes are sent; never ask the server to fetch arbitrary URLs. */
export async function requestAskAI(petId: string, turns: AskTurn[], signal: AbortSignal, includeHistory = true): Promise<string> {
  if (!supabase) throw new Error('Log in to use Ask AI.');
  await assertActiveSession();
  const recent = turns.slice(-12);
  const imageIndices = recent.map((turn, index) => turn.role === 'user' && turn.attachment?.kind === 'image' ? index : -1).filter(index => index >= 0).slice(-3);
  const messages = await Promise.all(recent.map(async (turn, index) => {
    let image: string | undefined;
    if (imageIndices.includes(index)) {
      const source = turn.attachment!.url;
      if (!source.startsWith('blob:') && !source.startsWith('data:image/')) throw new Error('Please attach this image again before asking about it.');
      const response = await fetch(source, { signal });
      const blob = await response.blob();
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size > 1024 * 1024) throw new Error('Choose a JPEG, PNG or WebP image smaller than 1 MB.');
      image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this image. Please attach it again.')); reader.readAsDataURL(blob);
      });
    }
    return { role: turn.role, text: turn.text || (image ? '' : turn.attachment ? '[Earlier attachment is not included in this request.]' : ''), ...(image ? { image } : {}) };
  }));
  const { data, error } = await supabase.functions.invoke('ask-ai', { body: { petId, messages, includeHistory }, signal });
  if (error) {
    const response = 'context' in error ? error.context : null;
    if (response instanceof Response) {
      const body = await response.json().catch(() => null);
      if (typeof body?.error === 'string') throw new Error(body.error);
    }
    throw new Error('Ask AI could not connect. Your message is still here; please try again.');
  }
  if (typeof data?.answer !== 'string' || !data.answer.trim()) throw new Error('No reply was received. Please try again.');
  return data.answer;
}
