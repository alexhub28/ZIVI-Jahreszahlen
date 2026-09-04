// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "Disziplinarentscheide (gestapelt)",
  fr: "Décisions disciplinaires (empilées)",
  it: "Decisioni disciplinari (impilate)"
};

// Meme 4 categories que le graphique groupe (Rechtsdienst), mais
// empilees en une seule colonne par annee au lieu d'etre cote a cote.
// Charte : plus de 2 categories -> Petrol, Lila, Mint, Kaki, une
// teinte fixe par categorie (on a ici exactement 4 categories pour les
// 4 teintes disponibles, pas de recyclage necessaire). Ordre de la
// liste = ordre d'empilement, de bas en haut.
const SERIES = [
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
    key: "Art73_74",
    color: "#A3A8CA", // lila
    labelLookup: {
      de: "Disziplinarentscheide wegen Art. 73 oder 74 ZDG",
      fr: "Décisions disciplinaires pour infraction à l'art. 73 ou 74 LSC",
      it: "Decisioni disciplinari causa articoli 73 o 74 LSC"
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

const DATA_FILE = "RD_2025.csv";
const MOBILE_BREAKPOINT = 600;
const Y_AXIS_HEADROOM = 1.12;
const MIN_INSIDE_LABEL_HEIGHT = 22; // en dessous, l'etiquette sort du segment
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
      SERIES.forEach(s => { row[s.key] = +d[s.key]; });
      row.total = d3.sum(SERIES, s => row[s.key]);
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
  const maxTotal = d3.max(data, d => d.total);

  const x = d3.scaleBand()
    .domain(data.map(d => d.year))
    .range([0, layout.innerWidth])
    .padding(0.4);

  const y = d3.scaleLinear()
    .domain([0, maxTotal * Y_AXIS_HEADROOM])
    .range([layout.innerHeight, 0]);

  // Empilement : une couche par categorie (ordre de SERIES = ordre
  // d'empilement, de bas en haut), chaque couche porte pour chaque
  // annee un couple [y0, y1] (bornes cumulees), meme index que data.
  const stack = d3.stack().keys(SERIES.map(s => s.key));
  const stackedSeries = stack(data);

  return { x, y, stackedSeries };
}

// ============================================================
// Légende (HTML, sous le graphique — mêmes classes que le graphique
// groupé Rechtsdienst, sans l'item "ligne" puisqu'il n'y en a pas ici).
// ============================================================

function drawLegend() {
  const legend = d3.select("#legend");

  SERIES.forEach(s => {
    const item = legend.append("div").attr("class", "legend-item");
    item.append("span").attr("class", "legend-swatch").style("background", s.color);
    item.append("div").attr("class", "legend-text").text(s.labelLookup[currentLang]);
  });
}

// ============================================================
// Colonnes empilées
// ============================================================

function drawColumns(g, data, scales, layout, isMobile) {
  const { x, y, stackedSeries } = scales;

  // Un groupe de rects par couche (categorie), dans l'ordre d'empilement.
  stackedSeries.forEach((layer, si) => {
    const s = SERIES[si];

    g.selectAll(`rect.seg-${s.key}`)
      .data(layer)
      .enter()
      .append("rect")
      .attr("class", `bar seg-${s.key}`)
      .attr("x", d => x(d.data.year))
      .attr("width", x.bandwidth())
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

  data.forEach((d, i) => {
    drawSegmentLabels(g, d, i, scales, isMobile);
    drawTotalLabel(g, d, i, scales, layout, isMobile);
    drawYearLabel(g, d, x, layout, isMobile);
  });
}

// Valeur par segment, masquee par defaut, revelee au survol de la
// colonne (cf. highlightColumn()). Quand un segment est trop bas pour
// contenir le texte lisiblement, un petit badge de sa propre teinte
// (avec lisere blanc) est ajoute derriere : il peut deborder legerement
// sur les segments voisins mais reste associable a sa categorie grace
// a sa couleur.
function drawSegmentLabels(g, d, i, scales, isMobile) {
  const { x, y, stackedSeries } = scales;
  const barX = x(d.year);
  const barW = x.bandwidth();
  const fontSize = isMobile ? 10 : 11.5;
  const labelX = barX + barW / 2;

  stackedSeries.forEach((layer, si) => {
    const s = SERIES[si];
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

function drawTotalLabel(g, d, i, scales, layout, isMobile) {
  const { x, y } = scales;
  const barX = x(d.year);
  const barW = x.bandwidth();
  const yTop = y(d.total);

  g.append("text")
    .attr("class", "value total")
    .attr("x", barX + barW / 2)
    .attr("y", yTop - 8)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", isMobile ? "11.5px" : "13.5px")
    .style("font-weight", "normal")
    .style("fill", "#111")
    .style("opacity", 0)
    .text(formatSwiss(d.total))
    .transition()
    .delay(i * 90 + (SERIES.length - 1) * 60 + SEGMENT_DURATION + 100)
    .duration(300)
    .style("opacity", 1);
}

function drawYearLabel(g, d, x, layout, isMobile) {
  const barX = x(d.year);
  const barW = x.bandwidth();

  g.append("text")
    .attr("class", "label")
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

function attachHoverArea(g, data, x, layout) {
  data.forEach(d => {
    g.append("rect")
      .attr("class", "hit")
      .datum(d)
      .attr("x", x(d.year))
      .attr("y", 0)
      .attr("width", x.bandwidth())
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
      return (year === null || d.data.year === year) ? 1 : 0.3;
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
    attachHoverArea(g, data, scales.x, layout);

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

init();
window.addEventListener("resize", drawChart);
