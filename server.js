/* ==========================================================================
   AS Solutions – webserver + beheer-API
   Start met:  node server.js          (Node.js 18 of nieuwer, geen npm install nodig)
   Website:    http://localhost:8080
   Beheer:     http://localhost:8080/beheer
   ========================================================================== */
"use strict";
const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;
const DATA_FILE = path.join(ROOT, "data", "projecten.json");
const UPLOAD_DIR = path.join(ROOT, "assets", "img", "projecten");
const TRASH_DIR = path.join(ROOT, "prullenbak");
const CONFIG_FILE = path.join(ROOT, "admin.config.json");
const MAX_BODY = 25 * 1024 * 1024; // 25 MB per verzoek
const SESSION_HOURS = 12;

/* ---------- Wachtwoord ---------- */
function loadPassword() {
  if (process.env.ADMIN_WACHTWOORD) return process.env.ADMIN_WACHTWOORD;
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    if (cfg.wachtwoord) return String(cfg.wachtwoord);
  } catch (_) { /* bestaat nog niet */ }
  const pw = crypto.randomBytes(9).toString("base64url");
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ wachtwoord: pw }, null, 2));
  console.log("\n  Er is een nieuw beheerwachtwoord aangemaakt: " + pw);
  console.log("  (staat in admin.config.json, daar kun je het ook wijzigen)\n");
  return pw;
}
const PASSWORD = loadPassword();
const PW_HASH = crypto.createHash("sha256").update(PASSWORD).digest();

/* ---------- Sessies en inlogpogingen ---------- */
const sessions = new Map(); // token -> verloopt (ms)
const attempts = new Map(); // ip -> { n, until }

