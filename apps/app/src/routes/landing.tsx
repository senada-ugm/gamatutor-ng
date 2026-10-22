import { useState, useEffect } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, ChevronRight } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { SiteFooter } from "@/components/composed/_shared/site-footer"
import { SiteHeader } from "@/components/composed/_shared/site-header"
import { apiGetPaged } from "@/lib/api"
import { useSession } from "@/lib/session"
import type { ContractCourse } from "@workspace/contracts/domain"
import "@/styles/gamatutor.css"

interface Lesion {
  x: number
  y: number
  dx?: number
  dy?: number
  label: string
}

interface CaseItem {
  level: string
  img: string
  options: string[]
  correct: string
  q: string
  reasoning: string
  lesions: Lesion[]
}

const L1_OPTIONS = ["Tidak ada retinopati diabetika", "Retinopati diabetika"]
const L2_OPTIONS = ["Observasi", "Rujuk"]

const SIM_CASES: CaseItem[] = [
  {
    level: "Level 1",
    img: "/content/drive-retinopati/assets/slide21_9.png",
    options: L1_OPTIONS,
    correct: L1_OPTIONS[0],
    q: "Apakah ada retinopati diabetika pada foto ini?",
    reasoning: "Tidak ada retinopati diabetika.",
    lesions: [],
  },
  {
    level: "Level 1",
    img: "/content/drive-retinopati/assets/slide22_4.png",
    options: L1_OPTIONS,
    correct: L1_OPTIONS[1],
    q: "Apakah ada retinopati diabetika pada foto ini?",
    reasoning: "Ada hard exudate dan perdarahan dot/blot.",
    lesions: [
      { x: 37.4, y: 23.4, label: "Perdarahan dot/blot" },
      { x: 57, y: 30.9, label: "Perdarahan dot/blot" },
      { x: 34.8, y: 51, label: "Hard exudate" },
    ],
  },
  {
    level: "Level 2",
    img: "/content/drive-retinopati/assets/slide23_3.png",
    options: L2_OPTIONS,
    correct: L2_OPTIONS[0],
    q: "Pasien diabetes mellitus. Apa tindak lanjut Anda?",
    reasoning: "Tidak ada retinopati diabetika.",
    lesions: [],
  },
  {
    level: "Level 2",
    img: "/content/drive-retinopati/assets/slide24_3.png",
    options: L2_OPTIONS,
    correct: L2_OPTIONS[1],
    q: "Pasien diabetes mellitus. Apa tindak lanjut Anda?",
    reasoning:
      "PDR, dengan adanya lesi berupa perdarahan dot, hard exudate, neovascular elsewhere, dan neovascular disc.",
    lesions: [
      { x: 21.2, y: 37.9, dx: -8, dy: 14, label: "Hard exudate" },
      { x: 39.3, y: 33.8, dx: -8, dy: -15, label: "Perdarahan dot" },
      { x: 38.3, y: 44.6, dx: 4, dy: 16, label: "Neovascular elsewhere" },
      { x: 79.2, y: 44.6, dx: 4, dy: 14, label: "Neovascular disc" },
    ],
  },
  {
    level: "Level 2",
    img: "/content/drive-retinopati/assets/slide25_3.png",
    options: L2_OPTIONS,
    correct: L2_OPTIONS[1],
    q: "Pasien diabetes mellitus. Apa tindak lanjut Anda?",
    reasoning: "NPDR sedang, dengan adanya lesi berupa perdarahan blot dan hard exudate.",
    lesions: [
      { x: 49.2, y: 52.4, label: "Hard exudate" },
      { x: 57.2, y: 71.5, label: "Perdarahan blot" },
    ],
  },
]

const HERO_LESIONS: Lesion[] = [
  { x: 37.4, y: 23.4, label: "Perdarahan dot/blot" },
  { x: 57, y: 30.9, label: "Perdarahan dot/blot" },
  { x: 34.8, y: 51, label: "Hard exudate" },
]

function clampPct(v: number) {
  return Math.min(94, Math.max(6, v))
}

