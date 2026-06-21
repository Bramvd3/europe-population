/* Inline scrolly map controller for article page (no iframe messaging). */
const ALL_YEARS = [1961, 1971, 1981, 1991, 2001, 2011, 2021, 2024];
const PCT_BINS = [-25, -15, -8, -3, 0, 5, 15, 35, 75];
const COLORS = ["#d46780", "#df91a3", "#e8acb3", "#f0c6c3", "#f7e1d4", "#e7e7c3", "#d0d3a2", "#bac082", "#8e9847", "#646c1d"];
const NO_DATA_COLOR = "rgba(0,0,0,0)";

const BIG_CITIES = ["BE_44021", "BE_11002", "BE_21004", "BE_62063", "BE_52011"];
// Mechelen, Aalst, Ninove, Tienen — used to highlight in step 19.
const FOUR_NEAR_BRUSSELS = ["BE_12025", "BE_41002", "BE_41048", "BE_24107"];
// Aalst, Wetteren, Mechelen, Tienen — small Flemish cities (step 10).
const FOUR_SMALLER = ["BE_41002", "BE_42025", "BE_12025", "BE_24107"];

// `dim` is an array of country-code prefixes to KEEP visible (rest is
// dimmed). null / empty array = no dim. ['BE_'] = only Belgium kept;
// ['FR_','ES_','PT_'] = France + Iberian peninsula stay coloured, rest fades.
// Steps with `chapter: true` are full-screen chapter dividers — the map
// just holds whatever state the previous step left it in (smooth pause).
const STEPS = [
  // 0 — Europa in beweging: Europe overview, intro + legend.
  { yearA: 1961, yearB: 2024, center: [10, 52], zoom: 4.5, highlight: [], dim: null, countryHighlight: null },
  // 1 — Chapter: 2 grote Europese trends.
  { yearA: 1961, yearB: 2024, center: [10, 52], zoom: 4.5, highlight: [], dim: null, countryHighlight: null, chapter: true },
  // 2 — Aantrekkingspolen: heel Europa, no dim (groene eilanden in het rood).
  { yearA: 1961, yearB: 2024, center: [10, 50], zoom: 4.3, highlight: [], dim: null, countryHighlight: null },
  // 3 — Heel Europa / Iberisch Schiereiland: focus Spain + Portugal.
  { yearA: 1961, yearB: 2024, center: [-3.8, 40.5], zoom: 5.3, highlight: [], dim: ["ES_", "PT_", "FR_"], countryHighlight: null },
  // 4 — Frankrijk + diagonale du vide.
  { yearA: 1961, yearB: 2024, center: [2.5, 46.5], zoom: 5.2, highlight: [], dim: ["ES_", "PT_", "FR_"], countryHighlight: null, showDiagonal: true },
  // 5 — Emigratie uit Oost-Europa: focus RO + BG + Baltische staten.
  { yearA: 1961, yearB: 2024, center: [25, 43], zoom: 5.0, highlight: [], dim: ["RO_", "BG_"], countryHighlight: null },
  // 6 — Noordwest-Europa / Benelux + Denemarken + West-Duitsland.
  { yearA: 1961, yearB: 2024, center: [3, 52], zoom: 4.8, highlight: [], dim: ["BE_", "NL_", "LU_", "DK_", "DE_", "UK", "IE_"], countryHighlight: null },
  // 7 — Duitsland (oost/west demografische scheidslijn).
  { yearA: 1961, yearB: 2024, center: [10.5, 51], zoom: 5.4, highlight: [], dim: ["DE_"], countryHighlight: null },
  // 8 — Chapter: Terug naar België (period switches to 1961-2001).
  { yearA: 1961, yearB: 2001, center: [4.6, 50.7], zoom: 6.5, highlight: [], dim: null, countryHighlight: null, chapter: true },
  // 9 — De stadsvlucht (5 grote BE steden highlighted).
  { yearA: 1961, yearB: 2001, center: [4.6, 50.7], zoom: 7.2, highlight: BIG_CITIES, dim: ["BE_"], countryHighlight: null },
  // 10 — Aalst / Wetteren / Mechelen / Tienen.
  { yearA: 1961, yearB: 2001, center: [4.4, 50.95], zoom: 8.5, highlight: FOUR_SMALLER, dim: ["BE_"], countryHighlight: null },
  // 11 — Brusselaars trekken naar de rand (focus Brussel + chart BRU+LLN).
  { yearA: 1961, yearB: 2001, center: [4.4, 50.85], zoom: 9.0, highlight: [], dim: ["BE_"], countryHighlight: null },
  // 12 — Hetzelfde verhaal in Antwerpen.
  { yearA: 1961, yearB: 2001, center: [4.7, 51.2], zoom: 9.5, highlight: [], dim: ["BE_"], countryHighlight: null },
  // 13 — Limburg is een geval apart (focus Limburg + chart Houthalen-Helchteren).
  { yearA: 1961, yearB: 2001, center: [5.4, 50.95], zoom: 9.0, highlight: [], dim: ["BE_"], countryHighlight: null },
  // 14 — De krimpende Westhoek (1961-2001).
  { yearA: 1961, yearB: 2001, center: [3.05, 50.9], zoom: 9.2, highlight: [], dim: ["BE_"], countryHighlight: null },
  // 15 — Chapter: De 21e eeuw (period switches to 2001-2024).
  { yearA: 2001, yearB: 2024, center: [4.6, 50.7], zoom: 6.5, highlight: [], dim: null, countryHighlight: null, chapter: true },
  // 16 — De steden groeien terug (BE focus + 5 cities).
  { yearA: 2001, yearB: 2024, center: [4.6, 50.7], zoom: 7.2, highlight: BIG_CITIES, dim: ["BE_"], countryHighlight: null },
  // 17 — De knik in de grafiek (5 cities + 3 in-card charts).
  { yearA: 2001, yearB: 2024, center: [4.6, 50.7], zoom: 7.2, highlight: BIG_CITIES, dim: ["BE_"], countryHighlight: null },
  // 18 — Druk op de woningmarkt (focus Brussel).
  { yearA: 2001, yearB: 2024, center: [4.4, 50.85], zoom: 9.0, highlight: BIG_CITIES, dim: ["BE_"], countryHighlight: null },
  // 19 — Steden rond Brussel (Mechelen/Aalst/Ninove/Tienen highlighted).
  { yearA: 2001, yearB: 2024, center: [4.4, 50.85], zoom: 9.0, highlight: FOUR_NEAR_BRUSSELS, dim: ["BE_"], countryHighlight: null },
  // 20 — De allersnelste groeiers (Luxemburgse grens).
  { yearA: 2001, yearB: 2024, center: [5.85, 49.83], zoom: 8.5, highlight: [], dim: ["BE_", "LU_"], countryHighlight: "LUX" },
  // 21 — De Westhoek volgt het Europees patroon.
  { yearA: 2001, yearB: 2024, center: [2.85, 50.9], zoom: 9.5, highlight: [], dim: ["BE_"], countryHighlight: null },
  // 22 — De bevolking groeit bijna overal (focus BE).
  { yearA: 2001, yearB: 2024, center: [4.6, 50.7], zoom: 7.2, highlight: [], dim: ["BE_"], countryHighlight: null },
  // 23 — Contrast met Frankrijk en Duitsland (zoom uit, ontdim FR/BE/DE).
  { yearA: 2001, yearB: 2024, center: [6, 49.5], zoom: 5.8, highlight: [], dim: ["FR_", "BE_", "DE_"], countryHighlight: null },
];

