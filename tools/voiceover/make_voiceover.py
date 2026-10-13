"""Interim synthetic voiceover for a course, until the organiser's recordings exist.

    python tools/voiceover/make_voiceover.py content/drive-retinopati [--qa]

Synthesises every narrated page (the transcript as lead-in, then each reveal
step's narration) and every hotspot point with Meta's MMS-TTS Indonesian
voice (facebook/mms-tts-ind, CC BY-NC 4.0: non-commercial use, with
attribution, which the course's `credits` carries). Each page becomes one MP3
in assets/audio/; the second at which each step starts is written into
course.json as its `cue`, so items appear exactly when they are named.

Recorded voiceover replaces this simply by overwriting the MP3s and cues (see
docs/panduan-voiceover.md). --qa transcribes each clip back with Whisper and
prints how many words came through, as a rough intelligibility check.
"""

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import scipy.io.wavfile as wav
import torch
from transformers import AutoTokenizer, VitsModel

sys.path.insert(0, str(Path(__file__).parent))
from normalize import normalize  # noqa: E402

MODEL = 'facebook/mms-tts-ind'
RATE = 0.9          # a little slower than default: clearer medical terms
NOISE = 0.4         # steadier than default (0.667); best in the ASR comparison
SENTENCE_GAP = 0.30
SEGMENT_GAP = 0.55
MAX_WORDS = 20
CREDITS = (
    'Suara narasi sementara: sintesis suara Meta MMS-TTS Bahasa Indonesia '
    '(facebook/mms-tts-ind), lisensi CC BY-NC 4.0, untuk penggunaan nonkomersial. '
    'Akan diganti rekaman voiceover Tim DRIVE.'
)


def spoken(text: str) -> str:
    """As the player speaks it: no bullet marks or list letters, one line."""
    lines = []
    for line in text.split('\n'):
        line = re.sub(r'^[•·-]\s*', '', line.strip())
        line = re.sub(r'^[a-j]\.\s+', '', line)
        if line:
            lines.append(line)
    return ' '.join(lines)


def sentences(text: str) -> list[str]:
    out = []
    for s in re.findall(r'[^.!?]+(?:[.!?]+(?=\s|$)|$)', spoken(text)):
        s = s.strip()
        if not s:
            continue
        if len(s.split()) <= MAX_WORDS:
            out.append(s)
            continue
        cur = ''
        for part in re.split(r'(?<=[,;])\s+', s):
            joined = f'{cur} {part}'.strip()
            if cur and len(joined.split()) > MAX_WORDS:
                out.append(cur)
                cur = part
            else:
                cur = joined
        if cur:
            out.append(cur)
    return out


class Voice:
    def __init__(self):
        self.model = VitsModel.from_pretrained(MODEL)
        self.tok = AutoTokenizer.from_pretrained(MODEL)
        self.model.speaking_rate = RATE
        self.model.noise_scale = NOISE
        self.sr = self.model.config.sampling_rate

    def say(self, text: str, seed: int) -> np.ndarray:
        clean = normalize(text)
        if not clean:
            return np.zeros(0, dtype=np.float32)
        torch.manual_seed(seed)
        with torch.no_grad():
            return self.model(**self.tok(clean, return_tensors='pt')).waveform[0].numpy()

    def silence(self, seconds: float) -> np.ndarray:
        return np.zeros(int(self.sr * seconds), dtype=np.float32)


def to_mp3(audio: np.ndarray, sr: int, dest: Path) -> None:
    peak = float(np.max(np.abs(audio))) or 1.0
    audio = (audio / peak * 0.9).astype(np.float32)
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / 'a.wav'
        wav.write(src, sr, (audio * 32767).astype(np.int16))
        subprocess.run(
            ['ffmpeg', '-y', '-loglevel', 'error', '-i', str(src), '-ac', '1',
             '-codec:a', 'libmp3lame', '-b:a', '48k', str(dest)],
            check=True,
        )


def segments_of(page: dict) -> list[tuple[int | None, str]]:
    segs: list[tuple[int | None, str]] = []
    if page.get('transcript'):
        segs.append((None, page['transcript']))
    for i, step in enumerate(page.get('reveal_steps') or []):
        text = step.get('narration') or ' '.join(step.get('texts', [])) or \
            '. '.join(x for x in (step.get('title'), step.get('body')) if x)
        segs.append((i, text or ''))
    return segs


def main() -> None:
    course_dir = Path(sys.argv[1])
    qa = '--qa' in sys.argv
    course_path = course_dir / 'course.json'
    course = json.loads(course_path.read_text(encoding='utf8'))
    out_dir = course_dir / 'assets' / 'audio'
    out_dir.mkdir(parents=True, exist_ok=True)
    voice = Voice()
    made: list[tuple[str, str]] = []

    for module in course['modules']:
        for page in module['pages']:
            if page['type'] in ('content', 'cards') and page.get('transcript'):
                parts: list[np.ndarray] = []
                t = 0.0
                said = []
                for seg_no, (step, text) in enumerate(segments_of(page)):
                    if parts:
                        parts.append(voice.silence(SEGMENT_GAP))
                        t += SEGMENT_GAP
                    if step is not None:
                        page['reveal_steps'][step]['cue'] = round(t, 2)
                    for k, sentence in enumerate(sentences(text)):
                        if k:
                            parts.append(voice.silence(SENTENCE_GAP))
                            t += SENTENCE_GAP
                        clip = voice.say(sentence, seed=1000 * seg_no + k)
                        parts.append(clip)
                        t += len(clip) / voice.sr
                        said.append(sentence)
                name = f"{page['id']}.mp3"
                to_mp3(np.concatenate(parts), voice.sr, out_dir / name)
                page['audio'] = f'assets/audio/{name}'
                made.append((name, ' '.join(said)))
                print(f"{page['id']}: {t:.1f}s", flush=True)
            if page['type'] == 'hotspot':
                for i, point in enumerate(page['points']):
                    text = f"{point['label']}. {point['body']}"
                    parts = []
                    for k, sentence in enumerate(sentences(text)):
                        if k:
                            parts.append(voice.silence(SENTENCE_GAP))
                        parts.append(voice.say(sentence, seed=k))
                    name = f"{page['id']}-{i + 1}.mp3"
                    to_mp3(np.concatenate(parts), voice.sr, out_dir / name)
                    point['audio'] = f'assets/audio/{name}'
                    made.append((name, text))
                print(f"{page['id']}: {len(page['points'])} points", flush=True)

    course['credits'] = CREDITS
    course_path.write_text(json.dumps(course, ensure_ascii=False, indent=2) + '\n', encoding='utf8')

    if qa:
        import difflib
        from transformers import pipeline
        asr = pipeline('automatic-speech-recognition', model='openai/whisper-small')
        scores = []
        for name, text in made:
            pcm = subprocess.run(
                ['ffmpeg', '-loglevel', 'error', '-i', str(out_dir / name), '-f', 'f32le',
                 '-ac', '1', '-ar', '16000', '-'], check=True, capture_output=True).stdout
            heard = asr({'raw': np.frombuffer(pcm, dtype=np.float32), 'sampling_rate': 16000},
                        generate_kwargs={'language': 'indonesian', 'task': 'transcribe'},
                        return_timestamps=True)['text']
            ref, hyp = normalize(text).split(), normalize(heard).split()
            score = difflib.SequenceMatcher(None, ref, hyp).ratio()
            scores.append(score)
            print(f'qa {name}: {score:.2f}', flush=True)
        print(f'qa mean word match: {sum(scores) / len(scores):.3f}')


if __name__ == '__main__':
    main()
