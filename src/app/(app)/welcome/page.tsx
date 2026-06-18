"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/Button";
import { SlackConnectModal } from "@/components/SlackConnectModal";
import { toast } from "sonner";

// ── Icons (monochrome line icons, inherit currentColor) ──────────────────────────

function CheckCircleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 12.2l2.6 2.6L16 9.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShapesIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.4" y="3.6" width="6.8" height="6.8" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 13.4l4 6.6H8l4-6.6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7.5A2.5 2.5 0 015.5 5h3.2a2 2 0 011.5.7l1 1.2a2 2 0 001.5.6h4.3A2.5 2.5 0 0121.5 10v6.5A2.5 2.5 0 0119 19H5.5A2.5 2.5 0 013 16.5v-9z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WorkflowIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="3.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="14.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7" cy="17.5" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6.5h4a3 3 0 013 3v2M7 12.5v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SlackLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand logo asset
    <img src="/connector-logos/slack.svg" alt="" width={26} height={26} style={{ display: "block", objectFit: "contain" }} />
  );
}

// ── Card data ────────────────────────────────────────────────────────────────────

interface ActionCard {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  bg: string;
  titleWeight: number;
  route: string;
  toastMessage: string;
}

const ACTION_CARDS: ActionCard[] = [
  {
    key: "invite",
    title: "Invite your team",
    description: "Add teammates — no per-seat cost",
    icon: <CheckCircleIcon />,
    bg: "var(--neutral-50, #f7f2ed)",
    titleWeight: 500,
    route: "/org/members",
    toastMessage: "Opening team members — add teammates, no per-seat cost.",
  },
  {
    key: "team",
    title: "Create your first team",
    description: "Give the team a place to work.",
    icon: <ShapesIcon />,
    bg: "var(--neutral-white, #fff)",
    titleWeight: 500,
    route: "/org/teams",
    toastMessage: "Opening teams — create a dedicated workspace for your team.",
  },
  {
    key: "project",
    title: "Create your project",
    description: "Give the team a place to work",
    icon: <FolderIcon />,
    bg: "var(--neutral-white, #fff)",
    titleWeight: 500,
    route: "/projects/new",
    toastMessage: "Opening projects — set up a shared space for your work.",
  },
  {
    key: "slack",
    title: "Connect Slack",
    description: "Map channels to projects so Brain has context",
    icon: <SlackLogo />,
    bg: "var(--neutral-white, #fff)",
    titleWeight: 600,
    route: "/org/connectors?q=slack",
    toastMessage: "Opening connectors — link your Slack channels to give Brain context.",
  },
  {
    key: "approval",
    title: "Set approval threshold",
    description: "Set approval threshold",
    icon: <WorkflowIcon />,
    bg: "var(--neutral-white, #fff)",
    titleWeight: 500,
    route: "/org/security",
    toastMessage: "Opening security settings — configure your team's approval gates.",
  },
];

const CARD_SHADOW = "0px 2.548px 3.821px 0px rgba(202,220,241,0.4)";

const CARD_BASE_STYLE: React.CSSProperties = {
  border: "1.274px solid var(--neutral-100, #ede1d7)",
  borderRadius: 15.286,
  padding: 20,
  boxShadow: CARD_SHADOW,
  cursor: "pointer",
  outline: "none",
  textAlign: "center",
  minWidth: 0,
  width: "100%",
};

function ActionCardView({ card, onClick }: { card: ActionCard; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...CARD_BASE_STYLE,
        backgroundColor: card.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 30.571,
          height: 30.571,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--neutral-700, #524b47)",
        }}
      >
        {card.icon}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: card.titleWeight,
            fontSize: 14,
            lineHeight: "22px",
            color: "var(--neutral-700, #524b47)",
            margin: 0,
          }}
        >
          {card.title}
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            fontSize: 11,
            lineHeight: "16px",
            color: "var(--neutral-700, #524b47)",
            margin: 0,
          }}
        >
          {card.description}
        </p>
      </div>
    </button>
  );
}

function InvoiceCardView() {
  return (
    <div
      style={{
        ...CARD_BASE_STYLE,
        backgroundColor: "var(--neutral-100, #ede1d7)",
        border: "1.274px solid var(--neutral-50, #f7f2ed)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "default",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          fontSize: 14,
          lineHeight: "22px",
          color: "var(--neutral-700, #524b47)",
          margin: 0,
          maxWidth: 150,
        }}
      >
        Invoice will arrive within 1 hour
      </p>
    </div>
  );
}

// ── Content ──────────────────────────────────────────────────────────────────────

function TeamWelcomeContent() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useSearchParams();
  const [slackModalOpen, setSlackModalOpen] = useState(false);

  // Prefer the name captured during onboarding (passed via URL), falling back to
  // the authenticated profile so the greeting is always populated.
  const firstName =
    params.get("owner")?.trim() || user?.firstName?.trim() || user?.name?.split(" ")[0]?.trim() || "there";
  const workspaceName = params.get("name")?.trim() || "Your workspace";
  const connectorCount = Math.max(0, Number(params.get("connectors") ?? "0") || 0);
  const connectorClause = `${connectorCount} connector${connectorCount === 1 ? "" : "s"} queued`;

  return (
    <>
      {/* Dark gradient overlay — position:fixed puts it in the root stacking context above
          the app chrome (sidebar, nav) which lives in an isolation:isolate container.
          pointer-events:all blocks interaction with everything behind it. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.52) 100%)",
          pointerEvents: "all",
        }}
      />

      {/* Welcome content — also fixed, z-index above the overlay, so the cards and
          button remain fully interactive while everything else is blocked. */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1001,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          boxSizing: "border-box",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", maxWidth: 653 }}>
          {/* Heading block */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo */}
            <img src="/icons/souvenir-logo-gray.svg" alt="Souvenir" width={44} height={44} style={{ display: "block" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h1
                style={{
                  fontFamily: "var(--font-title)",
                  fontWeight: 400,
                  fontSize: 24,
                  lineHeight: "32px",
                  color: "#000",
                  margin: 0,
                }}
              >
                {`Welcome, ${firstName}. You're the Owner.`}
              </h1>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 400,
                  fontSize: 16,
                  lineHeight: "22px",
                  color: "var(--neutral-600, #6a625d)",
                  margin: 0,
                }}
              >
                {`${workspaceName} is set up with ${connectorClause}. Finish the rest from settings anytime`}
              </p>
            </div>
          </div>

          {/* Action grid — 3 columns × 2 rows */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, width: "100%" }}>
            {ACTION_CARDS.map((card) => (
              <ActionCardView
                key={card.key}
                card={card}
                onClick={() => {
                  if (card.key === "slack") { setSlackModalOpen(true); return }
                  toast.info(card.toastMessage);
                  router.push(card.route);
                }}
              />
            ))}
            <InvoiceCardView />
          </div>

          {/* Primary action */}
          <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
            {/* eslint-disable-next-line react-doctor/design-no-vague-button-label -- "Open my workspace" is the explicit owner CTA into /chat */}
            <Button size="sm" onClick={() => { toast.success("Welcome to your workspace!"); router.push("/chat") }}>
              Open my workspace
            </Button>
          </div>
        </div>
      </div>

      <SlackConnectModal
        isOpen={slackModalOpen}
        onClose={() => setSlackModalOpen(false)}
        onConnected={() => { router.push("/org/souvenir-slack") }}
      />
    </>
  );
}

export default function TeamWelcomePage() {
  return (
    <Suspense fallback={null}>
      <TeamWelcomeContent />
    </Suspense>
  );
}
