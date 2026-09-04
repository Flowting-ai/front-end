"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/context/onboarding-context";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/Button";
import { ConnectorGlyph } from "@/components/ConnectorGlyph";
import { getConnector } from "@/lib/api/connectors";
import { OnboardingScreen, OnboardingFooter } from "../_components/onboarding-shell";
import { ONBOARDING_INVITE_ROUTE, ONBOARDING_WORKSPACE_ROUTE } from "@/lib/routes";

// ── Connector definitions ───────────────────────────────────────────────────────

type ConnectorDef = {
  id: string;
  name: string;
  category: string;
};

// id = backend connector slug (must match exactly what the API expects). The
// logo is not listed here — it comes from each entry's catalog logo_url,
// fetched below, so this screen shows the same image as every other surface.
const CONNECTORS: ConnectorDef[] = [
  { id: "slack",        name: "Slack",         category: "Messaging"          },
  { id: "googlesheets", name: "Google Sheets", category: "Productivity"       },
  { id: "notion",       name: "Notion",        category: "Productivity"       },
  { id: "stripe",       name: "Stripe",        category: "Payments"           },
  { id: "clickup",      name: "ClickUp",       category: "Project Management" },
  { id: "googledrive",  name: "Google Drive",  category: "Storage"            },
  { id: "one_drive",    name: "OneDrive",      category: "Storage"            },
  { id: "gmail",        name: "Gmail",         category: "Messaging"          },
];

// ── Card ────────────────────────────────────────────────────────────────────────

function ConnectorCard({
  connector,
  logoUrl,
  logoPending,
  selected,
  onClick,
}: {
  connector: ConnectorDef;
  logoUrl: string | null;
  logoPending: boolean;
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
        {logoPending ? (
          <span className="kaya-skeleton" style={{ display: "block", width: 32, height: 32, borderRadius: 8 }} />
        ) : (
          <ConnectorGlyph slug={connector.id} name={connector.name} logoUrl={logoUrl} size={32} />
        )}
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
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [continuing, setContinuing] = useState(false);
  const [logos,      setLogos]      = useState<Map<string, string | null> | null>(null);

  // Logos come from the catalog, never from a bundled asset. One detail call
  // per curated slug, all in flight together; a slug the catalog doesn't carry
  // resolves to null and ConnectorGlyph renders its letter tile.
  useEffect(() => {
    let cancelled = false;
    void Promise.all(CONNECTORS.map(async (c) => {
      try {
        return [c.id, (await getConnector(c.id)).logoUrl] as const;
      } catch {
        return [c.id, null] as const;
      }
    })).then((pairs) => {
      if (!cancelled) setLogos(new Map(pairs));
    });
    return () => { cancelled = true };
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // There is no backend call left that "enables" a connector for a workspace
  // ahead of time — Workspace Model v2 dropped the per-Team connector-request
  // approval this used to file against, and connecting one for real requires
  // credentials this step never collects. So this step is selection-only:
  // record the pick for onboarding UI copy elsewhere, then let the user set
  // up each connector for real from Settings → Connectors after onboarding.
  function handleContinue() {
    setContinuing(true);
    setConnectorCount(selected.size);
    push(ONBOARDING_INVITE_ROUTE);
  }

  return (
    <OnboardingScreen
      title="What does your team use?"
      subtitle="We'll queue these connectors so your workspace is ready to act."
      width={653}
      footer={
        <OnboardingFooter
          onBack={() => push(ONBOARDING_WORKSPACE_ROUTE)}
          onContinue={() => void handleContinue()}
          continueDisabled={continuing}
          continueLoading={continuing}
          leftSlot={
            <Button variant="default" size="sm" onClick={() => void logout()} leftIcon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M13 3v10M6.5 10.5 3.5 8l3-2.5M3.5 8H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}>
              Log out
            </Button>
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
            logoUrl={logos?.get(connector.id) ?? null}
            logoPending={logos === null}
            selected={selected.has(connector.id)}
            onClick={() => toggle(connector.id)}
          />
        ))}
      </div>
    </OnboardingScreen>
  );
}
