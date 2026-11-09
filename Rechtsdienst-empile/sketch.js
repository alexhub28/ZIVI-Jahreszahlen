// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "Disziplinarentscheide",
  fr: "Décisions disciplinaires",
  it: "Decisioni disciplinari"
};

// STACK_SERIES = les 2 categories empilees dans la colonne "combo"
// (leur somme = "Total" du graphique groupe). Un seul petrol : 100%
// pour Art. 76, 50% pour Art. 73/74 (comme "Inspections contraste").
const BASE_COLOR = "#5A959D";   // petrol, teinte unique de la colonne empilee
const STROKE_COLOR = "#46747A"; // petrol plus soutenu, contour des badges

const STACK_SERIES = [
  {
    key: "Art73_74",
    internKey: "Art73_74_Intern",
    color: BASE_COLOR,
    opacity: 0.5,
    labelLookup: {
      de: "Disziplinarentscheide wegen Art. 73 oder 74 ZDG",
      fr: "Décisions disciplinaires pour infraction à l'art. 73 ou 74 LSC",
      it: "Decisioni disciplinari causa articoli 73 o 74 LSC"
    }
  },
  {
    key: "Art76",
    internKey: "Art76_Intern",
    color: BASE_COLOR,
    opacity: 1,
    labelLookup: {
      de: "Disziplinarentscheide wegen Art. 76 ZDV",
      fr: "Décisions disciplinaires pour infraction à l'art. 76 LSC",
      it: "Decisioni disciplinari causa articolo 76 OSCi"
    }
  }
];

const SOLO_SERIES = [
  {
    key: "Strafanzeigen",
    internKey: "Strafanzeigen_Intern",
    color: "#A3A8CA", // lila
    opacity: 1,
    labelLookup: {
      de: "Strafanzeigen",
      fr: "Plaintes pénales",
      it: "Denuncia penale"
    }
  },
  {
    key: "Strafbefehle",
    internKey: "Strafbefehle_Intern",
    color: "#FCEB30", // jaune (Limonengelb) - anciennement mint, peu lisible à côté du petrol 50 %
    opacity: 1,
    labelLookup: {
      de: "Strafbefehle wegen Zivildienstverweigerung",
      fr: "Ordonnances pénales pour refus de servir",
      it: "Decreti penali causa Omissione del servizi"
    }
  }
];

// Ordre d'affichage de la legende.
// Même ordre que les colonnes : colonne empilée (Art. 73/74, Art. 76), puis Strafanzeigen, Strafbefehle.
const LEGEND_ORDER = ["Art73_74", "Art76", "Strafanzeigen", "Strafbefehle"];
const ALL_SERIES = [...STACK_SERIES, ...SOLO_SERIES];
const SERIES_BY_KEY = Object.fromEntries(ALL_SERIES.map(s => [s.key, s]));

// Les 3 colonnes par annee : "combo" (empilee) puis 2 colonnes simples.
const GROUPS = ["combo", "Strafanzeigen", "Strafbefehle"];

// Memes libelles que le graphique groupe d'origine.
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

// Reprise du graphique groupe, en Rouge Bund pour rester distincte
// des couleurs des colonnes.
const LINE_COLOR = "#FF0000"; // Rouge Bund (signal)
const LINE_LABEL_LOOKUP = {
  de: "Anrechenbare Diensttage",
  fr: "Jours de service pris en compte",
  it: "Giorni di servizio computabili"
};

const DATA_FILE = "RD_2025.csv";
const MOBILE_BREAKPOINT = 600;
const Y_AXIS_HEADROOM = 1.12;
const MIN_INSIDE_LABEL_HEIGHT = 34; // en dessous, l'etiquette (2 lignes) sort du segment
const SEGMENT_DURATION = 650;

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
// Data
// ============================================================

