import https from "https";
function get(url){return new Promise((resolve,reject)=>{https.get(url,{headers:{"Cache-Control":"no-cache"}},res=>{const c=[];res.on("data",d=>c.push(d));res.on("end",()=>resolve(Buffer.concat(c).toString("utf8")));}).on("error",reject);});}
const html=await get("https://huy-locket.onrender.com/locket-beta");
const main=html.match(/src="(\/assets\/[^"]+)"/)?.[1];
console.log("live main", main);
console.log("local public", (await import("fs")).readFileSync("public/index.html","utf8").match(/src="(\/assets\/[^"]+)"/)?.[1]);
const js=await get("https://huy-locket.onrender.com"+main);
console.log("has readIdToken fix markers", js.includes("Missing idToken") || js.includes("sessionStorage"));
// find storage chunk with object Object risk
console.log("has slice(0, 160)", /slice\(0,\s*160\)/.test(js));
