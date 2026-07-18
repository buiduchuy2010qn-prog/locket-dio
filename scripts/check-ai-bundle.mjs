import fs from "fs";
import path from "path";

const t = fs.readFileSync("dist/assets/index-7mCKHle4.js", "utf8");
const i = t.search(/upscaler|esrgan|tensorflow/i);
console.log("match idx", i);
if (i >= 0) console.log("context:", t.slice(Math.max(0, i - 100), i + 140));
console.log("ai-enhance ref", t.includes("ai-enhance"));

const sw = fs.readFileSync("dist/sw.js", "utf8");
console.log("sw has ai-enhance", sw.includes("ai-enhance"));
console.log("sw has DNlsMot6", sw.includes("DNlsMot6"));

// Workbox injectManifest inlines as self.__WB_MANIFEST = [...]
const start = sw.indexOf("self.__WB_MANIFEST");
console.log("manifest marker", start);
if (start >= 0) {
  const slice = sw.slice(start, start + 80);
  console.log("marker slice", slice);
}

// Count entries via url:" pattern without escaping issues
const re = /url:"([^"]+)"/g;
let m;
const urls = [];
while ((m = re.exec(sw))) urls.push(m[1]);
console.log("url entries", urls.length);
const aiUrls = urls.filter((u) =>
  /ai-enhance|tensorflow|upscaler|esrgan|tfjs/i.test(u),
);
console.log("ai urls", aiUrls);

// Also try revision format
const re2 = /"url":"([^"]+)"/g;
const urls2 = [];
while ((m = re2.exec(sw))) urls2.push(m[1]);
console.log("json url entries", urls2.length);
console.log(
  "ai json",
  urls2.filter((u) => /ai-enhance|tensorflow|upscaler|esrgan|tfjs/i.test(u)),
);

// index.html script refs for boot
const html = fs.readFileSync("dist/index.html", "utf8");
const scripts = [...html.matchAll(/src="([^"]+)"/g)].map((x) => x[1]);
console.log("index scripts", scripts);
for (const s of scripts) {
  const p = path.join("dist", s.replace(/^\//, ""));
  if (!fs.existsSync(p)) continue;
  const body = fs.readFileSync(p, "utf8");
  console.log(
    "boot",
    s,
    fs.statSync(p).size,
    "ai?",
    /upscaler|esrgan-slim|@tensorflow/.test(body),
  );
}
