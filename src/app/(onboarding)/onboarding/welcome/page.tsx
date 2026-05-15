"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useOnboarding } from "@/context/onboarding-context";
import { InputField } from "@/components/InputField";
import { Button } from "@/components/Button";

export default function OnboardingWelcomePage() {
  const router = useRouter();
  const { isHydrated, isAuthenticated, user, logout } = useAuth();
  const { data, setFirstName, setLastName, setNickname } = useOnboarding();

  // Pre-fill from existing user profile
  useEffect(() => {
    if (user?.firstName && !data.firstName) setFirstName(user.firstName);
    if (user?.lastName && !data.lastName) setLastName(user.lastName);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      window.location.href = "/auth/login";
    }
  }, [isHydrated, isAuthenticated]);

  const canContinue = data.firstName.trim().length > 0 && data.lastName.trim().length > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    router.push("/onboarding/role");
  };

  if (!isHydrated) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
        width: "100%",
        maxWidth: "400px",
        padding: "24px 16px",
      }}
    >
      {/* Heading */}
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "16px" }}>
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
          Welcome to Souvenir
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            fontSize: "14px",
            lineHeight: "22px",
            color: "var(--neutral-700, #524b47)",
            margin: 0,
          }}
        >
          A quick three steps and your workspace is tuned. Everything is changeable later.
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "18px",
          padding: "16px",
          width: "100%",
          boxShadow:
            "0px 12px 16px 0px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <InputField
            label="First name"
            placeholder="First name"
            value={data.firstName}
            onChange={setFirstName}
            fluid
          />
          <InputField
            label="Last name"
            placeholder="Last name"
            value={data.lastName}
            onChange={setLastName}
            fluid
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                fontSize: "14px",
                lineHeight: "22px",
                color: "var(--neutral-700, #524b47)",
              }}
            >
              What should we call you?{" "}
              <span style={{ color: "#524b47", opacity: 0.6 }}>Optional</span>
            </label>
            <InputField
              placeholder="Nickname or preferred name"
              value={data.nickname}
              onChange={setNickname}
              fluid
              showLabel={false}
              label="Nickname"
            />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              Back
            </Button>
            <Button size="sm" disabled={!canContinue} onClick={handleContinue}>
              Continue
            </Button>
          </div>
        </div>
      </div>

      {/* Log out link */}
      <button
        type="button"
        onClick={() => void logout()}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-body)",
          fontWeight: 400,
          fontSize: "11px",
          lineHeight: "16px",
          color: "#0d6eb2",
          textDecoration: "underline",
        }}
      >
        Log out
      </button>
    </div>
  );
}
