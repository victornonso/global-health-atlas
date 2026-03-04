/**
 * dataLoader.js
 *
 * Loads health_data.csv, parses all numeric fields, and exposes
 * shared constants and utility functions used across every page module.
 *
 * Globals set here:
 *   window.REGIONS        — ordered region name list
 *   window.REGION_COLORS  — region → hex color
 *   window.REGION_SHORT   — region → abbreviated display string
 *   window.YEARS          — [2000…2015]
 *   window.allData        — parsed CSV row array (set after loadData resolves)
 *
 * Utility functions:
 *   window.loadData(path)          — fetch + parse CSV, returns Promise
 *   window.getYearData(year)       — filter allData to a single year
 *   window.fmt(v, decimals)        — format numeric value, 'N/A' on bad input
 *   window.fmtK(v)                 — format USD value with 'k' suffix
 *   window.showTooltip(html, evt)  — show shared tooltip DOM element
 *   window.moveTooltip(evt)        — reposition tooltip to cursor
 *   window.hideTooltip()           — hide tooltip
 *   window.buildRegionLegend(id)   — inject colored dot legend into container
 *   window.pearson(xs, ys)         — Pearson correlation coefficient
 *   window.linearRegression(xs,ys) — OLS slope + intercept
 */

"use strict";

/* ── Shared constants ─────────────────────────────────────────────────── */

window.REGIONS = [
  "Africa",
  "Asia",
  "Central America and Caribbean",
  "European Union",
  "Middle East",
  "North America",
  "Oceania",
  "Rest of Europe",
  "South America",
];

window.REGION_COLORS = {
  Africa:                          "#e84545",
  Asia:                            "#f0a030",
  "Central America and Caribbean": "#f0d030",
  "European Union":                "#50b0f0",
  "Middle East":                   "#d060e0",
  "North America":                 "#40d0a0",
  Oceania:                         "#60e060",
  "Rest of Europe":                "#6080f0",
  "South America":                 "#f07040",
};

window.REGION_SHORT = {
  Africa:                          "Africa",
  Asia:                            "Asia",
  "Central America and Caribbean": "C. America & Carib.",
  "European Union":                "European Union",
  "Middle East":                   "Middle East",
  "North America":                 "N. America",
  Oceania:                         "Oceania",
  "Rest of Europe":                "Rest of Europe",
  "South America":                 "S. America",
};

window.YEARS = d3.range(2000, 2016);

/* ── Row parser ───────────────────────────────────────────────────────── */

/** Coerce all numeric columns; default missing values to 0. */
function parseRow(d) {
  return {
    Country:                     d.Country,
    Status:                      d.Status,
    Region:                      d.Region,
    Year:                        +d.Year,
    Infant_deaths:               +d.Infant_deaths               || 0,
    Under_five_deaths:           +d.Under_five_deaths           || 0,
    Adult_mortality:             +d.Adult_mortality             || 0,
    Alcohol_consumption:         +d.Alcohol_consumption         || 0,
    Hepatitis_B:                 +d.Hepatitis_B                 || 0,
    Measles:                     +d.Measles                     || 0,
    BMI:                         +d.BMI                         || 0,
    Polio:                       +d.Polio                       || 0,
    Diphtheria:                  +d.Diphtheria                  || 0,
    Incidents_HIV:               +d.Incidents_HIV               || 0,
    GDP_per_capita:              +d.GDP_per_capita              || 0,
    Population_mln:              +d.Population_mln              || 0,
    Thinness_ten_nineteen_years: +d.Thinness_ten_nineteen_years || 0,
    Thinness_five_nine_years:    +d.Thinness_five_nine_years    || 0,
    Schooling:                   +d.Schooling                   || 0,
    /* Binary flags — keep as 0/1 integers, not booleans */
    Economy_status_Developed:    +d.Economy_status_Developed,
    Economy_status_Developing:   +d.Economy_status_Developing,
    Life_expectancy:             +d.Life_expectancy             || 0,
  };
}

