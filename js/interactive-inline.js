/* Inline interactive map controller for article page (no iframe). */
const ALL_YEARS = [1961, 1971, 1981, 1991, 2001, 2011, 2021, 2024];
const PCT_BINS = [-25, -15, -8, -3, 0, 5, 15, 35, 75];
const ABS_BINS = [-20000, -10000, -5000, -1000, 0, 1000, 5000, 10000, 20000];
const COLORS = ["#d46780", "#df91a3", "#e8acb3", "#f0c6c3", "#f7e1d4", "#e7e7c3", "#d0d3a2", "#bac082", "#8e9847", "#646c1d"];
const NO_DATA_COLOR = "rgba(0,0,0,0)";
const PROTOMAPS_KEY = "d3b78e1318dd7bcb";
const PROTOMAPS_FLAVOR = "white";

function formatAbsLabel(v) {
  const sign = v > 0 ? "+" : (v < 0 ? "−" : "");
  const abs = Math.abs(v);
  if (abs >= 1000) return sign + (abs / 1000) + "k";
  return sign + abs;
}

function formatPopulation(value) {
  return value.toLocaleString("nl-BE");
}

function getPopExpr(year) {
  if (year === 2024) return ["coalesce", ["get", "pop_2024"], ["get", "pop_2021"]];
  return ["get", "pop_" + year];
}

function buildFillExpr(yA, yB, modeStr) {
  const bins = modeStr === "pct" ? PCT_BINS : ABS_BINS;
  const popA = getPopExpr(yA);
  const popB = getPopExpr(yB);
  const valExpr = modeStr === "pct" ? ["*", 100, ["/", ["-", popB, popA], popA]] : ["-", popB, popA];
  return [
    "case",
    ["any", ["==", popA, null], ["==", popB, null], ["==", popA, 0]], NO_DATA_COLOR,
    ["step", valExpr, COLORS[0], bins[0], COLORS[1], bins[1], COLORS[2], bins[2], COLORS[3], bins[3], COLORS[4], bins[4], COLORS[5], bins[5], COLORS[6], bins[6], COLORS[7], bins[7], COLORS[8], bins[8], COLORS[9]],
  ];
}

function buildProtomapsStyle() {
  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${PROTOMAPS_FLAVOR}`,
    sources: { protomaps: { type: "vector", url: `https://api.protomaps.com/tiles/v4.json?key=${PROTOMAPS_KEY}` } },
    layers: protomaps_themes_base.default("protomaps", PROTOMAPS_FLAVOR, "nl"),
  };
}

