// crdtManager.js
const { MongodbPersistence } = require("y-mongodb");

// In-memory documents map
const docs = new Map();

// We'll set this once we connect to MongoDB
let persistence = null;

/**
 * Connect to MongoDB and set up y-mongodb.
 * @param {string} mongoUri - "mongodb://127.0.0.1:27017"
 * @param {string} dbName   - "myYjsDB"
 */
async function connectMongoDB(mongoUri, dbName) {
  try {
    persistence = new MongodbPersistence(mongoUri, dbName);
    console.log("Successfully connected to MongoDB for CRDT storage");
    return true;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    return false;
  }
}

/**
 * Getter for the persistence object,
 * so we can do: getPersistence().getYDoc(...)
 */
function getPersistence() {
  return persistence;
}

module.exports = {
  docs,
  getPersistence,
  connectMongoDB,
};
