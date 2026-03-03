/**
 * page2_trends.js — Mortality Distribution (Animated Pie Chart)
 *
 * Displays the share of three mortality indicators for a selected
 * region and year as an animated donut chart with arc-tween transitions.
 *
 * Controls:  Region dropdown  ·  Year dropdown (2000–2015)
 * Slices:    Infant Deaths  ·  Under-Five Deaths  ·  Adult Mortality
 */

"use strict";

(function () {

  let currentRegion = "All";
  let currentYear   = 2015;

  /** Slice definitions — key maps to a numeric field in allData. */
  const SLICES = [
    { key: "Infant_deaths",     label: "Infant Deaths",     color: "#e84545" },
    { key: "Under_five_deaths", label: "Under-Five Deaths", color: "#f0a030" },
    { key: "Adult_mortality",   label: "Adult Mortality",   color: "#6080f0" },
  ];

  const W = 560, H = 420;
  const cx = W / 2, cy = H / 2;
  const outerR = Math.min(W, H) / 2 - 36;
  const innerR = outerR * 0.42;

  let svg, pieG, arcGen, labelArcGen, pieGen;

  /**
   * Stores the previous arc angles so arcTween can interpolate smoothly
   * between the old and new pie layout on each update.
   */
  let currentAngles = null;

  window.initPage2 = function () {
    _buildControls();
    _initSVG();
    _update(false);
  };

  /* ── Controls ─────────────────────────────────────────────────────── */

  function _buildControls() {
    const regSel = document.getElementById("p2-region");
    regSel.innerHTML = '<option value="All">All Regions</option>';
    window.REGIONS.forEach(function (r) {
      const o = document.createElement("option");
      o.value = r;
      o.textContent = window.REGION_SHORT[r] || r;
      regSel.appendChild(o);
    });
    regSel.addEventListener("change", function () {
      currentRegion = this.value;
      _update(true);
    });

    /* Year selector — injected dynamically to keep HTML minimal. */
    const ctrlDiv = regSel.closest(".controls");
    if (ctrlDiv && !document.getElementById("p2-year")) {
      const wrap = document.createElement("span");
      wrap.innerHTML =
        '<span class="ctrl-divider" style="display:inline-block;width:1px;height:20px;' +
        'background:rgba(255,255,255,0.1);margin:0 12px;"></span>' +
        '<span class="ctrl-label">Year</span>';
      const yrSel = document.createElement("select");
      yrSel.id = "p2-year";
      window.YEARS.slice().reverse().forEach(function (y) {
        const o = document.createElement("option");
        o.value = y;
        o.textContent = y;
        if (y === currentYear) o.selected = true;
        yrSel.appendChild(o);
      });
      yrSel.addEventListener("change", function () {
        currentYear = +this.value;
        _update(true);
      });
      wrap.appendChild(yrSel);
      ctrlDiv.appendChild(wrap);
    }
  }

  /* ── Data ─────────────────────────────────────────────────────────── */

  /** Aggregate slice totals for the current region + year filters. */
  function _getSliceData() {
    let rows = window.allData.filter(function (d) { return d.Year === currentYear; });
    if (currentRegion !== "All") {
      rows = rows.filter(function (d) { return d.Region === currentRegion; });
    }
    return SLICES.map(function (s) {
      return {
        key:   s.key,
        label: s.label,
        color: s.color,
        value: d3.sum(rows, function (d) { return d[s.key]; }) || 0,
      };
    });
  }

  /* ── SVG scaffold ─────────────────────────────────────────────────── */

  function _initSVG() {
    const container = document.getElementById("p2-charts");
    container.innerHTML =
      '<div id="p2-pie-wrap" style="display:flex;flex-direction:column;' +
      'align-items:center;gap:16px;padding:20px 0;"></div>';
    const wrap = document.getElementById("p2-pie-wrap");

    const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgEl.setAttribute("id",      "p2-pie-svg");
    svgEl.setAttribute("viewBox", "0 0 " + W + " " + H);
    svgEl.style.cssText = "width:100%;max-width:" + W + "px;display:block;";
    wrap.appendChild(svgEl);

    svg = d3.select("#p2-pie-svg");

    /* Large semi-transparent year watermark rendered behind the arcs */
    svg.append("g").attr("transform", "translate(" + cx + "," + cy + ")")
      .append("text")
      .attr("class",        "p2-center-year")
      .attr("text-anchor",  "middle")
      .attr("dy",           "0.35em")
      .attr("font-family",  "Playfair Display, serif")
      .attr("font-size",    30)
      .attr("fill",         "rgba(255,255,255,0.10)")
      .attr("pointer-events", "none");

    pieG = svg.append("g").attr("transform", "translate(" + cx + "," + cy + ")");

    arcGen      = d3.arc().innerRadius(innerR).outerRadius(outerR).padAngle(0.025).cornerRadius(4);
    labelArcGen = d3.arc().innerRadius(outerR + 18).outerRadius(outerR + 18);
    pieGen      = d3.pie().value(function (d) { return d.value; }).sort(null).padAngle(0.025);

    /* Color legend */
    const legendWrap = document.createElement("div");
    legendWrap.style.cssText = "display:flex;gap:24px;flex-wrap:wrap;justify-content:center;margin-top:4px;";
    SLICES.forEach(function (s) {
      const item = document.createElement("div");
      item.style.cssText =
        "display:flex;align-items:center;gap:6px;font-family:DM Sans,sans-serif;" +
        "font-size:12px;color:var(--text-dim)";
      item.innerHTML =
        '<span style="width:12px;height:12px;border-radius:2px;background:' +
        s.color + ';display:inline-block;"></span>' + s.label;
      legendWrap.appendChild(item);
    });
    wrap.appendChild(legendWrap);
  }

  /* ── Render ───────────────────────────────────────────────────────── */

  function _update(animate) {
    const data  = _getSliceData();
    const total = d3.sum(data, function (d) { return d.value; });
    const dur   = animate ? 800 : 0;

    svg.select(".p2-center-year").text(currentYear);

    const arcs = pieGen(data);

    /**
     * arcTween interpolates between the previous arc angles and the new
     * ones, giving a smooth animated transition rather than a jump.
     */
    function arcTween(d, i) {
      const prev  = (currentAngles && currentAngles[i])
        ? currentAngles[i]
        : { startAngle: 0, endAngle: 0 };
      const interp = d3.interpolate(prev, d);
      return function (t) { return arcGen(interp(t)); };
    }

    /* ── Slices ── */
    const slices = pieG.selectAll(".p2-slice").data(arcs, function (d) { return d.data.key; });

    slices.enter()
      .append("path")
      .attr("class",        "p2-slice")
      .attr("fill",         function (d) { return d.data.color; })
      .attr("opacity",      0.85)
      .attr("stroke",       "var(--surface)")
      .attr("stroke-width", 1.5)
      .attr("d", function (d) {
        return arcGen({ startAngle: d.startAngle, endAngle: d.startAngle });
      })
      .on("mouseover", function (event, d) {
        d3.select(this).transition().duration(150)
          .attr("opacity", 1)
          .attr("transform", function () {
            const mid = (d.startAngle + d.endAngle) / 2;
            return "translate(" + (Math.sin(mid) * 8) + "," + (-Math.cos(mid) * 8) + ")";
          });
        const pct = total > 0 ? ((d.data.value / total) * 100).toFixed(1) : "0.0";
        window.showTooltip(
          '<div class="tt-country">' + d.data.label + '</div>' +
          '<div class="tt-region">' +
            (currentRegion === "All" ? "All Regions" : (window.REGION_SHORT[currentRegion] || currentRegion)) +
            " \xB7 " + currentYear + "</div>" +
          '<hr class="tt-divider">' +
          '<div class="tt-row"><span class="tt-label">Total</span>' +
            '<span class="tt-value">' + d3.format(",.0f")(d.data.value) + "</span></div>" +
          '<div class="tt-row"><span class="tt-label">Share</span>' +
            '<span class="tt-value">' + pct + "%</span></div>",
          event
        );
      })
      .on("mousemove", window.moveTooltip)
      .on("mouseout", function () {
        d3.select(this).transition().duration(150)
          .attr("opacity", 0.85)
          .attr("transform", "translate(0,0)");
        window.hideTooltip();
      })
      .merge(slices)
      .transition().duration(dur).ease(d3.easeCubicInOut)
      .attrTween("d", arcTween)
      .attr("fill", function (d) { return d.data.color; });

    slices.exit().transition().duration(300).attr("opacity", 0).remove();

    /* Snapshot angles for next transition */
    setTimeout(function () { currentAngles = arcs; }, dur);

    /* ── Percentage labels ── */
    const labels = pieG.selectAll(".p2-label").data(arcs, function (d) { return d.data.key; });

    labels.enter()
      .append("text")
      .attr("class",          "p2-label")
      .attr("text-anchor",    "middle")
      .attr("font-family",    "DM Sans, sans-serif")
      .attr("font-size",      11)
      .attr("fill",           "var(--text-dim)")
      .attr("pointer-events", "none")
      .merge(labels)
      .transition().duration(dur).ease(d3.easeCubicInOut)
      .attr("transform", function (d) {
        /* Hide label for slices too narrow to fit text */
        if ((d.endAngle - d.startAngle) < 0.2) return "translate(-9999,-9999)";
        return "translate(" + labelArcGen.centroid(d) + ")";
      })
      .text(function (d) {
        if ((d.endAngle - d.startAngle) < 0.2 || total === 0) return "";
        return ((d.data.value / total) * 100).toFixed(0) + "%";
      });

    labels.exit().remove();
  }

}());
