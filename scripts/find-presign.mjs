import fs from "fs";
import https from "https";
import path from "path";
import os from "os";

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      })
      .on("error", reject);
  });
}

const tmp = path.join(os.tmpdir(), "off-find");
fs.mkdirSync(tmp, { recursive: true });

const html = await get("https://locket-dio.com/");
const main = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
console.log("main", main);
const mainJs = await get("https://locket-dio.com" + main);
fs.writeFileSync(path.join(tmp, "main.js"), mainJs);

const cfg = mainJs.match(/api:\{[^}]+\}/);
console.log("cfg snippet", cfg?.[0]?.slice(0, 400));

const imports = [...mainJs.matchAll(/"\.\/([A-Za-z0-9_.-]+\.js)"/g)].map((m) => m[1]);
console.log("import count", imports.length);

const found = [];
for (const f of imports.slice(0, 100)) {
  try {
    const body = await get("https://locket-dio.com/assets/" + f);
    if (/presigned|Uploadmedia|postMomentV2|presignedV/i.test(body)) {
      found.push(f);
      fs.writeFileSync(path.join(tmp, f), body);
      console.log("FOUND", f, "len", body.length);
      // print contexts
      for (const k of ["presignedV3", "presignedV2", "presigned", "storage.locket", "Uploadmedia", "postMomentV2"]) {
        let i = 0,
          n = 0;
        while ((i = body.indexOf(k, i)) !== -1 && n < 2) {
          console.log(" ", k, "=>", JSON.stringify(body.slice(Math.max(0, i - 40), i + 100)));
          i++;
          n++;
        }
      }
    }
  } catch (e) {
    console.log("fail", f, e.message);
  }
}
console.log("done", found);
