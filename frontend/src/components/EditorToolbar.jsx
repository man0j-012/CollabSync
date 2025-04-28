import React from "react";
import { Box, IconButton, Tooltip, FormControl, Select, MenuItem } from "@mui/material";
import {
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  Image,
} from "@mui/icons-material";

export default function EditorToolbar({ editor }) {
  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt("Enter image URL");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <Box sx={{ display: "flex", gap: 1, p: 1, borderBottom: "1px solid #eee" }}>
      <Tooltip title="Bold">
        <IconButton onClick={() => editor.chain().focus().toggleBold().run()} size="small">
          <FormatBold />
        </IconButton>
      </Tooltip>
      <Tooltip title="Italic">
        <IconButton onClick={() => editor.chain().focus().toggleItalic().run()} size="small">
          <FormatItalic />
        </IconButton>
      </Tooltip>
      <Tooltip title="Underline">
        <IconButton onClick={() => editor.chain().focus().toggleUnderline().run()} size="small">
          <FormatUnderlined />
        </IconButton>
      </Tooltip>
      <Tooltip title="Align Left">
        <IconButton onClick={() => editor.chain().focus().setTextAlign("left").run()} size="small">
          <FormatAlignLeft />
        </IconButton>
      </Tooltip>
      <Tooltip title="Align Center">
        <IconButton onClick={() => editor.chain().focus().setTextAlign("center").run()} size="small">
          <FormatAlignCenter />
        </IconButton>
      </Tooltip>
      <Tooltip title="Align Right">
        <IconButton onClick={() => editor.chain().focus().setTextAlign("right").run()} size="small">
          <FormatAlignRight />
        </IconButton>
      </Tooltip>
      <Tooltip title="Insert Image">
        <IconButton onClick={addImage} size="small">
          <Image />
        </IconButton>
      </Tooltip>
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <Select
          value={editor.getAttributes("textStyle").color || ""}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        >
          <MenuItem value="">Default</MenuItem>
          <MenuItem value="#000000">Black</MenuItem>
          <MenuItem value="#FF0000">Red</MenuItem>
          <MenuItem value="#0000FF">Blue</MenuItem>
          <MenuItem value="#008000">Green</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
}