function badgeAt(l: Lesion) {
  if (l.dx != null || l.dy != null) {
    const o = { x: clampPct(l.x + (l.dx || 0)), y: clampPct(l.y + (l.dy || 0)) }
    if (Math.hypot(o.x - l.x, o.y - l.y) >= 8) return o
  }
  let vx = l.x - 50
  let vy = l.y - 50
  let n = Math.hypot(vx, vy)
  if (n < 1) {
    vx = -1
    vy = -1
    n = Math.SQRT2
  }
  let b = { x: clampPct(l.x + (vx / n) * 16), y: clampPct(l.y + (vy / n) * 16) }
  if (Math.hypot(b.x - l.x, b.y - l.y) < 8) {
    b = { x: clampPct(l.x - (vx / n) * 16), y: clampPct(l.y - (vy / n) * 16) }
  }
  return b
}

function r2(v: number) {
  return Math.round(v * 100) / 100
}

function computeArrow(l: Lesion, b: { x: number; y: number }) {
  const dx = l.x - b.x
  const dy = l.y - b.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const tip = { x: l.x - ux * 2.2, y: l.y - uy * 2.2 }
  const back = { x: tip.x - ux * 3, y: tip.y - uy * 3 }
  const start = { x: b.x + ux * 3.6, y: b.y + uy * 3.6 }
  return {
    line: { x1: r2(start.x), y1: r2(start.y), x2: r2(back.x), y2: r2(back.y) },
    polygon: [
      `${r2(tip.x)},${r2(tip.y)}`,
      `${r2(back.x - uy * 1.7)},${r2(back.y + ux * 1.7)}`,
      `${r2(back.x + uy * 1.7)},${r2(back.y - ux * 1.7)}`,
    ].join(" "),
  }
}

/**
 * Hero fundus lens with interactive amber pins and SVG vector arrows
 */
function HeroLens() {
  const [activePin, setActivePin] = useState<number | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActivePin(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <figure className="gama-lens relative mx-auto w-full max-w-[520px]">
      <img
        src="/content/drive-retinopati/assets/slide22_4.png"
        width={513}
        height={499}
        loading="eager"
        decoding="async"
        alt="Foto fundus dengan perdarahan dot/blot dan hard exudate, tiga temuan ditunjuk dengan panah bernomor."
        className="w-full"
      />

      <svg className="gama-arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {HERO_LESIONS.map((l, i) => {
          const b = badgeAt(l)
          const arrow = computeArrow(l, b)
          return (
            <g key={i}>
              <line x1={arrow.line.x1} y1={arrow.line.y1} x2={arrow.line.x2} y2={arrow.line.y2} />
              <polygon points={arrow.polygon} />
            </g>
          )
        })}
      </svg>

      {HERO_LESIONS.map((l, i) => {
        const b = badgeAt(l)
        const isAbove = b.y < l.y
        const isActive = activePin === i
        return (
          <div key={i}>
            <button
              type="button"
              className={`gama-pin cursor-pointer ${isActive ? "is-lit" : ""}`}
              style={{ left: `${b.x}%`, top: `${b.y}%` }}
              aria-label={`Temuan ${i + 1}`}
              aria-expanded={isActive}
              onClick={(e) => {
                e.stopPropagation()
                setActivePin(isActive ? null : i)
              }}
            >
              {i + 1}
            </button>
            {isActive && (
              <span
                className={`gama-tag ${isAbove ? "above" : ""}`}
                style={{ left: `${b.x}%`, top: `${b.y}%` }}
                role="status"
              >
                {l.label}
              </span>
            )}
          </div>
        )
      })}
    </figure>
  )
}

/**
 * Interactive grading simulation mirroring Modul 4 clinical grading
 */
