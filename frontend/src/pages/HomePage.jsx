import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import DocumentList from "../components/DocumentList";
import { Button, Typography, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const { user, getIdToken } = useContext(AuthContext);
  const [documents, setDocuments] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) fetchDocs();
  }, [user]);

  async function fetchDocs() {
    const token = await getIdToken();
    const res = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/documents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setDocuments(await res.json());
  }

  async function createNew() {
    const token = await getIdToken();
    const res = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Document" }),
    });
    if (res.ok) {
      const newDoc = await res.json();
      navigate(`/document/${newDoc.id}`);
    }
  }

  return (
    <Box sx={{ maxWidth: 800, m: "auto", p: 2 }}>
      <Typography variant="h4" gutterBottom>
        My Documents
      </Typography>
      <Button variant="contained" onClick={createNew} sx={{ mb: 2 }}>
        Create New Document
      </Button>
      <DocumentList documents={documents} />
    </Box>
  );
}