function clientIp(req) {
  return (req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
}
function getCookie(req, name) {
  const m = (req.headers.cookie || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function isLoggedIn(req) {
  const t = getCookie(req, "as_sessie");
  if (!t || !sessions.has(t)) return false;
  if (sessions.get(t) < Date.now()) { sessions.delete(t); return false; }
  return true;
}
function isHttps(req) {
  return req.headers["x-forwarded-proto"] === "https" || !!req.headers["cf-visitor"];
}

/* ---------- Hulpfuncties ---------- */
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".mp4": "video/mp4", ".txt": "text/plain; charset=utf-8"
};
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN"
};
function send(res, status, body, headers = {}) {
  res.writeHead(status, Object.assign({}, SECURITY_HEADERS, headers));
  res.end(body);
}
function json(res, status, obj, headers = {}) {
  send(res, status, JSON.stringify(obj), Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, headers));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error("Bestand te groot"), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch (e) { reject(Object.assign(new Error("Ongeldige gegevens"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}
async function readProjects() {
  try { return JSON.parse(await fsp.readFile(DATA_FILE, "utf8")); } catch (_) { return []; }
}
let writeQueue = Promise.resolve();
function writeProjects(list) {
  // schrijf eerst naar een tijdelijk bestand, zodat het JSON-bestand nooit half geschreven is
  writeQueue = writeQueue.then(async () => {
    const tmp = DATA_FILE + ".tmp";
    await fsp.writeFile(tmp, JSON.stringify(list, null, 2));
    await fsp.rename(tmp, DATA_FILE);
  });
  return writeQueue;
}
function slug(s) {
  return String(s || "foto").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "foto";
}
function cleanTitle(s) { return String(s || "").replace(/[<>]/g, "").trim().slice(0, 120); }

/* data-URL -> Buffer, alleen echte WebP of JPEG toegestaan */
function decodeImage(dataUrl) {
  const m = /^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!m) throw Object.assign(new Error("Alleen WebP- of JPEG-afbeeldingen zijn toegestaan"), { status: 400 });
  const buf = Buffer.from(m[2], "base64");
  const isWebp = buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP";
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  if (!(m[1] === "webp" ? isWebp : isJpeg)) throw Object.assign(new Error("Ongeldig afbeeldingsbestand"), { status: 400 });
  return { buf, ext: m[1] === "webp" ? ".webp" : ".jpg" };
}
async function saveImagePair(baseName, groot, klein) {
  const g = decodeImage(groot), k = decodeImage(klein);
  const gName = baseName + g.ext, kName = baseName + "-klein" + k.ext;
  await fsp.writeFile(path.join(UPLOAD_DIR, gName), g.buf);
  await fsp.writeFile(path.join(UPLOAD_DIR, kName), k.buf);
  return { groot: "assets/img/projecten/" + gName, klein: "assets/img/projecten/" + kName };
}
/* Verwijderde bestanden gaan naar de map "prullenbak", niet definitief weg */
async function trash(relPath) {
  if (!relPath || !relPath.startsWith("assets/")) return;
  const abs = path.join(ROOT, relPath);
  if (!abs.startsWith(path.join(ROOT, "assets"))) return;
  try {
    await fsp.mkdir(TRASH_DIR, { recursive: true });
    await fsp.rename(abs, path.join(TRASH_DIR, Date.now() + "-" + path.basename(abs)));
  } catch (_) { /* bestand bestond al niet meer */ }
}

/* ---------- API ---------- */
async function api(req, res, url) {
  const route = req.method + " " + url.pathname;

  // Alle schrijfacties alleen vanaf dezelfde site (bescherming tegen CSRF)
  if (req.method !== "GET") {
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return json(res, 403, { fout: "Niet toegestaan" });
  }

  if (route === "POST /api/login") {
    const ip = clientIp(req); const a = attempts.get(ip) || { n: 0, until: 0 };
    if (a.until > Date.now()) return json(res, 429, { fout: "Te veel pogingen. Probeer het over een paar minuten opnieuw." });
    const body = await readBody(req);
    const given = crypto.createHash("sha256").update(String(body.wachtwoord || "")).digest();
    if (!crypto.timingSafeEqual(given, PW_HASH)) {
      a.n += 1; if (a.n >= 5) { a.until = Date.now() + 10 * 60 * 1000; a.n = 0; } attempts.set(ip, a);
      return json(res, 401, { fout: "Onjuist wachtwoord" });
    }
    attempts.delete(ip);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, Date.now() + SESSION_HOURS * 3600 * 1000);
    const cookie = `as_sessie=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}` + (isHttps(req) ? "; Secure" : "");
    return json(res, 200, { ok: true }, { "Set-Cookie": cookie });
  }
  if (route === "POST /api/logout") {
    const t = getCookie(req, "as_sessie"); if (t) sessions.delete(t);
    return json(res, 200, { ok: true }, { "Set-Cookie": "as_sessie=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0" });
  }
  if (route === "GET /api/sessie") return json(res, 200, { ingelogd: isLoggedIn(req) });

  // Vanaf hier: alleen ingelogd
  if (!isLoggedIn(req)) return json(res, 401, { fout: "Niet ingelogd" });

  if (route === "GET /api/projecten") return json(res, 200, await readProjects());

  if (route === "POST /api/projecten") {
    const body = await readBody(req);
    const titel = cleanTitle(body.titel) || "Project";
    const id = slug(titel) + "-" + Date.now().toString(36);
    const files = await saveImagePair(id, body.groot, body.klein);
    const list = await readProjects();
    const item = Object.assign({ id, type: "foto", titel }, files);
    if (body.bovenaan === false) list.push(item); else list.unshift(item);
    await writeProjects(list);
    return json(res, 201, item);
  }

  if (route === "PUT /api/volgorde") {
    const body = await readBody(req); const list = await readProjects();
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length !== list.length || !ids.every((id) => list.some((p) => p.id === id))) return json(res, 400, { fout: "Ongeldige volgorde" });
    await writeProjects(ids.map((id) => list.find((p) => p.id === id)));
    return json(res, 200, { ok: true });
  }

  const m = /^\/api\/projecten\/([a-z0-9-]+)(\/foto)?$/.exec(url.pathname);
  if (m) {
    const list = await readProjects(); const idx = list.findIndex((p) => p.id === m[1]);
    if (idx < 0) return json(res, 404, { fout: "Project niet gevonden" });
    const item = list[idx];

    if (req.method === "PATCH" && !m[2]) {
      const body = await readBody(req);
      if (body.titel !== undefined) item.titel = cleanTitle(body.titel) || item.titel;
      await writeProjects(list); return json(res, 200, item);
    }
    if (req.method === "PUT" && m[2]) {
      if (item.type !== "foto") return json(res, 400, { fout: "Alleen foto's kunnen vervangen worden" });
      const body = await readBody(req);
      const files = await saveImagePair(item.id + "-" + Date.now().toString(36), body.groot, body.klein);
      await trash(item.groot); await trash(item.klein);
      Object.assign(item, files); await writeProjects(list); return json(res, 200, item);
    }
    if (req.method === "DELETE" && !m[2]) {
      list.splice(idx, 1); await writeProjects(list);
      await trash(item.groot); await trash(item.klein);
      return json(res, 200, { ok: true });
    }
  }
  return json(res, 404, { fout: "Onbekende actie" });
}

/* ---------- Statische bestanden ---------- */
const PUBLIC_FILES = new Set(["/index.html", "/offerte.html", "/contact.html", "/admin.html", "/favicon.ico", "/robots.txt"]);
async function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === "/") p = "/index.html";
  if (p === "/beheer" || p === "/beheer/") p = "/admin.html";
  const allowed = PUBLIC_FILES.has(p) || p.startsWith("/assets/") || p === "/data/projecten.json";
  const abs = path.normalize(path.join(ROOT, p));
  if (!allowed || !abs.startsWith(ROOT + path.sep) || p.includes("..")) return send(res, 404, "Niet gevonden", { "Content-Type": "text/plain; charset=utf-8" });
  let stat;
  try { stat = await fsp.stat(abs); } catch (_) { return send(res, 404, "Niet gevonden", { "Content-Type": "text/plain; charset=utf-8" }); }
  if (!stat.isFile()) return send(res, 404, "Niet gevonden");
  const type = TYPES[path.extname(abs).toLowerCase()] || "application/octet-stream";
  // HTML, CSS, JS en JSON altijd opnieuw controleren, zodat aanpassingen (bv. in config.js) direct zichtbaar zijn.
  // Foto's en video's mogen een dag in de cache (bij vervangen krijgen ze een nieuwe bestandsnaam).
  const isCode = /\.(html|css|js|json)$/.test(p);
  const cache = isCode ? "no-store" : "public, max-age=86400";
  const lastModified = stat.mtime.toUTCString();
  const headers = Object.assign({}, SECURITY_HEADERS, { "Content-Type": type, "Cache-Control": cache, "Accept-Ranges": "bytes", "Last-Modified": lastModified });
  const ims = req.headers["if-modified-since"];
  if (ims && !req.headers.range && Math.floor(stat.mtimeMs / 1000) <= Math.floor(Date.parse(ims) / 1000)) {
    res.writeHead(304, headers); return res.end();
  }
  if (p === "/admin.html") headers["X-Robots-Tag"] = "noindex, nofollow";

  // Range-verzoeken (nodig voor video op iPhone/Safari)
  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (range) {
    let start = range[1] ? parseInt(range[1], 10) : stat.size - parseInt(range[2], 10);
    let end = range[1] && range[2] ? parseInt(range[2], 10) : stat.size - 1;
    if (isNaN(start) || start < 0 || start >= stat.size || end >= stat.size || start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` }); return res.end();
    }
    res.writeHead(206, Object.assign(headers, { "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1 }));
    return fs.createReadStream(abs, { start, end }).pipe(res);
  }
  res.writeHead(200, Object.assign(headers, { "Content-Length": stat.size }));
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(abs).pipe(res);
}

/* ---------- Server ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Niet toegestaan");
    return await serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, err.status || 500, { fout: err.status ? err.message : "Er ging iets mis op de server" });
  }
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  Poort ${PORT} is al in gebruik. Waarschijnlijk draait er nog een (oude) versie van de website.`);
    console.error("  Sluit dat andere venster eerst (of herstart je pc) en start deze opnieuw.\n");
  } else console.error(err);
  process.exit(1);
});
server.listen(PORT, () => {
  console.log(`\n  Map: ${ROOT}`);
  console.log(`  AS Solutions draait op  http://localhost:${PORT}`);
  console.log(`  Beheerpagina:           http://localhost:${PORT}/beheer\n`);
});
