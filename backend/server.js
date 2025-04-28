// server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const WebSocket = require("ws");
const admin = require("firebase-admin");

// Firestore initialization
const { initializeFirebase, getFirestore } = require("./firestore");
initializeFirebase();
const db = getFirestore();

// Our crdtManager with the docs map & connect function
const { docs, connectMongoDB, getPersistence } = require("./crdtManager");

// The main Yjs-based WebSocket utility
const { setupWSConnection } = require("y-websocket/bin/utils");

// Bring in your Express routes
const documentRoutes = require("./routes/docRoute");

const app = express();
app.set("trust proxy", 1);

// CORS config
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Helmet config
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

// JSON parser
app.use(express.json());

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use("/api", apiLimiter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    firebaseInitialized: admin.apps.length > 0,
  });
});

// Document routes
app.use("/api/documents", documentRoutes);

// Document eviction settings
const DOC_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const docTimers = new Map();

function scheduleDocCleanup(docId) {
  if (docTimers.has(docId)) {
    clearTimeout(docTimers.get(docId));
  }
  const timer = setTimeout(() => {
    console.log(`[cleanup] Unloading inactive document: ${docId}`);
    docs.delete(docId);
    docTimers.delete(docId);
  }, DOC_TIMEOUT);
  docTimers.set(docId, timer);
}

function cancelDocCleanup(docId) {
  if (docTimers.has(docId)) {
    clearTimeout(docTimers.get(docId));
    scheduleDocCleanup(docId);
  }
}

// Create an HTTP server & WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Keep WebSocket connections alive
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);
wss.on("close", () => clearInterval(interval));

wss.on("connection", async (ws, req) => {
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  try {
    // Parse docId + token from URL (ws://localhost:1234/docId?token=xxx)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const docId = url.pathname.slice(1) || "default-doc";
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "Unauthorized: No token provided");
      return;
    }

    // Verify Firebase ID token
    let userId, userEmail;
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      userId = decodedToken.uid;
      userEmail = decodedToken.email || "Unknown";
    } catch (err) {
      console.error("Token verification failed:", err.message);
      ws.close(4001, "Unauthorized: Invalid token");
      return;
    }

    // Check doc ownership / role
    const docRef = db.collection("documents").doc(docId);
    const docSnap = await docRef.get();
    let userRole = null;

    if (!docSnap.exists) {
      // create doc metadata if it doesn't exist
      await docRef.set({
        title: "Untitled Document",
        owner_id: userId,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      userRole = "owner";
    } else {
      const docData = docSnap.data();
      if (docData.owner_id === userId) {
        userRole = "owner";
      } else {
        const collSnap = await docRef
          .collection("collaborators")
          .doc(userId)
          .get();
        if (collSnap.exists) {
          userRole = collSnap.data().role; // "editor" or "viewer"
        }
      }
    }

    // If user still has no role, default to "viewer"
    if (!userRole) {
      await docRef.collection("collaborators").doc(userId).set({
        user_id: userId,
        email: userEmail,
        role: "viewer",
        added_at: admin.firestore.FieldValue.serverTimestamp(),
        added_by: "system",
      });
      userRole = "viewer";
    }

    // Check if doc is already loaded
    let ydoc = docs.get(docId);
    if (!ydoc) {
      console.log(`[load] Loading document ${docId} from MongoDB`);
      const persistence = getPersistence();
      try {
        ydoc = await persistence.getYDoc(docId);
        docs.set(docId, ydoc);

        // Store updates to Mongo
        ydoc.on("update", (update) => {
          try {
            persistence.storeUpdate(docId, update);
            docRef
              .update({
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
              })
              .catch((err) => console.error(`Error updating timestamp:`, err));
          } catch (err) {
            console.error(`Error storing update:`, err);
          }
        });
      } catch (err) {
        console.error(`Error loading doc from Mongo:`, err);
        ws.close(4000, "Error loading document");
        return;
      }
    } else {
      console.log(`[cache] Using cached document ${docId}`);
    }

    // Reset inactivity timer
    cancelDocCleanup(docId);

    // Let y-websocket handle real-time CRDT logic
    setupWSConnection(ws, req, {
      docName: docId,
      getDoc: () => docs.get(docId),
      readOnly: userRole === "viewer",
      gc: true,
      logging: true,
    });

    // On socket close, schedule doc cleanup
    ws.on("close", () => {
      scheduleDocCleanup(docId);
    });
  } catch (error) {
    console.error("WebSocket connection error:", error);
    ws.close(4000, "Connection error");
  }
});

/**
 * Start the server with MongoDB connection
 */
async function startServer() {
  const connected = await connectMongoDB(
    process.env.MONGO_URI,
    process.env.MONGO_DB_NAME
  );
  if (!connected) {
    console.error("Cannot start server without MongoDB");
    process.exit(1);
  }
  const PORT = process.env.PORT || 1234;
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
  });
}

startServer();
