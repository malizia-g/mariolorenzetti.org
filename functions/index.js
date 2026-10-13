// Home: reindirizza i vecchi link WordPress con parametri (?p=563, ?page_id=711, ?s=...).
// Tutto il resto è servito come file statico. Gli altri redirect sono in src/cloudflare/_redirects.
const WP_IDS = {
  6: "/", 13: "/respirazione-olotropica/", 18: "/cerchi-sciamanici/", 26: "/counseling/", 28: "/contatti/",
  35: "/ecopsicologia/", 54: "/seminari/", 160: "/emergenze-spirituali/", 221: "/respirazione-olotropica-e-via-sciamanica/",
  249: "/pubblicazioni/", 259: "/giornata-sciamanica-sugli-archetipi-delle-direzioni-e-la-ruota-di-medicina/",
  279: "/intervista-a-mario-lorenzetti-da-parte-di-macro-edizioni/", 711: "/calendario/", 360: "/calendario/",
  835: "/counseling/il-counseling-transpersonale-e-corporeo-e-il-mio-approccio/",
  563: "/la-respirazione-olotropica-e-il-potenziale-di-guarigione-degli-stati-non-ordinari-di-coscienza/",
  571: "/prefazione-al-libro-di-c-michael-smith-jung-e-lo-sciamanesimo-amrita-edizioni-2018/",
  591: "/prefazione-al-libro-di-daniele-petitto-aromaterapia-totemica/",
  749: "/fr/", 67: "/fr/respiration-holotropique/", 304: "/fr/respiration-holotropique-et-voie-chamanique/",
  63: "/fr/stages/", 69: "/fr/contacts/",
};

export function onRequest({ request, next }) {
  const url = new URL(request.url);
  const id = url.searchParams.get("p") || url.searchParams.get("page_id");
  if (id && WP_IDS[id]) return Response.redirect(new URL(WP_IDS[id], url.origin), 301);
  if (url.searchParams.has("s")) return Response.redirect(new URL("/", url.origin), 301);
  return next();
}
