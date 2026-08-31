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

// Couleurs institutionnelles — ici chaque teinte identifie une
// catégorie de décision (comme pour DT nach DT bereich), et non une
// intensité de valeur : pas de dégradé, une couleur fixe par série.
// Le petrol est réservé aux jours de service (Diensttage), comme dans
// DT geleistet — donc le Total prend le slate dk2 pour ne pas entrer
// en collision avec la ligne petrol ci-dessous.
const SERIES = [
  {
    key: "Total",
    internKey: "Total_Intern",
    labelLookup: {
      de: "Total Disziplinarentscheide",
      fr: "Total des décisions disciplinaires",
      it: "Totale decisioni disciplinari"
    },
    color: "#9f9690" // Grauton 1 (charte) — Total = agrégat, distinct des 4 séries + de la ligne petrol
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
    color: "#A3A8CA" // lila
  },
  {
    key: "Strafanzeigen",
    internKey: "Strafanzeigen_Intern",
    labelLookup: {
      de: "Strafanzeigen",
      fr: "Plaintes pénales",
      it: "Denuncia penale"
    },
    color: "#B1B488" // kiwi
  },
  {
    key: "Strafbefehle",
    internKey: "Strafbefehle_Intern",
    labelLookup: {
      de: "Strafbefehle wegen Zivildienstverweigerung",
      fr: "Ordonnances pénales pour refus de servir",
      it: "Decreti penali causa Omissione del servizi"
    },
    color: "#FCEB30" // jaune
  }
];

const LINE_COLOR = "#5A959D"; // petrol — Diensttage, comme DT geleistet
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
    .paddingInner(0.3)
    .paddingOuter(0.15);

  const x1 = d3.scaleBand()
    .domain(SERIES.map(s => s.key))
    .range([0, x0.bandwidth()])
    .padding(0.18);

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

// --- Repères horizontaux discrets (axe gauche) ---
// --- Axe gauche ---
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

// --- Barres groupées avec animation d'apparition ---
function drawBars(g, data, scales, innerHeight, isMobile) {
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

    // Valeur principale, en gras, compteur animé
    const mainLabel = groups.append("text")
      .attr("class", `value-main value-${s.key}`)
      .attr("x", x1(s.key) + x1.bandwidth() / 2)
      .attr("y", d => yLeft(d[s.key]) - 20)
      .attr("text-anchor", "middle")
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "10.5px" : "12.5px")
      .style("font-weight", "bold")
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

    // Valeur interne entre parenthèses, plus discrète
    groups.append("text")
      .attr("class", `value-intern value-${s.key}`)
      .attr("x", x1(s.key) + x1.bandwidth() / 2)
      .attr("y", d => yLeft(d[s.key]) - 8)
      .attr("text-anchor", "middle")
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "10px" : "11.5px")
      .style("fill", "#888")
      .style("paint-order", "stroke")
      .style("stroke", "#fff")
      .style("stroke-width", "3px")
      .style("stroke-linejoin", "round")
      .style("opacity", 0)
      .text(d => `(${formatSwiss(d[s.internKey])})`)
      .transition()
      .delay((d, i) => i * 90 + si * 40 + 500)
      .duration(300)
      .style("opacity", 1);
  });
}

// ============================================================
// Interaction
// ============================================================

// --- Pastille qui suit l'année survolée sur la ligne ---
// --- Survol par année : isolation du groupe ---
function attachHoverInteraction(g, data, scales, innerHeight, margin) {
  const { x0, yRight } = scales;

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

    if (year === null) {
      hoverDot.style("opacity", 0);
    } else {
      const d = data.find(dd => dd.year === year);
      hoverDot
        .attr("cx", x0(year) + x0.bandwidth() / 2)
        .attr("cy", yRight(d.diensttage))
        .style("opacity", 1);
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
      bottom: 40,
      left: isMobile ? 60 : 84
    };

    const containerInnerWidth = containerWidth - margin.left - margin.right;
    const minInnerWidth = data.length * (isMobile ? 130 : 170);
    const innerWidth = Math.max(containerInnerWidth, minInnerWidth);
    const width = innerWidth + margin.left + margin.right;

    const innerHeight = isMobile ? 380 : 480;
    const height = margin.top + innerHeight + margin.bottom;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const scales = createScales(data, innerWidth, innerHeight);

    drawLeftAxis(g, scales, innerWidth, innerHeight, isMobile);
    drawRightAxis(g, scales, innerWidth, isMobile);

    drawAxisTitle(g, -(margin.left - (isMobile ? 14 : 18)), AXIS_LEFT_LABEL_LOOKUP[currentLang], innerHeight, isMobile);
    drawAxisTitle(g, innerWidth + (margin.right - (isMobile ? 14 : 18)), AXIS_RIGHT_LABEL_LOOKUP[currentLang], innerHeight, isMobile);

    drawServiceLine(g, data, scales);
    drawBars(g, data, scales, innerHeight, isMobile);

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
      .style("font-weight", "bold")
      .style("fill", "#111")
      .text(d => d.year);

    attachHoverInteraction(g, data, scales, innerHeight, margin);

    drawLegend();
  });
}
