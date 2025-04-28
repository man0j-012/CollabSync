const { initializeFirebase } = require("./config/firebase");

const admin = initializeFirebase();
const db = admin.firestore();

function getFirestore() {
  return db;
}

module.exports = {
  initializeFirebase,
  getFirestore,
};
