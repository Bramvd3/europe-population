/* render map en graphs in scrolly */ 

/* Inline scrolly map controller for article page */
const ALL_YEARS = [1961, 1971, 1981, 1991, 2001, 2011, 2021, 2024];
const PCT_BINS = [-75, -50, -25, -10, 0, 10, 25, 50, 75];
const COLORS = ["#E62323", "#FF4944", "#FF7882", "#FFBFC3", "#FFF2F6", "#EEF7EE", "#C3F0C7", "#6DE19B", "#3ECF6E", "#21891F"];
const NO_DATA_COLOR = "rgba(0,0,0,0)";

// Highlight units — logical groups the map can outline + label. Three
// shapes:
//   { ids: [...], center: [lon,lat] }
//       Single-commune or multi-commune-no-merge: outline drawn via
//       the lau source filter on gisco_id.
//   { ids: [...], center: [...], dissolved: true }
//       Multi-commune merged: outline drawn from be-highlights.geojson
//       (pre-baked unary_union polygon, no inner borders). `key` in
//       that file must match the HIGHLIGHT_UNITS key.
//   { center: [...], labelOnly: true }
//       No outline (the visual highlight comes from elsewhere, e.g.
//       countryHighlight for LUX). Only the pill label is rendered.
const HIGHLIGHT_UNITS = {
  // Dissolved multi-commune regions (need a matching feature in
  // data/be-highlights.geojson keyed by the same JS key).
  BRU: { name: "Brussel",     ids: ["BE_21001","BE_21002","BE_21003","BE_21004","BE_21005","BE_21006","BE_21007","BE_21008","BE_21009","BE_21010","BE_21011","BE_21012","BE_21013","BE_21014","BE_21015","BE_21016","BE_21017","BE_21018","BE_21019"], center: [4.3709, 50.8358], dissolved: true },
  WST: { name: "De Westhoek", ids: ["BE_38002","BE_38008","BE_32003","BE_33039","BE_32006","BE_33011","BE_32010","BE_38014","BE_32011","BE_33040","BE_32030","BE_33016","BE_38016","BE_33021","BE_38025","BE_33041","BE_33037"], center: [2.8103, 50.9539], dissolved: true },
  // Country-level — outlined via the dissolved LU communes (key "LUX"
  // in be-highlights.geojson). `noLabel` keeps the outline but skips
  // the pill marker (the country boundary speaks for itself; the
  // story-relevant labels are Léglise + Vaux-sur-Sûre).
  LUX: { name: "Groothertogdom Luxemburg", ids: [], center: [6.0925, 49.7768], dissolved: true, noLabel: true },
  // Single-commune highlights (LAU outline = outer perimeter already).
  ANT:  { name: "Antwerpen",            ids: ["BE_11002"], center: [4.404, 51.219] },
  GEN:  { name: "Gent",                 ids: ["BE_44021"], center: [3.722, 51.054] },
  LIE:  { name: "Luik",                 ids: ["BE_62063"], center: [5.573, 50.642] },
  CHA:  { name: "Charleroi",            ids: ["BE_52011"], center: [4.444, 50.412] },
  AAL:  { name: "Aalst",                ids: ["BE_41002"], center: [4.040, 50.937] },
  WET:  { name: "Wetteren",             ids: ["BE_42025"], center: [3.880, 51.000] },
  MEC:  { name: "Mechelen",             ids: ["BE_12025"], center: [4.480, 51.028] },
  TIE:  { name: "Tienen",               ids: ["BE_24107"], center: [4.937, 50.806] },
  VIL:  { name: "Vilvoorde",            ids: ["BE_23088"], center: [4.428, 50.928] },
  NIN:  { name: "Ninove",               ids: ["BE_41048"], center: [4.022, 50.835] },
  DEN:  { name: "Denderleeuw",          ids: ["BE_41011"], center: [4.067, 50.890] },
  ETT:  { name: "Etterbeek",            ids: ["BE_21005"], center: [4.3946, 50.8333] },
  ELS:  { name: "Elsene",               ids: ["BE_21009"], center: [4.3771, 50.8223] },
  SGS:  { name: "Sint-Gillis",          ids: ["BE_21013"], center: [4.3440, 50.8300] },
  OLN:  { name: "Louvain-la-Neuve",     ids: ["BE_25121"], center: [4.5652, 50.6704] },
  LIER: { name: "Lier",                 ids: ["BE_12021"], center: [4.5736, 51.1188] },
  HAS:  { name: "Hasselt",              ids: ["BE_71022"], center: [5.3088, 50.9351] },
  GNK:  { name: "Genk",                 ids: ["BE_71016"], center: [5.4961, 50.9673] },
  HHL:  { name: "Houthalen-Helchteren", ids: ["BE_72039"], center: [5.4080, 51.0452] },
  WAR:  { name: "Waregem",              ids: ["BE_34040"], center: [3.4022, 50.8806] },
  LEG:  { name: "Léglise",              ids: ["BE_84033"], center: [5.5676, 49.8102] },
  VSS:  { name: "Vaux-sur-Sûre",        ids: ["BE_82036"], center: [5.6068, 49.9346] },
};

