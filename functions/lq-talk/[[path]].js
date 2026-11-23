// natsecnoir.com/lq-talk — a password-protected copy of a talk deck and its recordings.
//
// The files live in a private R2 bucket bound to this Pages project as LQ_TALK (no public URL);
// nothing for this page is committed to this public repo. The password is the Pages secret
// LQ_TALK_PASSWORD (any user name is accepted). If either is missing, the page is closed.
// Range requests are passed through so the videos can seek.

const TYPES = {
  html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8",
  mp4: "video/mp4", png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml",
  woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf",
};

function authorised(request, password) {
  const h = request.headers.get("Authorization") || "";
  if (!password || !h.startsWith("Basic ")) return false;
  let decoded;
  try { decoded = atob(h.slice(6)); } catch { return false; }
  const given = decoded.slice(decoded.indexOf(":") + 1);
  // compare without returning early, so the time taken doesn't hint at the password
  const a = new TextEncoder().encode(given), b = new TextEncoder().encode(password);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

const base = { "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

export async function onRequest({ request, env }) {
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405, headers: base });
  if (!env.LQ_TALK || !env.LQ_TALK_PASSWORD) return new Response("Not available", { status: 404, headers: base });
  if (!authorised(request, env.LQ_TALK_PASSWORD)) {
    return new Response("Password required", {
      status: 401, headers: { ...base, "WWW-Authenticate": 'Basic realm="lq-talk", charset="UTF-8"', "Cache-Control": "no-store" },
    });
  }

  const url = new URL(request.url);
  if (url.pathname === "/lq-talk") return Response.redirect(`${url.origin}/lq-talk/`, 301); // relative links need the slash
  let key = decodeURIComponent(url.pathname.replace(/^\/lq-talk\/?/, ""));
  if (key === "" || key.endsWith("/")) key += "index.html";
  if (key.split("/").includes("..")) return new Response("Not found", { status: 404, headers: base });

  const obj = request.method === "HEAD"
    ? await env.LQ_TALK.head(key)
    : await env.LQ_TALK.get(key, { range: request.headers, onlyIf: request.headers });
  if (!obj) return new Response("Not found", { status: 404, headers: base });

  const headers = new Headers(base);
  obj.writeHttpMetadata(headers);
  if (!headers.get("Content-Type")) headers.set("Content-Type", TYPES[key.split(".").pop().toLowerCase()] || "application/octet-stream");
  headers.set("ETag", obj.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=300");

  if (request.method === "HEAD") { headers.set("Content-Length", String(obj.size)); return new Response(null, { headers }); }
  if (!("body" in obj)) return new Response(null, { status: 304, headers }); // If-None-Match matched

  const r = obj.range;
  if (r && request.headers.has("Range")) {
    const offset = r.offset ?? (r.suffix !== undefined ? obj.size - r.suffix : 0);
    const length = r.length ?? (r.suffix ?? obj.size - offset);
    headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    headers.set("Content-Length", String(length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(obj.size));
  return new Response(obj.body, { headers });
}
