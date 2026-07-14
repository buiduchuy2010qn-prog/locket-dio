require("dotenv").config();

const API_KEY = process.env.FIREBASE_API_KEY || "";

// Optional Locket reverse-proxy headers (set via env — never commit real tokens)
const APP_CHECK =
  process.env.LOCKET_APP_CHECK_TOKEN ||
  process.env.LOCKET_APP_CHECK_DEVICE_TOKEN ||
  "";
const FCM_INSTANCE_ID =
  process.env.LOCKET_FCM_INSTANCE_ID_TOKEN ||
  process.env.FIREBASE_INSTANCE_ID_TOKEN ||
  "";
const X_FIREBASE_CLIENT =
  process.env.LOCKET_X_FIREBASE_CLIENT ||
  "H4sIAAAAAAAAAKtWykhNLCpJSk0sKVayio7VUSpLLSrOzM9TslIyUqoFAFyivEQfAAAA";
const X_FIREBASE_GMPID =
  process.env.LOCKET_X_FIREBASE_GMPID ||
  "1:641029076083:ios:cc8eb46290d69b234fa606";

const baseIosHeaders = {
  "Content-Type": "application/json",
  "User-Agent":
    "FirebaseAuth.iOS/10.23.1 com.locket.Locket/1.82.0 iPhone/18.0 hw/iPhone12_1",
  "X-Ios-Bundle-Identifier": "com.locket.Locket",
};

const withFirebaseExtras = (extra = {}) => {
  const h = {
    ...baseIosHeaders,
    "Accept-Language": "en-US",
    "X-Client-Version": "iOS/FirebaseSDK/10.23.1/FirebaseCore-iOS",
    "X-Firebase-GMPID": X_FIREBASE_GMPID,
    "X-Firebase-Client": X_FIREBASE_CLIENT,
    ...extra,
  };
  if (APP_CHECK) h["X-Firebase-AppCheck"] = APP_CHECK;
  if (FCM_INSTANCE_ID) h["Firebase-Instance-ID-Token"] = FCM_INSTANCE_ID;
  return h;
};

const constants = {
  GET_ACCOUNT_INFO_URL: API_KEY
    ? `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${API_KEY}`
    : "",

  GET_ACCOUNT_INFO_URL_V2: `https://firestore.googleapis.com/v1/projects/locket-4252a/databases/(default)/documents/users/`,

  USER_AGENT: baseIosHeaders["User-Agent"],
  IOS_BUNDLE_ID: "com.locket.Locket",

  LOGIN_HEADERS: { ...baseIosHeaders },

  UPLOADER_HEADERS: {
    "content-type": "application/octet-stream",
    "x-goog-upload-protocol": "resumable",
    "x-goog-upload-offset": "0",
    "x-goog-upload-command": "upload, finalize",
    "upload-incomplete": "?0",
    "upload-draft-interop-version": "3",
    "user-agent":
      "com.locket.Locket/1.43.1 iPhone/17.3 hw/iPhone15_3 (GTMSUF/1)",
  },

  AUTH_HEADER: withFirebaseExtras(),

  POST_HEADER: (() => {
    const h = withFirebaseExtras();
    delete h["Content-Type"];
    return h;
  })(),

  SEND_HEADER: withFirebaseExtras({
    baggage:
      "sentry-environment=production,sentry-public_key=78fa64317f434fd89d9cc728dd168f50,sentry-release=com.locket.Locket%401.121.1%2B1,sentry-trace_id=2cdda588ea0041ed93d052932b127a3e",
    "sentry-trace": "2cdda588ea0041ed93d052932b127a3e-a3e2ba7a095d4f9d-0",
  }),

  SEND_HEADER2: {
    Host: "api.locketcamera.com",
    Accept: "*/*",
    baggage:
      "sentry-environment=production,sentry-public_key=78fa64317f434fd89d9cc728dd168f50,sentry-release=com.locket.Locket%401.121.1%2B1,sentry-trace_id=2cdda588ea0041ed93d052932b127a3e",
    "Accept-Language": "vi-VN,vi;q=0.9",
    "sentry-trace": "2cdda588ea0041ed93d052932b127a3e-a3e2ba7a095d4f9d-0",
    "User-Agent": "com.locket.Locket/1.121.1 iPhone/18.2 hw/iPhone12_1",
    Connection: "keep-alive",
    "Content-Type": "application/json",
    ...(FCM_INSTANCE_ID
      ? { "Firebase-Instance-ID-Token": FCM_INSTANCE_ID }
      : {}),
  },
};

module.exports = constants;
