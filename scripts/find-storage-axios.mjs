import fs from "fs";
import os from "os";
import path from "path";

const main = fs.readFileSync(path.join(os.tmpdir(), "off-find2", "main.js"), "utf8");
// Find axios instances - look for storage base URL near create
const idx = main.indexOf("storage.locket-dio.com");
console.log("storage idx", idx);
console.log(main.slice(idx - 200, idx + 300));

// Find export I or create with storage
for (const k of ["create({baseURL", "baseURL:w.api.storage", "baseURL:w.api", "x-api-key", "apiKey"]) {
  let i = 0,
    n = 0;
  while ((i = main.indexOf(k, i)) !== -1 && n < 5) {
    console.log("\n==", k, i);
    console.log(main.slice(i, i + 250));
    i++;
    n++;
  }
}
