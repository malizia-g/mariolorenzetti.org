export default {
  name: "Mario Lorenzetti – Respirazione Olotropica",
  shortName: "Mario Lorenzetti",
  url: process.env.SITE_URL || "https://mariolorenzetti.org",
  author: "Mario Lorenzetti",
  description:
    "Seminari di Respirazione Olotropica, counseling transpersonale e via sciamanica con Mario Lorenzetti, formato con Stanislav Grof. Torino, Milano e Nord Italia.",
  phone: "+39 347 2939837",
  phoneHref: "tel:+393472939837",
  email: "info@mariolorenzetti.org",
  defaultImage: "/assets/og-default.jpg",
  // Staging (GitHub Pages) non deve essere indicizzato.
  noindex: process.env.NOINDEX === "1",
  // Selettore dei temi di colore, solo nella demo.
  themePicker: process.env.THEME_PICKER === "1",
  newsletter: {
    it: "https://stats.sender.net/forms/axk7jz/view",
    fr: "https://stats.sender.net/forms/elYMkV/view",
  },
  social: {
    facebookProfile: "https://www.facebook.com/mario.lorenzetti.5",
    facebookPage: "https://www.facebook.com/olotropicasciamanismo",
  },
  sameAs: [
    "https://www.facebook.com/mario.lorenzetti.5",
    "https://www.facebook.com/olotropicasciamanismo",
    "https://transpersonal-training.com/mario-lorenzetti/",
  ],
  privacyUrl: "https://privacy.youhost.eu/mariolorenzetti-org-privacy",
};