function parseData(raw) {
  return raw
    .map(d => {
      const row = { year: d["Jahr"], diensttage: +d["Diensttage"] };
      ALL_SERIES.forEach(s => {
        row[s.key] = +d[s.key];
        row[s.internKey] = +d[s.internKey];
      });
      row.comboTotal = d3.sum(STACK_SERIES, s => row[s.key]);
      row.comboIntern = d3.sum(STACK_SERIES, s => row[s.internKey]);
      return row;
    })
    .sort((a, b) => a.year - b.year);
}

// Formatage suisse : 1'163
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

// ============================================================
// Layout & scales
// ============================================================

function computeLayout(containerWidth, isMobile) {
  const margin = {
    top: 20,
    right: isMobile ? 56 : 78, // place pour l'axe droit (Diensttage) + son titre
    bottom: 40,
    left: isMobile ? 60 : 84
  };

  const innerWidth = containerWidth - margin.left - margin.right;
  const innerHeight = isMobile ? 220 : 264; // tient sous 500px (cadre LivingDocs) aux deux largeurs
  const width = containerWidth;
  const height = margin.top + innerHeight + margin.bottom;

  return { margin, innerWidth, innerHeight, width, height };
}

function createScales(data, layout) {
  // Echelle gauche commune aux 3 colonnes, arrondie a la centaine
  // superieure pour des graduations de grille propres.
  const maxAny = d3.max(data, d => Math.max(d.comboTotal, d.Strafanzeigen, d.Strafbefehle));
  const domainTop = Math.ceil((maxAny * Y_AXIS_HEADROOM) / 100) * 100;

  const x0 = d3.scaleBand()
    .domain(data.map(d => d.year))
    .range([0, layout.innerWidth])
    .paddingInner(0.35)
    .paddingOuter(0.15);

  const x1 = d3.scaleBand()
    .domain(GROUPS)
    .range([0, x0.bandwidth()])
    .padding(0.16);

  const y = d3.scaleLinear()
    .domain([0, domainTop])
    .range([layout.innerHeight, 0]);

  // Echelle droite (Diensttage), meme construction que le graphique
  // groupe d'origine.
  const minDT = d3.min(data, d => d.diensttage);
  const maxDT = d3.max(data, d => d.diensttage);
  const dtRange = Math.max(maxDT - minDT, 1);

  const yRight = d3.scaleLinear()
    .domain([minDT - dtRange * 0.55, maxDT + dtRange * 0.3])
    .nice()
    .range([layout.innerHeight, 0]);

  // Empilement de la colonne "combo" (Art73_74 + Art76).
  const stack = d3.stack().keys(STACK_SERIES.map(s => s.key));
  const stackedSeries = stack(data);

  return { x0, x1, y, yRight, stackedSeries, domainTop };
}

// ============================================================
// Grille & axes (repris du graphique groupe Rechtsdienst)
// ============================================================

function drawGridAndAxis(g, scales, layout, isMobile) {
  const { y, domainTop } = scales;
  const ticks = d3.range(0, domainTop + 1, 100);

  g.append("g")
    .attr("class", "grid")
    .selectAll("line")
    .data(ticks)
    .enter()
    .append("line")
    .attr("x1", 0)
    .attr("x2", layout.innerWidth)
    .attr("y1", d => y(d))
    .attr("y2", d => y(d))
    .attr("stroke", "#e5e5e5")
    .attr("stroke-width", 1);

  g.append("g")
    .call(
      d3.axisLeft(y)
        .tickValues(ticks)
        .tickSize(0)
        .tickFormat(d => formatSwiss(d))
    )
    .call(axisG => axisG.select(".domain").remove())
    .selectAll("text")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10.5px" : "12.5px")
    .style("fill", "#555");
}

