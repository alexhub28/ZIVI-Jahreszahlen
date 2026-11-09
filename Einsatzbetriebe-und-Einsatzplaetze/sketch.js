// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "Einsatzbetriebe und Einsatzplätze",
  fr: "Établissements et places d’affectation",
  it: "Istituti e posti d’impiego"
};

const legendLookup = {
  de: ["Einsatzbetriebe", "Einsatzplätze"],
  fr: ["Établissements d’affectation", "Places d’affectation"],
  it: ["Istituti d’impiego", "Posti d’impiego"]
};

// Langue courante, determinee au demarrage depuis ?lang= (par defaut "de").
let currentLang = "de";

// Graphique à 2 variables : petrol (Einsatzbetriebe) + lila
// (Einsatzplätze), couleurs unies (pas de dégradé).
const BASE_BETRIEBE = "#5A959D";  // accent1 — petrol
const BASE_PLAETZE = "#A3A8CA";   // accent3 — lila

// --- Formatage suisse : 16'852 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// ============================================================
// URL params (remplace p5.getURLParams, non utilise autrement ici)
// ============================================================

function getURLParams() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(params.entries());
}

// ============================================================
// Init & resize (remplace les hooks de cycle de vie p5 : setup()/noCanvas())
// ============================================================

function init() {
  const params = getURLParams();
  currentLang = params.lang || currentLang;

  d3.select("#titleContainer").text(titleLookup[currentLang]);

  drawChart();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", drawChart);

// ============================================================
// Légende
// ============================================================

// --- Légende (puces carrées, langue courante) — en haut, avant le graphique ---
function drawLegend(svg, margin, isMobile) {
  const legend = svg.append("g")
    .attr("transform", `translate(${margin.left}, 6)`);

  const legendItems = [
    { color: BASE_BETRIEBE, text: legendLookup[currentLang][0] },
    { color: BASE_PLAETZE, text: legendLookup[currentLang][1] }
  ];

  legendItems.forEach((item, i) => {
    const row = legend.append("g").attr("transform", `translate(0, ${i * 22})`);
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
// Barres
// ============================================================

// Barres groupées avec animation d'apparition. Dessinées avant les
// valeurs (deux passes) pour que les chiffres restent au premier plan.
function drawBars(g, data, series, x0, x1, y, innerHeight) {
  series.forEach((s, si) => {
    g.selectAll(`rect.bar-${s.key}`)
      .data(data)
      .enter()
      .append("rect")
      .attr("class", `bar bar-${s.key}`)
      .attr("x", d => x0(d.year) + x1(s.key))
      .attr("width", x1.bandwidth())
      .attr("y", innerHeight)
      .attr("height", 0)
      .attr("fill", d => s.base)
      .transition()
      .delay((d, i) => i * 70 + si * 35)
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr("y", d => y(d[s.key]))
      .attr("height", d => innerHeight - y(d[s.key]));
  });
}

// ============================================================
// Valeurs
// ============================================================

// Valeur ancrée sur le bord extérieur de sa barre (pas centrée), pour
// s'étendre vers l'espace libre plutôt que sur la barre voisine.
// compact : les valeurs de deux années voisines se chevaucheraient (écran
// étroit) — masquées par défaut, affichées seulement pour l'année survolée.
function drawValueLabels(g, data, series, x0, x1, y, innerHeight, isMobile, compact) {
  const valueAnchor = { betriebe: "end", plaetze: "start" };
  const valueX = {
    betriebe: d => x0(d.year) + x1("betriebe") + x1.bandwidth(),
    plaetze: d => x0(d.year) + x1("plaetze")
  };

  series.forEach((s, si) => {
    g.selectAll(`text.value-${s.key}`)
      .data(data)
      .enter()
      .append("text")
      .attr("class", `value value-${s.key}`)
      .attr("x", valueX[s.key])
      .attr("y", innerHeight)
      .attr("text-anchor", valueAnchor[s.key])
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "10.5px" : "12.5px")
      .style("font-weight", "normal")
      .style("fill", "#111")
      .style("opacity", compact ? 0 : 1)
      .style("pointer-events", "none")
      .text("0")
      .transition()
      .delay((d, i) => i * 70 + si * 35)
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr("y", d => y(d[s.key]) - 6)
      .textTween(function (d) {
        const iVal = d3.interpolateNumber(0, d[s.key]);
        return t => formatSwiss(iVal(t));
      });
  });
}

// ============================================================
// Interaction
// ============================================================

// --- Survol par année : met en évidence une colonne ---
function attachHoverInteraction(g, data, x0, innerHeight, margin, compact) {
  function highlight(year) {
    g.selectAll(compact ? ".bar, .label" : ".bar, .value, .label")
      .transition().duration(150)
      .style("opacity", d => (year === null || d.year === year) ? 1 : 0.3);

    if (compact) {
      // Transition nommée "hover" : n'interrompt pas le compteur animé du chargement.
      g.selectAll(".value")
        .transition("hover").duration(150)
        .style("opacity", d => (year !== null && d.year === year) ? 1 : 0);
    }
  }

  g.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", d => x0(d.year) - (x0.step() - x0.bandwidth()) / 2)
    .attr("y", 0)
    .attr("width", x0.step())
    .attr("height", innerHeight + margin.bottom)
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => highlight(d.year))
    .on("mouseout", () => highlight(null));
}

// ============================================================
// Orchestration
// ============================================================

function drawChart() {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const width = containerWidth;
  const isMobile = width < 600;

  d3.csv("ABI_Einsatzbetriebe_und_Einsatzplaetze_nach_Jahr_2025.csv").then(raw => {

    const data = raw
      .map(d => ({
        year: d["Jahr"],
        betriebe: +d["Einsatzbetriebe"],
        plaetze: +d["Einsatzplaetze"]
      }))
      .sort((a, b) => a.year - b.year);

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width);

    // Mode compact si les valeurs d'une même série (même hauteur, d'une
    // année à l'autre) se toucheraient : un écart d'une année (step) doit
    // contenir la valeur la plus large.
    const valueFontSize = isMobile ? "10.5px" : "12.5px";
    const probe = svg.append("text").style("font-family", "Arial").style("font-size", valueFontSize)
      .text(formatSwiss(d3.max(data, d => Math.max(d.betriebe, d.plaetze))));
    const maxValueWidth = probe.node().getComputedTextLength();
    probe.remove();
    const stepEstimate = width / data.length;
    const compact = stepEstimate < maxValueWidth + 6;

    const legendHeight = 50;
    // compact : marges un peu plus larges pour que la valeur de la première
    // et de la dernière année (affichée au survol) reste dans le cadre.
    const sideMargin = compact ? 24 : (isMobile ? 10 : 20);
    const margin = {
      top: legendHeight,
      right: sideMargin,
      bottom: 22,
      left: sideMargin
    };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = 320;
    const height = margin.top + innerHeight + margin.bottom;
    svg.attr("height", height);

    drawLegend(svg, margin, isMobile);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const maxVal = d3.max(data, d => Math.max(d.betriebe, d.plaetze));

    const x0 = d3.scaleBand()
      .domain(data.map(d => d.year))
      .range([0, innerWidth])
      .paddingInner(0.35)
      .paddingOuter(0.15);

    const x1 = d3.scaleBand()
      .domain(["betriebe", "plaetze"])
      .range([0, x0.bandwidth()])
      .paddingInner(0.08);

    const y = d3.scaleLinear()
      .domain([0, maxVal * 1.12])
      .range([innerHeight, 0]);

    const series = [
      { key: "betriebe", base: BASE_BETRIEBE },
      { key: "plaetze", base: BASE_PLAETZE }
    ];

    drawBars(g, data, series, x0, x1, y, innerHeight);
    drawValueLabels(g, data, series, x0, x1, y, innerHeight, isMobile, compact);

    // --- Années sous les barres ---
    g.selectAll("text.label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", d => x0(d.year) + x0.bandwidth() / 2)
      .attr("y", innerHeight + 20)
      .attr("text-anchor", "middle")
      .style("font-family", "Arial")
      .style("font-size", x0.step() < 32 ? "10px" : (isMobile ? "11.5px" : "13.5px")) // années serrées sur écran étroit
      .style("fill", "#111")
      .text(d => d.year);

    attachHoverInteraction(g, data, x0, innerHeight, margin, compact);
  });
}
