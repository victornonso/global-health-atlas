/* ── Theme toggle ─────────────────────────────────────────── */
window.toggleTheme = function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.dataset.theme === "light";
  html.dataset.theme = isLight ? "dark" : "light";
  document.getElementById("theme-toggle").textContent = isLight ? "🌙" : "☀️";
  /* Persist preference */
  try { localStorage.setItem("gha-theme", html.dataset.theme); } catch(e) {}
};

/* Apply saved theme on load */
(function () {
  try {
    const saved = localStorage.getItem("gha-theme");
    if (saved) {
      document.documentElement.dataset.theme = saved;
      document.addEventListener("DOMContentLoaded", function () {
        const btn = document.getElementById("theme-toggle");
        if (btn) btn.textContent = saved === "light" ? "☀️" : "🌙";
      });
    }
  } catch(e) {}
})();

/**
 * main.js  —  Application Orchestrator
 * ─────────────────────────────────────────────────────────
 * Responsibilities:
 *   1. Load data via dataLoader.js
 *   2. Drive the loading screen animation
 *   3. Handle page navigation
 *   4. Lazy-init each page module on first visit
 *
 * Each page module (page1_map, page2_trends, …) exposes a
 * single window.initPageN() function called exactly once.
 * ─────────────────────────────────────────────────────────
 */

"use strict";

/* ── Page registry ────────────────────────────────────────── */
const PAGE_INITS = {
  1: () => window.initPage1(),
  2: () => window.initPage2(),
  3: () => window.initPage3(),
  4: () => window.initPage4(),
  5: () => window.initPage5(),
};
const pageInited = {};

/* ── Navigation ───────────────────────────────────────────── */
window.showPage = function showPage(n) {
  /* Pause page-4 animation when leaving */
  if (window.p4TogglePlay && n !== 4) {
    const btn = document.getElementById("p4-play-btn");
    if (btn && btn.classList.contains("playing")) {
      window.p4TogglePlay();
    }
  }

  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));

  document.getElementById("page-" + n).classList.add("active");
  document.querySelectorAll(".nav-btn")[n - 1].classList.add("active");

  /* Lazy-init */
  if (!pageInited[n] && window.allData) {
    PAGE_INITS[n]?.();
    pageInited[n] = true;
  }
};

/* ── Loading screen ───────────────────────────────────────── */
function setLoadProgress(pct, msg) {
  const fill = document.querySelector(".loading-bar-fill");
  const sub  = document.querySelector(".loading-sub");
  if (fill) fill.style.width = pct + "%";
  if (sub  && msg) sub.textContent = msg;
}

function hideLoadingScreen() {
  const screen = document.getElementById("loading-screen");
  if (!screen) return;
  screen.classList.add("hidden");
  setTimeout(() => screen.remove(), 600);
}

/* ── Bootstrap ────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  setLoadProgress(10, "Initializing…");

  window
    .loadData("data/health_data.csv")
    .then(() => {
      setLoadProgress(85, "Building visualizations…");

      /* Init page 1 immediately (it's the landing page) */
      PAGE_INITS[1]?.();
      pageInited[1] = true;

      setLoadProgress(100, "Ready");
      setTimeout(hideLoadingScreen, 400);
    })
    .catch((err) => {
      console.error("[main] Failed to load data:", err);
      setLoadProgress(100, "Error loading data — see console");
      document.querySelector(".loading-bar-fill").style.background = "#e84545";

      /* Show an error banner on page 1 */
      setTimeout(() => {
        hideLoadingScreen();
        const banner = document.createElement("div");
        banner.className = "error-banner";
        banner.innerHTML = `
          <strong>Could not load health_data.csv</strong><br>
          Make sure the file is at <code>data/health_data.csv</code> relative to index.html,
          and that you are serving this project through a local HTTP server
          (e.g. <code>npx serve .</code> or VS Code Live Server).
          <br><br>Error: ${err.message || err}`;
        document.getElementById("p1-stats")?.before(banner);
      }, 800);
    });
});
