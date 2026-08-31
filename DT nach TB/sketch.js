// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "2025: Diensttage nach Tätigkeitsbereich",
  fr: "2025 : Jours de service par domaine d'activité",
  it: "2025: Giorni di servizio per ambiti d’attività"
};

// Titre de l'axe X, une seule langue a la fois.
const axisTitleLookup = {
  de: "Diensttage",
  fr: "Jours de service",
  it: "Giorni di servizio"
};

// Dégradé Petrol par valeur — le petrol est déjà la couleur "jours de
// service" ailleurs (ligne Rechtsdienst, DT geleistet). Une seule teinte,
// du clair (petit domaine) au foncé (grand domaine), plutôt que 8 couleurs
// disparates : cohérent avec le principe utilisé pour Kurse pro Kursart
// (dégradé rouge). Les deux bornes sont des couleurs officielles de la
// charte (Petrol 100 % et Petrol 20 %).
const BASE_PETROL = "#5A959D";  // Petrol 100 %
const LIGHT_PETROL = "#deeaeb"; // Petrol 20 %

function buildColorScale(data) {
  const minVal = d3.min(data, d => d.Value);
  const maxVal = d3.max(data, d => d.Value);
  const scale = d3.scaleSqrt().domain([minVal, maxVal]).range([0, 1]);
  return d => d3.interpolate(LIGHT_PETROL, BASE_PETROL)(scale(d.Value));
}

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

// --- Formatage suisse : 952'491 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// --- Typographie numérique suisse : point décimal, pas de virgule (50.4 %) ---
function formatPercent(p) {
  return p.toFixed(1) + " %";
}

// --- Barres avec animation d'apparition ---
function drawBars(g, data, x, y, colorFor) {
  const bars = g.selectAll("rect.bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("y", d => y(d.Label))
    .attr("height", y.bandwidth())
    .attr("width", 0)
    .attr("fill", d => colorFor(d));

  bars.transition()
    .delay((d, i) => i * 80)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("width", d => x(d.Value));
}

// --- Étiquette "valeur · %" au bout de chaque barre, avec compteur animé ---
function drawValueLabels(g, data, x, y, isMobile) {
  const valueLabels = g.selectAll("text.value")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value")
    .attr("x", 8)
    .attr("y", d => y(d.Label) + y.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "9.5px" : "10.5px")
    .style("font-weight", "bold")
    .style("fill", "#111")
    .text("0");

  valueLabels.transition()
    .delay((d, i) => i * 80)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("x", d => x(d.Value) + 8)
    .textTween(function (d) {
      const iVal = d3.interpolateNumber(0, d.Value);
      const iPct = d3.interpolateNumber(0, d.Percent);
      return t => `${formatSwiss(iVal(t))} · ${formatPercent(Math.round(iPct(t) * 10) / 10)}`;
    });
}

// --- Label (langue courante) à gauche, centré verticalement sur sa
// barre — une seule ligne, puisque data_<lang>.csv ne contient plus
// qu'une langue à la fois (fini le split(" / ") sur trois lignes).
function drawRowLabels(g, data, y, isMobile) {
  g.selectAll("text.label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", -10)
    .attr("y", d => y(d.Label) + y.bandwidth() / 2)
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "11px" : "12.5px")
    .style("font-weight", "normal")
    .style("fill", "#333")
    .text(d => d.Label);
}

// --- Axe X ---
// Nombre de graduations calculé selon la largeur réelle disponible
// (pas juste mobile/desktop) : évite le chevauchement des nombres
// suisses ("1'000'000") sur les grandes largeurs comme sur les petites.
function drawXAxis(g, x, innerWidth, innerHeight, isMobile) {
  const tickPxBudget = isMobile ? 55 : 85;
  const tickCount = Math.max(2, Math.min(6, Math.floor(innerWidth / tickPxBudget)));

  // On ne garde que les graduations qui tombent réellement dans la zone
  // du graphique : évite les petits traits sans chiffre qui dépassaient
  // au-delà de la dernière valeur (ex. après "1'000'000").
  const clampedTicks = x.ticks(tickCount).filter(v => x(v) <= innerWidth + 0.5);

  g.append("g")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(
      d3.axisBottom(x)
        .tickValues(clampedTicks)
        .tickFormat(d => formatSwiss(d))
        .tickSizeOuter(0)
    )
    .selectAll("text")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "9px" : "10px")
    .style("fill", "#555");
}

// --- Titre d'axe (langue courante) ---
function drawAxisTitle(svg, margin, innerWidth, height, isMobile) {
  svg.append("text")
    .attr("x", margin.left + innerWidth / 2)
    .attr("y", height - 6)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10.5px" : "12px")
    .style("fill", "#333")
    .text(axisTitleLookup[currentLang]);
}

// --- Survol par ligne : met en évidence label + barre + valeur ---
// (pas de tooltip : tout est déjà lisible en permanence sur le graphique)
function highlight(g, label) {
  g.selectAll(".bar, .value")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.Label === label) ? 1 : 0.3);

  // Label survolé : noir plus franc + gras (pas d'agrandissement,
  // pour ne pas risquer de chevaucher les lignes voisines).
  g.selectAll(".label")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.Label === label) ? 1 : 0.3)
    .style("font-weight", d => (label !== null && d.Label === label) ? "bold" : "normal")
    .style("fill", d => (label !== null && d.Label === label) ? "#000" : "#333");
}

function attachHoverAreas(g, data, y, margin, innerWidth) {
  g.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", -margin.left)
    .attr("y", d => y(d.Label) - (y.step() - y.bandwidth()) / 2)
    .attr("width", innerWidth + margin.left + margin.right)
    .attr("height", y.step())
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => highlight(g, d.Label))
    .on("mouseout", () => highlight(g, null));
}

function drawChart() {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const width = containerWidth;
  const isMobile = width < 600;
  const height = 420;

  const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  d3.csv("data_" + currentLang + ".csv").then(data => {

    data.forEach(d => {
      d.Value = +d.Value;
      d.Percent = +d.Percent;
    });

    data.sort((a, b) => b.Value - a.Value);

    const colorFor = buildColorScale(data);

    const margin = {
      top: 3,   // écart final entre le titre HTML et le graphique
      right: isMobile ? 78 : 140,   // assez de place pour "952'491 · 50,4 %"
      bottom: 44,
      left: isMobile ? 160 : 395
    };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.Value) * 1.08])
      .range([0, innerWidth]);

    const y = d3.scaleBand()
      .domain(data.map(d => d.Label))
      .range([0, innerHeight])
      .padding(0.3);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    drawBars(g, data, x, y, colorFor);
    drawValueLabels(g, data, x, y, isMobile);
    drawRowLabels(g, data, y, isMobile);
    drawXAxis(g, x, innerWidth, innerHeight, isMobile);
    drawAxisTitle(svg, margin, innerWidth, height, isMobile);
    attachHoverAreas(g, data, y, margin, innerWidth);
  });
}