/* ── Public loader ────────────────────────────────────────────────────── */

/**
 * Fetches and parses the CSV at csvPath.
 * Stores result in window.allData and returns it via Promise.
 */
window.loadData = function loadData(csvPath = "data/health_data.csv") {
  return d3.csv(csvPath, parseRow).then(function (data) {
    window.allData = data;
    return data;
  });
};

/* ── Data helpers ─────────────────────────────────────────────────────── */

/** Returns all rows matching the given year. */
window.getYearData = function (year) {
  return window.allData.filter(function (d) { return d.Year === year; });
};

/** Format a number to fixed decimal places; returns 'N/A' for null / NaN. */
window.fmt = function (v, decimals) {
  decimals = decimals == null ? 1 : decimals;
  if (v == null || isNaN(v)) return "N/A";
  return (+v).toFixed(decimals);
};

/** Format a USD value; values ≥ 1000 are shown with a 'k' suffix. */
window.fmtK = function (v) {
  if (v == null || isNaN(v) || v === 0) return "N/A";
  v = +v;
  return v >= 1000 ? "$" + (v / 1000).toFixed(1) + "k" : "$" + v.toFixed(0);
};

/* ── Tooltip ──────────────────────────────────────────────────────────── */

/** Shared tooltip DOM element — all pages use the same node. */
const _tt = document.getElementById("tooltip");

window.showTooltip = function (html, event) {
  _tt.classList.add("visible");
  _tt.innerHTML = html;
  window.moveTooltip(event);
};

/**
 * Position the tooltip at the centre of the viewport so it is always
 * fully visible regardless of where the data point sits on screen.
 * The event parameter is kept for API compatibility but not used for
 * positioning — all pages call moveTooltip on mousemove so ignoring
 * it here is safe.
 */
window.moveTooltip = function (event) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tw = _tt.offsetWidth  || 230;
  const th = _tt.offsetHeight || 160;
  _tt.style.left = Math.round((vw - tw) / 2) + "px";
  _tt.style.top  = Math.round((vh - th) / 2) + "px";
};

window.hideTooltip = function () {
  _tt.classList.remove("visible");
};

/* ── Region legend builder ────────────────────────────────────────────── */

/**
 * Injects a colored dot + label for each region into the element at containerId.
 * Calls onClickCallback(regionName, itemElement) on click if provided.
 */
window.buildRegionLegend = function (containerId, onClickCallback) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";
  window.REGIONS.forEach(function (r) {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.dataset.region = r;
    item.innerHTML =
      '<div class="legend-dot" style="background:' + window.REGION_COLORS[r] + '"></div>' +
      (window.REGION_SHORT[r] || r);
    if (onClickCallback) {
      item.addEventListener("click", function () { onClickCallback(r, item); });
    }
    el.appendChild(item);
  });
};

/* ── Statistical helpers ──────────────────────────────────────────────── */

/** Pearson correlation coefficient for two equal-length numeric arrays. */
window.pearson = function (xs, ys) {
  const n = xs.length;
  if (!n) return 0;
  const mx  = d3.mean(xs);
  const my  = d3.mean(ys);
  const num = d3.sum(xs.map(function (x, i) { return (x - mx) * (ys[i] - my); }));
  const den = Math.sqrt(
    d3.sum(xs.map(function (x) { return (x - mx) * (x - mx); })) *
    d3.sum(ys.map(function (y) { return (y - my) * (y - my); }))
  );
  return den ? num / den : 0;
};

/** OLS linear regression — returns [slope, intercept]. */
window.linearRegression = function (xs, ys) {
  const mx    = d3.mean(xs);
  const my    = d3.mean(ys);
  const num   = d3.sum(xs.map(function (x, i) { return (x - mx) * (ys[i] - my); }));
  const den   = d3.sum(xs.map(function (x) { return (x - mx) * (x - mx); }));
  const slope = den ? num / den : 0;
  return [slope, my - slope * mx];
};
