// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "2025: Diensttage nach Tätigkeitsbereich",
  fr: "2025 : Jours de service par domaine d'activité",
  it: "2025: Giorni di servizio per ambiti d’attività"
};

// Plus de 4 domaines : palette fixe à 4 couleurs (petrol, lila, mint,
// kaki), reprise par cycle dans l'ordre des bulles (triées par valeur
// décroissante) — couleur unie, pas de dégradé.
const PALETTE = ["#5A959D", "#A3A8CA", "#CAE7EA", "#B1B488"];

function buildColorScale(data) {
  const colorByRow = new Map(data.map((d, i) => [d, PALETTE[i % PALETTE.length]]));
  return d => colorByRow.get(d);
}

const MOBILE_BREAKPOINT = 600;

// En dessous de ce pourcentage, la bulle est trop petite pour accueillir
// lisiblement son étiquette : le pourcentage est alors affiché juste en
// dessous de la bulle plutôt que dedans (même seuil que l'ancien
// camembert pour ses petites parts).
const INNER_LABEL_MIN_PERCENT = 5;

// Empaquetage des bulles (d3.pack) : l'aire de chaque bulle est
// proportionnelle au nombre de jours de service de son domaine.
const PACK_PADDING = 14;

const TOOLTIP_PAD_X = 10;
const TOOLTIP_PAD_Y = 8;

// Marge a laquelle les bulles sont alignees a gauche (cf.
// computeBubbleTransform) : sur un conteneur large, d3.pack() n'etale pas
// forcement les bulles sur toute la largeur disponible (la hauteur du
// graphique reste souvent le facteur limitant), ce qui les laissait
// flotter au milieu d'un grand vide. On les replace nous-memes a gauche.
const BUBBLES_LEFT_MARGIN = 20;

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

// ============================================================
// Empaquetage
// ============================================================

function buildPackedNodes(data, width, height) {
  const root = d3.hierarchy({ children: data }).sum(d => d.Value);
  d3.pack().size([width, height]).padding(PACK_PADDING)(root);
  return root.leaves();
}

// ============================================================
// Bulles
// ============================================================

// Texte des étiquettes : toujours en noir, non gras.
function styleLabelText(sel) {
  return sel
    .style("font-family", "Arial")
    .style("font-weight", "normal")
    .style("fill", "#111");
}

// Seul le pourcentage reste affiché en permanence (dans la bulle si elle
// est assez grande pour l'accueillir, juste en dessous sinon) — le nom du
// domaine et le chiffre exact n'apparaissent qu'au survol (info-bulle).
function drawPercentLabels(bubble, isMobile) {
  const bigBubbles = bubble.filter(d => d.data.Percent >= INNER_LABEL_MIN_PERCENT);
  const smallBubbles = bubble.filter(d => d.data.Percent < INNER_LABEL_MIN_PERCENT);

  styleLabelText(
    bigBubbles.append("text")
      .attr("class", "percent-label")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", d => Math.min(isMobile ? 14 : 16, Math.max(9, d.r * 0.4)) + "px")
      .style("opacity", 0)
  )
    .text(d => formatPercent(d.data.Percent))
    .transition()
    .delay((d, i) => i * 70 + 350)
    .duration(300)
    .style("opacity", 1);

  styleLabelText(
    smallBubbles.append("text")
      .attr("class", "percent-label percent-label-outside")
      .attr("text-anchor", "middle")
      .attr("y", d => d.r + 12)
      .style("font-size", isMobile ? "9.5px" : "10.5px")
      .style("opacity", 0)
  )
    .text(d => formatPercent(d.data.Percent))
    .transition()
    .delay((d, i) => i * 70 + 350)
    .duration(300)
    .style("opacity", 1);
}

function drawBubbleShapes(g, nodes, colorFor, isMobile) {
  const bubble = g.selectAll("g.bubble")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", "bubble")
    .attr("transform", d => `translate(${d.x}, ${d.y})`)
    .style("cursor", "pointer");

  // Pas d'oscillation continue ("respiration") sur ce graphique : avec
  // des bulles aussi inegales en taille et deja serrees les unes contre
  // les autres, la moindre variation periodique de rayon risquait de les
  // faire se chevaucher transitoirement. Le groupe "pulse" ne sert donc
  // plus qu'a regrouper le cercle et ses etiquettes.
  const pulse = bubble.append("g").attr("class", "pulse");

  pulse.append("circle")
    .attr("class", "bubble-circle")
    .attr("r", 0)
    .attr("fill", d => colorFor(d.data))
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .transition()
    .delay((d, i) => i * 70)
    .duration(600)
    .ease(d3.easeCubicOut)
    .attr("r", d => d.r);

  drawPercentLabels(pulse, isMobile);

  return bubble;
}

