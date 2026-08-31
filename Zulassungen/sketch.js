// ============================================================
// Configuration
// ============================================================

// Bleu ZIVI (hlink officiel), utilise en degrade selon l'intensite de
// la valeur. Teinte distincte du petrol utilise pour les jours de
// service (DT), pour eviter toute confusion entre les deux graphiques.
const BASE_HLINK = "#009DE0";  // intensite max
const LIGHT_HLINK = "#D1EDF9"; // intensite min

const Y_AXIS_MAX = 7500;
const Y_AXIS_TICKS = [0, 1500, 3000, 4500, 6000, 7500];

const titleLookup = {
  de: "Zulassungen",
  fr: "Admissions",
  it: "Ammissioni"
};

// Annees avec un evenement marquant, annote au survol. Un seul texte
// par langue est affiche dans le tooltip (selon ?lang=), jamais les
// trois versions en meme temps.
const ANNOTATIONS = {
  2009: {
    de: "Tatbeweis",
    fr: "Preuve par l’acte",
    it: "Prova dell’atto"
  },
  2011: {
    de: "Verordnungsrevision",
    fr: "Révision de l’ordonnance",
    it: "Revisione dell’ordinanza"
  },
  2020: {
    de: "Covid: reduzierte Zulassungszahl",
    fr: "Covid : admissions réduites",
    it: "Covid: ammissioni ridotte"
  }
};

const DATA_FILE = "BEZ_Zulassungen_2025.csv";
const MOBILE_BREAKPOINT = 600;

const TOOLTIP_PAD_X = 10;
const TOOLTIP_PAD_Y = 8;

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

// ============================================================
// Data
// ============================================================

function parseData(raw) {
  return raw
    .map(d => ({ year: d["Jahr"], value: +d["Zulassungen"] }))
    .sort((a, b) => a.year - b.year);
}

// Formatage suisse : 6'799
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// ============================================================
// Layout & scales
// ============================================================

function computeLayout(containerWidth, isMobile) {
  const margin = {
    top: 14,
    right: isMobile ? 10 : 20,
    bottom: 26,
    left: isMobile ? 34 : 46
  };

  // Embed compact : pas de largeur minimale forcee / scroll horizontal
  // (peu exploitable dans une iframe LivingDocs) - les barres se
  // compressent pour que toutes les annees restent toujours visibles.
  const innerWidth = containerWidth - margin.left - margin.right;
  const innerHeight = 350;
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
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([0, Y_AXIS_MAX])
    .range([layout.innerHeight, 0]);

  const colorScale = d3.scaleSqrt().domain([minVal, maxVal]).range([0, 1]);

  return { x, y, colorScale };
}

function getBarColor(value, colorScale) {
  return d3.interpolate(LIGHT_HLINK, BASE_HLINK)(colorScale(value));
}

// ============================================================
// Static chart elements
// ============================================================

function drawGrid(g, y, innerWidth) {
  g.append("g")
    .attr("class", "grid")
    .selectAll("line")
    .data(Y_AXIS_TICKS)
    .enter()
    .append("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", d => y(d))
    .attr("y2", d => y(d))
    .attr("stroke", "#e5e5e5")
    .attr("stroke-width", 1);
}

function drawYAxis(g, y, isMobile) {
  g.append("g")
    .attr("class", "y-axis")
    .call(
      d3.axisLeft(y)
        .tickValues(Y_AXIS_TICKS)
        .tickFormat(d => formatSwiss(d))
        .tickSize(0)
    )
    .call(axisG => axisG.select(".domain").remove())
    .selectAll("text")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10.5px" : "12.5px")
    .style("fill", "#555");
}

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
    .attr("fill", d => getBarColor(d.value, colorScale))
    .attr("stroke", d => ANNOTATIONS[d.year] ? "#0076A8" : "none")
    .attr("stroke-width", 1);

  bars.transition()
    .delay((d, i) => i * 20)
    .duration(700)
    .ease(d3.easeCubicOut)
    .attr("y", d => y(d.value))
    .attr("height", d => innerHeight - y(d.value));

  return bars;
}

function drawAnnotationMarkers(g, data, scales) {
  const { x, y } = scales;
  const annotatedData = data.filter(d => ANNOTATIONS[d.year]);

  g.selectAll("text.marker")
    .data(annotatedData)
    .enter()
    .append("text")
    .attr("class", "marker")
    .attr("x", d => x(d.year) + x.bandwidth() / 2)
    .attr("y", d => y(d.value) - 6)
    .attr("text-anchor", "middle")
    .style("font-size", "12.5px")
    .style("fill", "#0076A8")
    .style("opacity", 0)
    .text("●")
    .transition()
    .delay((d, i) => data.indexOf(d) * 20 + 700)
    .duration(300)
    .style("opacity", 1);
}

