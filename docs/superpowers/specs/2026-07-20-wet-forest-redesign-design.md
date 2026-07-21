# Wet-Forest Redesign — Design Spec

**Date:** 2026-07-20
**Topic:** Reimagine the personal portfolio (`index.html` + `assets/*`) into a cinematic, modern-minimal **Pacific Northwest** "warm refuge in a cold wet forest" theme.
**Status:** Approved for planning. Implementation will proceed iteratively.

---

## Context

The site is a hand-built, zero-framework static portfolio (Vite → GitHub Pages, `taotdm.com`) for Shi-Tao Chang. It was just re-skinned into a **modern dark-stone rain theme** (jade/water accents, Fraunces display serif, a `<canvas>` rain engine + drifting mist, a `[clear mist]` toggle, a spring-physics weather dial, interactive travel maps, live weather, GitHub activity, a command palette, and a `rain` easter egg). That state is the **starting point** for this work — content and interactive features are all in place and stay.

The owner wants to evolve the theme toward **dark stone / misty / nature — more traditional yet modern**, then, via three reference photos (a dark concrete house in a misty forest with waterfalls + warm interior glow; a rainy pine highway fading into fog with warm headlights; a dark modern room with a fire, looking out floor-to-ceiling glass at a rainy misty forest), refined it decisively toward **sleek modern cinematic**, not old-world ornament.

**The emotional engine (from the references):** a *cold, desaturated, misty pine forest* with a single *warm glowing light* inside it — the warm/cool tension is the whole aesthetic. "A warm refuge looking out at cold wet forest."

**Regional theme:** **Pacific Northwest / Cascadia** — tall narrow Douglas-fir and western-red-cedar spires, dense evergreen, endless rain and fog, moss-dark greens, fog-separated ridgelines receding into mist (reference photo 2 is a classic PNW evergreen highway).

## Confirmed decisions

1. **Direction:** old-world naturalist *feeling* executed as **full cinematic-modern minimalism** — no engraving, copperplate, or botanical ornament. Naturalism comes only from the environment (pines, fog, rain, reflections), never from decoration.
2. **Typography — three voices:** **Cormorant Garamond** (display: name, roman numerals, inset caps), **Spectral** (reading prose + italic taglines/sublabels), **Maple Mono** (data only: dates, coords, stamps, status bar, map tips). Clean hierarchy; simple letter-spaced labels, no ornate small-caps.
3. **Atmosphere:** layered misty forest + rain, plus cinematic wetness (rain-on-glass, wet-surface gloss). See §Atmosphere.
4. **Palette:** cool near-monochrome pine-forest greens over wet green-black stone, with **one warm accent = glowing amber light** (not matte brass), used rarely.
5. **Light/dark:** dark only. The existing header toggle stays as `[clear mist]` and now gates the entire atmosphere (forest fog + rain + droplets).

## Palette (CSS custom properties, replace `:root`)

| token | role | value |
|---|---|---|
| `--stone` | page background (wet green-black) | `#0b100e` |
| `--stone-2` | raised panels / cards | `#131a17` |
| `--ink` | prose text (cool bone) | `#dfe3dd` |
| `--ink-dim` | secondary text | `#aab4ae` |
| `--fog` | muted / data / mist | `#7e8c86` |
| `--jade` | structural accent (labels, marks, active, links) | `#79a793` (muted forest-teal) |
| `--forest` | silhouette / deep fills | `#26332e` |
| `--glow` | **warm amber light — rare** (masthead bloom, hover/active glint, map home marker) | `#e3a866` |

Rules: cool everywhere; `--glow` is the only warm and must stay scarce (it reads as *a light source*, not a color). Links are `--jade`, gaining a warm `--glow` underline/soft text-shadow on hover. Selection/focus/marker = jade. Values are starting points; tune during implementation.

## Typography

- Swap the Google Fonts `<link>`: Fraunces → **Cormorant Garamond** (e.g. weights 400/500/600 + italic) **+ Spectral** (400/500 + italic). Keep **Maple Mono** local `@font-face`.
- `--serif-display: "Cormorant Garamond", Georgia, serif;` for the name, roman numerals, inset caps.
- `--serif-text: "Spectral", Georgia, serif;` for prose paragraphs, taglines, `obs` sublabels, colophon.
- Mono stays for `.stamp`, `.dt`, `.idx`, coords, status bar, map tooltips, command palette.
- Cormorant is high-contrast and light — size generously (name large/airy) and avoid tiny sizes.

## Atmosphere (fixed layers behind content, back → front)

1. **Wet-stone base** — deep vertical/radial gradient in green-blacks.
2. **Warm window bloom** — a soft, low-opacity amber radial behind/above the masthead: the "distant window in fog." The emotional anchor. Static or very slow pulse.
3. **Receding fir ridgelines (PNW)** — 3–4 stacked conifer silhouette bands, each higher, fainter, and haze-tinted the farther back it sits (nearest `--forest` at ~18–22% down to farthest ~5% opacity, fog-tinted). **Pure ridgelines only — no foreground framing trees, no ferns/underbrush.** They dissolve into mist toward the top of the stack.
4. **Drifting fog** — CSS-keyframe gradient bands *interleaved between* the ridgelines (so distant ridges haze out more), cool green-gray, slow drift (existing `.mist` approach, re-tuned).
5. **Falling rain** — existing `<canvas id="rain">` engine, re-tuned to fall lighter/among the trees.
6. **Rain-on-glass droplets** — a subtle layer of clinging droplets that occasionally slide down (canvas or CSS); gives the "window in the rain" read.
7. **Wet-surface gloss** — a faint reflective sheen gradient at the base, suggesting wet ground catching light.
8. **Film grain** — very subtle noise overlay for cinematic texture.

