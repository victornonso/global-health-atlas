/**
 * dataLoader.js
 * ─────────────────────────────────────────────────────────
 * Responsible for: loading the external CSV, parsing all
 * numeric fields, and exposing shared constants (region
 * colors, region short-names) used by every other module.
 *
 * Team: shared / architecture owner
 * ─────────────────────────────────────────────────────────
 */

"use strict";

/* ── Shared constants ──────────────────────────────────── */

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

window.YEARS = d3.range(2000, 2016); // [2000 … 2015]

/* ── Row parser ─────────────────────────────────────────── */
function parseRow(d) {
  return {
    Country:                   d.Country,
    Status:                    d.Status,
    Region:                    d.Region,
    Year:                      +d.Year,
    Infant_deaths:             +d.Infant_deaths             || 0,
    Under_five_deaths:         +d.Under_five_deaths         || 0,
    Adult_mortality:           +d.Adult_mortality           || 0,
    Alcohol_consumption:       +d.Alcohol_consumption       || 0,
    Hepatitis_B:               +d.Hepatitis_B               || 0,
    Measles:                   +d.Measles                   || 0,
    BMI:                       +d.BMI                       || 0,
    Polio:                     +d.Polio                     || 0,
    Diphtheria:                +d.Diphtheria                || 0,
    Incidents_HIV:             +d.Incidents_HIV             || 0,
    GDP_per_capita:            +d.GDP_per_capita            || 0,
    Population_mln:            +d.Population_mln            || 0,
    Thinness_ten_nineteen_years: +d.Thinness_ten_nineteen_years || 0,
    Thinness_five_nine_years:  +d.Thinness_five_nine_years  || 0,
    Schooling:                 +d.Schooling                 || 0,
    Economy_status_Developed:  +d.Economy_status_Developed,
    Economy_status_Developing: +d.Economy_status_Developing,
    Life_expectancy:           +d.Life_expectancy           || 0,
  };
}

/* ── Main loader ─────────────────────────────────────────── */
/**
 * loadData(csvPath)
 * Fetches and parses the CSV. Returns a Promise<Array> of
 * parsed row objects. Also stores result in window.allData.
 */
window.loadData = function loadData(csvPath = "data/health_data.csv") {
  return d3.csv(csvPath, parseRow).then((data) => {
    window.allData = data;
    console.info(`[dataLoader] Loaded ${data.length} rows from ${csvPath}`);
    return data;
  });
};

/* ── Utility helpers (used across pages) ─────────────────── */

/** Filter allData to a single year */
window.getYearData = function (year) {
  return window.allData.filter((d) => d.Year === year);
};

/** Format a number to fixed decimals, returns 'N/A' for bad values */
window.fmt = function (v, decimals = 1) {
  if (v == null || isNaN(v)) return "N/A";
  return (+v).toFixed(decimals);
};

/** Format a USD value with k suffix */
window.fmtK = function (v) {
  if (v == null || isNaN(v) || v === 0) return "N/A";
  v = +v;
  return v >= 1000 ? "$" + (v / 1000).toFixed(1) + "k" : "$" + v.toFixed(0);
};

/** Tooltip helpers — shared DOM element */
const _tt = document.getElementById("tooltip");

window.showTooltip = function (html, event) {
  _tt.classList.add("visible");
  _tt.innerHTML = html;
  window.moveTooltip(event);
};
window.moveTooltip = function (event) {
  const tw = 260;
  const left =
    event.pageX + tw + 20 > window.innerWidth
      ? event.pageX - tw - 10
      : event.pageX + 16;
  _tt.style.left = left + "px";
  _tt.style.top  = event.pageY - 10 + "px";
};
window.hideTooltip = function () {
  _tt.classList.remove("visible");
};

/** Build a region dot legend into a container element by id */
window.buildRegionLegend = function (containerId, onClickCallback) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";
  window.REGIONS.forEach((r) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.dataset.region = r;
    item.innerHTML = `<div class="legend-dot" style="background:${window.REGION_COLORS[r]}"></div>${window.REGION_SHORT[r] || r}`;
    if (onClickCallback) item.addEventListener("click", () => onClickCallback(r, item));
    el.appendChild(item);
  });
};

/** Pearson correlation coefficient for two numeric arrays */
window.pearson = function (xs, ys) {
  const n = xs.length;
  if (!n) return 0;
  const mx = d3.mean(xs),
        my = d3.mean(ys);
  const num = d3.sum(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  const den = Math.sqrt(
    d3.sum(xs.map((x) => (x - mx) ** 2)) * d3.sum(ys.map((y) => (y - my) ** 2))
  );
  return den ? num / den : 0;
};

/** Simple OLS linear regression → [slope, intercept] */
window.linearRegression = function (xs, ys) {
  const mx = d3.mean(xs),
        my = d3.mean(ys);
  const num = d3.sum(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  const den = d3.sum(xs.map((x) => (x - mx) ** 2));
  const slope = den ? num / den : 0;
  return [slope, my - slope * mx];
};
