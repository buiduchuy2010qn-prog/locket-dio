/**
 * Locket Dio static + API proxy
 * Browser → same origin → this server → api.locket-dio.com
 * (bypasses Dio CORS allowlist that only permits locket-dio.com / localhost)
 */
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, "public");

/** Upstream map: local prefix → remote base */
const PROXIES = [
  { prefix: "/dio-api", target: "https://api.locket-dio.com" },
  { prefix: "/dio-data", target: "https://data.locket-dio.com" },
  { prefix: "/dio-storage", target: "https://storage.locket-dio.com" },
  { prefix: "/dio-media", target: "https://media.locket-dio.com" },
  { prefix: "/dio-export", target: "https://export.locket-dio.com" },
  { prefix: "/dio-cdn", target: "https://cdn.locket-dio.com" },
];

const ALLOWED_ORIGIN_SPOOF = "https://locket-dio.com";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".webp": "image/webp",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split("?")[0]);
  const clean = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(root, clean);
  if (!full.startsWith(root)) return null;
  return full;
}

function serveStatic(req, res) {
  let urlPath = req.url.split("?")[0] || "/";
  if (urlPath === "/") urlPath = "/index.html";

  let filePath = safeJoin(PUBLIC_DIR, urlPath);
  if (!filePath) return send(res, 403, "Forbidden");

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    return send(res, 404, "Not found");
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const data = fs.readFileSync(filePath);
  const cache =
    ext === ".html" || ext === ".webmanifest" || path.basename(filePath) === "sw.js"
      ? "no-cache"
      : "public, max-age=31536000, immutable";

  send(res, 200, data, {
    "Content-Type": type,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
  });
}

function matchProxy(urlPath) {
  for (const p of PROXIES) {
    if (urlPath === p.prefix || urlPath.startsWith(p.prefix + "/")) {
      const rest = urlPath.slice(p.prefix.length) || "/";
      return { ...p, rest: rest.startsWith("/") ? rest : `/${rest}` };
    }
  }
  return null;
}

function proxyRequest(req, res, proxy) {
  const targetUrl = new URL(proxy.rest + (req.url.includes("?") ? "?" + req.url.split("?")[1] : ""), proxy.target);
  const isHttps = targetUrl.protocol === "https:";
  const lib = isHttps ? https : http;

  const headers = { ...req.headers };
  // Host must match upstream
  headers.host = targetUrl.host;
  // Spoof allowed origin so Dio CORS middleware accepts the request
  headers.origin = ALLOWED_ORIGIN_SPOOF;
  headers.referer = ALLOWED_ORIGIN_SPOOF + "/";
  // Avoid compressed streams we don't re-encode
  delete headers["accept-encoding"];
  // Hop-by-hop
  delete headers.connection;
  delete headers["content-length"];

  const opts = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttps ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers,
    timeout: 60000,
  };

  const up = lib.request(opts, (upRes) => {
    const outHeaders = { ...upRes.headers };
    // Expose to browser as same-origin; strip upstream CORS (we don't need them)
    delete outHeaders["access-control-allow-origin"];
    delete outHeaders["access-control-allow-credentials"];
    delete outHeaders["access-control-allow-headers"];
    delete outHeaders["access-control-allow-methods"];
    // Rewrite Set-Cookie domain if any
    if (outHeaders["set-cookie"]) {
      const cookies = Array.isArray(outHeaders["set-cookie"])
        ? outHeaders["set-cookie"]
        : [outHeaders["set-cookie"]];
      outHeaders["set-cookie"] = cookies.map((c) =>
        c
          .replace(/;\s*Domain=[^;]*/gi, "")
          .replace(/;\s*Secure/gi, "")
          .replace(/;\s*SameSite=[^;]*/gi, "; SameSite=Lax")
      );
    }

    res.writeHead(upRes.statusCode || 502, outHeaders);
    upRes.pipe(res);
  });

  up.on("timeout", () => {
    up.destroy();
    if (!res.headersSent) send(res, 504, "Upstream timeout");
  });

  up.on("error", (err) => {
    console.error("[proxy]", proxy.prefix, err.message);
    if (!res.headersSent) send(res, 502, "Bad gateway: " + err.message);
  });

  // CORS preflight handled locally (browser sees same-origin so rarely needed)
  if (req.method === "OPTIONS") {
    send(res, 204, "", {
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": req.headers["access-control-request-headers"] || "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    });
    return;
  }

  req.pipe(up);
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = (req.url || "/").split("?")[0];
    const proxy = matchProxy(urlPath);
    if (proxy) {
      return proxyRequest(req, res, proxy);
    }
    return serveStatic(req, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, "Internal error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[locket-dio] listening on :${PORT}`);
  console.log(`[locket-dio] static: ${PUBLIC_DIR}`);
  console.log(`[locket-dio] proxies: ${PROXIES.map((p) => p.prefix).join(", ")}`);
});
