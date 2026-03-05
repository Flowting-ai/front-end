"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import AppLayout from "@/components/layout/app-layout";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { workflowAPI } from "@/components/workflows/workflow-api";

type WorkflowModel = Awaited<ReturnType<typeof workflowAPI.fetchModels>>[number];

interface ModelWithToggle extends WorkflowModel {
  enabled: boolean;
}

const formatContextTokens = (tokens?: number) => {
  if (!tokens || tokens <= 0) return "Unknown";
  if (tokens >= 1000) {
    const k = Math.round(tokens / 1000);
    return `${k}K`;
  }
  return tokens.toLocaleString();
};

export default function SettingsAIAndModelsPage() {
  const [models, setModels] = useState<ModelWithToggle[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadModels = async () => {
      setIsLoading(true);
      try {
        let data: WorkflowModel[] = [];

        // Try to hydrate from sessionStorage if available
        if (typeof window !== "undefined") {
          const cached = sessionStorage.getItem("allModels");
          if (cached) {
            try {
              const parsed = JSON.parse(cached) as WorkflowModel[];
              if (Array.isArray(parsed) && parsed.length > 0) {
                data = parsed;
              }
            } catch {
              // ignore parse errors and fall through to fetch
            }
          }
        }

        // Always ensure we have fresh data from backend
        if (!data.length) {
          data = await workflowAPI.fetchModels();
        }

        if (!isMounted) return;

        const withToggle: ModelWithToggle[] = data.map((model) => ({
          ...model,
          enabled: true,
        }));

        setModels(withToggle);
      } catch {
        if (!isMounted) return;
        setModels([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadModels();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return models;

    return models.filter((model) => {
      const name = (model.name ?? "").toLowerCase();
      const company = (model.companyName ?? "").toLowerCase();
      return name.includes(query) || company.includes(query);
    });
  }, [models, search]);

  const handleToggle = (id: string, checked: boolean) => {
    setModels((prev) =>
      prev.map((model) =>
        model.id === id ? { ...model, enabled: checked } : model
      )
    );
  };

  return (
    <AppLayout>
      <div className="w-full h-full flex justify-center items-start py-10 px-4 overflow-y-auto customScrollbar2">
        <div className="w-full max-w-4xl flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="font-clash text-2xl text-black">AI &amp; Models</h1>
              <p className="font-geist text-sm text-[#4B5563]">
                Toggle models available in your workspace.
              </p>
            </div>

            <div className="w-full max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#525252]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Chat"
                  className="min-h-[36px] h-[36px] pl-9 text-sm text-[#737373] border border-[#E5E5E5] shadow-sm rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Models list */}
          <div className="flex flex-col gap-4">
            {isLoading && (
              <p className="text-sm text-[#737373]">Loading models...</p>
            )}

            {!isLoading && filteredModels.length === 0 && (
              <p className="text-sm text-[#737373]">
                No models found. Check your backend connection or adjust your
                search.
              </p>
            )}

            {!isLoading &&
              filteredModels.map((model) => {
                const ctxTokens = model.inputLimit ?? 0;
                const ctxLabel = formatContextTokens(ctxTokens);

                return (
                  <div
                    key={model.id}
                    className="flex items-start justify-between gap-4 border-b border-[#E5E5E5] pb-4 last:border-b-0"
                  >
                    <div className="flex-1 flex flex-col gap-2">
                      <p className="text-base font-normal text-[#1E1E1E]">
                        {model.name}
                      </p>

                      {model.description && (
                        <p className="text-sm text-[#4B5563] line-clamp-2 overflow-hidden text-ellipsis">
                          {model.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-xs text-[#171717] bg-[#F5F5F5] rounded-full px-2 py-1">
                          by{" "}
                          <span className="underline">
                            {model.companyName || "Unknown"}
                          </span>
                        </span>
                        <span className="inline-flex items-center text-xs text-[#171717] bg-[#F5F5F5] rounded-full px-2 py-1">
                          {`${ctxLabel} context`}
                        </span>
                        <span className="inline-flex items-center text-xs text-[#0A0A0A] bg-transparent px-2 py-1 border border-transparent">
                          {`${ctxLabel} ctx`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end min-w-[60px]">
                      <Switch
                        checked={model.enabled}
                        onCheckedChange={(checked) =>
                          handleToggle(model.id, Boolean(checked))
                        }
                        className="data-[state=checked]:bg-black data-[state=unchecked]:bg-[#E5E5E5]"
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}