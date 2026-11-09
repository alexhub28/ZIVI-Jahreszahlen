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
  de: "Anzahl der geleisteten Diensttage",
  fr: "Nombre de jours de service accomplis",
  it: "Numero di giorni di servizio prestati"
};

// Plus de 4 domaines : palette fixe à 4 couleurs, cyclée par ordre
// de barre (valeur décroissante), toujours en aplat.
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

// --- Mesure le plus long label pour dimensionner la colonne de
// gauche au plus juste (texte temporaire mesuré puis retiré) ---
function measureMaxLabelWidth(svg, data, fontSize) {
  const probe = svg.append("text")
    .attr("class", "label-probe")
    .style("font-family", "Arial")
    .style("font-size", fontSize)
    .style("font-weight", "normal")
    .style("opacity", 0);

  let maxWidth = 0;
  data.forEach(d => {
    probe.text(d.Label);
    const w = probe.node().getComputedTextLength();
    if (w > maxWidth) maxWidth = w;
  });

  probe.remove();
  return maxWidth;
}

// --- Label aligné à gauche, centré verticalement sur sa barre
// (une seule langue par data_<lang>.csv) ---
// Tailles reutilisees par highlight() pour l'agrandissement au survol.
const ROW_LABEL_FONT_SIZE = { mobile: "11px", desktop: "12.5px" };
const ROW_LABEL_FONT_SIZE_HOVER = { mobile: "13px", desktop: "15px" };

