// ============================================================
// Configuration
// ============================================================

// Petrol officiel ZIVI, couleur unie : graphique a une seule variable.
const BASE_PETROL = "#5A959D";

const DATA_FILE = "BEZ_Zulassungen_pro_Kanton_2025.csv";
const MOBILE_BREAKPOINT = 600;

const Y_AXIS_MAX = 1200;
const Y_AXIS_TICKS = [0, 300, 600, 900, 1200];

const titleLookup = {
  de: "2025: Zulassungen pro Kanton"
};

// Nom complet du canton, affiche dans l'infobulle (l'axe garde l'abreviation).
const CANTON_NAMES = {
  de: {
    AG: "Aargau", AI: "Appenzell Innerrhoden", AR: "Appenzell Ausserrhoden",
    BE: "Bern", BL: "Basel-Landschaft", BS: "Basel-Stadt", FR: "Freiburg",
    GE: "Genf", GL: "Glarus", GR: "Graubünden", JU: "Jura", LU: "Luzern",
    NE: "Neuenburg", NW: "Nidwalden", OW: "Obwalden", SG: "St. Gallen",
    SH: "Schaffhausen", SO: "Solothurn", SZ: "Schwyz", TG: "Thurgau",
    TI: "Tessin", UR: "Uri", VD: "Waadt", VS: "Wallis", ZG: "Zug", ZH: "Zürich"
  }
};

// Tailles des abreviations de canton (axe x) : normale / survol.
const LABEL_FONT_MAX = { mobile: 11, desktop: 12.5 };
const LABEL_FONT_MIN = 8;
const LABEL_HOVER_EXTRA = 3; // px ajoutes au survol

const TOOLTIP_PAD_X = 10;
const TOOLTIP_PAD_Y = 8;
const TOOLTIP_NAME_SIZE = "12.5px";
const TOOLTIP_VALUE_SIZE = "20px"; // chiffre mis en avant au survol

// Langue courante, determinee au demarrage depuis ?lang= (par defaut "de").
let currentLang = "de";

// ============================================================
// URL params, init & resize
// ============================================================

function getURLParams() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(params.entries());
}