function drawRightAxis(g, scales, layout, isMobile) {
  const { yRight } = scales;

  g.append("g")
    .attr("transform", `translate(${layout.innerWidth}, 0)`)
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

// --- Titre d'axe, une seule ligne dans la langue courante, rotation -90° ---
function drawAxisTitle(g, x, text, layout, isMobile) {
  g.append("text")
    .attr("transform", `translate(${x}, ${layout.innerHeight / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "10.5px" : "12.5px")
    .style("fill", "#555")
    .text(text);
}

// ============================================================
// Ligne des jours de service (reprise du graphique groupe d'origine)
// ============================================================

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
// Légende (HTML sous le graphique, mêmes classes que Rechtsdienst)
// ============================================================

function drawLegend() {
  const legend = d3.select("#legend");

  LEGEND_ORDER.forEach(key => {
    const s = SERIES_BY_KEY[key];
    const item = legend.append("div").attr("class", "legend-item");
    item.append("span")
      .attr("class", "legend-swatch")
      .style("background", s.color)
      .style("opacity", s.opacity);
    item.append("div").attr("class", "legend-text").text(s.labelLookup[currentLang]);
  });

  const lineItem = legend.append("div").attr("class", "legend-item");
  lineItem.append("span").attr("class", "legend-line");
  lineItem.append("div").attr("class", "legend-text").text(LINE_LABEL_LOOKUP[currentLang]);
}

// ============================================================
// Colonnes (groupées par année, la première empilée)
// ============================================================

// compact = les valeurs de deux colonnes voisines se toucheraient (écran
// étroit) : seul le total de la colonne empilée reste affiché, le détail
// passe dans l'infobulle au survol.
function drawColumns(g, data, scales, layout, isMobile, compact) {
  const { x0, x1, y, stackedSeries } = scales;

  drawComboSegments(g, data, scales, layout);

  SOLO_SERIES.forEach(s => drawSoloBars(g, data, scales, layout, isMobile, s, compact));

  data.forEach((d, i) => {
    if (!compact) drawComboSegmentLabels(g, d, i, scales, isMobile);
    drawComboTotalLabel(g, d, i, scales, layout, isMobile);
    drawYearLabel(g, d, x0, layout, isMobile);
  });
}

// --- Colonne empilée (Art73_74 + Art76) ---
function drawComboSegments(g, data, scales, layout) {
  const { x0, x1, y, stackedSeries } = scales;
  const comboX = x1("combo");

  stackedSeries.forEach((layer, si) => {
    const s = STACK_SERIES[si];

    g.selectAll(`rect.seg-${s.key}`)
      .data(layer)
      .enter()
      .append("rect")
      .attr("class", `bar seg-${s.key}`)
      .attr("x", d => x0(d.data.year) + comboX)
      .attr("width", x1.bandwidth())
      .attr("y", layout.innerHeight)
      .attr("height", 0)
      .attr("fill", s.color)
      .attr("fill-opacity", s.opacity)
      .transition()
      .delay((d, i) => i * 90 + si * 60)
      .duration(SEGMENT_DURATION)
      .ease(d3.easeCubicOut)
      .attr("y", d => y(d[1]))
      .attr("height", d => y(d[0]) - y(d[1]));
  });
}

// --- Colonnes simples (Strafanzeigen, Strafbefehle) ---
function drawSoloBars(g, data, scales, layout, isMobile, s, compact) {
  const { x0, x1, y } = scales;
  const groupX = x1(s.key);

  g.selectAll(`rect.solo-${s.key}`)
    .data(data)
    .enter()
    .append("rect")
    .attr("class", `bar solo-${s.key}`)
    .attr("x", d => x0(d.year) + groupX)
    .attr("width", x1.bandwidth())
    .attr("y", layout.innerHeight)
    .attr("height", 0)
    .attr("fill", s.color)
    .attr("fill-opacity", s.opacity)
    .transition()
    .delay((d, i) => i * 90)
    .duration(SEGMENT_DURATION)
    .ease(d3.easeCubicOut)
    .attr("y", d => y(d[s.key]))
    .attr("height", d => layout.innerHeight - y(d[s.key]));

  // Valeur + valeur interne entre parentheses au-dessus de la barre
  // (dans l'infobulle en mode compact).
  if (compact) return;
  data.forEach((d, i) => {
    const cx = x0(d.year) + groupX + x1.bandwidth() / 2;
    const delay = i * 90 + SEGMENT_DURATION + 100;
    drawValuePair(g, d, cx, y(d[s.key]), formatSwiss(d[s.key]), formatSwiss(d[s.internKey]), delay, isMobile);
  });
}

// Valeur principale + valeur interne entre parentheses, au-dessus
// du sommet de la barre.
function drawValuePair(g, d, cx, yBarTop, mainText, internText, delay, isMobile) {
  const mainLabel = g.append("text")
    .attr("class", "value total")
    .datum(d)
    .attr("x", cx)
    .attr("y", yBarTop - 20)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "11px" : "12.5px")
    .style("font-weight", "normal")
    .style("fill", "#111")
    .style("opacity", 0)
    .text(mainText);

  mainLabel.transition()
    .delay(delay)
    .duration(300)
    .style("opacity", 1);

  // Valeur entre parenthèses : masquée par défaut, révélée uniquement
  // au survol de son année (cf. highlightColumn).
  g.append("text")
    .attr("class", "value-intern total")
    .datum(d)
    .attr("x", cx)
    .attr("y", yBarTop - 8)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "9.5px" : "10.5px")
    .style("fill", "#888")
    .style("opacity", 0)
    .text(`(${internText})`);
}

// Badge petrol opaque derriere le texte quand le segment est trop
// bas (cf. "Inspections contraste").
function drawLabelBadge(container, text, cx, cy, fontSize) {
  const digitWidth = fontSize * 0.62;
  const badgeWidth = text.length * digitWidth + 10;
  const badgeHeight = fontSize + 8;

  container.append("rect")
    .attr("x", cx - badgeWidth / 2)
    .attr("y", cy - badgeHeight / 2)
    .attr("width", badgeWidth)
    .attr("height", badgeHeight)
    .attr("rx", 3)
    .attr("fill", BASE_COLOR)
    .attr("stroke", STROKE_COLOR)
    .attr("stroke-width", 1);
}

// Valeur par segment (Art. 73/74, Art. 76), toujours visible, se
// dimme (sans disparaitre) au survol d'une autre annee.
function drawComboSegmentLabels(g, d, i, scales, isMobile) {
  const { x0, x1, y, stackedSeries } = scales;
  const comboX = x0(d.year) + x1("combo");
  const barW = x1.bandwidth();
  const fontSize = isMobile ? 10 : 11.5;
  const labelX = comboX + barW / 2;

  stackedSeries.forEach((layer, si) => {
    const s = STACK_SERIES[si];
    const point = layer[i]; // [y0, y1] de cette annee, meme index que data
    const segTop = y(point[1]);
    const segBottom = y(point[0]);
    const segHeight = segBottom - segTop;
    const inside = segHeight > MIN_INSIDE_LABEL_HEIGHT;
    const labelY = (segTop + segBottom) / 2;
    const mainText = formatSwiss(d[s.key]);
    const internText = `(${formatSwiss(d[s.internKey])})`;
    const delay = i * 90 + si * 60 + SEGMENT_DURATION + 100;

    // Texte blanc sur fond sombre (Art76 a 100%, ou badge) pour rester
    // lisible ; noir/gris sinon.
    const onDarkBg = !inside || s.opacity >= 0.9;
    const mainColor = onDarkBg ? "#ffffff" : "#111";
    const internColor = onDarkBg ? "#d7e6e8" : "#888";

    const group = g.append("g")
      .attr("class", `segval seg-${s.key}`)
      .style("opacity", 0)
      .datum(d);

    group.transition()
      .delay(delay)
      .duration(300)
      .style("opacity", 1);

    if (!inside) {
      drawLabelBadge(group, mainText.length >= internText.length ? mainText : internText, labelX, labelY, fontSize);
    }

    group.append("text")
      .attr("x", labelX)
      .attr("y", labelY - 6)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-family", "Arial")
      .style("font-size", fontSize + "px")
      .style("font-weight", "normal")
      .style("fill", mainColor)
      .text(mainText);

    // Masquée par défaut, révélée uniquement au survol de son année.
    group.append("text")
      .attr("class", "segval-intern")
      .attr("x", labelX)
      .attr("y", labelY + 8)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-family", "Arial")
      .style("font-size", (fontSize - 1.5) + "px")
      .style("fill", internColor)
      .style("opacity", 0)
      .text(internText);
  });
}

// Total de la colonne empilee (= "Total" du graphique groupe d'origine).
function drawComboTotalLabel(g, d, i, scales, layout, isMobile) {
  const { x0, x1, y } = scales;
  const comboX = x0(d.year) + x1("combo");
  const barW = x1.bandwidth();
  const yTop = y(d.comboTotal);
  const delay = i * 90 + (STACK_SERIES.length - 1) * 60 + SEGMENT_DURATION + 100;

  drawValuePair(g, d, comboX + barW / 2, yTop, formatSwiss(d.comboTotal), formatSwiss(d.comboIntern), delay, isMobile);
}

function drawYearLabel(g, d, x0, layout, isMobile) {
  const barX = x0(d.year);
  const barW = x0.bandwidth();

  g.append("text")
    .attr("class", "label")
    .datum(d)
    .attr("x", barX + barW / 2)
    .attr("y", layout.innerHeight + 22)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "11.5px" : "13.5px")
    .style("fill", "#111")
    .text(d.year);
}

// ============================================================
// Interaction
// ============================================================

// Zone de survol par annee : isole l'annee et affiche la pastille
// sur la ligne des jours de service.
function attachHoverArea(g, data, scales, layout, compact) {
  const { x0, yRight } = scales;
  const tooltip = compact ? createTooltip() : null;

  const hoverDot = g.append("circle")
    .attr("class", "hover-dot")
    .attr("r", 5)
    .attr("fill", LINE_COLOR)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .style("opacity", 0)
    .style("pointer-events", "none");

  data.forEach(d => {
    g.append("rect")
      .attr("class", "hit")
      .datum(d)
      .attr("x", x0(d.year))
      .attr("y", 0)
      .attr("width", x0.bandwidth())
      .attr("height", layout.innerHeight + layout.margin.bottom)
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("mouseover", () => {
        highlightColumn(g, d.year, hoverDot, data, scales);
        if (tooltip) showTooltip(tooltip, d, x0(d.year) + x0.bandwidth() / 2 + layout.margin.left);
      })
      .on("mouseout", () => {
        highlightColumn(g, null, hoverDot, data, scales);
        if (tooltip) tooltip.style("opacity", 0);
      });
  });
}

// --- Infobulle du mode compact : valeurs (+ internes) de chaque série et jours de service ---
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
  const swatch = s => `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;background:${s.color};opacity:${s.opacity}"></span>`;
  const rows = [...STACK_SERIES, ...SOLO_SERIES].map(s =>
    `<div>${swatch(s)}${formatSwiss(d[s.key])} <span style="color:#888">(${formatSwiss(d[s.internKey])})</span></div>`
  ).join("");
  const line = `<div><span style="display:inline-block;width:10px;border-top:2px solid ${LINE_COLOR};margin-right:4px;vertical-align:middle"></span>${(d.diensttage / 1e6).toFixed(2)}</div>`;
  tooltip.html(`<div style="font-weight:bold;margin-bottom:2px">${d.year}</div>${rows}${line}`)
    .style("opacity", 1);

  // À droite de l'année survolée, ou à gauche si elle déborderait.
  const chartW = document.getElementById("chart").clientWidth;
  const tipW = tooltip.node().offsetWidth;
  let left = centerX + 14;
  if (left + tipW > chartW) left = centerX - 14 - tipW;
  tooltip.style("left", `${Math.max(0, left)}px`);
}

// --- Largeur du plus grand nombre affiché au-dessus des colonnes ---
function measureMaxValueWidth(svg, data, fontSize) {
  const probe = svg.append("text")
    .style("font-family", "Arial")
    .style("font-size", fontSize)
    .style("visibility", "hidden");
  let maxW = 0;
  data.forEach(d => ["comboTotal", ...SOLO_SERIES.map(s => s.key)].forEach(k => {
    probe.text(formatSwiss(d[k]));
    maxW = Math.max(maxW, probe.node().getComputedTextLength());
  }));
  probe.remove();
  return maxW;
}

function highlightColumn(g, year, hoverDot, data, scales) {
  g.selectAll(".bar")
    .transition()
    .duration(150)
    .style("opacity", function () {
      const d = d3.select(this).datum();
      const rowYear = d && d.data ? d.data.year : (d && d.year);
      return (year === null || rowYear === year) ? 1 : 0.3;
    });

  g.selectAll("text.total")
    .transition()
    .duration(150)
    .style("opacity", function () {
      const sel = d3.select(this);
      const d = sel.datum();
      if (sel.classed("value-intern")) {
        return (year !== null && d && d.year === year) ? 1 : 0;
      }
      return (year === null || (d && d.year === year)) ? 1 : 0.3;
    });

  g.selectAll(".segval-intern")
    .transition()
    .duration(150)
    .style("opacity", function () {
      const d = d3.select(this).datum();
      return (year !== null && d && d.year === year) ? 1 : 0;
    });

  g.selectAll("text.label")
    .transition()
    .duration(150)
    .style("opacity", function () {
      const d = d3.select(this).datum();
      return (year === null || (d && d.year === year)) ? 1 : 0.3;
    });

  g.selectAll(".segval")
    .transition()
    .duration(150)
    .style("opacity", function () {
      const d = d3.select(this).datum();
      return (year === null || (d && d.year === year)) ? 1 : 0.3;
    });

  if (year === null) {
    hoverDot.style("opacity", 0);
  } else {
    const { x0, yRight } = scales;
    const d = data.find(dd => dd.year === year);
    hoverDot
      .attr("cx", x0(year) + x0.bandwidth() / 2)
      .attr("cy", yRight(d.diensttage))
      .style("opacity", 1);
  }
}

// ============================================================
// Orchestration
// ============================================================

function drawChart() {
  d3.select("#chart").selectAll("*").remove();
  d3.select("#legend").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const isMobile = containerWidth < MOBILE_BREAKPOINT;

  d3.csv(DATA_FILE).then(raw => {
    const data = parseData(raw);
    const layout = computeLayout(containerWidth, isMobile);
    const scales = createScales(data, layout);

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", layout.width)
      .attr("height", layout.height);

    const g = svg.append("g")
      .attr("transform", `translate(${layout.margin.left}, ${layout.margin.top})`);

    drawGridAndAxis(g, scales, layout, isMobile);
    drawRightAxis(g, scales, layout, isMobile);
    drawAxisTitle(g, -(layout.margin.left - (isMobile ? 14 : 18)), AXIS_LEFT_LABEL_LOOKUP[currentLang], layout, isMobile);
    drawAxisTitle(g, layout.innerWidth + (layout.margin.right - (isMobile ? 14 : 18)), AXIS_RIGHT_LABEL_LOOKUP[currentLang], layout, isMobile);

    // Ligne avant barres (ordre voulu, comme le graphique groupe)
    // pour que les colonnes restent au premier plan.
    drawServiceLine(g, data, scales);
    const compact = scales.x1.step() < measureMaxValueWidth(svg, data, isMobile ? "11px" : "12.5px") + 1;
    drawColumns(g, data, scales, layout, isMobile, compact);
    attachHoverArea(g, data, scales, layout, compact);

    drawLegend();
  });
}

// ============================================================
// Entry point
// ============================================================

function init() {
  const params = getURLParams();
  currentLang = params.lang || currentLang;

  d3.select("#titleContainer").text(titleLookup[currentLang]);

  drawChart();
}

// Charge sans "defer" : le DOM n'existe pas encore a l'execution,
// donc on attend DOMContentLoaded plutot que d'appeler init() ici.
document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", drawChart);
