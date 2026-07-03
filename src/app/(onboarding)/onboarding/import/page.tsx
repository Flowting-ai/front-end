"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding, deriveRoleFit, effectiveUserRole } from "@/context/onboarding-context";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/Button";
import { updateOnboarding, updateUser } from "@/lib/api/user";
import { apiFetch } from "@/lib/api/client";
import { MEMORY_USER_ENDPOINT } from "@/lib/config";
import { ONBOARDING_WORKSPACE_ROUTE, CHAT_ROUTE } from "@/lib/routes";

const UNIVERSAL_PROMPT = `Based on everything you know about me - past conversations, saved memories, any standing instructions or preferences I've set - write a single paragraph (no headers, no bullets, no markdown) that briefs another AI assistant on how to work with me effectively. Cover:

1. Who I am - my role, what I work on, current focus
2. How I prefer to communicate - tone, level of detail, formality
3. Ongoing projects or themes that come up repeatedly
4. Tools, methods, and preferences I've mentioned
5. Things I want to avoid - verbose explanations, hedging, specific words or frameworks I dislike

Write it as a briefing for someone who has never met me. Plain prose only. Under 400 words.`;

export default function OnboardingImportPage() {
  const { push } = useRouter();
  const { data, setAiContext } = useOnboarding();
  const { user, refreshUser, logout } = useAuth();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Teams skip the import page entirely. Check both the onboarding context
  // (set during the current flow) and user.roleFit from auth (persisted across
  // page loads, so it survives Stripe's full-page redirect resetting the context).
  const isTeamUser =
    data.accountType === "team" ||
    user?.roleFit === "small_team" ||
    user?.roleFit === "large_team";

  useEffect(() => {
    if (isTeamUser) push(ONBOARDING_WORKSPACE_ROUTE);
  }, [isTeamUser, push]);

  if (isTeamUser) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(UNIVERSAL_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submitOnboarding = async (skipContext = false) => {
    setLoading(true);
    try {
      await Promise.all([
        updateUser({ first_name: data.firstName, last_name: data.lastName }),
        updateOnboarding({
          // Always the enum-safe value ("Other" → "other"). Free text 422s and
          // would break completion. The custom "Other" detail goes to memory below.
          user_role: effectiveUserRole(data),
          ai_tone: data.tone,
          // role_fit captures the account-type branch (just_me / small_team /
          // large_team). updateOnboarding validates + drops it if unset.
          role_fit: deriveRoleFit(data.accountType, data.companySize),
          onboarding_completed: true,
        }),
      ]);

      // Capture the free-text "Other" role detail as a user memory — the backend
      // user_role enum can't store it. Sent regardless of skipContext (it's a
      // captured answer, not the optional paste); fire-and-forget so a memory
      // failure never blocks onboarding completion.
      if (data.role === "Other" && data.roleOther.trim().length > 0) {
        void apiFetch(MEMORY_USER_ENDPOINT, {
          method: "POST",
          body: JSON.stringify({ content: `My role: ${data.roleOther.trim()}` }),
        });
      }

      // Send user memory/context to backend if provided
      if (!skipContext && data.aiContext.trim().length > 0) {
        await apiFetch(MEMORY_USER_ENDPOINT, {
          method: "POST",
          body: JSON.stringify({ content: data.aiContext.trim() }),
        });
      }

      await refreshUser();
      push(`${CHAT_ROUTE}?welcome=1`);
    } catch (err) {
      console.error("Onboarding submission failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--neutral-50, #f7f2ed)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative background; Next Image doesn't support SVG patterns with embedded raster images */}
      <img src="https://souvenirai-storage.s3.us-east-1.amazonaws.com/public/souvenir-onboarding-bg.svg" alt="Souvenir onboarding background" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, pointerEvents: "none" }} />
    <div
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
        width: "100%",
        maxWidth: "920px",
        padding: "40px 16px",
      }}
    >
      {/* Heading */}
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
        <h1
          style={{
            fontFamily: "var(--font-title)",
            fontWeight: 400,
            fontSize: "24px",
            lineHeight: "32px",
            color: "#000",
            margin: 0,
          }}
        >
          Bring context from another AI tool?
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            fontSize: "14px",
            lineHeight: "22px",
            color: "var(--neutral-700, #524b47)",
            margin: 0,
            maxWidth: "610px",
            alignSelf: "center",
          }}
        >
          Souvenir remembers across sessions. Use the prompt below in any AI tool you already
          use - ChatGPT, Claude, or Gemini - then paste the response here.
        </p>
      </div>

      {/* Universal prompt card */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "14px",
              lineHeight: "21px",
              color: "#0a0a0a",
              letterSpacing: "0.07px",
            }}
          >
            Universal prompt - works with any AI tool
          </span>
        </div>

        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #e5e5e5",
            borderRadius: "18px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            boxShadow: "0px 1px 1px rgba(0,0,0,0.05)",
            width: "100%",
          }}
        >
          {/* Step chips */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 6px",
                borderRadius: "6px",
                backgroundColor: "#cadcf1",
                border: "1px solid rgba(13,110,178,0.5)",
                cursor: "pointer",
                boxShadow:
                  "0px 1px 1.5px 0px rgba(2,15,24,0.2), inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 500,
                  fontSize: "12px",
                  lineHeight: "16px",
                  color: "#135487",
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </span>
            </button>

            <span style={{ color: "#857a72", fontSize: "12px" }}>→</span>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 6px",
                borderRadius: "6px",
                backgroundColor: "#cadcf1",
                border: "1px solid rgba(13,110,178,0.5)",
                boxShadow:
                  "inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 500,
                  fontSize: "12px",
                  lineHeight: "16px",
                  color: "#135487",
                }}
              >
                Run in your AI tool
              </span>
            </span>

            <span style={{ color: "#857a72", fontSize: "12px" }}>→</span>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 6px",
                borderRadius: "6px",
                backgroundColor: "#cadcf1",
                border: "1px solid rgba(13,110,178,0.5)",
                boxShadow:
                  "inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 500,
                  fontSize: "12px",
                  lineHeight: "16px",
                  color: "#135487",
                }}
              >
                Paste the answer below
              </span>
            </span>
          </div>

          {/* Prompt text */}
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: "14px",
              lineHeight: "22px",
              color: "#1e1e1e",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {UNIVERSAL_PROMPT}
          </p>

          {/* Info note */}
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: "12px",
              lineHeight: "16px",
              color: "var(--neutral-700, #524b47)",
              margin: 0,
            }}
          >
            Info: For best results: in ChatGPT, enable Memory in Settings → Personalization. In
            Claude, run inside a Project. In Gemini, make sure Saved info is set up.
          </p>

          {/* Copy prompt button */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button size="sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy prompt"}
            </Button>
          </div>
        </div>
      </div>

      {/* Paste area */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "14px",
              lineHeight: "21px",
              color: "#0a0a0a",
            }}
          >
            Paste the response here-{" "}
          </span>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "14px",
              lineHeight: "21px",
              color: "#6a625d",
            }}
          >
            or write your own context
          </span>
        </div>

        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #e5e5e5",
            borderRadius: "18px",
            padding: "12px",
            boxShadow: "0px 1px 1px rgba(0,0,0,0.05)",
            width: "100%",
          }}
        >
          <textarea
            value={data.aiContext}
            onChange={(e) => setAiContext(e.target.value)}
            placeholder="Paste what your AI tool returned, or describe yourself in your own words."
            rows={5}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              resize: "vertical",
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: "14px",
              lineHeight: "22px",
              color: "#1e1e1e",
              backgroundColor: "transparent",
              padding: 0,
            }}
          />
        </div>
      </div>

      {/* Action buttons */}
      {/* Action buttons */}
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => push(data.accountType === "team" ? "/onboarding/workspace" : "/onboarding/account-type")}
          disabled={loading}
        >
          Back
        </Button>
        <Button
          size="sm"
          loading={loading}
          onClick={() => void submitOnboarding(false)}
          disabled={data.aiContext.trim().length === 0}
        >
          Import and continue
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={() => void submitOnboarding(true)}
        >
          Skip for now
        </Button>
      </div>

      {/* Log out */}
      <Button variant="default" size="sm" onClick={() => void logout()} leftIcon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M13 3v10M6.5 10.5 3.5 8l3-2.5M3.5 8H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}>
        Log out
      </Button>
    </div>
    </div>
  );
}
