// Browser text-to-speech for slide narration.
//
// None of the DRIVE pages ship a recording yet, so every narration runs
// through speechSynthesis. Setting only `utterance.lang` lets the browser
// pick a voice per utterance, and Chrome's voice list loads asynchronously:
// the first slides were read by the default (often English) voice and later
// ones by an Indonesian voice, so the narrator changed from slide to slide.
// Pinning one Indonesian voice for the whole session keeps it consistent.

let cachedVoice: SpeechSynthesisVoice | null | undefined

function isSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  const prefix = lang.split("-")[0]!.toLowerCase()
  const matching = voices
    .filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(prefix))
    // Local voices first: Chrome's online voices stop after ~15 seconds of
    // speech, which cuts long transcripts off mid-sentence.
    .sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name))
  return matching[0] ?? null
}

function resolveVoice(lang: string): SpeechSynthesisVoice | null {
  if (cachedVoice === undefined || cachedVoice === null) {
    const voice = pickVoice(lang)
    // Only cache a real hit; an empty list means voices are still loading.
    if (voice) cachedVoice = voice
    return voice
  }
  return cachedVoice
}

if (isSupported()) {
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    if (!cachedVoice) resolveVoice("id-ID")
  })
  // Kick off the async voice load as early as possible.
  window.speechSynthesis.getVoices()
}

export function cancelSpeech() {
  if (isSupported()) window.speechSynthesis.cancel()
}

export function speak(
  text: string,
  opts: { lang?: string; rate?: number; onEnd?: () => void; onError?: () => void } = {}
): SpeechSynthesisUtterance | null {
  if (!isSupported()) return null
  const lang = opts.lang ?? "id-ID"
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = opts.rate ?? 1
  const voice = resolveVoice(lang)
  if (voice) utterance.voice = voice
  if (opts.onEnd) utterance.onend = opts.onEnd
  if (opts.onError) utterance.onerror = opts.onError
  window.speechSynthesis.speak(utterance)
  return utterance
}
