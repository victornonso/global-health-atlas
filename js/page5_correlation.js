/**
 * page5_correlation.js  —  Member E
 * ─────────────────────────────────────────────────────────
 * Interactive Pearson correlation heatmap.
 *
 * Variables: Life Expectancy, GDP, Schooling, Infant Deaths,
 * Adult Mortality, HIV, Hepatitis B, Polio, Diphtheria,
 * Alcohol, BMI.
 *
 * Features:
 *   • Diverging color scale (blue=positive, red=negative)
 *   • Hover tooltip with r value + strength label
 *   • Cell text (r value) styled for legibility
 *   • Colorbar legend
 *   • Findings summary auto-generated from correlations
 * ─────────────────────────────────────────────────────────
 */

"use strict";

(function () {
  /* ── Variable definitions ────────────────────────────────── */
  const VARS = [
    { key: "Life_expectancy",   label: "Life Expectancy" },
    { key: "GDP_per_capita",    label: "GDP per Capita" },
    { key: "Schooling",         label: "Schooling" },
    { key: "Infant_deaths",     label: "Infant Deaths" },
    { key: "Adult_mortality",   label: "Adult Mortality" },
    { key: "Incidents_HIV",     label: "HIV Incidents" },
    { key: "Hepatitis_B",       label: "Hepatitis B" },
    { key: "Polio",             label: "Polio Vacc." },
    { key: "Diphtheria",        label: "Diphtheria Vacc." },
    { key: "Alcohol_consumption", label: "Alcohol" },
    { key: "BMI",               label: "BMI" },
  ];

  const N = VARS.length;

  /* ── Color scale ─────────────────────────────────────────── */
  const colorScale = d3.scaleDiverging()
    .domain([-1, 0, 1])
    .interpolator(
      d3.interpolateRgbBasis(["#e84545", "#1a1a28", "#50b0f0"])
    );

  /* ── Public init ─────────────────────────────────────────── */
  window.initPage5 = function initPage5() {
    const matrix = _computeMatrix();
    _drawHeatmap(matrix);
    _renderFindings(matrix);
  };

  /* ── Compute Pearson matrix ──────────────────────────────── */
  function _computeMatrix() {
    /* Average each variable per country across all years */
    const byCountry = d3.rollup(
      window.allData,
      (rows) => {
        const obj = {};
        VARS.forEach((v) => { obj[v.key] = d3.mean(rows, (r) => r[v.key]); });
        return obj;
      },
      (d) => d.Country
    );
    const flat = Array.from(byCountry.values());

    const matrix = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const pairs = flat
          .map((d) => [d[VARS[i].key], d[VARS[j].key]])
          .filter(([a, b]) => !isNaN(a) && !isNaN(b) && a != null && b != null);
        const r = window.pearson(
          pairs.map((p) => p[0]),
          pairs.map((p) => p[1])
        );
        matrix.push({ i, j, vi: VARS[i], vj: VARS[j], r });
      }
    }
    return matrix;
  }

  /* ── Draw heatmap ────────────────────────────────────────── */
  function _drawHeatmap(matrix) {
    const svgEl  = document.getElementById("p5-svg");
    const W      = svgEl.clientWidth || 840;
    const margin = { top: 200, right: 20, bottom: 20, left: 156 };
    const cell   = Math.min(Math.floor((W - margin.left - margin.right) / N), 62);
    const H      = cell * N + margin.top + margin.bottom;

    const svg = d3
      .select("#p5-svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("height", H);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    /* Cells */
    g.selectAll(".heatmap-cell")
      .data(matrix)
      .join("rect")
      .attr("class", "heatmap-cell")
      .attr("x",      (d) => d.j * cell)
      .attr("y",      (d) => d.i * cell)
      .attr("width",  cell - 2)
      .attr("height", cell - 2)
      .attr("rx", 3)
      .attr("fill", (d) => colorScale(d.r))
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke", "var(--text)").attr("stroke-width", 1.5);
        window.showTooltip(
          `<div class="tt-country">${d.vi.label}</div>
           <div class="tt-region">vs ${d.vj.label}</div>
           <hr class="tt-divider">
           <div class="tt-row">
             <span class="tt-label">Pearson r</span>
             <span class="tt-value" style="color:${d.r > 0 ? "var(--accent2)" : d.r < 0 ? "var(--accent3)" : "var(--text-dim)"}">${d.r.toFixed(3)}</span>
           </div>
           <div class="tt-row"><span class="tt-label">Strength</span><span class="tt-value">${_strength(d.r)}</span></div>`,
          event
        );
      })
      .on("mousemove", window.moveTooltip)
      .on("mouseout", function () {
        d3.select(this).attr("stroke", null).attr("stroke-width", null);
        window.hideTooltip();
      });

    /* Cell text */
    g.selectAll(".corr-text")
      .data(matrix)
      .join("text")
      .attr("class", "corr-text")
      .attr("x", (d) => d.j * cell + cell / 2 - 1)
      .attr("y", (d) => d.i * cell + cell / 2 + 4)
      .attr("text-anchor", "middle")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("font-size", Math.max(7, Math.min(cell * 0.22, 11)))
      .attr("fill", (d) => (Math.abs(d.r) > 0.45 ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.7)"))
      .attr("pointer-events", "none")
      .text((d) => d.r.toFixed(2));

    /* Diagonal overlay (self-correlation) */
    g.selectAll(".diag-marker")
      .data(VARS)
      .join("rect")
      .attr("x", (_, i) => i * cell)
      .attr("y", (_, i) => i * cell)
      .attr("width",  cell - 2)
      .attr("height", cell - 2)
      .attr("rx", 3)
      .attr("fill", "rgba(255,255,255,0.06)")
      .attr("stroke", "rgba(255,255,255,0.12)")
      .attr("stroke-width", 1)
      .attr("pointer-events", "none");

    /* Row labels */
    g.selectAll(".row-label")
      .data(VARS)
      .join("text")
      .attr("class", "row-label")
      .attr("x", -8)
      .attr("y", (_, i) => i * cell + cell / 2 + 4)
      .attr("text-anchor", "end")
      .attr("font-family", "DM Sans, sans-serif")
      .attr("font-size", Math.min(13, cell * 0.22))
      .attr("fill", "var(--text-dim)")
      .text((d) => d.label);

    /* Column labels — rotated -45°, text-anchor end so they finish at the cell centre */
    g.selectAll(".col-label")
      .data(VARS)
      .join("text")
      .attr("class", "col-label")
      .attr(
        "transform",
        (_, i) => `translate(${i * cell + cell / 2}, -14) rotate(-45)`
      )
      .attr("text-anchor", "start")
      .attr("font-family", "DM Sans, sans-serif")
      .attr("font-size", Math.min(13, cell * 0.22))
      .attr("fill", "var(--text-dim)")
      .text((d) => d.label);

    /* Colorbar — placed at very top, well above the column labels */
    _drawColorbar(svg, margin.left, 16, 220);
  }

  /* ── Colorbar ────────────────────────────────────────────── */
  function _drawColorbar(svg, x, y, w) {
    const defs = svg.append("defs");
    const grad = defs
      .append("linearGradient")
      .attr("id", "p5-cb-grad")
      .attr("x1", "0%").attr("x2", "100%");
    for (let k = 0; k <= 10; k++) {
      grad.append("stop")
        .attr("offset", k * 10 + "%")
        .attr("stop-color", colorScale(-1 + k * 0.2));
    }
    const lg = svg.append("g").attr("transform", `translate(${x},${y})`);
    lg.append("rect")
      .attr("width", w).attr("height", 12)
      .attr("rx", 3).attr("fill", "url(#p5-cb-grad)");
    lg.append("text")
      .attr("x", 0).attr("y", 26)
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("font-size", 9).attr("fill", "var(--accent3)").text("−1.0 (negative)");
    lg.append("text")
      .attr("x", w / 2).attr("y", 26)
      .attr("text-anchor", "middle")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("font-size", 9).attr("fill", "var(--text-dim)").text("0");
    lg.append("text")
      .attr("x", w).attr("y", 26)
      .attr("text-anchor", "end")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("font-size", 9).attr("fill", "var(--accent2)").text("+1.0 (positive)");
    lg.append("text")
      .attr("x", w + 10).attr("y", 10)
      .attr("font-family", "DM Sans, sans-serif")
      .attr("font-size", 10).attr("fill", "var(--text-dim)").text("Pearson r");
  }

  /* ── Findings summary ────────────────────────────────────── */
  function _renderFindings(matrix) {
    const lifeKey = "Life_expectancy";
    const pairs   = matrix
      .filter((d) => d.vi.key === lifeKey && d.vj.key !== lifeKey)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    const top3Pos = pairs.filter((d) => d.r > 0).slice(0, 3);
    const top3Neg = pairs.filter((d) => d.r < 0).slice(0, 3);

    document.getElementById("p5-findings").innerHTML = `
      <strong style="color:var(--text)">Strongest positive correlations with Life Expectancy:</strong><br>
      ${top3Pos.map((d) => `<span class="corr-pos">${d.vj.label} (r = ${d.r.toFixed(2)})</span>`).join("  ·  ")}
      <br><br>
      <strong style="color:var(--text)">Strongest negative correlations:</strong><br>
      ${top3Neg.map((d) => `<span class="corr-neg">${d.vj.label} (r = ${d.r.toFixed(2)})</span>`).join("  ·  ")}
      <br><br>
      These patterns confirm that economic development (GDP), access to education (schooling), and 
      vaccination coverage are among the strongest positive predictors of longevity across the 
      2000–2015 period. Infant mortality and adult mortality rates represent the most powerful 
      inverse relationships — both as downstream outcomes and as proxies for systemic healthcare quality.
    `;
  }

  /* ── Correlation strength label ──────────────────────────── */
  function _strength(r) {
    const a = Math.abs(r);
    if (a > 0.8) return "Very Strong";
    if (a > 0.6) return "Strong";
    if (a > 0.4) return "Moderate";
    if (a > 0.2) return "Weak";
    return "Negligible";
  }
})();