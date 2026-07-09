import https from "https";
import fs from "fs";
function get(url){return new Promise((resolve,reject)=>{https.get(url,{headers:{"User-Agent":"Mozilla/5.0"}},res=>{const c=[];res.on("data",d=>c.push(d));res.on("end",()=>resolve(Buffer.concat(c).toString("utf8")));}).on("error",reject);});}
const main=fs.readFileSync("scripts/_off/main.js","utf8");
// find all chunks mentioning presigned
const imports=[...main.matchAll(/"\.\/([A-Za-z0-9_.-]+\.js)"/g)].map(m=>m[1]);
console.log("imports", imports.length);
for (const f of imports) {
  try {
    const body=await get("https://locket-dio.com/assets/"+f);
    if (/presignedV3|UploadmediaV3\.1|optionsData|getInfoR2/.test(body)) {
      console.log("\n====", f, body.length, "====");
      console.log(body);
    }
  } catch(e) { console.log("err", f, e.message); }
}
// search nested from main for create storage axios sn
const idx=main.indexOf("presigned");
console.log("presigned in main?", idx);
const idx2=main.indexOf("Uploadmedia");
console.log("Uploadmedia context", main.slice(idx2-100, idx2+250));