function drawRowLabels(g, data, y, margin, isMobile, stacked) {
  g.selectAll("text.label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", stacked ? 0 : -margin.left + 8)
    .attr("y", d => stacked ? y(d.Label) - 4 : y(d.Label) + y.bandwidth() / 2)
    .attr("text-anchor", "start")
    .attr("dominant-baseline", stacked ? "auto" : "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? ROW_LABEL_FONT_SIZE.mobile : ROW_LABEL_FONT_SIZE.desktop)
    .style("font-weight", "normal")
    .style("fill", "#333")
    .style("pointer-events", "none") // le survol reste porté par rect.hit ; sans ça, le label agrandi+raise() passe devant le rect au survol et déclenche un mouseout immédiat (le survol "s'annule" dès qu'on touche le texte)
    .text(d => d.Label);
}

// Tailles reutilisees par highlight() pour l'agrandissement au survol
// (memes tailles que le label de la ligne, pour ne pas se retrouver avec
// deux polices differentes au survol d'une meme ligne).
const VALUE_FONT_SIZE = { mobile: "9.5px", desktop: "10.5px" };
const VALUE_FONT_SIZE_HOVER = { mobile: "11px", desktop: "12.5px" };

// --- "%" animé au bout de chaque barre ; la valeur absolue n'apparaît
// qu'au survol (tooltip), pour ne pas surcharger le graphique ---
function drawValueLabels(g, data, x, y, isMobile) {
  const valueLabels = g.selectAll("text.value")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value")
    .attr("x", 8)
    .attr("y", d => y(d.Label) + y.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? VALUE_FONT_SIZE.mobile : VALUE_FONT_SIZE.desktop)
    .style("font-weight", "normal")
    .style("fill", "#111")
    .style("pointer-events", "none") // meme raison que le label : evite qu'un raise() au survol ne coupe le survol porte par rect.hit
    .text(formatPercent(0));

  valueLabels.transition()
    .delay((d, i) => i * 80)
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("x", d => x(d.Value) + 8)
    .textTween(function (d) {
      const iPct = d3.interpolateNumber(0, d.Percent);
      return t => formatPercent(Math.round(iPct(t) * 10) / 10);
    });
}

// --- Axe X : graduations calculées selon la largeur réelle, pour
// éviter le chevauchement des nombres suisses ---
function drawXAxis(g, x, innerWidth, innerHeight, isMobile) {
  const tickPxBudget = isMobile ? 55 : 85;
  const tickCount = Math.max(2, Math.min(6, Math.floor(innerWidth / tickPxBudget)));

  // Ne garde que les graduations dans la zone du graphique (évite les
  // traits sans chiffre au-delà de la dernière valeur).
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
function highlight(g, label, isMobile, margin, innerWidth, stacked) {
  g.selectAll(".bar")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.Label === label) ? 1 : 0.3);

  const baseSize = isMobile ? ROW_LABEL_FONT_SIZE.mobile : ROW_LABEL_FONT_SIZE.desktop;
  const hoverSize = isMobile ? ROW_LABEL_FONT_SIZE_HOVER.mobile : ROW_LABEL_FONT_SIZE_HOVER.desktop;
  let targetSize = hoverSize;

  const valueBaseSize = isMobile ? VALUE_FONT_SIZE.mobile : VALUE_FONT_SIZE.desktop;
  const valueHoverSize = isMobile ? VALUE_FONT_SIZE_HOVER.mobile : VALUE_FONT_SIZE_HOVER.desktop;
  let valueTargetSize = valueHoverSize;

  // Label survolé : au premier plan (raise) pour ne pas être recouvert
  // par la barre ou les lignes voisines une fois agrandi. La colonne de
  // gauche est calée au plus juste sur le label le plus long (cf.
  // measureMaxLabelWidth) : on réduit l'agrandissement si besoin pour
  // ne jamais déborder sur la barre.
  if (label !== null) {
    const sel = g.selectAll(".label").filter(d => d.Label === label);
    sel.raise();

    // Le poids "bold" (applique juste apres) elargit aussi le texte :
    // il doit etre pris en compte ici, sinon la mesure sous-estime la
    // largeur reelle une fois le survol applique.
    sel.style("font-weight", "bold").style("font-size", hoverSize);
    const measuredWidth = sel.node().getComputedTextLength();
    const available = stacked
      ? innerWidth + margin.right - 4 // label au-dessus de la barre : toute la largeur
      : margin.left - 8 - 4; // 4px de marge de sécurité avant la barre
    if (measuredWidth > available) {
      const scaledPx = Math.max(parseFloat(baseSize), parseFloat(hoverSize) * (available / measuredWidth));
      targetSize = scaledPx + "px";
    }
    sel.style("font-weight", "normal").style("font-size", baseSize); // repart de la taille de base avant la transition

    // La valeur ("%") grandit avec le label, pour ne pas garder deux
    // tailles de police différentes sur la même ligne au survol. Elle
    // grandit vers la droite (au-delà du bout de la barre) : la place
    // disponible dépend de la position réelle de CETTE valeur (une barre
    // courte laisse beaucoup plus de place qu'une barre proche du bord),
    // pas d'une marge fixe qui plafonnerait à tort les petites valeurs.
    const valSel = g.selectAll(".value").filter(d => d.Label === label);
    valSel.raise();
    // Pas de gras ici (contrairement au label) : seule la taille doit
    // suivre, le reste du style de la valeur reste inchangé.
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
    .style("opacity", d => (label === null || d.Label === label) ? 1 : 0.3)
    .style("font-weight", d => (label !== null && d.Label === label) ? "bold" : "normal")
    .style("font-size", d => (label !== null && d.Label === label) ? targetSize : baseSize)
    .style("fill", d => (label !== null && d.Label === label) ? "#000" : "#333");

  g.selectAll(".value")
    .transition().duration(150)
    .style("opacity", d => (label === null || d.Label === label) ? 1 : 0.3)
    .style("font-size", d => (label !== null && d.Label === label) ? valueTargetSize : valueBaseSize);
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

  // Repartir de (0,0) avant de mesurer : sinon getBBox() garde le
  // x/y du survol précédent et le texte dérive hors de l'encadré.
  tooltipText.attr("x", 0).attr("y", 0).text(formatSwiss(d.Value));

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

function attachHoverAreas(g, data, y, margin, innerWidth, tooltipParts, svg, isMobile, stacked) {
  g.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", -margin.left)
    .attr("y", d => y(d.Label) - (y.step() - y.bandwidth()) / (stacked ? 1 : 2)) // stacked : couvre aussi le label au-dessus
    .attr("width", innerWidth + margin.left + margin.right)
    .attr("height", y.step())
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      highlight(g, d.Label, isMobile, margin, innerWidth, stacked);
      const [mx, my] = d3.pointer(event, svg.node());
      positionTooltip(tooltipParts, d, mx, my, innerWidth + margin.left + margin.right);
    })
    .on("mousemove", (event, d) => {
      const [mx, my] = d3.pointer(event, svg.node());
      positionTooltip(tooltipParts, d, mx, my, innerWidth + margin.left + margin.right);
    })
    .on("mouseout", () => {
      highlight(g, null, isMobile, margin, innerWidth, stacked);
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

    // Largeur de la colonne de labels calée sur le nom le plus long
    // (mesuré), pour que les barres démarrent juste après, sans vide.
    const labelFontSize = isMobile ? "11px" : "12.5px";
    const maxLabelWidth = measureMaxLabelWidth(svg, data, labelFontSize);

    // Écran étroit : si la colonne de labels mangerait plus de 45 % de la
    // largeur, chaque nom passe au-dessus de sa barre (barres pleine largeur).
    const stacked = 8 + maxLabelWidth + 16 > width * 0.45;

    const margin = {
      top: stacked ? 16 : 3,   // stacked : place pour le premier label au-dessus de sa barre
      right: isMobile ? 42 : 55,   // assez de place pour "100.0 %"
      bottom: 44,
      left: stacked ? 8 : 8 + maxLabelWidth + 16   // 8px avant le label, largeur du label, 16px avant la barre
    };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.Value) * 1.08])
      .range([0, innerWidth]);

    const y = d3.scaleBand()
      .domain(data.map(d => d.Label))
      .range([0, innerHeight])
      .paddingInner(stacked ? 0.6 : 0.3)
      .paddingOuter(stacked ? 0.1 : 0.3);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    drawBars(g, data, x, y, colorFor);
    drawRowLabels(g, data, y, margin, isMobile, stacked);
    drawValueLabels(g, data, x, y, isMobile);
    drawXAxis(g, x, innerWidth, innerHeight, isMobile);
    drawAxisTitle(svg, margin, innerWidth, height, isMobile);

    const tooltipParts = createTooltip(svg);
    attachHoverAreas(g, data, y, margin, innerWidth, tooltipParts, svg, isMobile, stacked);
  });
}
