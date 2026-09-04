// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "Einsatzbetriebe und Einsatzplätze pro Tätigkeitsbereich",
  fr: "Établissements et places d'affectation par domaine d'activité",
  it: "Istituti e posti d'impiego per ambito di attività"
};

// Une seule langue affichee a la fois (selon ?lang=), jamais les trois
// versions ensemble - ni dans la legende, ni ailleurs.
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

// Graphique a 2 variables : petrol (Einsatzbetriebe) + lila
// (Einsatzplätze), couleurs unies (pas de degrade) - meme paire que le
// graphique a barres groupees, pour rester coherent visuellement entre
// les differentes versions du meme jeu de donnees.
const BASE_BETRIEBE = "#5A959D"; // accent1 - petrol
const BASE_PLAETZE = "#A3A8CA";  // accent3 - lila

const MOBILE_BREAKPOINT = 600;

// Largeur maximale de la colonne centrale (noms de domaine) : au-dela,
// on passe a deux lignes plutot que de rogner l'espace des deux
// panneaux de barres (utile en francais/italien, ou certains noms de
// domaine sont tres longs).
const CENTER_LABEL_MAX_DESKTOP = 230;
const CENTER_LABEL_MAX_MOBILE = 150;

// Marge minimum au bord exterieur de chaque panneau, pour l'etiquette
// de valeur affichee juste apres le bout de la barre.
const OUTER_VALUE_MARGIN_DESKTOP = 58;
const OUTER_VALUE_MARGIN_MOBILE = 46;

// Largeur plancher : une valeur non nulle reste toujours visible, meme
// minuscule a cette echelle (ex. Katastrophen : 11 etablissements).
const MIN_BAR_WIDTH = 2;

const VALUE_GAP = 6;

// Echelle independante par panneau (chaque cote va de 0 a son propre
// maximum*1.12) plutot qu'une echelle partagee : teste, puis ecarte
// (voir commit precedent) car elle rend les deux panneaux non
// comparables entre eux (une barre a 2029 et une barre a 8344 peuvent
// alors avoir une longueur similaire). On revient a l'echelle partagee,
// qui garde les longueurs de barre directement comparables entre
// Einsatzbetriebe et Einsatzplaetze malgre le miroir.
const INDEPENDENT_SCALES = false;

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

// --- Formatage suisse : 8'344 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// ============================================================
// Mesure de texte (colonne centrale + legende)
// ============================================================

function measureTextWidth(svg, text, fontSize) {
  const probe = svg.append("text")
    .style("font-family", "Arial")
    .style("font-size", fontSize)
    .style("opacity", 0)
    .text(text);
  const w = probe.node().getComputedTextLength();
  probe.remove();
  return w;
}

// Decoupe un nom de domaine en 1 ou 2 lignes pour tenir dans
// maxWidth : ajoute les mots un a un tant que la ligne courante tient,
// sinon passe a la ligne suivante. Au-dela de 2 lignes, le reste est
// simplement regroupe sur la deuxieme (la hauteur de ligne des lignes
// est fixe par rowHeight, pas la peine d'aller plus loin ici).
function wrapLabelLines(svg, label, maxWidth, fontSize) {
  const words = label.split(" ");
  const probe = svg.append("text")
    .style("font-family", "Arial")
    .style("font-size", fontSize)
    .style("opacity", 0);

  const lines = [];
  let current = "";

  words.forEach(word => {
    const candidate = current ? current + " " + word : word;
    probe.text(candidate);
    const w = probe.node().getComputedTextLength();
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);

  probe.remove();

  if (lines.length <= 2) return lines;
  return [lines[0], lines.slice(1).join(" ")];
}

// ============================================================
// Légende — un item centré au-dessus de chaque panneau (comme les deux
// colonnes de barres qu'il annonce), plutôt qu'empilée à gauche.
// ============================================================

function drawLegendItem(svg, cx, y, color, label, fontSize) {
  const textWidth = measureTextWidth(svg, label, fontSize);
  const swatchSize = 11;
  const gap = 6;
  const totalWidth = swatchSize + gap + textWidth;
  const startX = cx - totalWidth / 2;

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
    .style("font-size", fontSize)
    .style("fill", "#111")
    .text(label);
}

// ============================================================
// Barres (miroir) + étiquettes de valeur
// ============================================================

// lengthScale convertit une valeur en LONGUEUR de barre (échelle non
// inversée, [0, panelWidth]) — le même objet est passé pour les deux
// côtés, pour que les longueurs restent directement comparables. Le
// panneau gauche part simplement de panelWidth (bord touchant la
// colonne des noms) et soustrait cette longueur.
function drawSideBars(g, data, y0, lengthScale, panelWidth, color, key, side, isMobile) {
  const barWidth = val => val > 0 ? Math.max(lengthScale(val), MIN_BAR_WIDTH) : 0;
  const barX = val => side === "left" ? panelWidth - barWidth(val) : 0;

  // Départ de l'animation d'apparition : un rectangle/texte de largeur
  // nulle posé exactement au bord touchant la colonne des noms (à
  // droite du panneau gauche, à gauche du panneau droit), pour que les
  // deux côtés grandissent bien depuis le centre vers l'extérieur.
  const startX = side === "left" ? panelWidth : 0;

  g.selectAll(`rect.bar-${key}`)
    .data(data)
    .enter()
    .append("rect")
    .attr("class", `bar bar-${key}`)
    .attr("y", d => y0(d.label))
    .attr("height", y0.bandwidth())
    .attr("width", 0)
    .attr("x", startX)
    .attr("fill", color)
    .transition()
    .delay((d, i) => i * 90)
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
    .attr("y", d => y0(d.label) + y0.bandwidth() / 2)
    .attr("text-anchor", side === "left" ? "end" : "start")
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "9.5px" : "10.5px")
    .style("font-weight", "normal")
    .style("fill", "#111")
    .text("0")
    .transition()
    .delay((d, i) => i * 90)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("x", d => side === "left"
      ? barX(d[key]) - VALUE_GAP
      : barX(d[key]) + barWidth(d[key]) + VALUE_GAP)
    .textTween(function (d) {
      const iVal = d3.interpolateNumber(0, d[key]);
      return t => formatSwiss(iVal(t));
    });
}

