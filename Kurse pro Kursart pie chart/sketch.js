// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "2025: Kurse pro Kursart",
  fr: "2025 : Cours par genre de cours",
  it: "2025: Corsi per genere del corso"
};

// Même rouge que "Kurse pro Kursart" (barres) et "Anzahl Kurse" : pas
// de couleur fixe par categorie ici (10 types de cours, pas de charte
// officielle connue pour chacun), mais un degrade d'intensite selon la
// valeur, coherent avec la version en barres du meme jeu de donnees.
const BASE_RED = "#FF0000";   // accent6 — intensite max
const LIGHT_RED = "#ffcccc";  // Rouge Bund 20 % (charte) — intensite min

const MOBILE_BREAKPOINT = 600;

// En dessous de ce pourcentage, l'etiquette (valeur + %) sort de la part
// (trop etroite pour l'accueillir) et se retrouve reliee par une ligne de
// rappel, empilee avec les autres petites parts plutot que superposee.
const INNER_LABEL_MIN_PERCENT = 5;

// Langue courante, determinee au demarrage depuis ?lang= (par defaut "de").
let currentLang = "de";

// ============================================================
// URL params
// ============================================================

function getURLParams() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(params.entries());
}

// ============================================================
// Init & resize
// ============================================================

function init() {
  const params = getURLParams();
  currentLang = params.lang || currentLang;

  d3.select("#titleContainer").text(titleLookup[currentLang]);

  drawChart();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", drawChart);

// --- Formatage suisse : 259 / 1'234 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// --- Typographie numérique suisse : point décimal, pas de virgule (50.4 %) ---
function formatPercent(p) {
  return p.toFixed(1) + " %";
}

// Échelle de couleur en racine carrée (comme la version en barres) :
// l'écart entre la plus petite et la plus grande valeur reste bien visible
// sur tout le dégradé plutôt que d'être écrasé par la seule plus grande
// valeur. Reçoit directement une ligne de donnée ({Value, ...}).
function buildColorScale(data) {
  const minVal = d3.min(data, d => d.Value);
  const maxVal = d3.max(data, d => d.Value);
  const scale = d3.scaleSqrt().domain([minVal, maxVal]).range([0, 1]);
  return d => d3.interpolate(LIGHT_RED, BASE_RED)(scale(d.Value));
}

// ============================================================
// Légende
// ============================================================

function drawLegend(svg, data, colorFor, legendWidth, panelHeight, isMobile) {
  const rowHeight = isMobile ? 28 : 31;
  const startY = (panelHeight - data.length * rowHeight) / 2;

  const legend = svg.append("g").attr("transform", `translate(14, ${startY})`);

  const rows = legend.selectAll("g.legend-row")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "legend-row")
    .attr("transform", (d, i) => `translate(0, ${i * rowHeight})`);

  rows.append("rect")
    .attr("width", 11)
    .attr("height", 11)
    .attr("y", 2)
    .attr("fill", colorFor);

  rows.append("text")
    .attr("x", 18)
    .attr("y", 11)
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10px" : "11.5px")
    .style("fill", "#111")
    .text(d => d.Label);
}

// ============================================================
// Camembert
// ============================================================

function midAngle(d) {
  return d.startAngle + (d.endAngle - d.startAngle) / 2;
}

// Texte des valeurs : uniquement en noir, sans contour ni halo.
function styleLabelText(sel) {
  return sel
    .style("font-family", "Arial")
    .style("font-weight", "bold")
    .style("fill", "#000");
}

// Un groupe par part : regroupe le secteur, son etiquette et (le cas
// echeant) sa ligne de rappel. Le survol de n'importe lequel de ces
// elements met en evidence l'ensemble ("encadre toute la case
// correspondante"), ce qui aide aussi sur les toutes petites parts ou le
// secteur lui-meme est presque impossible a survoler directement.
function drawSlices(g, arcs, colorFor, arc) {
  const item = g.selectAll("g.pie-item")
    .data(arcs, d => d.data.Label)
    .enter()
    .append("g")
    .attr("class", "pie-item")
    .style("cursor", "pointer");

  item.append("path")
    .attr("class", "slice")
    .attr("fill", d => colorFor(d.data))
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .style("opacity", 0)
    .transition()
    .delay((d, i) => i * 55)
    .duration(500)
    .ease(d3.easeCubicOut)
    .style("opacity", 1)
    .attrTween("d", function (d) {
      const iAngle = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d);
      return t => arc(iAngle(t));
    });

  return item;
}

