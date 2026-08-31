"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AddSouvenirToSlackModal } from "@/app/(onboarding)/onboarding/_components/add-to-slack-modal";
import { CHAT_ROUTE } from "@/lib/routes";

// Only ever reached as `${WELCOME_ROUTE}?slack=1` from the onboarding invite
// step (src/app/(onboarding)/onboarding/invite/page.tsx) — a bare landing
// spot for the post-onboarding "Add Souvenir to Slack" modal (A1/A2 screen 5,
// Figma 55:2475 / 182:10127), not a page in its own right. Any other way of
// arriving here (no `slack=1`, or the modal closing) just continues into chat.

function TeamWelcomeContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [slackModalOpen, setSlackModalOpen] = useState(() => params.get("slack") === "1");

  useEffect(() => {
    if (!slackModalOpen) router.replace(CHAT_ROUTE);
  }, [slackModalOpen, router]);

  return (
    <AddSouvenirToSlackModal
      isOpen={slackModalOpen}
      onClose={() => setSlackModalOpen(false)}
    />
  );
}

export default function TeamWelcomePage() {
  return (
    <Suspense fallback={null}>
      <TeamWelcomeContent />
    </Suspense>
  );
}