// ============================================================
// Axe (miroir) — même échelle des deux côtés, ticks qui grandissent en
// s'éloignant du centre.
// ============================================================

function drawSideAxis(g, scale, panelWidth, innerHeight, isMobile) {
  const tickCount = isMobile ? 3 : 4;
  const clampedTicks = scale.ticks(tickCount).filter(v => {
    const x = scale(v);
    return x >= -0.5 && x <= panelWidth + 0.5;
  });

  g.append("g")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(
      d3.axisBottom(scale)
        .tickValues(clampedTicks)
        .tickFormat(d => formatSwiss(d))
        .tickSizeOuter(0)
    )
    .selectAll("text")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "8.5px" : "9.5px")
    .style("fill", "#555");
}

// ============================================================
// Colonne centrale (noms de domaine)
// ============================================================

function drawCenterLabels(g, data, y0, centerLabelWidth, isMobile, svg) {
  const fontSize = isMobile ? "9.5px" : "10.5px";
  const maxTextWidth = centerLabelWidth - 16;
  const lineHeight = 1.15; // em

  const labelLines = new Map(data.map(d => [d, wrapLabelLines(svg, d.label, maxTextWidth, fontSize)]));

  const texts = g.selectAll("text.domain-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "domain-label")
    .attr("x", centerLabelWidth / 2)
    .attr("y", d => y0(d.label) + y0.bandwidth() / 2)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-weight", "normal")
    .style("fill", "#333")
    .style("font-size", fontSize);

  texts.each(function (d) {
    const lines = labelLines.get(d);
    const startDy = -((lines.length - 1) / 2) * lineHeight;
    d3.select(this).selectAll("tspan")
      .data(lines)
      .enter()
      .append("tspan")
      .attr("x", centerLabelWidth / 2)
      .attr("dy", (line, i) => (i === 0 ? startDy : lineHeight) + "em")
      .text(line => line);
  });

  return texts;
}

// ============================================================
// Survol : met en évidence une ligne (les deux barres + le nom),
// quel que soit le groupe (gauche / centre / droite) dans lequel
// l'élément survolé se trouve réellement.
// ============================================================

function highlight(svg, label) {
  svg.selectAll(".bar, .value")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3);

  svg.selectAll(".domain-label")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3)
    .style("font-weight", d => (label !== null && d.label === label) ? "bold" : "normal")
    .style("fill", d => (label !== null && d.label === label) ? "#000" : "#333");
}

function attachHover(svg, data, y0, hitOffsetX, hitWidth, hitOffsetY) {
  svg.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", hitOffsetX)
    .attr("y", d => hitOffsetY + y0(d.label) - (y0.step() - y0.bandwidth()) / 2)
    .attr("width", hitWidth)
    .attr("height", y0.step())
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => highlight(svg, d.label))
    .on("mouseout", () => highlight(svg, null));
}

// ============================================================
// Orchestration
// ============================================================

