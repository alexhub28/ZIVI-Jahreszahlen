// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "2025: Einsatzbetriebe und Einsatzplätze pro Tätigkeitsbereich",
  fr: "2025 : Établissements et places d'affectation par domaine d'activité",
  it: "2025: Istituti e posti d'impiego per ambito di attività"
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

// Petrol (Einsatzbetriebe) + lila (Einsatzplätze), couleurs unies -
// meme paire que le graphique a barres groupees.
const BASE_BETRIEBE = "#5A959D"; // accent1 - petrol
const BASE_PLAETZE = "#A3A8CA";  // accent3 - lila

const MOBILE_BREAKPOINT = 600;

// Largeur max de la colonne centrale (noms de domaine) : au-dela, les
// noms passent sur deux lignes plutot que de rogner les panneaux de barres.
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

// Echelle independante par panneau : testee puis ecartee car elle rend
// les deux panneaux non comparables entre eux. Echelle partagee (false)
// gardee pour que les longueurs de barre restent comparables.
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

// Decoupe un nom de domaine en 1 ou 2 lignes pour tenir dans maxWidth ;
// au-dela de 2 lignes, le reste est regroupe sur la deuxieme.
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
// Légende — un item centré au-dessus de chaque panneau
// ============================================================

// cx = null : item aligné à gauche (x = 0), utilisé en mode stacked (écran étroit).
function drawLegendItem(svg, cx, y, color, label, fontSize) {
  const textWidth = measureTextWidth(svg, label, fontSize);
  const swatchSize = 11;
  const gap = 6;
  const totalWidth = swatchSize + gap + textWidth;
  const startX = cx === null ? 0 : cx - totalWidth / 2;

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

// lengthScale convertit une valeur en longueur de barre (échelle non
// inversée) ; le panneau gauche part de panelWidth et soustrait cette longueur.
function drawSideBars(g, data, y0, lengthScale, panelWidth, color, key, side, isMobile) {
  const barWidth = val => val > 0 ? Math.max(lengthScale(val), MIN_BAR_WIDTH) : 0;
  const barX = val => side === "left" ? panelWidth - barWidth(val) : 0;

  // Départ de l'animation : largeur nulle au bord touchant la colonne des
  // noms, pour que les deux côtés grandissent depuis le centre.
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
    .style("font-size", isMobile ? VALUE_FONT_SIZE.mobile : VALUE_FONT_SIZE.desktop)
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
// Axe (miroir) — même échelle des deux côtés
// ============================================================

function drawSideAxis(g, scale, panelWidth, innerHeight, isMobile) {
  // Panneau étroit : 2 graduations seulement, sinon les nombres se chevauchent.
  const tickCount = panelWidth < 110 ? 2 : (isMobile ? 3 : 4);
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
    .style("font-size", isMobile ? "9px" : "9.5px")
    .style("fill", "#555");
}

// ============================================================
// Colonne centrale (noms de domaine)
// ============================================================

// Tailles reutilisees par highlight() pour l'agrandissement au survol.
const CENTER_LABEL_FONT_SIZE_HOVER = { mobile: "11.5px", desktop: "12.5px" };

// Memes tailles que le label central, pour que les valeurs grandissent
// avec lui (evite deux polices differentes sur la meme ligne au survol).
const VALUE_FONT_SIZE = { mobile: "9.5px", desktop: "10.5px" };
const VALUE_FONT_SIZE_HOVER = { mobile: "11.5px", desktop: "12.5px" };

// stacked : écran étroit, chaque nom sur une ligne, centré au-dessus de sa paire de barres.
function drawCenterLabels(g, data, y0, centerLabelWidth, isMobile, svg, stacked) {
  const fontSize = isMobile ? "9.5px" : "10.5px";
  const maxTextWidth = centerLabelWidth - 16;
  const lineHeight = 1.15; // em

  const labelLines = new Map(data.map(d => [d, stacked ? [d.label] : wrapLabelLines(svg, d.label, maxTextWidth, fontSize)]));

  const texts = g.selectAll("text.domain-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "domain-label")
    .attr("x", centerLabelWidth / 2)
    .attr("y", d => stacked ? y0(d.label) - 4 : y0(d.label) + y0.bandwidth() / 2)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", stacked ? "auto" : "middle")
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
// Survol : met en évidence une ligne (barres + nom) quel que soit le
// groupe (gauche / centre / droite) survolé.
// ============================================================

function highlight(svg, label, isMobile, centerLabelWidth, containerWidth) {
  svg.selectAll(".bar")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3);

  const baseSize = isMobile ? "9.5px" : "10.5px";
  const hoverSize = isMobile ? CENTER_LABEL_FONT_SIZE_HOVER.mobile : CENTER_LABEL_FONT_SIZE_HOVER.desktop;
  let targetSize = hoverSize;

  const valueBaseSize = isMobile ? VALUE_FONT_SIZE.mobile : VALUE_FONT_SIZE.desktop;
  const valueHoverSize = isMobile ? VALUE_FONT_SIZE_HOVER.mobile : VALUE_FONT_SIZE_HOVER.desktop;
  const valueTargetByNode = new Map();

  // Label survolé : au premier plan (raise) pour ne pas être recouvert
  // par les lignes voisines une fois agrandi. Le label grandit de façon
  // symétrique (text-anchor middle) : on réduit l'agrandissement si
  // besoin pour ne jamais déborder sur les panneaux de barres voisins.
  if (label !== null) {
    const sel = svg.selectAll(".domain-label").filter(d => d.label === label);
    sel.raise();

    // Le poids "bold" (applique juste apres) elargit aussi le texte :
    // il doit etre pris en compte ici, sinon la mesure sous-estime la
    // largeur reelle une fois le survol applique.
    sel.style("font-weight", "bold").style("font-size", hoverSize);
    const lineWidths = sel.selectAll("tspan").nodes().map(n => n.getComputedTextLength());
    const measuredWidth = Math.max(...lineWidths);
    const available = centerLabelWidth - 8; // 4px de marge de sécurité de chaque côté
    if (measuredWidth > available) {
      const scaledPx = Math.max(parseFloat(baseSize), parseFloat(hoverSize) * (available / measuredWidth));
      targetSize = scaledPx + "px";
    }
    sel.style("font-weight", "normal").style("font-size", baseSize);

    // Les valeurs des deux panneaux (Einsatzbetriebe + Einsatzplätze)
    // grandissent avec le label central, pour ne pas garder deux tailles
    // de police différentes sur la même ligne au survol. Chacune grandit
    // vers l'extérieur (bord du SVG) à partir de sa propre position
    // réelle (le plafond dépend de la longueur de SA barre, pas d'une
    // marge fixe qui pénaliserait à tort une valeur courte dont la barre
    // est loin du bord).
    const valSel = svg.selectAll(".value").filter(d => d.label === label);
    valSel.raise();
    valSel.style("font-size", valueHoverSize);
    valSel.each(function () {
      // Position absolue reelle (translation du panneau parent + x local),
      // comparee au bord reel du SVG plutot qu'a la marge nominale
      // (outerValueMargin) : sur un ecran etroit avec un nom de domaine
      // long, panelWidth est plafonne a son minimum (70px, cf. Math.max
      // dans drawChart) et la mise en page peut alors deborder legerement
      // du budget nominal - la marge reellement libre est plus etroite
      // que prevu par le calcul theorique.
      const parentX = this.parentNode.transform.baseVal.consolidate().matrix.e;
      const currentX = parseFloat(this.getAttribute("x"));
      const absoluteX = parentX + currentX;
      const measuredWidth = this.getComputedTextLength();
      const isLeftSide = this.getAttribute("text-anchor") === "end";
      const available = (isLeftSide ? absoluteX : (containerWidth - absoluteX)) - 4;
      let t = valueHoverSize;
      if (measuredWidth > available) {
        const scaledPx = Math.max(parseFloat(valueBaseSize), parseFloat(valueHoverSize) * (available / measuredWidth));
        t = scaledPx + "px";
      }
      valueTargetByNode.set(this, t);
    });
    valSel.style("font-size", valueBaseSize);
  }

  svg.selectAll(".domain-label")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3)
    .style("font-weight", d => (label !== null && d.label === label) ? "bold" : "normal")
    .style("font-size", d => (label !== null && d.label === label) ? targetSize : baseSize)
    .style("fill", d => (label !== null && d.label === label) ? "#000" : "#333");

  svg.selectAll(".value")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3)
    .style("font-size", function (d) {
      if (label !== null && d.label === label) {
        return valueTargetByNode.get(this) || valueHoverSize;
      }
      return valueBaseSize;
    });
}

// labelSpace = largeur dans laquelle le nom survolé peut grandir (colonne
// centrale, ou toute la largeur en mode stacked).
function attachHover(svg, data, y0, hitOffsetX, hitWidth, hitOffsetY, isMobile, labelSpace, containerWidth, stacked) {
  svg.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", hitOffsetX)
    .attr("y", d => hitOffsetY + y0(d.label) - (y0.step() - y0.bandwidth()) / (stacked ? 1 : 2)) // stacked : couvre aussi le nom au-dessus
    .attr("width", hitWidth)
    .attr("height", y0.step())
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => highlight(svg, d.label, isMobile, labelSpace, containerWidth))
    .on("mouseout", () => highlight(svg, null, isMobile, labelSpace, containerWidth));
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

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", containerWidth);

    // Colonne centrale dimensionnée sur le nom le plus long (mesuré),
    // plafonnée pour laisser la place aux deux panneaux de barres.
    const centerFontSize = isMobile ? "9.5px" : "10.5px";
    const centerLabelCap = isMobile ? CENTER_LABEL_MAX_MOBILE : CENTER_LABEL_MAX_DESKTOP;
    const rawMaxLabelWidth = d3.max(data, d => measureTextWidth(svg, d.label, centerFontSize));
    const outerValueMargin = isMobile ? OUTER_VALUE_MARGIN_MOBILE : OUTER_VALUE_MARGIN_DESKTOP;

    // Écran étroit : si les panneaux de barres tomberaient sous 90px, la
    // colonne centrale disparaît et chaque nom passe au-dessus de sa paire
    // de barres (les deux panneaux récupèrent la largeur).
    const normalCenterWidth = Math.min(centerLabelCap, rawMaxLabelWidth + 16);
    const stacked = (containerWidth - normalCenterWidth - outerValueMargin * 2) / 2 < 90;
    const centerLabelWidth = stacked ? 10 : normalCenterWidth;
    const panelWidth = (containerWidth - centerLabelWidth - outerValueMargin * 2) / 2;

    // stacked : légende sur 2 lignes à gauche (les 2 items centrés ne tiennent
    // plus côte à côte) + place pour le premier nom au-dessus de ses barres.
    const legendHeight = stacked ? 50 : (isMobile ? 30 : 32);
    const margin = {
      top: legendHeight + (stacked ? 22 : 12),
      bottom: 20 // graduations de l'axe (9.5px + tick) : 20px suffisent, tient sous 500px à 1000px
    };
    const innerHeight = data.length * rowHeight;
    svg.attr("height", margin.top + innerHeight + margin.bottom);

    const maxBetriebe = d3.max(data, d => d.betriebe);
    const maxPlaetze = d3.max(data, d => d.plaetze);
    const maxVal = Math.max(maxBetriebe, maxPlaetze) * 1.12;

    // rightScale convertit une valeur Einsatzplaetze en longueur de barre
    // (panneau droit), et aussi Einsatzbetriebe en mode partage.
    const rightScale = d3.scaleLinear().domain([0, INDEPENDENT_SCALES ? maxPlaetze * 1.12 : maxVal]).range([0, panelWidth]);

    // Echelle "longueur" du panneau gauche : partagee avec la droite ou
    // independante, plafonnee sur son propre maximum.
    const leftLengthScale = INDEPENDENT_SCALES
      ? d3.scaleLinear().domain([0, maxBetriebe * 1.12]).range([0, panelWidth])
      : rightScale;

    // leftScale : version inversee de leftLengthScale, utilisee uniquement
    // pour positionner les graduations de l'axe gauche (cf. drawSideAxis).
    const leftScale = leftLengthScale.copy().range([panelWidth, 0]);

    const y0 = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, innerHeight])
      .paddingInner(stacked ? 0.5 : 0.28)
      .paddingOuter(stacked ? 0.05 : 0.14);

    const leftX = outerValueMargin;
    const centerX = outerValueMargin + panelWidth;
    const rightX = outerValueMargin + panelWidth + centerLabelWidth;

    const legendFont = isMobile ? "11px" : "12.5px";
    drawLegendItem(svg, stacked ? null : leftX + panelWidth / 2, 6, BASE_BETRIEBE, legendLookup[currentLang][0].text, legendFont);
    drawLegendItem(svg, stacked ? null : rightX + panelWidth / 2, stacked ? 28 : 6, BASE_PLAETZE, legendLookup[currentLang][1].text, legendFont);

    const gLeft = svg.append("g").attr("transform", `translate(${leftX}, ${margin.top})`);
    const gCenter = svg.append("g").attr("transform", `translate(${centerX}, ${margin.top})`);
    const gRight = svg.append("g").attr("transform", `translate(${rightX}, ${margin.top})`);

    // drawSideBars reçoit un scale "longueur" par côté (leftLengthScale,
    // rightScale) ; leftScale (inversé) ne sert qu'aux ticks de l'axe gauche.
    drawSideBars(gLeft, data, y0, leftLengthScale, panelWidth, BASE_BETRIEBE, "betriebe", "left", isMobile);
    drawSideBars(gRight, data, y0, rightScale, panelWidth, BASE_PLAETZE, "plaetze", "right", isMobile);
    drawSideAxis(gLeft, leftScale, panelWidth, innerHeight, isMobile);
    drawSideAxis(gRight, rightScale, panelWidth, innerHeight, isMobile);
    drawCenterLabels(gCenter, data, y0, centerLabelWidth, isMobile, svg, stacked);

    attachHover(svg, data, y0, leftX, panelWidth * 2 + centerLabelWidth, margin.top, isMobile,
      stacked ? containerWidth : centerLabelWidth, containerWidth, stacked);
  });
}
