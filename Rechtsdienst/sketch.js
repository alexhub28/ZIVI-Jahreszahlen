// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "Disziplinarentscheide",
  fr: "Décisions disciplinaires",
  it: "Decisioni disciplinari"
};

// Langue courante, determinee au demarrage depuis ?lang= (par defaut "de").
let currentLang = "de";

// Les 5 séries de barres ont chacune leur propre teinte (petrol, mint,
// kaki, lila, jaune), distincte aussi de la ligne Diensttage (rouge).
const SERIES = [
  {
    key: "Total",
    internKey: "Total_Intern",
    labelLookup: {
      de: "Total Disziplinarentscheide",
      fr: "Total des décisions disciplinaires",
      it: "Totale decisioni disciplinari"
    },
    color: "#5A959D" // petrol - anciennement lila (dupliqué avec Strafanzeigen)
  },
  {
    key: "Art73_74",
    internKey: "Art73_74_Intern",
    labelLookup: {
      de: "Disziplinarentscheide wegen Art. 73 oder 74 ZDG",
      fr: "Décisions disciplinaires pour infraction à l'art. 73 ou 74 LSC",
      it: "Decisioni disciplinari causa articoli 73 o 74 LSC"
    },
    color: "#CAE7EA" // mint
  },
  {
    key: "Art76",
    internKey: "Art76_Intern",
    labelLookup: {
      de: "Disziplinarentscheide wegen Art. 76 ZDV",
      fr: "Décisions disciplinaires pour infraction à l'art. 76 LSC",
      it: "Decisioni disciplinari causa articolo 76 OSCi"
    },
    color: "#B1B488" // kaki
  },
  {
    key: "Strafanzeigen",
    internKey: "Strafanzeigen_Intern",
    labelLookup: {
      de: "Strafanzeigen",
      fr: "Plaintes pénales",
      it: "Denuncia penale"
    },
    color: "#FCEB30" // jaune (Limonengelb) - anciennement lila (dupliqué avec Total)
  },
  {
    key: "Strafbefehle",
    internKey: "Strafbefehle_Intern",
    labelLookup: {
      de: "Strafbefehle wegen Zivildienstverweigerung",
      fr: "Ordonnances pénales pour refus de servir",
      it: "Decreti penali causa Omissione del servizi"
    },
    color: "#A3A8CA" // lila - anciennement mint (dupliqué avec Art73_74), puis gris
  }
];

const LINE_COLOR = "#FF0000"; // Rouge Bund (signal) — Diensttage
const LINE_LABEL_LOOKUP = {
  de: "Anrechenbare Diensttage",
  fr: "Jours de service pris en compte",
  it: "Giorni di servizio computabili"
};

const AXIS_LEFT_LABEL_LOOKUP = {
  de: "Entscheide / Strafanzeigen / Strafbefehle",
  fr: "Décisions / Plaintes pénales / Ordonnances pénales",
  it: "Decisioni / Denuncia penale / Decreti penali"
};

const AXIS_RIGHT_LABEL_LOOKUP = {
  de: "Anzahl Diensttage (Mio)",
  fr: "Jours de service (Million)",
  it: "Giorni di servizio (Milione)"
};

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

// ============================================================
// Échelles
// ============================================================

function createScales(data, innerWidth, innerHeight) {
  const x0 = d3.scaleBand()
    .domain(data.map(d => d.year))
    .range([0, innerWidth])
    .paddingInner(0.2)
    .paddingOuter(0.1);

  const x1 = d3.scaleBand()
    .domain(SERIES.map(s => s.key))
    .range([0, x0.bandwidth()])
    .padding(0.1);

  const maxLeftRaw = d3.max(data, d => d3.max(SERIES, s => d[s.key]));
  const maxLeft = Math.ceil(maxLeftRaw / 100) * 100;

  const yLeft = d3.scaleLinear()
    .domain([0, maxLeft])
    .range([innerHeight, 0]);

  const minDT = d3.min(data, d => d.diensttage);
  const maxDT = d3.max(data, d => d.diensttage);
  const dtRange = Math.max(maxDT - minDT, 1);

  const yRight = d3.scaleLinear()
    .domain([minDT - dtRange * 0.55, maxDT + dtRange * 0.3])
    .nice()
    .range([innerHeight, 0]);

  return { x0, x1, yLeft, yRight, maxLeft };
}

