"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/app-layout";
import { PersonaChatFullPage } from "@/components/personas/PersonaChatFullPage";
import { fetchPersonaById, type BackendPersona, type PersonaStatus } from "@/lib/api/personas";

function PersonaChatPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const personaId = params?.personaId as string | undefined;
  const chatId = searchParams?.get("chatId") ?? null;
  const [persona, setPersona] = React.useState<BackendPersona | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Only re-fetch when the personaId changes, not on every chatId change.
  // Use fetchPersonaById to avoid fetching the full list just to find one entry.
  React.useEffect(() => {
    if (!personaId) {
      setLoading(false);
      setError("Missing persona ID");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPersonaById(personaId)
      .then((found) => {
        if (!cancelled) setPersona(found as unknown as BackendPersona);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load persona",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [personaId]);

  if (!personaId) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[200px] text-[#666666]">
          Missing persona ID
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[200px] text-[#666666]">
          Loading persona...
        </div>
      </AppLayout>
    );
  }

  if (error || !persona) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[200px] text-red-600">
          {error || "Persona not found"}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PersonaChatFullPage
        personaId={personaId}
        chatId={chatId}
        persona={{
          id: persona.id,
          name: persona.name,
          description: persona.prompt || undefined,
          avatar: persona.imageUrl || undefined,
          modelName: persona.modelName || undefined,
          providerName: persona.providerName || undefined,
          temperature: undefined,
          maxTokens: undefined,
          systemPrompt: persona.prompt || undefined,
          createdAt: persona.createdAt || undefined,
          isActive: persona.status === ("completed" as PersonaStatus),
        }}
        onEditPersona={() => router.push(`/personas/${personaId}`)}
      />
    </AppLayout>
  );
}

export default function PersonaChatPage() {
  return (
    <React.Suspense fallback={null}>
      <PersonaChatPageInner />
    </React.Suspense>
  );
}
