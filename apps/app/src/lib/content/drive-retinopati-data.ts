import type { CourseDefinition } from "./course-types"

export const DRIVE_RETINOPATHY_COURSE: CourseDefinition = {
  schemaVersion: 1,
  id: "drive-retinopati",
  title: "DRIVE — Skrining Retinopati Diabetika untuk Dokter Layanan Primer",
  language: "id-ID",
  brand: {
    name: "DRIVE School",
    mark: "👁",
  },
  passingScore: 0.7,
  assessment: {
    mode: "formative",
  },
  modules: [
    {
      id: "pengantar",
      label: "Pengantar",
      pages: [
        {
          id: "pengantar-p1",
          slide: 1,
          type: "hero",
          title: "Pelatihan Skrining Retinopati Diabetika",
          body: "Modul 1 — Pengenalan Diabetes dan Retinopati Diabetika: definisi, epidemiologi, dan beban penyakit — dilengkapi narasi otomatis dan simulasi grading fundus interaktif untuk dokter layanan primer.",
          transcript:
            "Selamat datang di Modul 1 Pengenalan Diabetes dan Retinopati Diabetika pada Pelatihan Skrining Retinopati Diabetika dalam program DRIVE, Diabetic Retinopathy Initiatives. Dalam modul ini, kita akan berkenalan dengan dua penyakit yang saling berkaitan erat, yaitu diabetes mellitus sebagai penyakit dasarnya dan retinopati diabetika sebagai salah satu komplikasinya di mata.",
        },
        {
          id: "pengantar-p2",
          slide: 2,
          type: "content",
          kicker: "DAFTAR ISI",
          title: "Cakupan Modul Pengenalan Diabetes & Retinopati Diabetika",
          body: "1. Diabetes Mellitus (Definisi, Patogenesis, Epidemiologi, Klasifikasi, Faktor Risiko, Diagnosis, Komplikasi)\n2. Retinopati Diabetika (Anatomi, Definisi, Beban Penyakit, Patofisiologi, Gejala, Faktor Risiko)\n3. Skrining dan Tatalaksana RD (Deteksi Dini vs Skrining, Natural History, ECIM, Tantangan, Jadwal, Tatalaksana, Rujukan)\n4. Evaluasi & Quiz Kompetensi",
          transcript:
            "Modul 1 terbagi menjadi empat bagian. Bagian pertama membahas diabetes mellitus sebagai penyakit yang mendasari. Bagian kedua membahas retinopati diabetika atau RD. Bagian ketiga membahas skrining dan tatalaksana RD. Terakhir, bagian keempat berisi quiz untuk menguji pemahaman Anda. Setelah menyelesaikan modul ini, Anda diharapkan memahami hubungan antara diabetes dan retinopati diabetika, mengerti pentingnya skrining berkala, dan tahu kapan seorang pasien perlu dirujuk ke dokter spesialis mata.",
        },
      ],
    },
    {
      id: "modul1",
      label: "Modul 1 — Diabetes Mellitus",
      pages: [
        {
          id: "modul1-p1",
          slide: 3,
          type: "divider",
          kicker: "BAB 1",
          title: "DIABETES MELLITUS",
          transcript: "Bab 1, Diabetes Mellitus.",
        },
        {
          id: "modul1-p2",
          slide: 4,
          type: "content",
          kicker: "DEFINISI",
          title: "Apa itu Diabetes Mellitus?",
          body: "Diabetes mellitus (DM) merupakan sekelompok penyakit metabolik dengan karakteristik hiperglikemia, yang menandakan abnormalitas proses metabolisme karbohidrat.\n\nKondisi ini diakibatkan oleh gangguan pada sekresi insulin, kerja insulin, ataupun keduanya.\n\n• Hiperglikemia kronis adalah penanda utama — sekaligus pemicu komplikasi mikro- dan makrovaskular.",
          transcript:
            "Apa itu diabetes mellitus? Menurut pedoman PERKENI 2021, diabetes mellitus atau DM adalah sekelompok penyakit metabolik dengan ciri utama hiperglikemia, yaitu kadar glukosa darah yang tinggi. Hiperglikemia ini menandakan adanya gangguan dalam proses metabolisme karbohidrat di dalam tubuh. Kondisi ini diakibatkan oleh gangguan sekresi insulin, gangguan kerja insulin, atau gabungan keduanya. Kita bisa membayangkan insulin sebagai “kunci” yang membuka pintu sel agar glukosa dari darah bisa masuk dan dipakai sebagai energi. Hiperglikemia kronis adalah penanda utama DM, sekaligus pemicu terjadinya komplikasi, baik mikrovaskular seperti retinopati, nefropati, dan neuropati, maupun makrovaskular seperti penyakit jantung koroner dan stroke. The Egregious Eleven dari Schwartz dan kawan-kawan menunjukkan bahwa hiperglikemia pada DM tipe 2 melibatkan sebelas mekanisme. Pertama, berkurangnya sekresi insulin oleh sel beta pancreas. Kedua, respons insulin tidak lagi optimal karena efek inkretin yang menurun. Ketiga, sel alfa pankreas yang meningkatkan sekresi glukagon. Keempat, sel lemak yang mengalami peningkatan lipolisis. Kelima, terjadinya penurunan penggunaan glukosa oleh otot akibat kurang responsifnya otot skeletal terhadap insulin. Keenam, resistensi insulin dan peningkatan sekresi glukagon ini menyebabkan hati melakukan glukoneogenesis. Ketujuh, gangguan neurotransmiter pada otak menyebabkan gangguan regulasi nafsu makan. Kedelapan, pada kolon terjadi perubahan mikrobiota yang mempengaruhi metabolisme dan permeabilitas usus. Kesembilan, disregulasi sistem imun dan media terinflamasi memperburuk resistensi insulin dan merusak fungsi sel beta. Kesepuluh, terjadi pengosongan lambung dan usus halus yang lebih cepat sehingga glukosa lebih cepat diserap. Dan kesebelas, pada ginjal terjadi peningkatan reabsorpsi glukosa di tubulus ginjal sehingga menahan glukosa tidak keluar melalui urin. Dengan demikian, diabetes mellitus, khususnya diabetes tipe 2, merupakan kondisi yang kompleks dan melibatkan interaksi berbagai organ.",
          image: "/content/drive-retinopati/assets/v42_image1.png",
          imageLayout: "below",
          imageCaption: "The Egregious Eleven (diadaptasi dari Schwartz, Diabetes Care 2016 & PERKENI 2021).",
        },
        {
          id: "modul1-p3",
          slide: 5,
          type: "cards",
          kicker: "EPIDEMIOLOGI",
          title: "Prevalensi & Proyeksi Kasus DM",
          intro:
            "Beban diabetes global terus meningkat — dan Indonesia termasuk negara dengan kasus terbanyak (IDF Diabetes Atlas 11th ed 2025).",
          transcript:
            "Menurut International Diabetes Federation, pada tahun 2024 terdapat sekitar 588,7 juta orang dewasa usia 20–79 tahun yang hidup dengan diabetes di seluruh dunia. Artinya, hampir 1 dari 9 orang dewasa di dunia menyandang diabetes. Angka ini diproyeksikan meningkat sekitar 45% menjadi 852,5 juta pada tahun 2050. Bagaimana dengan Indonesia? Indonesia termasuk negara dengan jumlah penyandang diabetes terbanyak kelima di dunia, yaitu sekitar 20,4 juta orang dewasa pada tahun 2024, dengan prevalensi 11,3%.",
          columns: 3,
          cards: [
            {
              big: "588,7 juta",
              body: "penderita DM di dunia usia 20–79 tahun (2024)",
            },
            {
              big: "852,5 juta (↑ 45%)",
              body: "proyeksi kasus global pada tahun 2050",
            },
            {
              big: "Peringkat 5",
              body: "negara dengan penderita DM terbanyak di dunia",
              dark: true,
            },
            {
              big: "20,4 juta",
              body: "penderita DM di Indonesia (2024)",
            },
            {
              big: "11,3%",
              body: "prevalensi penduduk Indonesia usia 20–79 tahun",
            },
          ],
          trailingImage: "/content/drive-retinopati/assets/v42_image2.jpeg",
          trailingCaption: "Distribusi global prevalensi diabetes mellitus (IDF Diabetes Atlas 2025).",
        },
        {
          id: "modul1-p4",
          slide: 6,
          type: "content",
          kicker: "KLASIFIKASI",
          title: "DM Berdasarkan Etiologi",
          body: "Berdasarkan etiologinya, diabetes mellitus diklasifikasikan menjadi 4 kelompok utama (PERKENI 2021 & AAO BCSC 2025):\n\n1. DM Tipe 1: Destruksi sel beta pankreas oleh sistem imun (autoimun) → defisiensi insulin absolut.\n2. DM Tipe 2: Resistensi insulin dengan penurunan sekresi insulin progresif hingga defisiensi relatif.\n3. DM Gestasional: Resistensi insulin dipicu hormon plasenta pada masa kehamilan.\n4. DM Tipe Lain: Kelainan genetik (MODY), penyakit eksokrin pankreas, endokrinopati, obat/zat kimia.",
          transcript:
            "Berdasarkan etiologinya, diabetes mellitus diklasifikasikan menjadi 4 Pertama, DM Tipe 1. Kondisi ini terjadi karena destruksi sel beta pankreas oleh sistem imun yang merupakan proses autoimun pada Pulau Langerhans, yang merusak sel-sel beta tersebut. Akibat kerusakan permanen ini, tubuh tidak lagi mampu menghasilkan insulin, yang berujung pada defisiensi insulin absolut, di mana sel-sel tubuh sama sekali tidak mendapatkan pasokan insulin yang dibutuhkan. Kedua, DM Tipe 2. Kondisi ini bermula dari resistensi insulin, di mana pankreas masih memproduksi insulin, namun sel-sel tubuh tidak meresponsnya dengan baik. Untuk mengompensasi kondisi tersebut, sel beta pankreas bekerja terlalu keras guna menghasilkan lebih banyak insulin, hingga akhirnya sel-sel tersebut mengalami kelelahan. Pada tahap lanjut, kelelahan ini menyebabkan penurunan fungsi yang drastis, hingga terjadi defisiensi insulin relatif atau absolut di mana pasokan insulin tidak lagi mencukupi kebutuhan sel tubuh. Ketiga, DM Gestasional. Kondisi ini dipicu oleh peningkatan hormon kehamilan yang diproduksi oleh plasenta. Hormon-hormon ini menyebabkan peningkatan resistensi insulin pada tubuh ibu hamil. Jika resistensi tersebut tidak terkontrol, kadar glukosa dalam darah ibu hamil akan melonjak tinggi, dan glukosa yang berlebihan tersebut akan menembus plasenta untuk dialirkan langsung ke janin, yang dapat memengaruhi pertumbuhan dan kesehatan bayi. Keempat, DM Tipe Lain. Merupakan kelompok diabetes yang disebabkan oleh berbagai faktor spesifik eksternal maupun internal, seperti Maturity-Onset Diabetes of the Young (MODY), gangguan eksokrin pankreas, endokrinopati, induksi obat atau zat kimia, infeksi, sebab imunologi, serta kelainan atau mutasi genetik lainnya.",
          image: "/content/drive-retinopati/assets/v42_image3.png",
          imageCaption: "Klasifikasi etiologi diabetes mellitus (PERKENI 2021).",
        },
        {
          id: "modul1-p5",
          slide: 7,
          type: "content",
          kicker: "FAKTOR RISIKO",
          title: "Faktor Risiko Diabetes Mellitus",
          body: "Individu dengan Indeks Massa Tubuh (IMT) ≥ 23 kg/m² disertai minimal satu faktor risiko berikut:",
          transcript:
            "Adapun faktor risiko terjadinya diabetes mellitus adalah individu dengan indeks massa tubuh 23 kg/m² atau lebih, yang disertai minimal satu faktor risik lain, yaitu Satu, aktivitas fisik yang kurang, yang dapat memperburuk resistensi insulin. Dua, riwayat keluarga dengan diabetes, terutama keluarga derajat pertama seperti orang tua atau saudara kandung. Tiga, ras atau etnis tertentu yang memang lebih rentan. Empat, perempuan dengan riwayat melahirkan bayi dengan berat lahir lebih dari 4 kg atau pernah didiagnosis DM gestasional. Lima, hipertensi, yaitu tekanan darah 140/90 mmHg atau lebih, atau sedang dalam pengobatan antihipertensi. Enam, dislipidemia, yaitu HDL kurang dari 35 mg/dL dan/atau trigliserida lebih dari 250 mg/dL. Tujuh, perempuan dengan sindrom ovarium polikistik atau PCOS. Delapan, memiliki riwayat prediabetes, yaitu toleransi glukosa terganggu atau glukosa darah puasa terganggu. Sembilan, obesitas berat dan akantosis nigrikans, yaitu kulit yang menebal dan menggelap di lipatan leher atau ketiak sebagai tanda resistensi insulin. Sepuluh, memiliki riwayat penyakit kardiovaskular. Selain itu, PERKENI juga menganjurkan pemeriksaan skrining diabetes pada individu berusia di atas 45 tahun, meskipun tanpa faktor risiko di atas. Bila hasilnya normal, pemeriksaan pada kelompok risiko tinggi sebaiknya diulang setiap 3 tahun, sedangkan pada kelompok prediabetes diulang setiap tahun.",
          reveal_steps: [
            { texts: ["a. Aktivitas fisik kurang (memperburuk resistensi insulin)"] },
            { texts: ["b. Riwayat keluarga (keturunan) diabetes derajat pertama"] },
            { texts: ["c. Ras / etnis tertentu dengan kerentanan metabolik tinggi"] },
            { texts: ["d. Riwayat melahirkan bayi > 4 kg atau riwayat DM gestasional"] },
            { texts: ["e. Hipertensi (tekanan darah ≥ 140/90 mmHg atau terapi antihipertensi)"] },
            { texts: ["f. Dislipidemia (HDL < 35 mg/dL dan/atau trigliserida > 250 mg/dL)"] },
            { texts: ["g. Perempuan dengan sindrom ovarium polikistik (PCOS)"] },
            { texts: ["h. Riwayat prediabetes (toleransi glukosa terganggu / GDPT)"] },
            { texts: ["i. Obesitas berat dan akantosis nigrikans (tanda resistensi insulin)"] },
            { texts: ["j. Riwayat penyakit kardiovaskular aterosklerotik"] },
          ],
        },
        {
          id: "modul1-p6",
          slide: 8,
          type: "content",
          kicker: "DIAGNOSIS",
          title: "Kriteria Diagnosis Diabetes Mellitus",
          body: "Diagnosis diabetes mellitus ditegakkan bila memenuhi salah satu dari 4 kriteria laboratorium standar (PERKENI 2021):\n\n1. Glukosa Plasma Puasa (GDP) ≥ 126 mg/dL (puasa minimal 8 jam).\n2. Glukosa Plasma 2 Jam Post-TTGO ≥ 200 mg/dL (beban glukosa anhidrat 75 gram).\n3. Glukosa Plasma Sewaktu (GDS) ≥ 200 mg/dL disertai gejala klasik (poliuria, polidipsia, polifagia, BB turun drastis).\n4. Pemeriksaan HbA1c ≥ 6,5% dengan metode terstandarisasi NGSP.",
          transcript:
            "Dalam mendiagnosis diabetes mellitus, diagnosis ditegakkan bila memenuhi satu dari empat kriteria. Kriteria pertama, pemeriksaan glukosa plasma puasa. Yaitu kadar glukosa plasma puasa menunjukkan angka 126 mg/dL atau lebih yang diukur pada kondisi puasa minimal selama 8 jam. Kriteria kedua, pemeriksaan glukosa plasma 2 jam post prandial atau setelah Tes Toleransi Glukosa Oral dengan beban glukosa 75 gram. Yaitu kadar glukosa plasma setelah 2 jam menunjukkan angka 200 mg/dL atau lebih. Kriteria ketiga, pemeriksaan glukosa plasma sewaktu. Yaitu kadar glukosa plasma sewaktu menunjukkan angka 200 mg/dL atau lebih, disertai gejala klasik diabetes yaitu poliuria, polifagia, polidipsia, dan penurunan berat badan yang tidak dapat dijelaskan penyebabnya. Kriteria keempat, pemeriksaan HbA1c. Yaitu kadar HbA1c menunjukkan angka 6,5% atau lebih.",
          image: "/content/drive-retinopati/assets/v42_image4.png",
          imageCaption: "Algoritma pemeriksaan dan kriteria diagnostik DM (PERKENI 2021).",
        },
        {
          id: "modul1-p7",
          slide: 9,
          type: "content",
          kicker: "DIAGNOSIS",
          title: "Klasifikasi Glukosa & HbA1c",
          body: "Interpretasi hasil pemeriksaan laboratorium metabolik glukosa:\n\n• Normal: GDP < 100 mg/dL, 2 jam TTGO < 140 mg/dL, HbA1c < 5,7%.\n• Prediabetes: GDP 100–125 mg/dL, 2 jam TTGO 140–199 mg/dL, HbA1c 5,7–6,4%.\n• Diabetes Mellitus: GDP ≥ 126 mg/dL, 2 jam TTGO ≥ 200 mg/dL, HbA1c ≥ 6,5%.",
          transcript:
            "Berdasarkan hasil pemeriksaan laboratorium, individu dapat dibedakan menjadi 3 kategori, yaitu diabetes, prediabetes, dan normal. Kategori diabetes jika ditemukan HbA1c 6,5% atau lebih, glukosa darah puasa 126 mg/dL atau lebih, atau glukosa 2 jam setelah TTGO 200 mg/dL atau lebih. Kategori prediabetes jika ditemukan HbA1c 5,7–6,4%, glukosa darah puasa 100–125 mg/dL, atau glukosa 2 jam setelah TTGO 140–199 mg/dL. Kategori normal jika ditemukan HbA1c di bawah 5,7%, glukosa darah puasa 70–99 mg/dL, dan glukosa 2 jam setelah TTGO 70–139 mg/dL. Namun terdapat beberapa kondisi tertentu di mana pemeriksaan HbA1c tidak dapat diinterpretasikan secara valid pada keadaan yang mempengaruhi masa hidup eritrosit atau struktur hemoglobin, yaitu anemia, hemoglobinopati, riwayat transfusi darah dalam 2–3 bulan terakhir, dan gangguan fungsi ginjal. Pada kondisi-kondisi ini, HbA1c tidak dapat dipakai sebagai alat diagnosis maupun evaluasi, sehingga kita berpegang pada pemeriksaan glukosa plasma.",
          image: "/content/drive-retinopati/assets/v42_image5.png",
          imageCaption: "Tabel klasifikasi kadar glukosa darah puasa, 2 jam TTGO, dan HbA1c (PERKENI 2021).",
        },
        {
          id: "modul1-p8",
          slide: 10,
          type: "content",
          kicker: "KOMPLIKASI",
          title: "Komplikasi Diabetes Mellitus",
          body: "Hiperglikemia kronis memicu kerusakan vaskular sistemik yang luas:\n\n• Komplikasi Mikrovaskular: Retinopati Diabetika (mata), Nefropati Diabetika (ginjal), Neuropati Diabetika (saraf perifer).\n• Komplikasi Makrovaskular: Penyakit Jantung Koroner, Stroke, Penyakit Arteri Perifer (ulkus & gangren).",
          transcript:
            "Bagan ini menggambarkan alur terjadinya komplikasi diabetes mellitus yang berakar dari hiperglikemia kronis. Hiperglikemia yang berlangsung lama akan merusak pembuluh darah yang dibagi dalam dua kategori, yaitu makroangiopati dan mikroangiopati. Makroangiopati adalah kerusakan pembuluh darah besar yang dipicu oleh proses aterosklerosis yang berisiko menimbulkan penyakit kardiovaskular seperti penyakit jantung, stroke, dan penyakit arteri perifer. Mikroangiopati adalah kerusakan pembuluh darah kecil, yang meliputi retinopati yaitu kerusakan pada pembuluh darah retina mata yang berujung pada gangguan penglihatan hingga kebutaan. Neuropati, yaitu kerusakan pada serabut saraf yang dapat bermanifestasi sebagai ulkus atau luka pada kaki diabetik. Dan nefropati, yaitu gangguan filtrasi pada glomerulus ginjal yang ditandai dengan kebocoran protein pada urin dan berpotensi menyebabkan gagal ginjal. Semakin lama individu menyandang diabetes, semakin besar pula peluang munculnya komplikasi sehingga pemeriksaan rutin dalam mendeteksi kejadian komplikasi ini.",
          image: "/content/drive-retinopati/assets/v42_image6.png",
          imageCaption: "Bagan patogenesis komplikasi mikrovaskular dan makrovaskular diabetes.",
        },
      ],
    },
    {
      id: "modul2",
      label: "Modul 2 — Retinopati Diabetika",
      pages: [
        {
          id: "modul2-p1",
          slide: 11,
          type: "divider",
          kicker: "BAB 2",
          title: "RETINOPATI DIABETIKA",
          transcript: "Bab 2, Retinopati Diabetika.",
        },
        {
          id: "modul2-p2",
          slide: 12,
          type: "hotspot",
          kicker: "ANATOMI",
          title: "Anatomi Mata & Struktur Retina",
          intro:
            "Jelajahi struktur bola mata dan lapisan retina. Klik tiap nomor hotspot untuk mempelajari fungsi anatomi dan relevansi klinisnya pada retinopati diabetika.",
          image: "/content/drive-retinopati/assets/v42_image9.png",
          transcript:
            "Retina adalah lapisan tipis neurosensoris yang melapisi bagian dalam bola mata. Retina berfungsi menangkap stimulus cahaya yang masuk ke dalam mata dan mengubahnya menjadi impuls bioelektrik lalu meneruskannya ke korteks visual di otak melalui nervus optikus. Retina terdiri dari komponen neurosensoris dan pembuluh darah. Bagian retina yang paling penting adalah makula, yaitu area berdiameter sekitar 5,5 mm di bagian tengah retina. Di pusat makula terdapat fovea, berdiameter sekitar 1,5 mm, yang berisi sel kerucut dengan kepadatan sangat tinggi, lebih dari 140.000 sel per mm². Fovea inilah yang membuat kita bisa membaca, mengenali wajah, dan melihat warna. Karena itu, edema di makula sangat cepat menurunkan tajam penglihatan. Dinding kapiler retina tersusun dari sel endotel yang saling terikat erat dan dikelilingi oleh sel perisit. Struktur inilah yang membentuk sawar darah-retina bagian dalam. Pada diabetes mellitus, terjadi kerusakan pada sawar darah retina, sehingga terjadi kebocoran dan penyumbatan yang merupakan manifestasi dari retinopati diabetika.",
          points: [
            {
              x: 4.88,
              y: 55.45,
              label: "Kornea",
              body: "Media refraksi terluar yang jernih; memfokuskan cahaya ke dalam bola mata.",
            },
            {
              x: 13.9,
              y: 72.82,
              label: "Iris",
              body: "Otot berpigmen yang mengatur diameter pupil dan jumlah cahaya masuk.",
            },
            {
              x: 26.69,
              y: 81.36,
              label: "Badan Siliar",
              body: "Menghasilkan akuos humor dan mengubah kelengkungan lensa saat akomodasi.",
            },
            {
              x: 46.12,
              y: 87.27,
              label: "Sklera",
              body: "Dinding terluar bola mata yang liat dan kokoh; memberi bentuk bola mata.",
            },
            {
              x: 67.24,
              y: 84.82,
              label: "Koroid",
              body: "Lapisan kaya pembuluh darah antara sklera dan retina yang memberi nutrisi retina luar.",
            },
            {
              x: 74.58,
              y: 79.55,
              label: "Retina",
              body: "Lapisan neurosensoris tipis yang menangkap cahaya — target utama kerusakan mikrovaskular pada RD.",
            },
            {
              x: 86.81,
              y: 64.91,
              label: "Makula",
              body: "Area sentral retina bertanggung jawab untuk penglihatan tajam dan warna; rawan edema makula.",
            },
            {
              x: 91.82,
              y: 56.45,
              label: "Fovea Sentralis",
              body: "Titik pusat makula dengan densitas kerucut tertinggi untuk tajam penglihatan 6/6.",
            },
            {
              x: 76.53,
              y: 25.82,
              label: "Saraf Optik",
              body: "Kabel transmisi visual dari sel ganglion retina menuju korteks visual otak.",
            },
            {
              x: 66.81,
              y: 20.36,
              label: "Diskus Optikus",
              body: "Muara saraf optik dan pembuluh darah retina (bintik buta fisiologis).",
            },
            {
              x: 57.08,
              y: 15.64,
              label: "Arteri & Vena Retina",
              body: "Sistem mikrovaskular retina yang rentan bocor, tersumbat, dan membentuk mikroaneurisma.",
            },
            {
              x: 19.86,
              y: 26.36,
              label: "Lensa",
              body: "Media refraksi bening yang mengkristal dan dapat mengalami katarak diabetika sekunder.",
            },
            {
              x: 12.36,
              y: 39.45,
              label: "Pupil",
              body: "Celah lubang masuknya cahaya; dapat dilebarkan dengan midriatikum untuk skrining fundus.",
            },
            { x: 8.75, y: 46.36, label: "Bilik Mata Depan", body: "Rongga berisi akuos humor antara kornea dan iris." },
            {
              x: 38.33,
              y: 52.18,
              label: "Badan Vitreus",
              body: "Gel bening pengisi rongga mata; dapat terisi darah pada komplikasi perdarahan vitreus RD berat.",
            },
            {
              x: 49.03,
              y: 23.36,
              label: "Ora Serrata",
              body: "Batas perifer bergerigi antara retina dan badan siliar.",
            },
            {
              x: 31.81,
              y: 34.09,
              label: "Kanal Hyaloid",
              body: "Saluran embrional sempit yang melintasi korpus vitreus dari diskus ke lensa.",
            },
          ],
        },
        {
          id: "modul2-p3",
          slide: 13,
          type: "content",
          kicker: "DEFINISI",
          title: "Apa itu Retinopati Diabetika?",
          body: "Retinopati diabetika (RD) adalah penyakit pada pembuluh darah mikrovaskular retina yang disebabkan oleh hiperglikemia kronis pada penyandang diabetes mellitus.\n\nKerusakan dinding kapiler menyebabkan kebocoran plasma, pembentukan mikroaneurisma, eksudasi lipid, perdarahan retina, dan iskemia jaringan.\n\n• Spektrum Klinis: Mulai dari tanpa RD → NPDR ringan → sedang → berat → Proliferatif (PDR) dengan neovaskularisasi yang berisiko tinggi menyebabkan kebutaan.",
          transcript:
            "Retinopati diabetika adalah penyakit pada pembuluh darah mikro retina yang bersifat kronik dan progresif, yang dapat mengancam penglihatan. Kerusakan kapiler retina akibat paparan hiperglikemia kronis menjadi pemicu utama kerusakan dinding kapiler mikrovaskular di retina. Kerusakan ini menyebabkan kebocoran cairan dan protein plasma serta penyumbatan kapiler yang menyebabkan kondisi hipoksia pada retina. Retina yang mengalami iskemia memicu pembentukan pembuluh darah baru atau neovaskularisasi abnormal. Meskipun insidensi dan prevalensi komplikasi ini terus meningkat seiring lonjakan populasi diabetes, risiko kebutaan akibat retinopati diabetika dapat dicegah apabila dideteksi dan ditangani secara dini. Retinopati diabetika berjalan progresif menurut klasifikasi International Clinical Diabetic Retinopathy Severity Scale atau ICDRS. Berawal dari retina normal berkembang menjadi nonproliferative diabetic retinopathy atau NPDR berlanjut menjadi NPDR sedang hingga berat dengan penambahan lesi perdarahan pada retina sampai akhirnya mencapai fase proliferative diabetic retinopathy atau PDR yang ditandai dengan terbentuknya neovaskularisasi, perdarahan vitreous, atau ablasi traksional. Dengan bertambahnya derajat keparahan retinopati diabetika maka risiko kebutaan semakin meningkat.",
          image: "/content/drive-retinopati/assets/v42_image10.png",
          imageCaption: "Gambaran fundus retina pada retinopati diabetika dengan eksudat keras dan mikroaneurisma.",
        },
        {
          id: "modul2-p4",
          slide: 14,
          type: "content",
          kicker: "BEBAN PENYAKIT",
          title: "Beban Penyakit Retinopati Diabetika",
          body: "• Sekitar 93 juta orang di dunia menderita retinopati diabetika (sepertiga populasi diabetes global).\n• Di Indonesia, prevalensi RD pada penyandang DM Tipe 2 mencapai 43,1%.\n• Sebanyak 26,1% di antaranya telah mencapai Vision-Threatening Diabetic Retinopathy (VTDR).\n• Penyebab utama kebutaan yang dapat dicegah pada usia produktif (25–74 tahun).",
          transcript:
            "Beban penyakit retinopati diabetika di dunia dilaporkan sebanyak 93 juta orang dengan perkiraan sekitar 28 juta orang di antaranya sudah mengalami retinopati diabetika yang mengancam penglihatan. Dinyatakan bahwa, sekitar sepertiga penyandang diabetes di dunia mengalami retinopati diabetika. Data di Indonesia dari penelitian Sasongko dan kawan-kawan menunjukkan prevalensi retinopati diabetika pada populasi usia 30 tahun ke atas dengan diabetes tipe 2 sebesar 43,1%, dengan 26,3% sudah mengalami retinopati diabetika yang mengancam penglihatan. Dengan kata lain, hampir separuh pasien diabetes tipe 2 menderita retinopati diabetika, dan 1 dari 4 penderita diabetes tipe 2 menderita retinopati diabetika yang mengancam penglihatan. Angka ini menunjukkan prevalensi retinopati diabetika di Indonesia melampaui angka rata-rata global. Temuan lain pada penelitian di Indonesia, risiko retinopati diabetika meningkat seiring lamanya menyandang diabetes dengan insidensi tertinggi ditemukan pada pasien dengan durasi diabetes lebih dari 10 tahun.",
          image: "/content/drive-retinopati/assets/chart_beban_rd.png",
          imageCaption: "Prevalensi blindness, VTDR, dan overall DR (%) di Indonesia, Asia-Pasifik, dan Global.",
        },
        {
          id: "modul2-p5",
          slide: 15,
          type: "hotspot",
          kicker: "PATOFISIOLOGI",
          title: "Patofisiologi Retinopati Diabetika",
          intro:
            "Klik tiap nomor 1 sampai 8 secara berurutan untuk menelusuri rantai patofisiologi, dari hiperglikemia kronik hingga neovaskularisasi proliferative.",
          image: "/content/drive-retinopati/assets/v42_image11.png",
          transcript:
            "Slide ini menjelaskan bagaimana RD terjadi. Mari kita ikuti alurnya dari kiri atas. Semuanya berawal dari hiperglikemia. Glukosa yang tinggi dalam waktu lama mengganggu berbagai jalur biokimia di dalam sel, antara lain meningkatkan stres oksidatif, pembentukan advanced glycation end products, serta aktivasi jalur protein kinase C dan kallikrein plasma. Akibatnya, dinding kapiler retina mengalami tiga perubahan penting yang tertera pada gambar, yaitu penebalan membran basal atau basement membrane thickening, hilangnya sel perisit atau pericyte loss, dan rusaknya ikatan antarsel endotel atau EC junction breakdown. Perisit adalah sel penyangga yang mengelilingi kapiler. Pada keadaan normal, jumlahnya kurang lebih sebanding dengan jumlah sel endotel. Ketika perisit hilang, dinding kapiler menjadi lemah dan menggelembung, membentuk mikroaneurisma atau bulging microaneurysm, yang merupakan tanda paling awal RD. Dari sini prosesnya bercabang dua. Cabang pertama adalah kebocoran. Sawar darah-retina yang rusak membuat plasma keluar dari pembuluh darah, yang disebut ekstravasasi plasma. Bila cairan ini menumpuk di makula, terjadilah edema makula, salah satu penyebab tersering penurunan penglihatan pada pasien DM. Lipoprotein plasma yang ikut keluar dapat mengendap dan tampak sebagai hard exudate. Cabang kedua adalah oklusi atau penyumbatan. Penebalan membran basal, kerusakan endotel, sel darah merah yang lebih mudah menggumpal, trombosit yang lebih lengket, serta leukosit yang menempel di dinding kapiler, yang disebut leukostasis, membuat kapiler tersumbat. Bagian retina yang tidak lagi mendapat aliran darah akan mengalami iskemia. Retina yang iskemik kemudian melepaskan VEGF, atau vascular endothelial growth factor, yang merangsang tumbuhnya pembuluh darah baru. Inilah tahap neovaskularisasi atau PDR. Masalahnya, pembuluh darah baru ini rapuh dan tumbuh di tempat yang salah. Seperti yang ditunjukkan pada gambar bola mata di bagian bawah, akibatnya bisa berupa perdarahan vitreus, ablasio retina traksional karena jaringan fibrovaskular yang menarik retina, dan glaukoma neovaskular bila pembuluh darah baru tumbuh di iris dan sudut bilik mata depan. Memahami alur ini juga membantu kita memahami terapinya. Kendali gula darah menghambat prosesnya dari hulu, laser mengurangi area retina yang iskemik, dan obat anti-VEGF menekan zat pemicu neovaskularisasi dan kebocoran.",
          points: [
            {
              x: 9.5,
              y: 16,
              label: "Hiperglikemia kronik",
              body: "Kadar glukosa darah yang tinggi dalam jangka panjang adalah pemicu awal seluruh rangkaian kerusakan pada dinding mikrovaskular retina.",
            },
            {
              x: 38,
              y: 13,
              label: "Kerusakan dinding kapiler",
              body: "Hiperglikemia merusak perisit, menebalkan membran basal, dan merusak tight junction sel endotel kapiler retina, membuat dinding pembuluh darah rapuh.",
            },
            {
              x: 28,
              y: 32.85,
              label: "Kebocoran kapiler",
              body: "Cairan plasma merembes keluar dari kapiler yang rusak (ekstravasasi plasma), menyebabkan penumpukan cairan di jaringan retina.",
            },
            {
              x: 47.87,
              y: 32.85,
              label: "Oklusi kapiler",
              body: "Sel darah putih menempel dan menyumbat kapiler retina (leukostasis), menghentikan aliran perfusi darah ke jaringan sekitarnya.",
            },
            {
              x: 28.75,
              y: 71.53,
              label: "Edema makula",
              body: "Cairan plasma yang bocor terkumpul di makula sentral, menyebabkan penglihatan kabur dan distorsi — penyebab utama penurunan tajam penglihatan pada RD.",
            },
            {
              x: 63.19,
              y: 41.53,
              label: "Iskemia retina",
              body: "Penyumbatan kapiler yang meluas menyebabkan jaringan retina mengalami hipoksia dan iskemia progresif.",
            },
            {
              x: 73.89,
              y: 40.62,
              label: "Peningkatan VEGF",
              body: "Retina yang iskemik melepaskan Vascular Endothelial Growth Factor (VEGF) dalam jumlah besar untuk merangsang vaskulogenesis darurat.",
            },
            {
              x: 90,
              y: 40.08,
              label: "Neovaskularisasi (PDR)",
              body: "Pembuluh darah baru yang rapuh tumbuh abnormal di permukaan retina dan diskus optik — stadium PDR dengan risiko tinggi perdarahan vitreus dan ablasio retina.",
            },
          ],
        },
        {
          id: "modul2-p6",
          slide: 16,
          type: "cards",
          kicker: "TANDA & GEJALA",
          title: "Gejala Klinis Retinopati Diabetika",
          intro:
            "Pada tahap awal, RD hampir selalu 100% ASIMTOMATIK. Gejala baru muncul bila telah timbul komplikasi makula atau vitreus:",
          transcript:
            "Apa saja gejala RD? Sebelum membahas keluhan yang ada di slide, ada satu hal paling penting yang perlu kita pegang: pada tahap awal, RD umumnya tidak bergejala sama sekali. Pasien bisa memiliki retinopati, bahkan yang sudah berat, tetapi tetap merasa penglihatannya baik selama makula dan media refraksinya belum terganggu. Sebuah studi di Joslin Diabetes Center menemukan bahwa 89% pasien dengan RD ringan dan 55% pasien dengan RD yang mengancam penglihatan tidak menyadari bahwa mereka memiliki penyakit mata. Jadi, tidak adanya keluhan bukan berarti tidak ada penyakit. Ketika gejala muncul, ada empat keluhan yang paling sering. Pertama, penglihatan kabur. Ini keluhan yang paling umum dan biasanya terjadi perlahan atau bertahap. Penyebab tersering adalah edema makula, yaitu penumpukan cairan di bagian pusat retina. Pada pasien DM, penglihatan kabur juga dapat disebabkan oleh perubahan refraksi akibat kadar gula yang naik turun, atau oleh katarak. Kedua, bintik hitam atau floaters, yaitu bayangan yang seolah melayang-layang di lapang pandang dan ikut bergerak saat mata bergerak. Pada RD, floaters biasanya disebabkan oleh darah di dalam vitreus yang berasal dari pembuluh darah baru yang pecah. Bayangan yang dilihat pasien sebenarnya adalah bayangan darah tersebut yang jatuh ke retina. Ketiga, kehilangan penglihatan mendadak. Keluhan ini khas pada perdarahan vitreus yang luas. Pasien biasanya merasa penglihatannya tiba-tiba gelap atau tertutup bayangan kemerahan. PDR merupakan salah satu penyebab tersering perdarahan vitreus pada orang dewasa. Penurunan penglihatan mendadak juga bisa terjadi pada ablasio retina traksional yang mengenai makula; pasien biasanya merasa ada bayangan seperti tirai yang menutupi sebagian lapang pandangnya. Keempat, distorsi penglihatan atau metamorfopsia, yaitu garis lurus tampak bengkok atau bergelombang. Keluhan ini khas pada edema makula, karena susunan fotoreseptor di makula menjadi tidak rata akibat penumpukan cairan. Distorsi ini dapat diperiksa dengan cara sederhana menggunakan kartu Amsler grid. Selain keempat keluhan tersebut, PNPK juga menyebutkan kilatan cahaya atau flashes, serta rasa nyeri pada atau di sekitar mata akibat tekanan bola mata yang meningkat pada glaukoma neovaskular. Pesan praktisnya: pasien DM dengan penurunan penglihatan mendadak, floaters baru yang banyak, bayangan seperti tirai, atau mata yang nyeri dan merah perlu segera dirujuk. Sementara itu, pasien DM tanpa keluhan tetap harus diskrining sesuai jadwal.",
          columns: 2,
          cards: [
            { title: "Penglihatan kabur", body: "Keluhan paling sering, umumnya bertahap akibat edema makula." },
            { title: "Bintik hitam / floaters", body: "Bayangan mengambang akibat kebocoran darah ke badan vitreus." },
            {
              title: "Kehilangan penglihatan mendadak",
              body: "Khas pada perdarahan vitreus masif atau ablasio retina traksional.",
            },
            {
              title: "Distorsi penglihatan (metamorfopsia)",
              body: "Garis lurus tampak bengkok akibat akumulasi cairan di bawah fovea sentralis.",
            },
          ],
        },
        {
          id: "modul2-p7",
          slide: 17,
          type: "content",
          kicker: "FAKTOR RISIKO",
          title: "Faktor Risiko Retinopati Diabetika",
          transcript:
            "Slide ini membahas enam faktor risiko utama RD. Secara garis besar, faktor-faktor ini dapat dibagi menjadi faktor yang dapat diubah, yaitu kendali gula darah, tekanan darah, dan kolesterol, serta faktor yang tidak dapat diubah, seperti durasi diabetes, kehamilan, dan faktor genetik. Pertama, durasi diabetes. Inilah prediktor terkuat: makin lama seseorang menyandang DM, makin tinggi risikonya. Data WESDR menunjukkan bahwa setelah 20 tahun, hampir semua penyandang DM tipe 1 dan sekitar 60% penyandang DM tipe 2 memiliki retinopati. PDR bahkan ditemukan pada sekitar 50% penyandang DM tipe 1 setelah 20 tahun. Kedua, kontrol glikemik. Semakin tinggi HbA1c, semakin tinggi risikonya. Studi DCCT pada DM tipe 1 menunjukkan bahwa kendali gula darah yang intensif menurunkan risiko munculnya retinopati sebesar 76% dan memperlambat progresinya sebesar 54%. PNPK juga menyebutkan bahwa setiap penurunan HbA1c sebesar 1% dapat menurunkan risiko RD sekitar 40%. Target yang dianjurkan untuk sebagian besar pasien adalah HbA1c di bawah 7%. Namun perlu diingat, penurunan gula darah yang terlalu cepat kadang justru memperburuk retinopati untuk sementara, sehingga pasien yang gula darahnya turun drastis juga perlu dipantau matanya. Ketiga, hipertensi. Tekanan darah tinggi memperberat kerusakan mikrovaskular retina. Studi UKPDS menunjukkan bahwa kendali tekanan darah memperlambat progresi retinopati dan penurunan penglihatan pada DM tipe 2. PNPK menyebutkan setiap penurunan tekanan darah sistolik 10 mmHg dapat menurunkan risiko RD sekitar 35%. Keempat, dislipidemia. Kadar kolesterol yang tinggi berhubungan dengan pembentukan hard exudate di retina dan meningkatkan risiko penurunan penglihatan akibat edema makula. Karena itu, pasien dengan banyak eksudat di makula perlu diperiksa profil lipidnya. Pada DM tipe 2, fenofibrat terbukti dapat memperlambat progresi RD. Kelima, kehamilan. Kehamilan dapat mempercepat progresi RD sekitar dua sampai tiga kali lipat. Risikonya lebih besar bila retinopati sudah ada sebelum hamil, gula darah sebelum hamil tidak terkontrol, gula darah diturunkan terlalu cepat di awal kehamilan, atau terjadi preeklampsia. Itulah sebabnya ibu hamil dengan DM tipe 1 atau tipe 2 perlu diperiksa lebih sering. Keenam, faktor genetik. Riwayat keluarga dan latar belakang etnis tertentu turut memengaruhi risiko. Beberapa variasi genetik, misalnya pada gen VEGF, diketahui berhubungan dengan kejadian RD, meskipun peran genetik ini masih terus diteliti. Selain keenam faktor ini, ada faktor lain yang juga memperburuk RD, seperti pubertas, nefropati diabetik yang berat, dan anemia. Pesan bagi kita: faktor-faktor yang dapat diubah inilah yang menjadi sasaran utama edukasi dan tatalaksana di layanan primer.",
          reveal_steps: [
            {
              image: "/content/drive-retinopati/assets/slide17_28.png",
              title: "Durasi diabetes",
              body: "Faktor prediktor terkuat. Makin lama menderita DM, makin tinggi prevalensi RD.",
            },
            {
              image: "/content/drive-retinopati/assets/slide17_29.png",
              title: "Kontrol glikemik",
              body: "HbA1c tinggi mempercepat timbulnya mikroaneurisma dan kerusakan kapiler.",
            },
            {
              image: "/content/drive-retinopati/assets/slide17_30.png",
              title: "Hipertensi",
              body: "Tekanan darah tinggi menambah stres hemodinamik pada mikrovaskular retina.",
            },
            {
              image: "/content/drive-retinopati/assets/slide17_31.png",
              title: "Dislipidemia",
              body: "Kadar lipid abnormal memicu pembentukan eksudat keras (hard exudates) di makula.",
            },
            {
              image: "/content/drive-retinopati/assets/slide17_32.png",
              title: "Kehamilan",
              body: "Perubahan hormonal dan hemodinamik dapat mempercepat progresi RD pada wanita DM.",
            },
            {
              image: "/content/drive-retinopati/assets/slide17_33.png",
              title: "Nefropati & Faktor Lain",
              body: "Mikroalbuminuria/penyakit ginjal, anemia, dan kecenderungan genetik.",
            },
          ],
        },
        {
          id: "modul2-p8",
          slide: 17,
          type: "match",
          kicker: "LATIHAN",
          title: "Cocokkan Faktor Risiko dengan Penjelasannya",
          intro:
            "Klik kartu faktor risiko di sebelah kiri, lalu klik kotak penjelasan klinis yang sesuai di sebelah kanan.",
          pairs: [
            {
              id: "durasi",
              left: "Durasi diabetes",
              right: "Makin lama seseorang menderita diabetes, makin tinggi risiko terjadinya retinopati diabetika.",
            },
            {
              id: "glikemik",
              left: "Kontrol glikemik",
              right:
                "HbA1c yang tinggi (kontrol gula darah buruk) meningkatkan risiko dan mempercepat progresi retinopati diabetika.",
            },
            {
              id: "hipertensi",
              left: "Hipertensi",
              right: "Tekanan darah tinggi memperburuk kerusakan mikrovaskuler pada retina.",
            },
            {
              id: "dislipidemia",
              left: "Dislipidemia",
              right: "Kadar lemak darah yang tinggi memicu terbentuknya eksudat keras (hard exudates) pada retina.",
            },
            {
              id: "kehamilan",
              left: "Kehamilan",
              right: "Kehamilan pada penyandang diabetes dapat mempercepat progresi retinopati diabetika.",
            },
            {
              id: "genetik",
              left: "Nefropati & Genetik",
              right: "Kerusakan mikrovaskular ginjal dan riwayat keluarga memperberat risiko keterlibatan retina.",
            },
          ],
        },
      ],
    },
    {
      id: "modul3",
      label: "Modul 3 — Skrining & Tatalaksana",
      pages: [
        {
          id: "modul3-p1",
          slide: 18,
          type: "divider",
          kicker: "BAB 3",
          title: "SKRINING DAN TATALAKSANA RETINOPATI DIABETIKA",
          transcript:
            "Kita masuk ke Bab 3, yaitu Skrining dan Tatalaksana Retinopati Diabetika. Dari bab sebelumnya, kita sudah melihat tiga fakta penting: RD sangat sering ditemukan pada penyandang DM, RD sering tidak bergejala sampai tahap lanjut, dan kerusakan pada tahap lanjut sulit dipulihkan. Ketiga fakta ini membawa kita pada satu kesimpulan: kita tidak bisa menunggu pasien datang dengan keluhan. Kita harus aktif mencarinya melalui skrining. Di bab ini kita akan membahas perbedaan antara skrining dan deteksi dini, mengapa skrining RD penting, tantangan pelaksanaannya di Indonesia, jadwal pemeriksaan retina yang dianjurkan, gambaran umum pilihan terapi RD, dan terakhir, peran dokter layanan primer dalam rujukan.",
        },
        {
          id: "modul3-p2",
          slide: 19,
          type: "content",
          kicker: "KONSEP DASAR",
          title: "Deteksi Dini vs Skrining",
          body: "Perbedaan mendasar antara Skrining dan Deteksi Dini menurut panduan WHO (2017 & 2020):\n\n• Skrining: Pencarian penyakit pada orang yang merasa sehat dan tidak memiliki gejala (asimtomatik) untuk mendeteksi lesi sebelum timbul keluhan. Pada RD: seluruh penyandang diabetes wajib diperiksa retinanya secara berkala.\n• Deteksi Dini: Upaya mengenali penyakit secepat mungkin pada individu yang sudah mulai merasakan gejala atau keluhan awal (misal pandangan kabur, floaters). Pasien bergejala langsung dirujuk ke fasilitas mata, bukan antri jadwal skrining.",
          transcript:
            "Istilah skrining dan deteksi dini sering dianggap sama, padahal keduanya berbeda. Slide ini membantu kita membedakannya. Skrining adalah pencarian penyakit pada orang yang merasa sehat. Dalam definisi WHO, skrining bertujuan menemukan penyakit atau lesi prekursor yang belum dikenali pada populasi yang tampak sehat dan tidak bergejala. Sementara itu, deteksi dini atau early diagnosis adalah upaya mengenali penyakit secepat mungkin pada orang yang sudah mulai merasakan gejala. Mari kita lihat tabelnya. Dari segi kondisi pasien, skrining ditujukan pada orang yang tidak memiliki gejala atau asimtomatik, sedangkan deteksi dini ditujukan pada orang yang sudah memiliki gejala atau keluhan awal. Dari segi sasaran, skrining menyasar kelompok besar, baik populasi umum maupun kelompok risiko tertentu, sedangkan deteksi dini menyasar individu yang merasa ada sesuatu yang “salah” pada tubuhnya. Contoh skrining adalah Pap smear rutin, mamografi tahunan, dan pemeriksaan gula darah massal. Contoh deteksi dini adalah seseorang yang memeriksakan diri ke dokter karena muncul benjolan atau batuk yang tidak kunjung sembuh, lalu segera dievaluasi. Bagaimana penerapannya pada RD? Skrining RD berarti memeriksa retina semua penyandang DM secara berkala, walaupun penglihatannya masih baik dan tidak ada keluhan sama sekali. Tujuannya adalah menemukan RD yang mengancam penglihatan sebelum pasien kehilangan penglihatannya. Sementara itu, pasien DM yang datang dengan keluhan, misalnya penglihatan kabur atau floaters, bukan lagi sasaran skrining. Pasien seperti ini harus segera diperiksa dan dirujuk ke layanan mata tanpa menunggu jadwal skrining berikutnya. Satu catatan lagi: skrining hanyalah langkah awal. Hasil skrining yang positif perlu dilanjutkan dengan pemeriksaan untuk menegakkan diagnosis dan memberikan terapi oleh dokter spesialis mata. Jadi, skrining dan deteksi dini saling melengkapi, dan keduanya sama-sama kita butuhkan.",
        },
        {
          id: "modul3-p3",
          slide: 20,
          type: "content",
          kicker: "PENTINGNYA SKRINING",
          title: "Skrining Mendeteksi Sebelum Terlambat",
          body: "Perjalanan alamiah (natural history) retinopati diabetika memiliki Jendela Skrining (Screening Window) yang panjang.\n\nPada fase ini, lesi mikrovaskular sudah terjadi di retina namun penglihatan pasien masih normal 6/6. Skrining berkala mendeteksi retinopati diabetika pada jendela waktu emas ini sebelum terjadi kerusakan penglihatan permanen.",
          transcript:
            "Slide ini menggambarkan perjalanan RD dari waktu ke waktu, sekaligus menunjukkan mengapa skrining sangat bermanfaat. Gambar rumah di atas setiap kotak menggambarkan apa yang dilihat pasien pada setiap tahap. Tahap pertama adalah preklinis. Pasien sudah memiliki faktor risiko, yaitu diabetes, tetapi belum ada lesi yang tampak di retina. Penglihatannya normal, seperti gambar rumah yang jernih. Tahap kedua adalah RD awal yang cukup diobservasi. Di retina mulai tampak mikroaneurisma dan perdarahan berbentuk titik. Perhatikan bahwa gambar rumahnya masih jernih. Artinya, pasien belum merasakan apa-apa, padahal penyakitnya sudah ada dan sudah bisa dideteksi. Tahap ketiga adalah RD berat yang perlu dirujuk, yaitu RD pre-proliferatif atau NPDR berat, atau sudah ada makulopati. Pada tahap ini penglihatan mulai terganggu, tampak sebagai bercak kecil dan sedikit buram pada gambar rumah. Namun, pada banyak pasien gejalanya masih ringan atau bahkan belum terasa. Inilah tahap ketika terapi masih sangat efektif untuk mempertahankan penglihatan. Tahap keempat adalah RD dengan gejala kebutaan permanen, yaitu PDR, edema makula, dan perdarahan. Gambar rumah tampak kabur dengan banyak bercak gelap. Pada tahap inilah pasien biasanya baru datang berobat, padahal sebagian kerusakannya sudah tidak dapat dipulihkan. Panah di bawah yang bertuliskan screening window menunjukkan rentang waktu yang panjang dan “sunyi”, ketika penyakit sudah ada dan bisa dideteksi, tetapi pasien belum bergejala dan terapi masih bisa menyelamatkan penglihatan. Skrining sengaja dilakukan berulang kali selama rentang ini, supaya setiap pasien yang penyakitnya berkembang dapat ditemukan dan diterapi sebelum mencapai tahap akhir. Berapa jarak antarskrining? Sebagian besar studi menyimpulkan interval 1 sampai 2 tahun untuk pasien tanpa retinopati, dan interval ini dapat disesuaikan dengan kondisi masing-masing pasien. Penentuan interval dan ambang rujukan merupakan keputusan klinis yang menimbang risiko progresi penyakit dengan biaya dan kapasitas layanan. Ambang rujukan yang terlalu rendah dapat membuat layanan mata kewalahan, sedangkan ambang yang terlalu tinggi berisiko membuat pasien terlambat ditangani. Kotak di kanan bawah merangkum pesannya: skrining yang teratur memungkinkan deteksi lebih awal dan intervensi lebih cepat, sehingga risiko kebutaan dapat dicegah. Bukti nyatanya datang dari Inggris. Setelah program skrining RD nasional berjalan secara sistematis, RD tidak lagi menjadi penyebab kebutaan terbanyak pada usia kerja, untuk pertama kalinya dalam lima dekade.",
          image: "/content/drive-retinopati/assets/v42_image18.png",
          imageCaption: "Jendela skrining (screening window) dalam perjalanan alamiah retinopati diabetika.",
        },
        {
          id: "modul3-p4",
          slide: 21,
          type: "content",
          kicker: "PENTINGNYA SKRINING",
          title: "Mengapa Skrining Retinopati Diabetika Penting?",
          body: "5 alasan utama pentingnya skrining RD menurut WHO Eye Care Indicator Menu (ECIM):\n\n1. Kebutaan dapat dihindari: 90% kebutaan akibat RD dapat dicegah dengan deteksi dini dan kontrol teratur.\n2. RD sering tidak bergejala pada tahap awal.\n3. Tersedia alat uji tapis yang handal dan non-invasif (funduskopi & kamera fundus retina).\n4. Beban penyakit terus meningkat (Indonesia peringkat ke-5 dunia dengan 20,4 juta penderita DM).\n5. Tersedia terapi efektif: Laser fotokoagulasi PRP, Anti-VEGF intravitreal, dan vitrektomi.",
          transcript:
            "Mengapa skrining RD dianggap penting, bahkan oleh WHO? Slide ini menyebutkan lima alasan. Empat alasan terakhir sebenarnya merupakan penerapan prinsip skrining klasik dari Wilson dan Jungner, yang dipakai WHO untuk menilai apakah suatu penyakit layak diskrining. Alasan pertama, skrining RD merupakan indikator global. Dalam Eye Care Indicator Menu atau ECIM yang diterbitkan WHO, cakupan skrining retina pada penyandang diabetes ditetapkan sebagai salah satu indikator inti. Indikator ini mengukur persentase penyandang DM yang menjalani pemeriksaan retina secara berkala sesuai pedoman nasional. Sebagai standar mutu program, WHO mencontohkan target cakupan minimal 80%, artinya setidaknya 8 dari 10 penyandang DM sudah menjalani skrining dalam satu tahun terakhir. Alasan kedua, RD merupakan masalah kesehatan masyarakat yang penting. Jumlah penyandangnya besar dan terus bertambah, dan RD merupakan salah satu penyebab utama kebutaan yang dapat dicegah pada usia produktif. Alasan ketiga, perkembangan dan perjalanan alamiah penyakitnya sudah dipahami dengan baik. Sejak studi ETDRS, kita tahu bahwa RD berkembang secara bertahap dan melewati fase laten yang panjang tanpa gejala. Fase inilah yang menjadi kesempatan untuk skrining. Alasan keempat, alat skriningnya sederhana, aman, dan tervalidasi. Pemeriksaan funduskopi dengan pupil dilebarkan atau foto fundus tidak invasif, dapat diterima pasien, dan sudah terbukti akurat. Bila biaya memungkinkan, foto retina digital menjadi pilihan utama karena gambarnya dapat disimpan, dinilai ulang, dan diaudit. Alasan kelima, bila terdeteksi dini, tersedia pilihan terapi yang lebih efektif dibandingkan bila diagnosis terlambat. Laser, injeksi anti-VEGF, dan vitrektomi terbukti dapat mencegah atau mengurangi kehilangan penglihatan, terutama bila diberikan sebelum kerusakan menjadi permanen. Gambar di sebelah kanan adalah sampul dokumen ECIM dari WHO yang menjadi acuan indikator tersebut.",
          image: "/content/drive-retinopati/assets/v42_image20.jpeg",
          imageCaption: "Indikator cakupan skrining efektif retinopati diabetika (WHO ECIM).",
        },
        {
          id: "modul3-p5",
          slide: 22,
          type: "cards",
          kicker: "TANTANGAN & STRATEGI",
          title: "Tantangan Skrining RD di Indonesia",
          intro:
            "Pelaksanaan skrining di fasilitas kesehatan tingkat pertama menghadapi 4 tantangan utama (PERKENI 2021 & PNPK 2023):",
          transcript:
            "Walaupun manfaatnya jelas, pelaksanaan skrining RD di lapangan tidak mudah. Slide ini merangkum tantangan-tantangan utamanya, yang diadaptasi dari PERKENI dan sejalan dengan permasalahan yang diuraikan dalam PNPK Retinopati Diabetika. Di sisi kiri ada empat tantangan dasar. Pertama, kesadaran pasien. Banyak penyandang DM belum tahu bahwa diabetes bisa merusak mata, dan karena RD awal tidak bergejala, mereka merasa tidak perlu memeriksakan mata. Bahkan di Amerika Serikat, hanya sekitar 60% penyandang DM yang menjalani skrining mata tahunan sesuai anjuran. Kedua, akses dan distribusi. Indonesia adalah negara kepulauan, dan tidak semua pulau atau daerah terpencil memiliki fasilitas pelayanan mata. Pasien di daerah seperti ini harus menempuh perjalanan jauh dan mengeluarkan biaya besar untuk diperiksa. Ketiga, tenaga kesehatan. Jumlah dokter spesialis mata masih terbatas dibandingkan jumlah penduduk dan masih terpusat di kota-kota besar. Karena itu, keterlibatan dokter umum, perawat, dan kader kesehatan menjadi sangat penting. Keempat, ketersediaan alat. Alat untuk deteksi dini RD, seperti kamera fundus, umumnya belum tersedia di fasilitas kesehatan tingkat pertama dan lebih banyak terdapat di rumah sakit atau rumah sakit mata. Di sisi kanan ada tantangan dari sisi pengelolaan dan integrasi layanan. Integrasi layanan berarti skrining mata perlu menjadi bagian rutin dari pengelolaan DM, bukan program yang berdiri sendiri; PERKENI sudah memasukkan pemeriksaan funduskopi ke dalam evaluasi komprehensif pasien DM pada kunjungan pertama dan kontrol tahunan. Pembiayaan berkaitan dengan biaya pemeriksaan, perjalanan, dan terapi, yang bisa cukup besar karena RD memerlukan pemantauan jangka panjang. Pencatatan data diperlukan agar kita tahu siapa saja penyandang DM di wilayah kita, siapa yang sudah dan belum diskrining, serta siapa yang perlu dirujuk dan dipantau. Terakhir, teknologi AI. Sistem kecerdasan buatan untuk membaca foto fundus kini sudah ada yang disetujui oleh FDA dan dapat digunakan di layanan primer. Teknologi ini berpotensi besar membantu, tetapi penerapannya memerlukan infrastruktur, biaya, dan jalur rujukan yang jelas. Tantangan-tantangan ini juga ditemukan di negara berpenghasilan rendah dan menengah lainnya. Sebuah tinjauan oleh peneliti Indonesia menunjukkan bahwa kader kesehatan di masyarakat dapat membantu edukasi dan pemeriksaan tajam penglihatan sederhana, serta mampu meningkatkan kunjungan skrining mata hingga sekitar enam kali lipat, walaupun keterbatasan infrastruktur tetap menjadi hambatan utama.",
          columns: 2,
          cards: [
            {
              title: "Kesadaran Pasien",
              body: "Penyandang DM belum menyadari risiko kebutaan karena tahap awal RD tidak bergejala.",
            },
            {
              title: "Akses & Distribusi Geografis",
              body: "Indonesia negara kepulauan dengan disparitas fasilitas mata antara kota besar dan daerah terpencil.",
            },
            {
              title: "Tenaga Kesehatan",
              body: "Jumlah dokter spesialis mata terbatas; peran dokter layanan primer dan perawat menjadi ujung tombak skrining.",
            },
            {
              title: "Ketersediaan Alat",
              body: "Kamera fundus belum merata di FKTP; diperlukan inovasi teleretina dan AI assistance.",
            },
          ],
          trailingImage: "/content/drive-retinopati/assets/v42_image21.png",
          trailingCaption: "Strategi mengatasi kesenjangan kapasitas skrining retinopati diabetika.",
        },
        {
          id: "modul3-p6",
          slide: 23,
          type: "content",
          kicker: "REKOMENDASI",
          title: "Jadwal Pemeriksaan Retina Ulang",
          body: "Rekomendasi jadwal skrining dan interval kontrol retina (PNPK 2023, PERKENI 2021, AAO PPP 2025):\n\n• Waktu Pemeriksaan Pertama:\n  - DM Tipe 1: 5 tahun sejak diagnosis ditegakkan.\n  - DM Tipe 2: Segera setelah diagnosis ditegakkan.\n  - Pasien DM yang Hamil: Segera saat merencanakan kehamilan atau trimester pertama.\n\n• Jadwal Kontrol Berdasarkan Derajat RD:\n  - DM tanpa RD (Fundus Normal): Ulang setiap 1–2 tahun.\n  - NPDR Ringan–Sedang: Kontrol ulang setiap 6–12 bulan.\n  - NPDR Berat & PDR: Kontrol 1–6 bulan sesuai keparahan dan indikasi rujukan spesialis.",
          transcript:
            "Slide ini berisi rekomendasi jadwal pemeriksaan retina. Ada dua hal yang perlu kita ingat, yaitu kapan pemeriksaan pertama dilakukan dan seberapa sering pemeriksaan ulang dilakukan. Pertama, pemeriksaan pertama. Pada DM tipe 1, pemeriksaan retina pertama dilakukan 5 tahun sejak terdiagnosis, karena retinopati yang bermakna jarang muncul dalam lima tahun pertama. Pada DM tipe 2, pemeriksaan dilakukan segera setelah terdiagnosis. Alasannya, awal penyakit DM tipe 2 sering tidak diketahui dan bisa sudah berlangsung bertahun-tahun sebelum terdiagnosis, sehingga sebagian pasien sudah memiliki retinopati saat pertama kali datang. Pada penyandang DM tipe 1 atau tipe 2 yang hamil, pemeriksaan dilakukan segera setelah konsepsi atau pada awal trimester pertama. Kedua, jadwal pemeriksaan ulang yang disesuaikan dengan derajat RD. Coba lihat panel di sebelah kanan. Kolom hijau adalah DM dengan fundus normal atau tanpa RD; pemeriksaan ulang dilakukan setiap 1–2 tahun. Pada prinsipnya pemeriksaan tahunan tetap dianjurkan, dan interval 2 tahun dapat dipertimbangkan bila pasien sudah beberapa kali diperiksa dengan hasil normal dan gula darahnya terkontrol baik. Kolom kuning adalah DM dengan NPDR ringan sampai sedang; pemeriksaan ulang dilakukan setiap 6–12 bulan. Kolom oranye adalah DM dengan NPDR berat dan PDR; pemeriksaan ulang lebih sering, yaitu setiap 1–6 bulan sesuai tingkat keparahannya, dan pasien pada tahap ini umumnya sudah memerlukan penanganan dokter spesialis mata. Bila ditemukan edema makula, terutama yang melibatkan pusat makula, jadwal kontrol menjadi lebih rapat, bahkan bisa setiap bulan. Perhatikan juga gambar rumah pada setiap kolom. Gambar ini mengingatkan kita bahwa semakin berat derajat RD, semakin besar gangguan penglihatan yang bisa terjadi. Namun, pada tahap awal penglihatan pasien bisa saja masih terasa normal. Bagian bawah panel menegaskan bahwa ibu hamil dengan diabetes perlu diskrining lebih sering. Penyandang DM tipe 1 atau tipe 2 yang hamil dianjurkan diperiksa setiap trimester dan sampai satu tahun setelah melahirkan, sesuai derajat retinopatinya. Sebagai gambaran, AAO menganjurkan pemeriksaan setiap 3–12 bulan bila tidak ada retinopati sampai NPDR sedang, dan setiap 1–3 bulan bila sudah NPDR berat atau lebih. Perlu diingat, ibu dengan DM gestasional tidak memerlukan pemeriksaan retina khusus selama kehamilan.",
          image: "/content/drive-retinopati/assets/v42_image22.png",
          imageCaption: "Alur jadwal pemeriksaan retina pertama dan kontrol berkala.",
        },
        {
          id: "modul3-p7",
          slide: 24,
          type: "cards",
          kicker: "TATALAKSANA",
          title: "Pilar Tatalaksana Retinopati Diabetika",
          intro:
            "Empat pilihan utama tata laksana retinopati diabetika berdasarkan derajat keparahan dan edema makula:",
          transcript:
            "Slide ini memberikan gambaran umum tatalaksana RD. Ada empat pilihan utama, dan pemilihannya bergantung pada derajat RD serta ada tidaknya edema makula. Sebagai dokter layanan primer, kita tidak melakukan tindakan-tindakan ini, tetapi kita perlu memahaminya agar dapat menjelaskan kepada pasien mengapa ia dirujuk dan apa yang akan dijalaninya. Pilihan pertama adalah observasi, untuk DM tanpa RD atau RD ringan sampai sedang. Pada tahap ini belum ada indikasi terapi khusus di mata. Fokusnya adalah kendali gula darah, tekanan darah, dan kolesterol yang optimal, edukasi, serta pemeriksaan retina berkala sesuai jadwal. Gambar dokter yang sedang berbincang dengan pasien menggambarkan bahwa pada tahap ini edukasi dan pemantauan adalah “terapinya”. Pada pasien DM tipe 2, fenofibrat juga dapat dipertimbangkan karena terbukti memperlambat progresi RD. Pilihan kedua adalah laser fotokoagulasi retina, untuk RD berat. Bentuk yang paling sering adalah panretinal photocoagulation atau PRP, yang merupakan terapi standar untuk PDR. PRP juga dapat dipertimbangkan pada NPDR berat, terutama pada pasien DM tipe 2, pasien lanjut usia, atau pasien yang sulit kontrol rutin. Prinsipnya, sinar laser diarahkan melalui pupil ke retina perifer yang iskemik, seperti pada gambar. Dengan mengurangi area retina yang kekurangan oksigen, produksi VEGF menurun dan pembuluh darah baru dapat mengalami regresi. Studi DRS membuktikan bahwa PRP menurunkan risiko kehilangan penglihatan berat hingga 50% atau lebih. Efek sampingnya antara lain penyempitan lapang pandang perifer dan berkurangnya penglihatan malam. Selain PRP, ada juga laser fokal atau grid yang dapat dipakai untuk edema makula yang tidak melibatkan pusat makula. Pilihan ketiga adalah injeksi intravitreal anti-VEGF, terutama untuk edema makula diabetika. Obat disuntikkan langsung ke dalam rongga vitreus, seperti pada gambar, untuk menekan VEGF yang menyebabkan kebocoran pembuluh darah. Saat ini anti-VEGF merupakan terapi lini pertama untuk sebagian besar edema makula yang melibatkan pusat makula dan sudah menurunkan tajam penglihatan. Beberapa obat yang tersedia antara lain ranibizumab, bevacizumab, aflibercept, brolucizumab, dan faricimab. Anti-VEGF juga dapat menjadi alternatif atau terapi tambahan untuk PDR. Kekurangannya, terapi ini umumnya memerlukan suntikan berulang dan kontrol yang teratur, disertai pemeriksaan OCT. Pilihan keempat adalah vitrektomi, untuk RD berat dengan perdarahan vitreus atau ablasio retina traksional. Pada gambar terlihat alat vitrektor dan sumber cahaya yang dimasukkan ke dalam bola mata. Vitrektomi diindikasikan antara lain pada perdarahan vitreus yang tidak kunjung bersih atau berulang walaupun sudah dilaser maksimal, ablasio retina traksional yang mengenai atau mengancam makula, serta kombinasi ablasio retina traksional dan regmatogen. Satu hal yang sama untuk semua pilihan ini: kendali gula darah, tekanan darah, dan kolesterol tetap menjadi dasar tatalaksana di setiap tahap.",
          columns: 2,
          cards: [
            {
              title: "Observasi & Kendali Metabolik",
              body: "Kendali gula darah (HbA1c), tekanan darah, dan lipid optimal. Fondasi utama di setiap derajat RD.",
            },
            {
              title: "Laser Fotokoagulasi Retina (PRP)",
              body: "Panretinal Photocoagulation untuk PDR dan NPDR berat; menurunkan risiko kebutaan hingga ≥ 50% (studi DRS).",
            },
            {
              title: "Injeksi Anti-VEGF Intravitreal",
              body: "Terapi lini pertama untuk Diabetic Macular Edema (DME) yang melibatkan sentral makula.",
            },
            {
              title: "Vitrektomi",
              body: "Operasi vitreoretina untuk perdarahan vitreus persisten dan ablasio retina traksional.",
            },
          ],
          trailingImage: "/content/drive-retinopati/assets/v42_image27.png",
          trailingCaption: "Empat modalitas terapi medis dan bedah retinopati diabetika.",
        },
        {
          id: "modul3-p8",
          slide: 25,
          type: "content",
          kicker: "LAYANAN PRIMER",
          title: "Peran Dokter Layanan Primer dalam Rujukan",
          body: "Empat peran kunci dokter layanan primer di Puskesmas dan Klinik Pratama:\n\n1. Mengenal Gejala & Tanda RD: Waspadai tanda bahaya (penurunan visus mendadak, perdarahan vitreus, glaukoma neovaskular).\n2. Melakukan Skrining Berkala: Pemeriksaan segmen posterior dengan funduskopi atau foto fundus kamera.\n3. Edukasi Pasien: Menanamkan kesadaran bahwa visus normal tidak menjamin retina sehat, serta pentingnya kontrol gula darah ketat.\n4. Merujuk Pasien Tepat Waktu: Memastikan pasien sampai ke dokter spesialis mata dan melanjutkan pemantauan penyakit sistemiknya.",
          transcript:
            "Slide ini merangkum peran dokter layanan primer dalam penanganan RD, khususnya dalam alur rujukan. Ada empat peran utama. Pertama, mengenal gejala dan tanda RD. Dokter layanan primer perlu mengenali keluhan seperti penglihatan kabur, floaters, penglihatan yang hilang mendadak, dan distorsi. Yang tidak kalah penting, kita perlu selalu ingat bahwa RD sering tidak bergejala, sehingga pasien DM yang tidak mengeluh pun tetap perlu diperiksa matanya. Kita juga perlu mengenali tanda bahaya yang memerlukan rujukan segera, seperti penurunan penglihatan mendadak, perdarahan vitreus, curiga ablasio retina, atau mata merah dan nyeri yang mengarah ke glaukoma neovaskular. Kedua, melakukan skrining RD pada pasien diabetes. PNPK menyebutkan bahwa skrining sebagai deteksi awal dapat dilakukan oleh dokter spesialis mata dan dokter umum yang memiliki kompetensi pemeriksaan segmen posterior dengan funduskopi. PERKENI juga memasukkan pemeriksaan funduskopi ke dalam evaluasi komprehensif pasien DM pada kunjungan pertama dan kontrol tahunan. Bila tersedia, foto fundus, termasuk yang dibaca dari jarak jauh atau dengan bantuan kecerdasan buatan, juga dapat menjadi strategi skrining, asalkan ada jalur rujukan yang jelas. Ketiga, edukasi pasien mengenai RD dan tatalaksananya. Pasien perlu memahami bahwa penglihatan yang masih baik tidak menjamin retinanya sehat, bahwa terapi paling efektif bila diberikan sejak dini, dan bahwa pemeriksaan retina perlu dilakukan secara berkala, minimal setahun sekali. Pasien juga perlu dimotivasi untuk mengendalikan gula darah, tekanan darah, dan kolesterol, karena inilah fondasi pencegahan RD. Edukasi ini sebaiknya juga melibatkan keluarga pasien. Keempat, merujuk pasien yang membutuhkan tatalaksana lebih lanjut. Pasien dengan temuan yang memerlukan evaluasi atau terapi, misalnya RD sedang atau lebih berat, edema makula, atau penurunan tajam penglihatan yang tidak dapat dijelaskan, perlu dirujuk ke dokter spesialis mata. Tugas kita tidak berhenti setelah surat rujukan dibuat. Kita perlu memastikan pasien benar-benar sampai ke layanan rujukan, menerima umpan balik dari dokter spesialis mata, dan tetap memantau kendali penyakit sistemiknya. Kerja sama yang baik antara dokter layanan primer dan dokter spesialis mata adalah kunci keberhasilan pencegahan kebutaan akibat RD.",
        },
      ],
    },
    {
      id: "modul4",
      label: "Modul 4 — Simulasi Grading Fundus",
      pages: [
        {
          id: "modul4-p1",
          slide: 20,
          type: "divider",
          kicker: "MODUL 4",
          title: "SIMULASI GRADING RETINOPATI DIABETIKA",
        },
        {
          id: "modul4-p2",
          slide: 21,
          type: "image-grading",
          level: "Kasus 1",
          image: "/content/drive-retinopati/assets/slide21_9.png",
          options: ["Tidak ada retinopati diabetika", "Retinopati diabetika"],
          correct: "Tidak ada retinopati diabetika",
          reasoning:
            "Retina normal: diskus optikus tegas, vaskularisasi utuh tanpa mikroaneurisma, eksudat, atau perdarahan.",
          lesions: [],
        },
        {
          id: "modul4-p3",
          slide: 22,
          type: "image-grading",
          level: "Kasus 2",
          image: "/content/drive-retinopati/assets/slide22_4.png",
          options: ["Tidak ada retinopati diabetika", "Retinopati diabetika"],
          correct: "Retinopati diabetika",
          reasoning: "Terlihat lesi perdarahan dot/blot dan eksudat keras fokal pada kuadran retina.",
          lesions: [
            { x: 37.4, y: 23.4, label: "Perdarahan dot/blot" },
            { x: 34.6, y: 46.8, label: "Eksudat keras" },
          ],
        },
        {
          id: "modul4-p4",
          slide: 23,
          type: "image-grading",
          level: "Kasus 3",
          image: "/content/drive-retinopati/assets/slide23_3.png",
          options: ["Tidak ada retinopati diabetika", "Retinopati diabetika"],
          correct: "Retinopati diabetika",
          reasoning:
            "Tampak mikroaneurisma multipel disertai bercak perdarahan intraretina di sekitar arkade vaskular.",
          lesions: [
            { x: 42.5, y: 38.2, label: "Mikroaneurisma" },
            { x: 55.1, y: 62.4, label: "Perdarahan intraretina" },
          ],
        },
        {
          id: "modul4-p5",
          slide: 24,
          type: "image-grading",
          level: "Kasus 4",
          image: "/content/drive-retinopati/assets/slide24_3.png",
          options: ["Tidak ada retinopati diabetika", "Retinopati diabetika"],
          correct: "Retinopati diabetika",
          reasoning:
            "Eksudat keras lipid mengelilingi area makula (circinate pattern) mengindikasikan edema makula diabetika.",
          lesions: [{ x: 48.2, y: 51.0, label: "Edema makula / Eksudat lipid" }],
        },
        {
          id: "modul4-p6",
          slide: 25,
          type: "image-grading",
          level: "Kasus 5",
          image: "/content/drive-retinopati/assets/slide25_3.png",
          options: ["Tidak ada retinopati diabetika", "Retinopati diabetika"],
          correct: "Retinopati diabetika",
          reasoning:
            "Neovaskularisasi diskus optik (NVD) yang rapuh menandakan retinopati diabetika proliferatif (PDR) berat.",
          lesions: [{ x: 61.2, y: 35.8, label: "Neovaskularisasi (NVD)" }],
        },
      ],
    },
    {
      id: "evaluasi",
      label: "Evaluasi & Quiz",
      pages: [
        {
          id: "evaluasi-p1",
          slide: 26,
          type: "divider",
          kicker: "EVALUASI",
          title: "QUIZ EVALUASI KOMPETENSI KLINIS",
          transcript:
            "Kita sudah sampai di akhir materi Modul 1. Sekarang saatnya menguji pemahaman Anda melalui quiz. Quiz ini terdiri dari 5 soal pilihan ganda. Setiap soal memiliki lima pilihan jawaban, dan hanya ada satu jawaban yang paling tepat. Bacalah setiap soal dengan teliti, lalu pilih jawaban yang menurut Anda paling benar. Setelah setiap soal, kita akan membahas jawabannya bersama-sama, termasuk mengapa pilihan lainnya kurang tepat. Soal-soal ini mencakup definisi retinopati diabetika, jadwal pemeriksaan retina, patofisiologi, perbedaan skrining dan deteksi dini, serta peran dokter layanan primer. Selamat mengerjakan.",
        },
        {
          id: "evaluasi-p2",
          slide: 27,
          type: "quiz",
          kicker: "QUIZ 1",
          title: "Quiz 1 — Definisi Retinopati Diabetika",
          question: "Apa yang dimaksud dengan retinopati diabetika?",
          options: [
            { letter: "A", text: "Infeksi bakteri pada retina mata" },
            { letter: "B", text: "Peningkatan tekanan intraokular kronis yang merusak saraf optik" },
            { letter: "C", text: "Kerusakan kapiler retina akibat kadar glukosa darah tinggi kronis" },
            { letter: "D", text: "Kekeruhan pada lensa mata akibat proses penuaan" },
            { letter: "E", text: "Robekan pada retina akibat trauma mekanik" },
          ],
          correct: "C",
          explanation:
            "Jawaban yang tepat adalah C. Retinopati diabetika adalah penyakit pada pembuluh darah mikrovaskular retina yang disebabkan oleh hiperglikemia kronis pada penyandang diabetes mellitus. Pilihan B adalah glaukoma, D adalah katarak senilis, dan E adalah ablasio retina regmatogenosa.",
          transcript:
            "Soal pertama: Apa yang dimaksud dengan retinopati diabetika? Pilihan A, peradangan konjungtiva yang sering dialami penderita diabetes. Pilihan B, kekeruhan lensa mata akibat penuaan. Pilihan C, kerusakan kapiler retina akibat gula darah tinggi yang kronis. Pilihan D, peningkatan tekanan bola mata yang merusak saraf optik. Pilihan E, kelainan refraksi yang timbul karena kadar gula berfluktuasi. Silakan pilih jawaban Anda. Jawaban yang tepat adalah C, kerusakan kapiler retina akibat gula darah tinggi yang kronis. Seperti yang sudah kita bahas, retinopati diabetika adalah penyakit pembuluh darah mikro retina yang kronik dan progresif akibat hiperglikemia berkepanjangan. Kerusakan kapiler ini menimbulkan kebocoran yang menyebabkan edema, oklusi yang menyebabkan iskemia, dan pada tahap lanjut neovaskularisasi. Kejadiannya meningkat cepat, tetapi dapat dicegah. Mengapa pilihan lain kurang tepat? Pilihan A menggambarkan konjungtivitis. Pilihan B menggambarkan katarak; memang DM dapat mempercepat terjadinya katarak, tetapi itu bukan retinopati. Pilihan D menggambarkan glaukoma; pada RD lanjut memang dapat terjadi glaukoma neovaskular, tetapi itu adalah komplikasinya, bukan definisi RD. Pilihan E menggambarkan perubahan refraksi yang memang bisa dialami penyandang DM saat kadar gulanya naik turun, tetapi kondisi ini juga bukan retinopati diabetika.",
        },
        {
          id: "evaluasi-p3",
          slide: 28,
          type: "quiz",
          kicker: "QUIZ 2",
          title: "Quiz 2 — Jadwal Pemeriksaan Retina Ulang",
          question:
            "Seorang penderita DM memiliki hasil pemeriksaan funduskopi normal (tanpa tanda RD). Kapan jadwal pemeriksaan retina ulang yang dianjurkan?",
          options: [
            { letter: "A", text: "Tidak perlu periksa lagi bila tidak ada keluhan penglihatan" },
            { letter: "B", text: "1 bulan lagi" },
            { letter: "C", text: "3–6 bulan lagi" },
            { letter: "D", text: "1–2 tahun lagi" },
            { letter: "E", text: "5 tahun lagi" },
          ],
          correct: "D",
          explanation:
            "Jawaban yang tepat adalah D. Pada penderita DM dengan hasil funduskopi normal (tanpa RD), jadwal pemeriksaan retina ulang yang direkomendasikan adalah setiap 1–2 tahun. Pemeriksaan rutin tetap diperlukan karena RD pada tahap awal tidak bergejala sama sekali.",
          transcript:
            "Soal kedua: Seorang penderita DM memiliki hasil pemeriksaan fundus yang normal, tanpa retinopati diabetika. Kapan pemeriksaan retina ulang dianjurkan? Pilihan A, 1 bulan. Pilihan B, 3–6 bulan. Pilihan C, 6–12 bulan. Pilihan D, 1–2 tahun. Pilihan E, tidak perlu, cukup bila muncul keluhan penglihatan. Silakan pilih jawaban Anda. Jawaban yang tepat adalah D, 1–2 tahun. Pada penyandang DM tanpa retinopati, pemeriksaan retina diulang setiap 1–2 tahun. Dalam praktik, pemeriksaan tahunan tetap dianjurkan, dan interval 2 tahun dapat dipertimbangkan bila pasien sudah beberapa kali diperiksa dengan hasil normal dan gula darahnya terkontrol baik. Pilihan lain sesuai untuk kondisi yang berbeda. Interval 6–12 bulan pada pilihan C dipakai untuk NPDR ringan sampai sedang. Interval yang lebih pendek, seperti 3–6 bulan atau 1 bulan pada pilihan B dan A, dipakai untuk RD yang lebih berat, edema makula, atau ibu hamil dengan retinopati, sesuai derajat keparahannya. Pilihan E jelas salah. RD sering tidak bergejala sampai tahap lanjut, sehingga menunggu keluhan berarti kita kemungkinan besar sudah terlambat.",
        },
        {
          id: "evaluasi-p4",
          slide: 29,
          type: "quiz",
          kicker: "QUIZ 3",
          title: "Quiz 3 — Patofisiologi Iskemia & VEGF",
          question:
            "Pada patofisiologi retinopati diabetika, iskemia retina memicu pelepasan faktor pertumbuhan yang mendorong neovaskularisasi. Faktor tersebut adalah...",
          options: [
            { letter: "A", text: "VEGF (vascular endothelial growth factor)" },
            { letter: "B", text: "Insulin" },
            { letter: "C", text: "Hemoglobin A1c" },
            { letter: "D", text: "Faktor VIII" },
            { letter: "E", text: "Kortisol" },
          ],
          correct: "A",
          explanation:
            "Jawaban yang tepat adalah A. Retina yang mengalami iskemia akibat penyumbatan kapiler melepaskan VEGF (vascular endothelial growth factor). VEGF merangsang pertumbuhan pembuluh darah baru abnormal (neovaskularisasi pada PDR) dan meningkatkan permeabilitas pembuluh darah pada edema makula.",
          transcript:
            "Soal ketiga: Pada patofisiologi retinopati diabetika, iskemia retina memicu pelepasan faktor pertumbuhan yang mendorong neovaskularisasi. Faktor tersebut adalah… Pilihan A, VEGF atau vascular endothelial growth factor. Pilihan B, insulin. Pilihan C, hemoglobin A1c. Pilihan D, faktor VIII. Pilihan E, kortisol. Silakan pilih jawaban Anda. Jawaban yang tepat adalah A, VEGF. Mari kita ulang alurnya. Hiperglikemia kronis menyebabkan penebalan membran basal, hilangnya perisit, dan kerusakan endotel kapiler. Kapiler kemudian bocor dan tersumbat, sehingga retina mengalami iskemia. Retina yang iskemik melepaskan VEGF, yang merangsang tumbuhnya pembuluh darah baru atau neovaskularisasi, yaitu ciri PDR. VEGF juga meningkatkan permeabilitas pembuluh darah, sehingga berperan dalam terjadinya edema makula. Inilah dasar penggunaan obat anti-VEGF. Pilihan lainnya bukan faktor pemicu neovaskularisasi. Insulin adalah hormon pengatur glukosa. HbA1c adalah penanda rata-rata kadar glukosa darah yang dipakai untuk diagnosis dan pemantauan. Faktor VIII adalah faktor pembekuan darah. Kortisol adalah hormon stres dari kelenjar adrenal; menariknya, obat golongan kortikosteroid justru dipakai sebagai salah satu terapi edema makula diabetika karena efek antiinflamasinya.",
        },
        {
          id: "evaluasi-p5",
          slide: 30,
          type: "quiz",
          kicker: "QUIZ 4",
          title: "Quiz 4 — Skrining vs Deteksi Dini",
          question: "Apa yang membedakan skrining dari deteksi dini?",
          options: [
            { letter: "A", text: "Skrining dilakukan pada orang yang sudah bergejala" },
            { letter: "B", text: "Skrining mencari penyakit pada orang tanpa gejala (merasa sehat)" },
            { letter: "C", text: "Deteksi dini menyasar populasi sehat secara massal" },
            { letter: "D", text: "Skrining hanya dilakukan satu kali seumur hidup" },
            { letter: "E", text: "Keduanya sama dan dapat saling menggantikan" },
          ],
          correct: "B",
          explanation:
            "Jawaban yang tepat adalah B. Skrining mencari penyakit pada orang yang tidak bergejala atau merasa sehat pada kelompok berisiko (semua penderita DM). Deteksi dini ditujukan pada individu yang sudah mulai merasakan gejala klinis awal.",
          transcript:
            "Soal keempat: Apa yang membedakan skrining dari deteksi dini? Pilihan A, skrining dilakukan pada orang yang sudah bergejala. Pilihan B, skrining mencari penyakit pada orang tanpa gejala atau merasa sehat. Pilihan C, deteksi dini menyasar populasi sehat secara massal. Pilihan D, skrining hanya dilakukan satu kali seumur hidup. Pilihan E, keduanya sama dan dapat saling menggantikan. Silakan pilih jawaban Anda. Jawaban yang tepat adalah B. Skrining mencari penyakit pada orang yang tidak bergejala atau merasa sehat, biasanya pada kelompok besar atau kelompok berisiko. Pada RD, sasarannya adalah semua penyandang DM, karena RD dapat berkembang lama tanpa gejala selama rentang waktu yang kita sebut screening window. Mengapa pilihan lain salah? Pilihan A justru menggambarkan deteksi dini, yang ditujukan pada orang yang sudah mulai bergejala. Pilihan C terbalik; yang menyasar populasi sehat secara massal adalah skrining, bukan deteksi dini. Pilihan D salah karena skrining adalah proses yang berkelanjutan dan berkala, bukan pemeriksaan sekali seumur hidup; ini juga salah satu prinsip skrining dari Wilson dan Jungner. Pilihan E salah karena keduanya berbeda sasaran dan cara kerjanya, tetapi saling melengkapi.",
        },
        {
          id: "evaluasi-p6",
          slide: 31,
          type: "quiz",
          kicker: "QUIZ 5",
          title: "Quiz 5 — Peran Dokter Layanan Primer",
          question: "Manakah yang merupakan peran dokter layanan primer dalam penanganan retinopati diabetika?",
          options: [
            { letter: "A", text: "Melakukan laser fotokoagulasi retina" },
            { letter: "B", text: "Melakukan injeksi intravitreal anti-VEGF" },
            { letter: "C", text: "Melakukan vitrektomi" },
            { letter: "D", text: "Menunda rujukan sampai tajam penglihatan menurun" },
            {
              letter: "E",
              text: "Edukasi pasien, mengenali gejala & tanda RD, dan merujuk yang memerlukan tatalaksana lanjut",
            },
          ],
          correct: "E",
          explanation:
            "Jawaban yang tepat adalah E. Peran dokter layanan primer adalah mengenali gejala dan tanda RD, melakukan skrining bila memiliki kompetensi, mengedukasi pasien, serta merujuk ke dokter spesialis mata bila ditemukan lesi atau komplikasi.",
          transcript:
            "Soal kelima: Manakah yang merupakan peran dokter layanan primer dalam penanganan retinopati diabetika? Pilihan A, melakukan laser fotokoagulasi retina. Pilihan B, melakukan injeksi intravitreal anti-VEGF. Pilihan C, melakukan vitrektomi. Pilihan D, menunda rujukan sampai tajam penglihatan menurun. Pilihan E, edukasi pasien, mengenali gejala dan tanda RD, dan merujuk yang memerlukan tatalaksana lanjut. Silakan pilih jawaban Anda. Jawaban yang tepat adalah E. Peran dokter layanan primer adalah mengenali gejala dan tanda RD, melakukan skrining bila memiliki kompetensi, mengedukasi pasien tentang RD dan tatalaksananya, serta merujuk pasien yang memerlukan tatalaksana lebih lanjut ke dokter spesialis mata. Pilihan A, B, dan C adalah tindakan yang dilakukan oleh dokter spesialis mata yang kompeten sesuai indikasi. Pilihan D adalah kesalahan yang berbahaya. Karena RD sering tidak bergejala sampai tahap lanjut, menunda rujukan sampai tajam penglihatan menurun berarti kita kehilangan kesempatan terbaik untuk mencegah kebutaan.",
        },
      ],
    },
    {
      id: "penutup",
      label: "Penutup & Sertifikasi",
      pages: [
        {
          id: "penutup-p1",
          slide: 32,
          type: "content",
          kicker: "RANGKUMAN KLINIS",
          title: "Terima Kasih & Rangkuman Modul 1",
          body: "Selamat! Anda telah menyelesaikan seluruh rangkaian Modul 1: Pengenalan Diabetes dan Retinopati Diabetika.\n\n5 Pesan Kunci Praktik Klinis Dokter Layanan Primer:\n1. Beban Diabetes Sangat Besar: Indonesia menduduki peringkat ke-5 dunia dengan 20,4 juta penyandang diabetes.\n2. Komplikasi Mikrovaskular Sering: Di Indonesia, hampir separuh (43,1%) penyandang DM tipe 2 memiliki RD, dan 1 dari 4 mengancam penglihatan.\n3. RD Tahap Awal Asimtomatik: Jangan menunggu pasien mengeluh buram — periksa retina secara berkala sejak diagnosis ditegakkan.\n4. Kendali Metabolik Fondasi Utama: Kontrol gula darah, tensi, dan lipid adalah dasar pencegahan; laser PRP dan anti-VEGF sangat efektif bila diberikan tepat waktu.\n5. Dokter Layanan Primer adalah Ujung Tombak: Kenali tanda bahaya, lakukan skrining, edukasi pasien, dan rujuk tepat waktu.",
          transcript:
            "Terima kasih, Anda telah menyelesaikan Modul 1, Pengenalan Diabetes dan Retinopati Diabetika. Sebelum menutup, mari kita ingat kembali pesan-pesan pentingnya. Pertama, jumlah penyandang diabetes di dunia dan di Indonesia terus meningkat, dan Indonesia kini berada di peringkat ke-5 dunia. Kedua, retinopati diabetika adalah komplikasi mikrovaskular diabetes yang sering ditemukan; di Indonesia hampir separuh penyandang DM tipe 2 memiliki RD, dan sekitar 1 dari 4 sudah mengalami RD yang mengancam penglihatan. Ketiga, RD sering tidak bergejala sampai tahap lanjut, sehingga semua penyandang DM perlu menjalani pemeriksaan retina secara berkala sesuai jadwal. Keempat, kendali gula darah, tekanan darah, dan kolesterol adalah fondasi pencegahan, sedangkan laser, anti-VEGF, dan vitrektomi efektif bila diberikan tepat waktu. Kelima, dokter layanan primer memegang peran kunci untuk mengenali, menskrining, mengedukasi, dan merujuk. Dengan peran aktif kita semua, sebagian besar kebutaan akibat retinopati diabetika dapat dicegah. Sampai jumpa di modul berikutnya dalam program DRIVE.",
        },
      ],
    },
  ],
}
