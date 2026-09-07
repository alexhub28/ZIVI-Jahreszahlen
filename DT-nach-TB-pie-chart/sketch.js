// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "2025: Diensttage nach Tätigkeitsbereich",
  fr: "2025 : Jours de service par domaine d'activité",
  it: "2025: Giorni di servizio per ambiti d’attività"
};

// Plus de 4 domaines : palette fixe à 4 couleurs, cyclée par ordre
// de bulle (valeur décroissante), toujours en aplat.
const PALETTE = ["#5A959D", "#A3A8CA", "#CAE7EA", "#B1B488"];

function buildColorScale(data) {
  const colorByRow = new Map(data.map((d, i) => [d, PALETTE[i % PALETTE.length]]));
  return d => colorByRow.get(d);
}

const MOBILE_BREAKPOINT = 600;

// En dessous, la bulle est trop petite pour son étiquette (affichée
// à côté plutôt que dedans). Seuil à 2 (pas 5, hérité du camembert) :
// les bulles à 3.6 % et 2.7 % ont assez de place à l'intérieur.
const INNER_LABEL_MIN_PERCENT = 2;

// Empaquetage des bulles (d3.pack) : l'aire de chaque bulle est
// proportionnelle au nombre de jours de service de son domaine.
const PACK_PADDING = 14;

// Légère animation continue ("respiration") des bulles, une fois leur
// apparition terminée : chaque bulle oscille doucement dans une
// direction qui lui est propre (cf. FLOAT_DIRECTIONS), sans jamais
// empiéter sur l'écart minimal entre deux bulles garanti par
// PACK_PADDING (14px) — amplitude volontairement faible pour rester
// sûre même si deux bulles voisines se rapprochaient en même temps
// (pire cas : 2 x amplitude < PACK_PADDING).
const BUBBLE_FLOAT_AMPLITUDE = 3;
const BUBBLE_FLOAT_DURATION = 2200;

// 8 directions cycliques (index % 8), pour que les bulles voisines ne
// flottent pas toutes de façon synchronisée dans le même sens.
const FLOAT_DIRECTIONS = [
  [1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7],
  [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7]
];

const TOOLTIP_PAD_X = 10;
const TOOLTIP_PAD_Y = 8;

// Marge d'alignement à gauche (cf. computeBubbleTransform) : d3.pack()
// n'étale pas toujours les bulles sur toute la largeur, on les replace
// nous-mêmes plutôt que de les laisser flotter au milieu d'un vide.
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

// Position d'étiquette extérieure : en dessous par défaut, sinon
// droite/gauche/au-dessus si ça chevauche une bulle voisine.
function chooseOutsideLabelPosition(d, allNodes) {
  const GAP = 8;
  const candidates = [
    { dx: 0, dy: d.r + GAP + 6, anchor: "middle" },     // en dessous
    { dx: d.r + GAP, dy: 0, anchor: "start" },          // à droite
    { dx: -(d.r + GAP), dy: 0, anchor: "end" },         // à gauche
    { dx: 0, dy: -(d.r + GAP + 4), anchor: "middle" }   // au-dessus
  ];

  // Marge généreuse : le point testé n'est que l'ancrage du texte,
  // qui s'étend de part et d'autre — sans marge il paraît collé au cercle.
  const LABEL_HALF_WIDTH = 22;

  for (const c of candidates) {
    const px = d.x + c.dx;
    const py = d.y + c.dy;
    const collides = allNodes.some(other => {
      if (other === d) return false;
      return Math.hypot(px - other.x, py - other.y) < other.r + LABEL_HALF_WIDTH;
    });
    if (!collides) return c;
  }
  return candidates[0]; // repli : en dessous, même si ça chevauche encore
}

// Seul le pourcentage reste affiché en permanence ; le nom et le
// chiffre exact n'apparaissent qu'au survol (info-bulle).
function drawPercentLabels(bubble, isMobile) {
  const allNodes = bubble.data();

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

  const outsidePosition = new Map(
    smallBubbles.data().map(d => [d, chooseOutsideLabelPosition(d, allNodes)])
  );

  styleLabelText(
    smallBubbles.append("text")
      .attr("class", "percent-label percent-label-outside")
      .attr("text-anchor", d => outsidePosition.get(d).anchor)
      .attr("dominant-baseline", "middle")
      .attr("x", d => outsidePosition.get(d).dx)
      .attr("y", d => outsidePosition.get(d).dy)
      .style("font-size", isMobile ? "9.5px" : "10.5px")
      .style("opacity", 0)
  )
    .text(d => formatPercent(d.data.Percent))
    .transition()
    .delay((d, i) => i * 70 + 350)
    .duration(300)
    .style("opacity", 1);
}

// Fait flotter doucement un groupe entre deux positions (transform
// SVG), en va-et-vient infini. Le délai initial permet d'attendre la
// fin de l'animation d'entrée de la bulle avant de démarrer.
function floatLoop(selection, transformA, transformB, duration, initialDelay) {
  function cycle() {
    selection
      .transition()
      .duration(duration)
      .ease(d3.easeSinInOut)
      .attr("transform", transformA)
      .transition()
      .duration(duration)
      .ease(d3.easeSinInOut)
      .attr("transform", transformB)
      .on("end", cycle);
  }

  selection.transition().delay(initialDelay).on("end", cycle);
}

// Démarre le flottement d'une bulle : direction propre à son index,
// durée et délai légèrement décalés pour que les bulles ne bougent
// pas toutes en même temps.
function startBubbleFloat(pulse, i) {
  const [dx, dy] = FLOAT_DIRECTIONS[i % FLOAT_DIRECTIONS.length];
  const ax = (dx * BUBBLE_FLOAT_AMPLITUDE).toFixed(2);
  const ay = (dy * BUBBLE_FLOAT_AMPLITUDE).toFixed(2);
  floatLoop(
    pulse,
    `translate(${-ax}, ${-ay})`,
    `translate(${ax}, ${ay})`,
    BUBBLE_FLOAT_DURATION + i * 60,
    i * 90 + 900
  );
}

function drawBubbleShapes(g, nodes, colorFor, isMobile) {
  const bubble = g.selectAll("g.bubble")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", "bubble")
    .attr("transform", d => `translate(${d.x}, ${d.y})`)
    .style("cursor", "pointer");

  // "pulse" groupe cercle + texte : c'est ce groupe qui flotte
  // légèrement une fois l'apparition terminée (cf. startBubbleFloat).
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

  pulse.each(function (d, i) {
    startBubbleFloat(d3.select(this), i);
  });

  return bubble;
}

// Boîte englobante réelle du nuage (d3.pack ne remplit pas forcément
// [width, height]), pour le repositionner nous-mêmes.
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

// Repart de (0,0) avant de mesurer : sinon getBBox() garde la
// position du survol précédent et le texte dérive hors de l'encadré.
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