**Forest rendering — procedurally-generated inline SVG:** a small JS function builds real conifer silhouettes as SVG `<path>` data and injects them into fixed layer groups (crisp, scalable, tiny, CSP-safe — not CSS-gradient trees, not raster). Chosen over a hand-drawn static path because PNW forest must read as *dense and irregular*; a generator gives organic variation and per-band density control in very little code.

- **One tree:** a filled silhouette — pointed spire top with layered, slightly-drooping branch tiers widening toward the base (Douglas-fir / spruce shape), traced as a zig-zag outline. Randomized per tree: height, width, tier count, slight lean; tall narrow spires dominate.
- **One band:** a single filled `<path>` that walks the baseline and traces up-and-over each tree, so the whole ridge is one shape resting on its baseline. A **seeded PRNG** keeps a band stable within a session.
- **Depth:** 3–4 bands at increasing baseline heights, decreasing opacity, and increasing fog-tint toward the back; gentle differential parallax (all bands are "distant," so movement is subtle). Built once at load; only `transform` changes on scroll.
- Reduced-motion: bands render statically, no parallax.

**Parallax:** scroll drives the pine layers at fractional translate rates via a lightweight rAF handler (reuse the existing scroll/rAF pattern). Cheap `transform` only.

**Toggle & motion:** `[clear mist]` (existing `watch-toggle` / `data-mist` / `localStorage`) gates layers 2–8. `prefers-reduced-motion` freezes parallax, fog drift, rain, and droplets to a still scene (rain rAF not started; animations frozen) — content always fully visible.

## Warm-glow usage (keep scarce)

- Masthead: soft amber bloom behind the title.
- Links / `text-control` buttons: jade default; warm `--glow` underline + faint glow on hover/focus.
- Active/open state accents (e.g. an opened entry's caret, active section): a small warm glint.
- Travel map **home marker**: a warm amber point — "a light in the dark."
- Everything else stays cool. No large warm fills.

## Components (clean modern restyle; structure preserved)

- **Masthead:** Cormorant name centered with the amber bloom behind; Spectral italic tagline; mono coords. Keep the converging `#routes` drawing (cs / linguistics / geography → a node) but redraw it minimal — thin jade lines to a small warm node. (Open question for build: keep vs drop; default = keep, restyled.)
- **Sections (`.plate`):** keep the two-column numeral-rail + body grid. Roman numerals in Cormorant/jade; labels as simple letter-spaced uppercase (mono or Spectral), `obs` sublabel Spectral italic/fog.
- **Dividers:** ultra-minimal fading hairline, optional faint jade point. No sprigs.
- **Entry rows (`details.fix`):** keep the dotted-leader ledger; jade caret, warm glint when open; mono stamps.
- **Log cards (`.log`):** `--stone-2` panel, jade left rule, bone text.
- **Travel map:** visited fills in jade/celadon; planned in jade hatch; **home = warm amber marker**; hairline borders; fog tooltip. Mechanics unchanged.
- **Weather dial (`#compass`):** minimal ring in fog/jade, jade needle, optional faint warm center. Spring physics + live wind ring unchanged.
- **Legend ("Elsewhere"):** clean key, minimal glyphs, cool.
- **Status bar:** cool translucent blur (as now), mono.
- **Overlays (rain inset, command palette, toast):** dark stone-2 panels, subtle borders, consistent with the new palette.

## Motion & load choreography

One orchestrated page load: masthead rises/fades in as the amber glow blooms, then sections reveal in a staggered cascade (`animation-delay` on the existing `.reveal` system). Atmosphere runs continuously beneath. High-impact single moment, not scattered micro-interactions. Reduced-motion → everything static, content visible.

## Preserved functionality (must not regress)

All text content; the travel maps (states/countries swap, zoom/pan, field notes, easter-egg flash); live weather (NWS + Open-Meteo fallback) and clocks; GitHub activity; the command palette (`/`, ⌘K); `[clear mist]`; the `rain` easter egg; skip-link / ARIA / focus states; and `@media print` (legible dark ink on white).

## Files to modify

- **`index.html`** — swap font `<link>`; add forest SVG layers, warm-bloom element, rain-on-glass + gloss layers; restyle masthead/`#routes`/`#compass` markup; bump asset `?v=` cache-busters.
- **`assets/site.css`** (largest) — new palette tokens + type vars; atmosphere layers, parallax classes, grain, `data-mist` gating; component restyles; load choreography; updated reduced-motion + print blocks.
- **`assets/site.js`** — pine-layer scroll parallax; rain re-tune + optional rain-on-glass; ensure `[clear mist]` gates all new layers; keep everything else.
- **`README.md`** — update the theme description.

## Out of scope (flagged follow-ups)

- `images/favicon.svg` — could become a small warm point / pine mark. Not blocking.
- `images/og-preview.{svg,png}` — still shows a prior design; regenerate later.

## Verification

1. `npm install` (if needed) → `npm run dev`.
2. Visual: cold desaturated pine atmosphere, layered pines into fog, falling rain + glass droplets, wet gloss, and a single warm amber glow; text crisp and legible.
3. `[clear mist]` clears the whole atmosphere and persists across reload; dark stays.
4. `prefers-reduced-motion` → still scene, content visible, no rain loop.
5. All interactive features work (travel maps, weather, GitHub, palette, easter egg); mobile (≤640px) tasteful and performant.
6. `npm run build && npm run preview` renders identically; headless screenshot check.

## Working style

Implementation proceeds **iteratively** (per owner): build the atmosphere and palette first, review a rendered screenshot, then refine glow intensity, forest density, and type sizing in passes rather than one big drop.
