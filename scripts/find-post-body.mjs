import fs from "fs";
import os from "path";
import path from "path";
const main = fs.readFileSync(
  path.join(process.env.TEMP || "/tmp", "off-find2", "main.js"),
  "utf8"
);
const i = main.indexOf("postMomentV2");
console.log(main.slice(i - 500, i + 400));
// also export I
const j = main.indexOf("fo=w.api.storage");
console.log("\nstorage inst", main.slice(j, j + 200));
// find export { I
for (const k of ["I:Qc", "I:sn", "Qc as I", "storage:Qc", "I=Qc", ",I,", "I:"]) {
  const x = main.indexOf(k);
  if (x >= 0) console.log(k, main.slice(x - 30, x + 80));
}
