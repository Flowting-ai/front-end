"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/Button";
import { m, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api/client";
import { STRIPE_TRIAL_ENDPOINT } from "@/lib/config";

// ── Shared styles ──────────────────────────────────────────────────────────────

const BACKDROP_Z = 9998;
const MODAL_Z = 9999;

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(18,12,8,0.5)",
  backdropFilter: "blur(2px)",
  zIndex: BACKDROP_Z,
};

const modalCardStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  margin: "auto",
  width: "fit-content",
  height: "fit-content",
  maxWidth: "480px",
  maxHeight: "calc(100dvh - 64px)",
  zIndex: MODAL_Z,
  backgroundColor: "var(--neutral-white, #fff)",
  borderRadius: "18px",
  padding: "32px",
  boxShadow:
    "0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100, #ede1d7)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "24px",
};

// ── Choice option card ─────────────────────────────────────────────────────────

function ChoiceCard({
  icon,
  title,
  description,
  buttonLabel,
  buttonVariant = "default",
  onClick,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  buttonVariant?: "default" | "secondary";
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        padding: "24px 20px",
        borderRadius: "14px",
        border: "1px solid var(--neutral-200, #e2d9d1)",
        backgroundColor: "var(--neutral-50, #F7F2ED)",
        flex: "1 1 0",
        minWidth: "180px",
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: "28px", lineHeight: 1 }}>{icon}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: "16px",
            lineHeight: "22px",
            color: "var(--neutral-900, #26211e)",
            margin: 0,
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            fontSize: "14px",
            lineHeight: "20px",
            color: "var(--neutral-500, #6a625d)",
            margin: 0,
          }}
        >
          {description}
        </p>
      </div>
      <Button
        size="sm"
        variant={buttonVariant}
        onClick={onClick}
        loading={loading}
        fluid
      >
        {buttonLabel}
      </Button>
    </div>
  );
}

// ── Teams workspace preview (Figma 5795:65940) ────────────────────────────────
// Decorative mockup of the Souvenir workspace chrome shown in the teams welcome.

function TeamsWorkspacePreview() {
  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "var(--neutral-50, #f7f2ed)",
        borderRadius: "16px",
        paddingRight: "8px",
        paddingTop: "8px",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.2)",
          border: "1px solid var(--neutral-200, #d1c6bd)",
          borderRadius: "16px",
          padding: "10px",
          height: "172px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Workspace selector pill */}
          <div
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "5px 8px 7px",
              borderRadius: "8px",
              background: "linear-gradient(180deg, #524b47 0%, #26211e 100%)",
              boxShadow:
                "0px 0px 0px 1px black, 0px 1px 1px rgba(59,54,50,0.1), 0px 1.5px 3px rgba(59,54,50,0.4)",
            }}
          >
            {/* Globe / Souvenir mark */}
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="7" stroke="rgba(247,242,237,0.7)" strokeWidth="1.5" />
              <path
                d="M10 3C7.5 6.5 7.5 13.5 10 17M10 3C12.5 6.5 12.5 13.5 10 17M3 10h14"
                stroke="rgba(247,242,237,0.7)"
                strokeWidth="1.2"
              />
            </svg>
            <span
              style={{
                color: "var(--neutral-50, #f7f2ed)",
                fontSize: "11px",
                fontWeight: 500,
                fontFamily: "var(--font-body)",
                whiteSpace: "nowrap",
                textShadow:
                  "0px 0.4px 0.4px rgba(255,255,255,0.25), 0px -0.7px 0.4px rgba(0,0,0,0.25)",
              }}
            >
              Your workspace
            </span>
            <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M2.5 4.5l3.5 3.5 3.5-3.5"
                stroke="rgba(247,242,237,0.5)"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {/* Inner highlight */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                pointerEvents: "none",
                boxShadow:
                  "inset 0px 1px 0.4px rgba(247,242,237,0.3), inset 0px -2px 0.4px #120c08, inset 0px -2.5px 4px -2px rgba(247,242,237,0.5)",
              }}
            />
          </div>

          {/* Teams / grid icon */}
          <div style={{ padding: "6px", borderRadius: "8px" }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.5" stroke="#b6aca4" strokeWidth="1.25" />
              <rect x="11"   y="2.5" width="6.5" height="6.5" rx="1.5" stroke="#b6aca4" strokeWidth="1.25" />
              <rect x="2.5"  y="11"  width="6.5" height="6.5" rx="1.5" stroke="#b6aca4" strokeWidth="1.25" />
              <rect x="11"   y="11"  width="6.5" height="6.5" rx="1.5" stroke="#b6aca4" strokeWidth="1.25" />
            </svg>
          </div>
        </div>

        {/* Floating side tool menu */}
        <div
          style={{
            position: "absolute",
            right: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            backgroundColor: "var(--neutral-white, #fff)",
            border: "1px solid var(--neutral-200, #d1c6bd)",
            borderRadius: "10px",
            padding: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            boxShadow:
              "0px 1px 1px rgba(59,54,50,0.05), 0px 1.5px 3px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-200,#d1c6bd)",
          }}
        >
          {/* Pin icon */}
          <div style={{ padding: "5px", borderRadius: "6px" }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M11.5 3.5l5 5-2.5 2.5-1.5-1.5-3 3v2l-1.5 1.5-3.5-3.5 1.5-1.5h2l3-3-1.5-1.5 2.5-2.5z"
                stroke="#b6aca4"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {/* Target/circle icon */}
          <div style={{ padding: "5px", borderRadius: "6px" }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="6.5" stroke="#b6aca4" strokeWidth="1.25" />
              <circle cx="10" cy="10" r="2.5" stroke="#b6aca4" strokeWidth="1.25" />
            </svg>
          </div>
          {/* Quill/pen icon */}
          <div style={{ padding: "5px", borderRadius: "6px" }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M16 4C14 2 11 4 9 6L6 9l-2.5 5.5 5.5-2.5 3-3c2-2 4-5 4-5z"
                stroke="#b6aca4"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M9 6L14 11" stroke="#b6aca4" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          {/* Inner bottom shadow overlay */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              pointerEvents: "none",
              boxShadow: "inset 0px -2px 0.4px var(--neutral-100,#ede1d7)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Souvenir wordmark ──────────────────────────────────────────────────────────

function SouvenirWordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "11.5px" }}>
      <img
        src="/icons/logo/souvenir-logo.svg"
        alt="Souvenir"
        width={40}
        height={40}
      />
      <span
        style={{
          fontFamily: "var(--font-title)",
          fontWeight: 400,
          fontSize: "34px",
          lineHeight: 1,
          color: "black",
          letterSpacing: "0.34px",
        }}
      >
        Souvenir
      </span>
    </div>
  );
}

