/**
 * page1_map.js  —  Member A
 * ─────────────────────────────────────────────────────────
 * Choropleth world map showing life expectancy per country.
 * Region filter pans/zooms to the selected region and hides
 * all other countries completely.
 * ─────────────────────────────────────────────────────────
 */

"use strict";

(function () {

  /* ── State ─────────────────────────────────────────────── */
  let currentYear   = 2015;
  let currentRegion = "All";

  let mapSvg, mapG, mapPath;
  let W = 960, H = 500;
  let geoFeatures = null;
  let baseScale, baseTranslate;

  /* isoNumericId (string) → region string, built at draw time */
  const isoToRegion = {};
  /* isoNumericId (string) → CSV row (for tooltip/color), per year */

  const colorScale = d3.scaleSequential()
    .domain([40, 85])
    .interpolator(d3.interpolateRgbBasis([
      "#3a0a0a","#aa2020","#e07030","#f0c040","#80d070","#40a8c0","#2060b0"
    ]));

  /* ── ISO numeric id → country name (matches world-atlas 110m) ── */
  const ISO_NAME = {
    4:"Afghanistan",8:"Albania",12:"Algeria",24:"Angola",32:"Argentina",
    36:"Australia",40:"Austria",50:"Bangladesh",56:"Belgium",64:"Bhutan",
    68:"Bolivia",76:"Brazil",100:"Bulgaria",116:"Cambodia",120:"Cameroon",
    124:"Canada",140:"Central African Republic",144:"Sri Lanka",152:"Chile",
    156:"China",170:"Colombia",178:"Republic of Congo",180:"DR Congo",
    188:"Costa Rica",191:"Croatia",192:"Cuba",196:"Cyprus",203:"Czechia",
    204:"Benin",208:"Denmark",214:"Dominican Republic",218:"Ecuador",
    818:"Egypt",222:"El Salvador",231:"Ethiopia",246:"Finland",250:"France",
    266:"Gabon",276:"Germany",288:"Ghana",300:"Greece",320:"Guatemala",
    324:"Guinea",332:"Haiti",340:"Honduras",348:"Hungary",356:"India",
    360:"Indonesia",364:"Iran",368:"Iraq",372:"Ireland",376:"Israel",
    380:"Italy",388:"Jamaica",392:"Japan",400:"Jordan",398:"Kazakhstan",
    404:"Kenya",410:"South Korea",414:"Kuwait",418:"Laos",
    422:"Lebanon",430:"Liberia",434:"Libya",484:"Mexico",496:"Mongolia",
    504:"Morocco",508:"Mozambique",516:"Namibia",524:"Nepal",528:"Netherlands",
    554:"New Zealand",558:"Nicaragua",566:"Nigeria",578:"Norway",586:"Pakistan",
    591:"Panama",598:"Papua New Guinea",600:"Paraguay",604:"Peru",
    608:"Philippines",616:"Poland",620:"Portugal",642:"Romania",643:"Russia",
    646:"Rwanda",682:"Saudi Arabia",686:"Senegal",694:"Sierra Leone",
    703:"Slovakia",706:"Somalia",710:"South Africa",724:"Spain",729:"Sudan",
    752:"Sweden",756:"Switzerland",760:"Syria",764:"Thailand",795:"Turkmenistan",
    800:"Uganda",804:"Ukraine",826:"United Kingdom",840:"United States",
    858:"Uruguay",862:"Venezuela",704:"Vietnam",887:"Yemen",894:"Zambia",
    716:"Zimbabwe",454:"Malawi",466:"Mali",478:"Mauritania",562:"Niger",
    728:"South Sudan",834:"Tanzania",108:"Burundi",174:"Comoros",
    262:"Djibouti",232:"Eritrea",426:"Lesotho",450:"Madagascar",
    788:"Tunisia",686:"Senegal",270:"Gambia",288:"Ghana",
    694:"Sierra Leone",768:"Togo",854:"Burkina Faso",706:"Somalia",
    226:"Equatorial Guinea",624:"Guinea-Bissau",716:"Zimbabwe",
    800:"Uganda",834:"Tanzania",894:"Zambia",454:"Malawi",
    710:"South Africa",716:"Zimbabwe",
    // Oceania
    242:"Fiji",296:"Kiribati",583:"Micronesia",90:"Solomon Islands",
    626:"Timor-Leste",776:"Tonga",548:"Vanuatu",882:"Samoa",
    // Rest of Europe
    51:"Armenia",112:"Belarus",70:"Bosnia and Herzegovina",268:"Georgia",
    352:"Iceland",499:"Montenegro",498:"Moldova",688:"Serbia",807:"Macedonia",
    // Middle East
    48:"Bahrain",512:"Oman",634:"Qatar",792:"Turkey",784:"UAE",
    // South America
    328:"Guyana",740:"Suriname",
    // Asia
    31:"Azerbaijan",96:"Brunei",458:"Malaysia",462:"Maldives",
    104:"Myanmar",702:"Singapore",762:"Tajikistan",860:"Uzbekistan",
    417:"Kyrgyzstan",
    // Caribbean
    28:"Antigua and Barbuda",52:"Barbados",84:"Belize",308:"Grenada",
    662:"Saint Lucia",670:"Saint Vincent and the Grenadines",
    678:"Sao Tome and Principe",780:"Trinidad and Tobago",
    // Africa extra
    72:"Botswana",132:"Cabo Verde",748:"Swaziland",686:"Senegal",
    480:"Mauritius",690:"Seychelles",
  };

  /* ── CSV country name → ISO id, built at draw time by cross-referencing ── */
  /* We match CSV names against ISO_NAME values with a robust fuzzy matcher  */

  function _csvNameToIsoId(csvName) {
    const cn = csvName.toLowerCase().trim()
      .replace(/\(.*?\)/g, "").replace(/\s+/g," ").trim(); // strip parentheticals

    // Direct / alias table for hard cases
    const ALIAS = {
      "united republic of tanzania": "834",
      "democratic republic of the congo": "180",
      "republic of the congo": "178", "congo": "178",
      "iran (islamic republic of)": "364",
      "syrian arab republic": "760",
      "lao people's democratic republic": "418",
      "united kingdom of great britain and northern ireland": "826",
      "united states of america": "840",
      "russian federation": "643",
      "republic of moldova": "498",
      "the former yugoslav republic of macedonia": "807",
      "bolivia (plurinational state of)": "68",
      "venezuela (bolivarian republic of)": "862",
      "micronesia (federated states of)": "583",
      "cote d'ivoire": "384",
      "czechia": "203",
      "czech republic": "203",
      "north korea": "408",
      "south korea": "410",
      "timor-leste": "626",
    };
    if (ALIAS[cn]) return ALIAS[cn];

    // Try to find a matching ISO_NAME entry
    for (const [id, isoName] of Object.entries(ISO_NAME)) {
      const in_ = isoName.toLowerCase().trim()
        .replace(/\(.*?\)/g,"").replace(/\s+/g," ").trim();
      if (in_ === cn) return id;
    }
    // Partial match
    for (const [id, isoName] of Object.entries(ISO_NAME)) {
      const in_ = isoName.toLowerCase().trim();
      if (in_.includes(cn) || cn.includes(in_)) return id;
    }
    return null;
  }

  /* ── Public init ──────────────────────────────────────────── */
  window.initPage1 = function initPage1() {
    _buildRegionSelect();
    _buildColorbar();
    _updateStats();

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

    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(_drawMap)
      .catch(function () {
        document.getElementById("p1-map-wrap").innerHTML =
          '<div class="map-no-data">World map requires internet access (cdn.jsdelivr.net/npm/world-atlas).<br>All other pages work fully offline.</div>';
      });
  };

  /* ── Build region dropdown ────────────────────────────────── */
  function _buildRegionSelect() {
    const sel = document.getElementById("p1-region-select");
    if (!sel) return;
    sel.innerHTML = '<option value="All">🌍 All Regions</option>';
    window.REGIONS.forEach(function (r) {
      const o = document.createElement("option");
      o.value = r; o.textContent = window.REGION_SHORT[r] || r;
      sel.appendChild(o);
    });
  }

  /* ── Draw map (once) ─────────────────────────────────────── */
  function _drawMap(world) {
    const svgEl = document.getElementById("p1-map-svg");
    W = svgEl.clientWidth || 960;
    H = 500;
    mapSvg = d3.select("#p1-map-svg").attr("viewBox", `0 0 ${W} ${H}`);

    baseScale     = W / 6.4;
    baseTranslate = [W / 2, H / 2];

    const proj = d3.geoNaturalEarth1().scale(baseScale).translate(baseTranslate);
    mapPath = d3.geoPath().projection(proj);

    const countries = topojson.feature(world, world.objects.countries);
    const borders   = topojson.mesh(world, world.objects.countries, (a,b) => a !== b);
    geoFeatures     = countries.features;

    /* Build isoId → region map from the CSV data */
    const seen = new Set();
    window.allData.forEach(function (row) {
      const id = _csvNameToIsoId(row.Country);
      if (id && !seen.has(id)) {
        isoToRegion[id] = row.Region;
        seen.add(id);
      }
    });

    /* Graticule */
    mapSvg.append("path").datum(d3.geoGraticule()())
      .attr("fill","none").attr("stroke","#1a1a2a")
      .attr("stroke-width",0.3).attr("d", mapPath);

    /* Map background (ocean) */
    mapSvg.insert("rect","g")
      .attr("width", W).attr("height", H)
      .attr("fill", "#080810");

    /* Main group */
    mapG = mapSvg.append("g").attr("class","map-g");

    const yd = window.getYearData(currentYear);

    mapG.selectAll(".country-path")
      .data(geoFeatures, d => d.id)
      .join("path")
      .attr("class","country-path")
      .attr("d", mapPath)
      .attr("fill",         d => _fill(d, yd))
      .attr("stroke",       d => _stroke(d))
      .attr("stroke-width", 0.4)
      .attr("pointer-events", d => _events(d))
      .on("mouseover", _onOver)
      .on("mousemove",  window.moveTooltip)
      .on("mouseout",   _onOut);

    mapG.append("path").datum(borders)
      .attr("class","borders-path")
      .attr("fill","none")
      .attr("stroke","#0d0d1a")
      .attr("stroke-width", 0.3)
      .attr("d", mapPath);
  }

  /* ── Per-path attribute helpers ──────────────────────────── */
  function _inRegion(d) {
    if (currentRegion === "All") return true;
    return isoToRegion[String(d.id)] === currentRegion;
  }

  function _fill(d, yd) {
    if (!_inRegion(d)) return "transparent";
    // Find the CSV row for this feature
    const isoId = String(d.id);
    const region = isoToRegion[isoId];
    if (!region) return "#1a1a2a";
    // Find matching data row
    const row = yd.find(r => _csvNameToIsoId(r.Country) === isoId);
    return row ? colorScale(row.Life_expectancy) : "#1a1a2a";
  }

  function _stroke(d) {
    return _inRegion(d) ? "#0d0d18" : "none";
  }

  function _events(d) {
    return _inRegion(d) ? "all" : "none";
  }

  /* ── Apply colors (year or region change) ─────────────────── */
  function _applyColors() {
    const yd = window.getYearData(currentYear);
    mapG.selectAll(".country-path")
      .transition().duration(650)
      .attr("fill",           d => _fill(d, yd))
      .attr("stroke",         d => _stroke(d))
      .attr("pointer-events", d => _events(d));
  }

  /* ── Pan + zoom to region ─────────────────────────────────── */
  function _panToRegion() {
    if (!mapG) return;

    // Apply visibility immediately
    _applyColors();

    if (currentRegion === "All") {
      mapG.transition().duration(900).ease(d3.easeCubicInOut)
        .attr("transform", null);
      mapG.selectAll(".country-path")
        .transition().duration(900).attr("stroke-width", 0.4);
      mapG.select(".borders-path")
        .transition().duration(900).attr("stroke-width", 0.3);
      return;
    }

    // Collect features belonging to this region
    const regionFeatures = geoFeatures.filter(d => _inRegion(d));
    if (!regionFeatures.length) return;

    // Fit a projection to those features
    const pad = 50;
    const fitProj = d3.geoNaturalEarth1()
      .fitExtent([[pad, pad], [W - pad, H - pad]],
                 { type: "FeatureCollection", features: regionFeatures });

    const k  = fitProj.scale() / baseScale;
    const tx = fitProj.translate()[0] - k * baseTranslate[0];
    const ty = fitProj.translate()[1] - k * baseTranslate[1];

    mapG.transition().duration(900).ease(d3.easeCubicInOut)
      .attr("transform", `translate(${tx},${ty}) scale(${k})`);

    mapG.selectAll(".country-path")
      .transition().duration(900).attr("stroke-width", 0.4 / k);
    mapG.select(".borders-path")
      .transition().duration(900).attr("stroke-width", 0.3 / k);
  }

  /* ── Tooltip ─────────────────────────────────────────────── */
  function _onOver(event, d) {
    const isoId = String(d.id);
    const yd  = window.getYearData(currentYear);
    const row = yd.find(r => _csvNameToIsoId(r.Country) === isoId);
    if (!row) return;

    window.showTooltip(
      `<div class="tt-country">${row.Country}</div>
       <div class="tt-region">${window.REGION_SHORT[row.Region]||row.Region} · ${currentYear}</div>
       <hr class="tt-divider">
       <div class="tt-row"><span class="tt-label">Life Expectancy</span><span class="tt-value">${window.fmt(row.Life_expectancy)} yrs</span></div>
       <div class="tt-row"><span class="tt-label">GDP per Capita</span><span class="tt-value">${window.fmtK(row.GDP_per_capita)}</span></div>
       <div class="tt-row"><span class="tt-label">Infant Mortality</span><span class="tt-value">${window.fmt(row.Infant_deaths)}/1k</span></div>
       <div class="tt-row"><span class="tt-label">Population</span><span class="tt-value">${window.fmt(row.Population_mln,2)}M</span></div>`,
      event
    );
    const k = _currentK();
    d3.select(this).raise()
      .attr("stroke","rgba(255,255,255,0.8)")
      .attr("stroke-width", 1.5 / k);
  }

  function _onOut() {
    window.hideTooltip();
    const k = _currentK();
    d3.select(this)
      .attr("stroke", d => _stroke(d))
      .attr("stroke-width", 0.4 / k);
  }

  function _currentK() {
    if (!mapG) return 1;
    const t = mapG.attr("transform");
    if (!t) return 1;
    const m = t.match(/scale\(([\d.eE+\-]+)\)/);
    return m ? +m[1] : 1;
  }

  /* ── Stat cards ───────────────────────────────────────────── */
  function _updateStats() {
    let yd = window.getYearData(currentYear);
    if (currentRegion !== "All") yd = yd.filter(r => r.Region === currentRegion);
    if (!yd.length) return;

    const avg    = d3.mean(yd, d => d.Life_expectancy);
    const maxVal = d3.max(yd,  d => d.Life_expectancy);
    const minVal = d3.min(yd,  d => d.Life_expectancy);
    const maxC   = yd.find(d => d.Life_expectancy === maxVal);
    const minC   = yd.find(d => d.Life_expectancy === minVal);

    let prevYd = window.getYearData(currentYear - 1);
    if (currentRegion !== "All") prevYd = prevYd.filter(r => r.Region === currentRegion);
    const prevAvg  = prevYd.length ? d3.mean(prevYd, d => d.Life_expectancy) : avg;
    const trend    = +(avg - prevAvg).toFixed(2);
    const trendStr = (trend >= 0 ? "+" : "") + trend;
    const trendCol = trend >= 0 ? "#40d0a0" : "#e84545";

    document.getElementById("p1-stats").innerHTML = `
      <div class="stat-card">
        <div class="stat-card-label">Avg Life Expectancy</div>
        <div class="stat-card-value">${window.fmt(avg)}</div>
        <div class="stat-card-sub" style="color:${trendCol}">${trendStr} vs prev year</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Highest · ${currentYear}</div>
        <div class="stat-card-value">${window.fmt(maxVal)}</div>
        <div class="stat-card-sub">${maxC ? maxC.Country : "—"}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Lowest · ${currentYear}</div>
        <div class="stat-card-value">${window.fmt(minVal)}</div>
        <div class="stat-card-sub">${minC ? minC.Country : "—"}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Countries in view</div>
        <div class="stat-card-value">${yd.length}</div>
        <div class="stat-card-sub">${currentRegion === "All" ? "9 regions" : (window.REGION_SHORT[currentRegion]||currentRegion)}</div>
      </div>`;
  }

  /* ── Colorbar ─────────────────────────────────────────────── */
  function _buildColorbar() {
    const cb   = d3.select("#p1-colorbar");
    const defs = cb.append("defs");
    const grad = defs.append("linearGradient").attr("id","cb-grad").attr("x1","0%").attr("x2","100%");
    for (let i = 0; i <= 10; i++) {
      grad.append("stop").attr("offset", i*10+"%").attr("stop-color", colorScale(40 + i*4.5));
    }
    cb.append("rect").attr("width","100%").attr("height",14).attr("rx",3).attr("fill","url(#cb-grad)");
  }

})();
