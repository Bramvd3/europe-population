# Bevolkingsevolutie in Europa — VRT NWS

Deployable static site voor het scrollytelling-artikel + standalone
interactieve kaart.

- **Productie**: `https://interactief.vrtnws.be/2026/europese-populatie/`
- **Staging (GitHub Pages)**: `https://bramvd3.github.io/europe-population/`

Twee pagina's, geserveerd uit deze folder:

| URL          | Wat |
| ------------ | --- |
| `/`          | Het verhalende artikel met sticky scrolly-map + inline interactieve kaart onderaan |
| `/kaart.html`| Standalone interactieve kaart — dezelfde engine, full-viewport, embed-vriendelijk |

Beide pagina's gebruiken dezelfde rendering-code (`js/scrolly-inline.js`
+ `js/interactive-inline.js`) — één bron van waarheid voor kleurenschaal,
popup, zoekfunctie, cooperative gestures.

## Stack

- **MapLibre GL JS 4.7** + **pmtiles@3.2** — vector rendering uit een
  single-file `.pmtiles`
- **Protomaps** basemap (Nederlandstalige labels, "white" flavor). In
  productie zelfgehost onder `/protomaps-basemap/`; lokaal via
  `api.protomaps.com` — zie sectie "Lokaal draaien" hieronder.
- **D3 v7** — popup-trendgrafiek + legenda + in-card mini-charts
- **noUiSlider 15.7** — dubbele-handle jaarslider (interactieve kaart)
- **Roobert** — VRT's huisletter (self-hosted onder `assets/fonts/`)
- Plain HTML/CSS/JS — geen bundler, geen build step

## Map-structuur

```text
webapp/
├── README.md
├── index.html                ← het artikel (root)
├── kaart.html                ← standalone interactieve kaart
├── article.css               ← alle styling: hero, prose, scrollboxen,
│                                chapter-back covers, marker-pills, popup
├── article.js                ← IntersectionObserver → sendStep(),
│                                anchor-scroll voor #belgie / #de-21e-eeuw /
│                                #europese-trends, lazy init voor interactieve kaart
│
├── js/
│   ├── scrolly-inline.js     ← STEPS-array, HIGHLIGHT_UNITS, chart-panels,
│   │                            pre-warm & fade choreography voor de sticky map,
│   │                            pre-baked kleur-lookup (c_61_24 / c_61_01 / c_01_24)
│   └── interactive-inline.js ← year-slider, hover/click popup, gemeentezoek,
│                                fitBounds voor iframe-embeds, URL-param overrides,
│                                Roobert-glyph toggle (default false), cooperative gestures
│
├── assets/
│   ├── vendor/               ← Alle libs self-hosted (geen CDN)
│   │   ├── maplibre-gl.{css,js}     ← 4.7.1
│   │   ├── pmtiles.js               ← 3.2.0
│   │   ├── protomaps-themes-base.js ← 4.5.0
│   │   ├── d3.min.js                ← v7
│   │   └── nouislider.min.{css,js}  ← 15.7.1
│   ├── fonts/                ← Roobert Regular/Medium/SemiBold ({woff2,woff})
│   └── img/                  ← Hero photo, chapter backgrounds (h1/h2/h3),
│                                article images (Gent 1976, Aalst 1975, …)
│
└── data/
    ├── lau-scrolly.pmtiles     ← 92 MB. Alle 107k LAUs met pre-baked kleurcodes
    │                             voor drie scrolly-perioden (c_61_24, c_61_01,
    │                             c_01_24). Byte-range fetched via pmtiles.js.
    ├── be-highlights.geojson   ← 6.6 KB. Drie dissolved outlines:
    │                             BRU (Brussels Gewest, 19 fusiegemeenten),
    │                             WST (Westhoek, 17 gemeenten),
    │                             LUX (Groothertogdom, 102 LU communes).
    ├── be-search.json          ← 36 KB. 581 BE gemeentes {id, name, lon, lat}
    │                             voor de "zoek je gemeente"-typeahead.
    └── belgium-test.pmtiles    ← 3 MB. BE-only test-file voor lokale iteratie.
```

## Feature-overzicht

**Scrolly** (24 stappen, 3 hoofdstukken)
- Hoofdstuk 1: België 1961-2001 — stadsvlucht, suburbanisatie, Brusselaars
  naar de rand, Antwerpen, Limburgse mijnstreek, krimpende Westhoek
- Hoofdstuk 2: België 2001-2024 — steden groeien terug, knik in de grafiek,
  woningmarkt, kleine steden, arbeiderssteden, Luxemburg, Westhoek stagneert
- Hoofdstuk 3: Europese trends — Iberisch, Frankrijk & diagonale du vide,
  Oost-Europa, Noordwest-Europa, Duitsland
