// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "2025: Diensttage nach Tätigkeitsbereich",
  fr: "2025 : Jours de service par domaine d'activité",
  it: "2025: Giorni di servizio per ambiti d’attività"
};

// Titre de l'axe X, une seule langue a la fois.
const axisTitleLookup = {
  de: "Diensttage",
  fr: "Jours de service",
  it: "Giorni di servizio"
};

// Plus de 4 domaines : palette fixe à 4 couleurs (petrol, lila, mint,
// kaki), reprise par cycle dans l'ordre des barres (triées par valeur
// décroissante) — couleur unie, pas de dégradé.
const PALETTE = ["#5A959D", "#A3A8CA", "#CAE7EA", "#B1B488"];

function buildColorScale(data) {
  const colorByRow = new Map(data.map((d, i) => [d, PALETTE[i % PALETTE.length]]));
  return d => colorByRow.get(d);
}

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

// --- Barres avec animation d'apparition ---
function drawBars(g, data, x, y, colorFor) {
  const bars = g.selectAll("rect.bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("y", d => y(d.Label))
    .attr("height", y.bandwidth())
    .attr("width", 0)
    .attr("fill", d => colorFor(d));

  bars.transition()
    .delay((d, i) => i * 80)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("width", d => x(d.Value));
}

// --- Label (langue courante), centré verticalement. Entièrement à
// l'intérieur de la barre s'il y tient (x = 8, sur la couleur) ; sinon
// entièrement après la barre (x = fin de barre + 8, sur fond blanc) —
// jamais à cheval sur les deux, ce qui rendait le texte illisible à la
// jonction couleur/blanc pour les barres courtes à nom long.
// Doit être dessiné AVANT drawValueLabels : on mesure ici la largeur
// réelle de chaque label (getComputedTextLength) et on stocke sur la
// donnée où il se termine (d._labelEnd), pour que le "%" sache où
// commencer sans jamais chevaucher le nom du domaine.
function drawRowLabels(g, data, x, y, isMobile) {
  g.selectAll("text.label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", 8)
    .attr("y", d => y(d.Label) + y.bandwidth() / 2)
    .attr("text-anchor", "start")
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "9.5px" : "10.5px")
    .style("font-weight", "normal")
    .style("fill", "#111")
    .text(d => d.Label)
    .attr("x", function (d) {
      const barWidth = x(d.Value);
      const labelWidth = this.getComputedTextLength();
      const fitsInside = labelWidth + 8 + 6 <= barWidth; // 6px de marge avant la fin de barre
      const startX = fitsInside ? 8 : barWidth + 8;
      d._labelEnd = startX + labelWidth;
      return startX;
    });
}

// --- Étiquette "%" au bout de chaque barre (ou après le label, si le
// nom du domaine dépasse la barre — cf. d._labelEnd), avec compteur
// animé. Le chiffre absolu (Value) n'est plus affiché en permanence —
// pour ne pas surcharger le graphique, il n'apparaît qu'au survol
// (tooltip).
function drawValueLabels(g, data, x, y, isMobile) {
  const targetX = d => Math.max(x(d.Value), d._labelEnd) + 8;

  const valueLabels = g.selectAll("text.value")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value")
    .attr("x", targetX)
    .attr("y", d => y(d.Label) + y.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "9.5px" : "10.5px")
    .style("font-weight", "normal")
    .style("fill", "#111")
    .style("opacity", 0)
    .text(formatPercent(0));

  valueLabels.transition()
    .delay((d, i) => i * 80)
    .duration(800)
    .ease(d3.easeCubicOut)
    .style("opacity", 1)
    .textTween(function (d) {
      const iPct = d3.interpolateNumber(0, d.Percent);
      return t => formatPercent(Math.round(iPct(t) * 10) / 10);
    });
}

// --- Axe X ---
// Nombre de graduations calculé selon la largeur réelle disponible
// (pas juste mobile/desktop) : évite le chevauchement des nombres
// suisses ("1'000'000") sur les grandes largeurs comme sur les petites.
function drawXAxis(g, x, innerWidth, innerHeight, isMobile) {
  const tickPxBudget = isMobile ? 55 : 85;
  const tickCount = Math.max(2, Math.min(6, Math.floor(innerWidth / tickPxBudget)));

  // On ne garde que les graduations qui tombent réellement dans la zone
  // du graphique : évite les petits traits sans chiffre qui dépassaient
  // au-delà de la dernière valeur (ex. après "1'000'000").
  const clampedTicks = x.ticks(tickCount).filter(v => x(v) <= innerWidth + 0.5);

  g.append("g")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(
      d3.axisBottom(x)
        .tickValues(clampedTicks)
        .tickFormat(d => formatSwiss(d))
        .tickSizeOuter(0)
    )
    .selectAll("text")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "9px" : "10px")
    .style("fill", "#555");
}

