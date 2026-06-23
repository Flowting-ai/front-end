"use client";

import React, { useState } from "react";
import Image from "next/image";
import { BrainTwoIcon, FolderOneIcon, ShareOneIcon } from "@strange-huge/icons";

// ── Screen 5 — first-time "You just joined {team}" landing ──────────────────────
// Rendered on /chat?joined=<team> right after an invitee finishes the team-invite
// flow. Swaps the default greeting + template cards on the new-chat landing for a
// team-welcome heading and a short "Todo" set of orientation cards.
//
// Visuals track the standard new-chat landing (InitialPrompts greeting +
// TemplateCard cards) so the joined screen reads as the same surface.

/** Big serif team-welcome heading with the Souvenir glyph, mirroring InitialPrompts. */
export function JoinedGreeting({ teamName }: { teamName: string }) {
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
        userSelect: "none",
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
        <Image
          src="/icons/souvenir-logo-gray.svg"
          alt=""
          aria-hidden="true"
          width={28}
          height={28}
          unoptimized
          style={{ display: "inline-block", verticalAlign: "middle", marginRight: "10px" }}
        />
        You just joined {teamName}
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "16px",
          fontWeight: 400,
          color: "#3B3632",
          margin: 0,
          lineHeight: 1.5,
          maxWidth: "480px",
        }}
      >
        Use the whole product as your own personal operating system. Chat across models in the unified
        chatspace, spin up personal projects, and build a Brain that remembers everything, entirely your own.
      </p>
    </div>
  );
}

interface TodoCard {
  title: string;
  body: string;
  tags: string[];
  icon: React.ReactNode;
}

function buildCards(teamName: string): TodoCard[] {
  return [
    {
      title: "Your personal workspace",
      body: "Use the whole product as your own personal operating system — unified chatspace, personal projects, and a Brain that remembers everything. Entirely yours.",
      tags: ["Unified chatspace", "Personal projects", "Your Brain"],
      icon: <BrainTwoIcon size={22} color="var(--blue-700,#135487)" animated />,
    },
    {
      title: "Step into team projects",
      body: "Open shared project folders and put the team's AI Assistants to work right inside them. Same workspace, shared context.",
      tags: ["Shared project folders", "Team AI Assistants"],
      icon: <FolderOneIcon size={22} color="var(--blue-700,#135487)" animated />,
    },
    {
      title: "Publish a chat to your team",
      body: `Publish any chat to ${teamName} with its Pins and context intact — so everyone works from the same source.`,
      tags: ["Keeps Pins", "Keeps context"],
      icon: <ShareOneIcon size={22} color="var(--blue-700,#135487)" animated />,
    },
  ];
}

function Tag({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "12px",
        fontWeight: 500,
        lineHeight: "16px",
        color: "var(--blue-700,#135487)",
        backgroundColor: "rgba(13,84,135,0.08)",
        borderRadius: 8,
        padding: "3px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function CardView({ card }: { card: TodoCard }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "white",
        border: `1px solid ${isHovered ? "var(--neutral-300)" : "var(--neutral-200)"}`,
        borderRadius: 12,
        padding: "16px",
        boxShadow: isHovered ? "0 2px 8px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "box-shadow 150ms, border-color 150ms",
      }}
    >
      <div style={{ flexShrink: 0 }}>{card.icon}</div>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "15px",
          fontWeight: 600,
          color: "var(--neutral-900,#26211e)",
          margin: 0,
          lineHeight: "22px",
        }}
      >
        {card.title}
      </p>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "13px",
          fontWeight: 400,
          color: "var(--neutral-600,#6a625d)",
          margin: 0,
          lineHeight: "19px",
        }}
      >
        {card.body}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
        {card.tags.map((t) => (
          <Tag key={t} label={t} />
        ))}
      </div>
    </div>
  );
}

/** The "Todo" orientation cards shown on the first-time joined landing. */
export function JoinedTodos({ teamName }: { teamName: string }) {
  const cards = buildCards(teamName);
  return (
    <div style={{ width: "100%", marginTop: 28 }}>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--neutral-500)",
          margin: "0 0 10px",
          textAlign: "left",
        }}
      >
        Todo
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
        {cards.map((c) => (
          <CardView key={c.title} card={c} />
        ))}
      </div>
    </div>
  );
}