// Highlight sets used by STEPS — arrays of HIGHLIGHT_UNITS keys.
const BIG_CITIES = ["GEN", "ANT", "BRU", "LIE", "CHA"];
// Just "Brussel" (dissolved Brussels Region) + Louvain-la-Neuve.
// ETT/ELS/SGS dropped: they sit inside the dissolved Brussels outline,
// so adding their per-commune outlines would re-introduce the inner
// borders we just got rid of, and four overlapping labels in one spot
// reads as clutter.
const BRU_RAND_CITIES = ["BRU", "OLN"];
const ANT_RAND_CITIES = ["ANT", "LIER", "MEC"];
const LIMBURG_MIJN = ["HAS", "GNK", "HHL"];
const MECHELEN_VILVOORDE_BXL_ANT = ["MEC", "VIL", "ANT", "BRU"];
const ARBEIDERSSTEDEN = ["AAL", "NIN", "TIE", "DEN"];
const FOUR_SMALLER = ["AAL", "WET", "MEC", "TIE"];
const WESTHOEK_KRIMP = ["WAR", "WST"];
const LUX_PENDEL = ["LUX", "LEG", "VSS"];

// Pseudo-IDs for the chart engine. When a data-ids attribute lists one
// of these, the chart code sums populations across the listed sub-LAUs
// instead of pulling a single feature. Keeps the HTML readable
// (`data-ids="BRU_REGION,BE_11002"` instead of dumping all 19 NIS
// codes) and lets the aggregation logic live in one place.
const AGGREGATES = {
  BRU_REGION: {
    name: "Brussels Gewest",
    ids: [
      "BE_21001", "BE_21002", "BE_21003", "BE_21004", "BE_21005",
      "BE_21006", "BE_21007", "BE_21008", "BE_21009", "BE_21010",
      "BE_21011", "BE_21012", "BE_21013", "BE_21014", "BE_21015",
      "BE_21016", "BE_21017", "BE_21018", "BE_21019",
    ],
  },
};

