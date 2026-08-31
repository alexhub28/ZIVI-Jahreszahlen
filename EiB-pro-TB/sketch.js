const titleLookup = {
    de: "Einsatzbetriebe und Einsatzplätze pro Tätigkeitsbereich",
    fr: "Établissements et places d'affectation par domaine d'activité",
    it: "Istituti e posti d'impiego per ambito di attività"
}

// Une seule langue affichee a la fois (selon ?lang=), jamais les trois
// versions ensemble.
const legendLookup = {
  de: [
    { key: "betriebe", text: "Einsatzbetriebe" },
    { key: "plaetze", text: "Einsatzplätze" }
  ],
  fr: [
    { key: "betriebe", text: "Établissements d’affectation" },
    { key: "plaetze", text: "Places d’affectation" }
  ],
  it: [
    { key: "betriebe", text: "Istituti d’impiego" },
    { key: "plaetze", text: "Posti d’impiego" }
  ]
};

// Familles de teintes officielles ZIVI : jaune (accent5) pour
// Einsatzbetriebe, lila (accent3) pour Einsatzplätze. Le petrol est
// désormais réservé aux jours de service (DT) dans tous les graphiques.
// Chaque barre est colorée selon un dégradé d'intensité propre à sa
// série (plus la valeur est élevée, plus la teinte est soutenue).
const BASE_BETRIEBE = "#FCEB30";  // accent5 — jaune (intensité max)
const LIGHT_BETRIEBE = "#FDF595"; // jaune (intensité min) — assez soutenu pour rester visible
const BASE_PLAETZE = "#A3A8CA";   // accent3 — lila (intensité max)
const LIGHT_PLAETZE = "#D2D4E5";  // lila (intensité min) — assez soutenu pour rester visible

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

  const title = titleLookup[currentLang];
  d3.select("#titleContainer").text(title);

  drawChart();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", drawChart);

// --- Formatage suisse : 8'344 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// --- Légende (puces carrées, langue courante uniquement) — en haut, avant le graphique ---
function drawLegend(svg, margin, isMobile) {
  const legend = svg.append("g")
    .attr("transform", `translate(${margin.left}, 6)`);

  const colorByKey = { betriebe: BASE_BETRIEBE, plaetze: BASE_PLAETZE };
  const legendItems = legendLookup[currentLang];

  legendItems.forEach((item, i) => {
    const row = legend.append("g").attr("transform", `translate(0, ${i * 22})`);
    row.append("rect")
      .attr("width", 11)
      .attr("height", 11)
      .attr("y", 3)
      .attr("fill", colorByKey[item.key]);

    row.append("text")
      .attr("x", 17)
      .attr("y", 12)
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "11.5px" : "13px")
      .style("fill", "#111")
      .text(item.text);
  });
}

// --- Barres avec animation d'apparition + dégradé d'intensité ---
function drawBars(g, data, series, x, y0, y1, isMobile) {
  // Largeur plancher : une valeur non nulle reste toujours visible,
  // même minuscule à cette échelle (ex. Katastrophen : 11 / 48).
  const MIN_BAR_WIDTH = 2;
  const barWidth = (val) => val > 0 ? Math.max(x(val), MIN_BAR_WIDTH) : 0;

  series.forEach((s, si) => {
    g.selectAll(`rect.bar-${s.key}`)
      .data(data)
      .enter()
      .append("rect")
      .attr("class", `bar bar-${s.key}`)
      .attr("y", d => y0(d.label) + y1(s.key))
      .attr("height", y1.bandwidth())
      .attr("width", 0)
      .attr("fill", d => d3.interpolate(s.light, s.base)(s.scale(d[s.key])))
      .transition()
      .delay((d, i) => i * 90 + si * 45)
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr("width", d => barWidth(d[s.key]));

    // --- Étiquette de valeur, avec compteur animé ---
    g.selectAll(`text.value-${s.key}`)
      .data(data)
      .enter()
      .append("text")
      .attr("class", `value value-${s.key}`)
      .attr("x", 6)
      .attr("y", d => y0(d.label) + y1(s.key) + y1.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "9.5px" : "10.5px")
      .style("font-weight", "bold")
      .style("fill", "#111")
      .text("0")
      .transition()
      .delay((d, i) => i * 90 + si * 45)
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr("x", d => barWidth(d[s.key]) + 6)
      .textTween(function (d) {
        const iVal = d3.interpolateNumber(0, d[s.key]);
        return t => formatSwiss(iVal(t));
      });
  });
}