// ============================================================
// Axes
// ============================================================

// --- Axe gauche (grille + graduations) ---
function drawLeftAxis(g, scales, innerWidth, innerHeight, isMobile) {
  const { yLeft, maxLeft } = scales;
  const leftTicks = d3.range(0, maxLeft + 1, 100);

  g.append("g")
    .attr("class", "grid")
    .selectAll("line")
    .data(leftTicks)
    .enter()
    .append("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", d => yLeft(d))
    .attr("y2", d => yLeft(d))
    .attr("stroke", "#e5e5e5")
    .attr("stroke-width", 1);

  g.append("g")
    .call(
      d3.axisLeft(yLeft)
        .tickValues(leftTicks)
        .tickSize(0)
        .tickFormat(d => formatSwiss(d))
    )
    .call(axisG => axisG.select(".domain").remove())
    .selectAll("text")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10.5px" : "12.5px")
    .style("fill", "#555");
}

// --- Axe droit ---
function drawRightAxis(g, scales, innerWidth, isMobile) {
  const { yRight } = scales;

  g.append("g")
    .attr("transform", `translate(${innerWidth}, 0)`)
    .call(
      d3.axisRight(yRight)
        .ticks(7)
        .tickSize(0)
        .tickFormat(d => (d / 1e6).toFixed(2))
    )
    .call(axisG => axisG.select(".domain").remove())
    .selectAll("text")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10.5px" : "12.5px")
    .style("fill", "#555");
}

