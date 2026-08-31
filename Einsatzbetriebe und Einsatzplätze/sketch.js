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

// Couleurs officielles ZIVI, cohérentes avec les autres graphiques
// Einsatzbetriebe / Einsatzplätze (le petrol est réservé au DT).
// Dégradé d'intensité : plus foncé pour les valeurs élevées. L'amplitude
// du dégradé s'adapte à l'écart réel des valeurs : ici les années sont
// très proches les unes des autres, donc le dégradé reste discret plutôt
// que d'utiliser toute l'étendue clairfoncé comme sur d'autres graphiques.
const BASE_BETRIEBE = "#FCEB30";  // accent5 — jaune, intensité max
const BASE_PLAETZE = "#A3A8CA";   // accent3 — lila, intensité max

function lightTintFor(base, minVal, maxVal) {
  const relRange = (maxVal - minVal) / maxVal;
  const lightenAmount = Math.max(0.08, Math.min(0.85, relRange * 1.8));
  return d3.interpolate(base, "#ffffff")(lightenAmount);
}

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

// --- Barres groupées avec animation d'apparition ---
// Toutes les barres sont dessinées d'abord, puis toutes les valeurs
// ensuite (deux passes séparées) : ça garantit que les chiffres
// restent toujours au premier plan, même quand la barre voisine est
// à pleine opacité (survol) et que les colonnes sont étroites.
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
      .attr("fill", d => d3.interpolate(s.light, s.base)(s.scale(d[s.key])))
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

// Chaque valeur est ancrée sur le bord EXTÉRIEUR de sa propre barre
// (fin pour Einsatzbetriebe, début pour Einsatzplätze) plutôt que
// centrée sur la barre : le texte, souvent plus large que la barre
// elle-même, s'étend alors vers l'espace libre entre les groupes
// d'années au lieu d'empiéter sur la barre voisine.
// --- Valeur au-dessus de chaque barre, avec compteur animé ---
function drawValueLabels(g, data, series, x0, x1, y, innerHeight, isMobile) {
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
      .style("font-weight", "bold")
      .style("fill", "#111")
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
function attachHoverInteraction(g, data, x0, innerHeight, margin) {
  function highlight(year) {
    g.selectAll(".bar, .value, .label")
      .transition().duration(150)
      .style("opacity", d => (year === null || d.year === year) ? 1 : 0.3);
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

    const legendHeight = 50;
    const margin = {
      top: legendHeight,
      right: isMobile ? 10 : 20,
      bottom: 22,
      left: isMobile ? 10 : 20
    };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = 320;
    const height = margin.top + innerHeight + margin.bottom;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    drawLegend(svg, margin, isMobile);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const maxVal = d3.max(data, d => Math.max(d.betriebe, d.plaetze));
    const maxBetriebe = d3.max(data, d => d.betriebe);
    const minBetriebe = d3.min(data, d => d.betriebe);
    const maxPlaetze = d3.max(data, d => d.plaetze);
    const minPlaetze = d3.min(data, d => d.plaetze);

    const colorBetriebe = d3.scaleSqrt().domain([minBetriebe, maxBetriebe]).range([0, 1]);
    const colorPlaetze = d3.scaleSqrt().domain([minPlaetze, maxPlaetze]).range([0, 1]);

    const lightBetriebe = lightTintFor(BASE_BETRIEBE, minBetriebe, maxBetriebe);
    const lightPlaetze = lightTintFor(BASE_PLAETZE, minPlaetze, maxPlaetze);

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
      { key: "betriebe", light: lightBetriebe, base: BASE_BETRIEBE, scale: colorBetriebe },
      { key: "plaetze", light: lightPlaetze, base: BASE_PLAETZE, scale: colorPlaetze }
    ];

    drawBars(g, data, series, x0, x1, y, innerHeight);
    drawValueLabels(g, data, series, x0, x1, y, innerHeight, isMobile);

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
      .style("font-size", isMobile ? "11.5px" : "13.5px")
      .style("fill", "#111")
      .text(d => d.year);

    attachHoverInteraction(g, data, x0, innerHeight, margin);
  });
}
