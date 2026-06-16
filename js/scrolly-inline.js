/* Inline scrolly map controller for article page (no iframe messaging). */
const ALL_YEARS = [1961, 1971, 1981, 1991, 2001, 2011, 2021, 2024];
const PCT_BINS = [-25, -15, -8, -3, 0, 5, 15, 35, 75];
const COLORS = ["#d46780", "#df91a3", "#e8acb3", "#f0c6c3", "#f7e1d4", "#e7e7c3", "#d0d3a2", "#bac082", "#8e9847", "#646c1d"];
const NO_DATA_COLOR = "rgba(0,0,0,0)";

const BIG_CITIES = ["BE_44021", "BE_11002", "BE_21004", "BE_62063", "BE_52011"];
const THREE_BIG = ["BE_11002", "BE_44021", "BE_21004"];
const STEPS = [
  { yearA: 1961, yearB: 2024, center: [5, 51], zoom: 5.5, highlight: [], dim: "off", countryHighlight: null },
  { yearA: 1961, yearB: 2001, center: [4.6, 50.7], zoom: 7.2, highlight: BIG_CITIES, dim: "belgium", countryHighlight: null },
  { yearA: 1961, yearB: 2001, center: [4.4, 50.85], zoom: 9, highlight: [], dim: "belgium", countryHighlight: null },
  { yearA: 1961, yearB: 2001, center: [5.15, 51.2], zoom: 8.4, highlight: [], dim: "belgium", countryHighlight: null },
  { yearA: 1961, yearB: 2001, center: [2.85, 50.9], zoom: 9.5, highlight: [], dim: "belgium", countryHighlight: null },
  { yearA: 2001, yearB: 2024, center: [4.6, 50.7], zoom: 7.2, highlight: BIG_CITIES, dim: "belgium", countryHighlight: null },
  { yearA: 2001, yearB: 2024, center: [4.6, 50.7], zoom: 7.2, highlight: THREE_BIG, dim: "belgium", countryHighlight: null, multiPopup: THREE_BIG },
  { yearA: 2001, yearB: 2024, center: [5.85, 49.83], zoom: 8.5, highlight: [], dim: "belgium", countryHighlight: "LUX" },
  { yearA: 2001, yearB: 2024, center: [4.6, 50.7], zoom: 7.5, highlight: [], dim: "belgium", countryHighlight: null },
  { yearA: 2001, yearB: 2024, center: [6, 49.5], zoom: 5.8, highlight: [], dim: "off", countryHighlight: null },
  { yearA: 2001, yearB: 2024, center: [-3.8, 40.5], zoom: 5.4, highlight: [], dim: "off", countryHighlight: null, transition: "jump" },
  { yearA: 2001, yearB: 2024, center: [25, 56.5], zoom: 5.3, highlight: [], dim: "off", countryHighlight: null, transition: "jump" },
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
  const infoSentenceEl = options.infoSentenceElement;
  const popupChartEl = options.popupChartElement;
  const legendEl = options.legendElement;
  if (!mapEl || !chartPanel || !infoSentenceEl || !popupChartEl || !legendEl) {
    throw new Error("Missing required inline scrolly elements.");
  }

  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);

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

  function showMultiPopup(giscoIds) {
    chartPanel.classList.add("multi");
    const cities = giscoIds.map((id) => {
      const p = getLauProperties(id);
      if (!p) return null;
      const name = (p.name || id).split(" / ")[0];
      const series = ALL_YEARS.map((y) => ({ year: y, pop: p["pop_" + y] })).filter((d) => d.pop != null && d.pop !== 0);
      return series.length ? { name, series } : null;
    }).filter(Boolean);
    const cityNames = cities.map((c) => c.name).join(", ");
    infoSentenceEl.innerHTML = `<strong>${cityNames}</strong>: drie steden, één patroon. De daling tot rond 2000, dan een duidelijke knik omhoog.`;
    d3.select(popupChartEl).selectAll("*").remove();
    const row = d3.select(popupChartEl).append("div").style("display", "flex").style("gap", "10px");
    for (const { name, series } of cities) {
      const cell = row.append("div").style("flex", "1").style("min-width", "0");
      cell.append("div").style("font-size", "11px").style("font-weight", "600").style("margin-bottom", "2px").text(name);
      const W = 160; const H = 110;
      const m = { top: 16, right: 8, bottom: 18, left: 8 };
      const iw = W - m.left - m.right;
      const ih = H - m.top - m.bottom;
      const svg = cell.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").style("display", "block");
      const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
      const x = d3.scaleLinear().domain(d3.extent(series, (d) => d.year)).range([0, iw]);
      const minPop = d3.min(series, (d) => d.pop);
      const maxPop = d3.max(series, (d) => d.pop);
      const span = Math.max(maxPop - minPop, 1);
      const y = d3.scaleLinear().domain([minPop - span * 0.4, maxPop + span * 0.15]).range([ih, 0]);
      g.append("line").attr("x1", x(2001)).attr("x2", x(2001)).attr("y1", 0).attr("y2", ih).attr("stroke", "#bbb").attr("stroke-width", 1).attr("stroke-dasharray", "2,2");
      const line = d3.line().x((d) => x(d.year)).y((d) => y(d.pop)).curve(d3.curveMonotoneX);
      g.append("path").datum(series).attr("fill", "none").attr("stroke", "#222").attr("stroke-width", 1.5).attr("d", line);
    }
    chartPanel.style.display = "block";
  }

  function drawLegend() {
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

  function setDimMode(mode) {
    if (mode === "off") {
      map.setLayoutProperty("lau-dim", "visibility", "none");
      return;
    }
    let filter;
    if (mode === "belgium") filter = ["!=", ["slice", ["get", "gisco_id"], 0, 3], "BE_"];
    else filter = ["all", ["!=", ["slice", ["get", "gisco_id"], 0, 3], "BE_"], ["!=", ["slice", ["get", "gisco_id"], 0, 3], "LU_"]];
    map.setFilter("lau-dim", filter);
    map.setLayoutProperty("lau-dim", "visibility", "visible");
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
    setDimMode(step.dim || "off");
    setCountryHighlight(step.countryHighlight || null);
    if (step.multiPopup) setTimeout(() => showMultiPopup(step.multiPopup), 200);
    else hidePopup();
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
      drawLegend();
      applyStep(0);
      resolve();
    });
  });

  return { applyStep };
}
