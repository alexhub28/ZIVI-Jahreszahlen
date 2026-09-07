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

const unitLegendLookup = {
  de: "Anzahl Gesuche",
  fr: "Nombre de demandes",
  it: "Numero di domande"
};

// Langue courante, determinee au demarrage depuis ?lang= (par defaut "de").
let currentLang = "de";

// Graphique à 2 variables (comparaison 2024 → 2025) : petrol + lila,
// couleurs unies (pas de dégradé).
const COLOR_2024 = "#5A959D"; // accent1 — petrol
const COLOR_2025 = "#A3A8CA"; // accent3 — lila

// GREY_LABEL_GAP : distance entre l'étiquette du petrol (2024) et le haut
// de sa bulle (l'étiquette reste au-dessus).
// LILA_LABEL_GAP : distance entre l'étiquette du lila (2025) et le bord
// droit de sa bulle (l'étiquette est placée à côté, pas au-dessus).
const PETROL_LABEL_GAP = 16;
const LILA_LABEL_GAP = 6;

// Légère animation continue ("respiration") des bulles, une fois leur
// apparition terminée : mouvement horizontal, chaque bulle s'écartant
// uniquement de l'autre (jamais l'inverse). Amplitude en pixels, durée
// de base d'un aller-retour en millisecondes.
const BUBBLE_FLOAT_AMPLITUDE = 4;
const BUBBLE_FLOAT_DURATION = 2000;

// Décalage manuel du pourcentage petrol (2024), par catégorie.
// _Y_OFFSET : négatif = remonte le texte, positif = le descend.
// _X_OFFSET : négatif = vers la gauche, positif = vers la droite.
// 0 ou absent = position automatique inchangée.
const PCT_PETROL_Y_OFFSET = { vor_rs: -45, nach_beginn: -28, nach_bestanden: -40 };
const PCT_PETROL_X_OFFSET = { vor_rs: 25, nach_beginn: 20, nach_bestanden: 25 };

// Même principe que ci-dessus, mais pour le pourcentage lila (2025).
const PCT_LILA_Y_OFFSET = { vor_rs: -35, nach_beginn: -28, nach_bestanden: -32 };
const PCT_LILA_X_OFFSET = { vor_rs: 0, nach_beginn: 0, nach_bestanden: 0 };

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

// --- Formatage suisse : 3'997 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function formatPercent(p) {
  return p.toFixed(1) + " %";
}

// Bord supérieur d'un cercle à une abscisse donnée (utile pour caler une
// étiquette juste au-dessus, sans jamais entrer dans le cercle). Renvoie
// +Infini si le cercle ne s'étend pas jusqu'à cette abscisse — dans ce
// cas, il n'impose aucune contrainte de hauteur.
function circleTopAtX(circle, atX) {
  const dx = atX - circle.cx;
  if (Math.abs(dx) >= circle.r) return Infinity;
  return circle.cy - Math.sqrt(circle.r * circle.r - dx * dx);
}

