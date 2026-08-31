// Script D3 pur : aucune dépendance à p5.js. index.html ne charge que
// D3, et ce fichier n'utilise ni noCanvas() ni setup() ni draw() -
// voir tout en bas du fichier pour le point d'entrée (drawChart()
// appelé directement, sans passer par un cycle de vie p5).

// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "Einsatzbetriebe und Einsatzplätze pro Tätigkeitsbereich",
  fr: "Établissements et places d'affectation par domaine d'activité",
  it: "Istituti e posti d'impiego per ambito di attività"
};

// Une seule langue affichee a la fois (selon ?lang=), jamais les trois
// versions ensemble - ni dans la legende, ni dans le tooltip.
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

// Langue courante, determinee au demarrage depuis ?lang= (par defaut "de").
let currentLang = "de";

function getURLParams() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(params.entries());
}

// Couleurs officielles ZIVI : jaune (accent5) pour Einsatzbetriebe,
// lila (accent3) pour Einsatzplätze - même paire que le graphique à
// barres groupées, pour rester cohérent visuellement entre les deux
// versions du même jeu de données.
// Chaque cercle est rempli d'un dégradé radial (LIGHT au centre, BASE
// au bord) plutôt qu'une teinte plate, pour un effet de bulle/sphère
// plus vivant. Voir GRADIENT_BETRIEBE_ID / GRADIENT_PLAETZE_ID plus bas.
const BASE_BETRIEBE = "#FCEB30";   // accent5 - jaune, bord du dégradé
const LIGHT_BETRIEBE = "#FFFBE0";  // jaune très clair, centre du dégradé
const BASE_PLAETZE = "#A3A8CA";    // accent3 - lila, bord du dégradé
const LIGHT_PLAETZE = "#EBECF3";   // lila très clair, centre du dégradé
// STROKE_PLAETZE sert uniquement au contour de l'info-bulle (cf.
// createTooltip), plus autour des bulles elles-memes : le contour visible
// sur chaque bulle (fin liseré lila/jaune) ne plaisait pas et a ete retire,
// le degrade seul dessine desormais le bord de la bulle.
const STROKE_PLAETZE = "#7B81AC";  // contour, plus soutenu que BASE_PLAETZE

const GRADIENT_BETRIEBE_ID = "gradient-betriebe";
const GRADIENT_PLAETZE_ID = "gradient-plaetze";

// Un CSV par langue (data_de.csv / data_fr.csv / data_it.csv), chacun
// deja dans une seule langue - fini le split(" / ") sur le label.
function dataFile() {
  return "data_" + currentLang + ".csv";
}
const MOBILE_BREAKPOINT = 600;

// Empaquetage des bulles (d3.pack) : la taille de chaque bulle est
// proportionnelle au nombre de places d'affectation (Einsatzplätze),
// toujours supérieur au nombre d'établissements pour un même domaine.
const PACK_PADDING = 10;        // espace minimum entre deux bulles
const MIN_INNER_RADIUS = 14;    // assez grand pour que son chiffre reste lisible
const MAX_INNER_RATIO = 0.88;   // le jaune ne recouvre jamais tout à fait le lila

const TOOLTIP_PAD_X = 10;
const TOOLTIP_PAD_Y = 8;

// Légère oscillation continue des bulles ("respiration"), une fois leur
// apparition terminée. BUBBLE_PULSE_SCALE est un écart proportionnel
// (0.025 = +/-2.5%), volontairement modeste pour ne jamais empiéter sur
// les bulles voisines malgré l'empaquetage serré.
const BUBBLE_PULSE_SCALE = 0.025;
const BUBBLE_PULSE_DURATION = 2000;

// ============================================================
// Data
// ============================================================

function parseData(raw) {
  return raw.map(d => ({
    label: d["Tätigkeit"],
    betriebe: +d["Einsatzbetriebe"],
    plaetze: +d["Einsatzplätze"]
  }));
}

// Formatage suisse : 8'344
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// ============================================================
// Layout & empaquetage
// ============================================================

function computeLayout(containerWidth, isMobile) {
  const margin = { top: 0, right: 10, bottom: 10, left: 10 };
  const legendHeight = isMobile ? 44 : 38; // agrandi avec le texte de la legende
  const packWidth = containerWidth - margin.left - margin.right;
  const packHeight = isMobile ? Math.round(packWidth * 0.85) : Math.round(packWidth * 0.6);
  const width = containerWidth;
  const height = legendHeight + packHeight + margin.top + margin.bottom;

  return { margin, legendHeight, packWidth, packHeight, width, height };
}

function buildPackedNodes(data, packWidth, packHeight) {
  const root = d3.hierarchy({ children: data }).sum(d => d.plaetze || 0);
  d3.pack().size([packWidth, packHeight]).padding(PACK_PADDING)(root);
  return root.leaves();
}

