// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "Einsatzbetriebe und Einsatzplätze"
};

const legendLookup = {
  de: { betriebe: "Einsatzbetriebe", plaetze: "Einsatzplätze" }
};

// Nom complet du canton, affiche dans l'infobulle (la colonne centrale
// garde l'abreviation).
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

// Petrol (Einsatzbetriebe) + lila (Einsatzplätze), couleurs unies -
// meme paire que les autres graphiques Einsatzbetriebe/Einsatzplätze.
const BASE_BETRIEBE = "#5A959D";
const BASE_PLAETZE = "#A3A8CA";

// Ligne de total sous l'axe (somme calculee sur les cantons).
const TOTAL_LABEL = { de: "Total" };
const TOTAL_KEY = "__total"; // datum de la ligne de total (survol)
const TOTAL_ROW_HEIGHT = 18;

const DATA_FILE = "ABI_Einsatzbetriebe_und_Einsatzplaetze_pro_Kanton_2025.csv";
const MOBILE_BREAKPOINT = 600;

// 26 cantons dans le cadre LivingDocs de 500px : lignes compactes.
const ROW_HEIGHT = { mobile: 11.5, desktop: 12.5 }; // compact : tout visible sans scroll dans l'iframe LivingDocs

const FONT_SIZE = { mobile: 9.5, desktop: 10 };       // abreviations + valeurs
const FONT_SIZE_HOVER = { mobile: 12.5, desktop: 13 }; // ligne survolee

const VALUE_GAP = 5;
const MIN_BAR_WIDTH = 2;

const TOOLTIP_PAD_X = 8;
const TOOLTIP_PAD_Y = 5;

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

// --- Formatage suisse : 2'417 ---
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
// Légende — un item centré au-dessus de chaque panneau
// ============================================================

// cx = null : item aligné à gauche (x = 0), utilisé si les deux items
// centrés ne tiennent pas côte à côte.
function drawLegendItem(svg, cx, y, color, label, fontSize) {
  const textWidth = measureTextWidth(svg, label, fontSize);
  const swatchSize = 11;
  const gap = 6;
  const startX = cx === null ? 0 : cx - (swatchSize + gap + textWidth) / 2;

  const item = svg.append("g").attr("transform", `translate(${startX}, ${y})`);

  item.append("rect")
    .attr("width", swatchSize)
    .attr("height", swatchSize)
    .attr("y", 1)
    .attr("fill", color);

  item.append("text")
    .attr("x", swatchSize + gap)
    .attr("y", swatchSize)
    .style("font-family", "Arial")
    .style("font-size", fontSize + "px")
    .style("fill", "#111")
    .text(label);
}

// ============================================================
// Barres (miroir) + étiquettes de valeur
// ============================================================

// Le panneau gauche part de panelWidth et soustrait la longueur de barre,
// pour que les deux côtés grandissent depuis la colonne des cantons.
function drawSideBars(g, data, y, lengthScale, panelWidth, color, key, side, fontSize) {
  const barWidth = val => val > 0 ? Math.max(lengthScale(val), MIN_BAR_WIDTH) : 0;
  const barX = val => side === "left" ? panelWidth - barWidth(val) : 0;
  const startX = side === "left" ? panelWidth : 0;

  g.selectAll(`rect.bar-${key}`)
    .data(data)
    .enter()
    .append("rect")
    .attr("class", `bar bar-${key}`)
    .attr("y", d => y(d.canton))
    .attr("height", y.bandwidth())
    .attr("width", 0)
    .attr("x", startX)
    .attr("fill", color)
    .transition()
    .delay((d, i) => i * 30)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("x", d => barX(d[key]))
    .attr("width", d => barWidth(d[key]));

  g.selectAll(`text.value-${key}`)
    .data(data)
    .enter()
    .append("text")
    .attr("class", `value value-${key}`)
    .attr("x", startX)
    .attr("y", d => y(d.canton) + y.bandwidth() / 2)
    .attr("text-anchor", side === "left" ? "end" : "start")
    .attr("dominant-baseline", "central")
    .style("font-family", "Arial")
    .style("font-size", fontSize + "px")
    .style("fill", "#111")
    .style("pointer-events", "none")
    .text("0")
    .transition()
    .delay((d, i) => i * 30)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("x", d => side === "left"
      ? barX(d[key]) - VALUE_GAP
      : barX(d[key]) + barWidth(d[key]) + VALUE_GAP)
    .textTween(d => {
      const iVal = d3.interpolateNumber(0, d[key]);
      return t => formatSwiss(iVal(t));
    });
}

// ============================================================
// Colonne centrale (abréviations des cantons)
// ============================================================