function drawYearLabels(g, data, x, layout, isMobile) {
  // Une annee sur cinq, pour rester lisible.
  const labelData = data.filter(d => d.year % 5 === 0);

  g.selectAll("text.label")
    .data(labelData)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", d => x(d.year) + x.bandwidth() / 2)
    .attr("y", layout.innerHeight + 20)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "11.5px" : "13.5px")
    .style("fill", "#111")
    .text(d => d.year);
}

// ============================================================
// Interaction
// ============================================================

function createTooltip(svg) {
  const tooltip = svg.append("g")
    .style("opacity", 0)
    .style("pointer-events", "none");

  const tooltipRect = tooltip.append("rect")
    .attr("fill", "white")
    .attr("stroke", "#0076A8")
    .attr("stroke-width", 1.5)
    .attr("rx", 5);

  const tooltipText = tooltip.append("text")
    .style("font-family", "Arial")
    .style("font-size", "14.5px")
    .style("font-weight", "bold")
    .style("fill", "#111");

  return { tooltip, tooltipRect, tooltipText };
}

function fillTooltipText(tooltipText, d) {
  // On repart toujours d'une reference fixe (x = TOOLTIP_PAD_X, y = 0)
  // avant de mesurer : sinon la position heritee du survol precedent
  // fausse le calcul et le texte peut se retrouver hors de la case.
  tooltipText.selectAll("tspan").remove();
  tooltipText.attr("x", TOOLTIP_PAD_X).attr("y", 0);

  tooltipText.append("tspan")
    .attr("x", TOOLTIP_PAD_X)
    .attr("dy", 0)
    .text(`${d.year} – ${formatSwiss(d.value)}`);

  // Uniquement le texte de la langue courante (?lang=) — jamais les
  // trois langues ensemble.
  const annotation = ANNOTATIONS[d.year];
  const annotationText = annotation ? annotation[currentLang] : null;

  if (annotationText) {
    tooltipText.append("tspan")
      .attr("x", TOOLTIP_PAD_X)
      .attr("dy", "1.3em")
      .style("font-weight", "normal")
      .style("font-size", "12.5px")
      .text(annotationText);
  }
}

function positionTooltip(tooltipParts, mx, my, chartWidth) {
  const { tooltip, tooltipRect, tooltipText } = tooltipParts;
  const bbox = tooltipText.node().getBBox();
  const boxWidth = bbox.width + TOOLTIP_PAD_X * 2;
  const boxHeight = bbox.height + TOOLTIP_PAD_Y * 2;

  let tx = mx + 16;
  let ty = my - boxHeight - 14;
  if (tx + boxWidth > chartWidth) tx = mx - boxWidth - 16;
  if (ty < 0) ty = my + 16;

  tooltip.attr("transform", `translate(${tx}, ${ty})`);
  tooltipRect.attr("width", boxWidth).attr("height", boxHeight);
  tooltipText.attr("y", TOOLTIP_PAD_Y - bbox.y);
  tooltip.style("opacity", 1);
}

function showTooltip(event, d, tooltipParts, svg, chartWidth) {
  const [mx, my] = d3.pointer(event, svg.node());
  fillTooltipText(tooltipParts.tooltipText, d);
  positionTooltip(tooltipParts, mx, my, chartWidth);
}

function hideTooltip(tooltipParts) {
  tooltipParts.tooltip.style("opacity", 0);
}

function highlightBar(g, year) {
  g.selectAll(".bar")
    .transition()
    .duration(150)
    .style("opacity", d => (year === null || d.year === year) ? 1 : 0.35);
}

function attachHoverAreas(g, data, scales, layout, tooltipParts, svg) {
  const { x } = scales;
  const { innerHeight, margin, width } = layout;

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
    .on("mouseover", (event, d) => {
      highlightBar(g, d.year);
      showTooltip(event, d, tooltipParts, svg, width);
    })
    .on("mousemove", (event, d) => showTooltip(event, d, tooltipParts, svg, width))
    .on("mouseout", () => {
      highlightBar(g, null);
      hideTooltip(tooltipParts);
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

    const g = svg.append("g")
      .attr("transform", `translate(${layout.margin.left}, ${layout.margin.top})`);

    drawGrid(g, scales.y, layout.innerWidth);
    drawYAxis(g, scales.y, isMobile);
    drawBars(g, data, scales, layout);
    drawAnnotationMarkers(g, data, scales);
    drawYearLabels(g, data, scales.x, layout, isMobile);

    const tooltipParts = createTooltip(svg);
    attachHoverAreas(g, data, scales, layout, tooltipParts, svg);
  });
}