// Rayon du cercle jaune (Einsatzbetriebe), à l'échelle de SA PROPRE
// bulle : proportionnel à la racine carrée du rapport betriebe/plaetze
// de ce domaine précis, pas à une échelle globale entre les bulles.
function computeInnerRadius(node) {
  const ratio = Math.sqrt(node.data.betriebe / node.data.plaetze);
  const cappedRatio = Math.min(ratio, MAX_INNER_RATIO);
  return Math.max(node.r * cappedRatio, MIN_INNER_RADIUS);
}

// Fait osciller doucement un groupe entre deux échelles (scale), en
// va-et-vient infini. Le délai initial permet d'attendre la fin de
// l'animation d'entrée de la bulle avant de démarrer la respiration.
function pulseLoop(selection, minScale, maxScale, duration, initialDelay) {
  function cycle() {
    selection
      .transition()
      .duration(duration)
      .ease(d3.easeSinInOut)
      .attr("transform", `scale(${maxScale})`)
      .transition()
      .duration(duration)
      .ease(d3.easeSinInOut)
      .attr("transform", `scale(${minScale})`)
      .on("end", cycle);
  }

  selection.transition().delay(initialDelay).on("end", cycle);
}

// Dégradés radiaux (centre clair -> bord de la teinte officielle), un
// par couleur, définis une seule fois et réutilisés par tous les
// cercles concernés via url(#id). Le décalage du centre (35%/35% au
// lieu de 50%/50%) simule un léger reflet, pour un rendu plus "bulle".
function drawGradientDefs(svg) {
  const defs = svg.append("defs");

  const gradients = [
    { id: GRADIENT_BETRIEBE_ID, light: LIGHT_BETRIEBE, base: BASE_BETRIEBE },
    { id: GRADIENT_PLAETZE_ID, light: LIGHT_PLAETZE, base: BASE_PLAETZE }
  ];

  gradients.forEach(gradient => {
    const radialGradient = defs.append("radialGradient")
      .attr("id", gradient.id)
      .attr("cx", "35%")
      .attr("cy", "35%")
      .attr("r", "65%");

    radialGradient.append("stop").attr("offset", "0%").attr("stop-color", gradient.light);
    radialGradient.append("stop").attr("offset", "100%").attr("stop-color", gradient.base);
  });
}

// ============================================================
// Légende
// ============================================================

function drawLegend(svg, isMobile) {
  const legend = svg.append("g").attr("transform", "translate(0, 8)");

  const colorByKey = { betriebe: BASE_BETRIEBE, plaetze: BASE_PLAETZE };
  const legendItems = legendLookup[currentLang];

  legendItems.forEach((item, i) => {
    const row = legend.append("g").attr("transform", `translate(0, ${i * 20})`);

    row.append("rect")
      .attr("width", 11)
      .attr("height", 11)
      .attr("y", 2)
      .attr("fill", colorByKey[item.key]);

    row.append("text")
      .attr("x", 17)
      .attr("y", 11)
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "11.5px" : "13px")
      .style("fill", "#111")
      .text(item.text);
  });
}

// ============================================================
// Bulles
// ============================================================

// Cercle extérieur (lila = Einsatzplätze) : détermine la taille
// globale de la bulle, avec animation d'apparition.
function drawOuterCircle(pulse) {
  pulse.append("circle")
    .attr("class", "outer")
    .attr("r", 0)
    .attr("fill", `url(#${GRADIENT_PLAETZE_ID})`)
    .transition()
    .delay((d, i) => i * 90)
    .duration(700)
    .ease(d3.easeCubicOut)
    .attr("r", d => d.r);
}

// Cercle intérieur (jaune = Einsatzbetriebe), imbriqué dans le lila.
function drawInnerCircle(pulse) {
  pulse.append("circle")
    .attr("class", "inner")
    .attr("r", 0)
    .attr("fill", `url(#${GRADIENT_BETRIEBE_ID})`)
    .transition()
    .delay((d, i) => i * 90 + 250)
    .duration(500)
    .ease(d3.easeCubicOut)
    .attr("r", d => computeInnerRadius(d));
}

function drawValueLabels(pulse, isMobile) {
  // Nombre de places d'affectation : seule information visible avant
  // le survol (le nom du domaine n'apparaît qu'au survol, cf.
  // showTooltip). Placé dans l'anneau lila resté visible, entre le
  // bord du cercle jaune et celui du cercle lila.
  pulse.append("text")
    .attr("class", "value")
    .attr("y", d => -(computeInnerRadius(d) + d.r) / 2)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10px" : "11.5px")
    .style("font-weight", "bold")
    .style("fill", "#1a1a3a")
    .style("opacity", 0)
    .text(d => formatSwiss(d.data.plaetze))
    .transition()
    .delay((d, i) => i * 90 + 550)
    .duration(300)
    .style("opacity", 1);

  // Nombre d'établissements d'affectation : centré dans le cercle
  // jaune, également visible en permanence (comme le nombre de places
  // ci-dessus).
  pulse.append("text")
    .attr("class", "value")
    .attr("y", 0)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "9px" : "10.5px")
    .style("font-weight", "bold")
    .style("fill", "#1a1a3a")
    .style("opacity", 0)
    .text(d => formatSwiss(d.data.betriebe))
    .transition()
    .delay((d, i) => i * 90 + 650)
    .duration(300)
    .style("opacity", 1);
}

