import https from "https";
import fs from "fs";
function get(url){return new Promise((resolve,reject)=>{https.get(url,res=>{const c=[];res.on("data",d=>c.push(d));res.on("end",()=>resolve(Buffer.concat(c).toString("utf8")));}).on("error",reject);});}
const html=await get("https://huy-locket.onrender.com/locket-beta");
const main=html.match(/src="(\/assets\/[^"]+)"/)?.[1];
const js=await get("https://huy-locket.onrender.com"+main);
// find chunks with postMoment / slice 160
const imports=[...js.matchAll(/"\.\/([^"]+\.js)"/g)].map(m=>m[1]);
for (const f of imports) {
  try {
    const body=await get("https://huy-locket.onrender.com/assets/"+f);
    if (body.includes("postMomentV2") || body.includes("Đăng tải thất bại") || body.includes("slice(0,160)") || body.includes("slice(0, 160)")) {
      console.log("HIT", f, body.length);
      for (const k of ["postMomentV2","Đăng tải thất bại","object Object","slice(0","mediaInfo","optionsData","success===!1","success:!1"]) {
        let i=body.indexOf(k); if(i<0) i=body.indexOf(k.replace("===","=="));
        if (i>=0) console.log(" ", k, JSON.stringify(body.slice(Math.max(0,i-50), i+120)));
      }
    }
  } catch {}
}