- Deeplink-anchors: `#belgie`, `#de-21e-eeuw`, `#europese-trends`
- Highlight-units met VRT-stijl pill-labels; multi-commune highlights
  (Brussel, Westhoek, Luxemburg) via pre-baked dissolved outlines →
  geen zichtbare interne grenzen
- In-card mini-grafieken met dynamische year-range; y-as start op 0

**Interactieve kaart** (`kaart.html` + inline op `index.html`)
- Fit-to-bounds op België default (bbox `[[2.4,49.4],[6.5,51.6]]`),
  adapt aan viewport-grootte via ResizeObserver
- **URL-param overrides** (nuttig voor iframe-embeds):
  - `?bbox=west,south,east,north[&padding=30]` — fit to bbox
  - `?lon=4.6&lat=50.6&zoom=7` — fixed pose
- Cooperative gestures — Ctrl/Cmd + scroll om te zoomen, twee vingers voor
  touch-pan
- Accent-insensitive zoek voor 581 BE gemeentes
- Click-op-gemeente popup met bevolkingslijn 1961-2024
- **iframe-embed voorbeeld** (AEM):
  ```html
  <iframe src="https://interactief.vrtnws.be/2026/europese-populatie/kaart.html"
          width="100%" height="600" style="border:none"
          loading="lazy"
          title="Europese bevolkingsevolutie 1961-2024"></iframe>
  ```

## Lokaal draaien

Vanuit de parent-map (`populatie-app/`):

```bash
python3 serve_local.py 8000 webapp
# open:
#   http://127.0.0.1:8000/           ← het artikel
#   http://127.0.0.1:8000/kaart.html ← standalone kaart
```

> **Basemap-fix voor lokale dev.** `BASEMAP_URL` bovenaan
> `js/interactive-inline.js` verwijst standaard naar de zelfgehoste
> basemap-tiles op de SFTP-productiehost:
>
> ```js
> const BASEMAP_URL = "pmtiles:///protomaps-basemap/global-basemap-maxzoom-10.pmtiles";
> ```
>
> Dat pad bestaat niet op je laptop — de kaart blijft dus grijs.
> Verander tijdelijk naar de publieke Protomaps API:
>
> ```js
> const BASEMAP_URL = `https://api.protomaps.com/tiles/v4.json?key=${PROTOMAPS_KEY}`;
> ```
>
> `js/scrolly-inline.js` gebruikt de API-URL al standaard, dus die hoef
> je niet aan te passen. **Vergeet niet terug te zetten** voor je
> pusht/uploadt.
>
> De Protomaps API-key is origin-beperkt. Voor lokale testing: voeg
> `127.0.0.1` toe aan de allowlist op
> [app.protomaps.com](https://app.protomaps.com), of zet 'm tijdelijk op `*`.

## Deployen

### SFTP naar VRT (huidige productie)

Voorbeeld met lftp (upload alleen wat veranderd is):

```bash
lftp -u vrtnws-speeltuin sftp://sftp.dpc.vrt.be -e "
  mirror --reverse --only-newer --no-perms --parallel=4 \
    ./ /vrtnws-speeltuin-sftp/2026/europese-populatie/;
  bye
"
```

Live op `https://interactief.vrtnws.be/2026/europese-populatie/`.

### GitHub Pages (staging/legacy)

```bash
git add <files>
git commit -m "…"
git push    # GitHub Pages bouwt + serveert binnen ~1 min
```

De host **moet** HTTP Range-requests ondersteunen voor `.pmtiles`. Alle
moderne CDN's + GitHub Pages doen dat.

## Data + methodologie

- Bron: [JRC Local Population Time-Series 1961–2024](https://data.jrc.ec.europa.eu/dataset/37fcacbf-12e2-4b31-b1af-83117a74b2c7)
- LAU-geometrieën zijn topology-aware vereenvoudigd (`--simplification=8`
  in tippecanoe, per-zoom vertex-reductie zonder features te droppen)
- UK en IJsland missen 2024-data — de pop_2024-kolom coalesce't naar
  pop_2021 zodat ze niet leeg verschijnen
- Bin-thresholds (%-verandering): `[-75, -50, -25, -10, 0, 10, 25, 50, 75]`
  in `interactive-inline.js`, `[-75, -50, -25, -10, 0, 10, 25, 50, 75]`
  in `scrolly-inline.js` (rood → wit → groen, 10 stops)
- Pre-baked kleurcodes zijn per LAU als string-property in de MVT:
  `c_61_24`, `c_61_01`, `c_01_24` — matched met de JS-COLORS-array
  op buildtime in `rebuild_pmtiles.py`
- De data zelf reproduceren vanaf raw ARDECO-input: zie `../README.md` in
  de parent map
