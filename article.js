import { initScrollyInline } from "./js/scrolly-inline.js";
import { initInteractiveInline } from "./js/interactive-inline.js";

const boxes = document.querySelectorAll(".scrolly__box");
const scrollyController = await initScrollyInline({
  mapElement: document.getElementById("scrolly-map"),
  chartPanelElement: document.getElementById("scrolly-chart-panel"),
  infoSentenceElement: document.getElementById("scrolly-info-sentence"),
  popupChartElement: document.getElementById("scrolly-popup-chart"),
  legendElement: document.getElementById("scrolly-card-legend"),
});

// Step dispatcher with a small debounce so fast scrolling skips the
// intermediate steps and only the final one in view actually triggers
// applyStep. Without this, each panel that flashed across the trigger
// zone would queue its own flyTo / filter updates — fine when scrolling
// slowly, but a noticeable 'catching-up' delay when scrolling fast.
//
// 100 ms is long enough to coalesce a fast-scroll burst (typical
// scroll bursts are < 50 ms between IntersectionObserver events), short
// enough to feel instantaneous when reading panel-by-panel.
const STEP_DEBOUNCE_MS = 100;
let lastAppliedStep = -1;
let pendingStep = -1;
let pendingTimer = null;

function sendStep(index) {
  pendingStep = index;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = window.setTimeout(() => {
    pendingTimer = null;
    if (pendingStep === lastAppliedStep) return;
    lastAppliedStep = pendingStep;
    scrollyController.applyStep(pendingStep);
  }, STEP_DEBOUNCE_MS);
}

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const index = Number.parseInt(entry.target.dataset.step, 10);
    if (Number.isFinite(index)) sendStep(index);
  }
}, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
boxes.forEach((box) => observer.observe(box));
setTimeout(() => sendStep(0), 200);

const interactiveRoot = document.getElementById("interactive-root");
if (interactiveRoot) {
  let interactiveLoaded = false;
  const interactiveObserver = new IntersectionObserver((entries) => {
    if (interactiveLoaded) return;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      interactiveLoaded = true;
      initInteractiveInline({ rootElement: interactiveRoot }).catch((err) => {
        console.error(err);
      });
      interactiveObserver.disconnect();
      break;
    }
  }, { rootMargin: "200px 0px", threshold: 0.01 });
  interactiveObserver.observe(interactiveRoot);
}
