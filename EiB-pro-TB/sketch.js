const titleLookup = {
    de: "2025: Einsatzbetriebe und Einsatzplätze pro Tätigkeitsbereich",
    fr: "2025 : Établissements et places d'affectation par domaine d'activité",
    it: "2025: Istituti e posti d'impiego per ambito di attività"
}

// Une seule langue affichee a la fois (selon ?lang=), jamais les trois
// versions ensemble.
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

// Graphique à 2 variables : petrol (Einsatzbetriebe) + lila
// (Einsatzplätze), couleurs unies (pas de dégradé).
const BASE_BETRIEBE = "#5A959D";  // accent1 — petrol
const BASE_PLAETZE = "#A3A8CA";   // accent3 — lila

// Ligne de total sous la derniere categorie (somme des domaines), sans
// barre : une pastille de couleur indique la serie de chaque chiffre.
const TOTAL_LABEL = { de: "Total", fr: "Total", it: "Totale" };
const TOTAL_ROW_HEIGHT = 24;

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

  const title = titleLookup[currentLang];
  d3.select("#titleContainer").text(title);

  drawChart();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", drawChart);

// --- Formatage suisse : 8'344 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// --- Légende (puces carrées, langue courante uniquement) — en haut, avant le graphique ---
function drawLegend(svg, margin, isMobile) {
  const legend = svg.append("g")
    .attr("transform", `translate(${margin.left}, 6)`);

  const colorByKey = { betriebe: BASE_BETRIEBE, plaetze: BASE_PLAETZE };
  const legendItems = legendLookup[currentLang];

  legendItems.forEach((item, i) => {
    const row = legend.append("g").attr("transform", `translate(0, ${i * 22})`);
    row.append("rect")
      .attr("width", 11)
      .attr("height", 11)
      .attr("y", 3)
      .attr("fill", colorByKey[item.key]);

    row.append("text")
      .attr("x", 17)
      .attr("y", 12)
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "11.5px" : "13px")
      .style("fill", "#111")
      .text(item.text);
  });
}

