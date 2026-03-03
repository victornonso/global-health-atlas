/**
 * page5_correlation.js — Pearson Correlation Heatmap
 *
 * Displays an 11×11 heatmap of Pearson r values between health and
 * socioeconomic variables. Correlations are computed on per-country
 * averages across all years to remove temporal noise.
 *
 * Controls:  Region filter (recalculates + transitions cells on change)
 *
 * Color scale: diverging red (−1) → dark (0) → blue (+1)
 * Findings panel: auto-generated top-3 positive and negative
 *                 correlations with Life Expectancy.
 */

"use strict";

(function () {

  /** Variables shown on both axes of the heatmap. */
  const VARS = [
    { key: "Life_expectancy",     label: "Life Expectancy" },
    { key: "GDP_per_capita",      label: "GDP per Capita"  },
    { key: "Schooling",           label: "Schooling"       },
    { key: "Infant_deaths",       label: "Infant Deaths"   },
    { key: "Adult_mortality",     label: "Adult Mortality" },
    { key: "Incidents_HIV",       label: "HIV Incidents"   },
    { key: "Hepatitis_B",         label: "Hepatitis B"     },
    { key: "Polio",               label: "Polio Vacc."     },
    { key: "Diphtheria",          label: "Diphtheria Vacc."},
    { key: "Alcohol_consumption", label: "Alcohol"         },
    { key: "BMI",                 label: "BMI"             },
  ];

  const N = VARS.length;

  /** Diverging scale: red = negative, near-black = zero, blue = positive. */
  const colorScale = d3.scaleDiverging()
    .domain([-1, 0, 1])
    .interpolator(d3.interpolateRgbBasis(["#e84545", "#1a1a28", "#50b0f0"]));

  let currentRegion = "All";

  /* References held so _updateCells() can target existing DOM nodes. */
  let _gRef = null;

  window.initPage5 = function () {
    _buildRegionFilter();
    const matrix = _computeMatrix(window.allData);
    _drawHeatmap(matrix);
    _renderFindings(matrix);
  };

  /* ── Region filter ────────────────────────────────────────────────── */

  /** Injects the region dropdown above the chart container. */
  function _buildRegionFilter() {
    const page5 = document.getElementById("page-5");
    if (!page5 || document.getElementById("p5-region")) return;

    const ctrlDiv = document.createElement("div");
    ctrlDiv.className = "controls";

    const lbl = document.createElement("span");
    lbl.className   = "ctrl-label";
    lbl.textContent = "Region";

    const sel = document.createElement("select");
    sel.id = "p5-region";

    const opt0 = document.createElement("option");
    opt0.value = "All"; opt0.textContent = "All Regions";
    sel.appendChild(opt0);

    window.REGIONS.forEach(function (r) {
      const o = document.createElement("option");
      o.value = r; o.textContent = window.REGION_SHORT[r] || r;
      sel.appendChild(o);
    });

    sel.addEventListener("change", function () {
      currentRegion = this.value;
      const filtered = currentRegion === "All"
        ? window.allData
        : window.allData.filter(function (d) { return d.Region === currentRegion; });
      const matrix = _computeMatrix(filtered);
      _updateCells(matrix);
      _renderFindings(matrix);
    });

    ctrlDiv.appendChild(lbl);
    ctrlDiv.appendChild(sel);
    page5.insertBefore(ctrlDiv, page5.querySelector(".chart-container"));
  }

  /* ── Correlation matrix ───────────────────────────────────────────── */

  /**
   * Computes an N×N Pearson correlation matrix from the provided dataset.
   * Values are first averaged per country across all years to avoid
   * inflating r by temporal repetition.
   */
  function _computeMatrix(data) {
    const byCountry = d3.rollup(
      data,
      function (rows) {
        const obj = {};
        VARS.forEach(function (v) {
          obj[v.key] = d3.mean(rows, function (r) { return r[v.key]; });
        });
        return obj;
      },
      function (d) { return d.Country; }
    );
    const flat = Array.from(byCountry.values());

    const matrix = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const pairs = flat
          .map(function (d) { return [d[VARS[i].key], d[VARS[j].key]]; })
          .filter(function (p) { return !isNaN(p[0]) && !isNaN(p[1]) && p[0] != null && p[1] != null; });
        matrix.push({
          i, j,
          vi: VARS[i],
          vj: VARS[j],
          r:  window.pearson(
                pairs.map(function (p) { return p[0]; }),
                pairs.map(function (p) { return p[1]; })
              ),
        });
      }
    }
    return matrix;
  }

  /* ── Draw heatmap (once) ──────────────────────────────────────────── */

  function _drawHeatmap(matrix) {
    const svgEl  = document.getElementById("p5-svg");
    const W      = svgEl.clientWidth || 840;
    const margin = { top: 200, right: 20, bottom: 20, left: 156 };
    const cell   = Math.min(Math.floor((W - margin.left - margin.right) / N), 62);
    const H      = cell * N + margin.top + margin.bottom;

    const svg = d3.select("#p5-svg")
      .attr("viewBox", "0 0 " + W + " " + H)
      .attr("height", H);

    const g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    _gRef = g;

    /* ── Cells ── */
    g.selectAll(".heatmap-cell").data(matrix).join("rect")
      .attr("class",  "heatmap-cell")
      .attr("x",      function (d) { return d.j * cell; })
      .attr("y",      function (d) { return d.i * cell; })
      .attr("width",  cell - 2)
      .attr("height", cell - 2)
      .attr("rx",     3)
      .attr("fill",   function (d) { return colorScale(d.r); })
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke", "var(--text)").attr("stroke-width", 1.5);
        window.showTooltip(
          '<div class="tt-country">'  + d.vi.label + "</div>" +
          '<div class="tt-region">vs ' + d.vj.label + "</div>" +
          '<hr class="tt-divider">' +
          '<div class="tt-row"><span class="tt-label">Pearson r</span>' +
            '<span class="tt-value" style="color:' +
              (d.r > 0 ? "var(--accent2)" : d.r < 0 ? "var(--accent3)" : "var(--text-dim)") +
            '">' + d.r.toFixed(3) + "</span></div>" +
          '<div class="tt-row"><span class="tt-label">Strength</span>' +
            '<span class="tt-value">' + _strength(d.r) + "</span></div>",
          event
        );
      })
      .on("mousemove", window.moveTooltip)
      .on("mouseout",  function () {
        d3.select(this).attr("stroke", null).attr("stroke-width", null);
        window.hideTooltip();
      });

    /* ── r value text ── */
    g.selectAll(".corr-text").data(matrix).join("text")
      .attr("class",          "corr-text")
      .attr("x",              function (d) { return d.j * cell + cell / 2 - 1; })
      .attr("y",              function (d) { return d.i * cell + cell / 2 + 4; })
      .attr("text-anchor",    "middle")
      .attr("font-family",    "JetBrains Mono, monospace")
      .attr("font-size",      Math.max(7, Math.min(cell * 0.22, 11)))
      /* Dark text on bright cells, light text on dark cells */
      .attr("fill",           function (d) {
        return Math.abs(d.r) > 0.45 ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.7)";
      })
      .attr("pointer-events", "none")
      .text(function (d) { return d.r.toFixed(2); });

    /* ── Diagonal overlay (self-correlation cells) ── */
    g.selectAll(".diag-marker").data(VARS).join("rect")
      .attr("x",            function (_, i) { return i * cell; })
      .attr("y",            function (_, i) { return i * cell; })
      .attr("width",        cell - 2)
      .attr("height",       cell - 2)
      .attr("rx",           3)
      .attr("fill",         "rgba(255,255,255,0.06)")
      .attr("stroke",       "rgba(255,255,255,0.12)")
      .attr("stroke-width", 1)
      .attr("pointer-events", "none");

    /* ── Row labels ── */
    g.selectAll(".row-label").data(VARS).join("text")
      .attr("class",       "row-label")
      .attr("x",           -8)
      .attr("y",           function (_, i) { return i * cell + cell / 2 + 4; })
      .attr("text-anchor", "end")
      .attr("font-family", "DM Sans, sans-serif")
      .attr("font-size",   Math.min(13, cell * 0.22))
      .attr("fill",        "var(--text-dim)")
      .text(function (d) { return d.label; });

    /* ── Column labels (rotated −45°) ── */
    g.selectAll(".col-label").data(VARS).join("text")
      .attr("class", "col-label")
      .attr("transform", function (_, i) {
        return "translate(" + (i * cell + cell / 2) + ",-14) rotate(-45)";
      })
      .attr("text-anchor", "start")
      .attr("font-family", "DM Sans, sans-serif")
      .attr("font-size",   Math.min(13, cell * 0.22))
      .attr("fill",        "var(--text-dim)")
      .text(function (d) { return d.label; });

    _drawColorbar(svg, margin.left, 16, 220);
  }

  /* ── Cell update on region change ────────────────────────────────── */

  /** Smoothly re-colors cells and updates r text without a full redraw. */
  function _updateCells(matrix) {
    if (!_gRef) return;
    _gRef.selectAll(".heatmap-cell").data(matrix)
      .transition().duration(600).ease(d3.easeCubicInOut)
      .attr("fill", function (d) { return colorScale(d.r); });
    _gRef.selectAll(".corr-text").data(matrix)
      .transition().duration(600)
      .text(function (d) { return d.r.toFixed(2); })
      .attr("fill", function (d) {
        return Math.abs(d.r) > 0.45 ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.7)";
      });
  }

  /* ── Colorbar legend ──────────────────────────────────────────────── */

  function _drawColorbar(svg, x, y, w) {
    const grad = svg.append("defs").append("linearGradient")
      .attr("id", "p5-cb-grad").attr("x1", "0%").attr("x2", "100%");
    for (let k = 0; k <= 10; k++) {
      grad.append("stop")
        .attr("offset",     k * 10 + "%")
        .attr("stop-color", colorScale(-1 + k * 0.2));
    }

    const lg = svg.append("g").attr("transform", "translate(" + x + "," + y + ")");
    lg.append("rect").attr("width", w).attr("height", 12).attr("rx", 3)
      .attr("fill", "url(#p5-cb-grad)");
    lg.append("text").attr("x", 0).attr("y", 26)
      .attr("font-family", "JetBrains Mono, monospace").attr("font-size", 9)
      .attr("fill", "var(--accent3)").text("\u22121.0 (negative)");
    lg.append("text").attr("x", w / 2).attr("y", 26).attr("text-anchor", "middle")
      .attr("font-family", "JetBrains Mono, monospace").attr("font-size", 9)
      .attr("fill", "var(--text-dim)").text("0");
    lg.append("text").attr("x", w).attr("y", 26).attr("text-anchor", "end")
      .attr("font-family", "JetBrains Mono, monospace").attr("font-size", 9)
      .attr("fill", "var(--accent2)").text("+1.0 (positive)");
    lg.append("text").attr("x", w + 10).attr("y", 10)
      .attr("font-family", "DM Sans, sans-serif").attr("font-size", 10)
      .attr("fill", "var(--text-dim)").text("Pearson r");
  }

  /* ── Findings summary ─────────────────────────────────────────────── */

  /**
   * Auto-generates a prose summary of the top-3 positive and negative
   * correlations with Life Expectancy from the current matrix.
   */
  function _renderFindings(matrix) {
    const pairs   = matrix
      .filter(function (d) { return d.vi.key === "Life_expectancy" && d.vj.key !== "Life_expectancy"; })
      .sort(function (a, b) { return Math.abs(b.r) - Math.abs(a.r); });

    const top3Pos = pairs.filter(function (d) { return d.r > 0; }).slice(0, 3);
    const top3Neg = pairs.filter(function (d) { return d.r < 0; }).slice(0, 3);

    document.getElementById("p5-findings").innerHTML =
      '<strong style="color:var(--text)">Strongest positive correlations with Life Expectancy:</strong><br>' +
      top3Pos.map(function (d) {
        return '<span class="corr-pos">' + d.vj.label + " (r\u00a0=\u00a0" + d.r.toFixed(2) + ")</span>";
      }).join("  \xB7  ") +
      "<br><br>" +
      '<strong style="color:var(--text)">Strongest negative correlations:</strong><br>' +
      top3Neg.map(function (d) {
        return '<span class="corr-neg">' + d.vj.label + " (r\u00a0=\u00a0" + d.r.toFixed(2) + ")</span>";
      }).join("  \xB7  ") +
      "<br><br>" +
      "These patterns confirm that economic development (GDP), access to education (schooling), " +
      "and vaccination coverage are among the strongest positive predictors of longevity across the " +
      "2000\u20132015 period. Infant mortality and adult mortality rates represent the most powerful " +
      "inverse relationships\u00a0\u2014 both as downstream outcomes and as proxies for systemic " +
      "healthcare quality.";
  }

  /* ── Strength label ───────────────────────────────────────────────── */

  /** Maps an absolute Pearson r value to a human-readable strength label. */
  function _strength(r) {
    const a = Math.abs(r);
    if (a > 0.8) return "Very Strong";
    if (a > 0.6) return "Strong";
    if (a > 0.4) return "Moderate";
    if (a > 0.2) return "Weak";
    return "Negligible";
  }

}());
