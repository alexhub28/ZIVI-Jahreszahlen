// ============================================================
// Configuration
// ============================================================

// Couleurs officielles ZIVI. Le petrol est reserve aux jours de service
// (DT), le jaune/lila au graphique Einsatzbetriebe/Einsatzplaetze -
// Inspections utilise ici mint (accent2) / kiwi (accent4).
//
// Degrade leger : l'intensite min reste dans la meme famille de teinte
// que la base (pas de blanc pur), mais l'ecart est un peu plus marque
// qu'un simple effleurement, pour que le degrade reste perceptible sans
// devenir dur. Le contour (une teinte plus soutenue que l'intensite
// max) donne un peu de definition aux bords de chaque segment.
const BASE_ANN = "#CAE7EA";     // mint officiel - intensite max (Angekuendigt)
const LIGHT_ANN = "#DAEEF0";    // mint eclairci - intensite min
const STROKE_ANN = "#8FB8BC";   // contour, plus soutenu que BASE_ANN

const BASE_UNANN = "#B1B488";   // kiwi officiel - intensite max (Unangekuendigt)
const LIGHT_UNANN = "#CCCEB2";  // kiwi eclairci - intensite min
const STROKE_UNANN = "#9A9D74"; // contour, plus soutenu que BASE_UNANN

const DATA_FILE = "ABI_Inspektionen_2025.csv";
const MOBILE_BREAKPOINT = 600;
const Y_AXIS_HEADROOM = 1.12;
const LEGEND_HEIGHT = 40;
const MIN_INSIDE_LABEL_HEIGHT = 26; // en dessous, l'etiquette sort du segment

const titleLookup = {
  de: "Inspektionen",
  fr: "Inspections",
  it: "Ispezioni"
};

// Une seule langue affichee a la fois (selon ?lang=), jamais les trois
// versions ensemble.
const legendLookup = {
  de: [
    { color: BASE_ANN, text: "Angekündigt" },
    { color: BASE_UNANN, text: "Unangekündigt" }
  ],
  fr: [
    { color: BASE_ANN, text: "Annoncées" },
    { color: BASE_UNANN, text: "Non annoncées" }
  ],
  it: [
    { color: BASE_ANN, text: "Annunciate" },
    { color: BASE_UNANN, text: "Non annunciate" }
  ]
};

// Langue courante, determinee au demarrage depuis ?lang= (par defaut "de").
let currentLang = "de";

// ============================================================
// URL params
// ============================================================

function getURLParams() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(params.entries());
}

// ============================================================
// Data
// ============================================================

function parseData(raw) {
  return raw
    .map(d => ({
      year: d["Jahr"],
      ann: +d["Angekuendigt"],
      unann: +d["Unangekuendigt"],
      total: +d["Total"]
    }))
    .sort((a, b) => a.year - b.year);
}

// Formatage suisse : 1'163
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// ============================================================
// Layout & scales
// ============================================================

function computeLayout(containerWidth, isMobile) {
  const margin = {
    top: LEGEND_HEIGHT + 14,
    right: isMobile ? 10 : 20,
    bottom: 24,
    left: isMobile ? 10 : 20
  };

  const innerWidth = containerWidth - margin.left - margin.right;
  const innerHeight = 320;
  const width = containerWidth;
  const height = margin.top + innerHeight + margin.bottom;

  return { margin, innerWidth, innerHeight, width, height };
}

function createScales(data, layout) {
  const maxTotal = d3.max(data, d => d.total);

  const x = d3.scaleBand()
    .domain(data.map(d => d.year))
    .range([0, layout.innerWidth])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, maxTotal * Y_AXIS_HEADROOM])
    .range([layout.innerHeight, 0]);

  const annIntensity = d3.scaleLinear()
    .domain([d3.min(data, d => d.ann), d3.max(data, d => d.ann)])
    .range([0, 1]);

  const unannIntensity = d3.scaleLinear()
    .domain([d3.min(data, d => d.unann), d3.max(data, d => d.unann)])
    .range([0, 1]);

  return { x, y, annIntensity, unannIntensity };
}

function getAnnColor(value, scales) {
  return d3.interpolate(LIGHT_ANN, BASE_ANN)(scales.annIntensity(value));
}

function getUnannColor(value, scales) {
  return d3.interpolate(LIGHT_UNANN, BASE_UNANN)(scales.unannIntensity(value));
}

