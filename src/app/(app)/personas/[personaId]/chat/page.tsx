"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PersonaChatInterface } from "@/components/layout/PersonaChatInterface";

function PersonaChatPageInner() {
  const params      = useParams<{ personaId: string }>();
  const searchParams = useSearchParams();
  const chatId      = searchParams.get("chatId") ?? undefined;

  return <PersonaChatInterface personaId={params.personaId} initialChatId={chatId} />;
}

export default function PersonaChatPage() {
  return (
    <Suspense fallback={null}>
      <PersonaChatPageInner />
    </Suspense>
  );
}
