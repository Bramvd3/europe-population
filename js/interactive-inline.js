/* Inline interactive map controller for article page (no iframe). */
const ALL_YEARS = [1961, 1971, 1981, 1991, 2001, 2011, 2021, 2024];
const PCT_BINS = [-75, -50, -25, -10, 0, 10, 25, 50, 75];
const ABS_BINS = [-20000, -10000, -5000, -1000, 0, 1000, 5000, 10000, 20000];
const COLORS = ["#E62323", "#FF4944", "#FF7882", "#FFBFC3", "#FFF2F6", "#EEF7EE", "#C3F0C7", "#6DE19B", "#3ECF6E", "#21891F"];
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
  const legendEl = root.querySelector("[data-role='legend']");
  const searchInputEl = root.querySelector("[data-role='search-input']");
  const searchResultsEl = root.querySelector("[data-role='search-results']");
  if (!mapEl || !yearSliderEl || !periodTitleEl || !chartPanelEl || !infoSentenceEl || !popupChartEl || !legendEl) {
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

  // Initial view: two shapes accepted.
  //   { center: [lon, lat], zoom: N }    — fixed pose, used inside the article.
  //   { bounds: [[w,s],[e,n]], padding } — fit to a bbox at the live
  //     container size. Preferred for embeds (AEM does a responsive-
  //     iframe dance where the container starts at 0px tall and grows
  //     later; fitBounds adapts because we re-apply it after a delay).
  const initialView = options.initialView || { center: [12, 53], zoom: 3.4 };
  let ctorCenter, ctorZoom;
  if (initialView.bounds) {
    const [[w, s], [e, n]] = initialView.bounds;
    ctorCenter = [(w + e) / 2, (s + n) / 2];
    ctorZoom = 6;  // rough; fitBounds right after load refines it
  } else {
    ctorCenter = initialView.center;
    ctorZoom = initialView.zoom;
  }
  map = new maplibregl.Map({
    container: mapEl,
    style: buildProtomapsStyle(),
    center: ctorCenter,
    zoom: ctorZoom,
    minZoom: 2,
    maxZoom: 12,
    attributionControl: false,
    // Gebruiker moet Ctrl/Cmd (desktop) of twee vingers (touch)
    // gebruiken om te scrollen. Voorkomt dat de pagina "vastloopt"
    // bij scrollen over de kaart in een artikel-context.
    cooperativeGestures: true,
    pitchWithRotate: false, // Disables tilt while rotating
    dragRotate: false,    // Disables rotating with the mouse
    touchZoomRotate: false, // Disables two-finger rotate/pitch gestures
    locale: {
      "CooperativeGesturesHandler.WindowsHelpText": "Gebruik Ctrl + scrollen om in te zoomen",
      "CooperativeGesturesHandler.MacHelpText": "Gebruik ⌘ + scrollen om in te zoomen",
      "CooperativeGesturesHandler.MobileHelpText": "Gebruik twee vingers om de kaart te verplaatsen",
    },
  });

  // Track user interaction so we don't override a manual pan/zoom
  // when the late-resize re-fit fires (AEM growth case).
  let userMoved = false;
  const markUserMoved = () => { userMoved = true; };
  map.on("dragstart", markUserMoved);
  map.on("zoomstart", (e) => { if (e.originalEvent) markUserMoved(); });
  map.on("rotatestart", markUserMoved);

  function applyInitialView() {
    if (userMoved) return;
    if (initialView.bounds) {
      map.fitBounds(initialView.bounds, {
        padding: initialView.padding != null ? initialView.padding : 20,
        animate: false,
      });
    } else if (initialView.center != null && initialView.zoom != null) {
      map.jumpTo({ center: initialView.center, zoom: initialView.zoom });
    }
  }

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

  // Move the popup to a pixel position on the map (relative to the
  // map container), with a small offset so it doesn't sit ON the
  // cursor. Flips left/up if the popup would clip off the right or
  // bottom edge of the map.
  function positionPopupAt(px, py) {
    if (!chartPanelEl) return;
    const w = chartPanelEl.offsetWidth || 460;
    const h = chartPanelEl.offsetHeight || 200;
    const mapRect = mapEl.getBoundingClientRect();
    const gap = 14;
    let x = px + gap;
    let y = py + gap;
    if (x + w > mapRect.width - 8) x = px - w - gap;
    if (y + h > mapRect.height - 8) y = py - h - gap;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    chartPanelEl.style.left = x + "px";
    chartPanelEl.style.top = y + "px";
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
    g.append("path").datum(series).attr("fill", "none").attr("stroke", "#5541F0").attr("stroke-width", 3).attr("stroke-linecap", "round").attr("stroke-linejoin", "round").attr("d", line);

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
      // Hover-state bookkeeping: only swap the dark outline if the
      // underlying LAU changed.
      if (id !== hoveredId) {
        if (hoveredId != null) map.setFeatureState({ source: "lau", sourceLayer: "lau", id: hoveredId }, { hover: false });
        hoveredId = id;
        map.setFeatureState({ source: "lau", sourceLayer: "lau", id }, { hover: true });
      }
      map.getCanvas().style.cursor = "pointer";
      // Popup follows the cursor while not pinned — and refreshes its
      // chart whenever the underlying LAU changes.
      if (pinnedId == null) {
        positionPopupAt(e.point.x, e.point.y);
        showPopup(f);
      }
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
      positionPopupAt(e.point.x, e.point.y);
      showPopup(e.features[0]);
    });
    setupYearSlider();

    // The whole popup is its own close button — clicking anywhere on
    // it unpins and hides. We stopPropagation so the click doesn't
    // bubble through to the LAU underneath (which would immediately
    // re-pin and re-show).
    chartPanelEl.addEventListener("click", (e) => {
      e.stopPropagation();
      pinnedId = null;
      setPopupShown(false);
    });

    setupSearch();
  }

  // ---- Search box -------------------------------------------------------
  // Loads the 36 KB be-search.json once, then on every keystroke filters
  // by substring against gemeente names. Result-click flies the map to
  // the centroid, pins it, and shows the popup.
  let searchIndex = [];

  async function setupSearch() {
    if (!searchInputEl || !searchResultsEl) return;
    try {
      const res = await fetch("data/be-search.json", { cache: "force-cache" });
      if (res.ok) searchIndex = await res.json();
    } catch (err) {
      console.warn("be-search.json failed to load:", err);
      return;
    }

    // Mobile-collapsible behaviour: the search container starts as a
    // 40×40 magnifying-glass circle. Tap it → .is-expanded class flips
    // it to a full-width input. Desktop CSS ignores the class — the
    // input is always visible there.
    const searchPanelEl = root.querySelector(".interactive-inline__search");
    const searchWrapEl = root.querySelector(".search-input-wrap");

    function expand() {
      searchPanelEl?.classList.add("is-expanded");
      window.setTimeout(() => searchInputEl.focus(), 50);
    }
    function collapse() {
      searchPanelEl?.classList.remove("is-expanded");
    }
    function close() {
      searchResultsEl.hidden = true;
      searchResultsEl.innerHTML = "";
    }

    // Tap on the wrap (icon area, NOT on the input itself) opens the
    // expanded state on mobile. On desktop this is a no-op visually
    // since the input was already showing.
    searchWrapEl?.addEventListener("click", (e) => {
      if (e.target === searchInputEl) return;
      if (!searchPanelEl?.classList.contains("is-expanded")) {
        expand();
        e.stopPropagation();
      }
    });
    function render(query) {
      const q = query.trim().toLowerCase();
      if (q.length < 2) { close(); return; }
      // Prefer prefix matches, then substring matches.
      const prefix = [];
      const substr = [];
      for (const r of searchIndex) {
        const n = r.name.toLowerCase();
        if (n.startsWith(q)) prefix.push(r);
        else if (n.includes(q)) substr.push(r);
        if (prefix.length >= 8) break;
      }
      const hits = prefix.concat(substr).slice(0, 8);
      if (!hits.length) { close(); return; }
      searchResultsEl.innerHTML = hits
        .map((r) => `<li role="option" data-gisco="${r.id}" data-lon="${r.lon}" data-lat="${r.lat}">${r.name}</li>`)
        .join("");
      searchResultsEl.hidden = false;
    }

    searchInputEl.addEventListener("input", (e) => render(e.target.value));
    searchInputEl.addEventListener("focus", (e) => render(e.target.value));
    // Pressing Enter selects the top result (so users can type +
    // Enter without using the mouse).
    searchInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { searchInputEl.value = ""; close(); return; }
      if (e.key === "Enter") {
        const first = searchResultsEl.querySelector("li");
        if (first) first.click();
        e.preventDefault();
      }
    });
    searchResultsEl.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-gisco]");
      if (!li) return;
      const gisco = li.dataset.gisco;
      const lon = parseFloat(li.dataset.lon);
      const lat = parseFloat(li.dataset.lat);
      searchInputEl.value = li.textContent;
      close();
      collapse();   // collapse back to circle on mobile after selection
      // Fly in, then pin + show the popup once tiles for the gemeente
      // are loaded. Position the popup near the centroid pixel.
      map.flyTo({ center: [lon, lat], zoom: 10, essential: true, speed: 0.9 });
      const reveal = () => {
        const px = map.project([lon, lat]);
        pinnedId = null;             // clear previous pin (showPopup will re-pin)
        positionPopupAt(px.x, px.y);
        showPopup(gisco);
        pinnedId = gisco;
      };
      // Wait for the flyTo to settle so querySourceFeatures has tiles.
      map.once("moveend", reveal);
    });
    // Clicking outside the whole search panel closes the dropdown AND
    // collapses back to the icon-circle on mobile.
    document.addEventListener("click", (e) => {
      if (searchPanelEl?.contains(e.target)) return;
      close();
      collapse();
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
      if (map.getLayer("water")) map.setPaintProperty("water", "fill-color", "#E6F5FF");
      if (map.getLayer("places_country")) map.setPaintProperty("places_country", "text-color", "#3F4865");
      map.addSource("lau", { type: "vector", url: "pmtiles://data/lau-scrolly.pmtiles" });
      const beforeId = borderLayerId ?? undefined;
      map.addLayer({ id: "lau-fill", type: "fill", source: "lau", "source-layer": "lau", paint: { "fill-color": buildFillExpr(yearA, yearB, mode), "fill-opacity": 0.85, "fill-outline-color": "rgba(255,255,255,0)" } }, beforeId);
      map.addLayer({ id: "lau-outline", type: "line", source: "lau", "source-layer": "lau", paint: { "line-color": "rgba(255,255,255,0.75)", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0, 6, 0.2, 7, 0.4, 8, 0.6] } }, beforeId);
      map.addLayer({ id: "lau-hover", type: "line", source: "lau", "source-layer": "lau", paint: { "line-color": "#031037", "line-width": 2, "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0] } }, beforeId);
      attachInteractions();
      updateLegend();
      periodTitleEl.textContent = "Bevolkingsevolutie in Europa";
      // Apply the requested initial view, then keep re-applying on
      // every container resize until the user takes over. AEM (and
      // similar responsive-iframe hosts) inject the iframe at 0×N
      // first and grow it later — a single fitBounds at load time
      // computes against the wrong size and looks "zoomed out". The
      // ResizeObserver catches that growth no matter when it
      // happens.
      map.resize();
      applyInitialView();
      if (typeof ResizeObserver !== "undefined") {
        let lastW = 0, lastH = 0;
        const ro = new ResizeObserver(() => {
          const rect = mapEl.getBoundingClientRect();
          const w = Math.round(rect.width);
          const h = Math.round(rect.height);
          if (w === lastW && h === lastH) return;
          lastW = w; lastH = h;
          map.resize();
          applyInitialView();
          if (userMoved) ro.disconnect();
        });
        ro.observe(mapEl);
        // Belt-and-suspenders: also disconnect after 5 s so the
        // observer doesn't keep firing forever on a page that
        // genuinely never gets touched.
        window.setTimeout(() => ro.disconnect(), 5000);
      } else {
        // Older browser fallback: fixed-delay re-apply.
        window.setTimeout(() => { map.resize(); applyInitialView(); }, 600);
      }
      resolve();
    });
  });
}
