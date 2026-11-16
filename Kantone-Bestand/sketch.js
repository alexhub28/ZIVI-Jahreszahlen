// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "2025: Bestand pro Kanton"
};

// Une colonne par statistique (split bars), dans l'ordre d'affichage.
// Plus de 2 variables : Petrol, Lila, Mint (charte, cyclees par position).
const COLUMNS = [
  { key: "Bestand_total", color: "#5A959D", label: { de: "Bestand total" } },
  { key: "Bestand_ohne_Restdiensttage", color: "#A3A8CA", label: { de: "Bestand ohne Restdiensttage" } },
  { key: "Bestand_mit_Restdiensttagen", color: "#CAE7EA", label: { de: "Bestand mit Restdiensttagen" } }
];

const DATA_FILE = "BEZ_Bestand_pro_Kanton_2025.csv";

// Nom complet du canton, affiche dans l'infobulle (la colonne de gauche
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

// Echelle commune a toutes les colonnes : les longueurs de barre restent
// comparables d'une colonne a l'autre (une echelle par colonne exagererait
// les petites series).
const SHARED_SCALE = true;

const MOBILE_BREAKPOINT = 600;

// 26 cantons dans le cadre LivingDocs de 500px : lignes compactes.
const ROW_HEIGHT = { mobile: 13.5, desktop: 14.5 };
const FONT_SIZE = { mobile: 9.5, desktop: 10.5 };       // cantons + valeurs
const FONT_SIZE_HOVER = { mobile: 11.5, desktop: 13.5 }; // ligne survolee
const HEADER_FONT_SIZE = { mobile: 10.5, desktop: 12 };
const HEADER_FONT_MIN = 8.5;
const COLUMN_GAP = { mobile: 8, desktop: 18 };

const VALUE_GAP = 4;
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

// --- Formatage suisse : 9'694 ---
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

