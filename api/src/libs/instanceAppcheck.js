const axios = require("axios");
const constants = require("../utils/constants");
const { firebase } = require("../config/app.config");

const instanceAppcheck = axios.create({
  baseURL: firebase.apiBase.appCheck,
  timeout: 30000,
  headers: {
    "Accept-Language": "vi-VN,vi;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Content-Type": "application/json",
    Accept: "*/*",
    "User-Agent": "Locket/1 CFNetwork/1498.700.2 Darwin/23.6.0",
    "X-Ios-Bundle-Identifier": constants.IOS_BUNDLE_ID,
    "X-Goog-Api-Key": firebase.apiKey,
    baggage: "sentry-environment=production,sentry-public_key=78fa64317f434fd89d9cc728dd168f50,sentry-release=com.locket.Locket%402.8.0%2B1,sentry-trace_id=c9a18480918f4b9788f13d2d85316174",
    "sentry-trace": "c9a18480918f4b9788f13d2d85316174-b4563238aee64fbc-0",
    "X-firebase-client": "H4sIAAAAAAAAE13QzWrDMAwA4FcJOsd14tCF5d777ksPriMvpk5sLKU_lL77Elo2MOggf5Il0ANG1IlPqJmg-36A_sGZoQMdo0cRvWYb0tRLF6h4GQ3nXqrmoJp2E-KQsJecFiwGjD7ce0lXZzlO6_vizFp0X2OYsd6XTWFdQqFP3Mta7dao3jJrf2dn6OX1n8cozIjmnPcvPGZkzZQL5WvsMmfiZmLtfa6BMkkmA-L0L4HEBRO5sI1vd21xM2HALT_UnwpKGDTjdmBQlfoQ1V5UDRyfxxLe36BTz19KXvi4jAEAAA",
  },
});

module.exports = { instanceAppcheck };
