// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "Anzahl Kurse",
  fr: "Nombre de cours",
  it: "Numero dei corsi"
};

// Même petrol officiel ZIVI (accent1) que le bar chart original.
// Couleur unie pour toutes les bulles (pas de degrade) : graphique
// a une seule variable.
const BASE_PETROL = "#5A959D";

const DATA_FILE = "EAZ_Anzahl_Kurse.csv";
const MOBILE_BREAKPOINT = 600;

// Positionnement le long d'un axe x (une bulle par annee, alignee sur
// sa position sur l'axe) plutot qu'un empaquetage libre (d3.pack) :
// l'aire de chaque bulle reste proportionnelle au nombre de cours de
// son annee (meme logique qu'avant), mais son centre x correspond
// desormais a l'annee, toutes les bulles reposant sur la meme ligne de
// base au-dessus de l'axe.
const MAX_RADIUS_DESKTOP = 50;
const MAX_RADIUS_MOBILE = 34;
const MIN_RADIUS = 4;

// Fraction du demi-intervalle entre deux annees consecutives que le
// rayon maximal peut occuper : reserve toujours un espace visible entre
// deux bulles voisines, meme si elles sont toutes les deux au rayon max.
const BUBBLE_GUTTER = 0.86;

// Espace vertical entre le bas de la plus grande bulle possible et la
// ligne de l'axe x.
const AXIS_GAP = 14;

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
// Mise en page (positions le long de l'axe x) + axe
// ============================================================

// Construit la mise en page : position x de chaque annee sur l'axe,
// rayon de sa bulle (aire proportionnelle a la valeur), et la hauteur
// totale du panneau necessaire (dependante du rayon max effectif).
function buildTimelineLayout(data, containerWidth, isMobile) {
  const maxValue = d3.max(data, d => d.value);
  const nominalMaxR = isMobile ? MAX_RADIUS_MOBILE : MAX_RADIUS_DESKTOP;

  // Marges laterales : assez larges pour que la premiere/derniere bulle
  // (au rayon nominal max) ne soit jamais rognee par le bord du panneau.
  const sidePad = nominalMaxR + (isMobile ? 8 : 12);
  const margin = {
    top: isMobile ? 14 : 18,
    left: sidePad,
    right: sidePad,
    bottom: isMobile ? 30 : 34
  };
  const innerWidth = Math.max(0, containerWidth - margin.left - margin.right);

  const x = d3.scalePoint()
    .domain(data.map(d => d.year))
    .range([0, innerWidth]);

  const step = data.length > 1 ? innerWidth / (data.length - 1) : innerWidth;
  const maxR = Math.max(MIN_RADIUS, Math.min(nominalMaxR, (step / 2) * BUBBLE_GUTTER));

  // Domaine ET intervalle de sortie bases sur zero : l'aire de chaque
  // bulle est ainsi strictement proportionnelle a sa valeur (pas
  // seulement son rayon). Le plancher MIN_RADIUS est applique apres
  // coup, en garde-fou pour une valeur nulle/quasi nulle, sans fausser
  // la proportionnalite entre les valeurs reelles des donnees.
  const rScale = d3.scaleSqrt().domain([0, maxValue]).range([0, maxR]);
  const r = value => Math.max(MIN_RADIUS, rScale(value));

  const bubbleY = margin.top + maxR;
  const axisY = bubbleY + maxR + AXIS_GAP;
  const height = axisY + margin.bottom;

  const nodes = data.map(d => ({
    data: d,
    x: margin.left + x(d.year),
    y: bubbleY,
    r: r(d.value)
  }));

  return { nodes, x, margin, height, axisY };
}

// --- Axe X : une graduation par annee, alignee sur la position des bulles ---
function drawXAxis(svg, x, margin, axisY, isMobile) {
  svg.append("g")
    .attr("transform", `translate(${margin.left}, ${axisY})`)
    .call(d3.axisBottom(x).tickSizeOuter(0))
    .selectAll("text")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "9px" : "10px")
    .style("fill", "#555");
}

function getFillColor() {
  return BASE_PETROL;
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
    .attr("fill", BASE_PETROL)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .transition()
    .delay((d, i) => i * 70)
    .duration(600)
    .ease(d3.easeCubicOut)
    .attr("r", d => d.r);

  // L'annee est deja portee par l'axe x : la bulle affiche desormais sa
  // valeur en permanence (plus besoin d'un survol pour la lire).
  pulse.append("text")
    .attr("class", "bubble-value")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-weight", "normal")
    .style("fill", "#111")
    .style("paint-order", "stroke")
    .style("stroke", "#fff")
    .style("stroke-width", "3px")
    .style("stroke-linejoin", "round")
    .style("font-size", d => Math.min(isMobile ? 14 : 16, d.r * 0.5) + "px")
    .style("opacity", 0)
    .text(d => formatSwiss(d.data.value))
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

function attachBubbleInteractions(bubble) {
  bubble
    .on("mouseover", function () {
      d3.select(this).select("circle").attr("stroke", "#333").attr("stroke-width", 2.5);
    })
    .on("mouseout", function () {
      d3.select(this).select("circle").attr("stroke", "#fff").attr("stroke-width", 1.5);
    });
}

function drawBubbles(svg, nodes, isMobile) {
  const bubble = drawBubbleShapes(svg, nodes, isMobile);
  startBubblePulses(bubble);
  attachBubbleInteractions(bubble);
  return bubble;
}

// ============================================================
// Orchestration
// ============================================================

function drawChart() {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const isMobile = containerWidth < MOBILE_BREAKPOINT;

  d3.csv(DATA_FILE).then(raw => {

    const data = raw
      .map(d => ({
        year: d["Jahr"],
        value: +d["Anzahl_Ausbildungskurse"]
      }))
      .sort((a, b) => a.year - b.year);

    const layout = buildTimelineLayout(data, containerWidth, isMobile);

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", layout.height);

    drawXAxis(svg, layout.x, layout.margin, layout.axisY, isMobile);

    drawBubbles(svg, layout.nodes, isMobile);
  });
}