// `dim` is an array of country-code prefixes to KEEP visible (rest is
// dimmed). null / empty array = no dim. ['BE_'] = only Belgium kept;
// ['FR_','ES_','PT_'] = France + Iberian peninsula stay coloured, rest fades.
// Steps with `chapter: true` are full-screen chapter dividers — the map
// just holds whatever state the previous step left it in (smooth pause).
const STEPS = [
  // 0 — Europa in beweging: Europe overview, intro + legend.
  { yearA: 1961, yearB: 2024, center: [10, 52], zoom: 4.5, highlight: [], dim: null, countryHighlight: null },
  // 1 — Chapter: Terug naar België (period switches to 1961-2001).
  { yearA: 1961, yearB: 2001, center: [4.6, 50.7], zoom: 6.5, highlight: [], dim: null, countryHighlight: null, chapter: true },
  // 2 — De stadsvlucht (5 grote BE steden highlighted).
  { yearA: 1961, yearB: 2001, center: [4.6, 50.7], zoom: 7.5, highlight: BIG_CITIES, dim: ["BE_"], countryHighlight: null },
  // 3 — De suburbanisatie (zoom op Gent).
  { yearA: 1961, yearB: 2001, center: [3.72, 51.05], zoom: 9.5, highlight: ["GEN"], dim: ["BE_"], countryHighlight: null },
  // 4 — Aalst / Wetteren / Mechelen / Tienen.
  { yearA: 1961, yearB: 2001, center: [4.4, 50.95], zoom: 8.5, highlight: FOUR_SMALLER, dim: ["BE_"], countryHighlight: null },
  // 5 — Brusselaars trekken naar de rand (focus Brussel + chart BRU+LLN).
  { yearA: 1961, yearB: 2001, center: [4.4, 50.75], zoom: 9.9, highlight: BRU_RAND_CITIES, dim: ["BE_"], countryHighlight: null },
  // 6 — Ook stadsvlucht in Antwerpen (Antwerpen + Lier + Mechelen).
  { yearA: 1961, yearB: 2001, center: [4.5, 51.2], zoom: 9.5, highlight: ANT_RAND_CITIES, dim: ["BE_"], countryHighlight: null },
  // 7 — De Limburgse mijnstreek groeit (Hasselt, Genk, Houthalen-Helchteren).
  { yearA: 1961, yearB: 2001, center: [5.4, 50.95], zoom: 9.3, highlight: LIMBURG_MIJN, dim: ["BE_"], countryHighlight: null },
  // 8 — De krimpende Westhoek (Waregem highlighted + Westhoek-regio dissolved).
  { yearA: 1961, yearB: 2001, center: [2.85, 50.9], zoom: 9.3, highlight: WESTHOEK_KRIMP, dim: ["BE_"], countryHighlight: null },
  // 9 — Chapter: De 21e eeuw (period switches to 2001-2024).
  { yearA: 2001, yearB: 2024, center: [4.6, 50.7], zoom: 7.2, highlight: BIG_CITIES, dim: ["BE_"], countryHighlight: null },
  // 10 — De steden groeien terug (BE focus + 5 cities).
  { yearA: 2001, yearB: 2024, center: [4.6, 50.7], zoom: 7.2, highlight: BIG_CITIES, dim: ["BE_"], countryHighlight: null },
  // 11 — De knik in de grafiek (5 cities + 3 in-card charts).
  { yearA: 2001, yearB: 2024, center: [4.1, 51.10], zoom: 9, highlight: BIG_CITIES, dim: ["BE_"], countryHighlight: null },
  // 12 — Druk op de woningmarkt (focus Brussel).
  { yearA: 2001, yearB: 2024, center: [4.1, 51.10], zoom: 9.0, highlight: BIG_CITIES, dim: ["BE_"], countryHighlight: null },
  // 13 — Kleine steden groeien mee: Mechelen + Vilvoorde highlighted.
  { yearA: 2001, yearB: 2024, center: [4.4, 50.95], zoom: 9.3, highlight: MECHELEN_VILVOORDE_BXL_ANT, dim: ["BE_"], countryHighlight: null },
  // 14 — Historische arbeiderssteden: Aalst / Ninove / Tienen / Denderleeuw.
  { yearA: 2001, yearB: 2024, center: [4.4, 50.85], zoom: 8.5, highlight: ARBEIDERSSTEDEN, dim: ["BE_"], countryHighlight: null },
  // 15 — Economische aantrekking van Luxemburg (Groothertogdom outline
  // via dissolved LU communes + Léglise & Vaux-sur-Sûre as single-
  // commune highlights). countryHighlight no longer needed — our own
  // dissolved outline replaces the protomaps boundaries layer.
  { yearA: 2001, yearB: 2024, center: [5.85, 49.83], zoom: 8.5, highlight: LUX_PENDEL, dim: ["BE_", "LU_"], countryHighlight: null },
  // 16 — De Westhoek stagneert (Westhoek-regio dissolved, same as step 8).
  { yearA: 2001, yearB: 2024, center: [2.85, 50.9], zoom: 9.5, highlight: ["WST"], dim: ["BE_"], countryHighlight: null },
  // 17 — De bevolking groeit bijna overal (focus BE).
  { yearA: 2001, yearB: 2024, center: [4.6, 50.7], zoom: 7.2, highlight: [], dim: ["BE_"], countryHighlight: null },
  // 18 — Contrast met Frankrijk en Duitsland (zoom uit, ontdim FR/BE/DE).
  { yearA: 2001, yearB: 2024, center: [6, 49.5], zoom: 5.8, highlight: [], dim: ["FR_", "BE_", "DE_"], countryHighlight: null },
  // 19 — Chapter: 2 grote Europese trends (period switches back to 1961-2024).
  { yearA: 1961, yearB: 2024, center: [10, 52], zoom: 4.5, highlight: [], dim: null, countryHighlight: null, chapter: true },
  // 20 — Aantrekkingspolen: heel Europa, no dim (groene eilanden in het rood).
  { yearA: 1961, yearB: 2024, center: [10, 50], zoom: 4.3, highlight: [], dim: null, countryHighlight: null },
  // 21 — Heel Europa / Iberisch Schiereiland: focus Spain + Portugal.
  { yearA: 1961, yearB: 2024, center: [-3.8, 40.5], zoom: 5.3, highlight: [], dim: ["ES_", "PT_", "FR_"], countryHighlight: null },
  // 22 — Frankrijk + diagonale du vide.
  { yearA: 1961, yearB: 2024, center: [2.5, 46.5], zoom: 5.2, highlight: [], dim: ["ES_", "PT_", "FR_"], countryHighlight: null, showDiagonal: true },
  // 23 — Emigratie uit Oost-Europa: focus RO + BG + Baltische staten.
  { yearA: 1961, yearB: 2024, center: [25, 43], zoom: 5.0, highlight: [], dim: ["RO_", "BG_"], countryHighlight: null },
  // 24 — Noordwest-Europa / Benelux + Denemarken + West-Duitsland.
  { yearA: 1961, yearB: 2024, center: [3, 52], zoom: 4.8, highlight: [], dim: ["BE_", "NL_", "LU_", "DK_", "DE_", "UK", "IE_"], countryHighlight: null },
  // 25 — Duitsland (oost/west demografische scheidslijn).
  { yearA: 1961, yearB: 2024, center: [10.5, 51], zoom: 5.4, highlight: [], dim: ["DE_"], countryHighlight: null },
];

