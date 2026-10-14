# Tangkapan Layar Mockup LMS - Skenario Peran Pengguna

Dibuat otomatis oleh `scripts/screenshot.mjs` pada `2026-08-20T08:35:34.668Z`.

## Cara menjalankan

```
pnpm --filter legacy dev          # terminal 1
node scripts/screenshot.mjs    # terminal 2 (mengosongkan folder screenshots/ dulu)
```

Folder `screenshots/` **selalu dikosongkan** setiap kali skrip dijalankan, lalu seluruh
tangkapan + dokumen ini diregenerasi. Semua data adalah tiruan (mock) - tidak ada backend.

## Inventaris Skenario (penomoran global)

## Publik

| # | Skenario | Rute | Tangkapan | Status |
|---|---|---|---|---|
| 1 | Landing Page | `/landing` | `pub-landing.png` | ok |
| 2 | Masuk (Login) | `/auth/login` | `pub-login.png` | ok |
| 3 | Daftar Akun | `/auth/register` | `pub-register.png` | ok |
| 4 | Lupa Kata Sandi | `/auth/forgot-password` | `pub-forgot-password.png` | ok |
| 5 | Katalog Pelatihan | `/courses` | `pub-catalog.png` | ok |
| 6 | Detail Pelatihan (Gratis, Dibuka) | `/courses/course-1` | `pub-course-detail-free.png` | ok |
| 7 | Detail Pelatihan Berbayar | `/courses/course-4` | `pub-course-detail-paid.png` | ok |
| 8 | Alur Pendaftaran Berbayar - Dialog Kupon | `/courses/course-4` | `pub-course-coupon-dialog.png` | ok |
| 9 | Verifikasi Sertifikat - Form Kosong | `/certificates/viewer` | `pub-cert-verify-empty.png` | ok |
| 10 | Verifikasi Sertifikat - Valid | `/certificates/viewer?code=SKR-482913` | `pub-cert-verify-valid.png` | ok |
| 11 | Verifikasi Sertifikat - Tidak Ditemukan | `/certificates/viewer?code=INVALID-0000` | `pub-cert-verify-invalid.png` | ok |

## Peserta

| # | Skenario | Rute | Tangkapan | Status |
|---|---|---|---|---|
| 12 | Beranda Peserta (Dashboard) | `/app/student` | `stu-home.png` | ok |
| 13 | Pelatihan Saya | `/app/student/my-learning` | `stu-my-learning.png` | ok |
| 14 | Wishlist | `/app/student/wishlist` | `stu-wishlist.png` | ok |
| 15 | Layar Belajar (Course Player) | `/app/student/courses/course-1/player` | `stu-player.png` | ok |
| 16 | Kuis - Layar Intro | `/app/student/courses/course-1/quiz/quiz-1` | `stu-quiz-intro.png` | ok |
| 17 | Kuis - Hasil (Gagal + Coba Lagi) | `/app/student/courses/course-1/quiz/quiz-1` | `stu-quiz-result.png` | ok |
| 18 | Presensi - Check-In Peserta | `/app/student/courses/course-1/attendance` | `stu-attendance-checkin.png` | ok |
| 19 | Tugas - Kumpulkan (Form + Upload) | `/app/student/courses/course-1/assignments/assignment-1` | `stu-assignment-submit.png` | ok |
| 20 | Papan Diskusi | `/app/student/courses/course-1/discussions` | `stu-discussion-board.png` | ok |
| 21 | Benang Diskusi (Thread) | `/app/student/courses/course-1/discussions/discussion-1` | `stu-discussion-thread.png` | ok |
| 22 | Buat Diskusi | `/app/student/courses/course-1/discussions/new` | `stu-discussion-new.png` | ok |
| 23 | Daftar Tes Asesmen | `/app/student/assessments` | `stu-assessments-list.png` | ok |
| 24 | Ikuti Tes Asesmen | `/app/student/assessments/assessment-1` | `stu-assessment-take.png` | ok |
| 25 | Hasil Tes Asesmen (RIASEC) | `/app/student/assessments/assessment-1/result/result-1-2` | `stu-assessment-result.png` | ok |
| 26 | Inbox Notifikasi | `/app/student/notifications` | `stu-notifications.png` | ok |
| 27 | Analitik Pembelajaran | `/app/student/analytics` | `stu-analytics.png` | ok |
| 28 | Profil Peserta | `/app/student/profile` | `stu-profile.png` | ok |
| 29 | Pengaturan | `/app/student/settings` | `stu-settings.png` | ok |
| 30 | Skenario Tombol Daftar (15 Status) | `/app/student/enroll-states` | `stu-enroll-states.png` | ok |
| 31 | Lihat Sertifikat | `/certificates/course-1` | `stu-certificate.png` | ok |

