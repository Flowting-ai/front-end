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
        padding: "0 24px",
        textAlign: "center",
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-title)",
          fontSize: "28px",
          fontWeight: 200,
          color: "var(--neutral-800)",
          margin: "0 0 6px",
          lineHeight: 1.25,
        }}
      >
        <img
          src="/icons/souvenir-logo-gray.svg"
          alt=""
          aria-hidden="true"
          width={28}
          height={28}
          style={{
            display: "inline-block",
            verticalAlign: "middle",
            marginRight: "10px",
          }}
        />
        {greeting}
      </h1>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "16px",
          fontWeight: 400,
          color: "var(--neutral-800)",
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
