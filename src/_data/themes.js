// Temi di colore del sito. Ogni tema ridefinisce le variabili di colore di Tailwind
// (vedi src/styles/main.css). Ruoli:
//   saffron      fascia in alto della home, bottone principale
//   saffronSoft  accento chiaro, testo piccolo sul fondo scuro
//   clay         fasce scure (prossime date, footer, "come iscriversi")
//   clayDeep     fondo della riga finale del footer
//   sienna       link e capolettera        umber   etichette
//   ochre        ornamenti e numeri grandi
//   parchment    sfondo pagina             cream   schede e riquadri
//   ink          testo                     inkSoft testo secondario
export default {
  default: "terra-accesa",
  list: [
    {
      id: "terra-accesa",
      name: "Terra accesa",
      note: "Giallo del logo e argilla rossa",
      colors: { saffron: "#fabc33", saffronSoft: "#fde2a0", gold: "#e3c585", ochre: "#c9a35f", sienna: "#a24f28", umber: "#6c472a", ink: "#241b13", inkSoft: "#5c4a3a", parchment: "#f7eedc", cream: "#fcf7ec", clay: "#9c4a2f", clayDeep: "#86402a" },
    },
    {
      id: "terra-tenue",
      name: "Terra tenue",
      note: "Ocra dorato e argilla, più morbido",
      colors: { saffron: "#eec36b", saffronSoft: "#f8e3b5", gold: "#e3c585", ochre: "#c9a35f", sienna: "#a24f28", umber: "#6c472a", ink: "#241b13", inkSoft: "#5c4a3a", parchment: "#f7eedc", cream: "#fcf7ec", clay: "#9c4a2f", clayDeep: "#86402a" },
    },
    {
      id: "albero",
      name: "Albero",
      note: "Giallo del logo e nero dei rami",
      colors: { saffron: "#fabc33", saffronSoft: "#fde2a0", gold: "#e3c585", ochre: "#c9a35f", sienna: "#a24f28", umber: "#6c472a", ink: "#241b13", inkSoft: "#5c4a3a", parchment: "#f7eedc", cream: "#fcf7ec", clay: "#2a2018", clayDeep: "#1c150f" },
    },
    {
      id: "fuoco",
      name: "Fuoco",
      note: "Elemento fuoco: arancio e rosso brace",
      colors: { saffron: "#f7a13a", saffronSoft: "#fcd7a6", gold: "#f2c078", ochre: "#d98b3a", sienna: "#b03a1e", umber: "#6a2c13", ink: "#2a140c", inkSoft: "#63402f", parchment: "#fbeee2", cream: "#fff8f0", clay: "#8e2c1c", clayDeep: "#741f13" },
    },
    {
      id: "acqua",
      name: "Acqua",
      note: "Elemento acqua: turchese e blu profondo",
      colors: { saffron: "#8fd0cf", saffronSoft: "#c9ecea", gold: "#a9d8d4", ochre: "#4f9ea3", sienna: "#1b6675", umber: "#224e59", ink: "#0f2a31", inkSoft: "#3d5a60", parchment: "#eef6f4", cream: "#f8fcfb", clay: "#1d5663", clayDeep: "#15434e" },
    },
    {
      id: "aria",
      name: "Aria",
      note: "Elemento aria: cielo chiaro e azzurro",
      colors: { saffron: "#c9def0", saffronSoft: "#e3eef8", gold: "#b8cfe6", ochre: "#7e9fc4", sienna: "#2f5f93", umber: "#3f5877", ink: "#17243a", inkSoft: "#4a5a70", parchment: "#f4f7fb", cream: "#fbfcfe", clay: "#3c5a82", clayDeep: "#2f4869" },
    },
    {
      id: "bosco",
      name: "Bosco",
      note: "Natura: verde salvia e verde foresta",
      colors: { saffron: "#c3d69b", saffronSoft: "#e2ecc9", gold: "#cfdcae", ochre: "#8ea860", sienna: "#3f6b2c", umber: "#4b5e33", ink: "#1b2615", inkSoft: "#4a5840", parchment: "#f3f4e8", cream: "#fbfcf5", clay: "#355233", clayDeep: "#29412a" },
    },
    {
      id: "ametista",
      name: "Ametista",
      note: "Spirituale: lavanda, viola e oro",
      colors: { saffron: "#d6c5ec", saffronSoft: "#ebe1f6", gold: "#e3c585", ochre: "#b08fd1", sienna: "#6b3f9c", umber: "#5a4776", ink: "#1f1830", inkSoft: "#554a68", parchment: "#f6f2fa", cream: "#fcfaff", clay: "#46336b", clayDeep: "#372853" },
    },
    {
      id: "alba",
      name: "Alba",
      note: "Rosa pesca e terracotta chiara",
      colors: { saffron: "#f6c3a8", saffronSoft: "#fbe0d2", gold: "#f1cfb4", ochre: "#d99a7a", sienna: "#a4452e", umber: "#7a4a3a", ink: "#2b1a16", inkSoft: "#624a43", parchment: "#fbf1ea", cream: "#fffaf6", clay: "#a34a3a", clayDeep: "#8a3c2e" },
    },
    {
      id: "professionale",
      name: "Professionale",
      note: "Sobrio: pietra, blu notte e un tocco d'oro",
      colors: { saffron: "#e4ddcf", saffronSoft: "#f0ebe1", gold: "#d8c7a0", ochre: "#b39a63", sienna: "#2d5a87", umber: "#4a5563", ink: "#1b2129", inkSoft: "#4d5561", parchment: "#f7f6f2", cream: "#ffffff", clay: "#263545", clayDeep: "#1c2734" },
    },
  ],
};
