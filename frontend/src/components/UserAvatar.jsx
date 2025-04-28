import React from "react";
import { Avatar, Tooltip } from "@mui/material";

export default function UserAvatar({ user, size = 40 }) {
  if (!user) return null;
  const name = user.displayName || user.email;
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  return (
    <Tooltip title={name}>
      <Avatar sx={{ bgcolor: "primary.main", width: size, height: size, fontSize: size * 0.4 }}>
        {initials}
      </Avatar>
    </Tooltip>
  );
}