## Instruktur

| # | Skenario | Rute | Tangkapan | Status |
|---|---|---|---|---|
| 32 | Dashboard Instruktur | `/app/instructor` | `ins-dashboard.png` | ok |
| 33 | Kelola Pelatihan (Daftar) | `/app/instructor/courses` | `ins-course-list.png` | ok |
| 34 | Buat Pelatihan (Form Lengkap) | `/app/instructor/courses/new` | `ins-course-new.png` | ok |
| 35 | Editor Pelatihan - Tab Detail | `/app/instructor/courses/course-1/editor?tab=details` | `ins-editor-details.png` | ok |
| 36 | Editor Pelatihan - Tab Peserta | `/app/instructor/courses/course-1/editor?tab=peserta` | `ins-editor-peserta.png` | ok |
| 37 | Editor Pelatihan - Tab Presensi | `/app/instructor/courses/course-1/editor?tab=presensi` | `ins-editor-presensi.png` | ok |
| 38 | Editor Pelatihan - Tab Sertifikat | `/app/instructor/courses/course-1/editor?tab=sertifikat` | `ins-editor-sertifikat.png` | ok |
| 39 | Editor Pelatihan - Tab Konten | `/app/instructor/courses/course-1/editor?tab=content` | `ins-editor-konten.png` | ok |
| 40 | Editor Pelatihan - Tab Diskusi | `/app/instructor/courses/course-1/editor?tab=diskusi` | `ins-editor-diskusi.png` | ok |
| 41 | Editor Pelatihan - Tab Kuis | `/app/instructor/courses/course-1/editor?tab=quiz` | `ins-editor-kuis.png` | ok |
| 42 | Editor Pelatihan - Tab Penilaian (Tugas) | `/app/instructor/courses/course-1/editor?tab=assessments` | `ins-editor-penilaian.png` | ok |
| 43 | Editor Pelatihan - Tab Instruktur | `/app/instructor/courses/course-1/editor?tab=settings` | `ins-editor-instruktur.png` | ok |
| 44 | Edit Pelatihan (Form) | `/app/instructor/courses/course-1/edit` | `ins-course-edit.png` | ok |
| 45 | Buat Tugas (Form) | `/app/instructor/courses/course-1/assignments/new` | `ins-assignment-new.png` | ok |
| 46 | Edit Tugas | `/app/instructor/courses/course-1/assignments/assignment-1` | `ins-assignment-edit.png` | ok |
| 47 | Nilai Pengumpulan (Grading) | `/app/instructor/courses/course-1/assignments/assignment-1/grading` | `ins-assignment-grading.png` | ok |
| 48 | Buat Kuis (Builder) | `/app/instructor/courses/course-1/quizzes/new` | `ins-quiz-new.png` | ok |
| 49 | Edit Kuis | `/app/instructor/courses/course-1/quizzes/quiz-1` | `ins-quiz-edit.png` | ok |
| 50 | Daftar Kupon | `/app/instructor/courses/course-1/coupons` | `ins-coupon-list.png` | ok |
| 51 | Buat Kupon (Form) | `/app/instructor/courses/course-1/coupons/new` | `ins-coupon-new.png` | ok |
| 52 | Daftar Pengumuman | `/app/instructor/courses/course-1/announcements` | `ins-announcement-list.png` | ok |
| 53 | Buat Pengumuman (Form) | `/app/instructor/courses/course-1/announcements/new` | `ins-announcement-new.png` | ok |
| 54 | Layar Presensi (Kiosk QR) | `/app/instructor/attendance/att-session-07/display` | `ins-attendance-display.png` | ok |

## Admin

| # | Skenario | Rute | Tangkapan | Status |
|---|---|---|---|---|
| 55 | Dashboard Admin | `/app/admin` | `adm-dashboard.png` | ok |
| 56 | Manajemen Institusi | `/app/admin/institutions` | `adm-institutions.png` | ok |
| 57 | Pelatihan Institusi | `/app/admin/institutions/institution-1/courses` | `adm-institution-courses.png` | ok |

