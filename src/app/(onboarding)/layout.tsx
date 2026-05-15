import { OnboardingProvider } from "@/context/onboarding-context";

export default function OnboardingGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          backgroundColor: "var(--neutral-50, #f7f2ed)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
    </OnboardingProvider>
  );
}
