import { initScrollyInline } from "./js/scrolly-inline.js";
import { initInteractiveInline } from "./js/interactive-inline.js";

const boxes = document.querySelectorAll(".scrolly__box");
const scrollyController = await initScrollyInline({
  mapElement: document.getElementById("scrolly-map"),
  chartPanelElement: document.getElementById("scrolly-chart-panel"),
  infoSentenceElement: document.getElementById("scrolly-info-sentence"),
  popupChartElement: document.getElementById("scrolly-popup-chart"),
  legendElement: document.getElementById("scrolly-map-legend"),
});

  let lastSentStep = -1;
  function sendStep(index) {
    if (index === lastSentStep) return;
    lastSentStep = index;
    scrollyController.applyStep(index);
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
