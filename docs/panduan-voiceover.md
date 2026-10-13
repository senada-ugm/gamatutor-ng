# Panduan voiceover untuk Tim DRIVE

Saat ini kursus memakai **voiceover sementara**: suara sintetis Meta MMS-TTS
Bahasa Indonesia (lisensi CC BY-NC 4.0, nonkomersial, dengan atribusi di panel
Referensi). Suara ini seragam di semua perangkat dan butir daftar muncul tepat
saat disebut, tetapi tetap terdengar sintetis dan beberapa istilah medis
terbaca kurang alami. Begitu rekaman Tim DRIVE siap, rekaman itu
menggantikannya: cukup timpa file MP3-nya dan perbarui detik mulai tiap butir.

## Yang perlu diserahkan

**1. Satu file audio per halaman yang bernarasi.**

- Format MP3, mono, 64–96 kbps (cukup jernih untuk suara, ringan di jaringan seluler).
- Nama file mengikuti nomor halaman dan judulnya, misalnya
  `07-faktor-risiko-dm.mp3`. Daftar halaman ada di tabel di bawah.
- Isi rekaman mengikuti transkrip di player (tombol **Transkrip** di kiri bawah).
  Kalau kalimat diubah saat rekaman, kirim juga teks finalnya, supaya
  transkrip ikut disesuaikan.

**2. Untuk halaman berisi daftar yang muncul bertahap: detik mulai tiap butir.**

Contohnya Modul 1 halaman 7 (faktor risiko DM, butir a–j):

| Butir | Mulai disebut pada detik |
|---|---|
| (pengantar) | 0 |
| a. Aktivitas fisik kurang | 12,5 |
| b. Riwayat keluarga DM | 15,8 |
| … | … |

Detik bisa dibaca langsung dari aplikasi perekam atau editor audio (Audacity,
Adobe Audition, dan sejenisnya). Butir tanpa detik akan muncul di akhir rekaman.

## Halaman yang bernarasi

| Halaman | Isi | Butir bertahap |
|---|---|---|
| 2 | Cakupan modul | — |
| 4 | Apa itu Diabetes Mellitus? | — |
| 5 | Prevalensi & proyeksi kasus DM | — |
| 6 | DM berdasarkan etiologi | — |
| 7 | Faktor risiko Diabetes Mellitus | 10 butir (a–j) |
| 8 | Kriteria diagnosis DM | — |
| 9 | Klasifikasi kadar glukosa & HbA1c | — |
| 10 | Komplikasi diabetes mellitus | — |
| 13 | Apa itu retinopati diabetika? | — |
| 14 | Retinopati diabetika | — |
| 16 | Gejala klinis retinopati diabetika | — |
| 17 | Faktor risiko retinopati diabetika | 6 butir |
| 20 | Penilaian ketajaman visual | 2 bagian (langkah, video) |

Halaman hotspot (anatomi, patofisiologi) membacakan penjelasan tiap nomor saat
nomor itu diklik. Kalau Tim DRIVE ingin merekam bagian itu juga, kirim satu
file per nomor.

## Untuk pengembang

Voiceover sementara dibuat ulang dengan:

```bash
python tools/voiceover/make_voiceover.py content/drive-retinopati --qa
```

(perlu `torch`, `transformers`, `scipy`, dan `ffmpeg`; `--qa` mentranskripsi
balik tiap klip dengan Whisper sebagai cek kasar kejelasan). Skrip itu menulis
`assets/audio/<id-halaman>.mp3`, `cue` tiap butir, klip tiap nomor hotspot, dan
`credits` ke `course.json`.

Untuk rekaman Tim DRIVE: timpa `content/drive-retinopati/assets/audio/<id>.mp3`
dengan rekaman mereka, isi `cue` (detik) tiap butir di `course.json`, hapus
`credits`, lalu jalankan `./tools/deploy-web.sh` dan `./tools/deploy.sh`.
Kursus yang berubah otomatis terbit sebagai versi baru untuk peserta yang baru
mendaftar; peserta yang sedang berjalan tetap memakai versinya. Untuk kembali
ke suara peramban, hapus kunci `audio` dari `course.json`.
