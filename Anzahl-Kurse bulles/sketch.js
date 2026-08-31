// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "Anzahl Kurse",
  fr: "Nombre de cours",
  it: "Numero dei corsi"
};

// Même rouge officiel ZIVI (accent6) que le bar chart original. Chaque
// bulle est coloree individuellement selon sa propre valeur (degrade
// clair -> fonce), pas juste deux couleurs fixes par serie.
const BASE_RED = "#FF0000";
const LIGHT_RED = "#FFD1D1";

const DATA_FILE = "EAZ_Anzahl_Kurse.csv";
const MOBILE_BREAKPOINT = 600;

// Empaquetage des bulles (d3.pack) : l'aire de chaque bulle est
// proportionnelle au nombre de cours de son annee (meme logique que
// l'ancien treemap, juste des cercles a la place des carres).
const PACK_PADDING = 8;

// Legere oscillation continue des bulles ("respiration"), une fois leur
// apparition terminee. BUBBLE_PULSE_SCALE est un ecart proportionnel
// (0.03 = +/-3%), volontairement modeste pour ne jamais empieter sur les
// bulles voisines malgre l'empaquetage serre.
const BUBBLE_PULSE_SCALE = 0.03;
const BUBBLE_PULSE_DURATION = 2000;

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

// --- Formatage suisse : 1'234 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// ============================================================
// Empaquetage
// ============================================================

function buildPackedNodes(data, width, height) {
  const root = d3.hierarchy({ children: data }).sum(d => d.value);
  d3.pack().size([width, height]).padding(PACK_PADDING)(root);
  return root.leaves();
}

function getFillColor(value, colorScale) {
  return d3.interpolate(LIGHT_RED, BASE_RED)(colorScale(value));
}

// Un degrade radial par bulle (centre eclairci -> couleur reelle de la
// bulle au bord), pour un effet de sphere plutot qu'un aplat plat. Le
// decalage du centre (35%/35% au lieu de 50%/50%) simule un leger reflet.
function drawGradientDefs(svg, nodes, colorScale) {
  const defs = svg.append("defs");

  nodes.forEach(d => {
    const base = getFillColor(d.data.value, colorScale);
    const light = d3.interpolate("#ffffff", base)(0.4);

    const gradient = defs.append("radialGradient")
      .attr("id", `gradient-year-${d.data.year}`)
      .attr("cx", "35%")
      .attr("cy", "35%")
      .attr("r", "65%");

    gradient.append("stop").attr("offset", "0%").attr("stop-color", light);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", base);
  });
}

// Fait osciller doucement un groupe entre deux echelles (scale), en
// va-et-vient infini. Le delai initial permet d'attendre la fin de
// l'animation d'entree de la bulle avant de demarrer la respiration.
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

// ============================================================
// Info-bulle (valeur exacte, revelee au survol) — centree sur la bulle
// elle-meme (d.x, d.y), pas sur la position du curseur : sinon la bulle
// flottante se retrouve calee pres du bord par lequel la souris est
// entree (souvent le haut), au lieu d'etre centree sur la cellule.
// ============================================================

function createTooltip(svg) {
  const tooltip = svg.append("g").style("opacity", 0).style("pointer-events", "none");
  const tooltipRect = tooltip.append("rect")
    .attr("fill", "white")
    .attr("stroke", "#555")
    .attr("stroke-width", 1.2)
    .attr("rx", 5);
  const tooltipText = tooltip.append("text")
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", "13.5px")
    .style("font-weight", "bold")
    .style("fill", "#111");

  const padX = 10, padY = 7;

  function show(d) {
    tooltip.raise();

    tooltipText.attr("x", 0).attr("y", 0)
      .text(formatSwiss(d.data.value));

    const bbox = tooltipText.node().getBBox();
    const boxW = bbox.width + padX * 2;
    const boxH = bbox.height + padY * 2;

    // Centree sur le centre de la bulle (d.x, d.y).
    tooltip.attr("transform", `translate(${d.x - boxW / 2}, ${d.y - boxH / 2})`);
    tooltipRect.attr("x", 0).attr("y", 0).attr("width", boxW).attr("height", boxH);
    tooltipText.attr("x", boxW / 2).attr("y", padY - bbox.y);
    tooltip.style("opacity", 1);
  }

  function hide() {
    tooltip.style("opacity", 0);
  }

  return { show, hide };
}

