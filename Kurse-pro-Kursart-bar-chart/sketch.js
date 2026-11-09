// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "2025: Kurse pro Kursart",
  fr: "2025 : Cours par genre de cours",
  it: "2025: Corsi per genere del corso"
};

// Plus de 5 catégories : palette fixe à 5 couleurs (comme Rechtsdienst),
// reprise par cycle dans l'ordre des barres (triées par valeur décroissante).
const PALETTE = ["#5A959D", "#A3A8CA", "#CAE7EA", "#B1B488", "#FCEB30"];

// Langue courante, determinee au demarrage depuis ?lang= (par defaut "de").
let currentLang = "de";

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

// --- Formatage suisse : 1'234 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// --- Typographie numérique suisse : point décimal (55.4 %) ---
function formatPercent(p) {
  return p.toFixed(1) + " %";
}

// ============================================================
// Barres, étiquettes, labels
// ============================================================

// --- Barres avec animation d'apparition ---
function drawBars(g, data, x, y, barColor) {
  const bars = g.selectAll("rect.bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("y", d => y(d.label))
    .attr("height", y.bandwidth())
    .attr("width", 0)
    .attr("fill", barColor);

  bars.transition()
    .delay((d, i) => i * 80)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("width", d => x(d.value));
}

// Tailles reutilisees par highlight() pour l'agrandissement au survol
// (memes tailles que le label de la ligne, pour ne pas se retrouver avec
// deux polices differentes au survol d'une meme ligne).
const VALUE_FONT_SIZE = { mobile: "10px", desktop: "12px" };
const VALUE_FONT_SIZE_HOVER = { mobile: "12.5px", desktop: "14.5px" };

// --- Étiquette "%" au bout de chaque barre, compteur animé ; la valeur
// brute s'affiche entre parenthèses uniquement au survol de la ligne. ---
function drawValueLabels(g, data, x, y, total, isMobile) {
  const valueLabels = g.selectAll("text.value")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value")
    .attr("x", 8)
    .attr("y", d => y(d.label) + y.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? VALUE_FONT_SIZE.mobile : VALUE_FONT_SIZE.desktop)
    .style("font-weight", "normal")
    .style("fill", "#111")
    .style("pointer-events", "none"); // le survol reste porté par rect.hit ; sans ça, la valeur agrandie+raise() passe devant le rect au survol et déclenche un mouseout immédiat

  valueLabels.append("tspan").attr("class", "pct-value").text("0 %");
  valueLabels.append("tspan")
    .attr("class", "count-value")
    .style("opacity", 0)
    .text(d => ` (${formatSwiss(d.value)})`);

  valueLabels.transition()
    .delay((d, i) => i * 80)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("x", d => x(d.value) + 8)
    .tween("text", function (d) {
      const pct = (d.value / total) * 100;
      const iPct = d3.interpolateNumber(0, pct);
      const pctSpan = d3.select(this).select("tspan.pct-value");
      return t => pctSpan.text(formatPercent(iPct(t)));
    });
}

// Tailles reutilisees par highlight() pour l'agrandissement au survol.
const ROW_LABEL_FONT_SIZE = { mobile: "10px", desktop: "12px" };
const ROW_LABEL_FONT_SIZE_HOVER = { mobile: "12.5px", desktop: "14.5px" };

// --- Mesure le plus long label pour dimensionner la colonne de gauche
// au plus juste (texte temporaire mesuré puis retiré) — même pattern
// que DT-nach-TB, pour ne jamais déborder du cadre SVG (cf. le bug de
// débordement en mobile corrigé le 09.09.2026 : la marge de gauche
// était fixe et trop étroite pour le libellé le plus long). ---
function measureMaxLabelWidth(svg, data, fontSize) {
  const probe = svg.append("text")
    .attr("class", "label-probe")
    .style("font-family", "Arial")
    .style("font-size", fontSize)
    .style("font-weight", "normal")
    .style("opacity", 0);

  let maxWidth = 0;
  data.forEach(d => {
    probe.text(d.label);
    const w = probe.node().getComputedTextLength();
    if (w > maxWidth) maxWidth = w;
  });

  probe.remove();
  return maxWidth;
}

// --- Labels à gauche (une seule langue par CSV) ---
function drawRowLabels(g, data, y, isMobile, stacked) {
  g.selectAll("text.label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", stacked ? 0 : -10)
    .attr("y", d => stacked ? y(d.label) - 4 : y(d.label) + y.bandwidth() / 2)
    .attr("text-anchor", stacked ? "start" : "end")
    .attr("dominant-baseline", stacked ? "auto" : "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? ROW_LABEL_FONT_SIZE.mobile : ROW_LABEL_FONT_SIZE.desktop)
    .style("font-weight", "normal")
    .style("fill", "#333")
    .style("pointer-events", "none") // meme raison que pour la valeur : le survol reste porté par rect.hit
    .text(d => d.label);
}

// ============================================================
// Interaction
// ============================================================

// --- Survol par ligne : met en évidence label + barre + valeur, révèle
// la valeur brute entre parenthèses (cachée par défaut). ---
function highlight(g, label, isMobile, margin, innerWidth, stacked) {
  g.selectAll(".bar")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3);

  g.selectAll(".count-value")
    .transition().duration(150)
    .style("opacity", d => (label !== null && d.label === label) ? 1 : 0);

  const baseSize = isMobile ? ROW_LABEL_FONT_SIZE.mobile : ROW_LABEL_FONT_SIZE.desktop;
  const hoverSize = isMobile ? ROW_LABEL_FONT_SIZE_HOVER.mobile : ROW_LABEL_FONT_SIZE_HOVER.desktop;
  let targetSize = hoverSize;

  const valueBaseSize = isMobile ? VALUE_FONT_SIZE.mobile : VALUE_FONT_SIZE.desktop;
  const valueHoverSize = isMobile ? VALUE_FONT_SIZE_HOVER.mobile : VALUE_FONT_SIZE_HOVER.desktop;
  let valueTargetSize = valueHoverSize;

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
      ? innerWidth + margin.right - 4 // label au-dessus de la barre : toute la largeur
      : margin.left - 10 - 4; // 4px de marge de sécurité avant le bord du SVG
    if (measuredWidth > available) {
      const scaledPx = Math.max(parseFloat(baseSize), parseFloat(hoverSize) * (available / measuredWidth));
      targetSize = scaledPx + "px";
    }
    sel.style("font-weight", "normal").style("font-size", baseSize);

    // La valeur (pourcentage, + le chiffre brut entre parenthèses qui se
    // révèle en même temps) grandit avec le label, pour ne pas garder
    // deux tailles de police différentes sur la même ligne au survol.
    // Mesurée avec le tspan entre parenthèses déjà révélé (il apparaît
    // exactement au moment du survol), sinon la mesure sous-estimerait
    // la largeur réelle une fois les deux effets combinés. La place
    // disponible dépend de la position réelle de cette valeur (une barre
    // courte laisse beaucoup plus de place qu'une barre proche du bord),
    // pas d'une marge fixe qui plafonnerait à tort les petites valeurs.
    const valSel = g.selectAll(".value").filter(d => d.label === label);
    valSel.raise();
    const valNode = valSel.node();
    const valueCurrentX = parseFloat(valNode.getAttribute("x"));
    valSel.style("font-size", valueHoverSize);
    const valueMeasuredWidth = valNode.getComputedTextLength();
    const valueAvailable = (innerWidth - valueCurrentX) + margin.right - 4;
    if (valueMeasuredWidth > valueAvailable) {
      const valueScaledPx = Math.max(parseFloat(valueBaseSize), parseFloat(valueHoverSize) * (valueAvailable / valueMeasuredWidth));
      valueTargetSize = valueScaledPx + "px";
    }
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
    .style("font-size", d => (label !== null && d.label === label) ? valueTargetSize : valueBaseSize);
}

function attachHoverAreas(g, data, y, margin, innerWidth, isMobile, stacked) {
  g.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", -margin.left)
    .attr("y", d => y(d.label) - (y.step() - y.bandwidth()) / (stacked ? 1 : 2)) // stacked : couvre aussi le label au-dessus
    .attr("width", innerWidth + margin.left + margin.right)
    .attr("height", y.step())
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => highlight(g, d.label, isMobile, margin, innerWidth, stacked))
    .on("mouseout", () => highlight(g, null, isMobile, margin, innerWidth, stacked));
}

