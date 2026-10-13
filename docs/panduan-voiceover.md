# Panduan voiceover untuk Tim DRIVE

Saat ini narasi dibacakan oleh suara sintetis peramban (Web Speech). Begitu
rekaman voiceover Tim DRIVE siap, player memakainya secara otomatis: rekaman
diputar saat halaman dibuka, dan butir-butir daftar muncul tepat ketika narator
menyebutnya.

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

Rekaman diletakkan di `content/drive-retinopati/assets/audio/`, lalu di
`course.json`:

```json
{
  "id": "modul1-p5",
  "type": "content",
  "audio": "assets/audio/07-faktor-risiko-dm.mp3",
  "reveal_steps": [
    { "texts": ["a. Aktivitas fisik kurang"], "narration": "…", "cue": 12.5 }
  ]
}
```

Lalu jalankan `./tools/deploy-web.sh` dan `./tools/deploy.sh`. Kursus yang
berubah otomatis terbit sebagai versi baru untuk peserta yang baru mendaftar;
peserta yang sedang berjalan tetap memakai versinya.
