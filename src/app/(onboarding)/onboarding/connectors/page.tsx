"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/context/onboarding-context";
import { useAuth } from "@/context/auth-context";
import { listOrgCatalog, updateOrgCatalog } from "@/lib/api/connectors";
import { listOrganizations } from "@/lib/api/organization";
import { toast } from "sonner";
import { OnboardingScreen, OnboardingFooter } from "../_components/onboarding-shell";

// ── Connector definitions ───────────────────────────────────────────────────────

type ConnectorDef = {
  id: string;
  name: string;
  category: string;
  logoPath: string;
};

// id = backend connector slug (must match exactly what the API expects).
// logoPath = local public asset path (independent of the slug format).
const CONNECTORS: ConnectorDef[] = [
  { id: "slack",        name: "Slack",         category: "Messaging",          logoPath: "/connector-logos/slack.svg"              },
  { id: "googlesheets", name: "Google Sheets", category: "Productivity",       logoPath: "/connector-logos/google-sheets.svg"      },
  { id: "notion",       name: "Notion",        category: "Productivity",       logoPath: "/connector-logos/notion.svg"             },
  { id: "stripe",       name: "Stripe",        category: "Payments",           logoPath: "/connector-logos/stripe.svg"             },
  { id: "clickup",      name: "ClickUp",       category: "Project Management", logoPath: "/connector-logos/clickup.svg"            },
  { id: "googledrive",  name: "Google Drive",  category: "Storage",            logoPath: "/connector-logos/google-drive.svg"       },
  { id: "one_drive",    name: "OneDrive",      category: "Storage",            logoPath: "/connector-logos/microsoft-onedrive.svg" },
  { id: "dropbox",      name: "Dropbox",       category: "Storage",            logoPath: "/connector-logos/dropbox.svg"            },
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
  const { logout, user } = useAuth();
  const { setConnectorCount } = useOnboarding();
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [continuing, setContinuing] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function handleContinue() {
    setContinuing(true);
    if (selected.size > 0) {
      try {
        // user.orgId is often absent from /users/me — fall back to listOrganizations.
        let resolvedOrgId = user?.orgId ?? null;
        if (!resolvedOrgId) {
          const orgs = await listOrganizations();
          resolvedOrgId = orgs[0]?.id ?? null;
        }
        if (resolvedOrgId) {
          // Use the org catalog (not GET /connectors which is personal-only and
          // returns empty for new accounts) to determine which slugs the backend
          // actually knows about — prevents 400s for inactive/unknown connectors.
          const orgCatalog = await listOrgCatalog(resolvedOrgId);
          let validSlugs: string[];
          if (orgCatalog.length > 0) {
            const knownSlugs = new Set(orgCatalog.map(c => c.slug));
            validSlugs = [...selected].filter(s => knownSlugs.has(s));
          } else {
            // Org catalog not yet populated — send all selected and let the backend validate.
            validSlugs = [...selected];
          }
          if (validSlugs.length > 0) {
            await updateOrgCatalog(resolvedOrgId, validSlugs);
            toast.success("Connectors enabled for your organization");
          }
        }
      } catch {
        toast.error("Couldn't enable connectors — you can adjust them later in Org → Connectors.");
      }
    }
    setConnectorCount(selected.size);
    push("/onboarding/invite");
  }

  return (
    <OnboardingScreen
      title="What does your team use?"
      subtitle="We'll queue these connectors so your workspace is ready to act."
      width={653}
      footer={
        <OnboardingFooter
          onBack={() => push("/onboarding/workspace")}
          onContinue={() => void handleContinue()}
          continueDisabled={continuing}
          continueLoading={continuing}
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
