"use client";

import React from "react";

// ── Screen 5 — first-time "You just joined {team}" landing ──────────────────────
// Rendered on /chat?joined=<team> right after an invitee finishes the team-invite
// flow. Swaps the default greeting + template cards on the new-chat landing for a
// team-welcome heading and a short "Todo" set of orientation cards.

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" stroke="var(--yellow-500,#caa23a)" strokeWidth="1.6" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" stroke="var(--yellow-500,#caa23a)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

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
        maxWidth: "720px",
        margin: "0 auto",
        userSelect: "none",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-title)",
          fontSize: "36px",
          fontWeight: 300,
          color: "var(--neutral-800,#3b3632)",
          margin: "0 0 12px",
          lineHeight: 1.2,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG glyph */}
        <img
          src="/icons/souvenir-logo-gray.svg"
          alt=""
          aria-hidden="true"
          width={32}
          height={32}
          style={{ display: "inline-block", verticalAlign: "middle", marginRight: "12px" }}
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
          maxWidth: "560px",
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
}

function buildCards(teamName: string): TodoCard[] {
  return [
    {
      title: "Your personal workspace",
      body: "Use the whole product as your own personal operating system — unified chatspace, personal projects, and a Brain that remembers everything. Entirely yours.",
      tags: ["Unified chatspace", "Personal projects", "Your Brain"],
    },
    {
      title: "Step into team projects",
      body: "Open shared project folders and put the team's AI Assistants to work right inside them. Same workspace, shared context.",
      tags: ["Shared project folders", "Team AI Assistants"],
    },
    {
      title: "Publish a chat to your team",
      body: `Publish any chat to ${teamName} with its Pins and context intact — so everyone works from the same source.`,
      tags: ["Keeps Pins", "Keeps context"],
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
        backgroundColor: "rgba(13,110,178,0.08)",
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
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "var(--neutral-white,#fff)",
        border: "1px solid var(--neutral-100,#ede1d7)",
        borderRadius: 14,
        padding: 18,
        boxShadow: "0px 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <CalendarIcon />
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
    <div style={{ width: "100%", marginTop: 32 }}>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--neutral-500,#827a74)",
          margin: "0 0 10px",
          textAlign: "left",
        }}
      >
        Todo
      </p>
      <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        {cards.map((c) => (
          <CardView key={c.title} card={c} />
        ))}
      </div>
    </div>
  );
}
