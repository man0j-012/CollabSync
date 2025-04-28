import React, { useState } from "react";
import { useParams } from "react-router-dom";
import CollaborativeEditor from "../components/CollaborativeEditor";
import { Box, Typography } from "@mui/material";

export default function DocumentPage() {
  const { docId } = useParams();
  const [docTitle, setDocTitle] = useState("");

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 2 }}>
      <Typography variant="h4" gutterBottom>
        {docTitle || `Document: ${docId}`}
      </Typography>
      <CollaborativeEditor docId={docId} setDocTitle={setDocTitle} />
    </Box>
  );
}