// ============================================================
// Bulles
// ============================================================

function drawBubbleShapes(svg, nodes, isMobile) {
  const bubble = svg.selectAll("g.bubble")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", "bubble")
    .attr("transform", d => `translate(${d.x}, ${d.y})`)
    .style("cursor", "pointer");

  // Groupe interne, pour appliquer l'oscillation (pulseLoop, plus bas)
  // par un simple scale centre sur la bulle elle-meme — jamais une
  // translation, qui risquerait de faire chevaucher les bulles voisines.
  const pulse = bubble.append("g").attr("class", "pulse");

  pulse.append("circle")
    .attr("r", 0)
    .attr("fill", d => `url(#gradient-year-${d.data.year})`)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .transition()
    .delay((d, i) => i * 70)
    .duration(600)
    .ease(d3.easeCubicOut)
    .attr("r", d => d.r);

  // Seule l'annee reste affichee en permanence dans la bulle — la valeur
  // n'apparait qu'au survol, dans l'info-bulle flottante (cf. tooltip).
  pulse.append("text")
    .attr("class", "bubble-year")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-weight", "bold")
    .style("fill", "#111")
    .style("paint-order", "stroke")
    .style("stroke", "#fff")
    .style("stroke-width", "3px")
    .style("stroke-linejoin", "round")
    .style("font-size", d => Math.min(isMobile ? 14 : 16, d.r * 0.5) + "px")
    .style("opacity", 0)
    .text(d => d.data.year)
    .transition()
    .delay((d, i) => i * 70 + 350)
    .duration(300)
    .style("opacity", 1);

  return bubble;
}

// Legere oscillation continue, une fois l'apparition terminee : un
// discret effet de respiration (grossissement/retrecissement autour du
// centre de la bulle), sans jamais deplacer son centre — ce qui
// garantit qu'elle ne vient jamais empieter sur ses voisines.
function startBubblePulses(bubble) {
  bubble.each(function (d, i) {
    pulseLoop(
      d3.select(this).select("g.pulse"),
      1 - BUBBLE_PULSE_SCALE,
      1 + BUBBLE_PULSE_SCALE,
      BUBBLE_PULSE_DURATION + i * 60,
      i * 70 + 650
    );
  });
}

function attachBubbleInteractions(bubble, tooltip) {
  bubble
    .on("mouseover", function (event, d) {
      d3.select(this).select("circle").attr("stroke", "#333").attr("stroke-width", 2.5);
      tooltip.show(d);
    })
    .on("mouseout", function () {
      d3.select(this).select("circle").attr("stroke", "#fff").attr("stroke-width", 1.5);
      tooltip.hide();
    });
}

function drawBubbles(svg, nodes, isMobile, tooltip) {
  const bubble = drawBubbleShapes(svg, nodes, isMobile);
  startBubblePulses(bubble);
  attachBubbleInteractions(bubble, tooltip);
  return bubble;
}

// ============================================================
// Orchestration
// ============================================================

function drawChart() {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const isMobile = containerWidth < MOBILE_BREAKPOINT;
  const panelHeight = isMobile ? 340 : 440;

  const svg = d3.select("#chart")
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", panelHeight);

  d3.csv(DATA_FILE).then(raw => {

    const data = raw.map(d => ({
      year: d["Jahr"],
      value: +d["Anzahl_Ausbildungskurse"]
    }));

    const nodes = buildPackedNodes(data, containerWidth, panelHeight);

    const minVal = d3.min(data, d => d.value);
    const maxVal = d3.max(data, d => d.value);

    // Degrade cale sur l'ecart reel des valeurs (609–811, comme dans la
    // version bar chart) plutot que sur [0, max] : sinon la variation de
    // teinte serait presque invisible, les valeurs etant toutes proches.
    const colorScale = d3.scaleLinear().domain([minVal, maxVal]).range([0, 1]);

    drawGradientDefs(svg, nodes, colorScale);
    const tooltip = createTooltip(svg);
    drawBubbles(svg, nodes, isMobile, tooltip);
  });
}
