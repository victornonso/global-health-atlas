/**
 * page3_immunization.js — Immunization vs Infant Mortality (Bubble Chart)
 *
 * Scatter-bubble chart: vaccine coverage (x) vs infant deaths (y),
 * bubble size proportional to population.
 *
 * Controls:  Vaccine selector  ·  Year slider  ·  Play / Pause
 * Highlight: Click a region in the legend to dim all others.
 */

"use strict";

(function () {

  let currentYear     = 2015;
  let currentVaccine  = "Hepatitis_B";
  let highlightRegion = null;
  let playing         = false;
  let playTimer       = null;

  /** Display labels for each selectable vaccine field. */
  const VACCINE_LABELS = {
    Hepatitis_B: "Hepatitis B Coverage (%)",
    Polio:       "Polio Coverage (%)",
    Diphtheria:  "Diphtheria Coverage (%)",
    Measles:     "Measles Coverage (%)",
  };

  const MARGIN = { top: 24, right: 40, bottom: 62, left: 72 };
  let W, H, iW, iH;
  let svg, g;
  let xScale, yScale, rScale;

  window.initPage3 = function () {
    d3.select("#p3-vaccine").on("change", function () {
      currentVaccine = this.value;
      _updateChart(true);
    });

    d3.select("#p3-year-slider").on("input", function () {
      currentYear = +this.value;
      d3.select("#p3-year-display").text(this.value);
      _updateChart(false);
    });

    _injectPlayControls();
    window.buildRegionLegend("p3-legend", _onLegendClick);
    _initSVG();
    _updateChart(false);
  };

  /* ── Play / Pause ─────────────────────────────────────────────────── */

  /** Inject Play / Pause buttons into the controls bar at runtime. */
  function _injectPlayControls() {
    const ctrlDiv = document.querySelector("#page-3 .controls");
    if (!ctrlDiv || document.getElementById("p3-play-btn")) return;

    const wrap = document.createElement("span");
    wrap.style.cssText = "display:inline-flex;align-items:center;gap:8px;margin-left:12px;";
    wrap.innerHTML =
      '<button id="p3-play-btn"  class="btn" style="min-width:80px;">&#9654; Play</button>' +
      '<button id="p3-pause-btn" class="btn" style="min-width:80px;opacity:0.5;" disabled>' +
        '&#9646;&#9646; Pause</button>';
    ctrlDiv.appendChild(wrap);

    document.getElementById("p3-play-btn").addEventListener("click",  _play);
    document.getElementById("p3-pause-btn").addEventListener("click", _pause);
  }

  function _play() {
    if (playing) return;
    /* Restart from 2000 if already at the end */
    if (currentYear >= 2015) {
      currentYear = 2000;
      d3.select("#p3-year-slider").property("value", 2000);
      d3.select("#p3-year-display").text("2000");
      _updateChart(false);
    }
    playing = true;
    document.getElementById("p3-play-btn").disabled  = true;
    document.getElementById("p3-pause-btn").disabled = false;
    document.getElementById("p3-pause-btn").style.opacity = "1";

    playTimer = d3.interval(function () {
      if (currentYear >= 2015) { _pause(); return; }
      currentYear++;
      d3.select("#p3-year-slider").property("value", currentYear);
      d3.select("#p3-year-display").text(currentYear);
      _updateChart(false);
    }, 1200);
  }

  function _pause() {
    playing = false;
    if (playTimer) { playTimer.stop(); playTimer = null; }
    const pb = document.getElementById("p3-play-btn");
    const ub = document.getElementById("p3-pause-btn");
    if (pb) pb.disabled = false;
    if (ub) { ub.disabled = true; ub.style.opacity = "0.5"; }
  }

  /* ── Legend interaction ───────────────────────────────────────────── */

  /** Toggle region highlight; clicking the same region again clears it. */
  function _onLegendClick(region) {
    if (highlightRegion === region) {
      highlightRegion = null;
      document.querySelectorAll("#p3-legend .legend-item").forEach(function (el) {
        el.classList.remove("dimmed");
      });
    } else {
      highlightRegion = region;
      document.querySelectorAll("#p3-legend .legend-item").forEach(function (el) {
        el.classList.toggle("dimmed", el.dataset.region !== region);
      });
    }
    _applyHighlight();
  }

  /** Apply opacity based on the current highlightRegion state. */
  function _applyHighlight() {
    g.selectAll(".bubble").transition().duration(300)
      .attr("opacity", function (d) {
        if (!highlightRegion) return 0.72;
        return d.Region === highlightRegion ? 0.9 : 0.1;
      });
  }

  /* ── SVG scaffold ─────────────────────────────────────────────────── */

  function _initSVG() {
    const svgEl = document.getElementById("p3-svg");
    W  = svgEl.clientWidth || 960;
    H  = 500;
    iW = W - MARGIN.left - MARGIN.right;
    iH = H - MARGIN.top  - MARGIN.bottom;

    svg = d3.select("#p3-svg").attr("viewBox", "0 0 " + W + " " + H);
    g   = svg.append("g").attr("transform", "translate(" + MARGIN.left + "," + MARGIN.top + ")");

    xScale = d3.scaleLinear().domain([0, 120]).range([0, iW]);
    yScale = d3.scaleLinear().domain([0, 140]).range([iH, 0]);

    /* sqrt scale so bubble area (not radius) is proportional to population */
    rScale = d3.scaleSqrt()
      .domain([0, d3.max(window.allData, function (d) { return d.Population_mln; })])
      .range([3, 32]);

    g.append("g").attr("class", "p3-xgrid");
    g.append("g").attr("class", "p3-ygrid");
    g.append("g").attr("class", "axis p3-xaxis").attr("transform", "translate(0," + iH + ")");
    g.append("g").attr("class", "axis p3-yaxis");

    g.append("text").attr("class", "axis-label p3-xlabel")
      .attr("x", iW / 2).attr("y", iH + 50).attr("text-anchor", "middle");
    g.append("text").attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -iH / 2).attr("y", -56)
      .attr("text-anchor", "middle")
      .text("Infant Deaths per 1,000 Births");

    g.append("g").attr("class", "p3-bubbles");
  }

  /* ── Chart update ─────────────────────────────────────────────────── */

  function _updateChart(animateAxis) {
    const yd = window.allData.filter(function (d) {
      return d.Year === currentYear && d[currentVaccine] > 0 && d.Infant_deaths > 0;
    });

    const dur  = animateAxis ? 700 : 500;
    /* Fixed domains — keeps axes stable across years and vaccines */
    xScale.domain([0, 120]);

    const xTickValues = d3.range(0, 121, 20);   // 0, 25, 50, 75
    const yTickValues = d3.range(0, 141, 10);   // 0, 10, 20 … 120

    g.select(".p3-xgrid").transition().duration(dur)
      .call(d3.axisBottom(xScale).tickValues(xTickValues).tickSize(-iH).tickFormat(""))
      .call(function (a) { a.selectAll("line").attr("class", "gridline"); a.select(".domain").remove(); });

    g.select(".p3-ygrid").transition().duration(dur)
      .call(d3.axisLeft(yScale).tickValues(yTickValues).tickSize(-iW).tickFormat(""))
      .call(function (a) { a.selectAll("line").attr("class", "gridline"); a.select(".domain").remove(); });

    g.select(".p3-xaxis").transition().duration(dur).call(d3.axisBottom(xScale).tickValues(xTickValues));
    g.select(".p3-yaxis").transition().duration(dur).call(d3.axisLeft(yScale).tickValues(yTickValues));
    g.select(".p3-xlabel").text(VACCINE_LABELS[currentVaccine]);

    /* Key by Country+Year so bubbles animate position rather than re-enter */
    const bubbles = g.select(".p3-bubbles").selectAll(".bubble")
      .data(yd, function (d) { return d.Country + d.Year; });

    bubbles.enter()
      .append("circle")
      .attr("class",        "bubble")
      .attr("cx",           function (d) { return xScale(d[currentVaccine]); })
      .attr("cy",           function (d) { return yScale(d.Infant_deaths); })
      .attr("r",            0)
      .attr("fill",         function (d) { return window.REGION_COLORS[d.Region] || "#888"; })
      .attr("opacity",      0)
      .attr("stroke",       "rgba(0,0,0,0.2)")
      .attr("stroke-width", 0.8)
      .on("mouseover", _onBubbleOver)
      .on("mousemove",  window.moveTooltip)
      .on("mouseout",   _onBubbleOut)
      .merge(bubbles)
      .transition().duration(dur)
      .attr("cx",      function (d) { return xScale(d[currentVaccine]); })
      .attr("cy",      function (d) { return yScale(d.Infant_deaths); })
      .attr("r",       function (d) { return rScale(d.Population_mln); })
      .attr("fill",    function (d) { return window.REGION_COLORS[d.Region] || "#888"; })
      .attr("opacity", function (d) {
        return !highlightRegion ? 0.72 : (d.Region === highlightRegion ? 0.9 : 0.1);
      });

    bubbles.exit().transition().duration(300).attr("r", 0).attr("opacity", 0).remove();
  }

  /* ── Tooltip handlers ─────────────────────────────────────────────── */

  function _onBubbleOver(event, d) {
    d3.select(this).raise().transition().duration(120)
      .attr("opacity", 1).attr("stroke", "white").attr("stroke-width", 1.5);
    window.showTooltip(
      '<div class="tt-country">' + d.Country + "</div>" +
      '<div class="tt-region">' + (window.REGION_SHORT[d.Region] || d.Region) +
        " \xB7 " + currentYear + "</div>" +
      '<hr class="tt-divider">' +
      '<div class="tt-row"><span class="tt-label">' + VACCINE_LABELS[currentVaccine] + "</span>" +
        '<span class="tt-value">' + window.fmt(d[currentVaccine]) + "%</span></div>" +
      '<div class="tt-row"><span class="tt-label">Infant Deaths</span>' +
        '<span class="tt-value">' + window.fmt(d.Infant_deaths) + "/1k</span></div>" +
      '<div class="tt-row"><span class="tt-label">Population</span>' +
        '<span class="tt-value">' + window.fmt(d.Population_mln, 2) + "M</span></div>",
      event
    );
  }

  function _onBubbleOut(event, d) {
    d3.select(this).transition().duration(150)
      .attr("opacity", !highlightRegion ? 0.72 : (d.Region === highlightRegion ? 0.9 : 0.1))
      .attr("stroke", "rgba(0,0,0,0.2)")
      .attr("stroke-width", 0.8);
    window.hideTooltip();
  }

}());
