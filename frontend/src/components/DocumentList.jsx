import React from "react";
import { List, ListItem, ListItemText, Typography, Paper } from "@mui/material";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function DocumentList({ documents }) {
  const navigate = useNavigate();

  if (!documents.length) {
    return (
      <Paper sx={{ p: 3, textAlign: "center" }}>
        <Typography>No documents found.</Typography>
      </Paper>
    );
  }

  return (
    <List>
      {documents.map((doc) => (
        <ListItem key={doc.id} button onClick={() => navigate(`/document/${doc.id}`)}>
          <ListItemText primary={doc.title || "Untitled"} secondary={`Role: ${doc.userRole}`} />
          <Typography variant="caption" color="textSecondary">
            {doc.updated_at ? format(new Date(doc.updated_at), "MMM d, yyyy h:mm a") : "Unknown"}
          </Typography>
        </ListItem>
      ))}
    </List>
  );
}