// ============================================================
// Orchestration
// ============================================================

function drawChart() {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const width = containerWidth;
  const isMobile = width < 600;

  d3.csv("data_" + currentLang + ".csv").then(raw => {

    const data = raw.map(d => ({ label: d.Label, value: +d.Value }));
    const total = d3.sum(data, d => d.value);
    const maxVal = d3.max(data, d => d.value);

    data.sort((a, b) => b.value - a.value);

    // Hauteur de ligne augmentée pour laisser assez d'air aux labels
    // trilingues sur 3 lignes ; marges haut/bas resserrées pour compenser.
    const rowHeight = 43;
    const marginTop = 6;
    const marginBottom = 6;
    const marginRight = isMobile ? 70 : 110;

    const innerHeight = data.length * rowHeight;
    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width);

    // Largeur de la colonne de gauche calée sur le nom le plus long
    // (mesuré), pour que les libellés longs restent toujours entièrement
    // visibles, y compris en mobile.
    const labelFontSize = isMobile ? ROW_LABEL_FONT_SIZE.mobile : ROW_LABEL_FONT_SIZE.desktop;
    const maxLabelWidth = measureMaxLabelWidth(svg, data, labelFontSize);

    // Écran étroit : si la colonne de labels mangerait plus de 45 % de la
    // largeur, chaque nom passe au-dessus de sa barre (barres pleine largeur).
    const stacked = 10 + maxLabelWidth + 14 > width * 0.45;

    const margin = {
      top: stacked ? 18 : marginTop,   // stacked : place pour le premier label au-dessus de sa barre
      right: marginRight,
      bottom: marginBottom,
      left: stacked ? 10 : 10 + maxLabelWidth + 14   // 10px = décalage de l'ancrage (x=-10), 14px de marge de sécurité avant le bord du SVG
    };

    const innerWidth = width - margin.left - margin.right;
    svg.attr("height", margin.top + innerHeight + margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const x = d3.scaleLinear()
      .domain([0, maxVal * 1.12])
      .range([0, innerWidth]);

    const y = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, innerHeight])
      .paddingInner(stacked ? 0.55 : 0.3)
      .paddingOuter(stacked ? 0.1 : 0.3);

    const barColor = (d, i) => PALETTE[i % PALETTE.length];

    drawBars(g, data, x, y, barColor);
    drawValueLabels(g, data, x, y, total, isMobile);
    drawRowLabels(g, data, y, isMobile, stacked);
    attachHoverAreas(g, data, y, margin, innerWidth, isMobile, stacked);
  });
}