// --- Grandes parts : valeur + % empiles au centre de la part ---
function drawInnerLabels(item, innerLabelArc, isMobile) {
  const bigItems = item.filter(d => d.data.Percent >= INNER_LABEL_MIN_PERCENT);

  const innerLabels = styleLabelText(
    bigItems.append("text")
      .attr("class", "inner-label")
      .attr("transform", d => `translate(${innerLabelArc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .style("font-size", isMobile ? "11.5px" : "13.5px")
      .style("opacity", 0)
  );

  innerLabels.append("tspan")
    .attr("x", 0)
    .attr("dy", "-0.15em")
    .text(d => formatSwiss(d.data.Value));

  innerLabels.append("tspan")
    .attr("x", 0)
    .attr("dy", "1.2em")
    .style("font-weight", "normal")
    .style("font-size", isMobile ? "9.5px" : "11px")
    .text(d => formatPercent(d.data.Percent));

  innerLabels.transition()
    .delay((d, i) => i * 55 + 350)
    .duration(300)
    .style("opacity", 1);
}

// Decluttage vertical : quand plusieurs petites parts sont angulairement
// proches, leurs etiquettes exterieures se retrouvent quasi a la meme
// hauteur et se chevauchent. On calcule d'abord la position "naturelle"
// (centroid) de chaque etiquette, puis on ecarte par cote (gauche/droite)
// les etiquettes trop proches, par relaxation iterative, en conservant
// leur ordre vertical.
function computeDeclutteredLabelPositions(smallArcs, outerAnchorArc) {
  const LABEL_MIN_GAP = 15;
  const labelLayout = smallArcs.map(d => {
    const side = midAngle(d) < Math.PI ? 1 : -1;
    return { d, side, y: outerAnchorArc.centroid(d)[1] };
  });

  [1, -1].forEach(side => {
    const group = labelLayout.filter(p => p.side === side).sort((a, b) => a.y - b.y);
    for (let iter = 0; iter < 30; iter++) {
      let moved = false;
      for (let i = 0; i < group.length - 1; i++) {
        const gap = group[i + 1].y - group[i].y;
        if (gap < LABEL_MIN_GAP) {
          const shift = (LABEL_MIN_GAP - gap) / 2;
          group[i].y -= shift;
          group[i + 1].y += shift;
          moved = true;
        }
      }
      if (!moved) break;
    }
  });

  return new Map(labelLayout.map(p => [p.d, p.y]));
}

// --- Petites parts : valeur + % sur une ligne, reliees par un trait ---
function drawLeaderLines(smallItems, arc, outerAnchorArc, labelY, outerRadius) {
  const leaderLines = smallItems.append("polyline")
    .attr("class", "leader")
    .attr("fill", "none")
    .attr("stroke", "#999")
    .attr("stroke-width", 1)
    .style("opacity", 0)
    .attr("points", d => {
      const edge = arc.centroid(d);
      const y = labelY.get(d);
      const elbow = [outerAnchorArc.centroid(d)[0], y];
      const end = [outerRadius * 1.22 * (midAngle(d) < Math.PI ? 1 : -1), y];
      return [edge, elbow, end];
    });

  leaderLines.transition()
    .delay((d, i) => i * 55 + 350)
    .duration(300)
    .style("opacity", 1);
}

// Pastille de couleur juste a cote de chaque etiquette de petite part :
// pour une part tres fine, le secteur lui-meme peut etre trop etroit
// pour laisser voir sa propre couleur de remplissage. La pastille reste
// toujours visible et rappelle sans ambiguite quelle couleur (donc quel
// type de cours, via la legende) correspond a cette valeur.
function drawOuterSwatches(smallItems, colorFor, labelY, outerRadius, swatchSize) {
  const swatches = smallItems.append("rect")
    .attr("class", "outer-swatch")
    .attr("width", swatchSize)
    .attr("height", swatchSize)
    .attr("fill", d => colorFor(d.data))
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .style("opacity", 0)
    .attr("x", d => {
      const side = midAngle(d) < Math.PI ? 1 : -1;
      const x = outerRadius * 1.26 * side;
      return side > 0 ? x : x - swatchSize;
    })
    .attr("y", d => labelY.get(d) - swatchSize * 0.75);

  swatches.transition()
    .delay((d, i) => i * 55 + 350)
    .duration(300)
    .style("opacity", 1);
}

function drawOuterLabels(smallItems, labelY, outerRadius, isMobile, swatchSize, swatchGap) {
  const outerLabels = styleLabelText(
    smallItems.append("text")
      .attr("class", "outer-label")
      .attr("text-anchor", d => (midAngle(d) < Math.PI ? "start" : "end"))
      .attr("transform", d => {
        const side = midAngle(d) < Math.PI ? 1 : -1;
        const x = outerRadius * 1.26 * side + side * (swatchSize + swatchGap);
        return `translate(${x}, ${labelY.get(d)})`;
      })
      .style("font-size", isMobile ? "9.5px" : "11px")
      .style("opacity", 0)
  );

  outerLabels.text(d => `${formatSwiss(d.data.Value)} ${formatPercent(d.data.Percent)}`);

  outerLabels.transition()
    .delay((d, i) => i * 55 + 350)
    .duration(300)
    .style("opacity", 1);
}

// Nom du type de cours affiche au survol, centre au-dessus du camembert
// pour les petites parts. Pour les grandes parts, affiche a cote de la
// part elle-meme (meme point de depart que les lignes de rappel des
// petites parts), avec le texte qui s'eloigne du camembert plutot que
// de le recouvrir.
function attachPieHover(item, svg, cx, cy, outerAnchorArc, isMobile) {
  const nameLabel = svg.append("text")
    .attr("class", "hover-name")
    .style("font-family", "Arial")
    .style("font-weight", "bold")
    .style("font-size", isMobile ? "11.5px" : "13px")
    .style("fill", "#000")
    .style("opacity", 0);

  // --- Survol : entoure toute la part correspondante (secteur + ligne de
  // rappel), quel que soit l'element survole. raise() ramene le groupe au
  // premier plan : sans ca, le cote partage avec la part suivante (dessinee
  // apres, donc par-dessus) se faisait recouvrir par son propre contour
  // blanc et un seul des deux cotes droits du secteur restait visible.
  item
    .on("mouseover", function (event, d) {
      const node = d3.select(this).raise();
      node.select("path.slice").attr("stroke", "#000").attr("stroke-width", 1.5);
      node.select("polyline.leader").attr("stroke", "#333").attr("stroke-width", 1.5);

      const isBig = d.data.Percent >= INNER_LABEL_MIN_PERCENT;
      if (isBig) {
        const [ox, oy] = outerAnchorArc.centroid(d);
        const side = midAngle(d) < Math.PI ? 1 : -1;
        nameLabel
          .attr("text-anchor", side > 0 ? "start" : "end")
          .attr("x", cx + ox)
          .attr("y", Math.max(cy + oy, 20));
      } else {
        nameLabel
          .attr("text-anchor", "middle")
          .attr("x", cx)
          .attr("y", 22);
      }
      nameLabel.text(d.data.Label).style("opacity", 1);
    })
    .on("mouseout", function () {
      const node = d3.select(this);
      node.select("path.slice").attr("stroke", "#fff").attr("stroke-width", 1.5);
      node.select("polyline.leader").attr("stroke", "#999").attr("stroke-width", 1);
      nameLabel.style("opacity", 0);
    });
}

function drawPie(svg, data, colorFor, cx, cy, outerRadius, isMobile) {
  const g = svg.append("g").attr("transform", `translate(${cx}, ${cy})`);

  const pie = d3.pie().value(d => d.Value).sort(null);
  const arcs = pie(data);

  const arc = d3.arc().innerRadius(0).outerRadius(outerRadius);
  const innerLabelArc = d3.arc().innerRadius(outerRadius * 0.66).outerRadius(outerRadius * 0.66);
  const outerAnchorArc = d3.arc().innerRadius(outerRadius * 1.08).outerRadius(outerRadius * 1.08);

  const item = drawSlices(g, arcs, colorFor, arc);

  drawInnerLabels(item, innerLabelArc, isMobile);

  const smallArcs = arcs.filter(d => d.data.Percent < INNER_LABEL_MIN_PERCENT);
  const smallItems = item.filter(d => d.data.Percent < INNER_LABEL_MIN_PERCENT);

  const labelY = computeDeclutteredLabelPositions(smallArcs, outerAnchorArc);

  drawLeaderLines(smallItems, arc, outerAnchorArc, labelY, outerRadius);

  const SWATCH_SIZE = 9;
  const SWATCH_GAP = 6;

  drawOuterSwatches(smallItems, colorFor, labelY, outerRadius, SWATCH_SIZE);
  drawOuterLabels(smallItems, labelY, outerRadius, isMobile, SWATCH_SIZE, SWATCH_GAP);

  attachPieHover(item, svg, cx, cy, outerAnchorArc, isMobile);
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

  d3.csv("data_" + currentLang + ".csv").then(raw => {

    const data = raw.map(d => ({ Label: d.Label, Value: +d.Value }));
    const total = d3.sum(data, d => d.Value);
    data.forEach(d => { d.Percent = (d.Value / total) * 100; });

    data.sort((a, b) => b.Value - a.Value);

    const colorFor = buildColorScale(data);

    // Largeur plafonnee sur desktop : en pourcentage seul, un conteneur tres
    // large laissait un grand vide entre la legende et le camembert.
    const legendWidth = isMobile
      ? Math.round(containerWidth * 0.44)
      : Math.min(260, Math.round(containerWidth * 0.34));
    const pieAreaWidth = containerWidth - legendWidth;

    // Marge laissee pour les etiquettes + traits de rappel des petites
    // parts, qui debordent legerement au-dela du cercle lui-meme.
    const outerRadius = Math.max(
      40,
      Math.min(pieAreaWidth, panelHeight) / 2 - (isMobile ? 52 : 64)
    );

    drawLegend(svg, data, colorFor, legendWidth, panelHeight, isMobile);
    drawPie(svg, data, colorFor, legendWidth + pieAreaWidth / 2, panelHeight / 2, outerRadius, isMobile);
  });
}
