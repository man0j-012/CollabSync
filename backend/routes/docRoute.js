// docRoute.js
const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { verifyAuth } = require("../middleware/auth");
const { getFirestore } = require("../firestore");
const Y = require("yjs");

// Import docs & getPersistence from crdtManager
const { docs, getPersistence } = require("../crdtManager");

const db = getFirestore();

/**
 * GET /api/documents
 * List all documents that the authenticated user either owns or collaborates on.
 * Sorted by updated_at DESC.
 */
router.get("/", verifyAuth, async (req, res) => {
  try {
    const userId = req.user.uid;

    // 1) Owned docs
    const ownedDocsSnapshot = await db
      .collection("documents")
      .where("owner_id", "==", userId)
      .get();

    const ownedDocs = ownedDocsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        owner_id: data.owner_id,
        created_at: data.created_at?.toDate?.() || null,
        updated_at: data.updated_at?.toDate?.() || null,
        userRole: "owner",
      };
    });

    // 2) Collaborator docs
    const allDocsSnapshot = await db.collection("documents").get();
    const collaboratorDocs = [];

    for (const doc of allDocsSnapshot.docs) {
      const collSnapshot = await doc.ref
        .collection("collaborators")
        .doc(userId)
        .get();

      if (collSnapshot.exists) {
        const data = doc.data();
        const collData = collSnapshot.data(); // { role: "editor"/"viewer" }
        collaboratorDocs.push({
          id: doc.id,
          title: data.title,
          owner_id: data.owner_id,
          created_at: data.created_at?.toDate?.() || null,
          updated_at: data.updated_at?.toDate?.() || null,
          userRole: collData.role,
        });
      }
    }

    // 3) Combine them, removing duplicates
    let combinedDocs = [...ownedDocs, ...collaboratorDocs];

    combinedDocs = Array.from(
      new Map(combinedDocs.map((d) => [d.id, d])).values()
    );

    // 4) Sort by updated_at (descending)
    combinedDocs.sort((a, b) => {
      const timeA = a.updated_at ? a.updated_at.getTime() : 0;
      const timeB = b.updated_at ? b.updated_at.getTime() : 0;
      return timeB - timeA; // newest first
    });

    return res.json(combinedDocs);
  } catch (error) {
    console.error("Error listing documents:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/documents/:id
 * Fetch a single document's metadata (and check user permission).
 */
router.get("/:id", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const docRef = db.collection("documents").doc(id);
    const docSnapshot = await docRef.get();
    if (!docSnapshot.exists) {
      return res.status(404).json({ error: "Document not found" });
    }

    const docData = docSnapshot.data();
    let userRole = null;

    if (docData.owner_id === userId) {
      userRole = "owner";
    } else {
      const collaboratorRef = docRef.collection("collaborators").doc(userId);
      const collaboratorSnapshot = await collaboratorRef.get();
      if (collaboratorSnapshot.exists) {
        userRole = collaboratorSnapshot.data().role; // "editor" or "viewer"
      }
    }

    if (!userRole) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json({
      id,
      title: docData.title,
      userRole,
      owner_id: docData.owner_id,
      created_at: docData.created_at?.toDate?.() || null,
      updated_at: docData.updated_at?.toDate?.() || null,
    });
  } catch (error) {
    console.error("Error fetching document:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/documents
 * Create a new document owned by the authenticated user.
 */
router.post("/", verifyAuth, async (req, res) => {
  try {
    const { title = "Untitled Document" } = req.body;
    const userId = req.user.uid;

    const docRef = db.collection("documents").doc();
    await docRef.set({
      title,
      owner_id: userId,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      id: docRef.id,
      title,
      userRole: "owner",
    });
  } catch (error) {
    console.error("Error creating document:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/documents/:id/share
 * Share the document with another user by email (must be owner).
 */
router.post("/:id/share", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role } = req.body;
    const userId = req.user.uid;

    if (!email || !["editor", "viewer"].includes(role)) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const docRef = db.collection("documents").doc(id);
    const docSnapshot = await docRef.get();
    if (!docSnapshot.exists) {
      return res.status(404).json({ error: "Document not found" });
    }

    const docData = docSnapshot.data();
    if (docData.owner_id !== userId) {
      return res
        .status(403)
        .json({ error: "Only the owner can share documents" });
    }

    // Find user by email in Firebase Auth
    const userRecord = await admin
      .auth()
      .getUserByEmail(email)
      .catch(() => null);
    if (!userRecord) {
      return res.status(404).json({ error: "User not found" });
    }

    const targetUserId = userRecord.uid;
    if (targetUserId === userId) {
      return res.status(400).json({ error: "Cannot share with yourself" });
    }

    // Add collaborator doc
    await docRef.collection("collaborators").doc(targetUserId).set({
      user_id: targetUserId,
      email,
      role,
      added_at: admin.firestore.FieldValue.serverTimestamp(),
      added_by: userId,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error sharing document:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document (only if user is the owner).
 * Also remove subcollections like "collaborators" and "snapshots".
 */
router.delete("/:id", verifyAuth, async (req, res) => {
  try {
    const { id: docId } = req.params;
    const userId = req.user.uid;

    // Check doc ownership
    const docRef = db.collection("documents").doc(docId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Document not found" });
    }
    const docData = docSnap.data();

    if (docData.owner_id !== userId) {
      return res
        .status(403)
        .json({ error: "Only the owner can delete documents" });
    }

    // Optional: remove subcollections "collaborators", "snapshots" first
    // Firestore doesn't automatically delete them with docRef.delete().
    // We'll do a quick loop to remove them.
    const collaboratorsRef = docRef.collection("collaborators");
    const collDocs = await collaboratorsRef.listDocuments();
    for (const c of collDocs) {
      await c.delete();
    }

    const snapshotsRef = docRef.collection("snapshots");
    const snapDocs = await snapshotsRef.listDocuments();
    for (const s of snapDocs) {
      await s.delete();
    }

    // Now delete the main doc
    await docRef.delete();

    // If we want to also remove the doc from memory (docs map),
    // do so if it exists there:
    const yDoc = docs.get(docId);
    if (yDoc) {
      // optional: yDoc.destroy(); // fully destroy Y.Doc
      docs.delete(docId);
    }

    // Return success
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/documents/:id/snapshots
 * List all snapshots for the given document, sorted by created_at DESC.
 */
router.get("/:id/snapshots", verifyAuth, async (req, res) => {
  try {
    const { id: docId } = req.params;
    const userId = req.user.uid;

    const docRef = db.collection("documents").doc(docId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Check permission (owner or collaborator).
    // We'll allow "viewer" to see snapshots if we want, or just "editor."
    const docData = docSnap.data();
    let allowed = false;
    if (docData.owner_id === userId) {
      allowed = true;
    } else {
      const collDoc = await docRef
        .collection("collaborators")
        .doc(userId)
        .get();
      if (collDoc.exists) {
        const role = collDoc.data().role;
        if (role === "editor" || role === "viewer") {
          allowed = true;
        }
      }
    }
    if (!allowed) {
      return res
        .status(403)
        .json({ error: "Not authorized to list snapshots" });
    }

    const snapshotRefs = await docRef
      .collection("snapshots")
      .orderBy("created_at", "desc")
      .get();

    const snapshots = snapshotRefs.docs.map((snapDoc) => {
      const snapData = snapDoc.data();
      return {
        id: snapDoc.id,
        created_at: snapData.created_at?.toDate?.() || null,
        user_id: snapData.user_id || null,
      };
    });

    return res.json(snapshots);
  } catch (error) {
    console.error("Error listing snapshots:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/documents/:id/snapshot
 * Create a new snapshot (version) of the current Y.Doc.
 */
router.post("/:id/snapshot", verifyAuth, async (req, res) => {
  try {
    const { id: docId } = req.params;
    const userId = req.user.uid;

    const docRef = db.collection("documents").doc(docId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Document not found" });
    }

    const docData = docSnap.data();
    let allowed = false;
    if (docData.owner_id === userId) {
      allowed = true;
    } else {
      const collDoc = await docRef
        .collection("collaborators")
        .doc(userId)
        .get();
      if (collDoc.exists) {
        const role = collDoc.data().role;
        if (role === "editor") {
          allowed = true;
        }
      }
    }
    if (!allowed) {
      return res.status(403).json({ error: "Not authorized to snapshot" });
    }

    const persistence = getPersistence();
    let ydoc = docs.get(docId);
    if (!ydoc) {
      ydoc = await persistence.getYDoc(docId);
      if (!ydoc) {
        return res.status(404).json({ error: "Doc not loaded" });
      }
      docs.set(docId, ydoc);
    }

    // Encode the doc's entire state
    const update = Y.encodeStateAsUpdate(ydoc);

    // Store in Firestore subcollection, base64-encoded
    const newSnapRef = docRef.collection("snapshots").doc();
    await newSnapRef.set({
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      user_id: userId,
      update: Buffer.from(update).toString("base64"),
    });

    return res.status(201).json({ snapshotId: newSnapRef.id });
  } catch (error) {
    console.error("Error creating snapshot:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/documents/:id/restore/:snapshotId
 * Restore the doc from a previously created snapshot.
 */
router.post("/:id/restore/:snapshotId", verifyAuth, async (req, res) => {
  try {
    const { id: docId, snapshotId } = req.params;
    const userId = req.user.uid;

    const docRef = db.collection("documents").doc(docId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Document not found" });
    }

    const docData = docSnap.data();
    let allowed = false;
    if (docData.owner_id === userId) {
      allowed = true;
    } else {
      const collDoc = await docRef
        .collection("collaborators")
        .doc(userId)
        .get();
      if (collDoc.exists) {
        const role = collDoc.data().role;
        if (role === "editor") {
          allowed = true;
        }
      }
    }
    if (!allowed) {
      return res.status(403).json({ error: "Not authorized to restore" });
    }

    // Get snapshot
    const snapDoc = await docRef.collection("snapshots").doc(snapshotId).get();
    if (!snapDoc.exists) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    const snapData = snapDoc.data();
    const updateBase64 = snapData.update;
    const update = Buffer.from(updateBase64, "base64");

    // Apply it to the Y.Doc
    const persistence = getPersistence();
    let ydoc = docs.get(docId);
    if (!ydoc) {
      ydoc = await persistence.getYDoc(docId);
      if (!ydoc) {
        return res.status(404).json({ error: "Doc not loaded" });
      }
      docs.set(docId, ydoc);
    }

    ydoc.transact(() => {
      Y.applyUpdate(ydoc, update);
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error restoring snapshot:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