// Self-hosted Protomaps basemap. The PMTiles file lives at
// /protomaps-basemap/global-basemap.pmtiles on the SFTP-served host.
// Absolute server-relative URL (three slashes after pmtiles:) so the
// same string resolves correctly from /, /scrolly/ and /map/.
const PROTOMAPS_FLAVOR = "white";
const BASEMAP_URL = "pmtiles:///protomaps-basemap/global-basemap.pmtiles";

function buildProtomapsStyle() {
  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${PROTOMAPS_FLAVOR}`,
    sources: {
      protomaps: {
        type: "vector",
        url: BASEMAP_URL,
      },
    },
    layers: protomaps_themes_base.default("protomaps", PROTOMAPS_FLAVOR, "nl"),
  };
}

function getPopExpr(year) {
  if (year === 2024) return ["coalesce", ["get", "pop_2024"], ["get", "pop_2021"]];
  return ["get", "pop_" + year];
}

function formatCompactPopulation(value) {
  const abs = Math.abs(value);
  if (abs >= 1000000) return (value / 1000000).toFixed(1).replace(".", ",") + " mln";
  if (abs >= 1000) return Math.round(value / 1000) + "k";
  return value.toLocaleString("nl-BE");
}

function buildFillExpr(yearA, yearB) {
  const popA = getPopExpr(yearA);
  const popB = getPopExpr(yearB);
  const pctExpr = ["*", 100, ["/", ["-", popB, popA], popA]];
  return [
    "case",
    ["any", ["==", popA, null], ["==", popB, null], ["==", popA, 0]], NO_DATA_COLOR,
    [
      "step", pctExpr,
      COLORS[0],
      PCT_BINS[0], COLORS[1],
      PCT_BINS[1], COLORS[2],
      PCT_BINS[2], COLORS[3],
      PCT_BINS[3], COLORS[4],
      PCT_BINS[4], COLORS[5],
      PCT_BINS[5], COLORS[6],
      PCT_BINS[6], COLORS[7],
      PCT_BINS[7], COLORS[8],
      PCT_BINS[8], COLORS[9],
    ],
  ];
}

export async function initScrollyInline(options = {}) {
  const mapEl = options.mapElement;
  const chartPanel = options.chartPanelElement;
  const legendEl = options.legendElement;
  if (!mapEl || !chartPanel) {
    throw new Error("Missing required inline scrolly elements.");
  }

  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  // Explicit PMTiles instance for the LAU choropleth. Sharing the same
  // instance with the protocol means the pre-fetch and MapLibre's
  // later tile requests share header + directory caches in-memory,
  // not just at the HTTP layer.
  const lauPmtilesURL = "data/lau-scrolly.pmtiles";
  const lauStore = new pmtiles.PMTiles(lauPmtilesURL);
  protocol.add(lauStore);

  let currentYearA = STEPS[0].yearA;
  let currentYearB = STEPS[0].yearB;

  const map = new maplibregl.Map({
    container: mapEl,
    style: buildProtomapsStyle(),
    center: STEPS[0].center,
    zoom: STEPS[0].zoom,
    minZoom: 2,
    maxZoom: 12,
    interactive: false,
    attributionControl: false,
  });

  function getLauProperties(giscoId) {
    const features = map.querySourceFeatures("lau", {
      sourceLayer: "lau",
      filter: ["==", ["get", "gisco_id"], giscoId],
    });
    return features[0]?.properties || null;
  }

  function hidePopup() {
    chartPanel.style.display = "none";
    chartPanel.classList.remove("multi");
  }

  const inlineChartTimers = new Map();

  function cancelInlineChartRender(targetEl) {
    const timer = inlineChartTimers.get(targetEl);
    if (timer) {
      window.clearTimeout(timer);
      inlineChartTimers.delete(targetEl);
    }
  }

  function getInlineChartCities(giscoIds, startYear, endYear) {
    const yearsInRange = ALL_YEARS.filter((y) => y >= startYear && y <= endYear);
    return giscoIds.map((id) => {
      // Aggregate: sum pop_* across the listed sub-LAUs. Returns null
      // until ALL sub-features are in the loaded tiles, so the retry
      // loop in scheduleInlineCharts keeps waiting until the
      // aggregation is complete (otherwise we'd render a partial sum
      // and freeze it).
      if (AGGREGATES[id]) {
        const agg = AGGREGATES[id];
        const subProps = [];
        for (const subId of agg.ids) {
          const p = getLauProperties(subId);
          if (!p) return null;  // sub-feature missing — retry later
          subProps.push(p);
        }
        const series = yearsInRange.map((y) => {
          let sum = 0;
          let anyNonNull = false;
          for (const p of subProps) {
            const v = p["pop_" + y];
            if (v != null) { sum += v; anyNonNull = true; }
          }
          return anyNonNull ? { year: y, pop: sum } : null;
        }).filter((d) => d && d.pop !== 0);
        return series.length ? { name: agg.name, series } : null;
      }
      const p = getLauProperties(id);
      if (!p) return null;
      const name = (p.name || id).split(" / ")[0];
      const series = yearsInRange
        .map((y) => ({ year: y, pop: p["pop_" + y] }))
        .filter((d) => d.pop != null && d.pop !== 0);
      return series.length ? { name, series } : null;
    }).filter(Boolean);
  }

  function drawInlineCharts(cities, targetEl, opts) {
    const { startYear, endYear, showKnik } = opts;
    const root = d3.select(targetEl);
    root.selectAll("*").remove();
    const rowEl = root.append("div").attr("class", "step-charts__row");

    // X-axis ticks: start, end, and 2001 (only if it's a midpoint).
    const xTicks = [startYear];
    if (startYear < 2001 && endYear > 2001) xTicks.push(2001);
    xTicks.push(endYear);

    for (const { name, series } of cities) {
      const cell = rowEl.append("div").attr("class", "step-charts__cell");
      cell.append("div").attr("class", "step-charts__name").text(name);
      const W = 450, H = 194;
      const m = { top: 28, right: 90, bottom: 30, left: 90 };
      const iw = W - m.left - m.right;
      const ih = H - m.top - m.bottom;
      const svg = cell.append("svg")
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("width", "100%")
        .style("display", "block");
      const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
      const x = d3.scaleLinear().domain([startYear, endYear]).range([0, iw]);
      // Always start the y-axis at 0 so the slope reflects the actual
      // proportional change, not an auto-zoomed exaggeration. Headroom
      // on top (15%) so the highest point doesn't kiss the chart edge.
      const maxPop = d3.max(series, (d) => d.pop);
      const y = d3.scaleLinear()
        .domain([0, maxPop * 1.15])
        .range([ih, 0]);
      g.append("g")
        .attr("class", "chart-x-axis")
        .attr("transform", `translate(0,${ih})`)
        .call(d3.axisBottom(x).tickValues(xTicks).tickFormat(d3.format("d")).tickSizeOuter(0).tickSize(4));
      if (showKnik) {
        g.append("line")
          .attr("x1", x(2001)).attr("x2", x(2001))
          .attr("y1", 0).attr("y2", ih)
          .attr("stroke", "rgba(3, 16, 55, 0.25)")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "2,2");
      }
      const line = d3.line().x((d) => x(d.year)).y((d) => y(d.pop)).curve(d3.curveMonotoneX);
      g.append("path")
        .datum(series)
        .attr("fill", "none")
        .attr("stroke", "var(--basevio, #5541F0)")
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("d", line);

      const first = series[0];
      const last = series[series.length - 1];
      const markers = [
        { point: first, anchor: "end", dx: -7, dy: 4, className: "chart-value-label" },
        { point: last, anchor: "start", dx: 7, dy: 4, className: "chart-value-label" },        
      ];
      if (showKnik) {
        const knik = series.find((d) => d.year === 2001);
        if (knik) markers.push({ point: knik, anchor: "middle", dx: 0, dy: 25, className: "chart-value-label chart-value-label--turn", isKnik: true });
      }
      markers.push();

      for (const { point, anchor, dx, dy, className, isKnik } of markers.filter((m) => m.point)) {
        g.append("text")
          .attr("class", className)
          .attr("text-anchor", anchor)
          .attr("x", x(point.year) + dx)
          .attr("y", y(point.pop) + dy)
          .text(formatCompactPopulation(point.pop));
      }
    }
    targetEl.dataset.chartsRendered = "true";
  }

  function readChartConfig(targetEl) {
    const ids = (targetEl.dataset.ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const startYear = targetEl.dataset.start ? +targetEl.dataset.start : 1961;
    const endYear = targetEl.dataset.end ? +targetEl.dataset.end : 2024;
    const showKnik = targetEl.dataset.knik === "true";
    return { ids, startYear, endYear, showKnik };
  }

  function scheduleInlineCharts(targetEl, attempt = 0) {
    if (!targetEl) return;
    if (targetEl.dataset.chartsRendered === "true") return;
    const cfg = readChartConfig(targetEl);
    if (!cfg.ids.length) return;
    cancelInlineChartRender(targetEl);
    const timer = window.setTimeout(() => {
      inlineChartTimers.delete(targetEl);
      const cities = getInlineChartCities(cfg.ids, cfg.startYear, cfg.endYear);
      if (cities.length < cfg.ids.length && attempt < 20) {
        scheduleInlineCharts(targetEl, attempt + 1);
        return;
      }
      if (cities.length) drawInlineCharts(cities, targetEl, cfg);
    }, attempt === 0 ? 100 : 200);
    inlineChartTimers.set(targetEl, timer);
  }

  // Discover every .step-charts placeholder in the DOM and render a
  // chart into each based on its data-* attributes. Driven by HTML
  // (not STEPS config) so the same step can hold multiple charts at
  // different positions within its card.
  function renderAllInlineCharts() {
    document.querySelectorAll(".step-charts").forEach((el) => {
      scheduleInlineCharts(el);
    });
  }

  function drawLegend() {
    if (!legendEl) return;
    const el = d3.select(legendEl);
    el.selectAll("*").remove();
    const W = 300; const H = 24;
    const bandW = W / COLORS.length;
    const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet").style("display", "block");
    COLORS.forEach((c, i) => svg.append("rect").attr("x", i * bandW).attr("y", 0).attr("width", bandW).attr("height", 6).attr("fill", c));
    for (let i = 0; i < PCT_BINS.length; i++) {
      const v = PCT_BINS[i];
      svg.append("text").attr("class", "legend-number").attr("text-anchor", "middle").attr("x", (i + 1) * bandW).attr("y", 17).text((v > 0 ? "+" : "") + v + "%");
    }
  }

  // Markers reused across steps — created lazily, hidden by setting
  // their DOM element's display to "none" when not in the current
  // highlight set.
  const labelMarkers = new Map();  // unitKey → maplibregl.Marker

  function ensureLabelMarker(unitKey) {
    if (labelMarkers.has(unitKey)) return labelMarkers.get(unitKey);
    const unit = HIGHLIGHT_UNITS[unitKey];
    if (!unit) return null;
    const el = document.createElement("div");
    el.className = "lau-highlight-label";
    el.textContent = unit.name;
    const marker = new maplibregl.Marker({ element: el, anchor: "top" })
      .setLngLat(unit.center)
      .addTo(map);
    labelMarkers.set(unitKey, marker);
    return marker;
  }

  function setHighlight(unitKeys) {
    const keys = unitKeys || [];

    // Split each requested unit into how its outline is drawn:
    //   single-commune  → push gisco_id into the lau-highlight filter
    //   dissolved       → toggle the corresponding feature on the
    //                     pre-baked GeoJSON layer
    //   labelOnly       → no outline at this layer (e.g. country
    //                     outline comes from countryHighlight)
    const singleCommuneIds = [];
    const dissolvedKeys = [];
    for (const k of keys) {
      const unit = HIGHLIGHT_UNITS[k];
      if (!unit) continue;
      if (unit.labelOnly) continue;
      if (unit.dissolved) dissolvedKeys.push(k);
      else if (unit.ids) singleCommuneIds.push(...unit.ids);
    }
    map.setFilter("lau-highlight", ["in", ["get", "gisco_id"], ["literal", singleCommuneIds]]);

    if (map.getLayer("highlight-region-line")) {
      map.setFilter("highlight-region-line",
        ["in", ["get", "key"], ["literal", dissolvedKeys]]);
      map.setLayoutProperty("highlight-region-line", "visibility",
        dissolvedKeys.length ? "visible" : "none");
    }

    // Toggle marker visibility for every known unit (lazy-create on
    // first use, then keep around and just flip display). Units flagged
    // with `noLabel: true` get an outline but never a pill marker.
    const active = new Set(keys);
    for (const k of Object.keys(HIGHLIGHT_UNITS)) {
      const unit = HIGHLIGHT_UNITS[k];
      const wantShown = active.has(k) && !unit.noLabel;
      const marker = wantShown ? ensureLabelMarker(k) : labelMarkers.get(k);
      if (marker) marker.getElement().style.display = wantShown ? "" : "none";
    }
  }

  // `prefixes` is an array of LAU code prefixes to KEEP visible (e.g.
  // ["BE_"] or ["FR_","ES_","PT_"]). null / empty array = no dim.
  function setDimMode(prefixes) {
    if (!prefixes || !prefixes.length) {
      map.setLayoutProperty("lau-dim", "visibility", "none");
      return;
    }
    // Dim every LAU whose code does NOT start with any kept prefix.
    // Filter expression: ["all", ["!=", slice, p1], ["!=", slice, p2], …]
    const clauses = ["all"];
    for (const p of prefixes) {
      clauses.push(["!=", ["slice", ["get", "gisco_id"], 0, p.length], p]);
    }
    map.setFilter("lau-dim", clauses);
    map.setLayoutProperty("lau-dim", "visibility", "visible");
  }

  // Diagonale du vide — two dashed VRT-purple lines bounding the band of
  // depopulating French communes. Drawn only on step 3.
  function setDiagonalVisible(visible) {
    if (!map.getLayer("diagonale")) return;
    map.setLayoutProperty("diagonale", "visibility", visible ? "visible" : "none");
  }

  function setCountryHighlight(brkA3) {
    if (!brkA3) {
      map.setLayoutProperty("country-highlight", "visibility", "none");
      return;
    }
    map.setFilter("country-highlight", ["all", ["<=", ["get", "kind_detail"], 2], ["==", ["get", "brk_a3"], brkA3]]);
    map.setLayoutProperty("country-highlight", "visibility", "visible");
  }

  function applyStep(index) {
    const step = STEPS[index];
    if (!step) return;
    const periodChanged = step.yearA !== currentYearA || step.yearB !== currentYearB;
    if (periodChanged) {
      currentYearA = step.yearA;
      currentYearB = step.yearB;
      map.setPaintProperty("lau-fill", "fill-color", buildFillExpr(currentYearA, currentYearB));
    }
    const isMobile = window.innerWidth <= 720;
    const zoom = isMobile ? Math.max(3.8, step.zoom - 1.3) : step.zoom;
    if (step.transition === "jump") map.jumpTo({ center: step.center, zoom });
    else map.flyTo({ center: step.center, zoom, essential: true, speed: 0.5, curve: 1.42 });
    setHighlight(step.highlight || []);
    setDimMode(step.dim);
    setCountryHighlight(step.countryHighlight || null);
    setDiagonalVisible(!!step.showDiagonal);

    hidePopup();
    // Re-trigger render for any charts inside this step's box that haven't
    // rendered yet (their target tiles may now be loaded after the flyTo).
    document.querySelectorAll(
      `.scrolly__box[data-step="${index}"] .step-charts`
    ).forEach((el) => scheduleInlineCharts(el));
  }

  await new Promise((resolve) => {
    map.on("load", () => {
      const borderLayerId = (() => {
        const layers = map.getStyle().layers;
        const lines = layers.filter((l) => l.type === "line");
        return lines.find((l) => /country|admin[-_]?0|boundary[-_]?2/i.test(l.id))?.id ?? lines.find((l) => l.id.toLowerCase().includes("boundary"))?.id ?? null;
      })();
      if (borderLayerId) {
        map.setPaintProperty(borderLayerId, "line-color", "#031037");
        map.setPaintProperty(borderLayerId, "line-width", 1.2);
        map.setPaintProperty(borderLayerId, "line-dasharray", [1]);
      }
      if (map.getLayer("water")) map.setPaintProperty("water", "fill-color", "#E6F5FF");
      if (map.getLayer("places_country")) map.setPaintProperty("places_country", "text-color", "#3F4865");
      map.addSource("lau", { type: "vector", url: "pmtiles://data/lau-scrolly.pmtiles" });
      const beforeId = borderLayerId ?? undefined;
      [
        "places_locality", "places_subplace", "places_region", 
        "places_village", "places_town", "places_state", 
        "places_city", "places_neighbourhood"
      ].forEach((id) => {
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
      });
      map.addLayer({ id: "lau-fill", type: "fill", source: "lau", "source-layer": "lau", paint: { "fill-color": buildFillExpr(currentYearA, currentYearB), "fill-opacity": 0.85, "fill-outline-color": "rgba(255,255,255,0)" } }, beforeId);
      map.addLayer({ id: "lau-outline", type: "line", source: "lau", "source-layer": "lau", paint: { "line-color": "rgba(255,255,255,0.75)", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0, 6, 0.2, 7, 0.4, 8, 0.6] } }, beforeId);
      map.addLayer({ id: "lau-dim", type: "fill", source: "lau", "source-layer": "lau", filter: ["!=", ["slice", ["get", "gisco_id"], 0, 3], "ZZ_"], paint: { "fill-color": "#ffffff", "fill-opacity": 0.9 }, layout: { visibility: "none" } }, beforeId);
      map.addLayer({ id: "lau-highlight", type: "line", source: "lau", "source-layer": "lau", filter: ["in", ["get", "gisco_id"], ["literal", []]], paint: { "line-color": "#5541F0", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.2, 8, 2, 11, 2.5] } }, beforeId);
      // Pre-baked dissolved outline for the Brussels-Capital Region
      // (19 communes merged into a single outer perimeter). Drawn via
      // its own source so we never see the inner commune borders.
      map.addSource("highlight-regions", { type: "geojson", data: "data/be-highlights.geojson" });
      map.addLayer({ id: "highlight-region-line", type: "line", source: "highlight-regions", filter: ["in", ["get", "key"], ["literal", []]], paint: { "line-color": "#5541F0", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.4, 8, 2.2, 11, 2.8] }, layout: { visibility: "none" } }, beforeId);
      map.addLayer({ id: "country-highlight", type: "line", source: "protomaps", "source-layer": "boundaries", filter: ["all", ["<=", ["get", "kind_detail"], 2], ["==", ["get", "brk_a3"], "ZZZ"]], paint: { "line-color": "#5541F0", "line-width": 3 }, layout: { visibility: "none" } }, beforeId);

      // Diagonale du vide — two dashed VRT-purple lines bounding the
      // band of depopulating French communes (NE-Ardennes → SW-Landes).
      // Coordinates are approximate so we can tune visually.
      map.addSource("diagonale", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            { type: "Feature", properties: {}, geometry: { type: "LineString",
              coordinates: [[4.72, 49.77], [3.20, 47.80], [0.8, 47.50], [-0.50, 43.50]] } },
            { type: "Feature", properties: {}, geometry: { type: "LineString",
              coordinates: [[6.0, 49.20], [4.20, 46.80], [4.40, 44.80], [1.50, 42.90]] } },
          ],
        },
      });
      map.addLayer({
        id: "diagonale",
        type: "line",
        source: "diagonale",
        paint: {
          "line-color": "#5541F0",
          "line-width": 5,
          "line-dasharray": [1.4, 1.4],
          "line-opacity": 0.95,
        },
        layout: { visibility: "none", "line-cap": "round" },
      });
      drawLegend();
      applyStep(0);
      renderAllInlineCharts();
      map.once("idle", renderAllInlineCharts);
      // Pre-fetch the LAU choropleth tiles for every unique scrolly
      // step viewport while the reader is still on the hero / intro.
      // Bytes land in the browser HTTP cache, so later flyTo()'s to
      // Greece / Romania / etc. don't pay the cold-tile network cost.
      window.setTimeout(prefetchStepTiles, 500);
      resolve();
    });
  });

  // ---- Tile pre-fetching --------------------------------------------------
  // Compute the slippy-tile (x, y) for a given (lon, lat) at integer zoom.
  function lonLatToTile(lon, lat, z) {
    const n = 1 << z;
    const x = Math.floor((lon + 180) / 360 * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
      (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
    );
    return { x, y, n };
  }

  async function prefetchStepTiles() {
    // De-dupe step viewports — many BE-centered steps share the same
    // (center, zoom), no need to prefetch them more than once.
    const seen = new Set();
    const targets = [];
    for (const step of STEPS) {
      if (step.chapter) continue;  // chapter dividers don't change the view
      const z = Math.floor(step.zoom);
      const key = `${step.center[0].toFixed(2)},${step.center[1].toFixed(2)},${z}`;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({ center: step.center, z });
    }

    // For each unique viewport, queue a 5×5 tile grid around the
    // center. That covers a typical 1280-px desktop viewport at any
    // of our zoom levels, and tiles outside the rendered viewport
    // load harmlessly as no-ops.
    const tileSet = new Set();
    for (const { center, z } of targets) {
      const { x: cx, y: cy, n } = lonLatToTile(center[0], center[1], z);
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx < 0 || ty < 0 || tx >= n || ty >= n) continue;
          tileSet.add(`${z}/${tx}/${ty}`);
        }
      }
    }

    // Fire-and-forget. The pmtiles library batches Range-fetches and
    // the browser's HTTP cache dedupes anything MapLibre already
    // loaded for the current view. Failures are silent (Promise
    // rejection swallowed) — a missed prefetch isn't worth bothering
    // the reader about.
    for (const tileKey of tileSet) {
      const [z, x, y] = tileKey.split("/").map(Number);
      lauStore.getZxy(z, x, y).catch(() => {});
    }
  }

  return { applyStep };
}
