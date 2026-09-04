// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "Disziplinarentscheide (gestapelt)",
  fr: "Décisions disciplinaires (empilées)",
  it: "Decisioni disciplinari (impilate)"
};

// Le "Total Disziplinarentscheide" du graphique d'origine est la somme
// des deux categories ci-dessous (STACK_SERIES) - elles sont donc
// empilees en une seule colonne. Strafanzeigen et Strafbefehle sont des
// mesures a part (pas incluses dans ce total) : chacune garde sa propre
// colonne simple, a cote de la colonne empilee. Les 3 colonnes d'une
// meme annee sont groupees cote a cote (comme l'etaient les 5 barres du
// graphique d'origine), avec la meme echelle verticale pour rester
// comparables entre elles.
//
// Charte : plus de 2 categories -> Petrol, Lila, Mint, Kaki, une teinte
// fixe par categorie (4 categories pour les 4 teintes disponibles).
const STACK_SERIES = [
  {
    key: "Art73_74",
    color: "#A3A8CA", // lila
    labelLookup: {
      de: "Disziplinarentscheide wegen Art. 73 oder 74 ZDG",
      fr: "Décisions disciplinaires pour infraction à l'art. 73 ou 74 LSC",
      it: "Decisioni disciplinari causa articoli 73 o 74 LSC"
    }
  },
  {
    key: "Art76",
    color: "#B1B488", // kaki
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
    color: "#5A959D", // petrol
    labelLookup: {
      de: "Strafanzeigen",
      fr: "Plaintes pénales",
      it: "Denuncia penale"
    }
  },
  {
    key: "Strafbefehle",
    color: "#CAE7EA", // mint
    labelLookup: {
      de: "Strafbefehle wegen Zivildienstverweigerung",
      fr: "Ordonnances pénales pour refus de servir",
      it: "Decreti penali causa Omissione del servizi"
    }
  }
];

// Ordre d'affichage de la legende, tel que demande initialement.
const LEGEND_ORDER = ["Strafanzeigen", "Art73_74", "Strafbefehle", "Art76"];
const ALL_SERIES = [...STACK_SERIES, ...SOLO_SERIES];
const SERIES_BY_KEY = Object.fromEntries(ALL_SERIES.map(s => [s.key, s]));

// Les 3 colonnes groupees par annee : la colonne empilee ("combo") puis
// les deux colonnes simples.
const GROUPS = ["combo", "Strafanzeigen", "Strafbefehle"];

const DATA_FILE = "RD_2025.csv";
const MOBILE_BREAKPOINT = 600;
const Y_AXIS_HEADROOM = 1.12;
const MIN_INSIDE_LABEL_HEIGHT = 22; // en dessous, l'etiquette de segment sort du segment
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
      const row = { year: d["Jahr"] };
      ALL_SERIES.forEach(s => { row[s.key] = +d[s.key]; });
      row.comboTotal = d3.sum(STACK_SERIES, s => row[s.key]);
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
    right: isMobile ? 10 : 20,
    bottom: 24,
    left: isMobile ? 10 : 20
  };

  const innerWidth = containerWidth - margin.left - margin.right;
  const innerHeight = 320;
  const width = containerWidth;
  const height = margin.top + innerHeight + margin.bottom;

  return { margin, innerWidth, innerHeight, width, height };
}

function createScales(data, layout) {
  // Echelle verticale commune aux 3 colonnes d'une meme annee (et a
  // toutes les annees) : les hauteurs restent comparables entre la
  // colonne empilée et les deux colonnes simples.
  const maxAny = d3.max(data, d => Math.max(d.comboTotal, d.Strafanzeigen, d.Strafbefehle));

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
    .domain([0, maxAny * Y_AXIS_HEADROOM])
    .range([layout.innerHeight, 0]);

  // Empilement de la colonne "combo" uniquement (Art73_74 + Art76) :
  // une couche par categorie, chaque couche porte pour chaque annee un
  // couple [y0, y1] (bornes cumulees), meme index que data.
  const stack = d3.stack().keys(STACK_SERIES.map(s => s.key));
  const stackedSeries = stack(data);

  return { x0, x1, y, stackedSeries };
}

// ============================================================
// Légende (HTML, sous le graphique — mêmes classes que le graphique
// groupé Rechtsdienst).
// ============================================================

function drawLegend() {
  const legend = d3.select("#legend");

  LEGEND_ORDER.forEach(key => {
    const s = SERIES_BY_KEY[key];
    const item = legend.append("div").attr("class", "legend-item");
    item.append("span").attr("class", "legend-swatch").style("background", s.color);
    item.append("div").attr("class", "legend-text").text(s.labelLookup[currentLang]);
  });
}

// ============================================================
// Colonnes (groupées par année, la première empilée)
// ============================================================