function drawChart() {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const isMobile = containerWidth < MOBILE_BREAKPOINT;

  d3.csv("data_" + currentLang + ".csv").then(raw => {

    const data = raw.map(d => ({
      label: d["Tätigkeit"],
      betriebe: +d["Einsatzbetriebe"],
      plaetze: +d["Einsatzplätze"]
    }));

    // Ordre décroissant par nombre de places d'affectation (Einsatzplätze)
    // — même tri que le graphique à barres groupées du même jeu de données.
    data.sort((a, b) => b.plaetze - a.plaetze);

    const rowHeight = isMobile ? 42 : 48;
    const legendHeight = isMobile ? 30 : 32;
    const margin = {
      top: legendHeight + 12,
      bottom: 24
    };

    const innerHeight = data.length * rowHeight;
    const height = margin.top + innerHeight + margin.bottom;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", height);

    // --- Colonne centrale : dimensionnée sur le nom de domaine le plus
    // long (mesuré), plafonnée pour laisser assez de place aux deux
    // panneaux de barres — au-delà, les noms passent sur deux lignes.
    const centerFontSize = isMobile ? "9.5px" : "10.5px";
    const centerLabelCap = isMobile ? CENTER_LABEL_MAX_MOBILE : CENTER_LABEL_MAX_DESKTOP;
    const rawMaxLabelWidth = d3.max(data, d => measureTextWidth(svg, d.label, centerFontSize));
    const centerLabelWidth = Math.min(centerLabelCap, rawMaxLabelWidth + 16);

    const outerValueMargin = isMobile ? OUTER_VALUE_MARGIN_MOBILE : OUTER_VALUE_MARGIN_DESKTOP;
    const panelWidth = Math.max(70, (containerWidth - centerLabelWidth - outerValueMargin * 2) / 2);

    const maxBetriebe = d3.max(data, d => d.betriebe);
    const maxPlaetze = d3.max(data, d => d.plaetze);
    const maxVal = Math.max(maxBetriebe, maxPlaetze) * 1.12;

    // rightScale/rightLengthScale sert toujours a convertir une valeur
    // Einsatzplaetze en longueur de barre (panneau droit) et, en mode
    // partage, aussi les Einsatzbetriebe (panneau gauche).
    const rightScale = d3.scaleLinear().domain([0, INDEPENDENT_SCALES ? maxPlaetze * 1.12 : maxVal]).range([0, panelWidth]);

    // Echelle "longueur" du panneau gauche : partagee avec la droite
    // (comparabilite directe) ou independante, plafonnee sur son propre
    // maximum (lisibilite des ecarts entre domaines cote Einsatzbetriebe).
    const leftLengthScale = INDEPENDENT_SCALES
      ? d3.scaleLinear().domain([0, maxBetriebe * 1.12]).range([0, panelWidth])
      : rightScale;

    // leftScale : version inversee de leftLengthScale, utilisee uniquement
    // pour positionner les graduations de l'axe gauche (cf. drawSideAxis).
    const leftScale = leftLengthScale.copy().range([panelWidth, 0]);

    const y0 = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, innerHeight])
      .paddingInner(0.28)
      .paddingOuter(0.14);

    const leftX = outerValueMargin;
    const centerX = outerValueMargin + panelWidth;
    const rightX = outerValueMargin + panelWidth + centerLabelWidth;

    drawLegendItem(svg, leftX + panelWidth / 2, 6, BASE_BETRIEBE, legendLookup[currentLang][0].text, isMobile ? "11px" : "12.5px");
    drawLegendItem(svg, rightX + panelWidth / 2, 6, BASE_PLAETZE, legendLookup[currentLang][1].text, isMobile ? "11px" : "12.5px");

    const gLeft = svg.append("g").attr("transform", `translate(${leftX}, ${margin.top})`);
    const gCenter = svg.append("g").attr("transform", `translate(${centerX}, ${margin.top})`);
    const gRight = svg.append("g").attr("transform", `translate(${rightX}, ${margin.top})`);

    // drawSideBars reçoit un scale "longueur" (non inversé) de chaque
    // côté — leftLengthScale et rightScale, identiques en mode partagé,
    // distincts en mode INDEPENDENT_SCALES. leftScale (inversé) ne sert
    // qu'à positionner les ticks de l'axe gauche (cf. drawSideAxis).
    drawSideBars(gLeft, data, y0, leftLengthScale, panelWidth, BASE_BETRIEBE, "betriebe", "left", isMobile);
    drawSideBars(gRight, data, y0, rightScale, panelWidth, BASE_PLAETZE, "plaetze", "right", isMobile);
    drawSideAxis(gLeft, leftScale, panelWidth, innerHeight, isMobile);
    drawSideAxis(gRight, rightScale, panelWidth, innerHeight, isMobile);
    drawCenterLabels(gCenter, data, y0, centerLabelWidth, isMobile, svg);

    attachHover(svg, data, y0, leftX, panelWidth * 2 + centerLabelWidth, margin.top);
  });
}