function GradingSimulation() {
  const [caseIdx, setCaseIdx] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [litPin, setLitPin] = useState<number | null>(null)
  const [score, setScore] = useState(0)

  const currentCase = SIM_CASES[caseIdx]
  const isAnswered = selectedOption !== null
  const isCorrect = selectedOption === currentCase.correct
  const isLast = caseIdx === SIM_CASES.length - 1

  function handleOptionSelect(opt: string) {
    if (isAnswered) return
    setSelectedOption(opt)
    if (opt === currentCase.correct) {
      setScore((s) => s + 1)
    }
  }

  function handleNext() {
    if (isLast) {
      setCaseIdx(0)
      setSelectedOption(null)
      setLitPin(null)
      setScore(0)
    } else {
      setCaseIdx((i) => i + 1)
      setSelectedOption(null)
      setLitPin(null)
    }
  }

  return (
    <section className="sim bg-[#eaf5f5] py-16 dark:bg-slate-900/60" id="simulasi">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-8">
        <div className="mb-10 max-w-[50ch]">
          <h2 className="text-2xl font-extrabold tracking-tight text-[#0f2a44] sm:text-3xl dark:text-white">
            Coba simulasi grading
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#46607a] sm:text-base dark:text-slate-300">
            Lima kasus dari Modul 4, persis seperti di dalam kursus. Level 1 meminta Anda mengenali ada tidaknya
            retinopati. Level 2 meminta keputusan: observasi atau rujuk.
          </p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          {/* Fundus lens */}
          <figure className="gama-lens relative mx-auto w-full max-w-[520px]">
            <img
              src={currentCase.img}
              width={513}
              height={499}
              loading="lazy"
              decoding="async"
              alt={`Foto fundus kasus ${caseIdx + 1}.`}
              className="w-full"
            />

            {isAnswered && currentCase.lesions.length > 0 && (
              <>
                <svg className="gama-arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {currentCase.lesions.map((l, i) => {
                    const b = badgeAt(l)
                    const arrow = computeArrow(l, b)
                    return (
                      <g key={i}>
                        <line x1={arrow.line.x1} y1={arrow.line.y1} x2={arrow.line.x2} y2={arrow.line.y2} />
                        <polygon points={arrow.polygon} />
                      </g>
                    )
                  })}
                </svg>

                {currentCase.lesions.map((l, i) => {
                  const b = badgeAt(l)
                  const isLit = litPin === i
                  return (
                    <span
                      key={i}
                      className={`gama-pin ${isLit ? "is-lit" : ""}`}
                      style={{ left: `${b.x}%`, top: `${b.y}%` }}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                  )
                })}
              </>
            )}
          </figure>

          {/* Quiz card */}
          <div className="border-t-4 border-[#5bb4b2] bg-white p-6 shadow-sm sm:p-8 dark:bg-card">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="font-bold text-[#0f2a44] dark:text-white">
                Kasus {caseIdx + 1} dari {SIM_CASES.length}
              </span>
              <span className="text-xs text-[#6b8196] dark:text-slate-400">{currentCase.level}</span>
            </div>

            {/* Stepper bar */}
            <div className="mt-3 flex gap-1.5" aria-hidden="true">
              {SIM_CASES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 transition-colors ${
                    i < caseIdx ? "bg-[#5bb4b2]" : i === caseIdx ? "bg-[#137a77]" : "bg-[#d5e1ea] dark:bg-slate-700"
                  }`}
                />
              ))}
            </div>

            <p className="mt-6 text-lg font-semibold tracking-tight text-[#0f2a44] dark:text-white">{currentCase.q}</p>

            <div className="mt-5 grid gap-3">
              {currentCase.options.map((opt) => {
                const isPicked = selectedOption === opt
                const isOptionCorrect = opt === currentCase.correct

                let optClass =
                  "w-full text-left font-semibold text-sm sm:text-base p-4 border-2 transition-all cursor-pointer "
                if (!isAnswered) {
                  optClass +=
                    "border-[#d5e1ea] bg-white text-[#0f2a44] hover:border-[#5bb4b2] hover:bg-[#eaf5f5] dark:bg-background dark:text-white dark:border-slate-700"
                } else if (isOptionCorrect) {
                  optClass += "border-[#137a77] bg-[#137a77] text-white cursor-default"
                } else if (isPicked) {
                  optClass += "border-slate-300 bg-slate-100 text-slate-500 line-through cursor-default"
                } else {
                  optClass += "border-[#d5e1ea] bg-white text-slate-400 opacity-60 cursor-default dark:bg-background"
                }

                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={isAnswered}
                    onClick={() => handleOptionSelect(opt)}
                    className={optClass}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>

            {/* Verdict */}
            {isAnswered && (
              <div className="mt-6 space-y-2 border-t border-[#d5e1ea] pt-5 dark:border-slate-800">
                <p className={`text-base font-extrabold ${isCorrect ? "text-[#137a77]" : "text-[#b4541a]"}`}>
                  {isCorrect ? "Tepat." : `Jawaban kursus: ${currentCase.correct}.`}
                </p>
                <p className="text-sm leading-relaxed text-[#46607a] dark:text-slate-300">{currentCase.reasoning}</p>

                {currentCase.lesions.length > 0 && (
                  <ul className="mt-4 list-none space-y-1.5 p-0">
                    {currentCase.lesions.map((l, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onMouseEnter={() => setLitPin(i)}
                          onMouseLeave={() => setLitPin(null)}
                          onFocus={() => setLitPin(i)}
                          onBlur={() => setLitPin(null)}
                          className="flex w-full cursor-pointer items-center gap-3 border-t border-[#d5e1ea] py-2 text-left text-xs font-medium text-[#0f2a44] transition-colors hover:text-[#137a77] dark:border-slate-800 dark:text-slate-300 dark:hover:text-teal-400"
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f2902e] text-xs font-bold text-[#0f2a44]">
                            {i + 1}
                          </span>
                          <span>{l.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-3">
              <p className="text-xs text-[#6b8196] dark:text-slate-400">Di halaman ini jawaban tidak disimpan.</p>
              {isAnswered && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="cursor-pointer bg-[#0f2a44] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#1d4369] dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  {isLast ? "Ulangi dari kasus 1" : "Kasus berikutnya"}
                </button>
              )}
            </div>

            {isAnswered && isLast && (
              <p className="mt-4 text-xs font-semibold text-[#137a77] dark:text-teal-400">
                Anda menjawab {score} dari {SIM_CASES.length} kasus dengan tepat.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Public Landing Page matching GamaTutor's clinical UI/UX design & layout:
 * - Direct GamaTutor clinical hero banner with fundus lens & interactive lesion pins
 * - Tri-feature clinical cards (waktu fleksibel, grading fundus, sertifikasi sah)
 * - Interactive 5-case clinical grading simulation from Modul 4
 * - IDF diabetes burden statistic statement
 * - 5-module sequenced timeline path
 * - Published courses catalogue grid with SKP IDI accreditation badges
 * - Close banner with launch button
 * - Official institutional colophon
 */
export function LandingPage() {
  const { data: user } = useSession()

  const coursesQuery = useQuery({
    queryKey: ["landing-courses"],
    queryFn: () => apiGetPaged<ContractCourse>("/courses?status=published&pageSize=6"),
  })

  const courses = coursesQuery.data?.data ?? []
  const displayCourses = courses.slice(0, 4)

  return (
    <div className="flex min-h-svh flex-col bg-[#fbfdfe] text-[#0f2a44] dark:bg-background dark:text-foreground">
      <SiteHeader />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="py-12 sm:py-16 md:py-20" id="hero">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
              <div>
                <h1 className="text-3xl leading-[1.1] font-extrabold tracking-tight text-[#0f2a44] sm:text-4xl md:text-5xl dark:text-white">
                  Pelatihan Skrining Retinopati Diabetika
                  <span className="mt-3 block text-base font-medium text-[#46607a] sm:text-lg dark:text-slate-300">
                    Pelatihan daring untuk dokter layanan primer.
                  </span>
                </h1>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-[#46607a] dark:text-slate-300">
                  Dari diabetes mellitus sampai keputusan merujuk. Kursus daring untuk dokter layanan primer: Anda
                  membaca foto fundus sungguhan, menandai temuan, dan memutuskan tindak lanjutnya.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  {user ? (
                    <>
                      <Button
                        size="lg"
                        className="gama-launch cursor-pointer rounded-none border-0 shadow-md"
                        nativeButton={false}
                        render={<Link to="/courses" />}
                      >
                        <span>Lanjutkan belajar</span>
                        <ArrowRight className="ml-2 size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="cursor-pointer border-2 border-[#137a77] font-semibold text-[#137a77] hover:bg-[#eaf5f5]"
                        nativeButton={false}
                        render={<Link to="/dashboard" />}
                      >
                        Buka Dasbor
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="lg"
                      className="gama-launch cursor-pointer rounded-none border-0 shadow-md"
                      nativeButton={false}
                      render={<Link to="/register" />}
                    >
                      <span>Daftar sebagai peserta</span>
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  )}
                  <a
                    href="#simulasi"
                    className="gama-quiet cursor-pointer text-sm font-bold"
                    onClick={(e) => {
                      e.preventDefault()
                      document.getElementById("simulasi")?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }}
                  >
                    Coba satu kasus dulu
                  </a>
                </div>

                <dl className="mt-10 grid grid-cols-2 gap-4 border-t border-[#d5e1ea] pt-6 sm:grid-cols-3 dark:border-slate-800">
                  <div>
                    <dt className="text-xs text-[#6b8196] dark:text-slate-400">Isi</dt>
                    <dd className="mt-0.5 text-base font-bold text-[#0f2a44] dark:text-white">4 modul, 32 halaman</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#6b8196] dark:text-slate-400">Akses</dt>
                    <dd className="mt-0.5 text-base font-bold text-[#0f2a44] dark:text-white">Gratis, tanpa login</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#6b8196] dark:text-slate-400">Simulasi</dt>
                    <dd className="mt-0.5 text-base font-bold text-[#0f2a44] dark:text-white">5 kasus fundus</dd>
                  </div>
                </dl>
              </div>

              {/* Fundus lens hero */}
              <HeroLens />
            </div>
          </div>
        </section>

        {/* THREE CLINICAL BENEFIT CARDS */}
        <section className="border-y border-[#d5e1ea] bg-[#fbfdfe] py-12 dark:border-slate-800 dark:bg-card">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-8">
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="border-t-2 border-[#5bb4b2] bg-white p-6 shadow-xs dark:bg-background">
                <h2 className="text-base font-bold text-[#0f2a44] dark:text-white">Belajar sesuai waktu Anda</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#46607a] dark:text-slate-300">
                  Kemajuan tersimpan otomatis. Lanjutkan kapan saja dari perangkat mana pun.
                </p>
              </div>
              <div className="border-t-2 border-[#5bb4b2] bg-white p-6 shadow-xs dark:bg-background">
                <h2 className="text-base font-bold text-[#0f2a44] dark:text-white">Simulasi grading</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#46607a] dark:text-slate-300">
                  Nilai foto fundus pasien diabetes, lalu lihat setiap lesi yang seharusnya terlihat.
                </p>
              </div>
              <div className="border-t-2 border-[#5bb4b2] bg-white p-6 shadow-xs dark:bg-background">
                <h2 className="text-base font-bold text-[#0f2a44] dark:text-white">Sertifikat atas nama Anda</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#46607a] dark:text-slate-300">
                  Diterbitkan otomatis setelah lulus evaluasi, sesuai nama di akun, dan bisa diverifikasi.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE SIMULATION SECTION */}
        <GradingSimulation />

        {/* BURDEN SECTION */}
        <section className="py-16 sm:py-20 md:py-24">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-8">
            <div className="grid items-end gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
              <h2 className="text-3xl leading-[1.08] font-extrabold tracking-tight text-[#0f2a44] sm:text-4xl md:text-5xl dark:text-white">
                Indonesia ada di peringkat ke-5 dunia, dengan <em className="text-[#137a77] not-italic">20,4 juta</em>{" "}
                penderita diabetes.
              </h2>
              <div className="space-y-3 text-sm text-[#46607a] sm:text-base dark:text-slate-300">
                <p className="leading-relaxed">
                  Retinopati diabetika berkembang diam-diam dan bisa berakhir pada kebutaan. Sebagian besar pasien
                  diabetes pertama kali ditemui di layanan primer, jadi di sanalah skrining paling mungkin terjadi.
                </p>
                <p className="text-xs text-[#6b8196] dark:text-slate-400">
                  Angka 2024, dari Modul 1. Dunia: 588,7 juta penderita, diproyeksikan naik 45% pada 2050.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* THE PATH / COURSE MODULES */}
        <section className="bg-[#fbfdfe] py-16 dark:bg-background" id="materi">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-8">
            <div className="max-w-[50ch]">
              <h2 className="text-2xl font-extrabold tracking-tight text-[#0f2a44] sm:text-3xl dark:text-white">
                Isi kursus
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#46607a] sm:text-base dark:text-slate-300">
                Dikerjakan berurutan, dengan narasi suara di setiap halaman. Bisa dibuka dari ponsel.
              </p>
            </div>

            <ol className="gama-path mt-10">
              <li>
                <span className="num" aria-hidden="true">
                  1
                </span>
                <div>
                  <h3 className="pt-2 text-lg font-bold text-[#0f2a44] dark:text-white">Diabetes mellitus</h3>
                  <p className="text-xs text-[#6b8196] dark:text-slate-400">8 halaman</p>
                </div>
                <p className="desc text-sm leading-relaxed text-[#46607a] dark:text-slate-300">
                  Definisi, epidemiologi, etiologi, faktor risiko, kriteria diagnosis, klasifikasi glukosa dan HbA1c,
                  serta komplikasinya.
                </p>
              </li>
              <li>
                <span className="num" aria-hidden="true">
                  2
                </span>
                <div>
                  <h3 className="pt-2 text-lg font-bold text-[#0f2a44] dark:text-white">Retinopati diabetika</h3>
                  <p className="text-xs text-[#6b8196] dark:text-slate-400">8 halaman</p>
                </div>
                <p className="desc text-sm leading-relaxed text-[#46607a] dark:text-slate-300">
                  Anatomi mata dan patofisiologi yang bisa ditekan titik demi titik, gejala klinis, faktor risiko, dan
                  latihan mencocokkan.
                </p>
              </li>
              <li>
                <span className="num" aria-hidden="true">
                  3
                </span>
                <div>
                  <h3 className="pt-2 text-lg font-bold text-[#0f2a44] dark:text-white">Skrining dan tatalaksana</h3>
                  <p className="text-xs text-[#6b8196] dark:text-slate-400">2 halaman, dengan video</p>
                </div>
                <p className="desc text-sm leading-relaxed text-[#46607a] dark:text-slate-300">
                  Pemeriksaan ketajaman visual dengan bagan Snellen, langkah demi langkah.
                </p>
              </li>
              <li className="key">
                <span className="num" aria-hidden="true">
                  4
                </span>
                <div>
                  <h3 className="pt-2 text-lg font-bold text-[#0f2a44] dark:text-white">Simulasi grading</h3>
                  <p className="text-xs text-[#6b8196] dark:text-slate-400">5 kasus fundus</p>
                </div>
                <p className="desc text-sm leading-relaxed text-[#46607a] dark:text-slate-300">
                  Foto fundus pasien diabetes. Anda memutuskan, lalu kursus menunjukkan setiap lesi yang seharusnya
                  terlihat dan alasannya.
                </p>
              </li>
              <li>
                <span className="num" aria-hidden="true">
                  5
                </span>
                <div>
                  <h3 className="pt-2 text-lg font-bold text-[#0f2a44] dark:text-white">Evaluasi</h3>
                  <p className="text-xs text-[#6b8196] dark:text-slate-400">5 soal</p>
                </div>
                <p className="desc text-sm leading-relaxed text-[#46607a] dark:text-slate-300">
                  Pre-test dan post-test dengan pembahasan setiap pilihan. Nilai lulus 60.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* CATALOGUE SECTION (DRIVE-LEARN INTEGRATION) */}
        <section className="border-t border-[#d5e1ea] bg-[#fbfdfe] py-14 dark:border-slate-800 dark:bg-card">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d5e1ea] pb-4 dark:border-slate-800">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-[#0f2a44] dark:text-white">
                  <span className="inline-block h-5 w-1.5 rounded-full bg-[#5bb4b2]" aria-hidden="true" />
                  Topik: Retina &amp; Oftalmologi Praktis
                </h2>
                <p className="mt-1 text-xs text-[#6b8196] dark:text-slate-400">
                  Kursus dikelompokkan per topik. Topik Retina akan bertambah, termasuk AMD dan DME.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-semibold text-[#137a77] hover:text-[#0e625f] dark:text-teal-400"
                nativeButton={false}
                render={<Link to="/courses" />}
              >
                Lihat Semua Kursus
                <ChevronRight className="ml-1 size-3.5" />
              </Button>
            </div>

            <div className="mt-8">
              {coursesQuery.isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-44 w-full" />
                  <Skeleton className="h-44 w-full" />
                </div>
              ) : displayCourses.length === 0 ? (
                <Card className="p-8 text-center text-sm text-[#6b8196]">
                  Belum ada pelatihan klinis yang diterbitkan saat ini.
                </Card>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {displayCourses.map((c) => (
                    <Card
                      key={c.id}
                      className="flex flex-col justify-between border border-[#d5e1ea] bg-white p-6 shadow-xs transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-background"
                    >
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="border-[#5bb4b2]/30 bg-[#eaf5f5] text-[11px] font-bold text-[#137a77] dark:bg-teal-950/40 dark:text-teal-300"
                          >
                            4 SKP IDI
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-slate-200 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-300"
                          >
                            {c.courseType === "offline" ? "Luring (Tatap Muka)" : "Daring Mandiri"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-[#5bb4b2]/40 bg-teal-50/50 text-[11px] font-semibold text-[#137a77] dark:bg-teal-950/30 dark:text-teal-300"
                          >
                            Gratis
                          </Badge>
                        </div>

                        <h3 className="text-base leading-snug font-bold text-[#0f2a44] dark:text-white">{c.title}</h3>
                        {c.shortDescription ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#46607a] dark:text-slate-300">
                            {c.shortDescription}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                        <span className="text-xs font-semibold text-[#6b8196] dark:text-slate-400">
                          {c.modules?.length ?? 1} Modul · Tersertifikasi
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs font-semibold text-[#137a77] hover:text-[#0e625f] dark:text-teal-400"
                          nativeButton={false}
                          render={<Link to="/courses/$courseId" params={{ courseId: c.id }} />}
                        >
                          Detail Pelatihan
                          <ChevronRight className="ml-1 size-3" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CLOSE BANNER SECTION */}
        <section className="bg-gradient-to-r from-[#5bb4b2] via-[#2d77c2] to-[#173a5e] py-16 text-white sm:py-20">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-8">
            <h2 className="max-w-[16ch] text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Siap membaca fundus pertama Anda?
            </h2>
            <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-[#e6f2fb]">
              Daftar sekali, lalu belajar di peramban kapan saja. Kemajuan dan nilai Anda tersimpan, dan sertifikat
              terbit atas nama di akun Anda setelah lulus.
            </p>
            <div className="mt-8">
              <Button
                size="lg"
                className="cursor-pointer rounded-none border-0 bg-white font-bold text-[#0f2a44] shadow-md hover:bg-[#e6f5f5]"
                nativeButton={false}
                render={<Link to={user ? "/courses" : "/register"} />}
              >
                <span>{user ? "Buka Kursus" : "Daftar & mulai kursus"}</span>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
