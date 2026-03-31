"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import AppLayout from "@/components/layout/app-layout";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/auth-context";
import { fetchAllModels, toggleBlockModel, type LLMModel } from "@/lib/api/models";
import { toast } from "@/lib/toast-helper";

const PLAN_ORDER: Record<string, number> = { standard: 0, pro: 1, power: 2 };

function requiresUpgrade(
  modelPlanType: string,
  userPlanType: string | null | undefined,
): boolean {
  if (!userPlanType) return true;
  const modelRank = PLAN_ORDER[modelPlanType] ?? 0;
  const userRank = PLAN_ORDER[userPlanType] ?? -1;
  return modelRank > userRank;
}

const PLAN_LABEL: Record<string, string> = {
  standard: "Standard",
  pro: "Pro",
  power: "Power",
};

const formatTokens = (n: number | null | undefined) => {
  if (!n || n <= 0) return null;
  if (n >= 1000) return `${Math.round(n / 1000)}K ctx`;
  return `${n.toLocaleString()} ctx`;
};

export default function SettingsAIAndModelsPage() {
  const { user } = useAuth();
  const [models, setModels] = useState<LLMModel[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchAllModels()
      .then((data) => {
        if (isMounted) setModels(data);
      })
      .catch(() => {
        if (isMounted) setModels([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return models;
    return models.filter(
      (m) =>
        m.model_name.toLowerCase().includes(query) ||
        m.model_provider.toLowerCase().includes(query),
    );
  }, [models, search]);

  const handleToggle = async (model: LLMModel, checked: boolean) => {
    // checked = user wants it enabled → blocked should be false
    // checked = false → blocked should be true
    // The API toggles whatever the current state is, so we only call it when
    // the desired state differs from the current state.
    const shouldBeBlocked = !checked;
    if (shouldBeBlocked === model.blocked) return; // already in desired state

    setTogglingId(model.model_id);
    // Optimistic update
    setModels((prev) =>
      prev.map((m) =>
        m.model_id === model.model_id ? { ...m, blocked: shouldBeBlocked } : m,
      ),
    );

    try {
      const result = await toggleBlockModel(model.model_id);
      // Reconcile with actual backend response
      setModels((prev) =>
        prev.map((m) =>
          m.model_id === model.model_id ? { ...m, blocked: result.blocked } : m,
        ),
      );
    } catch {
      // Roll back on failure
      setModels((prev) =>
        prev.map((m) =>
          m.model_id === model.model_id ? { ...m, blocked: model.blocked } : m,
        ),
      );
      toast.error(`Failed to update ${model.model_name}`);
    } finally {
      setTogglingId(null);
    }
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
                  placeholder="Search models"
                  className="min-h-[36px] h-[36px] pl-9 text-sm text-[#737373] border border-[#E5E5E5] shadow-sm rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Models list */}
          <div className="flex flex-col gap-4">
            {isLoading && (
              <p className="text-sm text-[#737373]">Loading models…</p>
            )}

            {!isLoading && filteredModels.length === 0 && (
              <p className="text-sm text-[#737373]">
                No models found.
              </p>
            )}

            {!isLoading &&
              filteredModels.map((model) => {
                const locked = requiresUpgrade(model.model_plan_type, user?.planType);
                const ctxLabel = formatTokens(model.model_context_window);
                const isToggling = togglingId === model.model_id;

                return (
                  <div
                    key={model.model_id}
                    className={`flex items-start justify-between gap-4 border-b border-[#E5E5E5] pb-4 last:border-b-0 ${
                      locked ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-normal text-[#1E1E1E]">
                          {model.model_name}
                        </p>
                        {locked && (
                          <span className="inline-flex items-center rounded-full bg-[#F5F5F5] border border-[#E5E5E5] px-2 py-0.5 text-xs font-medium text-[#6B7280]">
                            {PLAN_LABEL[model.model_plan_type] ?? model.model_plan_type}+ plan required
                          </span>
                        )}
                      </div>

                      {model.model_description && (
                        <p className="text-sm text-[#4B5563] line-clamp-2">
                          {model.model_description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-xs text-[#171717] bg-[#F5F5F5] rounded-full px-2 py-1">
                          by{" "}
                          <span className="underline">
                            {model.model_provider || "Unknown"}
                          </span>
                        </span>
                        {ctxLabel && (
                          <span className="inline-flex items-center text-xs text-[#171717] bg-[#F5F5F5] rounded-full px-2 py-1">
                            {ctxLabel}
                          </span>
                        )}
                        {model.model_inputs.length > 0 && (
                          <span className="inline-flex items-center text-xs text-[#171717] bg-[#F5F5F5] rounded-full px-2 py-1">
                            {model.model_inputs.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end min-w-[60px]">
                      <Switch
                        checked={!model.blocked}
                        disabled={locked || isToggling}
                        onCheckedChange={(checked) => handleToggle(model, checked)}
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
