"""Indonesian text normalisation for TTS: numbers, units, symbols, acronyms.

MMS-TTS reads only lowercase letters, so everything a narrator would say
aloud has to be spelled out first: "HbA1c >= 6,5%" -> "ha be a satu ce lebih
dari atau sama dengan enam koma lima persen".
"""

import re

ONES = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
        'sepuluh', 'sebelas']


def number_words(n: int) -> str:
    if n < 12:
        return ONES[n]
    if n < 20:
        return f'{ONES[n - 10]} belas'
    if n < 100:
        tens, rest = divmod(n, 10)
        return f'{ONES[tens]} puluh' + (f' {ONES[rest]}' if rest else '')
    if n < 200:
        return 'seratus' + (f' {number_words(n - 100)}' if n > 100 else '')
    if n < 1000:
        h, rest = divmod(n, 100)
        return f'{ONES[h]} ratus' + (f' {number_words(rest)}' if rest else '')
    if n < 2000:
        return 'seribu' + (f' {number_words(n - 1000)}' if n > 1000 else '')
    if n < 1_000_000:
        th, rest = divmod(n, 1000)
        return f'{number_words(th)} ribu' + (f' {number_words(rest)}' if rest else '')
    if n < 1_000_000_000:
        m, rest = divmod(n, 1_000_000)
        return f'{number_words(m)} juta' + (f' {number_words(rest)}' if rest else '')
    b, rest = divmod(n, 1_000_000_000)
    return f'{number_words(b)} miliar' + (f' {number_words(rest)}' if rest else '')


def decimal_words(s: str) -> str:
    """'6,5' -> 'enam koma lima'; '20,4' -> 'dua puluh koma empat'."""
    whole, _, frac = s.partition(',')
    out = number_words(int(whole.replace('.', '')))
    if frac:
        out += ' koma ' + ' '.join(ONES[int(d)] for d in frac)
    return out


LETTERS = {
    'a': 'a', 'b': 'be', 'c': 'ce', 'd': 'de', 'e': 'e', 'f': 'ef', 'g': 'ge', 'h': 'ha',
    'i': 'i', 'j': 'je', 'k': 'ka', 'l': 'el', 'm': 'em', 'n': 'en', 'o': 'o', 'p': 'pe',
    'q': 'ki', 'r': 'er', 's': 'es', 't': 'te', 'u': 'u', 'v': 'fe', 'w': 'we', 'x': 'eks',
    'y': 'ye', 'z': 'zet',
}

# Said as words, not letter by letter.
WORDS = {'PERKENI': 'perkeni', 'ICDRS': 'i ce de er es', 'HbA1c': 'ha be a satu ce',
         'VEGF': 'fe e ge ef', 'Snellen': 'snelen'}

# Foreign and Latin terms, respelled the way an Indonesian doctor says them;
# MMS reads letters with Indonesian sounds, so "aqueous" would come out wrong.
RESPELL = {
    'Maturity-Onset Diabetes of the Young': 'maturiti onset daiabetis of de yang',
    'sight-threatening': 'sait tretening',
    'non-proliferative': 'non proliferatif',
    'proliferative': 'proliferatif',
    'vascular endothelial growth factor': 'vaskular endotelial grout faktor',
    'aqueous humor': 'akueus humor',
    'floaters': 'flouters',
    'mellitus': 'melitus',
}

SYMBOLS = [
    ('≥', ' lebih dari atau sama dengan '), ('≤', ' kurang dari atau sama dengan '),
    ('>', ' lebih dari '), ('<', ' kurang dari '), ('%', ' persen'),
    ('mg/dL', ' miligram per desiliter'), ('kg/m²', ' kilogram per meter persegi'),
    ('mmHg', ' milimeter air raksa'), ('/', ' per '), ('&', ' dan '), ('±', ' kurang lebih '),
    ('—', ', '), ('–', ' sampai '), ('“', ''), ('”', ''), ('"', ''), ('’', ''), ("'", ''),
]


def spell(acronym: str) -> str:
    return ' '.join(LETTERS[c.lower()] for c in acronym if c.lower() in LETTERS)


def normalize(text: str) -> str:
    s = text.replace('\n', ' ')
    for k, v in RESPELL.items():
        s = re.sub(re.escape(k), v, s, flags=re.IGNORECASE)
    for k, v in WORDS.items():
        s = re.sub(rf'\b{re.escape(k)}\b', v, s)
    for k, v in SYMBOLS:
        s = s.replace(k, v)
    s = re.sub(r'\bke-(\d+)\b', lambda m: 'ke' + number_words(int(m.group(1))).replace('satu', 'satu'), s)
    s = s.replace('kesatu', 'pertama')
    s = re.sub(r'\d+(?:\.\d{3})*(?:,\d+)?', lambda m: f' {decimal_words(m.group(0))} ', s)
    # Remaining all-caps words of 2-6 letters are acronyms: spell them.
    s = re.sub(r'\b[A-Z]{2,6}\b', lambda m: spell(m.group(0)), s)
    s = s.replace(';', ',').replace(':', ',')
    s = s.lower()
    s = re.sub(r"[^a-z.,?!\s-]", ' ', s)
    s = re.sub(r'\s+([.,?!])', r'\1', s)
    return re.sub(r'\s+', ' ', s).strip()


if __name__ == '__main__':
    for t in [
        'IMT > 23 kg/m² disertai ≥ 1 faktor risiko berikut.',
        'HbA1c lebih dari atau sama dengan 6,5 persen; TTGO 2 jam ≥ 200 mg/dL.',
        'Indonesia menduduki peringkat ke-5 dengan 20,4 juta penderita atau 11,3%.',
        'Berdasarkan PERKENI 2021, sekitar 589 juta penduduk; 45% di tahun 2050.',
        'Spektrum keparahannya menurut ICDRS: NPDR ringan hingga PDR.',
    ]:
        print(normalize(t))
