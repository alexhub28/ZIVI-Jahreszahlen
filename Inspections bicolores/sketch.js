// Couleurs officielles ZIVI. Le petrol est réservé aux jours de service
// (DT), le jaune/lila au graphique Einsatzbetriebe/Einsatzplätze — pour
// éviter toute confusion entre variables sans rapport, Inspections utilise
// ici mint (accent2) / kiwi (accent4), un duo non utilisé ensemble ailleurs.
// Version BICOLORE : une couleur fixe par série, sans dégradé
// d'intensité en fonction de la valeur (contrairement à la version
// principale du dossier parent).
const BASE_ANN = "#CAE7EA";    // accent2 — mint (Angekündigt)
const BASE_UNANN = "#B1B488";  // accent4 — kiwi (Unangekündigt)

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
  currentLang = params.lang || currentLang;

  d3.select("#titleContainer").text(titleLookup[currentLang]);

  drawChart();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", drawChart);

// --- Formatage suisse : 1'163 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// ============================================================
// Barres empilées
// ============================================================

// Segment Angekündigt (bas)
function drawAnnSegment(col, d, i, scales, layout) {
  const { x, y } = scales;
  const { innerHeight } = layout;
  const barX = x(d.year);
  const barW = x.bandwidth();
  const yAnnTop = y(d.ann);

  const rectAnn = col.append("rect")
    .attr("class", "bar")
    .attr("x", barX)
    .attr("width", barW)
    .attr("y", innerHeight)
    .attr("height", 0)
    .attr("fill", BASE_ANN)
    .attr("stroke", "#8FB8BC")
    .attr("stroke-width", 1);

  rectAnn.transition()
    .delay(i * 80)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("y", yAnnTop)
    .attr("height", innerHeight - yAnnTop);
}

// Segment Unangekündigt (haut, empilé)
function drawUnannSegment(col, d, i, scales, layout) {
  const { x, y } = scales;
  const { innerHeight } = layout;
  const barX = x(d.year);
  const barW = x.bandwidth();
  const yAnnTop = y(d.ann);
  const yTotalTop = y(d.total);

  const rectUnann = col.append("rect")
    .attr("class", "bar")
    .attr("x", barX)
    .attr("width", barW)
    .attr("y", innerHeight)
    .attr("height", 0)
    .attr("fill", BASE_UNANN)
    .attr("stroke", "#9A9D74")
    .attr("stroke-width", 1);

  rectUnann.transition()
    .delay(i * 80)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("y", yTotalTop)
    .attr("height", yAnnTop - yTotalTop);
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

function drawAnnLabel(col, d, scales, layout, isMobile) {
  const { x, y } = scales;
  const { innerHeight } = layout;
  const barX = x(d.year);
  const barW = x.bandwidth();
  const yAnnTop = y(d.ann);

  // Valeurs Angekündigt / Unangekündigt : masquées par défaut,
  // révélées uniquement au survol de la colonne (cf. highlight()).
  // Position à l'intérieur du segment s'il est assez grand, sinon juste au-dessus.
  const annHeight = innerHeight - yAnnTop;
  const annInside = annHeight > 26;
  const annFontSize = isMobile ? 10.5 : 12.5;
  const annY = annInside ? (innerHeight + yAnnTop) / 2 : yAnnTop - 6;
  const annCx = barX + barW / 2;

  // Toujours en blanc : quand le segment est trop petit pour contenir le
  // texte, on ajoute un petit badge petrol derrière pour garder le contraste.
  if (!annInside) {
    drawLabelBadge(col, formatSwiss(d.ann), annCx, annY, annFontSize, BASE_ANN, "#8FB8BC");
  }

  col.append("text")
    .attr("class", "value segval")
    .attr("x", annCx)
    .attr("y", annY)
    .attr("dominant-baseline", "middle")
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", annFontSize + "px")
    .style("font-weight", "bold")
    .style("fill", "#111")
    .style("opacity", 0)
    .text(formatSwiss(d.ann));
}

function drawUnannLabel(col, d, scales, layout, isMobile) {
  const { x, y } = scales;
  const barX = x(d.year);
  const barW = x.bandwidth();
  const yAnnTop = y(d.ann);
  const yTotalTop = y(d.total);

  const unannHeight = yAnnTop - yTotalTop;
  const unannInside = unannHeight > 26;

  col.append("text")
    .attr("class", "value segval")
    .attr("x", barX + barW / 2)
    .attr("y", unannInside ? (yAnnTop + yTotalTop) / 2 : yTotalTop - 6)
    .attr("dominant-baseline", "middle")
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10.5px" : "12.5px")
    .style("font-weight", "bold")
    .style("fill", "#111")
    .style("opacity", 0)
    .text(formatSwiss(d.unann));
}

// Total, au-dessus de la barre entière
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

// Année sous la barre
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

// ============================================================
// Interaction
// ============================================================

// --- Survol par colonne : met en évidence une année et révèle le détail ---
function highlight(g, year) {
  g.selectAll(".col").transition().duration(150)
    .style("opacity", cd => (year === null || cd.year === year) ? 1 : 0.3);

  g.selectAll(".segval").transition().duration(150)
    .style("opacity", function () {
      const cd = d3.select(this.parentNode).datum();
      return (year !== null && cd.year === year) ? 1 : 0;
    });
}

// Zone de survol
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
    .on("mouseover", () => highlight(g, d.year))
    .on("mouseout", () => highlight(g, null));
}

// ============================================================
// Orchestration
// ============================================================

function drawChart() {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const width = containerWidth;
  const isMobile = width < 600;

  d3.csv("ABI_Inspektionen_2025.csv").then(raw => {

    const data = raw
      .map(d => ({
        year: d["Jahr"],
        ann: +d["Angekuendigt"],
        unann: +d["Unangekuendigt"],
        total: +d["Total"]
      }))
      .sort((a, b) => a.year - b.year);

    const legendHeight = 40;
    const margin = {
      top: legendHeight + 14,
      right: isMobile ? 10 : 20,
      bottom: 24,
      left: isMobile ? 10 : 20
    };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = 320;
    const height = margin.top + innerHeight + margin.bottom;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    // --- Légende (puces carrées, langue courante uniquement) — en haut, avant le graphique ---
    const legend = svg.append("g")
      .attr("transform", `translate(${margin.left}, 6)`);

    const legendItems = legendLookup[currentLang];

    legendItems.forEach((item, i) => {
      const row = legend.append("g").attr("transform", `translate(${i * (isMobile ? 0 : 260)}, ${isMobile ? i * 18 : 0})`);
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

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const maxTotal = d3.max(data, d => d.total);

    const x = d3.scaleBand()
      .domain(data.map(d => d.year))
      .range([0, innerWidth])
      .padding(0.3);

    const y = d3.scaleLinear()
      .domain([0, maxTotal * 1.12])
      .range([innerHeight, 0]);

    // Couleur fixe par série, indépendante de la valeur.
    const scales = { x, y };
    const layout = { margin, innerWidth, innerHeight };

    drawColumns(g, data, scales, layout, isMobile);
  });
}