function drawCenterLabels(g, data, y, centerWidth, fontSize) {
  g.selectAll("text.canton-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "canton-label")
    .attr("x", centerWidth / 2)
    .attr("y", d => y(d.canton) + y.bandwidth() / 2)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .style("font-family", "Arial")
    .style("font-size", fontSize + "px")
    .style("fill", "#333")
    .style("pointer-events", "none")
    .text(d => d.canton);
}

// ============================================================
// Survol : ligne mise en évidence (barres, canton, valeurs agrandies)
// + infobulle avec le nom complet du canton
// ============================================================

function createTooltip(svg) {
  const tooltip = svg.append("g")
    .style("opacity", 0)
    .style("pointer-events", "none");
  const rect = tooltip.append("rect")
    .attr("fill", "white")
    .attr("stroke", BASE_BETRIEBE)
    .attr("stroke-width", 1.2)
    .attr("rx", 4);
  const text = tooltip.append("text")
    .attr("x", TOOLTIP_PAD_X)
    .style("font-family", "Arial")
    .style("font-size", "12px")
    .style("fill", "#111");
  return { tooltip, rect, text };
}

function showTooltip(tip, event, d, svg, containerWidth) {
  // y remis a 0 avant la mesure : sinon la position du survol precedent fausse le calcul.
  tip.text.attr("y", 0).text(CANTON_NAMES[currentLang][d.canton] || d.canton);
  const bbox = tip.text.node().getBBox();
  const w = bbox.width + TOOLTIP_PAD_X * 2;
  const h = bbox.height + TOOLTIP_PAD_Y * 2;
  const [mx, my] = d3.pointer(event, svg.node());

  let tx = mx + 14;
  if (tx + w > containerWidth) tx = mx - w - 14;
  // Sous le curseur (les lignes voisines sont estompees), au-dessus en bas
  // du graphique : ne masque ni les titres ni la ligne survolee.
  const svgHeight = +svg.attr("height");
  let ty = my + 12;
  if (ty + h > svgHeight) ty = my - h - 12;

  tip.rect.attr("width", w).attr("height", h);
  tip.text.attr("y", TOOLTIP_PAD_Y - bbox.y);
  tip.tooltip.attr("transform", `translate(${tx}, ${ty})`).style("opacity", 1).raise();
}

// La place pour les valeurs agrandies est reservee dans la mise en page
// (outerValueMargin mesuree a la taille de survol) : pas de plafonnement.
function highlight(svg, canton, sizes) {
  const isRow = d => canton !== null && d.canton === canton;
  const dim = d => (canton === null || d.canton === canton) ? 1 : 0.3;

  svg.selectAll(".bar").transition().duration(150).style("opacity", dim);

  svg.selectAll(".canton-label, .value")
    .filter(isRow)
    .raise();

  svg.selectAll(".canton-label, .value")
    .transition().duration(150)
    .style("opacity", dim)
    .style("font-weight", d => (isRow(d) || d.canton === TOTAL_KEY) ? "bold" : "normal")
    .style("font-size", d => (isRow(d) ? sizes.hover : sizes.base) + "px")
    .style("fill", d => isRow(d) ? "#000" : (d.canton === TOTAL_KEY ? "#111" : "#333"));
}

function attachHover(svg, data, y, offsetX, offsetY, width, sizes, tip, containerWidth) {
  svg.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", offsetX)
    .attr("y", d => offsetY + y(d.canton) - (y.step() - y.bandwidth()) / 2)
    .attr("width", width)
    .attr("height", y.step())
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      highlight(svg, d.canton, sizes);
      showTooltip(tip, event, d, svg, containerWidth);
    })
    .on("mousemove", (event, d) => showTooltip(tip, event, d, svg, containerWidth))
    .on("mouseout", () => {
      highlight(svg, null, sizes);
      tip.tooltip.style("opacity", 0);
    });
}

// ============================================================
// Total (sous l'axe) : "Total" au centre, chaque somme collee a la colonne
// des cantons, sans barre (elle ecraserait l'echelle). Memes classes que
// les lignes de cantons, pour s'agrandir aussi au survol.
// ============================================================

function drawTotals(svg, data, pos, sizes) {
  const y = pos.y + TOTAL_ROW_HEIGHT / 2;
  const g = svg.append("g").attr("class", "totals");

  g.append("line")
    .attr("x1", pos.leftX)
    .attr("x2", pos.rightX + pos.panelWidth)
    .attr("y1", pos.y)
    .attr("y2", pos.y)
    .attr("stroke", "#b2b4b7")
    .attr("stroke-width", 1);

  const style = sel => sel
    .datum({ canton: TOTAL_KEY })
    .attr("y", y)
    .attr("dominant-baseline", "central")
    .style("font-family", "Arial")
    .style("font-size", sizes.base + "px")
    .style("font-weight", "bold")
    .style("fill", "#111")
    .style("pointer-events", "none");

  g.append("text").call(style)
    .attr("class", "canton-label")
    .attr("x", pos.centerX + pos.centerWidth / 2)
    .attr("text-anchor", "middle")
    .text(TOTAL_LABEL[currentLang]);

  g.append("text").call(style)
    .attr("class", "value")
    .attr("x", pos.centerX - VALUE_GAP)
    .attr("text-anchor", "end")
    .text(formatSwiss(d3.sum(data, d => d.betriebe)));

  g.append("text").call(style)
    .attr("class", "value")
    .attr("x", pos.rightX + VALUE_GAP)
    .attr("text-anchor", "start")
    .text(formatSwiss(d3.sum(data, d => d.plaetze)));

  svg.append("rect")
    .attr("class", "hit")
    .attr("x", 0)
    .attr("y", pos.y)
    .attr("width", pos.containerWidth)
    .attr("height", TOTAL_ROW_HEIGHT)
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", () => highlight(svg, TOTAL_KEY, sizes))
    .on("mouseout", () => highlight(svg, null, sizes));
}

