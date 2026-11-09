// ============================================================
// Configuration
// ============================================================

const titleLookup = {
  de: "Zeitpunkt der Gesuchseinreichung von zugelassenen Zivis",
  fr: "Moment du dépôt de la demande des civilistes admis",
  it: "Momento di presentazione della domanda dei civilisti ammessi"
};

// Ordre des catégories = ordre d'affichage (du haut vers le bas).
const CATEGORY_ORDER = ["vor_rs", "nach_beginn", "nach_bestanden"];

const labelLookup = {
  de: {
    vor_rs: "Vor Rekrutenschule (RS)",
    nach_beginn: "Nach Beginn RS",
    nach_bestanden: "Nach bestandener RS"
  },
  fr: {
    vor_rs: "Avant l’école de recrues (ER)",
    nach_beginn: "Après le début de l’ER",
    nach_bestanden: "Une fois l’ER terminée"
  },
  it: {
    vor_rs: "Prima della scuola reclute (SR)",
    nach_beginn: "Dopo inizio della SR",
    nach_bestanden: "Dopo adempimento SR"
  }
};

// Langue courante, determinee au demarrage depuis ?lang= (par defaut "de").
let currentLang = "de";

// Graphique à 2 variables (comparaison 2024 → 2025) : petrol + lila,
// couleurs unies (pas de dégradé) — mêmes couleurs que la version bulles,
// pour la cohérence entre les deux variantes du même jeu de données.
const COLOR_2024 = "#5A959D"; // accent1 — petrol
const COLOR_2025 = "#A3A8CA"; // accent3 — lila

// --- Formatage suisse : 3'997 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function formatPercent(p) {
  return p.toFixed(1) + " %";
}

// ============================================================
// URL params (remplace p5.getURLParams, non utilise autrement ici)
// ============================================================

function getURLParams() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(params.entries());
}

// ============================================================
// Init & resize (remplace les hooks de cycle de vie p5 : setup()/noCanvas())
// ============================================================

