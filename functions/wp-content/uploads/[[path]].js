// Vecchie immagini WordPress: nel repo ci sono solo gli originali, non le copie ridimensionate
// (foto-300x225.jpg, icona-32x32.jpg…). Se una copia non esiste, reindirizza all'originale.
export async function onRequest({ request, next }) {
  const res = await next();
  if (res.status !== 404) return res;
  const url = new URL(request.url);
  const original = url.pathname.replace(/-\d+x\d+(\.(?:jpe?g|png|gif|webp))$/i, "$1");
  if (original === url.pathname) return res;
  return Response.redirect(new URL(original, url.origin), 301);
}