// ============================================================
// Legend
// ============================================================

function drawLegend(svg, margin, isMobile) {
  const legend = svg.append("g")
    .attr("transform", `translate(${margin.left}, 6)`);

  const legendItems = legendLookup[currentLang];

  legendItems.forEach((item, i) => {
    const rowX = isMobile ? 0 : i * 260;
    const rowY = isMobile ? i * 18 : 0;
    const row = legend.append("g").attr("transform", `translate(${rowX}, ${rowY})`);

    row.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", item.color);

    row.append("text")
      .attr("x", 18)
      .attr("y", 10)
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "11.5px" : "13.5px")
      .style("fill", "#111")
      .text(item.text);
  });
}

// ============================================================
// Stacked columns
// ============================================================

function drawColumns(g, data, scales, layout, isMobile) {
  data.forEach((d, i) => {
    const col = g.append("g").attr("class", "col");
    col.datum(d);

    drawAnnSegment(col, d, i, scales, layout);
    drawUnannSegment(col, d, i, scales, layout);
    drawAnnLabel(col, d, scales, layout, isMobile);
    drawUnannLabel(col, d, scales, layout, isMobile);
    drawTotalLabel(col, d, i, scales, layout, isMobile);
    drawYearLabel(col, d, scales.x, layout, isMobile);
    attachHoverArea(col, d, g, scales.x, layout);
  });
}

function drawAnnSegment(col, d, i, scales, layout) {
  const { x, y } = scales;
  const { innerHeight } = layout;
  const barX = x(d.year);
  const barW = x.bandwidth();
  const yAnnTop = y(d.ann);

  col.append("rect")
    .attr("class", "bar")
    .attr("x", barX)
    .attr("width", barW)
    .attr("y", innerHeight)
    .attr("height", 0)
    .attr("fill", getAnnColor(d.ann, scales))
    .attr("stroke", STROKE_ANN)
    .attr("stroke-width", 1)
    .transition()
    .delay(i * 80)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("y", yAnnTop)
    .attr("height", innerHeight - yAnnTop);
}

function drawUnannSegment(col, d, i, scales, layout) {
  const { x, y } = scales;
  const { innerHeight } = layout;
  const barX = x(d.year);
  const barW = x.bandwidth();
  const yAnnTop = y(d.ann);
  const yTotalTop = y(d.total);

  col.append("rect")
    .attr("class", "bar")
    .attr("x", barX)
    .attr("width", barW)
    .attr("y", innerHeight)
    .attr("height", 0)
    .attr("fill", getUnannColor(d.unann, scales))
    .attr("stroke", STROKE_UNANN)
    .attr("stroke-width", 1)
    .transition()
    .delay(i * 80)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("y", yTotalTop)
    .attr("height", yAnnTop - yTotalTop);
}

// Valeurs par segment masquees par defaut, revelees uniquement au
// survol de la colonne (cf. highlightColumn()).

function drawAnnLabel(col, d, scales, layout, isMobile) {
  const { x, y } = scales;
  const { innerHeight } = layout;
  const barX = x(d.year);
  const barW = x.bandwidth();
  const yAnnTop = y(d.ann);

  const annHeight = innerHeight - yAnnTop;
  const annInside = annHeight > MIN_INSIDE_LABEL_HEIGHT;
  const fontSize = isMobile ? 10.5 : 12.5;
  const labelY = annInside ? (innerHeight + yAnnTop) / 2 : yAnnTop - 6;
  const labelX = barX + barW / 2;

  // Quand le segment est trop petit pour contenir le texte, un petit
  // badge est ajoute derriere pour garder le contraste avec le fond.
  if (!annInside) {
    drawLabelBadge(col, formatSwiss(d.ann), labelX, labelY, fontSize, getAnnColor(d.ann, scales), STROKE_ANN);
  }

  col.append("text")
    .attr("class", "value segval")
    .attr("x", labelX)
    .attr("y", labelY)
    .attr("dominant-baseline", "middle")
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", fontSize + "px")
    .style("font-weight", "bold")
    .style("fill", "#111")
    .style("opacity", 0)
    .text(formatSwiss(d.ann));
}

