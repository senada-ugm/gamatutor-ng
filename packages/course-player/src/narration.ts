import type { RenderContext } from './context.js';

type SpeechCapableWindow = Window & {
  speechSynthesis?: SpeechSynthesis;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
};

function synth(ctx: RenderContext): SpeechSynthesis | null {
  if (ctx.capabilities.narration !== 'webspeech') return null;
  const w = ctx.window as SpeechCapableWindow;
  if (!('speechSynthesis' in w)) return null;
  return w.speechSynthesis ?? null;
}

export function stopSpeech(ctx: RenderContext): void {
  synth(ctx)?.cancel();
}

export function speakText(ctx: RenderContext, text: string): void {
  const s = synth(ctx);
  if (!s) return;
  const w = ctx.window as SpeechCapableWindow;
  if (!w.SpeechSynthesisUtterance) return;
  s.cancel();
  const u = new w.SpeechSynthesisUtterance(text);
  u.lang = ctx.course.language;
  s.speak(u);
}

/** Wires the per-page "Dengarkan Narasi" button, if the page rendered one. */
export function wireSpeakButton(ctx: RenderContext, transcript: string | undefined): void {
  const speakBtn = ctx.document.getElementById('speakBtn');
  if (!speakBtn) return;
  speakBtn.onclick = (e: Event) => {
    const w = ctx.window as SpeechCapableWindow;
    if (!('speechSynthesis' in w) || !w.SpeechSynthesisUtterance) {
      ctx.window.alert('Browser ini tidak mendukung Web Speech API.');
      return;
    }
    w.speechSynthesis!.cancel();
    const u = new w.SpeechSynthesisUtterance(transcript);
    u.lang = ctx.course.language;
    const target = e.target as HTMLButtonElement;
    target.disabled = true;
    target.textContent = '🔈 Membacakan...';
    const restore = () => {
      target.disabled = false;
      target.textContent = '🔊 Dengarkan Narasi';
    };
    u.onend = restore;
    u.onerror = restore;
    w.speechSynthesis!.speak(u);
  };
}