function drawColumns(g, data, scales, layout, isMobile) {
  const { x0, x1, y, stackedSeries } = scales;

  drawComboSegments(g, data, scales, layout);

  SOLO_SERIES.forEach(s => drawSoloBars(g, data, scales, layout, isMobile, s));

  data.forEach((d, i) => {
    drawComboSegmentLabels(g, d, i, scales, isMobile);
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
      .transition()
      .delay((d, i) => i * 90 + si * 60)
      .duration(SEGMENT_DURATION)
      .ease(d3.easeCubicOut)
      .attr("y", d => y(d[1]))
      .attr("height", d => y(d[0]) - y(d[1]));
  });
}

// --- Colonnes simples (Strafanzeigen, Strafbefehle) ---
function drawSoloBars(g, data, scales, layout, isMobile, s) {
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
    .transition()
    .delay((d, i) => i * 90)
    .duration(SEGMENT_DURATION)
    .ease(d3.easeCubicOut)
    .attr("y", d => y(d[s.key]))
    .attr("height", d => layout.innerHeight - y(d[s.key]));

  // Valeur toujours visible au-dessus de la barre (colonne a une seule
  // valeur, pas de detail a reveler au survol).
  data.forEach((d, i) => {
    g.append("text")
      .attr("class", "value total")
      .datum(d)
      .attr("x", x0(d.year) + groupX + x1.bandwidth() / 2)
      .attr("y", y(d[s.key]) - 8)
      .attr("text-anchor", "middle")
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "11px" : "12.5px")
      .style("font-weight", "normal")
      .style("fill", "#111")
      .style("opacity", 0)
      .text(formatSwiss(d[s.key]))
      .transition()
      .delay(i * 90 + SEGMENT_DURATION + 100)
      .duration(300)
      .style("opacity", 1);
  });
}

// Valeur par segment de la colonne empilée, masquée par défaut,
// révélée au survol de l'année (cf. highlightColumn()). Quand un
// segment est trop bas pour porter le texte lisiblement, un petit
// badge de sa propre teinte (avec liseré blanc) est ajouté derrière.
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
    const text = formatSwiss(d[s.key]);

    const group = g.append("g")
      .attr("class", `segval seg-${s.key}`)
      .style("opacity", 0)
      .datum(d);

    if (!inside) {
      const digitWidth = fontSize * 0.62;
      const badgeWidth = text.length * digitWidth + 10;
      const badgeHeight = fontSize + 8;

      group.append("rect")
        .attr("x", labelX - badgeWidth / 2)
        .attr("y", labelY - badgeHeight / 2)
        .attr("width", badgeWidth)
        .attr("height", badgeHeight)
        .attr("rx", 3)
        .attr("fill", s.color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);
    }

    group.append("text")
      .attr("x", labelX)
      .attr("y", labelY)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-family", "Arial")
      .style("font-size", fontSize + "px")
      .style("font-weight", "normal")
      .style("fill", "#111")
      .text(text);
  });
}

// Total de la colonne empilée (Art73_74 + Art76), toujours visible -
// c'est la meme grandeur que "Total" dans le graphique groupe d'origine.
function drawComboTotalLabel(g, d, i, scales, layout, isMobile) {
  const { x0, x1, y } = scales;
  const comboX = x0(d.year) + x1("combo");
  const barW = x1.bandwidth();
  const yTop = y(d.comboTotal);

  g.append("text")
    .attr("class", "value total")
    .datum(d)
    .attr("x", comboX + barW / 2)
    .attr("y", yTop - 8)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "11.5px" : "13.5px")
    .style("font-weight", "normal")
    .style("fill", "#111")
    .style("opacity", 0)
    .text(formatSwiss(d.comboTotal))
    .transition()
    .delay(i * 90 + (STACK_SERIES.length - 1) * 60 + SEGMENT_DURATION + 100)
    .duration(300)
    .style("opacity", 1);
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

// Une seule zone de survol par annee, couvrant les 3 colonnes du
// groupe : isole l'annee entiere (comme le graphique groupe d'origine).
function attachHoverArea(g, data, x0, layout) {
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
      .on("mouseover", () => highlightColumn(g, d.year))
      .on("mouseout", () => highlightColumn(g, null));
  });
}

function highlightColumn(g, year) {
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
      const d = d3.select(this).datum();
      return (year === null || (d && d.year === year)) ? 1 : 0.3;
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
      return (year !== null && d.year === year) ? 1 : 0;
    });
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

    drawColumns(g, data, scales, layout, isMobile);
    attachHoverArea(g, data, scales.x0, layout);

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

// index.html charge ce script dans le <head> sans "defer" (comme
// Rechtsdienst/index.html, dont il est le miroir) : le DOM du <body>
// (#chart, #legend...) n'existe pas encore au moment ou ce fichier
// s'execute, donc init() doit attendre DOMContentLoaded plutot que
// de s'appeler directement ici.
document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", drawChart);