// --- Label (langue courante) à gauche, centré verticalement sur la
// paire de barres — une seule ligne, puisque data_<lang>.csv ne
// contient plus qu'une langue à la fois (fini le split(" / ") sur
// trois lignes qui poussait le texte au-dessus de la paire).
function drawRowLabels(g, data, y0, isMobile) {
  g.selectAll("text.label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", -10)
    .attr("y", d => y0(d.label) + y0.bandwidth() / 2)
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "9.5px" : "10.5px")
    .style("font-weight", "normal")
    .style("fill", "#333")
    .text(d => d.label);
}

// --- Survol par ligne : met en évidence une catégorie ---
function highlight(g, label) {
  g.selectAll(".bar, .value")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3);

  // Label survolé : noir plus franc + gras (pas d'agrandissement,
  // pour ne pas risquer de chevaucher les lignes voisines).
  g.selectAll(".label")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3)
    .style("font-weight", d => (label !== null && d.label === label) ? "bold" : "normal")
    .style("fill", d => (label !== null && d.label === label) ? "#000" : "#333");
}

function attachHover(g, data, y0, margin, innerWidth) {
  g.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", -margin.left)
    .attr("y", d => y0(d.label) - (y0.step() - y0.bandwidth()) / 2)
    .attr("width", innerWidth + margin.left + margin.right)
    .attr("height", y0.step())
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => highlight(g, d.label))
    .on("mouseout", () => highlight(g, null));
}

function drawChart() {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const width = containerWidth;
  const isMobile = width < 600;

  let filename = "data_" + currentLang + ".csv";

  d3.csv(filename).then(raw => {

    const data = raw.map(d => ({
      label: d["Tätigkeit"],
      betriebe: +d["Einsatzbetriebe"],
      plaetze: +d["Einsatzplätze"]
    }));

    // Ordre décroissant par nombre de places d'affectation (Einsatzplätze)
    data.sort((a, b) => b.plaetze - a.plaetze);

    const rowHeight = 42;
    const legendHeight = 54; // légende sur une seule ligne par item (embed compact) — agrandie avec le texte
    const margin = {
      top: legendHeight,
      right: isMobile ? 55 : 78,
      bottom: 16,
      left: isMobile ? 135 : 270
    };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = data.length * rowHeight;
    const height = margin.top + innerHeight + margin.bottom;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    drawLegend(svg, margin, isMobile);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const maxBetriebe = d3.max(data, d => d.betriebe);
    const maxPlaetze = d3.max(data, d => d.plaetze);
    const maxVal = Math.max(maxBetriebe, maxPlaetze);

    const x = d3.scaleLinear()
      .domain([0, maxVal * 1.12])
      .range([0, innerWidth]);

    // Échelle de couleur en racine carrée : évite qu'une seule grosse valeur
    // écrase tout le dégradé (sinon presque toutes les barres seraient pâles).
    const colorBetriebe = d3.scaleSqrt().domain([0, maxBetriebe]).range([0, 1]);
    const colorPlaetze = d3.scaleSqrt().domain([0, maxPlaetze]).range([0, 1]);

    const y0 = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, innerHeight])
      .paddingInner(0.45)
      .paddingOuter(0.15);

    const y1 = d3.scaleBand()
      .domain(["betriebe", "plaetze"])
      .range([0, y0.bandwidth()])
      .paddingInner(0.08);

    const series = [
      { key: "betriebe", light: LIGHT_BETRIEBE, base: BASE_BETRIEBE, scale: colorBetriebe },
      { key: "plaetze", light: LIGHT_PLAETZE, base: BASE_PLAETZE, scale: colorPlaetze }
    ];

    drawBars(g, data, series, x, y0, y1, isMobile);
    drawRowLabels(g, data, y0, isMobile);
    attachHover(g, data, y0, margin, innerWidth);
  });
}
