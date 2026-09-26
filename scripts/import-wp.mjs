// Import una tantum delle pagine WordPress salvate (HTML) in Markdown per 11ty.
// Uso: node scripts/import-wp.mjs <cartella-html>
// Il nome file codifica l'URL: "_home.html" -> "/", "fr_stages.html" -> "/fr/stages/".
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const SRC = process.argv[2];
const ROOT = path.resolve(import.meta.dirname, "..");
const SITE = "https://mariolorenzetti.org";
// File troppo grandi per git: restano sul server, fuori dal repo.
const LARGE_MEDIA = /\.(mp4|wav|m4a|mp3)$/i;

if (!SRC) {
  console.error("Uso: node scripts/import-wp.mjs <cartella-html>");
  process.exit(1);
}

const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", emDelimiter: "*" });
td.use(gfm);
td.keep(["audio", "video", "iframe"]);
td.addRule("figure", {
  filter: "figure",
  replacement: (content) => `\n\n${content.trim()}\n\n`,
});

const assets = new Set();

function localUrl(href) {
  if (!href) return href;
  let u = href.replace(/^https?:\/\/(www\.)?mariolorenzetti\.org/i, "");
  if (u === "") u = "/";
  if (u.startsWith("/wp-content/uploads/")) assets.add(u.split("?")[0]);
  return u;
}

function fixText(s) {
  return s
    .replace(/Repirazione/g, "Respirazione")
    .replace(/Lorenzatti/g, "Lorenzetti")
    .replace(/Alessandto/g, "Alessandro")
    .replace(/Traspersonal/g, "Transpersonal");
}

function yamlStr(s) {
  return JSON.stringify((s || "").replace(/\s+/g, " ").trim());
}

function convert(file) {
  const html = fs.readFileSync(path.join(SRC, file), "utf8");
  const $ = cheerio.load(html);
  const base = file.replace(/\.html$/, "");
  const url = base === "_home" ? "/" : "/" + base.split("_").join("/") + "/";
  const lang = url.startsWith("/fr/") || url === "/fr/" ? "fr" : "it";

  const published = $('meta[property="article:published_time"]').attr("content");
  const modified = $('meta[property="article:modified_time"]').attr("content");
  const isPost = Boolean(published);
  const title = $("h1.entry-title").first().text().trim() || $("title").text().trim();
  const seoTitle = $("title").text().trim();
  const description = $('meta[name="description"]').attr("content") || "";
  const ogImage = $('meta[property="og:image"]').attr("content");

  const content = $(".entry-content").first();
  content.find("script, style, form, .wpcf7, .social-icons, .wp-block-spacer, noscript").remove();
  content.find("a.ek-link:empty, a:empty").remove();
  content.find(".wp-block-file__button").remove();
  content.find("img").each((_, el) => {
    const $el = $(el);
    // Preferisce l'originale al posto della miniatura WordPress "-225x300".
    let src = $el.attr("src") || "";
    const srcset = $el.attr("srcset");
    if (srcset) {
      const biggest = srcset.split(",").map((s) => s.trim().split(/\s+/)).sort((a, b) => parseInt(b[1]) - parseInt(a[1]))[0];
      if (biggest) src = biggest[0];
    }
    $el.attr("src", localUrl(src));
    $el.removeAttr("srcset sizes class width height decoding fetchpriority loading");
    $el.attr("alt", fixText($el.attr("alt") || ""));
  });
  content.find("a").each((_, el) => {
    const $el = $(el);
    $el.attr("href", localUrl($el.attr("href")));
  });
  content.find("audio, video, source").each((_, el) => {
    const $el = $(el);
    for (const attr of ["src", "poster"]) if ($el.attr(attr)) $el.attr(attr, localUrl($el.attr(attr)));
  });

  // Le liste WordPress avevano un trattino "– " scritto a mano dentro ogni voce.
  content.find("li").each((_, li) => {
    const walk = (node) => {
      for (const child of node.children || []) {
        if (child.type === "text") {
          if (!child.data.trim()) continue;
          child.data = child.data.replace(/^\s*[–-]\s*/, "");
          return true;
        }
        if (walk(child)) return true;
      }
      return false;
    };
    walk(li);
  });
  // Rimuove grassetti/corsivi rimasti vuoti e fonde quelli adiacenti.
  for (let i = 0; i < 3; i++) {
    content.find("strong, em, b, i").each((_, el) => {
      if (!$(el).text().trim() && !$(el).find("img").length) $(el).replaceWith($(el).text());
    });
  }
  content.find("strong + strong, em + em").each((_, el) => {
    const prev = el.prev;
    if (prev && prev.type === "tag") {
      $(prev).append($(el).contents());
      $(el).remove();
    }
  });

  let md = td.turndown(content.html() || "");
  md = fixText(md)
    .replace(/^(\s*)-\s+/gm, "$1- ")
    .replace(/\*{4}/g, "")
    .replace(/^(#{1,6} )(.*)$/gm, (_, h, t) => h + t.replace(/\*\*/g, "").replace(/\s+/g, " ").trim())
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const fm = [
    "---",
    `title: ${yamlStr(title)}`,
    `seoTitle: ${yamlStr(seoTitle)}`,
    `description: ${yamlStr(description)}`,
    `permalink: ${url}`,
    `lang: ${lang}`,
  ];
  if (isPost) fm.push(`date: ${published.slice(0, 10)}`);
  if (modified) fm.push(`updated: ${modified.slice(0, 10)}`);
  if (ogImage && !/400x300/.test(ogImage)) fm.push(`image: ${localUrl(ogImage)}`);
  fm.push("---", "");

  const dir = lang === "fr" ? "fr" : isPost ? "articoli" : "pagine";
  const slug = base === "_home" ? "home" : base === "fr" ? "accueil" : base.replace(/^fr_/, "").split("_").pop();
  const out = path.join(ROOT, "src", dir, `${slug}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, fm.join("\n") + "\n" + md + "\n");
  console.log(`${url} -> ${path.relative(ROOT, out)}`);
}

async function download(u) {
  const dest = path.join(ROOT, "src", decodeURIComponent(u));
  if (fs.existsSync(dest) || LARGE_MEDIA.test(u)) return;
  const res = await fetch(SITE + u);
  if (!res.ok) return console.warn(`! ${res.status} ${u}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`scaricato ${u}`);
}

for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith(".html") && !f.startsWith("category_"))) {
  convert(f);
}
for (const u of assets) await download(u);
