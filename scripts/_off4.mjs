import fs from "fs";
import https from "https";
function get(url){return new Promise((resolve,reject)=>{https.get(url,{headers:{"User-Agent":"Mozilla/5.0"}},res=>{const c=[];res.on("data",d=>c.push(d));res.on("end",()=>resolve(Buffer.concat(c).toString("utf8")));}).on("error",reject);});}
// re-download main and ALL asset chunks, search for Payload
const html=await get("https://locket-dio.com/");
const mainPath=html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
const main=await get("https://locket-dio.com"+mainPath);
const files=new Set([...main.matchAll(/assets\/([A-Za-z0-9_.-]+\.js)/g)].map(m=>m[1]));
[...main.matchAll(/"\.\/([A-Za-z0-9_.-]+\.js)"/g)].forEach(m=>files.add(m[1]));
console.log("scan", files.size);
let found=0;
for (const f of files) {
  try {
    const body=await get("https://locket-dio.com/assets/"+f);
    if (body.includes("presignedV3") || body.includes("Version-UploadmediaV3.1")) {
      found++;
      console.log("FILE", f, body.length);
      console.log(body.slice(0, 2000));
      console.log("---");
    }
    // second level
    for (const m of body.matchAll(/"\.\/([A-Za-z0-9_.-]+\.js)"/g)) files.add(m[1]);
  } catch {}
}
console.log("found", found);
// streak
const i=main.indexOf("getTodayIfNotUpdated");
console.log("streak", main.slice(i-50, i+200));
const j=main.indexOf("streakData");
console.log("streakData", main.slice(j-80, j+200));