## Index / Galeri

| # | Skenario | Rute | Tangkapan | Status |
|---|---|---|---|---|
| 0 | Index Blok Mockup | `/` | `index.png` | ok |

## Semua Rute yang Tersedia dan Skenario yang Menggunakannya

Kolom "Skenario #" memuat nomor skenario yang mengunjungi rute tersebut (langsung atau
melalui rute turunannya, mis. `?tab=` pada editor). "-" berarti rute hanya dicapai lewat
navigasi internal, bukan skenario berdiri sendiri.

| Rute | Skenario # |
|---|---|
| `/` | 0 |
| `/app` | - |
| `/app/admin` | 55 |
| `/app/admin/institutions` | 56 |
| `/app/admin/institutions/[institutionId]/courses` | 57 |
| `/app/instructor` | 32 |
| `/app/instructor/attendance/[sessionId]/display` | 54 |
| `/app/instructor/courses` | 33 |
| `/app/instructor/courses/[courseId]/announcements` | 52 |
| `/app/instructor/courses/[courseId]/announcements/new` | 53 |
| `/app/instructor/courses/[courseId]/assignments/[assignmentId]` | 46 |
| `/app/instructor/courses/[courseId]/assignments/[assignmentId]/grading` | 47 |
| `/app/instructor/courses/[courseId]/assignments/new` | 45 |
| `/app/instructor/courses/[courseId]/coupons` | 50 |
| `/app/instructor/courses/[courseId]/coupons/new` | 51 |
| `/app/instructor/courses/[courseId]/edit` | 44 |
| `/app/instructor/courses/[courseId]/editor` | 35, 36, 37, 38, 39, 40, 41, 42, 43 |
| `/app/instructor/courses/[courseId]/quizzes/[quizId]` | 49 |
| `/app/instructor/courses/[courseId]/quizzes/new` | 48 |
| `/app/instructor/courses/new` | 34 |
| `/app/student` | 12 |
| `/app/student/analytics` | 27 |
| `/app/student/assessments` | 23 |
| `/app/student/assessments/[assessmentId]` | 24 |
| `/app/student/assessments/[assessmentId]/result/[resultId]` | 25 |
| `/app/student/courses/[courseId]/assignments/[assignmentId]` | 19 |
| `/app/student/courses/[courseId]/attendance` | 18 |
| `/app/student/courses/[courseId]/discussions` | 20 |
| `/app/student/courses/[courseId]/discussions/[discussionId]` | 21 |
| `/app/student/courses/[courseId]/discussions/new` | 22 |
| `/app/student/courses/[courseId]/player` | 15 |
| `/app/student/courses/[courseId]/quiz/[quizId]` | 16, 17 |
| `/app/student/enroll-states` | 30 |
| `/app/student/my-learning` | 13 |
| `/app/student/notifications` | 26 |
| `/app/student/profile` | 28 |
| `/app/student/settings` | 29 |
| `/app/student/wishlist` | 14 |
| `/auth/forgot-password` | 4 |
| `/auth/login` | 2 |
| `/auth/register` | 3 |
| `/certificates/[courseId]` | 31 |
| `/certificates/viewer` | 9, 10, 11 |
| `/courses` | 5 |
| `/courses/[courseId]` | 6, 7, 8 |
| `/landing` | 1 |

> `/app` adalah alias yang mengalihkan (`redirect`) ke `/app/student`.

## Catatan

- Semua tanggal mock memakai titik acuan tetap (2026-08-18) sehingga deterministik antar-render.
- Sesi presensi aktif pada mock adalah `att-session-07` (kode verifikasi `482913`).
- Kupon valid untuk demo alur berbayar: `LMS10` (10%), `DISNFO` (Rp50.000), `GRATIS` (100%).
- Kode verifikasi sertifikat yang terdaftar: `SKR-482913`.
- Perbaikan alur pengguna yang telah diterapkan: tautan "Lupa kata sandi" kini menuju halaman
  pemulihan, Profil/Pengaturan tidak lagi menuju index, alur bayar+kupon dapat dicapai dari
  katalog, tombol "Tambah Pelatihan" menuju form, halaman verifikasi sertifikat publik dibuat,
  dan semua status tombol daftar didemonstrasikan di `/app/student/enroll-states`.
