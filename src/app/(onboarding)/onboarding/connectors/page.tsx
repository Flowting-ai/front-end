"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/context/onboarding-context";
import { useAuth } from "@/context/auth-context";
import { OnboardingScreen, OnboardingFooter } from "../_components/onboarding-shell";

// ── Connector definitions ───────────────────────────────────────────────────────

type ConnectorDef = {
  id: string;
  name: string;
  category: string;
  logoPath: string;
};

const CONNECTORS: ConnectorDef[] = [
  { id: "slack",              name: "Slack",         category: "Messaging",            logoPath: "/connector-logos/slack.svg"              },
  { id: "google-sheets",      name: "Google Sheets", category: "Productivity",         logoPath: "/connector-logos/google-sheets.svg"      },
  { id: "notion",             name: "Notion",        category: "Productivity",         logoPath: "/connector-logos/notion.svg"             },
  { id: "stripe",             name: "Stripe",        category: "Payments",             logoPath: "/connector-logos/stripe.svg"             },
  { id: "clickup",            name: "ClickUp",       category: "Project Management",   logoPath: "/connector-logos/clickup.svg"            },
  { id: "google-drive",       name: "Google Drive",  category: "Storage",              logoPath: "/connector-logos/google-drive.svg"       },
  { id: "microsoft-onedrive", name: "OneDrive",      category: "Storage",              logoPath: "/connector-logos/microsoft-onedrive.svg" },
  { id: "dropbox",            name: "Dropbox",       category: "Storage",              logoPath: "/connector-logos/dropbox.svg"            },
];

// ── Card ────────────────────────────────────────────────────────────────────────

function ConnectorCard({
  connector,
  selected,
  onClick,
}: {
  connector: ConnectorDef;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        padding: "16px",
        borderRadius: "16px",
        border: "none",
        cursor: "pointer",
        outline: "none",
        backgroundColor: selected ? "var(--neutral-800, #3b3632)" : "var(--neutral-white, #fff)",
        boxShadow:
          "0px 2px 2.8px 0px var(--neutral-200, #d1c6bd), 0px 0px 0px 1px var(--neutral-200, #d1c6bd)",
        flex: "1 1 0",
        minWidth: 0,
        textAlign: "left",
        transition: "background-color 120ms",
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 38,
          height: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={connector.logoPath}
          alt={connector.name}
          width={32}
          height={32}
          style={{ display: "block", objectFit: "contain" }}
        />
      </div>

      {/* Name */}
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          fontSize: 14,
          lineHeight: "22px",
          color: selected ? "var(--neutral-50, #f7f2ed)" : "var(--neutral-900, #26211e)",
          margin: "8px 0 0",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          width: "100%",
        }}
      >
        {connector.name}
      </p>

      {/* Category */}
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          fontSize: 11,
          lineHeight: "16px",
          color: selected ? "var(--neutral-200, #d1c6bd)" : "var(--neutral-500, #827a74)",
          margin: "2px 0 0",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          width: "100%",
        }}
      >
        {connector.category}
      </p>
    </button>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function OnboardingConnectorsPage() {
  const { push } = useRouter();
  const { logout } = useAuth();
  const { setConnectorCount } = useOnboarding();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <OnboardingScreen
      title="What does your team use?"
      subtitle="We'll queue these connectors so your workspace is ready to act."
      width={653}
      footer={
        <OnboardingFooter
          onBack={() => push("/onboarding/workspace")}
          onContinue={() => {
            setConnectorCount(selected.size);
            push("/onboarding/invite");
          }}
          leftSlot={
            <button
              type="button"
              onClick={() => void logout()}
              style={{ background: "none", border: "none", padding: "4px 0", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, color: "#0d6eb2", textDecoration: "underline" }}
            >
              Log out
            </button>
          }
        />
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
        }}
      >
        {CONNECTORS.map((connector) => (
          <ConnectorCard
            key={connector.id}
            connector={connector}
            selected={selected.has(connector.id)}
            onClick={() => toggle(connector.id)}
          />
        ))}
      </div>
    </OnboardingScreen>
  );
}