// Boite englobante reelle du nuage de bulles (d3.pack ne garantit pas
// qu'il occupe toute la zone [width, height] fournie), pour pouvoir
// ensuite le repositionner nous-memes (aligne a gauche, centre
// verticalement) plutot que de garder sa position brute.
function computeBubbleExtent(nodes) {
  return {
    minX: d3.min(nodes, d => d.x - d.r),
    maxX: d3.max(nodes, d => d.x + d.r),
    minY: d3.min(nodes, d => d.y - d.r),
    maxY: d3.max(nodes, d => d.y + d.r)
  };
}

function computeBubbleGroupTransform(nodes, panelHeight) {
  const extent = computeBubbleExtent(nodes);
  const clusterHeight = extent.maxY - extent.minY;

  const tx = BUBBLES_LEFT_MARGIN - extent.minX;
  const ty = (panelHeight - clusterHeight) / 2 - extent.minY;

  return `translate(${tx}, ${ty})`;
}

// ============================================================
// Info-bulle (nom du domaine + chiffre exact, révélés au survol)
// ============================================================

function createTooltip(svg) {
  const tooltip = svg.append("g")
    .style("opacity", 0)
    .style("pointer-events", "none");

  const tooltipRect = tooltip.append("rect")
    .attr("fill", "white")
    .attr("stroke", "#5A959D")
    .attr("stroke-width", 1.5)
    .attr("rx", 5);

  const tooltipText = tooltip.append("text")
    .style("font-family", "Arial")
    .style("font-size", "12.5px")
    .style("fill", "#111");

  return { tooltip, tooltipRect, tooltipText };
}

// Repart toujours de (0, 0) avant de (re)mesurer la boîte : sinon
// getBBox() refléterait encore la position laissée par le survol
// précédent et le texte dériverait hors de l'encadré au fil des survols.
function fillTooltipText(tooltipText, d) {
  tooltipText.selectAll("tspan").remove();
  tooltipText.attr("x", 0).attr("y", 0);

  tooltipText.append("tspan")
    .attr("x", TOOLTIP_PAD_X)
    .attr("dy", 0)
    .style("font-weight", "normal")
    .text(d.data.Label);

  tooltipText.append("tspan")
    .attr("x", TOOLTIP_PAD_X)
    .attr("dy", "1.35em")
    .style("font-weight", "normal")
    .style("fill", "#555")
    .text(formatSwiss(d.data.Value));
}

function positionTooltip(tooltipParts, mx, my, chartWidth) {
  const { tooltip, tooltipRect, tooltipText } = tooltipParts;
  const bbox = tooltipText.node().getBBox();
  const boxWidth = bbox.width + TOOLTIP_PAD_X * 2;
  const boxHeight = bbox.height + TOOLTIP_PAD_Y * 2;

  let tx = mx + 14;
  let ty = my - boxHeight - 10;
  if (tx + boxWidth > chartWidth) tx = mx - boxWidth - 14;
  if (ty < 0) ty = my + 10;

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

// ============================================================
// Interaction
// ============================================================

function highlightBubble(bubble, hoveredNode) {
  bubble
    .transition()
    .duration(150)
    .style("opacity", d => (hoveredNode === null || d === hoveredNode) ? 1 : 0.3);
}

function attachHover(bubble, tooltipParts, svg, chartWidth) {
  bubble
    .on("mouseover", function (event, d) {
      highlightBubble(bubble, d);
      d3.select(this).select("circle.bubble-circle").attr("stroke", "#333").attr("stroke-width", 2);
      showTooltip(event, d, tooltipParts, svg, chartWidth);
    })
    .on("mousemove", (event, d) => showTooltip(event, d, tooltipParts, svg, chartWidth))
    .on("mouseout", function () {
      highlightBubble(bubble, null);
      d3.select(this).select("circle.bubble-circle").attr("stroke", "#fff").attr("stroke-width", 1.5);
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
  const panelHeight = isMobile ? 380 : 460;

  const svg = d3.select("#chart")
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", panelHeight);

  d3.csv("data_" + currentLang + ".csv").then(data => {

    data.forEach(d => {
      d.Value = +d.Value;
      d.Percent = +d.Percent;
    });

    data.sort((a, b) => b.Value - a.Value);

    const colorFor = buildColorScale(data);
    const nodes = buildPackedNodes(data, containerWidth, panelHeight);

    const g = svg.append("g")
      .attr("transform", computeBubbleGroupTransform(nodes, panelHeight));
    const bubble = drawBubbleShapes(g, nodes, colorFor, isMobile);

    const tooltipParts = createTooltip(svg);
    attachHover(bubble, tooltipParts, svg, containerWidth);
  });
}