export async function initInteractiveInline(options = {}) {
  const root = options.rootElement;
  if (!root) throw new Error("Interactive root element is required.");
  const mapEl = root.querySelector("[data-role='map']");
  const yearSliderEl = root.querySelector("[data-role='year-slider']");
  const periodTitleEl = root.querySelector("[data-role='period-title']");
  const chartPanelEl = root.querySelector("[data-role='chart-panel']");
  const infoSentenceEl = root.querySelector("[data-role='info-sentence']");
  const popupChartEl = root.querySelector("[data-role='popup-chart']");
  const closeButtonEl = root.querySelector("[data-role='close-button']");
  const legendEl = root.querySelector("[data-role='legend']");
  if (!mapEl || !yearSliderEl || !periodTitleEl || !chartPanelEl || !infoSentenceEl || !popupChartEl || !closeButtonEl || !legendEl) {
    throw new Error("Interactive inline markup is incomplete.");
  }

  let yearA = 1961;
  let yearB = 2024;
  let mode = "pct";
  let map;
  let hoveredId = null;
  let pinnedId = null;

  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);

  map = new maplibregl.Map({
    container: mapEl,
    style: buildProtomapsStyle(),
    center: [12, 53],
    zoom: 3.4,
    minZoom: 2,
    maxZoom: 12,
    attributionControl: false,
  });

  function findCountryBorderLayer() {
    const layers = map.getStyle().layers;
    const lineLayers = layers.filter((l) => l.type === "line");
    return lineLayers.find((l) => /country|admin[-_]?0|boundary[-_]?2/i.test(l.id))?.id ?? lineLayers.find((l) => l.id.toLowerCase().includes("boundary"))?.id ?? null;
  }

  function effectiveYear(props, requested, direction) {
    const k = "pop_" + requested;
    if (props[k] != null) return [requested, props[k]];
    const range = direction < 0 ? ALL_YEARS.filter((y) => y < requested).reverse() : ALL_YEARS.filter((y) => y > requested);
    for (const y of range) if (props["pop_" + y] != null) return [y, props["pop_" + y]];
    return [requested, null];
  }

  function setPopupShown(shown) {
    chartPanelEl.style.display = shown ? "block" : "none";
    root.classList.toggle("popup-open", shown);
  }

  function renderTrendChart(series) {
    const W = 460; const H = 190;
    const margin = { top: 34, right: 92, bottom: 32, left: 92 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;
    const container = d3.select(popupChartEl);
    container.selectAll("*").remove();
    if (series.length < 2) return;
    const svg = container.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear().domain([series[0].year, series[series.length - 1].year]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, d3.max(series, (d) => d.pop)]).nice().range([innerH, 0]);
    g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(6));
    const line = d3.line().x((d) => x(d.year)).y((d) => y(d.pop));
    g.append("path").datum(series).attr("fill", "none").attr("stroke", "#031037").attr("stroke-width", 2).attr("stroke-linecap", "round").attr("stroke-linejoin", "round").attr("d", line);

    const first = series[0];
    const last = series[series.length - 1];
    const markers = [
      { point: first, anchor: "end", dx: -7, dy: 4, className: "chart-value-label" },
      { point: last, anchor: "start", dx: 7, dy: 4, className: "chart-value-label" },
    ].filter((marker) => marker.point);
    const seenYears = new Set();
    for (const { point, anchor, dx, dy, className } of markers) {
      if (seenYears.has(point.year)) continue;
      seenYears.add(point.year);
      g.append("circle")
        .attr("r", 4.2)
        .attr("cx", x(point.year))
        .attr("cy", y(point.pop))
        .attr("fill", "#5541F0")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5);
      g.append("text")
        .attr("class", className)
        .attr("text-anchor", anchor)
        .attr("x", x(point.year) + dx)
        .attr("y", Math.max(16, Math.min(innerH - 10, y(point.pop) + dy)))
        .text(formatPopulation(point.pop));
    }
  }

  function showPopup(featureOrGiscoId) {
    let props;
    if (typeof featureOrGiscoId === "string") {
      const matches = map.querySourceFeatures("lau", { sourceLayer: "lau", filter: ["==", ["get", "gisco_id"], featureOrGiscoId] });
      if (!matches[0]) return;
      props = matches[0].properties;
    } else if (featureOrGiscoId && featureOrGiscoId.properties) props = featureOrGiscoId.properties;
    else return;
    const locationId = props.gisco_id;
    chartPanelEl.dataset.location = locationId;
    const name = props.name || locationId;
    const [eya, pa] = effectiveYear(props, yearA, +1);
    const [eyb, pb] = effectiveYear(props, yearB, -1);
    let sentence;
    if (pa == null || pb == null || eya >= eyb) sentence = `<strong>${name}</strong>: geen vergelijkbare data voor deze periode.`;
    else {
      const delta = mode === "pct" ? ((pb - pa) / pa) * 100 : pb - pa;
      if (mode === "pct") {
        const verb = delta >= 0 ? "groeide" : "daalde";
        const pct = Math.abs(delta).toFixed(1).replace(".", ",");
        sentence = `In <strong>${name}</strong> ${verb} het aantal inwoners met <strong>${pct}%</strong> tussen ${eya} en ${eyb}.`;
      } else {
        const abs = Math.abs(delta).toLocaleString("nl-BE");
        const verb = delta >= 0 ? "won" : "verloor";
        sentence = `<strong>${name}</strong> ${verb} <strong>${abs}</strong> inwoners tussen ${eya} en ${eyb}.`;
      }
    }
    infoSentenceEl.innerHTML = sentence;
    const series = ALL_YEARS.filter((y) => y >= eya && y <= eyb).map((y) => ({ year: y, pop: props["pop_" + y] })).filter((d) => d.pop != null);
    renderTrendChart(series);
    setPopupShown(true);
  }

  function updateLegend() {
    const bins = mode === "pct" ? PCT_BINS : ABS_BINS;
    const container = d3.select(legendEl);
    container.selectAll("svg").remove();
    const W = 300; const H = 24;
    const bandW = W / COLORS.length;
    const svg = container.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet").style("display", "block");
    COLORS.forEach((c, i) => svg.append("rect").attr("x", i * bandW).attr("y", 0).attr("width", bandW).attr("height", 6).attr("fill", c));
    for (let i = 0; i < bins.length; i++) {
      const x = (i + 1) * bandW;
      const v = bins[i];
      const txt = mode === "pct" ? (v > 0 ? "+" : "") + v + "%" : formatAbsLabel(v);
      svg.append("text").attr("class", "legend-number").attr("text-anchor", "middle").attr("x", x).attr("y", 17).text(txt);
    }
  }

  function updateMap() {
    map.setPaintProperty("lau-fill", "fill-color", buildFillExpr(yearA, yearB, mode));
    updateLegend();
    periodTitleEl.textContent = "Bevolkingsevolutie in Europa";
  }

  function setupYearSlider() {
    noUiSlider.create(yearSliderEl, {
      start: [0, ALL_YEARS.length - 1],
      step: 1,
      connect: true,
      range: { min: 0, max: ALL_YEARS.length - 1 },
      margin: 1,
      tooltips: [{ to: (v) => ALL_YEARS[Math.round(v)], from: (v) => Number.parseInt(v, 10) }, { to: (v) => ALL_YEARS[Math.round(v)], from: (v) => Number.parseInt(v, 10) }],
      pips: { mode: "values", values: ALL_YEARS.map((_, i) => i), density: -1, format: { to: (v) => ALL_YEARS[Math.round(v)] } },
    });
    yearSliderEl.noUiSlider.on("change", (_v, _h, unencoded) => {
      yearA = ALL_YEARS[Math.round(unencoded[0])];
      yearB = ALL_YEARS[Math.round(unencoded[1])];
      updateMap();
      if (chartPanelEl.style.display !== "none" && chartPanelEl.dataset.location) showPopup(chartPanelEl.dataset.location);
    });
  }

  function attachInteractions() {
    map.on("mousemove", "lau-fill", (e) => {
      if (!e.features || e.features.length === 0) return;
      const f = e.features[0];
      const id = f.id;
      if (id === hoveredId) return;
      if (hoveredId != null) map.setFeatureState({ source: "lau", sourceLayer: "lau", id: hoveredId }, { hover: false });
      hoveredId = id;
      map.setFeatureState({ source: "lau", sourceLayer: "lau", id }, { hover: true });
      map.getCanvas().style.cursor = "pointer";
      if (pinnedId == null) showPopup(f);
    });
    map.on("mouseleave", "lau-fill", () => {
      if (hoveredId != null) {
        map.setFeatureState({ source: "lau", sourceLayer: "lau", id: hoveredId }, { hover: false });
        hoveredId = null;
      }
      map.getCanvas().style.cursor = "";
      if (pinnedId == null) setPopupShown(false);
    });
    map.on("click", "lau-fill", (e) => {
      if (!e.features || e.features.length === 0) return;
      pinnedId = e.features[0].id;
      showPopup(e.features[0]);
    });
    setupYearSlider();
    closeButtonEl.addEventListener("click", (e) => {
      e.preventDefault();
      pinnedId = null;
      setPopupShown(false);
    });
  }

  await new Promise((resolve) => {
    map.on("load", () => {
      const borderLayerId = findCountryBorderLayer();
      if (borderLayerId) {
        map.setPaintProperty(borderLayerId, "line-color", "#333");
        map.setPaintProperty(borderLayerId, "line-width", 1.2);
        map.setPaintProperty(borderLayerId, "line-dasharray", [1]);
      }
      if (map.getLayer("water")) map.setPaintProperty("water", "fill-color", "#dbe9f4");
      if (map.getLayer("places_country")) map.setPaintProperty("places_country", "text-color", "#5c5c5c");
      const LABEL_DELAY = 4;
      ["places_locality", "places_subplace", "places_region"].forEach((id) => {
        if (!map.getLayer(id)) return;
        const existing = map.getFilter(id) ?? ["all"];
        const stricter = [">=", ["zoom"], ["+", ["coalesce", ["get", "min_zoom"], 0], LABEL_DELAY]];
        map.setFilter(id, ["all", existing, stricter]);
      });
      map.addSource("lau", { type: "vector", url: "pmtiles://data/lau-scrolly.pmtiles" });
      const beforeId = borderLayerId ?? undefined;
      map.addLayer({ id: "lau-fill", type: "fill", source: "lau", "source-layer": "lau", paint: { "fill-color": buildFillExpr(yearA, yearB, mode), "fill-opacity": 0.85, "fill-outline-color": "rgba(255,255,255,0)" } }, beforeId);
      map.addLayer({ id: "lau-outline", type: "line", source: "lau", "source-layer": "lau", paint: { "line-color": "rgba(255,255,255,0.75)", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0, 6, 0.2, 7, 0.4, 8, 0.6] } }, beforeId);
      map.addLayer({ id: "lau-hover", type: "line", source: "lau", "source-layer": "lau", paint: { "line-color": "#222", "line-width": 2, "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0] } }, beforeId);
      attachInteractions();
      updateLegend();
      periodTitleEl.textContent = "Bevolkingsevolutie in Europa";
      resolve();
    });
  });
}
