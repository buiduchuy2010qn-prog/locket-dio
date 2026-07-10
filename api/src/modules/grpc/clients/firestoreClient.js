const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

const PROTO_PATH = path.resolve(
  process.cwd(),
  "google/firestore/v1/firestore.proto"
);

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [
    path.resolve(process.cwd(), "google"),
    path.resolve(process.cwd(), "src"),
    path.resolve(process.cwd(), "."),
  ],
});

const loaded = grpc.loadPackageDefinition(packageDefinition);
const firestoreProto = loaded.google.firestore.v1;

const client = new firestoreProto.Firestore(
  "firestore.googleapis.com:443",
  grpc.credentials.createSsl()
);

module.exports = { client };