function drawLabelBadge(col, text, cx, cy, fontSize, fill, stroke) {
  const digitWidth = fontSize * 0.62;
  const badgeWidth = text.length * digitWidth + 10;
  const badgeHeight = fontSize + 8;

  col.append("rect")
    .attr("class", "segval")
    .attr("x", cx - badgeWidth / 2)
    .attr("y", cy - badgeHeight / 2)
    .attr("width", badgeWidth)
    .attr("height", badgeHeight)
    .attr("rx", 3)
    .attr("fill", fill)
    .attr("stroke", stroke)
    .attr("stroke-width", 1)
    .style("opacity", 0);
}

function drawUnannLabel(col, d, scales, layout, isMobile) {
  const { x, y } = scales;
  const barX = x(d.year);
  const barW = x.bandwidth();
  const yAnnTop = y(d.ann);
  const yTotalTop = y(d.total);

  const unannHeight = yAnnTop - yTotalTop;
  const unannInside = unannHeight > MIN_INSIDE_LABEL_HEIGHT;
  const labelY = unannInside ? (yAnnTop + yTotalTop) / 2 : yTotalTop - 6;

  col.append("text")
    .attr("class", "value segval")
    .attr("x", barX + barW / 2)
    .attr("y", labelY)
    .attr("dominant-baseline", "middle")
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10.5px" : "12.5px")
    .style("font-weight", "bold")
    .style("fill", "#111")
    .style("opacity", 0)
    .text(formatSwiss(d.unann));
}

function drawTotalLabel(col, d, i, scales, layout, isMobile) {
  const { x, y } = scales;
  const barX = x(d.year);
  const barW = x.bandwidth();
  const yTotalTop = y(d.total);

  col.append("text")
    .attr("class", "value total")
    .attr("x", barX + barW / 2)
    .attr("y", yTotalTop - 8)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "11.5px" : "13.5px")
    .style("font-weight", "bold")
    .style("fill", "#111")
    .style("opacity", 0)
    .text(formatSwiss(d.total))
    .transition()
    .delay(i * 80 + 800)
    .duration(300)
    .style("opacity", 1);
}

function drawYearLabel(col, d, x, layout, isMobile) {
  const barX = x(d.year);
  const barW = x.bandwidth();

  col.append("text")
    .attr("class", "label")
    .attr("x", barX + barW / 2)
    .attr("y", layout.innerHeight + 22)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "11.5px" : "13.5px")
    .style("fill", "#111")
    .text(d.year);
}

// ============================================================
// Interaction
// ============================================================

function attachHoverArea(col, d, g, x, layout) {
  const barX = x(d.year);

  col.append("rect")
    .attr("class", "hit")
    .attr("x", barX - (x.step() - x.bandwidth()) / 2)
    .attr("y", 0)
    .attr("width", x.step())
    .attr("height", layout.innerHeight + layout.margin.bottom)
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", () => highlightColumn(g, d.year))
    .on("mouseout", () => highlightColumn(g, null));
}

function highlightColumn(g, year) {
  g.selectAll(".col")
    .transition()
    .duration(150)
    .style("opacity", cd => (year === null || cd.year === year) ? 1 : 0.3);

  g.selectAll(".segval")
    .transition()
    .duration(150)
    .style("opacity", function () {
      const cd = d3.select(this.parentNode).datum();
      return (year !== null && cd.year === year) ? 1 : 0;
    });
}

// ============================================================
// Orchestration
// ============================================================

function drawChart() {
  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const isMobile = containerWidth < MOBILE_BREAKPOINT;

  d3.csv(DATA_FILE).then(raw => {
    const data = parseData(raw);
    const layout = computeLayout(containerWidth, isMobile);
    const scales = createScales(data, layout);

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", layout.width)
      .attr("height", layout.height);

    drawLegend(svg, layout.margin, isMobile);

    const g = svg.append("g")
      .attr("transform", `translate(${layout.margin.left}, ${layout.margin.top})`);

    drawColumns(g, data, scales, layout, isMobile);
  });
}

// ============================================================
// Entry point
// ============================================================

// Script D3 pur (pas de p5) : charge en "defer" dans index.html, donc
// le DOM est deja pret quand ce code s'execute.
function init() {
  const params = getURLParams();
  currentLang = params.lang || currentLang;

  d3.select("#titleContainer").text(titleLookup[currentLang]);

  drawChart();
}

init();
window.addEventListener("resize", drawChart);
