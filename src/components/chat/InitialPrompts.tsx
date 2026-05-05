"use client";

import { useState, useEffect } from "react";
import { getGreeting, getSubheading } from "@/lib/greetings";
import { useAuth } from "@/context/auth-context";

export function InitialPrompts() {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState("");
  const [subheading, setSubheading] = useState("");

  useEffect(() => {
    const name = user?.firstName || user?.name || "there";
    setGreeting(getGreeting(name));
    setSubheading(getSubheading());
  }, [user]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      {/* Greeting */}
      <h1
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "24px",
          fontWeight: "var(--font-weight-semibold)",
          color: "var(--neutral-900)",
          margin: "0 0 8px",
          lineHeight: 1.3,
        }}
      >
        {greeting}
      </h1>

      {/* Subheading */}
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--font-size-body-md)",
          color: "var(--neutral-500)",
          margin: "0",
          lineHeight: 1.5,
          maxWidth: "480px",
        }}
      >
        {subheading}
      </p>
    </div>
  );
}
