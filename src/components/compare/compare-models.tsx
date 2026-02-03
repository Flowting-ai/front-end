"use client";
import React, { useState, useEffect } from "react";
import styles from "./compareModels.module.css";
import {
  X,
  Circle,
  FileSearch2,
  BookImage,
  Video,
  ArrowLeft,
  X as CloseIcon,
  Sparkles,
  CircleCheckBig,
  ArrowUp,
  ArrowRight,
} from "lucide-react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { AIModel } from "@/types/ai-model";
import { MODELS_ENDPOINT, MODEL_TEST_ENDPOINT } from "@/lib/config";
import { normalizeModels } from "@/lib/ai-models";
import { getModelIcon } from "@/lib/model-icons";
import { apiFetch } from "@/lib/api/client";
import { useAuth } from "@/context/auth-context";
import chatStyles from "../chat/chat-interface.module.css";

// Transform AIModel to compare model format
interface CompareModel {
  id: string;
  name: string;
  description: string;
  meta: string;
  iconBg: string;
  icon: string;
  type: string;
}

const transformModelForCompare = (model: AIModel): CompareModel => {
  const provider = model.companyName || "Unknown";
  const modelName = model.modelName || "Unknown Model";

  // Format name: only include provider if it's not empty/unknown
  const displayName =
    provider && provider.toLowerCase() !== "unknown"
      ? `${provider} / ${modelName}`
      : modelName;

  const normalizeModality = (value: string) => value.trim().toLowerCase();
  const modalities = [
    ...(model.outputModalities ?? []),
    ...(model.inputModalities ?? []),
  ]
    .filter((value): value is string => typeof value === "string")
    .map(normalizeModality);

  const type = modalities.includes("video")
    ? "video"
    : modalities.includes("image")
      ? "image"
      : "text";

  const inputLimit = model.inputLimit ?? 0;
  const outputLimit = model.outputLimit ?? 0;
  const planLabel = model.planType || model.callType || model.modelType;

  return {
    id: String(model.modelId || model.id || modelName),
    name: displayName,
    description: model.description || (model.version ? `Version ${model.version}` : modelName),
    meta: `${planLabel || "Standard"} / In ${inputLimit.toLocaleString()} · Out ${outputLimit.toLocaleString()}`,
    iconBg: "#F3F4F6",
    icon: getModelIcon(model.companyName, model.modelName, model.companyName),
    type,
  };
};

const CATEGORY_OPTIONS = [
  {
    key: "all",
    label: "All",
    icon: <Circle className="h-5 w-5 text-[#A3A3A3]" />,
  },
  {
    key: "text",
    label: "Text",
    icon: <FileSearch2 className="h-5 w-5 text-[#A3A3A3]" />,
  },
  {
    key: "image",
    label: "Image",
    icon: <BookImage className="h-5 w-5 text-[#A3A3A3]" />,
  },
  {
    key: "video",
    label: "Video",
    icon: <Video className="h-5 w-5 text-[#A3A3A3]" />,
  },
];

interface CompareModelsPageProps {
  selectedModel?: AIModel | null;
  onModelSelect?: (model: AIModel) => void;
  onClose?: () => void;
}

