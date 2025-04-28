import React, { useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { Button, Typography, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const { signInWithGoogle } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async () => {
    await signInWithGoogle();
    navigate("/");
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <Typography variant="h3" gutterBottom>
        Collaborative Editor
      </Typography>
      <Button variant="contained" size="large" onClick={handleLogin}>
        Sign in with Google
      </Button>
    </Box>
  );
}