// Fait flotter doucement un groupe entre deux positions (transform CSS),
// en va-et-vient infini. Le délai initial permet d'attendre la fin de
// l'animation d'entrée de la bulle avant de démarrer la respiration.
function floatLoop(selection, transformA, transformB, duration, initialDelay) {
  function cycle() {
    selection
      .transition()
      .duration(duration)
      .ease(d3.easeSinInOut)
      .attr("transform", transformA)
      .transition()
      .duration(duration)
      .ease(d3.easeSinInOut)
      .attr("transform", transformB)
      .on("end", cycle);
  }

  selection.transition().delay(initialDelay).on("end", cycle);
}

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

    // Une entrée par catégorie, avec les valeurs 2024 et 2025 associées.
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

    const legendHeight = 52;
    const margin = {
      top: legendHeight + 10,
      right: isMobile ? 90 : 140,
      bottom: 28,
      left: 10 + maxLabelWidth + (isMobile ? 20 : 30)
    };

    const innerWidth = width - margin.left - margin.right;
    // Lignes assez hautes pour des bulles de la taille d'un pie chart,
    // avec un pourcentage lisible à l'intérieur même pour les plus
    // petites valeurs.
    const rowHeight = isMobile ? 195 : 250;
    const innerHeight = data.length * rowHeight;
    const height = margin.top + innerHeight + margin.bottom;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    // --- Légende — en haut, avant le graphique, alignée sur la colonne
    // du graphique (comme EiB-pro-TB / Einsatzbetriebe und Einsatzplätze) ---
    const legend = svg.append("g")
      .attr("transform", `translate(${margin.left}, 6)`);

    [["2024", COLOR_2024], ["2025", COLOR_2025]].forEach(([yr, color], i) => {
      const row = legend.append("g").attr("transform", `translate(${i * 100}, 0)`);
      row.append("circle")
        .attr("cx", 7)
        .attr("cy", 7)
        .attr("r", 7)
        .attr("fill", color);
      row.append("text")
        .attr("x", 20)
        .attr("y", 11)
        .style("font-family", "Arial")
        .style("font-size", isMobile ? "13px" : "15px")
        .style("font-weight", "bold")
        .style("fill", "#111")
        .text(yr);
    });

    // --- Légende d'unité : juste sous la légende des années ---
    const unitLegend = legend.append("text")
      .attr("x", 0)
      .attr("y", 38)
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "11.5px" : "13.5px")
      .style("fill", "#555")
      .text(unitLegendLookup[currentLang]);

    // Garde-fou : élargit le SVG si la légende d'unité déborde du
    // conteneur (silencieusement tronquée sinon, la largeur du SVG
    // étant fixée à containerWidth). Le texte démarre à margin.left,
    // pas à 0, d'où son ajout ici.
    const unitBBox = unitLegend.node().getBBox();
    const requiredWidth = margin.left + unitBBox.width + 20;
    if (requiredWidth > width) {
      svg.attr("width", requiredWidth);
    }

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const maxVal = d3.max(data, d => Math.max(d.y2024.value, d.y2025.value));

    const x = d3.scaleLinear()
      .domain([0, maxVal * 1.15])
      .range([0, innerWidth]);

    const y = d3.scaleBand()
      .domain(data.map(d => d.key))
      .range([0, innerHeight])
      .padding(0.06);

    // Rayon proportionnel à la valeur (échelle racine carrée, pour que
    // l'AIRE du cercle — pas son diamètre — reste proportionnelle).
    const r = d3.scaleSqrt().domain([0, maxVal]).range([34, isMobile ? 58 : 78]);

    // Grille verticale discrète en arrière-plan, alignée sur les mêmes
    // graduations que l'axe du bas.
    const gridTicks = x.ticks(isMobile ? 4 : 6);

    g.append("g")
      .attr("class", "grid")
      .selectAll("line")
      .data(gridTicks)
      .enter()
      .append("line")
      .attr("x1", v => x(v))
      .attr("x2", v => x(v))
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", "#e5e5e5")
      .attr("stroke-width", 1);

    g.append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(
        d3.axisBottom(x)
          .tickValues(gridTicks)
          .tickSize(0)
          .tickFormat(v => formatSwiss(v))
      )
      .call(axisG => axisG.select(".domain").remove())
      .selectAll("text")
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "9.5px" : "10.5px")
      .style("fill", "#999");

    data.forEach((d, i) => {
      const rowY = y(d.key) + y.bandwidth() / 2;
      const x24 = x(d.y2024.value);
      const x25 = x(d.y2025.value);

      const row = g.append("g").attr("class", "dumbbell").datum(d);

      const r24 = r(d.y2024.value);
      const r25 = r(d.y2025.value);

      // Quand les deux bulles se chevauchent beaucoup (valeurs proches),
      // on les décale légèrement à la verticale pour que leurs
      // pourcentages internes ne tombent jamais au même endroit.
      const overlap = Math.max(0, r24 + r25 - Math.abs(x25 - x24));
      const stagger = Math.min(overlap * 0.45, 30);
      const cy24 = rowY - stagger / 2;
      const cy25 = rowY + stagger / 2;

      // Chaque bulle (cercle + son pourcentage) est enveloppée dans son
      // propre groupe, pour la faire flotter doucement (floatLoop).
      const bubblePetrol = row.append("g").attr("class", "bubble-petrol");
      const bubbleLila = row.append("g").attr("class", "bubble-lila");

      const dot24 = bubblePetrol.append("circle")
        .attr("cx", x24)
        .attr("cy", cy24)
        .attr("r", 0)
        .attr("fill", COLOR_2024);

      dot24.transition()
        .delay(i * 150)
        .duration(500)
        .attr("r", r24);

      const dot25 = bubbleLila.append("circle")
        .attr("cx", x25)
        .attr("cy", cy25)
        .attr("r", 0)
        .attr("fill", COLOR_2025);

      dot25.transition()
        .delay(i * 150 + 400)
        .duration(500)
        .attr("r", r25);

      // Flottaison continue : le petrol ne s'écarte que vers la gauche
      // (jamais vers le lila), le lila ne s'écarte que vers la droite —
      // les deux bulles ne peuvent donc jamais se rapprocher au-delà de
      // leur position de repos.
      floatLoop(
        bubblePetrol,
        `translate(${-BUBBLE_FLOAT_AMPLITUDE}, 0)`,
        "translate(0, 0)",
        BUBBLE_FLOAT_DURATION + i * 90,
        i * 150 + 900
      );
      floatLoop(
        bubbleLila,
        `translate(${BUBBLE_FLOAT_AMPLITUDE}, 0)`,
        "translate(0, 0)",
        BUBBLE_FLOAT_DURATION + i * 110,
        i * 150 + 1300
      );

      // Pourcentage à l'intérieur de la bulle, dessiné APRÈS les deux
      // cercles (toujours au premier plan) avec un halo de la couleur
      // opposée pour rester lisible. Taille fixe (pas proportionnelle
      // au rayon) : petites et grandes bulles portent un pourcentage de
      // même poids visuel.
      const pctFontSize = isMobile ? 10.5 : 12.5;

      // La bulle petrol (2024) est dessinée en dessous de la bulle lila
      // (2025) : quand elles se chevauchent, sa moitié droite est
      // recouverte. On décale son pourcentage vers la gauche.
      const pct24X = x24 - Math.min(overlap * 0.7, r24 * 0.68) + (PCT_PETROL_X_OFFSET[d.key] || 0);
      const pct24Y = cy24 + (PCT_PETROL_Y_OFFSET[d.key] || 0);

      const pct24Text = bubblePetrol.append("text")
        .attr("x", pct24X)
        .attr("y", pct24Y)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", pctFontSize + "px")
        .style("font-weight", "bold")
        .style("fill", "#fff")
        .style("paint-order", "stroke")
        .style("stroke", "#3E6A70")
        .style("stroke-width", "3px")
        .style("stroke-linejoin", "round")
        .style("opacity", 0)
        .text(formatPercent(d.y2024.percent));

      pct24Text.transition()
        .delay(i * 150 + 250)
        .duration(400)
        .style("opacity", 1);

      const pct25X = x25 + (PCT_LILA_X_OFFSET[d.key] || 0);
      const pct25Y = cy25 + (PCT_LILA_Y_OFFSET[d.key] || 0);

      const pct25Text = bubbleLila.append("text")
        .attr("x", pct25X)
        .attr("y", pct25Y)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", pctFontSize + "px")
        .style("font-weight", "bold")
        .style("fill", "#3D3F66")
        .style("opacity", 0)
        .text(formatPercent(d.y2025.percent));

      pct25Text.transition()
        .delay(i * 150 + 650)
        .duration(400)
        .style("opacity", 1);

      // --- Étiquette de valeur du petrol (2024) : au-dessus de sa
      // bulle. Masquée par défaut (classe "count-label") : seuls les
      // pourcentages restent visibles en permanence, le chiffre absolu
      // n'apparaît qu'au survol de la ligne. ---
      const lilaCircle = { cx: x25, cy: cy25, r: r25 };
      const petrolLabelY = Math.min(
        cy24 - r24 - PETROL_LABEL_GAP,
        circleTopAtX(lilaCircle, x24) - PETROL_LABEL_GAP
      );

      const petrolLabel = row.append("text")
        .attr("class", "count-label")
        .attr("x", x24)
        .attr("y", petrolLabelY)
        .attr("text-anchor", "middle")
        .style("font-family", "Arial")
        .style("font-size", isMobile ? "10.5px" : "12.5px")
        .style("font-weight", "bold")
        .style("fill", "#111")
        .style("opacity", 0)
        .text(formatSwiss(d.y2024.value));

      // La zone des labels de ligne (à gauche) ne doit jamais être
      // recouverte.
      const petrolBBox = petrolLabel.node().getBBox();
      if (petrolBBox.x < 10) {
        petrolLabel.attr("x", x24 + (10 - petrolBBox.x));
      }

      // --- Étiquette de valeur du lila (2025) : à DROITE de sa bulle.
      // Masquée par défaut, révélée au survol comme le petrol ci-dessus. ---
      row.append("text")
        .attr("class", "count-label")
        .attr("x", x25 + r25 + LILA_LABEL_GAP)
        .attr("y", cy25 - 40)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", isMobile ? "10.5px" : "12.5px")
        .style("font-weight", "bold")
        .style("fill", "#111")
        .style("opacity", 0)
        .text(formatSwiss(d.y2025.value));

      // --- Label (langue courante) à gauche ---
      g.append("text")
        .attr("class", "row-label")
        .datum(d)
        .attr("x", -10)
        .attr("y", rowY)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", isMobile ? "11.5px" : "13.5px")
        .style("font-weight", "normal")
        .style("fill", "#333")
        .text(labelLookup[currentLang][d.key]);
    });

    // --- Survol par ligne : met en évidence une catégorie ---
    function highlight(key) {
      g.selectAll(".dumbbell")
        .transition().duration(150)
        .style("opacity", d => (key === null || d.key === key) ? 1 : 0.3);

      g.selectAll(".row-label")
        .transition().duration(150)
        .style("opacity", d => (key === null || d.key === key) ? 1 : 0.3)
        .style("font-weight", d => (key !== null && d.key === key) ? "bold" : "normal")
        .style("fill", d => (key !== null && d.key === key) ? "#000" : "#333");

      // Chiffres absolus : invisibles par défaut, ne s'affichent que
      // pour la ligne survolée — seuls les pourcentages restent
      // visibles en permanence.
      g.selectAll(".count-label")
        .transition().duration(150)
        .style("opacity", d => (key !== null && d.key === key) ? 1 : 0);
    }

    g.selectAll("rect.hit")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "hit")
      .attr("x", -margin.left)
      .attr("y", d => y(d.key))
      .attr("width", innerWidth + margin.left + margin.right)
      .attr("height", y.bandwidth())
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => highlight(d.key))
      .on("mouseout", () => highlight(null));
  });
}
