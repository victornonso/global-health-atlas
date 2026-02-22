/**
 * page4_economy.js  —  Member D
 * ─────────────────────────────────────────────────────────
 * Gapminder-style animated bubble chart.
 *
 * Encodings:
 *   X → GDP per Capita (log) OR Schooling (linear)  [toggle]
 *   Y → Life Expectancy
 *   R → Population (sqrt scale)
 *   Color → Region
 *
 * Features:
 *   • Year slider + ▶ Play / ⏸ Pause animation
 *   • Smooth D3 transitions (800 ms)
 *   • Linear regression line (dashed)
 *   • Large watermark year
 *   • Country labels for top-10 most populous (optional)
 *   • Tooltip: country, GDP, schooling, life expectancy, pop
 * ─────────────────────────────────────────────────────────
 */

"use strict";

(function () {
  /* ── State ─────────────────────────────────────────────── */
  let currentYear  = 2000;
  let xMode        = "gdp";   // "gdp" | "school"
  let playing      = false;
  let playTimer    = null;

  /* ── Layout ─────────────────────────────────────────────── */
  const MARGIN = { top: 28, right: 52, bottom: 68, left: 72 };
  let W, H, iW, iH;
  let svg, g;
  let xScale, yScale, rScale;

  /* ── Public init ─────────────────────────────────────────── */
  window.initPage4 = function initPage4() {
    /* Region legend */
    window.buildRegionLegend("p4-legend");

    /* Controls */
    d3.select("#p4-year-slider").on("input", function () {
      currentYear = +this.value;
      d3.select("#p4-year-display").text(this.value);
      _updateChart();
    });

    /* Expose toggle + play to HTML onclick */
    window.p4SetXMode = _setXMode;
    window.p4TogglePlay = _togglePlay;

    _initSVG();
    _updateChart();
  };

  /* ── SVG scaffold ────────────────────────────────────────── */
  function _initSVG() {
    const svgEl = document.getElementById("p4-svg");
    W  = svgEl.clientWidth  || 980;
    H  = 520;
    iW = W - MARGIN.left - MARGIN.right;
    iH = H - MARGIN.top  - MARGIN.bottom;

    svg = d3.select("#p4-svg").attr("viewBox", `0 0 ${W} ${H}`);
    g   = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    /* Scales */
    const validGDP = window.allData.filter((d) => d.GDP_per_capita > 0);
    xScale = d3
      .scaleLog()
      .domain([200, d3.max(validGDP, (d) => d.GDP_per_capita) * 1.15])
      .range([0, iW])
      .clamp(true);

    yScale = d3
      .scaleLinear()
      .domain([35, d3.max(window.allData, (d) => d.Life_expectancy) + 3])
      .range([iH, 0])
      .nice();

    rScale = d3
      .scaleSqrt()
      .domain([0, d3.max(window.allData, (d) => d.Population_mln)])
      .range([4, 44]);

    /* Gridline groups */
    g.append("g").attr("class", "p4-xgrid");
    g.append("g").attr("class", "p4-ygrid");

    /* Axis groups */
    g.append("g").attr("class", "axis p4-xaxis")
      .attr("transform", `translate(0,${iH})`);
    g.append("g").attr("class", "axis p4-yaxis");

    /* Axis labels */
    g.append("text").attr("class", "axis-label p4-xlabel")
      .attr("x", iW / 2).attr("y", iH + 54)
      .attr("text-anchor", "middle");

    g.append("text").attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -iH / 2).attr("y", -56)
      .attr("text-anchor", "middle")
      .text("Life Expectancy (years)");

    /* Regression line */
    g.append("line").attr("class", "regression-line p4-reg");

    /* Year watermark */
    svg.append("text").attr("class", "p4-year-bg")
      .attr("x", MARGIN.left + iW - 12)
      .attr("y", MARGIN.top  + iH - 12)
      .attr("text-anchor", "end")
      .attr("font-family", "Playfair Display, serif")
      .attr("font-size", 88)
      .attr("font-weight", 900)
      .attr("fill", "var(--surface2)")
      .text("2000");

    /* Bubbles group */
    g.append("g").attr("class", "p4-bubbles");
  }

  /* ── X-mode toggle ───────────────────────────────────────── */
  function _setXMode(mode) {
    xMode = mode;
    document.getElementById("p4-toggle-gdp")
      .classList.toggle("active", mode === "gdp");
    document.getElementById("p4-toggle-school")
      .classList.toggle("active", mode === "school");

    if (mode === "gdp") {
      const validGDP = window.allData.filter((d) => d.GDP_per_capita > 0);
      xScale = d3
        .scaleLog()
        .domain([200, d3.max(validGDP, (d) => d.GDP_per_capita) * 1.15])
        .range([0, iW])
        .clamp(true);
    } else {
      xScale = d3
        .scaleLinear()
        .domain([0, d3.max(window.allData, (d) => d.Schooling) + 2])
        .range([0, iW]);
    }
    _updateChart();
  }

  /* ── Play / Pause ────────────────────────────────────────── */
  function _togglePlay() {
    playing = !playing;
    const btn = document.getElementById("p4-play-btn");
    if (playing) {
      btn.textContent = "⏸ Pause";
      btn.classList.add("playing");
      playTimer = setInterval(() => {
        currentYear = currentYear >= 2015 ? 2000 : currentYear + 1;
        document.getElementById("p4-year-slider").value = currentYear;
        document.getElementById("p4-year-display").textContent = currentYear;
        _updateChart();
      }, 950);
    } else {
      btn.textContent = "▶ Play";
      btn.classList.remove("playing");
      clearInterval(playTimer);
    }
  }

  /* ── Get X value ─────────────────────────────────────────── */
  function _xVal(d) {
    return xMode === "gdp" ? d.GDP_per_capita : d.Schooling;
  }

  /* ── Update / animate chart ──────────────────────────────── */
  function _updateChart() {
    const yd = window.allData.filter(
      (d) => d.Year === currentYear && _xVal(d) > 0 && d.Life_expectancy > 0
    );

    const DUR = playing ? 850 : 700;

    /* Year watermark */
    svg.select(".p4-year-bg").text(currentYear);

    /* Axis label */
    const xLabel =
      xMode === "gdp"
        ? "GDP per Capita (USD, log scale)"
        : "Average Years of Schooling";
    g.select(".p4-xlabel").text(xLabel);

    /* Axes */
    const xAxisFn =
      xMode === "gdp"
        ? d3.axisBottom(xScale).ticks(7, "$,.0s")
        : d3.axisBottom(xScale).ticks(8);

    g.select(".p4-xaxis").transition().duration(DUR).call(xAxisFn);
    g.select(".p4-yaxis").transition().duration(DUR)
      .call(d3.axisLeft(yScale).ticks(7));

    /* Gridlines */
    g.select(".p4-xgrid").transition().duration(DUR)
      .call(xAxisFn.tickSize(-iH).tickFormat(""))
      .call((axis) => {
        axis.selectAll("line").attr("class", "gridline");
        axis.select(".domain").remove();
      });
    g.select(".p4-ygrid").transition().duration(DUR)
      .call(d3.axisLeft(yScale).ticks(7).tickSize(-iW).tickFormat(""))
      .call((axis) => {
        axis.selectAll("line").attr("class", "gridline");
        axis.select(".domain").remove();
      });

    /* Regression line */
    _drawRegression(yd, DUR);

    /* ── Enter / Update / Exit ──────────────────────────────── */
    const bubbles = g
      .select(".p4-bubbles")
      .selectAll(".bubble")
      .data(yd, (d) => d.Country);

    /* Sort so small bubbles render on top */
    const allBubbles = bubbles
      .enter()
      .append("circle")
      .attr("class", "bubble")
      .attr("cx", (d) => xScale(_xVal(d)))
      .attr("cy", (d) => yScale(d.Life_expectancy))
      .attr("r", 0)
      .attr("fill", (d) => window.REGION_COLORS[d.Region] || "#888")
      .attr("opacity", 0.72)
      .attr("stroke", "rgba(0,0,0,0.15)")
      .attr("stroke-width", 0.7)
      .on("mouseover", _onBubbleOver)
      .on("mousemove",  window.moveTooltip)
      .on("mouseout",   _onBubbleOut)
      .merge(bubbles)
      .sort((a, b) => d3.descending(a.Population_mln, b.Population_mln));

    allBubbles.transition().duration(DUR)
      .attr("cx", (d) => { const xv = _xVal(d); return xv > 0 ? xScale(xv) : -200; })
      .attr("cy", (d) => yScale(d.Life_expectancy))
      .attr("r",  (d) => rScale(d.Population_mln))
      .attr("fill", (d) => window.REGION_COLORS[d.Region] || "#888");

    bubbles.exit()
      .transition().duration(300)
      .attr("r", 0).attr("opacity", 0)
      .remove();
  }

  /* ── Regression line ─────────────────────────────────────── */
  function _drawRegression(yd, dur) {
    const valid = yd.filter((d) => _xVal(d) > 0);
    if (valid.length < 3) return;

    const xs =
      xMode === "gdp"
        ? valid.map((d) => Math.log10(d.GDP_per_capita))
        : valid.map((d) => d.Schooling);
    const ys = valid.map((d) => d.Life_expectancy);
    const [slope, intercept] = window.linearRegression(xs, ys);

    const dom  = xScale.domain();
    const x1v  = dom[0], x2v = dom[1];
    const x1l  = xMode === "gdp" ? Math.log10(x1v) : x1v;
    const x2l  = xMode === "gdp" ? Math.log10(x2v) : x2v;
    const y1v  = slope * x1l + intercept;
    const y2v  = slope * x2l + intercept;

    g.select(".p4-reg")
      .transition().duration(dur)
      .attr("x1", xScale(x1v)).attr("y1", yScale(y1v))
      .attr("x2", xScale(x2v)).attr("y2", yScale(y2v));
  }

  /* ── Hover handlers ──────────────────────────────────────── */
  function _onBubbleOver(event, d) {
    d3.select(this)
      .raise()
      .transition().duration(100)
      .attr("opacity", 1)
      .attr("stroke", "white")
      .attr("stroke-width", 1.8);

    window.showTooltip(
      `<div class="tt-country">${d.Country}</div>
       <div class="tt-region">${window.REGION_SHORT[d.Region] || d.Region} · ${currentYear}</div>
       <hr class="tt-divider">
       <div class="tt-row"><span class="tt-label">Life Expectancy</span><span class="tt-value">${window.fmt(d.Life_expectancy)} yrs</span></div>
       <div class="tt-row"><span class="tt-label">GDP per Capita</span><span class="tt-value">${window.fmtK(d.GDP_per_capita)}</span></div>
       <div class="tt-row"><span class="tt-label">Schooling</span><span class="tt-value">${window.fmt(d.Schooling)} yrs</span></div>
       <div class="tt-row"><span class="tt-label">Population</span><span class="tt-value">${window.fmt(d.Population_mln, 2)}M</span></div>`,
      event
    );
  }

  function _onBubbleOut(event) {
    d3.select(this)
      .transition().duration(150)
      .attr("opacity", 0.72)
      .attr("stroke", "rgba(0,0,0,0.15)")
      .attr("stroke-width", 0.7);
    window.hideTooltip();
  }
})();
