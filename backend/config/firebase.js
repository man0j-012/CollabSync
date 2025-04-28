const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

function initializeFirebase() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin SDK initialized");
  }
  return admin;
}

module.exports = { initializeFirebase };
