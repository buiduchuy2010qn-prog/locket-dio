import https from "https";
import fs from "fs";
import path from "path";
function get(url){return new Promise((resolve,reject)=>{https.get(url,{headers:{"User-Agent":"Mozilla/5.0"}},res=>{const c=[];res.on("data",d=>c.push(d));res.on("end",()=>resolve(Buffer.concat(c).toString("utf8")));}).on("error",reject);});}
const out="scripts/_off";
fs.mkdirSync(out,{recursive:true});
const html=await get("https://locket-dio.com/");
const mainPath=html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
console.log("main", mainPath);
const main=await get("https://locket-dio.com"+mainPath);
fs.writeFileSync(path.join(out,"main.js"), main);
// find PayloadServices chunk
const imports=[...main.matchAll(/"\.\/([A-Za-z0-9_.-]+\.js)"/g)].map(m=>m[1]);
for (const f of imports) {
  const body=await get("https://locket-dio.com/assets/"+f);
  if (/presignedV3|UploadmediaV3|optionsData/.test(body)) {
    fs.writeFileSync(path.join(out,f), body);
    console.log("FOUND", f);
    console.log(body);
  }
}
// dump overlay Is and postMoment
let i=main.indexOf("Version-Uploadmedia");
console.log("upload ctx", main.slice(i-200, i+200));
i=main.indexOf('Is={overlay_id');
console.log("Is", main.slice(i, i+350));