function init() {
  currentLang = getURLParams().lang || currentLang;
  // Allemand d'abord : FR/IT pas encore traduits, repli sur "de".
  if (!titleLookup[currentLang]) currentLang = "de";
  d3.select("#titleContainer").text(titleLookup[currentLang]);
  drawChart();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", drawChart);

// ============================================================
// Data
// ============================================================

// Cantons par ordre alphabetique de l'abreviation, comme dans le fichier Excel source.
function parseData(raw) {
  return raw
    .map(d => ({ canton: d["Kanton"], value: +d["Zulassungen"] }))
    .sort((a, b) => a.canton.localeCompare(b.canton));
}

// Formatage suisse : 1'120
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function measureTextWidth(svg, text, fontSize, bold) {
  const probe = svg.append("text")
    .style("font-family", "Arial")
    .style("font-size", fontSize + "px")
    .style("font-weight", bold ? "bold" : "normal")
    .style("opacity", 0)
    .text(text);
  const w = probe.node().getComputedTextLength();
  probe.remove();
  return w;
}

// ============================================================
// Layout & scales
// ============================================================

function computeLayout(containerWidth, isMobile) {
  const margin = {
    top: 14,
    right: isMobile ? 6 : 12,
    bottom: 26, // recalcule si les abreviations passent a la verticale
    left: isMobile ? 34 : 42
  };
  const innerWidth = containerWidth - margin.left - margin.right;
  const innerHeight = isMobile ? 300 : 350;
  return { margin, innerWidth, innerHeight, width: containerWidth };
}

function createScales(data, layout) {
  const x = d3.scaleBand()
    .domain(data.map(d => d.canton))
    .range([0, layout.innerWidth])
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([0, Y_AXIS_MAX])
    .range([layout.innerHeight, 0]);

  return { x, y };
}

// Taille des abreviations adaptee au pas de barre (26 cantons) : reduite
// jusqu'a LABEL_FONT_MIN pour que la plus large tienne (survol compris) ;
// au-dela, les abreviations passent a la verticale.
function computeLabelStyle(svg, data, x, isMobile) {
  const maxSize = isMobile ? LABEL_FONT_MAX.mobile : LABEL_FONT_MAX.desktop;
  const room = x.step() - 3;
  const widest = size => d3.max(data, d => measureTextWidth(svg, d.canton, size, true));

  for (let size = maxSize; size >= LABEL_FONT_MIN; size -= 0.5) {
    if (widest(size + LABEL_HOVER_EXTRA) <= room) return { size, rotated: false };
  }
  return { size: Math.min(maxSize, 10), rotated: true };
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
  const { x, y } = scales;
  const { innerHeight } = layout;

  g.selectAll("rect.bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.canton))
    .attr("width", x.bandwidth())
    .attr("y", innerHeight)
    .attr("height", 0)
    .attr("fill", BASE_PETROL)
    .transition()
    .delay((d, i) => i * 25)
    .duration(700)
    .ease(d3.easeCubicOut)
    .attr("y", d => y(d.value))
    .attr("height", d => innerHeight - y(d.value));
}

function drawCantonLabels(g, data, x, layout, labelStyle) {
  const { innerHeight } = layout;
  const { size, rotated } = labelStyle;

  g.selectAll("text.canton-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "canton-label")
    .attr("transform", d => {
      const cx = x(d.canton) + x.bandwidth() / 2;
      return rotated
        ? `translate(${cx}, ${innerHeight + 6}) rotate(-90)`
        : `translate(${cx}, ${innerHeight + size + 6})`;
    })
    .attr("text-anchor", rotated ? "end" : "middle")
    .attr("dominant-baseline", rotated ? "middle" : "auto")
    .style("font-family", "Arial")
    .style("font-size", size + "px")
    .style("fill", "#111")
    .style("pointer-events", "none")
    .text(d => d.canton);
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
    .attr("stroke", BASE_PETROL)
    .attr("stroke-width", 1.5)
    .attr("rx", 5);

  const tooltipText = tooltip.append("text")
    .style("font-family", "Arial")
    .style("fill", "#111");

  return { tooltip, tooltipRect, tooltipText };
}

// Nom complet du canton, puis le chiffre en grand et en gras.
function fillTooltipText(tooltipText, d) {
  tooltipText.selectAll("tspan").remove();
  tooltipText.attr("x", TOOLTIP_PAD_X).attr("y", 0);

  tooltipText.append("tspan")
    .attr("x", TOOLTIP_PAD_X)
    .attr("dy", 0)
    .style("font-size", TOOLTIP_NAME_SIZE)
    .text(CANTON_NAMES[currentLang][d.canton] || d.canton);

  tooltipText.append("tspan")
    .attr("x", TOOLTIP_PAD_X)
    .attr("dy", "1.35em")
    .style("font-size", TOOLTIP_VALUE_SIZE)
    .style("font-weight", "bold")
    .text(formatSwiss(d.value));
}

function positionTooltip(tooltipParts, mx, my, chartWidth) {
  const { tooltip, tooltipRect, tooltipText } = tooltipParts;
  const bbox = tooltipText.node().getBBox();
  const boxWidth = bbox.width + TOOLTIP_PAD_X * 2;
  const boxHeight = bbox.height + TOOLTIP_PAD_Y * 2;

  let tx = mx + 16;
  let ty = my - boxHeight - 14;
  if (tx + boxWidth > chartWidth) tx = mx - boxWidth - 16;
  if (tx < 0) tx = 0;
  if (ty < 0) ty = my + 16;

  tooltip.attr("transform", `translate(${tx}, ${ty})`);
  tooltipRect.attr("width", boxWidth).attr("height", boxHeight);
  tooltipText.attr("y", TOOLTIP_PAD_Y - bbox.y);
  tooltip.style("opacity", 1).raise();
}

function showTooltip(event, d, tooltipParts, svg, chartWidth) {
  const [mx, my] = d3.pointer(event, svg.node());
  fillTooltipText(tooltipParts.tooltipText, d);
  positionTooltip(tooltipParts, mx, my, chartWidth);
}

// Barre survolee pleine, les autres estompees ; abreviation agrandie et en gras.
function highlight(g, canton, labelStyle) {
  g.selectAll(".bar")
    .transition().duration(150)
    .style("opacity", d => (canton === null || d.canton === canton) ? 1 : 0.35);

  g.selectAll(".canton-label")
    .transition().duration(150)
    .style("font-size", d => (d.canton === canton ? labelStyle.size + LABEL_HOVER_EXTRA : labelStyle.size) + "px")
    .style("font-weight", d => d.canton === canton ? "bold" : "normal")
    .style("opacity", d => (canton === null || d.canton === canton) ? 1 : 0.5);
}

function attachHoverAreas(g, data, scales, layout, tooltipParts, svg, labelStyle) {
  const { x } = scales;
  const { innerHeight, margin, width } = layout;

  g.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", d => x(d.canton) - (x.step() - x.bandwidth()) / 2)
    .attr("y", 0)
    .attr("width", x.step())
    .attr("height", innerHeight + margin.bottom)
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      highlight(g, d.canton, labelStyle);
      showTooltip(event, d, tooltipParts, svg, width);
    })
    .on("mousemove", (event, d) => showTooltip(event, d, tooltipParts, svg, width))
    .on("mouseout", () => {
      highlight(g, null, labelStyle);
      tooltipParts.tooltip.style("opacity", 0);
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
      .attr("width", layout.width);

    const labelStyle = computeLabelStyle(svg, data, scales.x, isMobile);
    if (labelStyle.rotated) {
      layout.margin.bottom = measureTextWidth(svg, "WW", labelStyle.size + LABEL_HOVER_EXTRA, true) + 12;
    }
    svg.attr("height", layout.margin.top + layout.innerHeight + layout.margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${layout.margin.left}, ${layout.margin.top})`);

    drawGrid(g, scales.y, layout.innerWidth);
    drawYAxis(g, scales.y, isMobile);
    drawBars(g, data, scales, layout);
    drawCantonLabels(g, data, scales.x, layout, labelStyle);

    const tooltipParts = createTooltip(svg);
    attachHoverAreas(g, data, scales, layout, tooltipParts, svg, labelStyle);
  });
}