// --- Barres avec animation d'apparition ---
function drawBars(g, data, series, x, y0, y1, isMobile) {
  // Largeur plancher : une valeur non nulle reste toujours visible,
  // même minuscule à cette échelle (ex. Katastrophen : 11 / 48).
  const MIN_BAR_WIDTH = 2;
  const barWidth = (val) => val > 0 ? Math.max(x(val), MIN_BAR_WIDTH) : 0;

  series.forEach((s, si) => {
    g.selectAll(`rect.bar-${s.key}`)
      .data(data)
      .enter()
      .append("rect")
      .attr("class", `bar bar-${s.key}`)
      .attr("y", d => y0(d.label) + y1(s.key))
      .attr("height", y1.bandwidth())
      .attr("width", 0)
      .attr("fill", d => s.base)
      .transition()
      .delay((d, i) => i * 90 + si * 45)
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr("width", d => barWidth(d[s.key]));

    // --- Étiquette de valeur, avec compteur animé ---
    g.selectAll(`text.value-${s.key}`)
      .data(data)
      .enter()
      .append("text")
      .attr("class", `value value-${s.key}`)
      .attr("x", 6)
      .attr("y", d => y0(d.label) + y1(s.key) + y1.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .style("font-family", "Arial")
      .style("font-size", isMobile ? VALUE_FONT_SIZE.mobile : VALUE_FONT_SIZE.desktop)
      .style("font-weight", "normal")
      .style("fill", "#111")
      .style("pointer-events", "none") // meme raison que le label : evite qu'un raise() au survol ne coupe le survol porte par rect.hit
      .text("0")
      .transition()
      .delay((d, i) => i * 90 + si * 45)
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr("x", d => barWidth(d[s.key]) + 6)
      .textTween(function (d) {
        const iVal = d3.interpolateNumber(0, d[s.key]);
        return t => formatSwiss(iVal(t));
      });
  });
}

// Tailles reutilisees par highlight() pour l'agrandissement au survol.
const ROW_LABEL_FONT_SIZE = { mobile: "9.5px", desktop: "10.5px" };
const ROW_LABEL_FONT_SIZE_HOVER = { mobile: "12px", desktop: "13.5px" };

// Memes tailles que le label, pour que les valeurs grandissent avec lui
// (evite deux polices differentes sur la meme ligne au survol).
const VALUE_FONT_SIZE = { mobile: "9.5px", desktop: "10.5px" };
const VALUE_FONT_SIZE_HOVER = { mobile: "11.5px", desktop: "13px" };

// --- Largeur du label le plus long (langue courante), pour caler la colonne de gauche ---
function measureMaxLabelWidth(svg, data, fontSize) {
  const probe = svg.append("text")
    .style("font-family", "Arial")
    .style("font-size", fontSize)
    .style("opacity", 0);
  let maxWidth = 0;
  data.forEach(d => {
    probe.text(d.label);
    maxWidth = Math.max(maxWidth, probe.node().getComputedTextLength());
  });
  probe.remove();
  return maxWidth;
}

// --- Label à gauche, centré verticalement sur la paire de barres
// (une seule langue par data_<lang>.csv) ; stacked : au-dessus de la paire ---
function drawRowLabels(g, data, y0, isMobile, stacked) {
  g.selectAll("text.label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", stacked ? 0 : -10)
    .attr("y", d => stacked ? y0(d.label) - 4 : y0(d.label) + y0.bandwidth() / 2)
    .attr("text-anchor", stacked ? "start" : "end")
    .attr("dominant-baseline", stacked ? "auto" : "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? ROW_LABEL_FONT_SIZE.mobile : ROW_LABEL_FONT_SIZE.desktop)
    .style("font-weight", "normal")
    .style("fill", "#333")
    .style("pointer-events", "none") // le survol reste porté par rect.hit ; sans ça, le label agrandi+raise() passe devant le rect au survol et déclenche un mouseout immédiat (le survol "s'annule" dès qu'on touche le texte)
    .text(d => d.label);
}

// --- Survol par ligne : met en évidence une catégorie ---
function highlight(g, label, isMobile, margin, innerWidth, stacked) {
  g.selectAll(".bar")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3);

  const baseSize = isMobile ? ROW_LABEL_FONT_SIZE.mobile : ROW_LABEL_FONT_SIZE.desktop;
  const hoverSize = isMobile ? ROW_LABEL_FONT_SIZE_HOVER.mobile : ROW_LABEL_FONT_SIZE_HOVER.desktop;
  let targetSize = hoverSize;

  const valueBaseSize = isMobile ? VALUE_FONT_SIZE.mobile : VALUE_FONT_SIZE.desktop;
  const valueHoverSize = isMobile ? VALUE_FONT_SIZE_HOVER.mobile : VALUE_FONT_SIZE_HOVER.desktop;
  const valueTargetByNode = new Map();

  // Label survolé : au premier plan (raise) pour ne pas être recouvert
  // par les lignes voisines une fois agrandi. Le label grandit vers la
  // gauche (text-anchor end) : on réduit l'agrandissement si besoin
  // pour ne jamais déborder du cadre SVG (marge fixe, pas mesurée).
  if (label !== null) {
    const sel = g.selectAll(".label").filter(d => d.label === label);
    sel.raise();

    // Le poids "bold" (applique juste apres) elargit aussi le texte :
    // il doit etre pris en compte ici, sinon la mesure sous-estime la
    // largeur reelle une fois le survol applique.
    sel.style("font-weight", "bold").style("font-size", hoverSize);
    const measuredWidth = sel.node().getComputedTextLength();
    const available = stacked
      ? innerWidth + margin.right - 4 // label au-dessus des barres : toute la largeur
      : margin.left - 10 - 4; // 4px de marge de sécurité avant le bord du SVG
    if (measuredWidth > available) {
      const scaledPx = Math.max(parseFloat(baseSize), parseFloat(hoverSize) * (available / measuredWidth));
      targetSize = scaledPx + "px";
    }
    sel.style("font-weight", "normal").style("font-size", baseSize);

    // Les valeurs (Einsatzbetriebe + Einsatzplätze) grandissent avec le
    // label, pour ne pas garder deux tailles de police différentes sur
    // la même ligne au survol. Chacune des deux grandit vers la droite,
    // à partir de sa propre position réelle (le plafond dépend de la
    // longueur de SA barre, pas d'une marge fixe qui pénaliserait à tort
    // une valeur courte dont la barre est loin du bord).
    const valSel = g.selectAll(".value").filter(d => d.label === label);
    valSel.raise();
    valSel.style("font-size", valueHoverSize);
    valSel.each(function () {
      const currentX = parseFloat(this.getAttribute("x"));
      const measuredWidth = this.getComputedTextLength();
      const available = (innerWidth - currentX) + margin.right - 4;
      let t = valueHoverSize;
      if (measuredWidth > available) {
        const scaledPx = Math.max(parseFloat(valueBaseSize), parseFloat(valueHoverSize) * (available / measuredWidth));
        t = scaledPx + "px";
      }
      valueTargetByNode.set(this, t);
    });
    valSel.style("font-size", valueBaseSize);
  }

  g.selectAll(".label")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3)
    .style("font-weight", d => (label !== null && d.label === label) ? "bold" : "normal")
    .style("font-size", d => (label !== null && d.label === label) ? targetSize : baseSize)
    .style("fill", d => (label !== null && d.label === label) ? "#000" : "#333");

  g.selectAll(".value")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3)
    .style("font-size", function (d) {
      if (label !== null && d.label === label) {
        return valueTargetByNode.get(this) || valueHoverSize;
      }
      return valueBaseSize;
    });
}

