/**
 * page2_trends.js  —  Member B
 * ─────────────────────────────────────────────────────────
 * Small-multiple line charts for three mortality indicators,
 * with a region filter and an interactive focus-line tooltip.
 *
 * Metrics shown:
 *   1. Infant deaths       (per 1,000 live births)
 *   2. Under-five deaths   (per 1,000 live births)
 *   3. Adult mortality     (per 1,000 adults)
 *
 * Interactions:
 *   • Region dropdown → re-aggregates + redraws
 *   • Hover focus line → tooltip (value + % change from 2000)
 * ─────────────────────────────────────────────────────────
 */

"use strict";

(function () {
  /* ── Metric definitions ──────────────────────────────────── */
  const METRICS = [
    { key: "Infant_deaths",     label: "Infant Deaths",     unit: "per 1,000 births", color: "#e84545" },
    { key: "Under_five_deaths", label: "Under-Five Deaths", unit: "per 1,000 births", color: "#f0a030" },
    { key: "Adult_mortality",   label: "Adult Mortality",   unit: "per 1,000 adults", color: "#6080f0" },
  ];

  const MARGIN = { top: 16, right: 80, bottom: 38, left: 68 };
  const CHART_H = 170; // height of each small-multiple SVG

  let currentRegion = "All";

  /* ── Public init ─────────────────────────────────────────── */
  window.initPage2 = function initPage2() {
    /* Populate region dropdown */
    const sel = document.getElementById("p2-region");
    window.REGIONS.forEach((r) => {
      const o = document.createElement("option");
      o.value = r;
      o.textContent = window.REGION_SHORT[r] || r;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      currentRegion = this.value;
      _drawAll();
    });

    /* Build chart DOM skeletons */
    _buildSkeletons();
    _drawAll();
  };

  /* ── Build container divs once ───────────────────────────── */
  function _buildSkeletons() {
    const container = document.getElementById("p2-charts");
    container.innerHTML = "";
    METRICS.forEach((m) => {
      const div = document.createElement("div");
      div.className = "sm-chart";
      div.innerHTML = `
        <div class="sm-chart-label">
          <span class="metric-name">${m.label}</span>
          <span>${m.unit}</span>
        </div>
        <svg id="sm-${m.key}" style="width:100%;height:${CHART_H}px;display:block;"></svg>`;
      container.appendChild(div);
    });
  }

  /* ── Aggregate data for a year + region ─────────────────── */
  function _regionYearMean(region, year, key) {
    let rows = window.allData.filter((d) => d.Year === year);
    if (region !== "All") rows = rows.filter((d) => d.Region === region);
    return d3.mean(rows, (d) => d[key]);
  }

  function _getLineData(metric) {
    return window.YEARS.map((y) => ({
      year:  y,
      value: _regionYearMean(currentRegion, y, metric),
    })).filter((d) => d.value != null && !isNaN(d.value));
  }

  /* ── Draw / redraw all charts ─────────────────────────────── */
  function _drawAll() {
    METRICS.forEach(_drawChart);
  }

  function _drawChart(m) {
    const svgEl = document.getElementById("sm-" + m.key);
    if (!svgEl) return;

    const W  = svgEl.clientWidth  || 900;
    const H  = CHART_H;
    const iW = W - MARGIN.left - MARGIN.right;
    const iH = H - MARGIN.top - MARGIN.bottom;

    const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`);
    svg.selectAll("*").remove();

    const lineData = _getLineData(m.key);
    if (!lineData.length) return;

    /* ── Scales ─────────────────────────────────────────────── */
    const xScale = d3.scaleLinear().domain([2000, 2015]).range([0, iW]);
    const yMax   = d3.max(lineData, (d) => d.value) * 1.12;
    const yScale = d3.scaleLinear().domain([0, yMax]).range([iH, 0]).nice();

    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    /* ── Gridlines ──────────────────────────────────────────── */
    g.append("g")
      .selectAll("line")
      .data(yScale.ticks(4))
      .join("line")
      .attr("class", "gridline")
      .attr("x1", 0).attr("x2", iW)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d));

    /* ── Area fill ──────────────────────────────────────────── */
    const area = d3.area()
      .x((d) => xScale(d.year))
      .y0(iH)
      .y1((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(lineData)
      .attr("fill", m.color)
      .attr("opacity", 0.07)
      .attr("d", area);

    /* ── Line ───────────────────────────────────────────────── */
    const line = d3.line()
      .x((d) => xScale(d.year))
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(lineData)
      .attr("fill", "none")
      .attr("stroke", m.color)
      .attr("stroke-width", 2.2)
      .attr("d", line);

    /* ── Dots at each year ──────────────────────────────────── */
    g.selectAll(".dot")
      .data(lineData)
      .join("circle")
      .attr("class", "dot")
      .attr("cx", (d) => xScale(d.year))
      .attr("cy", (d) => yScale(d.value))
      .attr("r", 2.5)
      .attr("fill", m.color)
      .attr("opacity", 0.6);

    /* ── Axes ───────────────────────────────────────────────── */
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.format("d")));

    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(yScale).ticks(4).tickFormat(d3.format(".0f")));

    /* ── % change annotation ────────────────────────────────── */
    const first = lineData[0].value;
    const last  = lineData[lineData.length - 1].value;
    const pct   = ((last - first) / first * 100).toFixed(1);
    const sign  = pct < 0 ? "" : "+";
    const pctColor = pct < 0 ? "#40d0a0" : "#e84545";

    g.append("text")
      .attr("x", iW + 6)
      .attr("y", yScale(last) + 4)
      .attr("fill", pctColor)
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("font-size", 10)
      .text(`${sign}${pct}%`);

    /* end dot */
    g.append("circle")
      .attr("cx", xScale(2015))
      .attr("cy", yScale(last))
      .attr("r", 4)
      .attr("fill", m.color)
      .attr("stroke", "var(--surface)")
      .attr("stroke-width", 1.5);

    /* ── Focus-line interaction ─────────────────────────────── */
    const focusLine = g.append("line")
      .attr("class", "focus-line")
      .attr("y1", 0).attr("y2", iH)
      .style("display", "none");

    const focusDot = g.append("circle")
      .attr("r", 5)
      .attr("fill", m.color)
      .attr("stroke", "var(--surface)")
      .attr("stroke-width", 2)
      .style("display", "none");

    /* invisible overlay for mouse events */
    g.append("rect")
      .attr("width", iW).attr("height", iH)
      .attr("fill", "transparent")
      .on("mousemove", function (event) {
        const [mx] = d3.pointer(event);
        const year = Math.round(xScale.invert(mx));
        if (year < 2000 || year > 2015) {
          focusLine.style("display", "none");
          focusDot.style("display", "none");
          window.hideTooltip();
          return;
        }
        const pt = lineData.find((d) => d.year === year);
        if (!pt) return;

        const baseVal = lineData.find((d) => d.year === 2000)?.value;
        const pctChg  = baseVal ? ((pt.value - baseVal) / baseVal * 100).toFixed(1) : null;
        const cs      = pctChg < 0 ? "" : "+";

        focusLine
          .style("display", null)
          .attr("x1", xScale(year)).attr("x2", xScale(year));
        focusDot
          .style("display", null)
          .attr("cx", xScale(year)).attr("cy", yScale(pt.value));

        window.showTooltip(
          `<div class="tt-country">${m.label}</div>
           <div class="tt-region">${currentRegion === "All" ? "All Regions" : (window.REGION_SHORT[currentRegion] || currentRegion)} · ${year}</div>
           <hr class="tt-divider">
           <div class="tt-row"><span class="tt-label">Value</span><span class="tt-value">${window.fmt(pt.value)}</span></div>
           ${pctChg !== null ? `<div class="tt-row"><span class="tt-label">vs 2000</span><span class="tt-value" style="color:${+pctChg<0?'#40d0a0':'#e84545'}">${cs}${pctChg}%</span></div>` : ""}`,
          event
        );
      })
      .on("mouseleave", function () {
        focusLine.style("display", "none");
        focusDot.style("display", "none");
        window.hideTooltip();
      });
  }
})();
