"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/app-layout";
import { PersonaChatFullPage } from "@/components/personas/PersonaChatFullPage";
import { fetchPersonas, type BackendPersona, type PersonaStatus } from "@/lib/api/personas";
import { API_BASE_URL } from "@/lib/config";

export default function PersonaChatPage() {
  const params = useParams();
  const router = useRouter();
  const personaId = params?.personaId as string | undefined;
  const [persona, setPersona] = React.useState<BackendPersona | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!personaId) {
      setLoading(false);
      setError("Missing persona ID");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Fetch the specific persona by ID
    fetchPersonas()
      .then((personas) => {
        if (!cancelled) {
          const found = personas.find((p) => p.id === personaId);
          if (found) {
            setPersona(found);
          } else {
            setError("Persona not found");
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Failed to load persona");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
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
