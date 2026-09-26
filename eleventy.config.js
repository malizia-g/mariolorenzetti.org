import { HtmlBasePlugin } from "@11ty/eleventy";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";
import markdownIt from "markdown-it";
import site from "./src/_data/site.js";

const MONTHS = {
  it: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
};

export default function (eleventyConfig) {
  eleventyConfig.setLibrary("md", markdownIt({ html: true, linkify: false, typographer: false }));

  // Con PATH_PREFIX (es. demo su GitHub Pages) riscrive i link "/..." nell'HTML.
  eleventyConfig.addPlugin(HtmlBasePlugin);

  eleventyConfig.addPassthroughCopy({
    "src/wp-content": "wp-content",
    "src/assets": "assets",
    "src/.htaccess": ".htaccess",
    "src/api": "api",
    "src/admin": "admin",
  });
  // L'editor è un'app PHP/JS a sé: copiata così com'è, non elaborata da 11ty.
  eleventyConfig.ignores.add("src/admin/**");
  eleventyConfig.addWatchTarget("src/styles/");

  // Tutte le <img> (anche nei Markdown) diventano <picture> AVIF/WebP con width/height e lazy-load.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["avif", "webp", "auto"],
    widths: [400, 800, 1200, "auto"],
    urlPath: "/img/",
    outputDir: "./_site/img/",
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async", sizes: "(min-width: 768px) 720px, 100vw" },
      pictureAttributes: {},
    },
  });

  eleventyConfig.addPlugin(feedPlugin, {
    type: "rss",
    outputPath: "/feed/index.xml",
    collection: { name: "articoli", limit: 20 },
    metadata: {
      language: "it",
      title: site.name,
      subtitle: site.description,
      base: site.url + "/",
      author: { name: site.author },
    },
  });

  eleventyConfig.addCollection("articoli", (api) =>
    api.getFilteredByGlob("src/articoli/*.md").sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addFilter("abs", (url) => new URL(url || "/", site.url).href);
  // JSON sicuro dentro <script>: niente "</script>" nei contenuti.
  eleventyConfig.addFilter("jsonScript", (obj) => JSON.stringify(obj).replace(/</g, "\\u003c"));
  eleventyConfig.addFilter("merge", (a, b) => ({ ...a, ...b }));
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("longDate", (d, lang = "it") => {
    const date = new Date(d);
    return `${date.getUTCDate()} ${MONTHS[lang][date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  });
  eleventyConfig.addFilter("truncate", (s, n = 160) => {
    s = String(s || "").replace(/\s+/g, " ").trim();
    return s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)) + "…";
  });
  // Pagine tradotte collegate dallo stesso translationKey (per hreflang e selettore lingua).
  eleventyConfig.addFilter("translations", (all, key) =>
    key ? all.filter((p) => p.data.translationKey === key) : []
  );

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"],
    pathPrefix: process.env.PATH_PREFIX || "/",
  };
}
