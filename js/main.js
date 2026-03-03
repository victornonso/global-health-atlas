/**
 * main.js — Application bootstrap and navigation.
 *
 * Responsibilities:
 *   1. Persist and restore the light/dark theme preference.
 *   2. Load CSV data via dataLoader.js.
 *   3. Drive the loading-screen progress bar.
 *   4. Handle SPA-style page navigation.
 *   5. Lazy-initialise each page module on first visit.
 *
 * Each page module exposes a single window.initPageN() entry point
 * that is called exactly once, after window.allData is available.
 */

"use strict";

/* ── Theme ────────────────────────────────────────────────────────────── */

window.toggleTheme = function () {
  const html    = document.documentElement;
  const isLight = html.dataset.theme === "light";
  html.dataset.theme = isLight ? "dark" : "light";
  document.getElementById("theme-toggle").textContent = isLight ? "\uD83C\uDF19" : "\u2600\uFE0F";
  try { localStorage.setItem("gha-theme", html.dataset.theme); } catch (e) {}
};

/* Restore saved preference before first paint. */
(function () {
  try {
    const saved = localStorage.getItem("gha-theme");
    if (!saved) return;
    document.documentElement.dataset.theme = saved;
    document.addEventListener("DOMContentLoaded", function () {
      const btn = document.getElementById("theme-toggle");
      if (btn) btn.textContent = saved === "light" ? "\u2600\uFE0F" : "\uD83C\uDF19";
    });
  } catch (e) {}
}());

/* ── Page registry ────────────────────────────────────────────────────── */

/** Map of page index → init function. Populated lazily on first visit. */
const PAGE_INITS = {
  1: function () { window.initPage1(); },
  2: function () { window.initPage2(); },
  3: function () { window.initPage3(); },
  4: function () { window.initPage4(); },
  5: function () { window.initPage5(); },
};

const pageInited = {};

/* ── Navigation ───────────────────────────────────────────────────────── */

/**
 * Switch to page n, lazy-initing its module on first visit.
 * Pauses the page-4 race chart animation when navigating away.
 */
window.showPage = function (n) {
  /* Pause page-4 race animation when leaving that page */
  if (window.p4TogglePlay && n !== 4) {
    const btn = document.getElementById("p4-play-btn");
    if (btn && btn.classList.contains("playing")) window.p4TogglePlay();
  }

  document.querySelectorAll(".page").forEach(function (p) { p.classList.remove("active"); });
  document.querySelectorAll(".nav-btn").forEach(function (b) { b.classList.remove("active"); });
  document.getElementById("page-" + n).classList.add("active");
  document.querySelectorAll(".nav-btn")[n - 1].classList.add("active");

  if (!pageInited[n] && window.allData) {
    PAGE_INITS[n]();
    pageInited[n] = true;
  }
};

/* ── Loading screen ───────────────────────────────────────────────────── */

function _setLoadProgress(pct, msg) {
  const fill = document.querySelector(".loading-bar-fill");
  const sub  = document.querySelector(".loading-sub");
  if (fill) fill.style.width = pct + "%";
  if (sub && msg) sub.textContent = msg;
}

function _hideLoadingScreen() {
  const screen = document.getElementById("loading-screen");
  if (!screen) return;
  screen.classList.add("hidden");
  setTimeout(function () { screen.remove(); }, 600);
}

/* ── Bootstrap ────────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", function () {
  _setLoadProgress(10, "Initializing\u2026");

  window.loadData("data/health_data.csv")
    .then(function () {
      _setLoadProgress(85, "Building visualizations\u2026");

      /* Page 1 is the landing page — init immediately. */
      PAGE_INITS[1]();
      pageInited[1] = true;

      _setLoadProgress(100, "Ready");
      setTimeout(_hideLoadingScreen, 400);
    })
    .catch(function (err) {
      _setLoadProgress(100, "Error loading data \u2014 see console");
      document.querySelector(".loading-bar-fill").style.background = "#e84545";

      setTimeout(function () {
        _hideLoadingScreen();
        const banner = document.createElement("div");
        banner.className = "error-banner";
        banner.innerHTML =
          "<strong>Could not load health_data.csv</strong><br>" +
          "Make sure the file is at <code>data/health_data.csv</code> relative to index.html " +
          "and that you are serving this project via a local HTTP server " +
          "(e.g. <code>npx serve .</code> or VS Code Live Server).<br><br>" +
          "Error: " + (err.message || err);
        const stats = document.getElementById("p1-stats");
        if (stats) stats.before(banner);
      }, 800);
    });
});
