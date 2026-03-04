/**
 * page1_map.js — Life Expectancy Choropleth Map
 *
 * Renders a world choropleth of life expectancy for a selected year,
 * with optional region-filter zoom and a continuous blue color scale.
 *
 * ZOOM & PAN
 * ──────────
 * d3.zoom is attached to the SVG element. On every zoom/pan event the
 * current d3.ZoomTransform is stored in `currentTransform` and applied
 * to mapG. Region-filter panning from _panToRegion() uses
 * zoom.transform() so the zoom state stays in sync and the user can
 * continue to pan/zoom freely after a region is selected.
 *
 * Zoom controls (+ / − / reset) are injected as an SVG foreign-object
 * overlay so they sit inside the map container without extra HTML.
 *
 * COUNTRY NAME RESOLUTION
 * ───────────────────────
 * world-atlas 110m topology features carry only a numeric ISO id —
 * no name property. Matching CSV country names to topology ids therefore
 * requires two assets fetched in parallel:
 *
 *   countries-110m.json  — lightweight geometry used for rendering
 *   countries-50m.json   — same ids + .properties.name (Natural Earth names)
 *
 * _buildLookups() constructs a norm(NE name) → isoId index from the 50m
 * features, then resolves every allData.Country string against it:
 *
 *   Pass 1 — _norm() direct match  (handles whitespace / case / apostrophes)
 *   Pass 2 — CSV_TO_TOPO alias     (bridges the ~23 WB ↔ NE name divergences)
 *
 * The result is two O(1) Maps used for all rendering:
 *   isoToRegion  Map<isoId, region>          — region filter
 *   yearDataMap  Map<year, Map<isoId, row>>  — color + tooltip lookup
 */

"use strict";

