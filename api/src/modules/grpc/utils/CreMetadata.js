const grpc = require("@grpc/grpc-js");

function createMetadata(idToken, dbName) {
  const metadata = new grpc.Metadata();
  metadata.add("Authorization", `Bearer ${idToken}`);
  metadata.add(
    "google-cloud-resource-prefix",
    `projects/locket-4252a/databases/${dbName}`,
  );
  metadata.add("content-type", "application/grpc");
  metadata.add("grpc-accept-encoding", "gzip");
  metadata.add("te", "trailers");
  metadata.add("user-agent", "grpc-java-okhttp/1.62.2");
  return metadata;
}

module.exports = { createMetadata };
