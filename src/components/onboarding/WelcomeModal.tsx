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

type ModalStep = "welcome" | "choose-plan" | "credits-added";

// ── Modal ──────────────────────────────────────────────────────────────────────

const WELCOME_ACK_KEY = "souvenir_welcome_acknowledged";

function WelcomeModalImpl() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, setUser, refreshUser } = useAuth();
  const [step, setStep] = useState<ModalStep>("welcome");
  const [trialLoading, setTrialLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  // Show only when triggered by ?welcome=1 AND not previously acknowledged.
  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      const alreadyAcked = localStorage.getItem(WELCOME_ACK_KEY) === "1";
      if (!alreadyAcked) {
        setVisible(true);
      }
      // Always clean the URL param
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
    router.push("/settings/billing");
  }, [router]);

  const firstName = user?.firstName || user?.name?.split(" ")[0] || "there";

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
              {step === "welcome" && (
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
                    Your workspace is ready. Let&apos;s get you started with a plan.
                  </p>

                  <Button
                    size="sm"
                    rightIcon={<span style={{ fontSize: 12 }}>→</span>}
                    onClick={() => setStep("choose-plan")}
                  >
                    Continue
                  </Button>
                </m.div>
              )}

              {step === "choose-plan" && (
                <m.div
                  key="step-choose"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "20px",
                    width: "100%",
                  }}
                >
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
                    Choose how to get started
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
                    Try Souvenir free or unlock the full experience with a subscription.
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