function attachHover(g, data, y0, margin, innerWidth, isMobile, stacked) {
  g.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", -margin.left)
    .attr("y", d => y0(d.label) - (y0.step() - y0.bandwidth()) / (stacked ? 1 : 2)) // stacked : couvre aussi le label au-dessus
    .attr("width", innerWidth + margin.left + margin.right)
    .attr("height", y0.step())
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => highlight(g, d.label, isMobile, margin, innerWidth, stacked))
    .on("mouseout", () => highlight(g, null, isMobile, margin, innerWidth, stacked));
}

function drawChart() {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const width = containerWidth;
  const isMobile = width < 600;

  let filename = "data_" + currentLang + ".csv";

  d3.csv(filename).then(raw => {

    const data = raw.map(d => ({
      label: d["Tätigkeit"],
      betriebe: +d["Einsatzbetriebe"],
      plaetze: +d["Einsatzplätze"]
    }));

    // Ordre décroissant par nombre de places d'affectation (Einsatzplätze)
    data.sort((a, b) => b.plaetze - a.plaetze);

    const rowHeight = 39; // 42 -> 39 pour faire place a la ligne de total sous 500px
    const legendHeight = 54; // légende sur une seule ligne par item (embed compact) — agrandie avec le texte
    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width);

    // Colonne de gauche calée sur le label le plus long (mesuré) ; si elle
    // mangerait plus de 45 % de la largeur, les labels passent au-dessus des barres.
    const maxLabelWidth = measureMaxLabelWidth(svg, data, isMobile ? ROW_LABEL_FONT_SIZE.mobile : ROW_LABEL_FONT_SIZE.desktop);
    const stacked = 10 + maxLabelWidth + 14 > width * 0.45;

    const margin = {
      top: legendHeight + (stacked ? 12 : 0),
      right: isMobile ? 55 : 78,
      bottom: 16,
      left: stacked ? 10 : 10 + maxLabelWidth + 14 // 10px = ancrage du label (x=-10), 14px de sécurité avant le bord
    };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = data.length * rowHeight;
    const height = margin.top + innerHeight + TOTAL_ROW_HEIGHT + margin.bottom;
    svg.attr("height", height);

    drawLegend(svg, margin, isMobile);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const maxBetriebe = d3.max(data, d => d.betriebe);
    const maxPlaetze = d3.max(data, d => d.plaetze);
    const maxVal = Math.max(maxBetriebe, maxPlaetze);

    const x = d3.scaleLinear()
      .domain([0, maxVal * 1.12])
      .range([0, innerWidth]);

    const y0 = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, innerHeight])
      .paddingInner(0.45)
      .paddingOuter(0.15);

    const y1 = d3.scaleBand()
      .domain(["betriebe", "plaetze"])
      .range([0, y0.bandwidth()])
      .paddingInner(0.08);

    const series = [
      { key: "betriebe", base: BASE_BETRIEBE },
      { key: "plaetze", base: BASE_PLAETZE }
    ];

    drawBars(g, data, series, x, y0, y1, isMobile);
    drawRowLabels(g, data, y0, isMobile, stacked);
    attachHover(g, data, y0, margin, innerWidth, isMobile, stacked);
    drawTotals(g, data, series, innerHeight, margin, innerWidth, isMobile, stacked);
  });
}

