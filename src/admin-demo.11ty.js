// Solo per la demo su GitHub Pages (EDITOR_DEMO=1): pubblica i Markdown come JSON
// così l'editor può funzionare senza backend. In produzione non viene generato.
import fs from "node:fs";
import path from "node:path";

const DIRS = { "src/pagine": "Pagine", "src/articoli": "Scritti", "src/fr": "Pagine in francese" };

export default class {
  data() {
    return {
      permalink: process.env.EDITOR_DEMO === "1" ? "/admin/demo.json" : false,
      eleventyExcludeFromCollections: true,
    };
  }
  render() {
    const files = [];
    for (const [dir, section] of Object.entries(DIRS)) {
      for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
        const p = path.join(dir, name);
        files.push({ path: p, name, section, content: fs.readFileSync(p, "utf8") });
      }
    }
    return JSON.stringify({ files });
  }
}
