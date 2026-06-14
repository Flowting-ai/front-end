"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCreditStatus } from "@/hooks/use-credit-status";
import { Button } from "@/components/Button";
import { m, AnimatePresence } from "framer-motion";

// ── Styles ─────────────────────────────────────────────────────────────────────

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
  maxWidth: "440px",
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
  gap: "20px",
};

// ── Component ──────────────────────────────────────────────────────────────────

function CreditsExhaustedModalImpl() {
  const { blocked } = useCreditStatus();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  // Track whether we've already shown the modal this session so we don't
  // re-pop it on every render if the user dismisses it.
  const hasShownRef = useRef(false);

  // Show automatically when the user is hard-blocked (credits exhausted) —
  // trial and subscribers alike. Render is gated on `blocked` below, so a topup
  // that clears the block auto-closes the modal without a setState here; we just
  // re-arm the once-per-episode ref.
  useEffect(() => {
    if (blocked && !hasShownRef.current) {
      hasShownRef.current = true;
      setVisible(true);
    } else if (!blocked) {
      hasShownRef.current = false;
    }
  }, [blocked]);

  // Listen for imperative "credits:exhausted" events (e.g. from blocked sends)
  useEffect(() => {
    const handleExhausted = () => {
      setVisible(true);
    };
    window.addEventListener("credits:exhausted", handleExhausted);
    return () => window.removeEventListener("credits:exhausted", handleExhausted);
  }, []);

  const handleBuyCredits = () => {
    setVisible(false);
    router.push("/settings/billing");
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && blocked && (
        <>
          {/* Backdrop */}
          <m.div
            key="credits-exhaust-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={backdropStyle}
            onClick={handleDismiss}
          />

          {/* Modal */}
          <m.div
            key="credits-exhaust-modal"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={modalCardStyle}
          >
            <span style={{ fontSize: "36px", lineHeight: 1 }}>⚠️</span>

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
              You&apos;ve used all your credits
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
                maxWidth: "340px",
              }}
            >
              You&apos;ve used all your credits. Buy a top-up to continue using
              Souvenir — your new credits apply instantly, no reload needed.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                width: "100%",
                maxWidth: "280px",
              }}
            >
              <Button size="sm" fluid onClick={handleBuyCredits}>
                Buy credits
              </Button>
              <Button size="sm" variant="ghost" fluid onClick={handleDismiss}>
                Maybe later
              </Button>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function CreditsExhaustedModal() {
  return (
    <Suspense fallback={null}>
      <CreditsExhaustedModalImpl />
    </Suspense>
  );
}
