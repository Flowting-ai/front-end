"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDashed } from "lucide-react";

import AppLayout from "@/components/layout/app-layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { workflowAPI } from "@/components/workflows/workflow-api";

type WorkflowModel = Awaited<ReturnType<typeof workflowAPI.fetchModels>>[number];

type RoutingPreference = "cost-optimized" | "balanced" | "quality-first";
type SouvenirAlgorithmMode = "advanced" | "standard";

const TASK_CATEGORIES = [
  "Research & Analysis",
  "Code Generation",
  "Creative Writing",
  "Quick Q&A",
  "Data Processing",
] as const;

type TaskCategory = (typeof TASK_CATEGORIES)[number];

interface TaskAssignment {
  category: TaskCategory;
  modelId: string | null;
}

export default function SettingsRoutingPage() {
  const [routingPreference, setRoutingPreference] =
    useState<RoutingPreference>("balanced");
  const [algorithmMode, setAlgorithmMode] =
    useState<SouvenirAlgorithmMode>("advanced");
  const [budgetAlertsEnabled, setBudgetAlertsEnabled] = useState(true);

  const [allModels, setAllModels] = useState<WorkflowModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [taskAssignments, setTaskAssignments] = useState<TaskAssignment[]>(
    TASK_CATEGORIES.map((category) => ({
      category,
      modelId: null,
    }))
  );

  const [taskPickerOpenFor, setTaskPickerOpenFor] = useState<TaskCategory | null>(
    null
  );
  const [taskPickerQuery, setTaskPickerQuery] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadModels = async () => {
      setModelsLoading(true);
      setModelsError(null);

      try {
        const models = await workflowAPI.fetchModels();
        if (!isMounted) return;
        setAllModels(models);
      } catch (error) {
        if (!isMounted) return;
        setModelsError("Unable to load models. Please try again later.");
        setAllModels([]);
      } finally {
        if (isMounted) {
          setModelsLoading(false);
        }
      }
    };

    void loadModels();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredModels = useMemo(() => {
    const query = taskPickerQuery.trim().toLowerCase();
    if (!query) return allModels;

    const filtered = allModels.filter((model) => {
      const name = (model.name ?? "").toLowerCase();
      const company = (model.companyName ?? "").toLowerCase();
      return name.includes(query) || company.includes(query);
    });

    return filtered;
  }, [allModels, taskPickerQuery]);

  const getModelLabel = (modelId: string | null) => {
    if (!modelId) return "Select model";
    const model = allModels.find((m) => m.id === modelId);
    if (!model) return "Select model";
    return model.name;
  };

  const handleTaskModelSelect = (category: TaskCategory, modelId: string) => {
    setTaskAssignments((prev) =>
      prev.map((assignment) =>
        assignment.category === category ? { ...assignment, modelId } : assignment
      )
    );
    setTaskPickerOpenFor(null);
    setTaskPickerQuery("");
  };

  return (
    <AppLayout>
      <div className="w-full h-full flex justify-center items-start py-10 px-4 overflow-y-auto customScrollbar2">
        <div className="w-full max-w-4xl flex flex-col gap-6">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="font-clash text-2xl text-black">Routing</h1>
            <p className="font-geist text-sm text-black">
              Configure which models are available and how they behave.
            </p>
          </div>

          {/* Global routing settings */}
          <div className="flex flex-col gap-4 border-b border-[#E5E5E5] pb-4">
            {/* Routing preference */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                  Routing Preference
                </span>
                <span className="text-sm text-[#0A0A0A]">
                  Optimize for cost or quality
                </span>
              </div>
              <Select
                value={routingPreference}
                onValueChange={(value) =>
                  setRoutingPreference(value as RoutingPreference)
                }
              >
                <SelectTrigger className="min-w-[160px] rounded-[8px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cost-optimized">Cost-Optimized</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="quality-first">Quality-first</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Souvenir algorithm */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-geist font-medium text-sm text-[#0A0A0A]">
                    Souvenir Algorithm
                  </span>
                  <span className="font-geist font-medium text-[11px] text-white bg-[#14AE5C] rounded-full px-2 py-0.5">
                    Pro Plan
                  </span>
                </div>
                <span className="text-sm text-[#0A0A0A]">
                  Advanced uses deeper task analysis
                </span>
              </div>
              <Select
                value={algorithmMode}
                onValueChange={(value) =>
                  setAlgorithmMode(value as SouvenirAlgorithmMode)
                }
              >
                <SelectTrigger className="min-w-[140px] rounded-[8px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Per-task model assignment */}
          <div className="flex flex-col gap-3 border-b border-[#E5E5E5] pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="font-clash text-xl text-black">
                  Per-task model assignment
                </h2>
                <p className="font-geist text-sm text-[#4B5563]">
                  Assign specific models to task categories for optimal results.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {taskAssignments.map((assignment) => (
                <div
                  key={assignment.category}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-[#0A0A0A]">
                    {assignment.category}
                  </span>

                  <div className="relative">
                    <button
                      type="button"
                      className="cursor-pointer min-w-[200px] rounded-[8px] border border-[#D4D4D4] bg-white px-3 py-2 text-left text-sm text-[#0A0A0A] shadow-sm flex items-center justify-between gap-2"
                      onClick={() =>
                        setTaskPickerOpenFor(
                          taskPickerOpenFor === assignment.category
                            ? null
                            : assignment.category
                        )
                      }
                    >
                      <span className="truncate">
                        {getModelLabel(assignment.modelId)}
                      </span>
                      <span className="text-xs text-[#757575]">Change</span>
                    </button>

                    {taskPickerOpenFor === assignment.category && (
                      <div className="absolute right-0 z-20 mt-1 w-[260px] rounded-[10px] border border-[#E5E5E5] bg-white shadow-lg">
                        <div className="flex items-center gap-2 px-2 pt-2 pb-1 border-b border-[#E5E5E5]">
                          <CircleDashed className="w-4 h-4 text-[#525252]" />
                          <Input
                            placeholder="Hello World"
                            value={taskPickerQuery}
                            onChange={(e) => setTaskPickerQuery(e.target.value)}
                            className="h-8 border-0 px-1 text-sm placeholder:text-[#737373] shadow-none"
                          />
                        </div>

                        <div className="max-h-40 overflow-y-auto customScrollbar2 p-1">
                          {modelsLoading && (
                            <div className="px-2 py-1 text-xs text-[#757575]">
                              Loading models...
                            </div>
                          )}
                          {modelsError && !modelsLoading && (
                            <div className="px-2 py-1 text-xs text-red-500">
                              {modelsError}
                            </div>
                          )}
                          {!modelsLoading &&
                            !modelsError &&
                            filteredModels.map((model) => (
                              <button
                                key={model.id}
                                type="button"
                                className="w-full text-left text-sm px-2 py-1 rounded-[6px] hover:bg-[#E5E5E5] transition-all duration-300"
                                onClick={() =>
                                  handleTaskModelSelect(
                                    assignment.category,
                                    model.id
                                  )
                                }
                              >
                                {model.name}
                              </button>
                            ))}
                          {!modelsLoading &&
                            !modelsError &&
                            filteredModels.length === 0 && (
                              <div className="px-2 py-1 text-xs text-[#757575]">
                                No models available.
                              </div>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Token & budget controls */}
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <h2 className="font-clash text-xl text-black">
                Token &amp; budget controls
              </h2>
              <p className="font-geist text-sm text-[#4B5563]">
                Set spending limits and get alerts before you hit your cap.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-sm text-[#1E1E1E]">Budget Alerts</span>
                <span className="text-sm text-[#757575]">
                  Notify at 50%, 80%, and 100% of budget
                </span>
              </div>
              <Switch
                checked={budgetAlertsEnabled}
                onCheckedChange={(checked) =>
                  setBudgetAlertsEnabled(Boolean(checked))
                }
                className="data-[state=checked]:bg-black data-[state=unchecked]:bg-[#E5E5E5]"
              />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}