// ============================================================
// Orchestration
// ============================================================

function drawChart() {
  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const isMobile = containerWidth < MOBILE_BREAKPOINT;
  const device = isMobile ? "mobile" : "desktop";
  const sizes = { base: FONT_SIZE[device], hover: FONT_SIZE_HOVER[device] };

  d3.csv(DATA_FILE).then(raw => {
    const data = raw.map(d => ({
      canton: d["Kanton"],
      betriebe: +d["Einsatzbetriebe"],
      plaetze: +d["Einsatzplaetze"]
    }));

    // Cantons par ordre alphabétique de l'abréviation, comme dans le fichier Excel source.
    data.sort((a, b) => a.canton.localeCompare(b.canton));

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", containerWidth);

    // Colonne centrale et marges extérieures mesurées à la taille de survol
    // (en gras) : la ligne survolée peut grandir sans jamais déborder.
    const centerWidth = d3.max(data, d => measureTextWidth(svg, d.canton, sizes.hover, true)) + 14;
    const maxValue = d3.max(data, d => Math.max(d.betriebe, d.plaetze));
    const outerValueMargin = measureTextWidth(svg, formatSwiss(maxValue), sizes.hover, true) + VALUE_GAP + 4;
    const panelWidth = (containerWidth - centerWidth - outerValueMargin * 2) / 2;

    const leftX = outerValueMargin;
    const centerX = leftX + panelWidth;
    const rightX = centerX + centerWidth;

    // Légende : centrée au-dessus de chaque panneau, ou sur 2 lignes si
    // les deux items ne tiennent pas côte à côte.
    const legendFont = isMobile ? 11 : 12.5;
    const labels = legendLookup[currentLang];
    const legendItemWidth = Math.max(
      measureTextWidth(svg, labels.betriebe, legendFont),
      measureTextWidth(svg, labels.plaetze, legendFont)
    ) + 17;
    const legendStacked = legendItemWidth > panelWidth + centerWidth / 2 + outerValueMargin - 4;
    drawLegendItem(svg, legendStacked ? null : leftX + panelWidth / 2, 4, BASE_BETRIEBE, labels.betriebe, legendFont);
    drawLegendItem(svg, legendStacked ? null : rightX + panelWidth / 2, legendStacked ? 22 : 4, BASE_PLAETZE, labels.plaetze, legendFont);

    const margin = { top: legendStacked ? 42 : 24, bottom: 4 };
    const innerHeight = data.length * ROW_HEIGHT[device];
    svg.attr("height", margin.top + innerHeight + margin.bottom + TOTAL_ROW_HEIGHT + 2);

    const lengthScale = d3.scaleLinear().domain([0, maxValue]).range([0, panelWidth]);

    const y = d3.scaleBand()
      .domain(data.map(d => d.canton))
      .range([0, innerHeight])
      .paddingInner(0.22)
      .paddingOuter(0.1);

    const gLeft = svg.append("g").attr("transform", `translate(${leftX}, ${margin.top})`);
    const gCenter = svg.append("g").attr("transform", `translate(${centerX}, ${margin.top})`);
    const gRight = svg.append("g").attr("transform", `translate(${rightX}, ${margin.top})`);

    drawSideBars(gLeft, data, y, lengthScale, panelWidth, BASE_BETRIEBE, "betriebe", "left", sizes.base);
    drawSideBars(gRight, data, y, lengthScale, panelWidth, BASE_PLAETZE, "plaetze", "right", sizes.base);
    // Pas d'axe gradue : chaque barre porte sa valeur, et sa place (20px)
    // sert a garder le graphique entier visible sans scroll.
    drawCenterLabels(gCenter, data, y, centerWidth, sizes.base);

    const tip = createTooltip(svg);
    attachHover(svg, data, y, 0, margin.top, containerWidth, sizes, tip, containerWidth);
    drawTotals(svg, data, {
      y: margin.top + innerHeight + margin.bottom,
      leftX, centerX, rightX, centerWidth, panelWidth, containerWidth
    }, sizes);
  });
}
