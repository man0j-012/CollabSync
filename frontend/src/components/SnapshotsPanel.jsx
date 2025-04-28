import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useParams } from "react-router-dom";
import { Box, Typography, Button, Paper } from "@mui/material";

export default function SnapshotsPanel() {
  const { docId } = useParams();
  const { getIdToken } = useContext(AuthContext);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (docId) fetchSnapshots();
  }, [docId]);

  async function fetchSnapshots() {
    setLoading(true);
    const token = await getIdToken();
    const resp = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/documents/${docId}/snapshots`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) setSnapshots(await resp.json());
    setLoading(false);
  }

  async function createSnapshot() {
    const token = await getIdToken();
    const resp = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/documents/${docId}/snapshot`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) fetchSnapshots();
  }

  async function restoreSnapshot(id) {
    if (!window.confirm("Restore this snapshot?")) return;
    const token = await getIdToken();
    await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/documents/${docId}/restore/${id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    alert("Snapshot restored!");
  }

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6">Document Snapshots</Typography>
      <Button variant="contained" size="small" onClick={createSnapshot} disabled={loading}>
        Create Snapshot
      </Button>
      {snapshots.map((snap) => (
        <Box key={snap.id} sx={{ mt: 1, p: 1, border: "1px solid #ddd" }}>
          <Typography>ID: {snap.id}</Typography>
          <Typography>Created At: {snap.created_at}</Typography>
          <Typography>User ID: {snap.user_id}</Typography>
          <Button size="small" onClick={() => restoreSnapshot(snap.id)}>
            Restore
          </Button>
        </Box>
      ))}
      {!loading && !snapshots.length && <Typography>No snapshots</Typography>}
    </Paper>
  );
}