// Decoupe un titre de colonne en lignes qui tiennent dans maxWidth.
function wrapLines(svg, text, maxWidth, fontSize) {
  const lines = [];
  let current = "";
  text.split(" ").forEach(word => {
    const candidate = current ? current + " " + word : word;
    if (measureTextWidth(svg, candidate, fontSize, true) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines;
}

// ============================================================
// Data
// ============================================================

// Cantons par ordre alphabetique de l'abreviation, comme dans le fichier Excel source.
function parseData(raw) {
  return raw
    .map(d => {
      const row = { canton: d["Kanton"] };
      COLUMNS.forEach(c => { row[c.key] = +d[c.key]; });
      return row;
    })
    .sort((a, b) => a.canton.localeCompare(b.canton));
}

// ============================================================
// Layout
// ============================================================

// Colonne des cantons et place des valeurs mesurees a la taille de survol
// (en gras) : la ligne survolee peut grandir sans jamais deborder.
function computeLayout(svg, data, containerWidth, device) {
  const sizes = { base: FONT_SIZE[device], hover: FONT_SIZE_HOVER[device] };
  const labelWidth = d3.max(data, d => measureTextWidth(svg, d.canton, sizes.hover, true)) + 8;
  const gap = COLUMN_GAP[device];
  const columnWidth = (containerWidth - labelWidth - gap * (COLUMNS.length - 1)) / COLUMNS.length;

  const maxByColumn = COLUMNS.map(c => d3.max(data, d => d[c.key]));
  const valueWidth = measureTextWidth(svg, formatSwiss(d3.max(maxByColumn)), sizes.hover, true) + VALUE_GAP + 2;
  const barSpace = Math.max(10, columnWidth - valueWidth);

  const headerFont = fitHeaderFont(svg, columnWidth, HEADER_FONT_SIZE[device]);
  const headerLines = COLUMNS.map(c => wrapLines(svg, c.label[currentLang], columnWidth, headerFont));
  const headerHeight = d3.max(headerLines, l => l.length) * headerFont * 1.2 + 8;

  const rowHeight = ROW_HEIGHT[device];
  const innerHeight = data.length * rowHeight;

  return {
    sizes, labelWidth, gap, columnWidth, barSpace, maxByColumn,
    headerFont, headerLines, headerHeight, innerHeight,
    height: headerHeight + innerHeight + 4
  };
}

// Titres de colonne : taille reduite (jusqu'a HEADER_FONT_MIN) tant que le
// mot le plus long ne tient pas dans la colonne (ex. "Zulassungen:" sur mobile).
function fitHeaderFont(svg, columnWidth, maxSize) {
  const words = COLUMNS.flatMap(c => c.label[currentLang].split(" "));
  for (let size = maxSize; size > HEADER_FONT_MIN; size -= 0.5) {
    if (d3.max(words, w => measureTextWidth(svg, w, size, true)) <= columnWidth) return size;
  }
  return HEADER_FONT_MIN;
}

function columnX(layout, i) {
  return layout.labelWidth + i * (layout.columnWidth + layout.gap);
}

// ============================================================
// Dessin
// ============================================================

// Titres de colonne alignes en bas, pour que les barres demarrent toutes
// a la meme hauteur meme si un titre passe sur plus de lignes.
function drawHeaders(svg, layout) {
  const lineH = layout.headerFont * 1.2;
  COLUMNS.forEach((c, i) => {
    const lines = layout.headerLines[i];
    const text = svg.append("text")
      .attr("class", "column-header")
      .style("font-family", "Arial")
      .style("font-size", layout.headerFont + "px")
      .style("font-weight", "bold")
      .style("fill", "#111");
    lines.forEach((line, j) => {
      text.append("tspan")
        .attr("x", columnX(layout, i))
        .attr("y", layout.headerHeight - 6 - (lines.length - 1 - j) * lineH)
        .text(line);
    });
  });
}

function drawCantonLabels(g, data, y, layout) {
  g.selectAll("text.canton-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "canton-label")
    .attr("x", 0)
    .attr("y", d => y(d.canton) + y.bandwidth() / 2)
    .attr("dominant-baseline", "central")
    .style("font-family", "Arial")
    .style("font-size", layout.sizes.base + "px")
    .style("fill", "#333")
    .style("pointer-events", "none")
    .text(d => d.canton);
}

function drawColumn(g, data, y, layout, column, i) {
  const domainMax = SHARED_SCALE ? d3.max(layout.maxByColumn) : layout.maxByColumn[i];
  const scale = d3.scaleLinear().domain([0, domainMax]).range([0, layout.barSpace]);
  const barWidth = v => v > 0 ? Math.max(scale(v), MIN_BAR_WIDTH) : 0;

  const col = g.append("g").attr("transform", `translate(${columnX(layout, i)}, 0)`);

  // Ligne de base discrete, pour reperer le depart des barres.
  col.append("line")
    .attr("x1", 0).attr("x2", 0)
    .attr("y1", 0).attr("y2", layout.innerHeight)
    .attr("stroke", "#d0d0d0")
    .attr("stroke-width", 1);

  col.selectAll("rect.bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", 0)
    .attr("y", d => y(d.canton))
    .attr("height", y.bandwidth())
    .attr("width", 0)
    .attr("fill", column.color)
    .transition()
    .delay((d, j) => i * 120 + j * 25)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("width", d => barWidth(d[column.key]));

  col.selectAll("text.value")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value")
    .attr("x", 0)
    .attr("y", d => y(d.canton) + y.bandwidth() / 2)
    .attr("dominant-baseline", "central")
    .style("font-family", "Arial")
    .style("font-size", layout.sizes.base + "px")
    .style("fill", "#111")
    .style("pointer-events", "none")
    .text("0")
    .transition()
    .delay((d, j) => i * 120 + j * 25)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("x", d => barWidth(d[column.key]) + VALUE_GAP)
    .textTween(d => {
      const iVal = d3.interpolateNumber(0, d[column.key]);
      return t => formatSwiss(iVal(t));
    });
}

// ============================================================
// Survol : ligne mise en evidence dans toutes les colonnes (valeurs
// agrandies) + infobulle avec le nom complet du canton
// ============================================================

function createTooltip(svg) {
  const tooltip = svg.append("g")
    .style("opacity", 0)
    .style("pointer-events", "none");
  const rect = tooltip.append("rect")
    .attr("fill", "white")
    .attr("stroke", COLUMNS[0].color)
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

function highlight(svg, canton, sizes) {
  const isRow = d => canton !== null && d.canton === canton;
  const dim = d => (canton === null || d.canton === canton) ? 1 : 0.3;

  svg.selectAll(".bar").transition().duration(150).style("opacity", dim);

  svg.selectAll(".canton-label, .value").filter(isRow).raise();

  svg.selectAll(".canton-label, .value")
    .transition().duration(150)
    .style("opacity", dim)
    .style("font-weight", d => isRow(d) ? "bold" : "normal")
    .style("font-size", d => (isRow(d) ? sizes.hover : sizes.base) + "px")
    .style("fill", d => isRow(d) ? "#000" : "#333");
}

function attachHover(svg, data, y, offsetY, sizes, tip, containerWidth) {
  svg.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", 0)
    .attr("y", d => offsetY + y(d.canton) - (y.step() - y.bandwidth()) / 2)
    .attr("width", containerWidth)
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
// Orchestration
// ============================================================

function drawChart() {
  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const device = containerWidth < MOBILE_BREAKPOINT ? "mobile" : "desktop";

  d3.csv(DATA_FILE).then(raw => {
    const data = parseData(raw);

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", containerWidth);

    const layout = computeLayout(svg, data, containerWidth, device);
    svg.attr("height", layout.height);

    const y = d3.scaleBand()
      .domain(data.map(d => d.canton))
      .range([0, layout.innerHeight])
      .paddingInner(0.22)
      .paddingOuter(0.1);

    drawHeaders(svg, layout);

    const g = svg.append("g").attr("transform", `translate(0, ${layout.headerHeight})`);
    drawCantonLabels(g, data, y, layout);
    COLUMNS.forEach((column, i) => drawColumn(g, data, y, layout, column, i));

    const tip = createTooltip(svg);
    attachHover(svg, data, y, layout.headerHeight, layout.sizes, tip, containerWidth);
  });
}
