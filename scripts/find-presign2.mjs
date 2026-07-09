import fs from "fs";
import https from "https";
import path from "path";
import os from "os";

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(new URL(res.headers.location, url).href).then(resolve, reject);
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      })
      .on("error", reject);
  });
}

const tmp = path.join(os.tmpdir(), "off-find2");
fs.mkdirSync(tmp, { recursive: true });

const html = await get("https://locket-dio.com/");
const assets = [...html.matchAll(/\/assets\/[A-Za-z0-9_.-]+\.js/g)].map((m) => m[0]);
const main = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
const mainJs = await get("https://locket-dio.com" + main);
fs.writeFileSync(path.join(tmp, "main.js"), mainJs);

// collect all js names from main
const names = new Set([
  ...[...mainJs.matchAll(/([A-Za-z0-9_-]+\.js)/g)].map((m) => m[1]),
  ...assets.map((a) => a.split("/").pop()),
]);

console.log("names", names.size);
const patterns = [/presigned/i, /Uploadmedia/i, /postMoment/i, /getInfoR2/i, /downloadURL/i, /publicURL/i];
const hits = [];

for (const name of names) {
  if (!name.endsWith(".js")) continue;
  if (name.length > 80) continue;
  try {
    const body = await get("https://locket-dio.com/assets/" + name);
    if (patterns.some((p) => p.test(body))) {
      hits.push(name);
      fs.writeFileSync(path.join(tmp, name), body);
      console.log("HIT", name, body.length);
      for (const re of [/presignedV\d?/gi, /Uploadmedia[^"]*/gi, /postMomentV\d?/gi, /storage\.locket-dio\.com[^"]*/g]) {
        const m = body.match(re);
        if (m) console.log("  matches", [...new Set(m)].slice(0, 10));
      }
      // dump interesting slices
      for (const k of ["presigned", "Uploadmedia", "postMoment", "publicURL", "downloadURL", "contentType"]) {
        let i = body.toLowerCase().indexOf(k.toLowerCase());
        if (i >= 0) console.log("  ctx", k, JSON.stringify(body.slice(Math.max(0, i - 60), i + 140)));
      }
    }
  } catch (e) {
    // ignore
  }
}
console.log("hits", hits);
