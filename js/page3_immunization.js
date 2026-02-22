/**
 * page3_immunization.js  —  Member C
 * ─────────────────────────────────────────────────────────
 * Scatter plot: immunization coverage (X) vs infant deaths (Y)
 * Bubble size = population, color = region.
 *
 * Features:
 *   • Vaccine type dropdown (Hepatitis B, Polio, Diphtheria, Measles)
 *   • Year slider with smooth D3 transitions (enter/update/exit)
 *   • Region legend with click-to-highlight
 *   • Tooltip: country, region, vaccine %, infant deaths, population
 * ─────────────────────────────────────────────────────────
 */

"use strict";

(function () {
  /* ── State ─────────────────────────────────────────────── */
  let currentYear    = 2015;
  let currentVaccine = "Hepatitis_B";
  let highlightRegion = null;   // null = all visible

  const VACCINE_LABELS = {
    Hepatitis_B:  "Hepatitis B Coverage (%)",
    Polio:        "Polio Coverage (%)",
    Diphtheria:   "Diphtheria Coverage (%)",
    Measles:      "Measles Coverage (%)",
  };

  /* ── Layout ─────────────────────────────────────────────── */
  const MARGIN = { top: 24, right: 40, bottom: 62, left: 72 };
  let W, H, iW, iH;
  let svg, g;
  let xScale, yScale, rScale;

  /* ── Public init ─────────────────────────────────────────── */
  window.initPage3 = function initPage3() {
    /* Controls */
    d3.select("#p3-vaccine").on("change", function () {
      currentVaccine = this.value;
      _updateChart(true); // animate axis
    });
    d3.select("#p3-year-slider").on("input", function () {
      currentYear = +this.value;
      d3.select("#p3-year-display").text(this.value);
      _updateChart(false);
    });

    /* Region legend with click highlight */
    window.buildRegionLegend("p3-legend", _onLegendClick);

    /* Build SVG scaffold */
    _initSVG();
    _updateChart(false);
  };

  /* ── Legend click handler ────────────────────────────────── */
  function _onLegendClick(region, itemEl) {
    if (highlightRegion === region) {
      highlightRegion = null;
      document.querySelectorAll("#p3-legend .legend-item").forEach((el) =>
        el.classList.remove("dimmed")
      );
    } else {
      highlightRegion = region;
      document.querySelectorAll("#p3-legend .legend-item").forEach((el) => {
        el.classList.toggle("dimmed", el.dataset.region !== region);
      });
    }
    _applyHighlight();
  }

  function _applyHighlight() {
    g.selectAll(".bubble")
      .transition().duration(300)
      .attr("opacity", (d) => {
        if (!highlightRegion) return 0.72;
        return d.Region === highlightRegion ? 0.9 : 0.1;
      });
  }

  /* ── SVG scaffold (created once) ────────────────────────── */
  function _initSVG() {
    const svgEl = document.getElementById("p3-svg");
    W  = svgEl.clientWidth  || 960;
    H  = 500;
    iW = W - MARGIN.left - MARGIN.right;
    iH = H - MARGIN.top  - MARGIN.bottom;

    svg = d3.select("#p3-svg").attr("viewBox", `0 0 ${W} ${H}`);
    g   = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    /* Scales */
    xScale = d3.scaleLinear().domain([0, 100]).range([0, iW]);
    yScale = d3
      .scaleLinear()
      .domain([0, d3.max(window.allData, (d) => d.Infant_deaths) * 1.1])
      .range([iH, 0])
      .nice();
    rScale = d3
      .scaleSqrt()
      .domain([0, d3.max(window.allData, (d) => d.Population_mln)])
      .range([3, 32]);

    /* Gridline groups */
    g.append("g").attr("class", "p3-xgrid");
    g.append("g").attr("class", "p3-ygrid");

    /* Axis groups */
    g.append("g").attr("class", "axis p3-xaxis")
      .attr("transform", `translate(0,${iH})`);
    g.append("g").attr("class", "axis p3-yaxis");

    /* Axis labels */
    g.append("text").attr("class", "axis-label p3-xlabel")
      .attr("x", iW / 2).attr("y", iH + 50)
      .attr("text-anchor", "middle");

    g.append("text").attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -iH / 2).attr("y", -56)
      .attr("text-anchor", "middle")
      .text("Infant Deaths per 1,000 Births");

    /* Bubble group (behind nothing, raise on hover handled inline) */
    g.append("g").attr("class", "p3-bubbles");
  }

  /* ── Update / animate ────────────────────────────────────── */
  function _updateChart(animateAxis) {
    const yd = window.allData.filter(
      (d) => d.Year === currentYear && d[currentVaccine] > 0 && d.Infant_deaths > 0
    );

    const dur = animateAxis ? 700 : 500;

    /* Update x scale for current vaccine (keep 0–100 for %) */
    const xMax = d3.max(yd, (d) => d[currentVaccine]);
    xScale.domain([0, Math.max(100, xMax)]);

    /* Gridlines */
    g.select(".p3-xgrid")
      .transition().duration(dur)
      .call(d3.axisBottom(xScale).ticks(6).tickSize(-iH).tickFormat(""))
      .call((axis) => {
        axis.selectAll("line").attr("class", "gridline");
        axis.select(".domain").remove();
      });

    g.select(".p3-ygrid")
      .transition().duration(dur)
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-iW).tickFormat(""))
      .call((axis) => {
        axis.selectAll("line").attr("class", "gridline");
        axis.select(".domain").remove();
      });

    /* Axes */
    g.select(".p3-xaxis").transition().duration(dur)
      .call(d3.axisBottom(xScale).ticks(6));
    g.select(".p3-yaxis").transition().duration(dur)
      .call(d3.axisLeft(yScale).ticks(6));

    /* X label */
    g.select(".p3-xlabel").text(VACCINE_LABELS[currentVaccine]);

    /* ── Enter / Update / Exit ──────────────────────────────── */
    const bubbles = g
      .select(".p3-bubbles")
      .selectAll(".bubble")
      .data(yd, (d) => d.Country + d.Year);

    /* ENTER */
    const enter = bubbles
      .enter()
      .append("circle")
      .attr("class", "bubble")
      .attr("cx", (d) => xScale(d[currentVaccine]))
      .attr("cy", (d) => yScale(d.Infant_deaths))
      .attr("r", 0)
      .attr("fill", (d) => window.REGION_COLORS[d.Region] || "#888")
      .attr("opacity", 0)
      .attr("stroke", "rgba(0,0,0,0.2)")
      .attr("stroke-width", 0.8)
      .on("mouseover", _onBubbleOver)
      .on("mousemove",  window.moveTooltip)
      .on("mouseout",   _onBubbleOut);

    /* UPDATE (merge enter + existing) */
    enter
      .merge(bubbles)
      .transition()
      .duration(dur)
      .attr("cx", (d) => xScale(d[currentVaccine]))
      .attr("cy", (d) => yScale(d.Infant_deaths))
      .attr("r",  (d) => rScale(d.Population_mln))
      .attr("fill", (d) => window.REGION_COLORS[d.Region] || "#888")
      .attr("opacity", (d) =>
        !highlightRegion
          ? 0.72
          : d.Region === highlightRegion ? 0.9 : 0.1
      );

    /* EXIT */
    bubbles.exit()
      .transition().duration(300)
      .attr("r", 0).attr("opacity", 0)
      .remove();
  }

  /* ── Hover handlers ──────────────────────────────────────── */
  function _onBubbleOver(event, d) {
    d3.select(this)
      .raise()
      .transition().duration(120)
      .attr("opacity", 1)
      .attr("stroke", "white")
      .attr("stroke-width", 1.5);

    window.showTooltip(
      `<div class="tt-country">${d.Country}</div>
       <div class="tt-region">${window.REGION_SHORT[d.Region] || d.Region} · ${currentYear}</div>
       <hr class="tt-divider">
       <div class="tt-row"><span class="tt-label">${VACCINE_LABELS[currentVaccine]}</span><span class="tt-value">${window.fmt(d[currentVaccine])}%</span></div>
       <div class="tt-row"><span class="tt-label">Infant Deaths</span><span class="tt-value">${window.fmt(d.Infant_deaths)}/1k</span></div>
       <div class="tt-row"><span class="tt-label">Population</span><span class="tt-value">${window.fmt(d.Population_mln, 2)}M</span></div>`,
      event
    );
  }

  function _onBubbleOut(event, d) {
    d3.select(this)
      .transition().duration(150)
      .attr("opacity", !highlightRegion ? 0.72 : d.Region === highlightRegion ? 0.9 : 0.1)
      .attr("stroke", "rgba(0,0,0,0.2)")
      .attr("stroke-width", 0.8);
    window.hideTooltip();
  }
})();
