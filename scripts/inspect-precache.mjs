import fs from "fs";

const sw = fs.readFileSync("dist/sw.js", "utf8");
const re = /"url":"([^"]+)"/g;
const urls = [];
let m;
while ((m = re.exec(sw))) urls.push(m[1]);
console.log("precache count", urls.length);
const big = [];
for (const u of urls) {
  const p = "dist/" + u.replace(/^\//, "");
  let size = 0;
  try {
    size = fs.statSync(p).size;
  } catch {
    /* */
  }
  big.push({ u, size });
}
big.sort((a, b) => b.size - a.size);
console.log("top 15:");
for (const x of big.slice(0, 15)) {
  console.log((x.size / 1024).toFixed(1) + "KB", x.u);
}
const ai = urls.filter((u) =>
  /ai-enhance|worker|tensorflow|upscaler|esrgan|ai-models/i.test(u),
);
console.log("ai-related in precache:", ai);