export default function CompareModelsPage({
  selectedModel,
  onModelSelect,
  onClose,
}: CompareModelsPageProps = {}) {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [showResults, setShowResults] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [containerHeight, setContainerHeight] = useState(680);
  const [models, setModels] = useState<CompareModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [testResponses, setTestResponses] = useState<Record<string, string>>(
    {},
  );
  const [isTesting, setIsTesting] = useState(false);
  const [streamingModels, setStreamingModels] = useState<Set<string>>(
    new Set(),
  );
  const { csrfToken } = useAuth();

  // Store full AIModel data alongside CompareModel
  const [fullModels, setFullModels] = useState<AIModel[]>([]);

  // Fetch models from backend
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(MODELS_ENDPOINT, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to fetch models");
        const data = await response.json();
        const normalizedModels = normalizeModels(data);
        setFullModels(normalizedModels); // Store full model data
        const compareModels = normalizedModels.map(transformModelForCompare);
        setModels(compareModels);
      } catch (error) {
        console.error("Error fetching models:", error);
        setModels([]);
        setFullModels([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      setContainerHeight(Math.min(680, window.innerHeight));
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const filteredModels =
    category === "all" ? models : models.filter((m) => m.type === category);

  const handleSelect = (model: CompareModel) => {
    if (selectedModels.length < 3 && !selectedModels.includes(model.id)) {
      setSelectedModels([...selectedModels, model.id]);
    }
  };

  const handleRemove = (id: string) => {
    setSelectedModels(selectedModels.filter((mid) => mid !== id));
  };

  const handleTestModels = async () => {
    if (!prompt.trim() || selectedModels.length < 2 || isTesting) return;

    setIsTesting(true);
    setTestResponses({}); // Clear previous responses
    setStreamingModels(new Set()); // Clear streaming state

    try {
      // Convert selectedModels (string IDs) to numeric modelIds
      const modelIds = selectedModels
        .map((id) => {
          const model = models.find((m) => m.id === id);
          return model ? parseInt(id, 10) : null;
        })
        .filter((id): id is number => id !== null && !isNaN(id));

      if (modelIds.length === 0) {
        throw new Error("No valid model IDs found");
      }

      const response = await apiFetch(
        MODEL_TEST_ENDPOINT,
        {
          method: "POST",
          body: JSON.stringify({
            modelIds,
            message: prompt,
          }),
        },
        csrfToken,
      );

      if (!response.ok) {
        throw new Error(`Failed to test models: ${response.status}`);
      }

      // Handle SSE streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      const streamingResponses: Record<string, string> = {};

      // Initialize empty responses for each model
      selectedModels.forEach((stringId) => {
        streamingResponses[stringId] = "";
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              const modelIdStr = String(data.modelId);

              switch (currentEventType) {
                case "metadata":
                  // Model metadata received
                  console.log(`Model ${modelIdStr} metadata:`, data);
                  break;

                case "start":
                  // Model started generating
                  streamingResponses[modelIdStr] = "";
                  setStreamingModels((prev) => new Set(prev).add(modelIdStr));
                  setTestResponses({ ...streamingResponses });
                  break;

                case "chunk":
                  // Append streaming chunk
                  if (data.delta) {
                    streamingResponses[modelIdStr] =
                      (streamingResponses[modelIdStr] || "") + data.delta;
                    setTestResponses({ ...streamingResponses });
                  }
                  break;

                case "end":
                  // Model finished streaming
                  setStreamingModels((prev) => {
                    const next = new Set(prev);
                    next.delete(modelIdStr);
                    return next;
                  });
                  console.log(`Model ${modelIdStr} finished streaming`);
                  break;

                case "done":
                  // Final response with token usage
                  streamingResponses[modelIdStr] =
                    data.response || streamingResponses[modelIdStr];
                  setTestResponses({ ...streamingResponses });
                  console.log(`Model ${modelIdStr} tokens:`, {
                    input: data.inputTokens,
                    output: data.outputTokens,
                  });
                  break;

                case "error":
                  // Handle error for specific model
                  streamingResponses[modelIdStr] =
                    `Error: ${data.error || "Unknown error"}`;
                  setTestResponses({ ...streamingResponses });
                  break;

                case "complete":
                  // All models completed
                  console.log("All models completed");
                  break;
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete data
              console.warn("Failed to parse SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error testing models:", error);
      // Set error message for all models
      const errorResponses: Record<string, string> = {};
      selectedModels.forEach((modelId) => {
        errorResponses[modelId] = "Error: Failed to get response";
      });
      setTestResponses(errorResponses);
    } finally {
      setIsTesting(false);
    }
  };

  // Handle selecting a model from compare results
  const handleSelectModel = (modelId: string) => {
    // Find the full AIModel data
    const fullModel = fullModels.find(
      (m) => String(m.modelId || m.id) === modelId,
    );

    if (fullModel && onModelSelect) {
      onModelSelect(fullModel);
      // Parent will handle closing and confirmation if needed
    }
  };

  // Main render - Compare Results
  if (showResults) {
    // Responsive column width for 2 or 3 models
    let columnWidth = 312;
    let columnsJustify = "space-between";
    if (selectedModels.length === 2) {
      columnWidth = 471; // fits 2 columns in 1006px with 16px gap and 32px padding (471*2 + 16 + 32 = 990)
      columnsJustify = "center";
    } else if (selectedModels.length === 3) {
      columnWidth = 312; // fits 3 columns in 1006px with 32px gap (16*2) and 32px padding (312*3 + 32 + 32 = 1000)
      columnsJustify = "space-between";
    }
    const headerHeight = 56;
    const footerHeight = 86;
    const verticalPadding = 0;
    const fixedHeight = containerHeight;
    const columnHeight =
      fixedHeight - (headerHeight + footerHeight + verticalPadding);
    const modelsToShow = selectedModels
      .map((id) => models.find((m) => m.id === id))
      .filter((candidate): candidate is CompareModel => Boolean(candidate));
    return (
      // Compare Results Page
      <div className="w-[1006px] max-h-[882px] h-[96vh] bg-transparent rounded-[10px] flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className={styles.header}
          style={{
            height: "auto",
            padding: "16px 20px 4px 20px",
            minHeight: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                marginRight: 8,
              }}
              onClick={() => setShowResults(false)}
              aria-label="Back"
            >
              <ArrowLeft size={20} color="#171717" />
            </button>
            <div>
              <div
                style={{
                  fontFamily: "Clash Grotesk Variable",
                  fontWeight: 400,
                  fontSize: 24,
                  lineHeight: "120%",
                  letterSpacing: "-0.02em",
                }}
              >
                Compare results
              </div>
              <div
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 400,
                  fontSize: 14,
                  lineHeight: "140%",
                  letterSpacing: "0%",
                  color: "var(--Text-Default-Secondary, #757575)",
                }}
              >
                Analyze model performance across your test prompts.
              </div>
            </div>
          </div>
          {/* <button
            style={{ background: "none", border: "none", cursor: "pointer" }}
            aria-label="Close"
            onClick={() => setShowResults(false)}
          >
            <CloseIcon size={20} color="#6B7280" />
          </button> */}
        </div>
        {/* Models Comparison Area */}
        <div
          // className="border-4 border-pink-500"
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 16,
            padding: "16px 8px 0px 8px",
            flex: 1,
            alignItems: "stretch",
            justifyContent: columnsJustify,
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {modelsToShow.map((model, idx) => (
            <div
              key={model.id}
              style={{
                width: columnWidth,
                height: "auto",
                flex: 1,
                minHeight: 0,
                borderRadius: 12,
                border: "1px solid #E5E7EB",
                background: "#fff",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: 16,
                boxSizing: "border-box",
                opacity: 1,
                overflow: "hidden",
              }}
            >
              {/* Column Header */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: model.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Image
                    src={model.icon}
                    alt={model.name}
                    width={30}
                    height={30}
                  />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {model.name}
                </div>
                <button
                  onClick={() => handleSelectModel(model.id)}
                  className="cursor-pointer h-[28px] text-[12px] bg-white hover:bg-zinc-100 border border-[#E5E7EB] rounded-[6px] shadow-sm shadow-zinc-300 mt-0 transition-all duration-300"
                >
                  ✓ Select this model
                </button>
              </div>

              {/* Main Body - Response or Empty State */}
              <div
                className={`min-h-0 flex-1 flex flex-col overflow-y-auto overflow-x-auto ${chatStyles.customScrollbar}`}
                style={{
                  alignItems: testResponses[model.id] ? "flex-start" : "center",
                  justifyContent: testResponses[model.id]
                    ? "flex-start"
                    : "center",
                  padding: testResponses[model.id] ? "12px" : "0",
                }}
              >
                {streamingModels.has(model.id) ? (
                  // Currently streaming
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: "1.6",
                      color: "#171717",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      width: "100%",
                    }}
                  >
                    {testResponses[model.id] || ""}
                    <span className={styles.streamingCursor} />
                  </div>
                ) : isTesting && !testResponses[model.id] ? (
                  // Waiting to start
                  <>
                    <Sparkles
                      strokeWidth={1.5}
                      className="w-16 h-16 text-[#D1D5DB] animate-pulse"
                    />
                    <div
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        textAlign: "center",
                        marginTop: 8,
                      }}
                    >
                      Waiting to generate...
                    </div>
                  </>
                ) : testResponses[model.id] ? (
                  // Response complete
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: "1.6",
                      color: "#171717",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      width: "100%",
                    }}
                  >
                    {testResponses[model.id]}
                  </div>
                ) : (
                  // Empty state
                  <>
                    <Sparkles
                      strokeWidth={1.5}
                      className="w-16 h-16 text-[#D1D5DB]"
                    />
                    <div
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        textAlign: "center",
                        marginTop: 8,
                      }}
                    >
                      Run a prompt to see <br /> {model.name}&apos;s <br />{" "}
                      answer here.
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* Prompt Input Area in Footer */}
        <div
          style={{
            width: 1006,
            height: 82,
            padding: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: 756,
              height: 60,
              padding: 12,
              gap: 12,
              borderRadius: 16,
              border: "1px solid var(--general-border, #E5E5E5)",
              background: "var(--general-input, #FFFFFF)",
              boxShadow: "0px 1px 2px 0px #0000000D",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
            }}
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleTestModels();
                }
              }}
              placeholder="Test prompt, anything can go here."
              disabled={isTesting}
              style={{
                height: 36,
                borderRadius: 999,
                padding: "0 16px",
                border: "none",
                flex: 1,
                fontSize: 14,
                outline: "none",
                marginRight: 12,
                background: "#fff",
                opacity: isTesting ? 0.6 : 1,
              }}
            />
            <button
              onClick={handleTestModels}
              disabled={!prompt.trim() || isTesting}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: !prompt.trim() || isTesting ? "#9CA3AF" : "#111827",
                color: "#fff",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: !prompt.trim() || isTesting ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
              aria-label="Send"
            >
              {/* <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                <path
                  d="M3.75 16.25L16.25 10L3.75 3.75V8.75L12.5 10L3.75 11.25V16.25Z"
                  fill="currentColor"
                />
              </svg> */}
              <ArrowUp size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compare & Select
  return (
    <div className="max-w-[1006px] w-[1006px] max-h-[882px] h-[96vh] mx-auto border border-main-border rounded-[10px] opacity-100 flex flex-col">
      {/* Header */}
      <div
        className={styles.header}
        style={{
          height: "auto",
          padding: "16px 20px 4px 20px",
          minHeight: "auto",
        }}
      >
        <span
          className={styles.title}
          style={{
            fontFamily: "Clash Grotesk Variable",
            fontWeight: 400,
            fontSize: 24,
            lineHeight: "120%",
            letterSpacing: "-0.02em",
          }}
        >
          Compare & select
        </span>
        {/* <button className={styles.closeBtn} aria-label="Close">
          <X size={20} />
        </button> */}
      </div>
      {/* Instruction */}
      <div
        className={styles.instruction}
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 400,
          fontSize: 14,
          lineHeight: "140%",
          letterSpacing: "0%",
          color: "var(--Text-Default-Secondary, #757575)",
          marginTop: 0,
          paddingTop: 0,
          height: "auto",
          padding: "0 20px 12px 20px",
          minHeight: "auto",
        }}
      >
        Pick up to 3 models to pit against each other.
      </div>
      {/* Selected Models */}
      <div className={styles.selectedModels}>
        {[0, 1, 2].map((i) => {
          const modelId = selectedModels[i];
          const model = models.find((m) => m.id === modelId);
          return (
            <div
              key={i}
              className={cn(
                styles.modelSlot,
                model
                  ? "border-none!"
                  : "border border-dashed border-[#D9D9D9]",
              )}
            >
              {model ? (
                <div
                  className={cn(
                    "shadow-xs shadow-zinc-300",
                    styles.modelCardSelected,
                  )}
                >
                  <div
                    className={styles.modelIcon}
                    style={{ background: model.iconBg }}
                  >
                    <Image
                      src={model.icon}
                      alt={model.name}
                      width={36}
                      height={36}
                    />
                  </div>
                  <div className={cn(styles.modelInfo, "overflow-hidden")}>
                    <div
                      className={styles.modelName}
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {model.name}
                    </div>
                    <div
                      className={styles.modelMeta}
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {model.meta}
                    </div>
                  </div>
                  <button
                    className={cn(
                      styles.removeBtn,
                      "absolute top-1/2 -translate-y-1/2 right-2",
                    )}
                    onClick={() => handleRemove(model.id)}
                    aria-label="Remove"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <span className={styles.emptySlot}>Empty slot {i + 1}</span>
              )}
            </div>
          );
        })}
      </div>
      {/* Divider */}
      <div className={styles.divider} />
      {/* Available Models Section */}
      <div className={styles.sectionHeader}>Available models</div>
      {/* Category Tabs (Radix Tabs, styled like model-selector-dialog) */}
      <div style={{ padding: "0 20px 12px 20px" }}>
        <div
          className="flex items-center model-category-root"
          style={{
            background: "#F5F5F5",
            width: 299,
            height: 35,
            borderRadius: 10,
            padding: 2,
            justifyContent: "flex-start",
            opacity: 1,
            boxShadow: "none",
            backgroundImage: "none",
            backgroundBlendMode: "normal",
          }}
        >
          <style>{`
            .model-category-root { background-color: #F5F5F5 !important; }
            .model-category-root .model-category-list { background-color: #F5F5F5 !important; box-shadow: none !important; }
            .model-category-root .tab-trigger { background-color: #F5F5F5 !important; border: none !important; box-shadow: none !important; }
            .model-category-root .tab-trigger[data-state="active"], .model-category-root .tab-trigger[aria-selected="true"] { background-color: #FFFFFF !important; border: 1px solid #E5E5E5 !important; }
            .model-category-root .tab-trigger[data-state="inactive"] { background-color: #F5F5F5 !important; border: none !important; }
            .model-category-root .tab-trigger span { background: transparent !important; }
          `}</style>
          <TabsPrimitive.Root value={category} onValueChange={setCategory}>
            <TabsPrimitive.List
              className="flex h-full p-0 rounded-[10px] model-category-list"
              style={{
                gap: 4,
                backgroundColor: "#F5F5F5",
                padding: 0,
                boxShadow: "none",
                backgroundImage: "none",
              }}
            >
              {CATEGORY_OPTIONS.map(({ key, label, icon }) => (
                <TabsPrimitive.Trigger
                  key={key}
                  value={key}
                  className={`cursor-pointer flex items-center justify-center rounded-[10px] text-sm font-medium transition-colors flex-shrink-0 text-[#171717] tab-trigger`}
                  style={{
                    height: 29,
                    minWidth: 29,
                    minHeight: 29,
                    gap: 4,
                    paddingTop: 1,
                    paddingRight: 5,
                    paddingBottom: 1,
                    paddingLeft: 6,
                    opacity: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    boxSizing: "border-box",
                    backgroundColor: category === key ? "#FFFFFF" : "#F5F5F5",
                    border: category === key ? "1px solid #E5E5E5" : "none",
                    boxShadow:
                      category === key ? "0 0 0 4px rgba(0,0,0,0.04)" : "none",
                    backgroundImage: "none",
                    outline: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    className="flex items-center"
                    style={{
                      width: 20,
                      height: 20,
                      color: "#A3A3A3",
                    }}
                  >
                    {icon}
                  </span>
                  <span
                    style={{
                      marginLeft: 4,
                      color: "#171717",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </span>
                </TabsPrimitive.Trigger>
              ))}
            </TabsPrimitive.List>
          </TabsPrimitive.Root>
        </div>
      </div>
      {/* Models Grid (Scrollable Area) */}
      <div className="flex-1 flex flexcol overflow-hidden">
        <div
          className={cn(
            "min-h-0 max-h-full flex-1 overflow-y-auto px-5 py-0 mb-0",
            chatStyles.customScrollbar,
          )}
        >
          {isLoading ? (
            <div className="relative min-h-80 max-h-full h-full font-inter text-[16px] text-zinc-400 flex-1 flex flex-col items-center justify-center gap-2">
              {/* Grid Skeleton Loader */}
              <div className="w-full absolute top-0 left-0 grid grid-cols-2 gap-3">
                <div className="relative w-full min-h-47 h-45 bg-zinc-200 rounded-[8px] animate-pulse">
                  <div className="absolute max-h-12 top-4 left-4 w-full flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-100 rounded-lg animate-pulse"></div>
                    <div className="w-2/5 h-12 bg-zinc-100 rounded-lg animate-pulse"></div>
                  </div>
                </div>
                <div className="relative w-full min-h-47 h-45 bg-zinc-200 rounded-[8px] animate-pulse">
                  <div className="absolute max-h-12 top-4 left-4 w-full flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-100 rounded-lg animate-pulse"></div>
                    <div className="w-2/5 h-12 bg-zinc-100 rounded-lg animate-pulse"></div>
                  </div>
                </div>
                <div className="relative w-full min-h-47 h-45 bg-zinc-200 rounded-[8px] animate-pulse">
                  <div className="absolute max-h-12 top-4 left-4 w-full flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-100 rounded-lg animate-pulse"></div>
                    <div className="w-2/5 h-12 bg-zinc-100 rounded-lg animate-pulse"></div>
                  </div>
                </div>
                <div className="relative w-full min-h-47 h-45 bg-zinc-200 rounded-[8px] animate-pulse">
                  <div className="absolute max-h-12 top-4 left-4 w-full flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-100 rounded-lg animate-pulse"></div>
                    <div className="w-2/5 h-12 bg-zinc-100 rounded-lg animate-pulse"></div>
                  </div>
                </div>
                <div className="relative w-full min-h-47 h-45 bg-zinc-200 rounded-[8px] animate-pulse">
                  <div className="absolute max-h-12 top-4 left-4 w-full flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-100 rounded-lg animate-pulse"></div>
                    <div className="w-2/5 h-12 bg-zinc-100 rounded-lg animate-pulse"></div>
                  </div>
                </div>
                <div className="relative w-full min-h-47 h-45 bg-zinc-200 rounded-[8px] animate-pulse">
                  <div className="absolute max-h-12 top-4 left-4 w-full flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-100 rounded-lg animate-pulse"></div>
                    <div className="w-2/5 h-12 bg-zinc-100 rounded-lg animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Rotating Loader */}

              <div className="w-full flex flex-col items-center justify-center gap-4">
                {/* <div className="w-20 h-20 border-4 border-transparent text-zinc-400 text-4xl animate-spin flex items-center justify-center border-t-zinc-400 rounded-full">
                  <div className="w-16 h-16 border-4 border-transparent text-zinc-900 text-2xl animate-spin flex items-center justify-center border-t-zinc-900 rounded-full"></div>
                </div> */}
                <h3 className="z-10 absolute top-1/2 left-1/2 -translate-1/2 font-medium text-sm text-[#0A0A0A] bg-white/30 backdrop-blur-[2px] border border-main-border rounded p-2 animate-pulse">
                  Loading Models...
                </h3>
              </div>
            </div>
          ) : filteredModels.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "400px",
                fontSize: "14px",
                color: "#6B7280",
              }}
            >
              No models available
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                rowGap: 16,
                columnGap: 16,
              }}
            >
              {filteredModels.map((model) => {
                const isSelected = selectedModels.includes(model.id);
                const isDisabled = selectedModels.length >= 3 && !isSelected;
                return (
                  <div
                    key={model.id}
                    onClick={() => !isDisabled && handleSelect(model)}
                    onMouseEnter={() => setHoveredModel(model.id)}
                    onMouseLeave={() => setHoveredModel(null)}
                    style={{
                      width: 470,
                      height: 176,
                      borderRadius: 8,
                      border: isSelected
                        ? "1px solid #0A0A0A"
                        : "1px solid #E5E7EB",
                      display: "flex",
                      gap: 16,
                      padding: 16,
                      background: isSelected
                        ? "#F3F4F6"
                        : hoveredModel === model.id && !isDisabled
                          ? "#F5F5F5"
                          : "#fff",
                      alignItems: "flex-start",
                      opacity: isDisabled ? 0.5 : 1,
                      boxSizing: "border-box",
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      transition: "background 0.2s, border 0.2s, opacity 0.2s",
                      position: "relative",
                    }}
                  >
                    {isSelected && (
                      <CircleCheckBig
                        size={20}
                        style={{
                          position: "absolute",
                          top: 16,
                          right: 16,
                          color: "#0A0A0A",
                        }}
                      />
                    )}
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: model.iconBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 8,
                      }}
                    >
                      <Image
                        src={model.icon}
                        alt={model.name}
                        width={30}
                        height={30}
                      />
                    </div>
                    <div
                      style={{
                        width: 390,
                        height: 148,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        {model.name.includes(" / ") ? (
                          <>
                            <span style={{ color: "#9CA3AF" }}>
                              {model.name.split(" / ")[0]}
                            </span>
                            <span style={{ color: "#111827" }}>
                              {" "}
                              / {model.name.split(" / ")[1]}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: "#111827" }}>{model.name}</span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6B7280",
                          lineHeight: "1.5",
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {model.description}
                      </div>
                      <div
                        style={{
                          width: 390,
                          height: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          lineHeight: "140%",
                          letterSpacing: "0%",
                          marginTop: "auto",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {model.meta.includes(" / ") ? (
                          <>
                            <span style={{ color: "#111827" }}>
                              {model.meta.split(" / ")[0]}
                            </span>
                            <span style={{ color: "#9CA3AF" }}>
                              {" "}
                              / {model.meta.split(" / ")[1]}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: "#111827" }}>{model.meta}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* Footer */}
      <div
        style={{
          width: "100%",
          height: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 16,
          borderTop: "1px solid #E5E7EB",
          boxSizing: "border-box",
          background: "#fff",
        }}
      >
        <span style={{ fontSize: 12, color: "#6B7280" }}>
          {selectedModels.length} of 3 models selected
        </span>
        <button
          className={cn(
            "h-9 font-geist font-medium! text-[14px] border-0 rounded-[8px] flex items-center gap-2 px-4 py-0",
            styles.primaryBtn,
          )}
          disabled={selectedModels.length === 0}
          style={{
            background:
              selectedModels.length >= 2
                ? "var(--general-primary, #171717)"
                : "var(--general-primary, #171717)",
            color: selectedModels.length >= 2 ? "#fff" : "#9CA3AF",
            cursor: selectedModels.length >= 2 ? "pointer" : "not-allowed",
            transition: "background 0.2s, color 0.2s",
          }}
          onClick={() => selectedModels.length >= 2 && setShowResults(true)}
        >
          Test models
          <ArrowRight strokeWidth={2.5} size={14} />
        </button>
      </div>
    </div>
  );
}