// --- Titre d'axe (langue courante) ---
function drawAxisTitle(svg, margin, innerWidth, height, isMobile) {
  svg.append("text")
    .attr("x", margin.left + innerWidth / 2)
    .attr("y", height - 6)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10.5px" : "12px")
    .style("fill", "#333")
    .text(axisTitleLookup[currentLang]);
}

// --- Survol par ligne : met en évidence label + barre + valeur ---
// (pas de tooltip : tout est déjà lisible en permanence sur le graphique)
function highlight(g, label) {
  g.selectAll(".bar, .value")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.Label === label) ? 1 : 0.3);

  // Label survolé : gras (pas d'agrandissement, pour ne pas risquer de
  // chevaucher les lignes voisines) — déjà en #111 plein dans les deux
  // états, pour rester lisible sur les 4 couleurs de la palette.
  g.selectAll(".label")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.Label === label) ? 1 : 0.3)
    .style("font-weight", d => (label !== null && d.Label === label) ? "bold" : "normal");
}

const TOOLTIP_PAD_X = 8;
const TOOLTIP_PAD_Y = 6;

function createTooltip(svg) {
  const tooltip = svg.append("g")
    .style("opacity", 0)
    .style("pointer-events", "none");

  const tooltipRect = tooltip.append("rect")
    .attr("fill", "white")
    .attr("stroke", "#5A959D")
    .attr("stroke-width", 1.5)
    .attr("rx", 4);

  const tooltipText = tooltip.append("text")
    .style("font-family", "Arial")
    .style("font-size", "12px")
    .style("fill", "#111");

  return { tooltip, tooltipRect, tooltipText };
}

function positionTooltip(tooltipParts, d, mx, my, chartWidth) {
  const { tooltip, tooltipRect, tooltipText } = tooltipParts;
  tooltipText.text(formatSwiss(d.Value));

  const bbox = tooltipText.node().getBBox();
  const boxWidth = bbox.width + TOOLTIP_PAD_X * 2;
  const boxHeight = bbox.height + TOOLTIP_PAD_Y * 2;

  let tx = mx + 14;
  let ty = my - boxHeight - 10;
  if (tx + boxWidth > chartWidth) tx = mx - boxWidth - 14;
  if (ty < 0) ty = my + 10;

  tooltip.attr("transform", `translate(${tx}, ${ty})`);
  tooltipRect.attr("width", boxWidth).attr("height", boxHeight);
  tooltipText.attr("x", TOOLTIP_PAD_X - bbox.x).attr("y", TOOLTIP_PAD_Y - bbox.y);
  tooltip.style("opacity", 1);
}

function attachHoverAreas(g, data, y, margin, innerWidth, tooltipParts, svg) {
  g.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", -margin.left)
    .attr("y", d => y(d.Label) - (y.step() - y.bandwidth()) / 2)
    .attr("width", innerWidth + margin.left + margin.right)
    .attr("height", y.step())
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      highlight(g, d.Label);
      const [mx, my] = d3.pointer(event, svg.node());
      positionTooltip(tooltipParts, d, mx, my, innerWidth + margin.left + margin.right);
    })
    .on("mousemove", (event, d) => {
      const [mx, my] = d3.pointer(event, svg.node());
      positionTooltip(tooltipParts, d, mx, my, innerWidth + margin.left + margin.right);
    })
    .on("mouseout", () => {
      highlight(g, null);
      tooltipParts.tooltip.style("opacity", 0);
    });
}

function drawChart() {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const width = containerWidth;
  const isMobile = width < 600;
  const height = 420;

  const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  d3.csv("data_" + currentLang + ".csv").then(data => {

    data.forEach(d => {
      d.Value = +d.Value;
      d.Percent = +d.Percent;
    });

    data.sort((a, b) => b.Value - a.Value);

    const colorFor = buildColorScale(data);

    const margin = {
      top: 3,   // écart final entre le titre HTML et le graphique
      right: isMobile ? 42 : 55,   // assez de place pour "100.0 %"
      bottom: 44,
      left: isMobile ? 8 : 12   // labels de domaine désormais dans la barre, plus de colonne externe
    };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.Value) * 1.08])
      .range([0, innerWidth]);

    const y = d3.scaleBand()
      .domain(data.map(d => d.Label))
      .range([0, innerHeight])
      .padding(0.3);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    drawBars(g, data, x, y, colorFor);
    drawRowLabels(g, data, x, y, isMobile);
    drawValueLabels(g, data, x, y, isMobile);
    drawXAxis(g, x, innerWidth, innerHeight, isMobile);
    drawAxisTitle(svg, margin, innerWidth, height, isMobile);

    const tooltipParts = createTooltip(svg);
    attachHoverAreas(g, data, y, margin, innerWidth, tooltipParts, svg);
  });
}