function init() {
  const params = getURLParams();
  currentLang = params.lang || currentLang;

  d3.select("#titleContainer").text(titleLookup[currentLang]);

  drawChart();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", drawChart);

// --- Mesure le plus long label (langue courante) pour dimensionner la
// colonne de gauche au plus juste (texte temporaire mesuré puis retiré) ---
function measureMaxLabelWidth(svg, keys, fontSize) {
  const probe = svg.append("text")
    .attr("class", "label-probe")
    .style("font-family", "Arial")
    .style("font-size", fontSize)
    .style("font-weight", "normal")
    .style("opacity", 0);

  let maxWidth = 0;
  keys.forEach(key => {
    probe.text(labelLookup[currentLang][key]);
    const w = probe.node().getComputedTextLength();
    if (w > maxWidth) maxWidth = w;
  });

  probe.remove();
  return maxWidth;
}

function drawChart() {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const width = containerWidth;
  const isMobile = width < 600;

  d3.csv("BEZ_Zeitpunkt_Gesuchseinreichung_2025.csv").then(raw => {

    const rows = raw
      .filter(d => d.Year && d.Key)
      .map(d => ({
        year: +d.Year,
        key: d.Key,
        value: +d.Value,
        percent: +d.Percent
      }));

    const byKey = d3.group(rows, d => d.key);
    const data = CATEGORY_ORDER.map(key => {
      const entries = byKey.get(key) || [];
      const y2024 = entries.find(e => e.year === 2024);
      const y2025 = entries.find(e => e.year === 2025);
      return { key, y2024, y2025 };
    });

    const svgProbe = d3.select("#chart").append("svg").attr("width", 0).attr("height", 0);
    const labelFontSize = isMobile ? "11.5px" : "13.5px";
    const maxLabelWidth = measureMaxLabelWidth(svgProbe, CATEGORY_ORDER, labelFontSize);
    svgProbe.remove();

    const legendHeight = 40;
    const rowHeight = isMobile ? 68 : 84;
    const marginRight = isMobile ? 70 : 100;
    // Écran étroit : si la colonne de labels laisserait moins de 160px aux
    // barres, chaque catégorie passe au-dessus de sa paire de barres.
    const normalLeft = 10 + maxLabelWidth + (isMobile ? 20 : 30);
    const stacked = width - normalLeft - marginRight < 160;
    const margin = {
      top: legendHeight + 20,
      right: marginRight,
      bottom: 10,
      left: stacked ? 10 : normalLeft
    };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = data.length * rowHeight;
    const height = margin.top + innerHeight + margin.bottom;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    // --- Légende (puces carrées) — en haut, avant le graphique ---
    const legend = svg.append("g")
      .attr("transform", `translate(${margin.left}, 6)`);

    [["2024", COLOR_2024], ["2025", COLOR_2025]].forEach(([yr, color], i) => {
      const row = legend.append("g").attr("transform", `translate(${i * 90}, 0)`);
      row.append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", color);
      row.append("text")
        .attr("x", 18)
        .attr("y", 10)
        .style("font-family", "Arial")
        .style("font-size", isMobile ? "11.5px" : "13.5px")
        .style("fill", "#111")
        .text(yr);
    });

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const maxVal = d3.max(data, d => Math.max(d.y2024.value, d.y2025.value));

    const x = d3.scaleLinear()
      .domain([0, maxVal * 1.18])
      .range([0, innerWidth]);

    const y0 = d3.scaleBand()
      .domain(data.map(d => d.key))
      .range([0, innerHeight])
      .paddingInner(stacked ? 0.5 : 0.4)
      .paddingOuter(stacked ? 0.05 : 0.15);

    const y1 = d3.scaleBand()
      .domain(["2024", "2025"])
      .range([0, y0.bandwidth()])
      .paddingInner(0.12);

    const MIN_BAR_WIDTH = 2;
    const barWidth = val => val > 0 ? Math.max(x(val), MIN_BAR_WIDTH) : 0;

    const series = [
      { key: "2024", point: d => d.y2024, color: COLOR_2024 },
      { key: "2025", point: d => d.y2025, color: COLOR_2025 }
    ];

    series.forEach((s, si) => {

      // --- Barres, avec animation d'apparition ---
      g.selectAll(`rect.bar-${s.key}`)
        .data(data)
        .enter()
        .append("rect")
        .attr("class", `bar bar-${s.key}`)
        .attr("y", d => y0(d.key) + y1(s.key))
        .attr("height", y1.bandwidth())
        .attr("width", 0)
        .attr("fill", s.color)
        .transition()
        .delay((d, i) => i * 130 + si * 100)
        .duration(750)
        .ease(d3.easeCubicOut)
        .attr("width", d => barWidth(s.point(d).value));

      // --- Étiquette "%" à droite de chaque barre, compteur animé ; la
      // valeur absolue s'affiche entre parenthèses uniquement au survol
      // de la ligne (cf. highlight() plus bas). ---
      const valueLabels = g.selectAll(`text.value-${s.key}`)
        .data(data)
        .enter()
        .append("text")
        .attr("class", `value value-${s.key}`)
        .attr("x", d => barWidth(s.point(d).value) + 8)
        .attr("y", d => y0(d.key) + y1(s.key) + y1.bandwidth() / 2)
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", isMobile ? "10.5px" : "12.5px")
        .style("font-weight", "bold")
        .style("fill", "#111")
        .style("opacity", 0);

      valueLabels.append("tspan").attr("class", "pct-value").text("0 %");
      valueLabels.append("tspan")
        .attr("class", "count-value")
        .style("opacity", 0)
        .text(d => ` (${formatSwiss(s.point(d).value)})`);

      valueLabels.transition()
        .delay((d, i) => i * 130 + si * 100 + 500)
        .duration(300)
        .style("opacity", 1)
        .tween("text", function (d) {
          const iPct = d3.interpolateNumber(0, s.point(d).percent);
          const pctSpan = d3.select(this).select("tspan.pct-value");
          return t => pctSpan.text(formatPercent(iPct(t)));
        });
    });

    // --- Labels (langue courante) à gauche, centrés sur la paire de barres ---
    g.selectAll("text.label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", stacked ? 0 : -10)
      .attr("y", d => stacked ? y0(d.key) - 5 : y0(d.key) + y0.bandwidth() / 2)
      .attr("text-anchor", stacked ? "start" : "end")
      .attr("dominant-baseline", stacked ? "auto" : "middle")
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "11.5px" : "13.5px")
      .style("font-weight", "normal")
      .style("fill", "#333")
      .text(d => labelLookup[currentLang][d.key]);

    // --- Survol par ligne : met en évidence une catégorie ---
    function highlight(key) {
      g.selectAll(".bar, .value")
        .transition().duration(150)
        .style("opacity", d => (key === null || (d.key ? d.key === key : true)) ? 1 : 0.3);

      g.selectAll(".label")
        .transition().duration(150)
        .style("opacity", d => (key === null || d.key === key) ? 1 : 0.3)
        .style("font-weight", d => (key !== null && d.key === key) ? "bold" : "normal")
        .style("fill", d => (key !== null && d.key === key) ? "#000" : "#333");

      // Valeur absolue entre parenthèses : invisible par défaut, ne
      // s'affiche que pour la ligne survolée — seul le pourcentage
      // reste visible en permanence.
      g.selectAll(".count-value")
        .transition().duration(150)
        .style("opacity", d => (key !== null && d.key === key) ? 1 : 0);
    }

    g.selectAll("rect.hit")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "hit")
      .attr("x", -margin.left)
      .attr("y", d => y0(d.key) - (y0.step() - y0.bandwidth()) / (stacked ? 1 : 2)) // stacked : couvre aussi le label au-dessus
      .attr("width", innerWidth + margin.left + margin.right)
      .attr("height", y0.step())
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => highlight(d.key))
      .on("mouseout", () => highlight(null));
  });
}
