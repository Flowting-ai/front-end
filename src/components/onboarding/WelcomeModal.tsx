"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/Button";
import { m, AnimatePresence } from "framer-motion";

// ── Status card ────────────────────────────────────────────────────────────────

function StatusCard({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "14px",
        padding: "20px",
        borderRadius: "15px",
        backgroundColor: "white",
        border: "1.274px solid #ede1d7",
        boxShadow: "0px 2.548px 3.821px 0px rgba(202,220,241,0.4)",
        minWidth: "138px",
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: "30px", lineHeight: 1 }}>{icon}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: "16px",
            lineHeight: "22px",
            color: "#120c08",
            margin: 0,
            width: "138px",
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            fontSize: "14px",
            lineHeight: "22px",
            color: "#6a625d",
            margin: 0,
            width: "138px",
          }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ── Souvenir wordmark ──────────────────────────────────────────────────────────

function SouvenirWordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "11.5px" }}>
      {/* Simple logo placeholder - matches design proportions */}
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden
      >
        <circle cx="20" cy="20" r="18" stroke="#26211e" strokeWidth="1.5" fill="none" />
        <path
          d="M12 20 C12 15, 16 12, 20 12 C24 12, 28 15, 28 20 C28 25, 24 28, 20 28 C16 28, 12 25, 12 20Z"
          stroke="#26211e"
          strokeWidth="1.2"
          fill="none"
        />
        <circle cx="20" cy="20" r="3" fill="#26211e" />
      </svg>
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

// ── Modal ──────────────────────────────────────────────────────────────────────

function WelcomeModalImpl() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      setVisible(true);
      // Remove the param from URL without re-render flicker
      const url = new URL(window.location.href);
      url.searchParams.delete("welcome");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  const handleClose = () => {
    setVisible(false);
  };

  const tone = user ? undefined : "Balanced"; // fallback - real value comes from API
  const hasImport = false; // will be true when context imports are implemented

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
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(18,12,8,0.5)",
              backdropFilter: "blur(2px)",
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={handleClose}
          />

          {/* Modal */}
          <m.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 51,
              backgroundColor: "white",
              borderRadius: "18px",
              padding: "16px",
              boxShadow:
                "0px 12px 16px 0px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
              maxWidth: "540px",
              width: "calc(100vw - 32px)",
            }}
          >
            {/* Wordmark */}
            <SouvenirWordmark />

            {/* Headline */}
            <h2
              style={{
                fontFamily: "var(--font-title)",
                fontWeight: 400,
                fontSize: "24px",
                lineHeight: "32px",
                color: "black",
                margin: 0,
                textAlign: "center",
              }}
            >
              {"You're in. Welcome to Souvenir."}
            </h2>

            {/* Subline */}
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                fontSize: "16px",
                lineHeight: "22px",
                color: "#6a625d",
                margin: 0,
                textAlign: "center",
              }}
            >
              Your workspace is provisioned. Memory and routing are configured.
            </p>

            {/* Status cards */}
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
              <StatusCard
                icon="✦"
                title="Receipt sent"
                subtitle={user?.email ?? "your email"}
              />
              <StatusCard
                icon="◎"
                title="Memory seeded"
                subtitle={hasImport ? "From your import" : "Ready for context"}
              />
              <StatusCard
                icon="◈"
                title="Tone & routing set"
                subtitle="Balanced · Normal"
              />
            </div>

            {/* CTA */}
            <Button size="sm" rightIcon={<span style={{ fontSize: 12 }}>→</span>} onClick={handleClose}>
              Open my workspace
            </Button>

            {/* Fine print */}
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                fontSize: "12px",
                lineHeight: "16px",
                color: "black",
                margin: 0,
              }}
            >
              Invoice will arrive within 1 hour
            </p>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function WelcomeModal() {
  return <Suspense fallback={null}><WelcomeModalImpl /></Suspense>
}
