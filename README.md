# Jahreszahlen - Bundesamt für Zivildienst

Interaktive Datengrafiken (D3.js v7, vanilla JS) für den Zivildienst (ZIVI). Jeder Ordner ist eine eigenständige Grafik: Es genügt, die `index.html` im Browser zu öffnen, damit sie funktioniert (D3 wird von einem CDN geladen).

**Grafiken online ansehen: [alexhub28.github.io/ZIVI-Jahreszahlen](https://alexhub28.github.io/ZIVI-Jahreszahlen/)**

Die Grafiken unterstützen drei Sprachen über einen URL-Parameter, z. B. `index.html?lang=de` (Standard: `de`, verfügbar: `fr` und `it`).

## Technologie

Die Grafiken sind mit **D3.js** (Version 7) programmiert, einer JavaScript-Bibliothek, die auf Datenvisualisierung spezialisiert ist: Sie wandelt Zahlen (z. B. die Anzahl Diensttage pro Jahr) direkt in der Webseite in grafische Elemente um — Balken, Linien, Achsen —, inklusive Animationen.

D3 wird hier als **„vanilla" JavaScript** eingesetzt, also als reines JavaScript ohne zusätzliches Framework (kein React, Vue o. Ä.) und ohne Kompilierschritt: D3 wird direkt über ein `<script>`-Tag von einem CDN geladen. Deshalb ist jede Grafik eine eigenständige Datei — es genügt, `index.html` im Browser zu öffnen.

## Liste der Grafiken

- [**Zulassungen (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Zulassungen/) — Anzahl Zulassungen pro Jahr
- [**Geleistete Diensttage (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Geleistete%20DT/) — Anzahl geleisteter Diensttage pro Jahr
- [**Diensttage nach Tätigkeitsbereich (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/DT%20nach%20TB/) — Anzahl geleisteter Diensttage nach Tätigkeitsbereich
- [**Diensttage nach Tätigkeitsbereich (pie chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/DT%20nach%20TB%20pie%20chart/) — Anzahl geleisteter Diensttage nach Tätigkeitsbereich
- [**Einsatzbetriebe und Einsatzplätze (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Einsatzbetriebe%20und%20Einsatzpl%C3%A4tze/) — Anzahl Einsatzbetriebe und Einsatzplätze pro Jahr
- [**Einsatzbetriebe und Einsatzplätze pro Tätigkeitsbereich (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/EiB-pro-TB/) — Anzahl Einsatzbetriebe und Einsatzplätze nach Tätigkeitsbereich
- [**Einsatzbetriebe und Einsatzplätze pro Tätigkeitsbereich (mirror chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/EiB-pro-TB%20miroir/) — Anzahl Einsatzbetriebe und Einsatzplätze nach Tätigkeitsbereich
- [**Inspektionen (bar chart, two-tone)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Inspections%20bicolores/) — Anzahl angekündigter / unangekündigter Inspektionen
- [**Inspektionen (bar chart, gradient)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Inspections%20contraste/) — Anzahl angekündigter / unangekündigter Inspektionen
- [**Anzahl Kurse (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Anzahl-Kurse/) — Anzahl Kurse pro Jahr
- [**Anzahl Kurse (bubble chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Anzahl-Kurse%20bulles/) — Anzahl Kurse pro Jahr
- [**Kurse pro Kursart (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Kurse%20pro%20Kursart%20bar%20chart/) — Anzahl Kurse nach Kursart
- [**Kurse pro Kursart (pie chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Kurse%20pro%20Kursart%20pie%20chart/) — Anzahl Kurse nach Kursart
- [**Rechtsdienst (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Rechtsdienst/) — Disziplinarentscheide pro Jahr
- [**Rechtsdienst (stacked bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Rechtsdienst%20empil%C3%A9/) — Disziplinarentscheide pro Jahr, Art. 73/74 + Art. 76 gestapelt, Strafanzeigen und Strafbefehle separat

---

# Statistiques annuelles - Office fédéral du service civil

Graphiques de données interactifs (D3.js v7, vanilla JS) pour le service civil (ZIVI). Chaque dossier est un graphique autonome : ouvrir son `index.html` dans un navigateur suffit pour le voir fonctionner (D3 est chargé depuis un CDN).

**Voir les graphiques en ligne : [alexhub28.github.io/ZIVI-Jahreszahlen](https://alexhub28.github.io/ZIVI-Jahreszahlen/)**

Les graphiques supportent trois langues via un paramètre d'URL, par ex. `index.html?lang=fr` (`de` par défaut, `fr` et `it` disponibles).

## Technologie

Les graphiques sont codés avec **D3.js** (version 7), une bibliothèque JavaScript spécialisée dans la visualisation de données : elle transforme des chiffres (par ex. le nombre de jours de service par année) directement dans la page web en éléments graphiques — barres, lignes, axes —, avec des animations.

D3 est utilisé ici en **JavaScript « vanilla »**, c'est-à-dire du JavaScript pur, sans framework en plus (pas de React, Vue, etc.) et sans étape de compilation : D3 est chargé directement depuis un CDN via une balise `<script>`. C'est pour ça que chaque graphique est un fichier autonome — il suffit d'ouvrir `index.html` dans un navigateur.

## Liste des graphiques

- [**Zulassungen (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Zulassungen/) — Nombre d'admissions par année
- [**Geleistete Diensttage (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Geleistete%20DT/) — Nombre de jours de service effectués par année
- [**Diensttage nach Tätigkeitsbereich (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/DT%20nach%20TB/) — Nombre de jours de service accomplis par domaine d'activité
- [**Diensttage nach Tätigkeitsbereich (pie chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/DT%20nach%20TB%20pie%20chart/) — Nombre de jours de service accomplis par domaine d'activité
- [**Einsatzbetriebe und Einsatzplätze (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Einsatzbetriebe%20und%20Einsatzpl%C3%A4tze/) — Nombre d'établissements et de places d'affectation par année
- [**Einsatzbetriebe und Einsatzplätze pro Tätigkeitsbereich (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/EiB-pro-TB/) — Nombre d'établissements et de places d'affectation par domaine d'activité
- [**Einsatzbetriebe und Einsatzplätze pro Tätigkeitsbereich (mirror chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/EiB-pro-TB%20miroir/) — Nombre d'établissements et de places d'affectation par domaine d'activité
- [**Inspektionen (bar chart, two-tone)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Inspections%20bicolores/) — Nombre d'inspections annoncées / non annoncées
- [**Inspektionen (bar chart, gradient)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Inspections%20contraste/) — Nombre d'inspections annoncées / non annoncées
- [**Anzahl Kurse (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Anzahl-Kurse/) — Nombre de cours par année
- [**Anzahl Kurse (bubble chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Anzahl-Kurse%20bulles/) — Nombre de cours par année
- [**Kurse pro Kursart (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Kurse%20pro%20Kursart%20bar%20chart/) — Nombre de cours par genre de cours
- [**Kurse pro Kursart (pie chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Kurse%20pro%20Kursart%20pie%20chart/) — Nombre de cours par genre de cours
- [**Rechtsdienst (bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Rechtsdienst/) — Décisions disciplinaires par année
- [**Rechtsdienst (stacked bar chart)**](https://alexhub28.github.io/ZIVI-Jahreszahlen/Rechtsdienst%20empil%C3%A9/) — Décisions disciplinaires par année, art. 73/74 + art. 76 empilées, plaintes pénales et ordonnances pénales séparées
