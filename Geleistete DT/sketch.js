const titleLookup = {
  de: "Geleistete Diensttage",
  fr: "Jours de service effectués",
  it: "Giorni di servizio prestati"
}

// Couleur officielle "jours de service" (DT / Diensttage).
const COLOR_DT = "#5A959D";  // accent1 — petrol, intensité max
const LIGHT_DT = "#E1ECED";  // petrol très clair — intensité min

// ============================================================
// URL params (remplace p5.getURLParams, non utilise autrement ici)
// ============================================================

function getURLParams() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(params.entries());
}

// ============================================================
// Init & resize (remplace les hooks de cycle de vie p5)
// ============================================================

function init() {
  const params = getURLParams();
  const title = titleLookup[params.lang];

  d3.select("#titleContainer").text(title);

  drawChart();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", drawChart);

// --- Formatage suisse : 1'891'738 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// --- Axe des y (0 à 2'000'000) avec repères discrets ---
function drawYAxis(g, y, innerWidth, isMobile) {
  const yTicks = [0, 500000, 1000000, 1500000, 2000000];

  g.append("g")
    .attr("class", "grid")
    .selectAll("line")
    .data(yTicks)
    .enter()
    .append("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", d => y(d))
    .attr("y2", d => y(d))
    .attr("stroke", "#e5e5e5")
    .attr("stroke-width", 1);

  g.append("g")
    .attr("class", "y-axis")
    .call(
      d3.axisLeft(y)
        .tickValues(yTicks)
        .tickFormat(d => formatSwiss(d))
        .tickSize(0)
    )
    .call(axisG => axisG.select(".domain").remove())
    .selectAll("text")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10.5px" : "12.5px")
    .style("fill", "#555");
}

// --- Barres avec animation d'apparition ---
function drawBars(g, data, x, y, innerHeight, barColor) {
  const bars = g.selectAll("rect.bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.year))
    .attr("width", x.bandwidth())
    .attr("y", innerHeight)
    .attr("height", 0)
    .attr("fill", barColor);

  bars.transition()
    .delay((d, i) => i * 20)
    .duration(700)
    .ease(d3.easeCubicOut)
    .attr("y", d => y(d.value))
    .attr("height", d => innerHeight - y(d.value));
}

// --- Valeur au survol uniquement ---
function createTooltip(svg, width) {
  const tooltip = svg.append("g").style("opacity", 0).style("pointer-events", "none");
  const tooltipRect = tooltip.append("rect")
    .attr("fill", "white")
    .attr("stroke", COLOR_DT)
    .attr("stroke-width", 1.5)
    .attr("rx", 5);
  const tooltipText = tooltip.append("text")
    .style("font-family", "Arial")
    .style("font-size", "13.5px")
    .style("font-weight", "bold")
    .style("fill", "#111");

  function showTooltip(event, d) {
    const [mx, my] = d3.pointer(event, svg.node());
    tooltipText.text(`${d.year} – ${formatSwiss(d.value)}`);

    const bbox = tooltipText.node().getBBox();
    const padX = 10, padY = 7;
    const boxW = bbox.width + padX * 2;
    const boxH = bbox.height + padY * 2;

    let tx = mx + 16;
    let ty = my - boxH - 14;
    if (tx + boxW > width) tx = mx - boxW - 16;
    if (ty < 0) ty = my + 16;

    tooltip.attr("transform", `translate(${tx}, ${ty})`);
    tooltipRect.attr("width", boxW).attr("height", boxH);
    tooltipText.attr("x", padX).attr("y", padY + bbox.height * 0.78);
    tooltip.style("opacity", 1);
  }

  return { tooltip, showTooltip };
}

// --- Survol par colonne : met en évidence + affiche la bulle ---
function highlight(g, year) {
  g.selectAll(".bar").transition().duration(150)
    .style("opacity", d => (year === null || d.year === year) ? 1 : 0.35);
}

function attachHover(g, data, x, innerHeight, margin, tooltip, showTooltip) {
  g.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", d => x(d.year) - (x.step() - x.bandwidth()) / 2)
    .attr("y", 0)
    .attr("width", x.step())
    .attr("height", innerHeight + margin.bottom)
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => { highlight(g, d.year); showTooltip(event, d); })
    .on("mousemove", (event, d) => showTooltip(event, d))
    .on("mouseout", () => { highlight(g, null); tooltip.style("opacity", 0); });
}

function drawChart() {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const isMobile = containerWidth < 600;

  d3.csv("BEZ_DT_geleistet_2025.csv").then(raw => {

    const data = raw
      .map(d => ({ year: d["Jahr"], value: +d["Diensttage"] }))
      .sort((a, b) => a.year - b.year);

    // Marges et hauteur figées : ce fichier est calibré pour tenir dans
    // le cadre iframe LivingDocs (max 1000×500px), pas pour être fluide
    // sur toutes les tailles d'écran comme la version originale.
    const margin = {
      top: 14,
      right: isMobile ? 10 : 20,
      bottom: 26,
      left: isMobile ? 50 : 72
    };

    // Embed compact : pas de largeur minimale forcée / scroll horizontal
    // (peu exploitable dans une iframe LivingDocs) — les barres se
    // compressent pour que toutes les années restent toujours visibles.
    const innerWidth = containerWidth - margin.left - margin.right;
    const width = containerWidth;

    const innerHeight = 350;
    const height = margin.top + innerHeight + margin.bottom;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const maxVal = d3.max(data, d => d.value);
    const minVal = d3.min(data, d => d.value);

    const x = d3.scaleBand()
      .domain(data.map(d => d.year))
      .range([0, innerWidth])
      .padding(0.25);

    const y = d3.scaleLinear()
      .domain([0, 2000000])
      .range([innerHeight, 0]);

    drawYAxis(g, y, innerWidth, isMobile);

    const colorScale = d3.scaleSqrt().domain([minVal, maxVal]).range([0, 1]);
    const barColor = d => d3.interpolate(LIGHT_DT, COLOR_DT)(colorScale(d.value));

    drawBars(g, data, x, y, innerHeight, barColor);

    const { tooltip, showTooltip } = createTooltip(svg, width);

    // --- Années sous les barres : une sur cinq pour rester lisible ---
    g.selectAll("text.label")
      .data(data.filter(d => d.year % 5 === 0))
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", d => x(d.year) + x.bandwidth() / 2)
      .attr("y", innerHeight + 18)
      .attr("text-anchor", "middle")
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "11px" : "12.5px")
      .style("fill", "#111")
      .text(d => d.year);

    attachHover(g, data, x, innerHeight, margin, tooltip, showTooltip);
  });
}
