/**
 * Locket Dio static + API proxy
 * Browser → same origin → this server → api.locket-dio.com / storage.locket-dio.com
 */
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, "public");

const PROXIES = [
  { prefix: "/dio-api", target: "https://api.locket-dio.com" },
  { prefix: "/dio-auth", target: "https://auth.locket-dio.com" },
  { prefix: "/dio-data", target: "https://data.locket-dio.com" },
  { prefix: "/dio-storage", target: "https://storage.locket-dio.com" },
  { prefix: "/dio-media", target: "https://media.locket-dio.com" },
  { prefix: "/dio-export", target: "https://export.locket-dio.com" },
  { prefix: "/dio-cdn", target: "https://cdn.locket-dio.com" },
  { prefix: "/dio-payment", target: "https://payment.locket-dio.com" },
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Browser cannot PUT directly to R2 (CORS only allows locket-dio.com).
 * Client sends file here; we PUT to the presigned uploadUrl server-side.
 * Header: X-Upload-Url = full presigned URL
 * Body: raw file bytes; Content-Type must match presign
 */
function isAllowedR2UploadUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return (
      h.endsWith(".r2.cloudflarestorage.com") ||
      h.endsWith(".cloudflarestorage.com") ||
      h === "storage.locket-dio.com" ||
      h.endsWith(".storage.locket-dio.com")
    );
  } catch {
    return false;
  }
}

async function proxyR2Put(req, res) {
  if (req.method === "OPTIONS") {
    return send(res, 204, "", {
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Methods": "PUT,OPTIONS",
      "Access-Control-Allow-Headers":
        req.headers["access-control-request-headers"] ||
        "content-type,x-upload-url",
      "Access-Control-Max-Age": "86400",
    });
  }

  if (req.method !== "PUT" && req.method !== "POST") {
    return send(res, 405, "Method not allowed");
  }

  const uploadUrl =
    req.headers["x-upload-url"] ||
    req.headers["x-r2-upload-url"] ||
    "";
  if (!uploadUrl || !isAllowedR2UploadUrl(uploadUrl)) {
    return send(
      res,
      400,
      "Missing or invalid X-Upload-Url (must be R2/storage presigned URL)"
    );
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return send(res, 400, "Bad request body: " + e.message);
  }

  if (!body.length) {
    return send(res, 400, "Empty upload body");
  }

  const expectedSize = Number(req.headers["x-upload-size"] || 0);
  if (expectedSize > 0 && body.length !== expectedSize) {
    console.warn(
      "[r2-put] size mismatch body=%s expected=%s",
      body.length,
      expectedSize
    );
  }

  const targetUrl = new URL(uploadUrl);
  // Use client Content-Type as-is (must match what was signed in presign)
  const contentType =
    req.headers["content-type"] || "application/octet-stream";

  // Presigned PUT: only Content-Type is typically signed — avoid extra signed headers
  const headers = {
    "Content-Type": contentType,
    "Content-Length": String(body.length),
  };

  console.log(
    "[r2-put] PUT",
    targetUrl.hostname,
    "bytes=",
    body.length,
    "type=",
    contentType
  );

  const opts = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: 443,
    path: targetUrl.pathname + targetUrl.search,
    method: "PUT",
    headers,
    timeout: 120000,
  };

  const up = https.request(opts, (upRes) => {
    const chunks = [];
    upRes.on("data", (c) => chunks.push(c));
    upRes.on("end", () => {
      const buf = Buffer.concat(chunks);
      console.log("[r2-put] status", upRes.statusCode, "respBytes", buf.length);
      send(res, upRes.statusCode || 502, buf, {
        "Content-Type":
          upRes.headers["content-type"] || "text/plain; charset=utf-8",
      });
    });
  });

  up.on("timeout", () => {
    up.destroy();
    if (!res.headersSent) send(res, 504, "R2 upload timeout");
  });

  up.on("error", (err) => {
    console.error("[r2-put]", err.message);
    if (!res.headersSent) send(res, 502, "R2 upload failed: " + err.message);
  });

  up.write(body);
  up.end();
}

async function proxyRequest(req, res, proxy) {
  const search = req.url.includes("?") ? "?" + req.url.split("?").slice(1).join("?") : "";
  const targetUrl = new URL(proxy.rest + search, proxy.target);
  const isHttps = targetUrl.protocol === "https:";
  const lib = isHttps ? https : http;

  // CORS preflight (same-origin usually skips this)
  if (req.method === "OPTIONS") {
    return send(res, 204, "", {
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        req.headers["access-control-request-headers"] ||
        "content-type,authorization,x-api-key,x-app-author,x-app-name,x-app-client,x-app-api,x-app-env,x-locketdio-member,x-upload-url",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    });
  }

  let body = Buffer.alloc(0);
  try {
    body = await readBody(req);
  } catch (e) {
    console.error("[proxy] body read", e.message);
    return send(res, 400, "Bad request body");
  }

  // Clean hop-by-hop headers; KEEP content-length accurate for JSON POSTs
  const hopByHop = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "accept-encoding",
  ]);

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    if (hopByHop.has(k.toLowerCase())) continue;
    headers[k] = v;
  }

  headers.host = targetUrl.host;
  headers.origin = ALLOWED_ORIGIN_SPOOF;
  headers.referer = ALLOWED_ORIGIN_SPOOF + "/";
  headers["content-length"] = String(body.length);

  // Prefer identity so we can stream response as-is
  headers["accept-encoding"] = "identity";

  const opts = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttps ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers,
    timeout: 90000,
  };

  const up = lib.request(opts, (upRes) => {
    const outHeaders = { ...upRes.headers };
    delete outHeaders["access-control-allow-origin"];
    delete outHeaders["access-control-allow-credentials"];
    delete outHeaders["access-control-allow-headers"];
    delete outHeaders["access-control-allow-methods"];
    delete outHeaders["content-encoding"]; // we asked identity

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
    console.error("[proxy]", proxy.prefix, req.method, targetUrl.pathname, err.message);
    if (!res.headersSent) send(res, 502, "Bad gateway: " + err.message);
  });

  if (body.length) up.write(body);
  up.end();
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = (req.url || "/").split("?")[0];

    // R2 presigned PUT proxy (avoids browser CORS on cloudflarestorage.com)
    if (urlPath === "/dio-r2-put") {
      return proxyR2Put(req, res);
    }

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
  console.log(`[locket-dio] proxies: ${PROXIES.map((p) => p.prefix).join(", ")}, /dio-r2-put`);
});