(function () {

  /**
   * CSV_TO_TOPO
   * Explicit bridges for World Bank country names that _norm() alone
   * cannot match to their Natural Earth equivalents.
   * Derived by diffing the two name lists via window._p1DiagNames().
   */
  const CSV_TO_TOPO = {
    "Antigua and Barbuda":                              "Antigua and Barb.",
    "Bolivia (Plurinational State of)":                 "Bolivia",
    "Bosnia and Herzegovina":                           "Bosnia and Herz.",
    "Brunei Darussalam":                                "Brunei",
    "Central African Republic":                         "Central African Rep.",
    "Cote d'Ivoire":                                    "C\u00f4te d'Ivoire",
    "Democratic Republic of the Congo":                 "Dem. Rep. Congo",
    "Dominican Republic":                               "Dominican Rep.",
    "Equatorial Guinea":                                "Eq. Guinea",
    "Iran (Islamic Republic of)":                       "Iran",
    "Lao People's Democratic Republic":                 "Laos",
    "Micronesia (Federated States of)":                 "Micronesia",
    "Republic of Moldova":                              "Moldova",
    "Russian Federation":                               "Russia",
    "Saint Vincent and the Grenadines":                 "St. Vin. and Gren.",
    "Sao Tome and Principe":                            "S\u00e3o Tom\u00e9 and Principe",
    "Solomon Islands":                                  "Solomon Is.",
    "Swaziland":                                        "eSwatini",
    "Syrian Arab Republic":                             "Syria",
    "The former Yugoslav republic of Macedonia":        "Macedonia",
    "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
    "United Republic of Tanzania":                      "Tanzania",
    "Venezuela (Bolivarian Republic of)":               "Venezuela",
  };

  /* ── State ────────────────────────────────────────────────────────── */

  let currentYear   = 2015;
  let currentRegion = "All";
  let mapSvg, mapG, mapPath;
  let W = 960, H = 500;
  let geoFeatures, baseScale, baseTranslate;

  /**
   * d3.zoom instance attached to the SVG.
   * currentTransform mirrors the live ZoomTransform so _currentK() and
   * stroke-width compensation work without reading the DOM.
   */
  let zoom;
  let currentTransform = d3.zoomIdentity;

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 12;

  /* Populated once in _buildLookups(); used for every render/hover. */
  const isoToRegion = new Map();  // isoId → region string
  const yearDataMap = new Map();  // year  → Map<isoId, row>

  let domainMin = 40, domainMax = 85;
  const colorScale = d3.scaleSequential()
    .domain([domainMin, domainMax])
    .interpolator(d3.interpolateBlues);

  /* ── Name normalisation ───────────────────────────────────────────── */

  /**
   * Minimal transform applied identically to both topology names and CSV
   * names before comparison — lower-case, apostrophe → space, trim.
   * Kept intentionally narrow; broader stripping risks false matches.
   */
  function _norm(s) {
    if (!s) return "";
    return s.toLowerCase()
             .replace(/['\u2018\u2019\u00b4]/g, " ")
             .replace(/\s+/g, " ")
             .trim();
  }

  /* ── Lookup maps ──────────────────────────────────────────────────── */

  /**
   * Builds isoToRegion and yearDataMap in a single O(n) pass over allData.
   * topoNames is the [{id, name}] array extracted from the 50m features.
   */
  function _buildLookups(topoNames) {
    isoToRegion.clear();
    yearDataMap.clear();

    const nameToIso = new Map();
    topoNames.forEach(function (f) {
      if (f.name) nameToIso.set(_norm(f.name), String(f.id));
    });

    window.allData.forEach(function (row) {
      const isoId = nameToIso.get(_norm(row.Country))
                 || nameToIso.get(_norm(CSV_TO_TOPO[row.Country]));
      if (!isoId) return;

      if (!isoToRegion.has(isoId)) isoToRegion.set(isoId, row.Region);
      if (!yearDataMap.has(row.Year)) yearDataMap.set(row.Year, new Map());
      yearDataMap.get(row.Year).set(isoId, row);
    });
  }

  /* ── Public init ──────────────────────────────────────────────────── */

  window.initPage1 = function () {
    domainMin = d3.min(window.allData, function (d) { return d.Life_expectancy; }) || 40;
    domainMax = d3.max(window.allData, function (d) { return d.Life_expectancy; }) || 85;
    colorScale.domain([domainMin, domainMax]);

    _buildRegionSelect();
    _buildGradientLegend();
    _updateStats();

    Promise.all([
      d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
      d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"),
    ])
    .then(function (results) {
      _buildLookups(
        topojson.feature(results[1], results[1].objects.countries).features
          .map(function (f) { return { id: f.id, name: f.properties && f.properties.name }; })
      );
      _drawMap(results[0]);
    })
    .catch(function () {
      document.getElementById("p1-map-wrap").innerHTML =
        '<div class="map-no-data">World map requires internet access ' +
        "(cdn.jsdelivr.net/npm/world-atlas).<br>All other pages work fully offline.</div>";
    });

    d3.select("#p1-year-slider").on("input", function () {
      currentYear = +this.value;
      d3.select("#p1-year-display").text(this.value);
      _updateStats();
      if (geoFeatures) _applyColors();
    });

    d3.select("#p1-region-select").on("change", function () {
      currentRegion = this.value;
      _updateStats();
      if (geoFeatures) _panToRegion();
    });
  };

  /* ── Controls ─────────────────────────────────────────────────────── */

  function _buildRegionSelect() {
    const sel = document.getElementById("p1-region-select");
    if (!sel) return;
    sel.innerHTML = '<option value="All">\uD83C\uDF0D All Regions</option>';
    window.REGIONS.forEach(function (r) {
      const o = document.createElement("option");
      o.value = r;
      o.textContent = window.REGION_SHORT[r] || r;
      sel.appendChild(o);
    });
  }

  /* ── Gradient legend ──────────────────────────────────────────────── */

  function _buildGradientLegend() {
    const wrap = document.querySelector(".colorbar-wrap");
    if (!wrap) return;
    wrap.innerHTML = "";

    const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgEl.setAttribute("viewBox", "0 0 480 50");
    svgEl.setAttribute("width",   "100%");
    svgEl.setAttribute("height",  "50");
    svgEl.style.cssText = "display:block;max-width:480px;margin:0 auto";
    wrap.appendChild(svgEl);

    const svg = d3.select(svgEl);
    const bx = 50, by = 8, bw = 380, bh = 14;

    const grad = svg.append("defs").append("linearGradient")
      .attr("id", "p1-le-grad").attr("x1", "0%").attr("x2", "100%");
    for (var i = 0; i <= 20; i++) {
      var t = i / 20;
      grad.append("stop")
        .attr("offset",     t * 100 + "%")
        .attr("stop-color", colorScale(domainMin + t * (domainMax - domainMin)));
    }

    svg.append("rect").attr("x", bx).attr("y", by)
      .attr("width", bw).attr("height", bh).attr("rx", 3)
      .attr("fill", "url(#p1-le-grad)");
    svg.append("rect").attr("x", bx).attr("y", by)
      .attr("width", bw).attr("height", bh).attr("rx", 3)
      .attr("fill", "none").attr("stroke", "rgba(255,255,255,0.15)").attr("stroke-width", 0.5);
    svg.append("text")
      .attr("font-family", "JetBrains Mono, monospace").attr("font-size", "10").attr("fill", "#888")
      .attr("x", bx).attr("y", by + bh + 14).attr("text-anchor", "start")
      .text(Math.round(domainMin) + " yrs");
    svg.append("text")
      .attr("font-family", "JetBrains Mono, monospace").attr("font-size", "10").attr("fill", "#888")
      .attr("x", bx + bw).attr("y", by + bh + 14).attr("text-anchor", "end")
      .text(Math.round(domainMax) + " yrs");
    svg.append("text")
      .attr("font-family", "DM Sans, sans-serif").attr("font-size", "11").attr("fill", "#aaa")
      .attr("text-anchor", "middle").attr("x", bx + bw / 2).attr("y", by + bh + 14)
      .text("Life Expectancy (years)");
  }

  /* ── Map draw ─────────────────────────────────────────────────────── */

  function _drawMap(world) {
    const svgEl = document.getElementById("p1-map-svg");
    W       = svgEl.clientWidth || 960;
    mapSvg  = d3.select("#p1-map-svg").attr("viewBox", "0 0 " + W + " " + H);

    baseScale     = W / 6.4;
    baseTranslate = [W / 2, H / 2];

    const proj  = d3.geoNaturalEarth1().scale(baseScale).translate(baseTranslate);
    mapPath     = d3.geoPath().projection(proj);

    const countries = topojson.feature(world, world.objects.countries);
    const borders   = topojson.mesh(world, world.objects.countries, function (a, b) { return a !== b; });
    geoFeatures     = countries.features;

    mapSvg.append("path").datum(d3.geoGraticule()())
      .attr("fill", "none").attr("stroke", "#1a1a2a").attr("stroke-width", 0.3).attr("d", mapPath);
    mapSvg.insert("rect", "g").attr("width", W).attr("height", H).attr("fill", "#080810");

    mapG = mapSvg.append("g").attr("class", "map-g");
    mapG.selectAll(".country-path")
      .data(geoFeatures, function (d) { return d.id; })
      .join("path")
      .attr("class",          "country-path")
      .attr("d",              mapPath)
      .attr("fill",           _fill)
      .attr("stroke",         _stroke)
      .attr("stroke-width",   0.4)
      .attr("pointer-events", _events)
      .on("mouseover", _onOver)
      .on("mousemove",  window.moveTooltip)
      .on("mouseout",   _onOut);

    mapG.append("path").datum(borders)
      .attr("class", "borders-path").attr("fill", "none")
      .attr("stroke", "#0d0d1a").attr("stroke-width", 0.3).attr("d", mapPath);

    _initZoom();
    _buildZoomControls();
  }

  /* ── d3.zoom setup ────────────────────────────────────────────────── */

  /**
   * Attaches d3.zoom to the SVG. On every zoom/pan event:
   *   1. Store the new transform in currentTransform.
   *   2. Apply it to mapG via a CSS transform.
   *   3. Compensate stroke widths so borders stay visually thin at high zoom.
   */
  function _initZoom() {
    zoom = d3.zoom()
      .scaleExtent([ZOOM_MIN, ZOOM_MAX])
      .translateExtent([[-W * 0.5, -H * 0.5], [W * 1.5, H * 1.5]])
      .on("zoom", function (event) {
        currentTransform = event.transform;
        mapG.attr("transform", currentTransform);

        /* Keep borders visually consistent across zoom levels */
        const k = currentTransform.k;
        mapG.selectAll(".country-path").attr("stroke-width", 0.4 / k);
        mapG.select(".borders-path").attr("stroke-width", 0.3 / k);

        /* Update the zoom-level readout badge */
        _updateZoomBadge(k);
      });

    mapSvg.call(zoom);

    /* Prevent the default browser scroll-to-zoom on wheel so the page
       can still be scrolled normally; user must pinch or use buttons. */
    mapSvg.on("wheel.zoom", function (event) {
      event.preventDefault();
      const delta = -event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.002);
      const scale = currentTransform.k * Math.pow(2, delta);
      mapSvg.call(
        zoom.scaleTo,
        Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale))
      );
    }, { passive: false });
  }

  /* ── Zoom control buttons ─────────────────────────────────────────── */

  /**
   * Injects three small buttons (+ / reset / −) as an absolutely-positioned
   * div overlay on the map container. Keeps zoom UI inside the chart box
   * without touching index.html.
   */
  function _buildZoomControls() {
    const wrap = document.getElementById("p1-map-wrap");
    if (!wrap || document.getElementById("p1-zoom-controls")) return;

    const panel = document.createElement("div");
    panel.id = "p1-zoom-controls";
    panel.style.cssText =
      "position:absolute;top:12px;right:12px;display:flex;flex-direction:column;" +
      "gap:4px;z-index:10;";

    function makeBtn(label, title, onClick) {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.title       = title;
      btn.style.cssText =
        "width:30px;height:30px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);" +
        "background:rgba(15,15,26,0.88);color:#e2e2ee;font-size:16px;line-height:1;" +
        "cursor:pointer;display:flex;align-items:center;justify-content:center;" +
        "transition:background 0.15s,border-color 0.15s;backdrop-filter:blur(6px);";
      btn.addEventListener("mouseenter", function () {
        btn.style.background    = "rgba(240,192,64,0.18)";
        btn.style.borderColor   = "rgba(240,192,64,0.6)";
      });
      btn.addEventListener("mouseleave", function () {
        btn.style.background    = "rgba(15,15,26,0.88)";
        btn.style.borderColor   = "rgba(255,255,255,0.15)";
      });
      btn.addEventListener("click", onClick);
      return btn;
    }

    panel.appendChild(makeBtn("+", "Zoom in",  function () { _zoomBy(1.5); }));
    panel.appendChild(makeBtn("⊙", "Reset zoom", _zoomReset));
    panel.appendChild(makeBtn("−", "Zoom out", function () { _zoomBy(1 / 1.5); }));

    /* Zoom level badge */
    const badge = document.createElement("div");
    badge.id = "p1-zoom-badge";
    badge.style.cssText =
      "margin-top:4px;text-align:center;font-family:'JetBrains Mono',monospace;" +
      "font-size:9px;color:rgba(136,136,170,0.8);letter-spacing:0.05em;";
    badge.textContent = "1×";
    panel.appendChild(badge);

    /* The map container needs relative positioning for the overlay */
    wrap.style.position = "relative";
    wrap.appendChild(panel);
  }

  function _zoomBy(factor) {
    mapSvg.transition().duration(320).ease(d3.easeCubicOut)
      .call(zoom.scaleBy, factor);
  }

  function _zoomReset() {
    mapSvg.transition().duration(520).ease(d3.easeCubicInOut)
      .call(zoom.transform, d3.zoomIdentity);
  }

  function _updateZoomBadge(k) {
    const badge = document.getElementById("p1-zoom-badge");
    if (badge) badge.textContent = k.toFixed(1) + "\u00D7";
  }

  /* ── Per-feature accessors ────────────────────────────────────────── */

  function _inRegion(d) {
    if (currentRegion === "All") return true;
    return isoToRegion.get(String(d.id)) === currentRegion;
  }

  function _fill(d) {
    if (!_inRegion(d)) return "transparent";
    const yearMap = yearDataMap.get(currentYear);
    const row     = yearMap && yearMap.get(String(d.id));
    return row ? colorScale(row.Life_expectancy) : "#1a1a2a";
  }

  function _stroke(d) { return _inRegion(d) ? "#0d0d18" : "none"; }
  function _events(d) { return _inRegion(d) ? "all"     : "none"; }

  /* ── Color transitions ────────────────────────────────────────────── */

  function _applyColors() {
    mapG.selectAll(".country-path").transition().duration(650)
      .attr("fill",           _fill)
      .attr("stroke",         _stroke)
      .attr("pointer-events", _events);
  }

  /* ── Pan + zoom to region ─────────────────────────────────────────── */

  /**
   * Computes the translate + scale needed to fit the selected region,
   * then applies it via zoom.transform() so the d3.zoom state stays in
   * sync and the user can continue to interact freely afterwards.
   */
  function _panToRegion() {
    if (!mapG || !zoom) return;
    _applyColors();

    if (currentRegion === "All") {
      mapSvg.transition().duration(900).ease(d3.easeCubicInOut)
        .call(zoom.transform, d3.zoomIdentity);
      return;
    }

    const regionFeatures = geoFeatures.filter(_inRegion);
    if (!regionFeatures.length) return;

    const pad     = 50;
    const fitProj = d3.geoNaturalEarth1()
      .fitExtent([[pad, pad], [W - pad, H - pad]],
                 { type: "FeatureCollection", features: regionFeatures });

    const k  = fitProj.scale() / baseScale;
    const tx = fitProj.translate()[0] - k * baseTranslate[0];
    const ty = fitProj.translate()[1] - k * baseTranslate[1];

    mapSvg.transition().duration(900).ease(d3.easeCubicInOut)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
  }

  /* ── Tooltip ──────────────────────────────────────────────────────── */

  function _onOver(event, d) {
    const yearMap = yearDataMap.get(currentYear);
    const row     = yearMap && yearMap.get(String(d.id));
    if (!row) return;

    window.showTooltip(
      '<div class="tt-country">' + row.Country + "</div>" +
      '<div class="tt-region">'  + (window.REGION_SHORT[row.Region] || row.Region) +
        " \xB7 " + currentYear + "</div>" +
      '<hr class="tt-divider">' +
      '<div class="tt-row"><span class="tt-label">Life Expectancy</span>' +
        '<span class="tt-value">' + window.fmt(row.Life_expectancy) + " yrs</span></div>" +
      '<div class="tt-row"><span class="tt-label">GDP per Capita</span>' +
        '<span class="tt-value">' + window.fmtK(row.GDP_per_capita) + "</span></div>" +
      '<div class="tt-row"><span class="tt-label">Infant Mortality</span>' +
        '<span class="tt-value">' + window.fmt(row.Infant_deaths) + "/1k</span></div>" +
      '<div class="tt-row"><span class="tt-label">Population</span>' +
        '<span class="tt-value">' + window.fmt(row.Population_mln, 2) + "M</span></div>",
      event
    );

    const k = currentTransform.k;
    d3.select(this).raise().attr("stroke", "rgba(255,255,255,0.8)").attr("stroke-width", 1.5 / k);
  }

  function _onOut() {
    window.hideTooltip();
    const k = currentTransform.k;
    d3.select(this).attr("stroke", _stroke).attr("stroke-width", 0.4 / k);
  }

  /* ── Stat cards ───────────────────────────────────────────────────── */

  function _updateStats() {
    let yd = window.getYearData(currentYear);
    if (currentRegion !== "All") {
      yd = yd.filter(function (r) { return r.Region === currentRegion; });
    }
    if (!yd.length) return;

    const avg    = d3.mean(yd, function (d) { return d.Life_expectancy; });
    const maxVal = d3.max(yd,  function (d) { return d.Life_expectancy; });
    const minVal = d3.min(yd,  function (d) { return d.Life_expectancy; });
    const maxC   = yd.find(function (d) { return d.Life_expectancy === maxVal; });
    const minC   = yd.find(function (d) { return d.Life_expectancy === minVal; });

    let prevYd = window.getYearData(currentYear - 1);
    if (currentRegion !== "All") {
      prevYd = prevYd.filter(function (r) { return r.Region === currentRegion; });
    }
    const prevAvg  = prevYd.length ? d3.mean(prevYd, function (d) { return d.Life_expectancy; }) : avg;
    const trend    = +(avg - prevAvg).toFixed(2);
    const trendStr = (trend >= 0 ? "+" : "") + trend;
    const trendCol = trend >= 0 ? "#40d0a0" : "#e84545";

    document.getElementById("p1-stats").innerHTML =
      '<div class="stat-card">' +
        '<div class="stat-card-label">Avg Life Expectancy</div>' +
        '<div class="stat-card-value">' + window.fmt(avg) + "</div>" +
        '<div class="stat-card-sub" style="color:' + trendCol + '">' + trendStr + " vs prev year</div>" +
      "</div>" +
      '<div class="stat-card">' +
        '<div class="stat-card-label">Highest \xB7 ' + currentYear + "</div>" +
        '<div class="stat-card-value">' + window.fmt(maxVal) + "</div>" +
        '<div class="stat-card-sub">' + (maxC ? maxC.Country : "\u2014") + "</div>" +
      "</div>" +
      '<div class="stat-card">' +
        '<div class="stat-card-label">Lowest \xB7 ' + currentYear + "</div>" +
        '<div class="stat-card-value">' + window.fmt(minVal) + "</div>" +
        '<div class="stat-card-sub">' + (minC ? minC.Country : "\u2014") + "</div>" +
      "</div>" +
      '<div class="stat-card">' +
        '<div class="stat-card-label">Countries in view</div>' +
        '<div class="stat-card-value">' + yd.length + "</div>" +
        '<div class="stat-card-sub">' +
          (currentRegion === "All" ? "9 regions" : (window.REGION_SHORT[currentRegion] || currentRegion)) +
        "</div>" +
      "</div>";
  }

}());
