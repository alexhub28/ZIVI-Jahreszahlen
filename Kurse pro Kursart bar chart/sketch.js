// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "2025: Kurse pro Kursart",
  fr: "2025 : Cours par genre de cours",
  it: "2025: Corsi per genere del corso"
};

// Plus de 5 catégories : palette fixe à 5 couleurs (comme Rechtsdienst),
// reprise par cycle dans l'ordre des barres (triées par valeur décroissante).
const PALETTE = ["#5A959D", "#A3A8CA", "#CAE7EA", "#B1B488", "#FCEB30"];

// Langue courante, determinee au demarrage depuis ?lang= (par defaut "de").
let currentLang = "de";

function getURLParams() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(params.entries());
}

// ============================================================
// Init & resize
// ============================================================

function init() {
  const params = getURLParams();
  currentLang = params.lang || currentLang;

  d3.select("#titleContainer").text(titleLookup[currentLang]);

  drawChart();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", drawChart);

// --- Formatage suisse : 1'234 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// --- Typographie numérique suisse : point décimal (55.4 %) ---
function formatPercent(p) {
  return p.toFixed(1) + " %";
}

// ============================================================
// Barres, étiquettes, labels
// ============================================================

// --- Barres avec animation d'apparition ---
function drawBars(g, data, x, y, barColor) {
  const bars = g.selectAll("rect.bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("y", d => y(d.label))
    .attr("height", y.bandwidth())
    .attr("width", 0)
    .attr("fill", barColor);

  bars.transition()
    .delay((d, i) => i * 80)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("width", d => x(d.value));
}

// --- Étiquette "%" au bout de chaque barre, compteur animé ; la valeur
// brute s'affiche entre parenthèses uniquement au survol de la ligne. ---
function drawValueLabels(g, data, x, y, total, isMobile) {
  const valueLabels = g.selectAll("text.value")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value")
    .attr("x", 8)
    .attr("y", d => y(d.label) + y.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10px" : "12px")
    .style("font-weight", "normal")
    .style("fill", "#111");

  valueLabels.append("tspan").attr("class", "pct-value").text("0 %");
  valueLabels.append("tspan")
    .attr("class", "count-value")
    .style("opacity", 0)
    .text(d => ` (${formatSwiss(d.value)})`);

  valueLabels.transition()
    .delay((d, i) => i * 80)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("x", d => x(d.value) + 8)
    .tween("text", function (d) {
      const pct = (d.value / total) * 100;
      const iPct = d3.interpolateNumber(0, pct);
      const pctSpan = d3.select(this).select("tspan.pct-value");
      return t => pctSpan.text(formatPercent(iPct(t)));
    });
}

// --- Labels à gauche (une seule langue par CSV) ---
function drawRowLabels(g, data, y, isMobile) {
  g.selectAll("text.label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", -10)
    .attr("y", d => y(d.label) + y.bandwidth() / 2)
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10px" : "12px")
    .style("font-weight", "normal")
    .style("fill", "#333")
    .text(d => d.label);
}

// ============================================================
// Interaction
// ============================================================

// --- Survol par ligne : met en évidence label + barre + valeur, révèle
// la valeur brute entre parenthèses (cachée par défaut). ---
function highlight(g, label) {
  g.selectAll(".bar, .value")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3);

  g.selectAll(".count-value")
    .transition().duration(150)
    .style("opacity", d => (label !== null && d.label === label) ? 1 : 0);

  // Label survolé : noir plus franc + gras (pas d'agrandissement,
  // pour ne pas risquer de chevaucher les lignes voisines).
  g.selectAll(".label")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3)
    .style("font-weight", d => (label !== null && d.label === label) ? "bold" : "normal")
    .style("fill", d => (label !== null && d.label === label) ? "#000" : "#333");
}

function attachHoverAreas(g, data, y, margin, innerWidth) {
  g.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", -margin.left)
    .attr("y", d => y(d.label) - (y.step() - y.bandwidth()) / 2)
    .attr("width", innerWidth + margin.left + margin.right)
    .attr("height", y.step())
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => highlight(g, d.label))
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

  d3.csv("data_" + currentLang + ".csv").then(raw => {

    const data = raw.map(d => ({ label: d.Label, value: +d.Value }));
    const total = d3.sum(data, d => d.value);
    const maxVal = d3.max(data, d => d.value);

    data.sort((a, b) => b.value - a.value);

    // Hauteur de ligne augmentée pour laisser assez d'air aux labels
    // trilingues sur 3 lignes ; marges haut/bas resserrées pour compenser.
    const rowHeight = 43;
    const margin = {
      top: 6,
      right: isMobile ? 70 : 110,
      bottom: 6,
      left: isMobile ? 190 : 420
    };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = data.length * rowHeight;
    const height = margin.top + innerHeight + margin.bottom;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const x = d3.scaleLinear()
      .domain([0, maxVal * 1.12])
      .range([0, innerWidth]);

    const y = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, innerHeight])
      .padding(0.3);

    const barColor = (d, i) => PALETTE[i % PALETTE.length];

    drawBars(g, data, x, y, barColor);
    drawValueLabels(g, data, x, y, total, isMobile);
    drawRowLabels(g, data, y, isMobile);
    attachHoverAreas(g, data, y, margin, innerWidth);
  });
}