// --- Ligne de total : trait gris, "Total" dans la colonne des labels (ou en
// debut de ligne en mode stacked), puis les deux sommes avec leur pastille.
// Agrandie au survol, comme les lignes de domaine.
function drawTotals(g, data, series, innerHeight, margin, innerWidth, isMobile, stacked) {
  const lineY = innerHeight + 2;
  const textY = lineY + TOTAL_ROW_HEIGHT / 2;
  const baseSize = isMobile ? VALUE_FONT_SIZE.mobile : VALUE_FONT_SIZE.desktop;
  const hoverSize = isMobile ? VALUE_FONT_SIZE_HOVER.mobile : VALUE_FONT_SIZE_HOVER.desktop;
  const totals = g.append("g").attr("class", "totals");

  totals.append("line")
    .attr("x1", -margin.left + 10)
    .attr("x2", innerWidth)
    .attr("y1", lineY)
    .attr("y2", lineY)
    .attr("stroke", "#b2b4b7")
    .attr("stroke-width", 1);

  const style = sel => sel
    .attr("class", "total-text")
    .attr("y", textY)
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-size", baseSize)
    .style("font-weight", "bold")
    .style("fill", "#111")
    .style("pointer-events", "none");

  const label = totals.append("text").call(style)
    .attr("x", stacked ? 0 : -10)
    .attr("text-anchor", stacked ? "start" : "end")
    .text(TOTAL_LABEL[currentLang]);

  // Les sommes demarrent au debut des barres (apres "Total" en mode stacked) ;
  // ecart calcule a la taille de survol pour que rien ne se chevauche.
  let x = stacked ? label.node().getComputedTextLength() * parseFloat(hoverSize) / parseFloat(baseSize) + 12 : 0;
  series.forEach(s => {
    totals.append("rect")
      .attr("x", x)
      .attr("y", textY - 4)
      .attr("width", 8)
      .attr("height", 8)
      .attr("fill", s.base);
    const t = totals.append("text").call(style)
      .attr("x", x + 12)
      .text(formatSwiss(d3.sum(data, d => d[s.key])));
    x += 12 + t.node().getComputedTextLength() * parseFloat(hoverSize) / parseFloat(baseSize) + 18;
  });

  g.append("rect")
    .attr("class", "hit")
    .attr("x", -margin.left)
    .attr("y", lineY)
    .attr("width", innerWidth + margin.left + margin.right)
    .attr("height", TOTAL_ROW_HEIGHT)
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", () => {
      highlight(g, null, isMobile, margin, innerWidth, stacked);
      g.selectAll(".bar, .label, .value").transition().duration(150).style("opacity", 0.3);
      totals.selectAll(".total-text").transition().duration(150).style("font-size", hoverSize);
    })
    .on("mouseout", () => {
      highlight(g, null, isMobile, margin, innerWidth, stacked);
      totals.selectAll(".total-text").transition().duration(150).style("font-size", baseSize);
    });
}
