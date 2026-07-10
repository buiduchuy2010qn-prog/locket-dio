const { instanceAppcheck } = require("./instanceAppcheck");
const { instanceFirebaseV2 } = require("./instanceFirebase");
const {
  instanceFirestore,
  instanceFirestoreUpload,
  instanceFirestoreInit,
  instanceFirestoreGet,
} = require("./instanceFirestore");
const { createGoogleInstance } = require("./instanceGoogleBase");
const { instanceLocketV2 } = require("./instanceLocket");
const { instanceStorage } = require("./instanceStorage");

module.exports = {
  instanceFirebaseV2,
  instanceFirestore,
  instanceFirestoreInit,
  instanceFirestoreUpload,
  instanceFirestoreGet,
  instanceLocketV2,
  instanceAppcheck,
  createGoogleInstance,
  instanceStorage,
};