const PROTOMAPS_KEY = "d3b78e1318dd7bcb";
const PROTOMAPS_FLAVOR = "white";

function buildProtomapsStyle() {
  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${PROTOMAPS_FLAVOR}`,
    sources: {
      protomaps: {
        type: "vector",
        url: `https://api.protomaps.com/tiles/v4.json?key=${PROTOMAPS_KEY}`,
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
    return giscoIds.map((id) => {
      const p = getLauProperties(id);
      if (!p) return null;
      const name = (p.name || id).split(" / ")[0];
      const series = ALL_YEARS
        .filter((y) => y >= startYear && y <= endYear)
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
      const W = 380, H = 164;
      const m = { top: 28, right: 34, bottom: 30, left: 34 };
      const iw = W - m.left - m.right;
      const ih = H - m.top - m.bottom;
      const svg = cell.append("svg")
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("width", "100%")
        .style("display", "block");
      const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
      const x = d3.scaleLinear().domain([startYear, endYear]).range([0, iw]);
      const minPop = d3.min(series, (d) => d.pop);
      const maxPop = d3.max(series, (d) => d.pop);
      const span = Math.max(maxPop - minPop, 1);
      const y = d3.scaleLinear()
        .domain([minPop - span * 0.4, maxPop + span * 0.15])
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
        .attr("stroke", "var(--darkvio, #031037)")
        .attr("stroke-width", 1.8)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("d", line);

      const markers = [
        { point: series[0], anchor: "start", dx: 5, dy: 4, className: "chart-value-label" },
      ];
      if (showKnik) {
        const knik = series.find((d) => d.year === 2001);
        if (knik) markers.push({ point: knik, anchor: "middle", dx: 0, dy: -7, className: "chart-value-label chart-value-label--turn", isKnik: true });
      }
      markers.push({ point: series[series.length - 1], anchor: "end", dx: -5, dy: 4, className: "chart-value-label" });

      for (const { point, anchor, dx, dy, className, isKnik } of markers.filter((m) => m.point)) {
        g.append("circle")
          .attr("cx", x(point.year))
          .attr("cy", y(point.pop))
          .attr("r", isKnik ? 4.6 : 3.6)
          .attr("fill", isKnik ? "#d46780" : "#5541F0")
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.4);
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

  function setHighlight(giscoIds) {
    map.setFilter("lau-highlight", ["in", ["get", "gisco_id"], ["literal", giscoIds || []]]);
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
        map.setPaintProperty(borderLayerId, "line-color", "#333");
        map.setPaintProperty(borderLayerId, "line-width", 1.2);
        map.setPaintProperty(borderLayerId, "line-dasharray", [1]);
      }
      if (map.getLayer("water")) map.setPaintProperty("water", "fill-color", "#dbe9f4");
      if (map.getLayer("places_country")) map.setPaintProperty("places_country", "text-color", "#5c5c5c");
      map.addSource("lau", { type: "vector", url: "pmtiles://data/lau-scrolly.pmtiles" });
      const beforeId = borderLayerId ?? undefined;
      map.addLayer({ id: "lau-fill", type: "fill", source: "lau", "source-layer": "lau", paint: { "fill-color": buildFillExpr(currentYearA, currentYearB), "fill-opacity": 0.85, "fill-outline-color": "rgba(255,255,255,0)" } }, beforeId);
      map.addLayer({ id: "lau-outline", type: "line", source: "lau", "source-layer": "lau", paint: { "line-color": "rgba(255,255,255,0.75)", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0, 6, 0.2, 7, 0.4, 8, 0.6] } }, beforeId);
      map.addLayer({ id: "lau-dim", type: "fill", source: "lau", "source-layer": "lau", filter: ["!=", ["slice", ["get", "gisco_id"], 0, 3], "ZZ_"], paint: { "fill-color": "#ffffff", "fill-opacity": 0.78 }, layout: { visibility: "none" } }, beforeId);
      map.addLayer({ id: "lau-highlight", type: "line", source: "lau", "source-layer": "lau", filter: ["in", ["get", "gisco_id"], ["literal", []]], paint: { "line-color": "#1c1c1c", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.2, 8, 2, 11, 2.5] } }, beforeId);
      map.addLayer({ id: "country-highlight", type: "line", source: "protomaps", "source-layer": "boundaries", filter: ["all", ["<=", ["get", "kind_detail"], 2], ["==", ["get", "brk_a3"], "ZZZ"]], paint: { "line-color": "#1c1c1c", "line-width": 3 }, layout: { visibility: "none" } }, beforeId);

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