// --- Titres d'axes, une seule ligne dans la langue courante, rotation -90° ---
function drawAxisTitle(g, x, text, innerHeight, isMobile) {
  g.append("text")
    .attr("transform", `translate(${x}, ${innerHeight / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10.5px" : "12.5px")
    .style("fill", "#555")
    .text(text);
}

// ============================================================
// Ligne des jours de service
// ============================================================

// --- Ligne des jours de service (axe droit), tracé progressif ---
function drawServiceLine(g, data, scales) {
  const { x0, yRight } = scales;

  const lineGen = d3.line()
    .x(d => x0(d.year) + x0.bandwidth() / 2)
    .y(d => yRight(d.diensttage))
    .curve(d3.curveMonotoneX);

  const path = g.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", LINE_COLOR)
    .attr("stroke-width", 3)
    .attr("d", lineGen);

  const totalLength = path.node().getTotalLength();
  path
    .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
    .attr("stroke-dashoffset", totalLength)
    .transition()
    .delay(300)
    .duration(1100)
    .ease(d3.easeCubicOut)
    .attr("stroke-dashoffset", 0);
}

// ============================================================
// Barres
// ============================================================

// --- Largeur du plus grand nombre affiché, pour savoir si les étiquettes tiennent ---
function measureMaxValueWidth(svg, data, fontSize) {
  const probe = svg.append("text")
    .style("font-family", "Arial")
    .style("font-size", fontSize)
    .style("visibility", "hidden");
  let maxW = 0;
  data.forEach(d => SERIES.forEach(s => {
    probe.text(formatSwiss(d[s.key]));
    maxW = Math.max(maxW, probe.node().getComputedTextLength());
  }));
  probe.remove();
  return maxW;
}

// --- Barres groupées avec animation d'apparition ---
// compact = les 5 valeurs d'une année ne tiennent pas côte à côte : seule la
// valeur Total reste affichée, le détail passe dans l'infobulle au survol.
function drawBars(g, data, scales, innerHeight, isMobile, compact) {
  const { x0, x1, yLeft } = scales;

  const groups = g.selectAll("g.year-group")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "year-group")
    .attr("transform", d => `translate(${x0(d.year)}, 0)`);

  SERIES.forEach((s, si) => {

    const bars = groups.append("rect")
      .attr("class", `bar bar-${s.key}`)
      .attr("x", x1(s.key))
      .attr("width", x1.bandwidth())
      .attr("y", innerHeight)
      .attr("height", 0)
      .attr("fill", s.color);

    bars.transition()
      .delay((d, i) => i * 90 + si * 40)
      .duration(650)
      .ease(d3.easeCubicOut)
      .attr("y", d => yLeft(d[s.key]))
      .attr("height", d => innerHeight - yLeft(d[s.key]));

    if (compact && s.key !== "Total") return;

    // Valeur principale, en gras, compteur animé
    const mainLabel = groups.append("text")
      .attr("class", `value-main value-${s.key}`)
      .attr("x", x1(s.key) + x1.bandwidth() / 2)
      .attr("y", d => yLeft(d[s.key]) - 11)
      .attr("text-anchor", "middle")
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "10.5px" : "11.5px")
      .style("font-weight", "normal")
      .style("fill", "#111")
      .style("paint-order", "stroke")
      .style("stroke", "#fff")
      .style("stroke-width", "3px")
      .style("stroke-linejoin", "round")
      .text("0");

    mainLabel.transition()
      .delay((d, i) => i * 90 + si * 40)
      .duration(650)
      .ease(d3.easeCubicOut)
      .tween("text", function (d) {
        const iVal = d3.interpolateNumber(0, d[s.key]);
        return t => { this.textContent = formatSwiss(iVal(t)); };
      });

    // Valeur interne entre parenthèses : masquée par défaut, révélée
    // uniquement au survol de son année (cf. attachHoverInteraction).
    // En mode compact, elle est dans l'infobulle.
    if (compact) return;
    groups.append("text")
      .attr("class", `value-intern value-${s.key}`)
      .attr("x", x1(s.key) + x1.bandwidth() / 2)
      .attr("y", d => yLeft(d[s.key]) - 4)
      .attr("text-anchor", "middle")
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "10px" : "10.5px")
      .style("fill", "#888")
      .style("paint-order", "stroke")
      .style("stroke", "#fff")
      .style("stroke-width", "3px")
      .style("stroke-linejoin", "round")
      .style("opacity", 0)
      .text(d => `(${formatSwiss(d[s.internKey])})`);
  });
}

// ============================================================
// Interaction
// ============================================================

// --- Survol par année : isole le groupe, pastille sur la ligne ---
function attachHoverInteraction(g, data, scales, innerHeight, margin, compact) {
  const { x0, yRight } = scales;
  const tooltip = compact ? createTooltip() : null;

  const hoverDot = g.append("circle")
    .attr("r", 5)
    .attr("fill", LINE_COLOR)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .style("opacity", 0)
    .style("pointer-events", "none");

  function highlight(year) {
    g.selectAll(".year-group").transition().duration(150)
      .style("opacity", d => (year === null || d.year === year) ? 1 : 0.3);

    g.selectAll(".value-intern").transition().duration(150)
      .style("opacity", d => (year !== null && d.year === year) ? 1 : 0);

    if (year === null) {
      hoverDot.style("opacity", 0);
      if (tooltip) tooltip.style("opacity", 0);
    } else {
      const d = data.find(dd => dd.year === year);
      hoverDot
        .attr("cx", x0(year) + x0.bandwidth() / 2)
        .attr("cy", yRight(d.diensttage))
        .style("opacity", 1);
      if (tooltip) showTooltip(tooltip, d, x0(year) + x0.bandwidth() / 2 + margin.left);
    }
  }

  g.selectAll("rect.hit")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "hit")
    .attr("x", d => x0(d.year))
    .attr("y", 0)
    .attr("width", x0.bandwidth())
    .attr("height", innerHeight + margin.bottom)
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => highlight(d.year))
    .on("mouseout", () => highlight(null));
}

// --- Infobulle du mode compact : les 5 valeurs (+ internes) et les jours de service ---
function createTooltip() {
  return d3.select("#chart").append("div")
    .attr("class", "rd-tooltip")
    .style("position", "absolute")
    .style("top", "0px")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("background", "#fff")
    .style("border", "1px solid #ddd")
    .style("border-radius", "4px")
    .style("box-shadow", "0 2px 6px rgba(0,0,0,0.12)")
    .style("padding", "6px 8px")
    .style("font-family", "Arial")
    .style("font-size", "11px")
    .style("line-height", "1.45")
    .style("color", "#111")
    .style("white-space", "nowrap");
}

function showTooltip(tooltip, d, centerX) {
  const swatch = c => `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;background:${c}"></span>`;
  const rows = SERIES.map(s =>
    `<div>${swatch(s.color)}${formatSwiss(d[s.key])} <span style="color:#888">(${formatSwiss(d[s.internKey])})</span></div>`
  ).join("");
  const line = `<div><span style="display:inline-block;width:10px;border-top:2px solid ${LINE_COLOR};margin-right:4px;vertical-align:middle"></span>${(d.diensttage / 1e6).toFixed(2)}</div>`;
  tooltip.html(`<div style="font-weight:bold;margin-bottom:2px">${d.year}</div>${rows}${line}`)
    .style("opacity", 1);

  // Placée à droite de l'année survolée, ou à gauche si elle déborderait.
  const chartW = document.getElementById("chart").clientWidth;
  const tipW = tooltip.node().offsetWidth;
  let left = centerX + 14;
  if (left + tipW > chartW) left = centerX - 14 - tipW;
  tooltip.style("left", `${Math.max(0, left)}px`);
}

// ============================================================
// Légende
// ============================================================

// --- Légende HTML, une ligne par série dans la langue courante ---
function drawLegend() {
  const legend = d3.select("#legend");

  function appendLegendText(container, text) {
    container.append("div").attr("class", "legend-text").text(text);
  }

  SERIES.forEach(s => {
    const item = legend.append("div").attr("class", "legend-item");
    item.append("span").attr("class", "legend-swatch").style("background", s.color);
    appendLegendText(item, s.labelLookup[currentLang]);
  });

  const lineItem = legend.append("div").attr("class", "legend-item");
  lineItem.append("span").attr("class", "legend-line");
  appendLegendText(lineItem, LINE_LABEL_LOOKUP[currentLang]);
}

// ============================================================
// Orchestration
// ============================================================

function drawChart() {

  d3.select("#chart").selectAll("*").remove();
  d3.select("#legend").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const isMobile = containerWidth < 600;

  d3.csv("RD_2025.csv").then(raw => {

    const data = raw.map(d => {
      const row = { year: +d.Jahr, diensttage: +d.Diensttage };
      SERIES.forEach(s => {
        row[s.key] = +d[s.key];
        row[s.internKey] = +d[s.internKey];
      });
      return row;
    }).sort((a, b) => a.year - b.year);

    const margin = {
      top: 20,
      right: isMobile ? 56 : 78,
      bottom: 28,
      left: isMobile ? 60 : 84
    };

    // Les 6 années tiennent toujours dans la largeur disponible (plus de scroll horizontal).
    const innerWidth = containerWidth - margin.left - margin.right;
    const width = containerWidth;

    const innerHeight = isMobile ? 210 : 260;
    const height = margin.top + innerHeight + margin.bottom;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const scales = createScales(data, innerWidth, innerHeight);

    // Mode compact si les nombres de deux barres voisines se toucheraient.
    const valueFontSize = isMobile ? "10.5px" : "11.5px";
    const compact = scales.x1.step() < measureMaxValueWidth(svg, data, valueFontSize) + 1;

    drawLeftAxis(g, scales, innerWidth, innerHeight, isMobile);
    drawRightAxis(g, scales, innerWidth, isMobile);

    drawAxisTitle(g, -(margin.left - (isMobile ? 14 : 18)), AXIS_LEFT_LABEL_LOOKUP[currentLang], innerHeight, isMobile);
    drawAxisTitle(g, innerWidth + (margin.right - (isMobile ? 14 : 18)), AXIS_RIGHT_LABEL_LOOKUP[currentLang], innerHeight, isMobile);

    drawServiceLine(g, data, scales);
    drawBars(g, data, scales, innerHeight, isMobile, compact);

    // --- Années sous les groupes ---
    g.selectAll("text.year-label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "year-label")
      .attr("x", d => scales.x0(d.year) + scales.x0.bandwidth() / 2)
      .attr("y", innerHeight + 24)
      .attr("text-anchor", "middle")
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "11.5px" : "13.5px")
      .style("fill", "#111")
      .text(d => d.year);

    attachHoverInteraction(g, data, scales, innerHeight, margin, compact);

    drawLegend();
  });
}
