// ============================================================
// Configuration
// ============================================================

// Rouge officiel ZIVI (accent6), utilise en degrade selon l'intensite
// de la valeur.
const BASE_RED = "#FF0000";   // intensite max
const LIGHT_RED = "#FFD1D1";  // intensite min

const DATA_FILE = "EAZ_Anzahl_Kurse.csv";
const MOBILE_BREAKPOINT = 600;
const Y_AXIS_HEADROOM = 1.12; // marge au-dessus de la valeur max


const titleLookup = {
  de: "Anzahl Kurse",
  fr: "Nombre de cours",
  it: "Numero dei corsi"
}

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

// ============================================================
// Data
// ============================================================

function parseData(raw) {
  return raw.map(d => ({
    year: d["Jahr"],
    value: +d["Anzahl_Ausbildungskurse"]
  }));
}

// Formatage suisse : 1'234
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// ============================================================
// Layout & scales
// ============================================================

function computeLayout(containerWidth, isMobile) {
  const margin = {
    top: 30,
    right: isMobile ? 10 : 20,
    bottom: 24,
    left: isMobile ? 10 : 20
  };

  const innerWidth = containerWidth - margin.left - margin.right;
  const innerHeight = 340;
  const width = containerWidth;
  const height = margin.top + innerHeight + margin.bottom;

  return { margin, innerWidth, innerHeight, width, height };
}

function createScales(data, layout) {
  const values = data.map(d => d.value);
  const minVal = d3.min(values);
  const maxVal = d3.max(values);

  const x = d3.scaleBand()
    .domain(data.map(d => d.year))
    .range([0, layout.innerWidth])
    .padding(0.35);

  const y = d3.scaleLinear()
    .domain([0, maxVal * Y_AXIS_HEADROOM])
    .range([layout.innerHeight, 0]);

  // Degrade cale sur l'ecart reel des valeurs (minVal-maxVal) plutot que
  // sur [0, max] : sinon la variation de teinte serait presque invisible,
  // toutes les barres etant deja proches du haut de l'echelle.
  const colorScale = d3.scaleLinear().domain([minVal, maxVal]).range([0, 1]);

  return { x, y, colorScale };
}

function getBarColor(value, colorScale) {
  return d3.interpolate(LIGHT_RED, BASE_RED)(colorScale(value));
}

// ============================================================
// Static chart elements
// ============================================================

function drawBars(g, data, scales, layout) {
  const { x, y, colorScale } = scales;
  const { innerHeight } = layout;

  const bars = g.selectAll("rect.bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.year))
    .attr("width", x.bandwidth())
    .attr("y", innerHeight)
    .attr("height", 0)
    .attr("fill", d => getBarColor(d.value, colorScale));

  bars.transition()
    .delay((d, i) => i * 70)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("y", d => y(d.value))
    .attr("height", d => innerHeight - y(d.value));

  return bars;
}

function drawValueLabels(g, data, scales, layout, isMobile) {
  const { x, y } = scales;
  const { innerHeight } = layout;

  const values = g.selectAll("text.value")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value")
    .attr("x", d => x(d.year) + x.bandwidth() / 2)
    .attr("y", innerHeight)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "11.5px" : "13.5px")
    .style("font-weight", "bold")
    .style("fill", "#111")
    .text("0");

  values.transition()
    .delay((d, i) => i * 70)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("y", d => y(d.value) - 8)
    .textTween(function (d) {
      const interpolateValue = d3.interpolateNumber(0, d.value);
      return t => formatSwiss(interpolateValue(t));
    });

  return values;
}

function drawYearLabels(g, data, x, layout, isMobile) {
  g.selectAll("text.label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", d => x(d.year) + x.bandwidth() / 2)
    .attr("y", layout.innerHeight + 22)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "11.5px" : "13.5px")
    .style("fill", "#111")
    .text(d => d.year);
}

// ============================================================
// Interaction
// ============================================================

function highlightYear(g, year) {
  g.selectAll(".bar, .value, .label")
    .transition()
    .duration(150)
    .style("opacity", d => (year === null || d.year === year) ? 1 : 0.3);
}

function attachHoverAreas(g, data, x, layout) {
  const { innerHeight, margin } = layout;

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
    .on("mouseover", (event, d) => highlightYear(g, d.year))
    .on("mouseout", () => highlightYear(g, null));
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

    const g = svg.append("g")
      .attr("transform", `translate(${layout.margin.left}, ${layout.margin.top})`);

    drawBars(g, data, scales, layout);
    drawValueLabels(g, data, scales, layout, isMobile);
    drawYearLabels(g, data, scales.x, layout, isMobile);
    attachHoverAreas(g, data, scales.x, layout);
  });
}
