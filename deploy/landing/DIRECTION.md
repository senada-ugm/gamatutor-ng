# GamaTutor landing — creative direction

One page. One file: `index.html`, installed verbatim by `tools/deploy.sh` to the
webroot. No build step, no framework.

## The one idea

**The front door of the DRIVE course.** The page is for primary care doctors deciding
whether to take DRIVE, so it speaks Indonesian, the course's language, and it lets them
do the course's most characteristic thing before they enrol: read a fundus photograph
and decide. Everything about the platform itself (SlideForge, the pipeline, other
courses, what is not built) was removed; the honest note that scores are not yet
recorded survives, in the simulation and the close.

## Tokens

Clinic daylight, not a dark room.

| Token | Hex | Role |
|---|---|---|
| page | `#fbfdfe` | cool white ground |
| tint | `#eaf5f5` | simulation band, lens halo |
| ink | `#0f2a44` | brand navy, all text |
| teal | `#137a77` | every interactive state (the brand `#5bb4b2` darkened to pass AA on white) |
| amber | `#f2902e` | the optic disc; used only for findings marked on a retina, and module 4 |

The teal → blue → navy run from the player's sidebar head appears once, at full
strength, as the closing band.

Type: Plus Jakarta Sans (400/500/600/800), an Indonesian-designed face, loaded with
`display=swap` and falling back to Segoe UI. This replaces the earlier
no-webfont rule in exchange for a brighter, warmer voice.

## The lens

Fundus photographs are discs on black. On a white page they are clipped with
`clip-path: circle(45% at 50% 49%)`, just inside the disc, which also drops the camera
timestamp, and ringed with a pale halo like an ophthalmoscope's edge. Lesion markers sit
on the unclipped box, so the course's own percentages land unchanged.

## The arc

1. **Hero:** title, audience, one sentence of what you do, start CTA, three facts; the
   lens with modul4-p3's three real lesion markers, which appear once on load.
2. **Simulasi (the peak):** all five grading cases from Modul 4, in order, with
   progress, verdict, reasoning, a lesion legend that lights its marker, and a score at
   the end. Every value is the course's own (`modul4-p2`..`modul4-p6`).
3. **Burden:** one large statement from Modul 1 (Indonesia 5th, 20.4 million).
4. **Isi kursus:** the five modules as a numbered rail, since they are a sequence; then
   the 3D eye atlas (the separate `../3D` Vite app, deployed to `/anatomi-mata/`). The
   landing shows a still (`/anatomi-mata/poster.jpg`) on a dark stage and loads
   `/anatomi-mata/?embed` in an iframe only when asked, on screens 900px and wider;
   on a phone the still links to the full page instead.
5. **Close:** gradient band, start CTA, plain note about no account and no saved score.

Motion: one load sequence. After that only the visitor's actions move anything.
`prefers-reduced-motion` gets the full page without transitions.
