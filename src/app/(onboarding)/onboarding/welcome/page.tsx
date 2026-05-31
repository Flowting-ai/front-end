"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useOnboarding } from "@/context/onboarding-context";
import { InputField } from "@/components/InputField";
import { Button } from "@/components/Button";
import { updateUser } from "@/lib/api/user";

export default function OnboardingWelcomePage() {
  const { push } = useRouter();
  const { isHydrated, isAuthenticated, user, logout } = useAuth();
  const { data, setFirstName, setLastName, setNickname } = useOnboarding();

  // Pre-fill name from existing user profile, but skip values that look like
  // an email (Auth0 defaults first_name to the email on new signups).
  useEffect(() => {
    const email = user?.email ?? "";
    const fn = user?.firstName ?? "";
    const ln = user?.lastName ?? "";
    if (fn && fn !== email && !fn.includes("@") && !data.firstName) setFirstName(fn);
    if (ln && ln !== email && !ln.includes("@") && !data.lastName) setLastName(ln);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Redirect unauthenticated users — must be client-side because auth state
  // comes from a client context; server-side redirect would need middleware.
  // eslint-disable-next-line react-doctor/nextjs-no-client-side-redirect
  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      window.location.href = "/auth/login";
    }
  }, [isHydrated, isAuthenticated]);

  const canContinue = data.firstName.trim().length > 0 && data.lastName.trim().length > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    // Persist name to backend as user progresses — fire and forget. Nickname is
    // kept in onboarding state for this session; there is no backend field for it
    // (role_fit is a team-size enum, not free text).
    void updateUser({ first_name: data.firstName.trim(), last_name: data.lastName.trim() });
    push("/onboarding/role");
  };

  if (!isHydrated) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--neutral-50, #f7f2ed)",
        backgroundImage: "url('/icons/souvenir-bg.svg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
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
            {/* eslint-disable-next-line react-doctor/design-no-vague-button-label -- onboarding wizard: "Continue" advances to role step; flow context makes action clear */}
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
          fontSize: "12px",
          lineHeight: "16px",
          color: "#0d6eb2",
          textDecoration: "underline",
        }}
      >
        Log out
      </button>
    </div>
    </div>
  );
}
