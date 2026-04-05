"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";

function SettingsIndexInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  useEffect(() => {
    if (searchParams.get("from_checkout") === "1") {
      void refreshUser();
    }
  }, [searchParams, refreshUser]);

  useEffect(() => {
    router.replace("/settings/account");
  }, [router]);

  return null;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsIndexInner />
    </Suspense>
  );
}