// Légère oscillation continue, une fois l'apparition terminée : un
// discret effet de respiration (grossissement/rétrécissement autour
// du centre de la bulle), sans jamais déplacer son centre — ce qui
// garantit qu'elle ne vient jamais empiéter sur ses voisines.
function attachPulse(bubble) {
  bubble.each(function (d, i) {
    pulseLoop(
      d3.select(this).select("g.pulse"),
      1 - BUBBLE_PULSE_SCALE,
      1 + BUBBLE_PULSE_SCALE,
      BUBBLE_PULSE_DURATION + i * 70,
      i * 90 + 900
    );
  });
}

function drawBubbles(g, nodes, isMobile) {
  const bubble = g.selectAll("g.bubble")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", "bubble")
    .attr("transform", d => `translate(${d.x}, ${d.y})`);

  // Groupe interne, pour appliquer l'oscillation (pulseLoop, plus bas)
  // par un simple scale centré sur la bulle elle-même — jamais une
  // translation, qui risquerait de faire chevaucher les bulles voisines
  // dans cet empaquetage serré.
  const pulse = bubble.append("g").attr("class", "pulse");

  drawOuterCircle(pulse);
  drawInnerCircle(pulse);
  drawValueLabels(pulse, isMobile);
  attachPulse(bubble);

  return bubble;
}

// ============================================================
// Info-bulle (nom du domaine, révélé au survol)
// ============================================================

function createTooltip(svg) {
  const tooltip = svg.append("g")
    .style("opacity", 0)
    .style("pointer-events", "none");

  const tooltipRect = tooltip.append("rect")
    .attr("fill", "white")
    .attr("stroke", STROKE_PLAETZE)
    .attr("stroke-width", 1.5)
    .attr("rx", 5);

  const tooltipText = tooltip.append("text")
    .style("font-family", "Arial")
    .style("font-size", "12.5px")
    .style("fill", "#111");

  return { tooltip, tooltipRect, tooltipText };
}

function fillTooltipText(tooltipText, node) {
  // data_<lang>.csv ne contient deja plus qu'une seule langue : une
  // seule ligne de texte, jamais les trois versions empilees.
  tooltipText.selectAll("tspan").remove();
  tooltipText.attr("x", TOOLTIP_PAD_X).attr("y", 0);

  tooltipText.append("tspan")
    .attr("x", TOOLTIP_PAD_X)
    .attr("dy", 0)
    .style("font-weight", "bold")
    .text(node.data.label);
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

function showTooltip(event, node, tooltipParts, svg, chartWidth) {
  const [mx, my] = d3.pointer(event, svg.node());
  fillTooltipText(tooltipParts.tooltipText, node);
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
    .style("opacity", d => (hoveredNode === null || d === hoveredNode) ? 1 : 0.35);
}

function attachHover(bubble, tooltipParts, svg, chartWidth) {
  bubble
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      highlightBubble(bubble, d);
      showTooltip(event, d, tooltipParts, svg, chartWidth);
    })
    .on("mousemove", (event, d) => showTooltip(event, d, tooltipParts, svg, chartWidth))
    .on("mouseout", function () {
      highlightBubble(bubble, null);
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

  d3.csv(dataFile()).then(raw => {
    const data = parseData(raw);
    const layout = computeLayout(containerWidth, isMobile);
    const nodes = buildPackedNodes(data, layout.packWidth, layout.packHeight);

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", layout.width)
      .attr("height", layout.height);

    drawGradientDefs(svg);
    drawLegend(svg, isMobile);

    const g = svg.append("g")
      .attr("transform", `translate(${layout.margin.left}, ${layout.legendHeight})`);

    const bubble = drawBubbles(g, nodes, isMobile);
    const tooltipParts = createTooltip(svg);
    attachHover(bubble, tooltipParts, svg, layout.width);
  });
}

// ============================================================
// Entry point
// ============================================================

// Script D3 pur (pas de p5) : charge en "defer" dans index.html, donc
// le DOM est déjà prêt quand ce code s'exécute.
function init() {
  const params = getURLParams();
  currentLang = params.lang || currentLang;

  d3.select("#titleContainer").text(titleLookup[currentLang]);

  drawChart();
}

init();
window.addEventListener("resize", drawChart);