// ── Steps ──────────────────────────────────────────────────────────────────────

type ModalStep = "welcome" | "credits-added";

// ── Modal ──────────────────────────────────────────────────────────────────────

const WELCOME_ACK_KEY = "souvenir_welcome_acknowledged";

function WelcomeModalImpl() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, setUser, refreshUser } = useAuth();
  const [step, setStep] = useState<ModalStep>("welcome");
  const [trialLoading, setTrialLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  // Show whenever ?welcome=1 is present — this param is only ever added by the
  // onboarding import page after a fresh signup, so a new arrival should always
  // see the modal regardless of any stale localStorage state from a prior session.
  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      // Reset any previous ack so the modal always shows on fresh onboarding.
      localStorage.removeItem(WELCOME_ACK_KEY);
      setVisible(true);
      // Clean the URL param so it doesn't linger after the modal closes.
      const url = new URL(window.location.href);
      url.searchParams.delete("welcome");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  const handleClose = () => {
    localStorage.setItem(WELCOME_ACK_KEY, "1");
    setVisible(false);
  };

  const handleStartTrial = useCallback(async () => {
    setTrialLoading(true);
    try {
      const res = await apiFetch(STRIPE_TRIAL_ENDPOINT, { method: "POST" });
      if (res.ok) {
        // Parse the billing/usage response to extract trial credits immediately
        const body = await res.json();
        const credits = body?.credits;
        if (credits && user) {
          const totalCredits = Math.round((credits.total_credits ?? 0) * 1000);
          const remaining = credits.trial
            ? Math.round((credits.trial.remaining ?? 0) * 1000)
            : totalCredits;
          setUser({
            ...user,
            creditsTotal: totalCredits,
            creditsRemaining: remaining,
            creditsUsed: Math.round(((credits.trial?.used ?? 0)) * 1000),
            creditsDisplay: totalCredits.toLocaleString("en-US"),
            creditsRemainingDisplay: remaining.toLocaleString("en-US"),
          });
        }
        // Also refresh full profile in background
        void refreshUser();
        setStep("credits-added");
      } else {
        console.error("[WelcomeModal] Trial activation failed", res.status);
      }
    } catch (err) {
      console.error("[WelcomeModal] Trial activation error", err);
    } finally {
      setTrialLoading(false);
    }
  }, [refreshUser, user, setUser]);

  const handleBuySubscription = useCallback(() => {
    localStorage.setItem(WELCOME_ACK_KEY, "1");
    setVisible(false);
    router.push("/settings/billing/change-plan");
  }, [router]);

  const firstName = user?.firstName || user?.name?.split(" ")[0] || "there";
  const isTeamsUser = Boolean(user?.orgId);

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <m.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={backdropStyle}
          />

          {/* Modal card */}
          <m.div
            key="modal"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={modalCardStyle}
          >
            <AnimatePresence mode="wait">
              {step === "welcome" && isTeamsUser && (
                <m.div
                  key="step-welcome-teams"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "20px",
                    width: "100%",
                  }}
                >
                  <SouvenirWordmark />

                  <h2
                    style={{
                      fontFamily: "var(--font-title)",
                      fontWeight: 400,
                      fontSize: "24px",
                      lineHeight: "32px",
                      color: "var(--neutral-900, #26211e)",
                      margin: 0,
                      textAlign: "center",
                    }}
                  >
                    {`Welcome, ${firstName}.`}
                  </h2>

                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontWeight: 400,
                      fontSize: "16px",
                      lineHeight: "22px",
                      color: "var(--neutral-500, #6a625d)",
                      margin: 0,
                      textAlign: "center",
                    }}
                  >
                    Your team workspace is ready to explore.
                  </p>

                  <TeamsWorkspacePreview />

                  <Button
                    size="sm"
                    rightIcon={<span style={{ fontSize: 12 }}>→</span>}
                    onClick={handleClose}
                  >
                    Start exploring
                  </Button>
                </m.div>
              )}

              {step === "welcome" && !isTeamsUser && (
                <m.div
                  key="step-welcome"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "20px",
                    width: "100%",
                  }}
                >
                  <SouvenirWordmark />

                  <h2
                    style={{
                      fontFamily: "var(--font-title)",
                      fontWeight: 400,
                      fontSize: "24px",
                      lineHeight: "32px",
                      color: "var(--neutral-900, #26211e)",
                      margin: 0,
                      textAlign: "center",
                    }}
                  >
                    {`Welcome, ${firstName}.`}
                  </h2>

                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontWeight: 400,
                      fontSize: "16px",
                      lineHeight: "22px",
                      color: "var(--neutral-500, #6a625d)",
                      margin: 0,
                      textAlign: "center",
                    }}
                  >
                    Your workspace is ready. Choose how to get started.
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      width: "100%",
                      flexWrap: "wrap",
                    }}
                  >
                    <ChoiceCard
                      icon="✦"
                      title="Free Trial"
                      description="Get 1,000 credits to explore all features — no card required."
                      buttonLabel="Start free trial"
                      buttonVariant="default"
                      onClick={handleStartTrial}
                      loading={trialLoading}
                    />
                    <ChoiceCard
                      icon="◈"
                      title="Subscribe"
                      description="Choose a plan for unlimited access and premium features."
                      buttonLabel="View plans"
                      buttonVariant="secondary"
                      onClick={handleBuySubscription}
                    />
                  </div>
                </m.div>
              )}

              {step === "credits-added" && (
                <m.div
                  key="step-credits-added"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "20px",
                    width: "100%",
                  }}
                >
                  {/* <span style={{ fontSize: "40px", lineHeight: 1 }}>🎉</span> */}

                  <h2
                    style={{
                      fontFamily: "var(--font-title)",
                      fontWeight: 400,
                      fontSize: "22px",
                      lineHeight: "28px",
                      color: "var(--neutral-900, #26211e)",
                      margin: 0,
                      textAlign: "center",
                    }}
                  >
                    Credits have been added
                  </h2>

                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontWeight: 400,
                      fontSize: "14px",
                      lineHeight: "20px",
                      color: "var(--neutral-500, #6a625d)",
                      margin: 0,
                      textAlign: "center",
                    }}
                  >
                    You now have 1,000 free credits to explore Souvenir. Enjoy!
                  </p>

                  <Button
                    size="sm"
                    rightIcon={<span style={{ fontSize: 12 }}>→</span>}
                    onClick={handleClose}
                  >
                    Start exploring
                  </Button>
                </m.div>
              )}
            </AnimatePresence>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function WelcomeModal() {
  return <Suspense fallback={null}><WelcomeModalImpl /></Suspense>;
}
