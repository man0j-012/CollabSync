import React, { useContext, useEffect, useState, useMemo, useCallback } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { getYDoc, destroyYDoc } from "../utils/ydoc";
import { AuthContext } from "../contexts/AuthContext";
import EditorToolbar from "./EditorToolbar";
import SnapshotsPanel from "./SnapshotsPanel";
import UserAvatar from "./UserAvatar";
import { Box, Chip, Avatar, Button, Alert } from "@mui/material";
import { useParams } from "react-router-dom";

const CollaborativeEditor = ({ setDocTitle }) => {
  const { docId = "default-doc" } = useParams();
  const { user, getIdToken } = useContext(AuthContext);
  const [status, setStatus] = useState("connecting");
  const [provider, setProvider] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [error, setError] = useState(null);

  const ydoc = useMemo(() => getYDoc(docId), [docId]);
  const userColor = useMemo(() => {
    if (!user?.email) return "#666";
    let hash = 0;
    for (let i = 0; i < user.email.length; i++) hash = user.email.charCodeAt(i) + ((hash << 5) - hash);
    return "#" + (hash & 0x00ffffff).toString(16).padStart(6, "0");
  }, [user]);

  const setupProvider = useCallback(async () => {
    const token = await getIdToken(true);
    const ws = new WebsocketProvider(process.env.REACT_APP_WEBSOCKET_ENDPOINT, docId, ydoc, {
      params: { token },
    });
    ws.on("status", ({ status }) => setStatus(status));
    ws.on("sync", (synced) => synced && setError(null));
    ws.awareness.setLocalStateField("user", { name: user.email, color: userColor });
    ws.awareness.on("change", () => {
      const states = Array.from(ws.awareness.getStates().values()).map((s) => s.user);
      setActiveUsers(states);
    });
    setProvider(ws);
    return ws;
  }, [docId, getIdToken, user, userColor, ydoc]);

  useEffect(() => {
    if (!user) return;
    setupProvider();
    return () => destroyYDoc(docId);
  }, [user, setupProvider, docId]);

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Underline,
      Image,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
      Collaboration.configure({ document: ydoc }),
      ...(provider
        ? [CollaborationCursor.configure({ provider, user: { name: user.email, color: userColor } })]
        : []),
    ],
    editable: userRole !== "viewer",
    content: "<p>Start typing...</p>",
  });

  useEffect(() => {
    (async () => {
      const token = await getIdToken();
      const res = await fetch(`${process.env.REACT_APP_API_ENDPOINT}/api/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserRole(data.userRole);
        data.title && setDocTitle(data.title);
      }
    })();
  }, [docId, getIdToken, setDocTitle]);

  if (!editor) return <p>Loading editor...</p>;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ p: 1, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
        <Box>
          {activeUsers.map((u, idx) => (
            <Chip
              key={idx}
              label={u.name}
              avatar={<Avatar sx={{ bgcolor: u.color }}>{u.name.charAt(0)}</Avatar>}
              size="small"
            />
          ))}
        </Box>
        <Chip label={`Role: ${userRole}`} size="small" />
        <Chip
          label={status === "connected" ? "Connected" : "Reconnecting"}
          size="small"
          color={status === "connected" ? "success" : "warning"}
        />
      </Box>
      {userRole !== "viewer" && <EditorToolbar editor={editor} />}
      <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
        <EditorContent editor={editor} />
      </Box>
      <SnapshotsPanel />
    </Box>
  );
};

export default CollaborativeEditor;
