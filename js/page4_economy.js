/**
 * page4_economy.js — Alcohol Consumption Racing Bar Chart
 *
 * Animates the top-10 countries by alcohol consumption across
 * 2000–2015. Bar width = alcohol consumption; inline label = life
 * expectancy. Bar color indicates development status.
 *
 * Controls:  Status filter (All / Developed / Developing)  ·  Play / Pause
 *
 * Color encoding:
 *   Blue  (#50b0f0) — Economy_status_Developed === 1
 *   Amber (#f0a030) — Economy_status_Developing === 1
 */

"use strict";

(function () {

  let currentYear  = 2000;
  let statusFilter = "All";
  let playing      = false;
  let playTimer    = null;

  const MARGIN     = { top: 24, right: 200, bottom: 40, left: 160 };
  const BAR_COUNT  = 10;
  const BAR_HEIGHT = 36;
  const BAR_PAD    = 6;

  let W, H, iW, iH;
  let svg, g, xScale, yScale;

  /* ── Color ────────────────────────────────────────────────────────── */

  /** Resolve bar color from the binary development-status columns. */
  function _statusColor(d) {
    if (d.developed  === 1) return "#50b0f0";
    if (d.developing === 1) return "#f0a030";
    return "#888";
  }

  /* ── Public init ──────────────────────────────────────────────────── */

  window.initPage4 = function () {
    _buildHTML();
    _initSVG();
    _updateChart(false);
  };

  /** Called by main.js when navigating away from page 4. */
  window.p4TogglePlay = function () {
    if (playing) _pause(); else _play();
  };

  /* ── HTML ─────────────────────────────────────────────────────────── */

  function _buildHTML() {
    const page4 = document.getElementById("page-4");
    if (!page4) return;

    const sub = page4.querySelector(".page-subtitle");
    if (sub) {
      sub.textContent =
        "Top 10 countries by alcohol consumption race through 2000\u20132015. " +
        "Bars show alcohol use; labels show life expectancy.";
    }

    const ctrl = page4.querySelector(".controls");
    if (ctrl) {
      ctrl.innerHTML =
        '<span class="ctrl-label">Status</span>' +
        '<select id="p4-status-filter">' +
          '<option value="All">All Countries</option>' +
          '<option value="Developed">Developed</option>' +
          '<option value="Developing">Developing</option>' +
        "</select>" +
        '<div class="ctrl-divider"></div>' +
        '<button class="btn" id="p4-play-btn"  style="min-width:90px;">&#9654; Play</button>' +
        '<button class="btn" id="p4-pause-btn" style="min-width:90px;opacity:0.5;" disabled>' +
          "&#9646;&#9646; Pause</button>" +
        '<span class="year-display" id="p4-year-display" style="margin-left:12px;">2000</span>';

      /* Changing the filter restarts the animation from 2000 */
      document.getElementById("p4-status-filter").addEventListener("change", function () {
        statusFilter = this.value;
        _pause();
        currentYear = 2000;
        document.getElementById("p4-year-display").textContent = "2000";
        _updateChart(false);
        _play();
      });

      document.getElementById("p4-play-btn").addEventListener("click",  function () {
        if (playing) _pause(); else _play();
      });
      document.getElementById("p4-pause-btn").addEventListener("click", _pause);
    }

    /* Development-status color legend */
    const leg = document.getElementById("p4-legend");
    if (leg) {
      leg.innerHTML =
        '<div style="display:flex;gap:20px;flex-wrap:wrap;">' +
          '<span style="display:flex;align-items:center;gap:6px;font-family:DM Sans,sans-serif;' +
            'font-size:12px;color:var(--text-dim)">' +
            '<span style="width:12px;height:12px;border-radius:2px;background:#50b0f0;' +
              'display:inline-block;"></span>Developed</span>' +
          '<span style="display:flex;align-items:center;gap:6px;font-family:DM Sans,sans-serif;' +
            'font-size:12px;color:var(--text-dim)">' +
            '<span style="width:12px;height:12px;border-radius:2px;background:#f0a030;' +
              'display:inline-block;"></span>Developing</span>' +
        "</div>";
    }
  }

  /* ── Play / Pause ─────────────────────────────────────────────────── */

  function _play() {
    if (playing) return;
    if (currentYear >= 2015) {
      currentYear = 2000;
      document.getElementById("p4-year-display").textContent = "2000";
      _updateChart(false);
    }
    playing = true;
    const pb = document.getElementById("p4-play-btn");
    const ub = document.getElementById("p4-pause-btn");
    if (pb) { pb.disabled = true;  pb.classList.add("playing"); }
    if (ub) { ub.disabled = false; ub.style.opacity = "1"; }

    playTimer = d3.interval(function () {
      if (currentYear >= 2015) { _pause(); return; }
      currentYear++;
      document.getElementById("p4-year-display").textContent = currentYear;
      _updateChart(true);
    }, 1200);
  }

  function _pause() {
    playing = false;
    if (playTimer) { playTimer.stop(); playTimer = null; }
    const pb = document.getElementById("p4-play-btn");
    const ub = document.getElementById("p4-pause-btn");
    if (pb) { pb.disabled = false; pb.classList.remove("playing"); }
    if (ub) { ub.disabled = true;  ub.style.opacity = "0.5"; }
  }

  /* ── SVG scaffold ─────────────────────────────────────────────────── */

  function _initSVG() {
    const svgEl = document.getElementById("p4-svg");
    W  = svgEl.clientWidth || 960;
    H  = (BAR_HEIGHT + BAR_PAD) * BAR_COUNT + MARGIN.top + MARGIN.bottom + 20;
    iW = W - MARGIN.left - MARGIN.right;
    iH = H - MARGIN.top  - MARGIN.bottom;

    svg = d3.select("#p4-svg")
      .attr("viewBox", "0 0 " + W + " " + H)
      .attr("height", H);

    g = svg.append("g").attr("transform", "translate(" + MARGIN.left + "," + MARGIN.top + ")");

    g.append("g").attr("class", "p4-xaxis").attr("transform", "translate(0," + iH + ")");
    g.append("g").attr("class", "p4-xgrid");
    g.append("text").attr("class", "axis-label")
      .attr("x", iW / 2).attr("y", iH + 34)
      .attr("text-anchor", "middle")
      .attr("font-family", "DM Sans, sans-serif")
      .attr("font-size", 12).attr("fill", "var(--text-dim)")
      .text("Alcohol Consumption (litres per capita)");

    const maxAlcohol = d3.max(window.allData, function (d) { return d.Alcohol_consumption; }) || 20;
    xScale = d3.scaleLinear().domain([0, maxAlcohol * 1.1]).range([0, iW]).nice();
    yScale = d3.scaleBand()
      .domain(d3.range(BAR_COUNT).map(String))
      .range([0, iH])
      .padding(0.15);
  }

  /* ── Data ─────────────────────────────────────────────────────────── */

  /** Returns the top BAR_COUNT countries for the current year + status filter. */
  function _getTopData() {
    let rows = window.allData.filter(function (d) {
      return d.Year === currentYear && d.Alcohol_consumption > 0;
    });
    if (statusFilter !== "All") {
      const col = statusFilter === "Developed"
        ? "Economy_status_Developed"
        : "Economy_status_Developing";
      rows = rows.filter(function (d) { return d[col] === 1; });
    }
    rows.sort(function (a, b) { return b.Alcohol_consumption - a.Alcohol_consumption; });
    return rows.slice(0, BAR_COUNT).map(function (d, i) {
      return {
        rank:       i,
        country:    d.Country,
        alcohol:    d.Alcohol_consumption,
        lifeExp:    d.Life_expectancy,
        developed:  d.Economy_status_Developed,
        developing: d.Economy_status_Developing,
      };
    });
  }

  /* ── Chart update ─────────────────────────────────────────────────── */

  /**
   * Renders or updates all bars, country labels, alcohol value labels,
   * and life-expectancy labels. Uses d3 key-by-country so entering
   * elements animate from the correct initial position.
   */
  function _updateChart(animate) {
    const topData = _getTopData();
    const dur     = animate ? 1000 : 0;

    const xMax = d3.max(topData, function (d) { return d.alcohol; }) || 20;
    xScale.domain([0, xMax * 1.15]).nice();

    g.select(".p4-xaxis").transition().duration(dur)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format(".1f")));

    g.select(".p4-xgrid").transition().duration(dur)
      .call(d3.axisBottom(xScale).ticks(6).tickSize(-iH).tickFormat(""))
      .call(function (a) { a.selectAll("line").attr("class", "gridline"); a.select(".domain").remove(); });

    function key(d) { return d.country; }

    /* ── Bars ── */
    const bars = g.selectAll(".p4-bar").data(topData, key);

    bars.enter().append("rect").attr("class", "p4-bar")
      .attr("x", 0).attr("y",      function (d) { return yScale(String(d.rank)); })
      .attr("height", yScale.bandwidth()).attr("width", 0)
      .attr("rx", 3).attr("fill", function (d) { return _statusColor(d); })
      .merge(bars).transition().duration(dur).ease(d3.easeLinear)
      .attr("y",      function (d) { return yScale(String(d.rank)); })
      .attr("height", yScale.bandwidth())
      .attr("width",  function (d) { return xScale(d.alcohol); })
      .attr("fill",   function (d) { return _statusColor(d); });

    bars.exit().transition().duration(dur / 2).attr("width", 0).attr("opacity", 0).remove();

    /* ── Country labels (left of bar) ── */
    const countryLabels = g.selectAll(".p4-country-label").data(topData, key);

    countryLabels.enter().append("text").attr("class", "p4-country-label")
      .attr("x", -8).attr("text-anchor", "end")
      .attr("font-family", "DM Sans, sans-serif").attr("font-size", 12)
      .attr("fill", "var(--text-dim)")
      .attr("y", function (d) { return yScale(String(d.rank)) + yScale.bandwidth() / 2 + 4; })
      .attr("opacity", 0)
      .merge(countryLabels).transition().duration(dur).ease(d3.easeLinear)
      .attr("y",      function (d) { return yScale(String(d.rank)) + yScale.bandwidth() / 2 + 4; })
      .attr("opacity", 1)
      .text(function (d) { return d.country; });

    countryLabels.exit().transition().duration(dur / 2).attr("opacity", 0).remove();

    /* ── Alcohol value labels (right of bar) ── */
    const alcLabels = g.selectAll(".p4-alc-label").data(topData, key);

    alcLabels.enter().append("text").attr("class", "p4-alc-label")
      .attr("text-anchor", "start")
      .attr("font-family", "JetBrains Mono, monospace").attr("font-size", 10)
      .attr("fill", "rgba(255,255,255,0.65)")
      .attr("y", function (d) { return yScale(String(d.rank)) + yScale.bandwidth() / 2 + 4; })
      .attr("x", function (d) { return xScale(d.alcohol) + 6; })
      .attr("opacity", 0)
      .merge(alcLabels).transition().duration(dur).ease(d3.easeLinear)
      .attr("y", function (d) { return yScale(String(d.rank)) + yScale.bandwidth() / 2 + 4; })
      .attr("x", function (d) { return xScale(d.alcohol) + 6; })
      .attr("opacity", 1)
      .text(function (d) { return d3.format(".1f")(d.alcohol) + "L"; });

    alcLabels.exit().transition().duration(dur / 2).attr("opacity", 0).remove();

    /* ── Life expectancy labels (inside bar, right-aligned) ── */
    const leLabels = g.selectAll(".p4-le-label").data(topData, key);

    leLabels.enter().append("text").attr("class", "p4-le-label")
      .attr("text-anchor", "end")
      .attr("font-family", "DM Sans, sans-serif").attr("font-size", 11).attr("font-weight", "600")
      .attr("fill", "rgba(0,0,0,0.7)").attr("pointer-events", "none")
      .attr("y", function (d) { return yScale(String(d.rank)) + yScale.bandwidth() / 2 + 4; })
      .attr("x", function (d) { return Math.max(xScale(d.alcohol) - 8, 50); })
      .attr("opacity", 0)
      .merge(leLabels).transition().duration(dur).ease(d3.easeLinear)
      .attr("y", function (d) { return yScale(String(d.rank)) + yScale.bandwidth() / 2 + 4; })
      .attr("x", function (d) { return Math.max(xScale(d.alcohol) - 8, 50); })
      /* Only show when the bar is wide enough to hold the label */
      .attr("opacity", function (d) { return xScale(d.alcohol) > 60 ? 1 : 0; })
      .text(function (d) { return d3.format(".1f")(d.lifeExp) + " yrs"; });

    leLabels.exit().transition().duration(dur / 2).attr("opacity", 0).remove();
  }

}());
