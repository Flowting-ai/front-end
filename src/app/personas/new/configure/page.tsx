"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Info,
  Undo2,
  Redo2,
  Sparkles,
  Upload,
  Share2,
  Check,
  Loader2,
  Pencil,
  X,
  ChevronUp,
  ChevronLeft,
  FileText,
  Rocket,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getModelIcon } from "@/lib/model-icons";
import chatStyles from "@/components/chat/chat-interface.module.css";
import styles from "./persona-configure.module.css";
import { ChatInterface } from "@/components/chat/chat-interface";
import type { Message } from "@/components/chat/chat-message";
import type { AIModel } from "@/types/ai-model";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Import hooks and utilities
import { useFileUpload } from "./hooks/use-file-upload";
import { useRefinement } from "./hooks/use-refinement";
import { useInstructionHistory } from "./hooks/use-instruction-history";
import { useEnhancement } from "./hooks/use-enhancement";
import {
  TONE_OPTIONS,
  DEFAULT_TEMPERATURE,
  MIN_TEMPERATURE,
  MAX_TEMPERATURE,
  TEMPERATURE_STEP,
  ACCEPTED_FILE_TYPES,
} from "./constants";
import { normalizeModels } from "@/lib/ai-models";
import { MODELS_ENDPOINT } from "@/lib/config";
import { REFINEMENT_STEPS } from "./types";
import { dataUrlToFile } from "./utils";
import { createPersona, fetchPersonaById, PERSONA_TEST_STREAM_ENDPOINT } from "@/lib/api/personas";
import { useAuth } from "@/context/auth-context";

function PersonaConfigurePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Basic state
  const [personaName, setPersonaName] = useState("Persona name");
  const [selectedModel, setSelectedModel] = useState("");
  const [temperature, setTemperature] = useState([DEFAULT_TEMPERATURE]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [createdPersonaId, setCreatedPersonaId] = useState<string | null>(null);
  const [isChatMode, setIsChatMode] = useState(false);
  const [testStreamMessage, setTestStreamMessage] = useState("");
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [hasFinishedBuilding, setHasFinishedBuilding] = useState(false);
  const { csrfToken } = useAuth();

  // Custom hooks
  const { uploadedFiles, handleFileUpload, removeFile } = useFileUpload();

  const { currentInstruction, canUndo, canRedo, setInstruction, undo, redo } =
    useInstructionHistory("");

  const {
    isEnhancing,
    hasEnhancedContent,
    originalInstruction,
    enhance,
    reset: resetEnhancement,
  } = useEnhancement();

  // Track scroll state for showing scrollbar when content is scrolled
  const textareaContentRef = useRef<HTMLDivElement | null>(null);
  const [isTextareaScrolled, setIsTextareaScrolled] = useState(false);
  useEffect(() => {
    const el = textareaContentRef.current;
    if (!el) return;
    const onScroll = () => {
      setIsTextareaScrolled(el.scrollTop > 0);
    };
    // Initialize state based on current position
    onScroll();
    el.addEventListener("scroll", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  const {
    currentStep,
    selectedTone,
    customToneInput,
    showCustomInput,
    dosText,
    dontsText,
    selectedDos,
    selectedDonts,
    suggestedDos,
    suggestedDonts,
    setCurrentStep,
    setDosText,
    setDontsText,
    setSelectedToneDirect,
    setSuggestedDos,
    setSuggestedDonts,
    handleToneSelect,
    handleCustomToneChange,
    handleCustomToneSubmit,
    handleDosToggle,
    handleDontsToggle,
    handleSkip,
    reset: resetRefinement,
  } = useRefinement(hasEnhancedContent);

  // Check if persona is ready to be saved
  const isPersonaReady = useMemo(() => {
    const ready =
      personaName.trim() !== "" &&
      personaName.trim() !== "Persona name" &&
      selectedModel !== "" &&
      currentInstruction.trim() !== "";
    console.log("isPersonaReady check:", {
      personaName: personaName.trim(),
      selectedModel,
      instructionLength: currentInstruction.trim().length,
      ready,
    });
    return ready;
  }, [personaName, selectedModel, currentInstruction]);

  // Calculate progress dots (7 total)
  const progressSteps = useMemo(() => {
    let completed = 0;

    // Step 1: Persona name entered
    if (personaName.trim() !== "" && personaName.trim() !== "Persona name") {
      completed++;
    }

    // Step 2: Model selected
    if (selectedModel !== "") {
      completed++;
    }

    // Step 3: Instruction entered
    if (currentInstruction.trim() !== "") {
      completed++;
    }

    // Step 4: Temperature adjusted (default is 1, so check if it's different)
    if (temperature[0] !== DEFAULT_TEMPERATURE) {
      completed++;
    }

    // Step 5: Tone selected
    if (selectedTone !== "") {
      completed++;
    }

    // Step 6: At least one Do added
    if (selectedDos.length > 0) {
      completed++;
    }

    // Step 7: PDF uploaded
    if (uploadedFiles.some((f) => f.type === "pdf")) {
      completed++;
    }

    return completed;
  }, [
    personaName,
    selectedModel,
    currentInstruction,
    temperature,
    selectedTone,
    selectedDos,
    uploadedFiles,
  ]);

  // Get persona name and ID from URL params
  useEffect(() => {
    const nameParam = searchParams.get("name");
    const personaIdParam = searchParams.get("personaId");
    const chatModeParam = searchParams.get("chatMode");

    // Load avatar from sessionStorage
    const savedAvatar = sessionStorage.getItem("personaAvatar");
    if (savedAvatar) {
      setAvatarUrl(savedAvatar);
    }

    if (nameParam) {
      setPersonaName(nameParam);
    }

    // Enable chat mode if chatMode=true is in URL
    if (chatModeParam === "true") {
      setIsChatMode(true);
      setIsTesting(true);
    }

    // Load existing persona data if personaId is provided
    if (personaIdParam) {
      setCreatedPersonaId(personaIdParam);

      const loadPersonaData = async () => {
        try {
          const personaData = await fetchPersonaById(personaIdParam, csrfToken);

          // Populate fields with existing data
          setPersonaName(personaData.name);
          setInstruction(personaData.prompt);

          // Set model if available
          if (personaData.modelId) {
            setSelectedModel(String(personaData.modelId));
          }

          // Set avatar if available
          if (personaData.imageUrl) {
            setAvatarUrl(personaData.imageUrl);
          }

          console.log("Loaded persona:", personaData);
        } catch (error) {
          console.error("Failed to load persona:", error);
          toast.error("Failed to load persona data");
        }
      };

      loadPersonaData();
    }
  }, [searchParams, csrfToken]);

  // Load models from backend (reuse chat model list)
  useEffect(() => {
    const loadModels = async () => {
      // Try cache first
      const cached = sessionStorage.getItem("aiModels");
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as AIModel[];
          setModels(parsed);
        } catch {
          // ignore parse errors
        }
      }

      if (models.length > 0) return;

      setIsLoadingModels(true);
      try {
        const response = await fetch(MODELS_ENDPOINT, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          const normalized = normalizeModels(data);
          setModels(normalized);
          sessionStorage.setItem("aiModels", JSON.stringify(normalized));
        } else {
          console.warn("Failed to fetch models for persona configure", response.status);
        }
      } catch (error) {
        console.warn("Error fetching models for persona configure", error);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModels();
  }, [models.length]);

  const resolvedSelectedModel = useMemo<AIModel | null>(() => {
    if (!selectedModel) return null;
    const match = models.find(
      (m) =>
        String(m.modelId ?? m.id ?? m.modelName) === selectedModel ||
        `${m.companyName}: ${m.modelName}` === selectedModel
    );
    return match || null;
  }, [models, selectedModel]);

  // Update preview model when a model is selected
  const previewModel = resolvedSelectedModel;

  // Handle instruction changes
  const handleInstructionChange = (value: string) => {
    setInstruction(value);
    if (hasEnhancedContent) {
      resetEnhancement();
      resetRefinement();
    }
  };

  // Handle enhancement
  const handleEnhance = async () => {
    try {
      const analysis = await enhance(currentInstruction, csrfToken);

      if (analysis.summary) {
        setInstruction(analysis.summary);
      }
      if (analysis.tone) {
        setSelectedToneDirect(analysis.tone);
        setCurrentStep(REFINEMENT_STEPS.DOS);
      }
      if (analysis.dos && analysis.dos.length > 0) {
        setSuggestedDos(analysis.dos);
        setDosText(analysis.dos.join(", "));
        setCurrentStep(REFINEMENT_STEPS.DONTS);
      }
      if (analysis.donts && analysis.donts.length > 0) {
        setSuggestedDonts(analysis.donts);
        setDontsText(analysis.donts.join(", "));
      }
    } catch (error) {
      // Error is already handled in the hook
      console.error("Enhancement failed:", error);
    }
  };

  // Handle edit manually
  const handleEditManually = () => {
    resetEnhancement();
    resetRefinement();
  };

  // Handle skip with history management
  const handleSkipWithHistory = () => {
    if (currentStep === REFINEMENT_STEPS.DONTS) {
      // If skipping the last step, revert to original instruction
      setInstruction(originalInstruction);
      resetEnhancement();
      resetRefinement();
    } else {
      handleSkip();
    }
  };

  // Action handlers
  const handleShare = () => {
    // TODO: Implement share functionality
    console.log("Share clicked");
  };

  const handleSaveToTest = async () => {
    if (!isPersonaReady) return;

    setIsSaving(true);
    try {
      // Collect all persona data for testing
      const personaData = {
        name: personaName,
        model: selectedModel,
        systemInstruction: currentInstruction,
        temperature: temperature[0],
        knowledgeFiles: uploadedFiles.map((f) => ({
          id: f.id,
          name: f.name,
          url: f.url,
          type: f.type,
        })),
        tone: selectedTone,
        dos: [...selectedDos, dosText].filter(Boolean),
        donts: [...selectedDonts, dontsText].filter(Boolean),
      };

      console.log("Saving persona for testing:", personaData);

      // Enable testing mode
      setIsTesting(true);

      toast("Ready to test", {
        description: "You can now test your persona in the chat!",
      });
    } catch (error) {
      console.error("Error preparing persona for testing:", error);
      toast.error("Error", {
        description: "Failed to prepare persona. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishBuilding = async () => {
    if (!isPersonaReady) return;

    setIsSaving(true);
    try {
      // Get image file: prefer uploaded file, fallback to avatar from sessionStorage
      let imageFile = uploadedFiles.find((f) => f.type === "image")?.file;

      // If no uploaded image but we have avatarUrl (data URL from /personas/new page)
      if (!imageFile && avatarUrl && avatarUrl.startsWith("data:")) {
        imageFile = dataUrlToFile(avatarUrl, "persona-avatar.png") ?? undefined;
      }

      const personaPayload = {
        name: personaName.trim(),
        prompt: currentInstruction.trim(),
        modelId:
          resolvedSelectedModel?.modelId ??
          resolvedSelectedModel?.id ??
          (Number.isFinite(Number(selectedModel)) ? Number(selectedModel) : null),
        status: "test" as const,
        image: imageFile,
      };

      const created = await createPersona(personaPayload, csrfToken);

      setCreatedPersonaId(created.id);
      setHasFinishedBuilding(true);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("Failed to save persona:", error);
      toast.error("Error", {
        description: "Failed to save persona. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    // If editing an existing persona (has personaId) or in chat mode, go back to personaAdmin
    const personaId = searchParams.get("personaId");
    const chatMode = searchParams.get("chatMode");

    if (hasFinishedBuilding || personaId || chatMode === "true" || isChatMode) {
      router.push("/personaAdmin");
    } else {
      router.push("/personas/new");
    }
  };

  // Get selected model for display
  const selectedModelData = resolvedSelectedModel;

  return (
    <AppLayout>
      <>
        {/* isChatMode */}
        {isChatMode ? (
          // Chat Mode View
          <div className="flex flex-col h-full items-center py-4">
            {/* Top Action Bar */}
            <div className="max-w-[1072px] w-full flex items-center justify-between mb-4">
              <Button
                onClick={() => {
                  // If coming from personaAdmin (has personaId), go back to dashboard
                  const personaId = searchParams.get("personaId");
                  if (personaId) {
                    router.push("/personaAdmin");
                  } else {
                    setIsChatMode(false);
                  }
                }}
                className="flex items-center gap-2 h-9 px-4 bg-black text-white hover:bg-gray-900 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
                {searchParams.get("personaId") ? "Back to Dashboard" : "Back to Edit"}
              </Button>

              <Button
                onClick={() => setShowShareDialog(true)}
                variant="outline"
                className="flex items-center gap-2 h-9 px-4 rounded-lg border-main-border text-black hover:text-gray-900"
                style={{ color: "#000000" }}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>

            {/* Chat Container */}
            <div
              style={{
                width: "1072px",
                maxWidth: "1072px",
                minWidth: "1072px",
                height: "793px",
                borderRadius: "30px",
                padding: "12px",
                borderWidth: "1px",
                backgroundColor: "#FFFFFF",
                borderColor: "#D9D9D9",
                boxShadow: "0px 2px 4px 0px #19213D14",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <ChatInterface
                messages={chatMessages}
                setMessages={setChatMessages}
                selectedModel={previewModel}
                hidePersonaButton={true}
                hideAttachButton={true}
                personaTestConfig={{
                  personaId: createdPersonaId ?? undefined,
                  prompt: currentInstruction,
                  modelId:
                    previewModel?.modelId ??
                    previewModel?.id ??
                    (Number.isFinite(Number(selectedModel))
                      ? Number(selectedModel)
                      : null),
                }}
                customEmptyState={
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="relative w-[146px] h-[146px]">
                      <div
                        className="absolute top-1/2 left-1/2 -translate-1/2"
                        style={{
                          width: "81px",
                          height: "81px",
                          borderRadius: "50%",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#FFFFFF",
                        }}
                      >
                        <Image
                          src={
                            avatarUrl ||
                            uploadedFiles.find((f) => f.type === "image")
                              ?.url ||
                            "/avatars/personaAvatarPlaceHolder.svg"
                          }
                          alt="Persona"
                          width={81}
                          height={81}
                          className="rounded-full border-2 border-main-border"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      </div>
                      {Array.from({ length: 7 }).map((_, index) => {
                        const angle = (index / 7) * 360;
                        const radian = (angle * Math.PI) / 180;
                        const radius = 54;
                        const x = Math.cos(radian) * radius;
                        const y = Math.sin(radian) * radius;
                        return (
                          <div
                            key={index}
                            className="-rotate-90 absolute top-1/2 left-1/2 -translate-1/2 h-2 w-2 rounded-full bg-[#009951]"
                            style={{
                              transform: `translate(${x}px, ${y}px)`,
                            }}
                          />
                        );
                      })}
                    </div>

                    <div className="text-center">
                      <p className="text-sm font-medium text-[#1E1E1E]">
                        <span className="font-clash font-medium text-[29px]">
                          {personaName}
                        </span>
                        <br /> is ready!
                      </p>
                      <p className="font-normal text-[14px] text-[#333333] mt-1">
                        Start chatting to test your persona
                      </p>
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        ) : (
          // Edit Mode View
          <div
            className={cn(
              chatStyles.customScrollbar,
              "flex items-start justify-center overflow-y-auto",
            )}
          >
            <div className={cn("max-w-[1072px] py-4")}>
              <div className={styles.contentWrapper}>
                <div className={styles.mainContent}>
                  {/* Left Panel - Configuration */}
                  <div className={styles.leftPanel}>
                    {/* Header Row with Back and Actions - Left */}
                    <div className={styles.headerRow}>
                      <div className={styles.headerLeft}>
                        <Button
                          variant="outline"
                          onClick={() => router.push(hasFinishedBuilding ? "/personas" : "/personas/new")}
                          className={styles.backButton}
                        >
                          <ArrowLeft className="h-4 w-4" />
                          {hasFinishedBuilding ? "Go to home" : "Back"}
                        </Button>
                      </div>
                      <div className={styles.headerActions}>
                        {/* <Button
                      variant="outline"
                      onClick={handleShare}
                      className={styles.shareButton}
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button> */}
                      </div>
                    </div>
                    {/* Persona Name Row (aligns with chat column start) */}
                    <h2 className={styles.personaNameTitle}>{personaName}</h2>
                    {/* Model Selector */}
                    <div className={styles.fieldGroup}>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="model" className={styles.label}>
                          Model
                        </Label>
                        <Info className="h-4 w-4 text-[#000000]" />
                      </div>

                      <Select
                        value={selectedModel}
                        onValueChange={setSelectedModel}
                        disabled={isLoadingModels}
                      >
                        <SelectTrigger
                          id="model"
                          className={styles.selectTrigger}
                        >
                          <SelectValue placeholder="Select Model">
                            <div className={styles.modelSelectorContent}>
                              <div className={styles.modelSelectorLeft}>
                                {selectedModelData ? (
                                  <div className="px-2 flex items-center gap-2">
                                    <Image
                                      src={getModelIcon(
                                        selectedModelData.companyName,
                                        selectedModelData.modelName,
                                      )}
                                      alt={selectedModelData.companyName || "Model icon"}
                                      width={20}
                                      height={20}
                                      className={styles.modelIcon}
                                    />
                                    <span>{selectedModelData.modelName}</span>
                                  </div>
                                ) : (
                                  <span className={cn(styles.placeholderText)}>
                                    {isLoadingModels ? "Loading models..." : "Select Model"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className={styles.selectContent}>
                          {models.length === 0 && (
                            <div className="px-3 py-2 text-sm text-[#6B7280]">
                              {isLoadingModels ? "Loading..." : "No models available"}
                            </div>
                          )}
                          {models.map((model) => {
                            const value = String(
                              model.modelId ?? model.id ?? model.modelName
                            );
                            return (
                              <SelectItem
                                key={value}
                                value={value}
                                className={styles.selectItem}
                              >
                                <div className={styles.modelOption}>
                                  <Image
                                    src={getModelIcon(
                                      model.companyName,
                                      model.modelName
                                    )}
                                    alt={model.companyName || "Model"}
                                    width={20}
                                    height={20}
                                    className={styles.modelOptionIcon}
                                  />
                                  <span>{model.modelName}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* System Instruction */}
                    <div className={styles.fieldGroup}>
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor="system-instruction"
                          className={styles.label}
                        >
                          System Instruction
                        </Label>
                        <Info className="h-4 w-4 text-[#000000]" />
                      </div>
                      <div
                        className={cn(
                          styles.textareaWrapper,
                          chatStyles.customScrollbar,
                        )}
                      >
                        <div className={styles.textareaContainer}>
                          <div
                            ref={textareaContentRef}
                            className={cn(
                              styles.textareaContentWrapper,
                              isTextareaScrolled && styles.textareaScrolled,
                              chatStyles.customScrollbar,
                            )}
                          >
                            <Textarea
                              id="system-instruction"
                              value={currentInstruction}
                              onChange={(e) =>
                                handleInstructionChange(e.target.value)
                              }
                              className={styles.textarea}
                              placeholder="Enter system instructions..."
                            />

                            {/* Refinement Section - Step-by-step flow */}
                            {hasEnhancedContent && (
                              <>
                                {/* Step 1: Tone Selection */}
                                {currentStep === REFINEMENT_STEPS.TONE && (
                                  <div className={styles.refinementSection}>
                                    <h3 className={styles.refinementTitle}>
                                      Let's refine your persona in 1/4 steps
                                    </h3>
                                    <p className={styles.refinementSubtitle}>
                                      We detected a few areas that could be
                                      clearer
                                    </p>
                                    <div
                                      className={styles.toneSelectionContainer}
                                    >
                                      <p className={styles.toneQuestion}>
                                        How should the persona communicate?
                                      </p>
                                      <div className={styles.toneButtons}>
                                        {TONE_OPTIONS.map((tone) => (
                                          <Button
                                            key={tone}
                                            variant="outline"
                                            onClick={() =>
                                              handleToneSelect(tone)
                                            }
                                            className={cn(
                                              styles.toneButton,
                                              selectedTone === tone &&
                                                styles.toneButtonSelected,
                                            )}
                                          >
                                            {tone}
                                          </Button>
                                        ))}
                                        <Button
                                          variant="outline"
                                          onClick={() =>
                                            handleToneSelect("Custom")
                                          }
                                          className={cn(
                                            styles.toneButton,
                                            selectedTone === "Custom" &&
                                              styles.toneButtonSelected,
                                          )}
                                        >
                                          <Pencil className="h-4 w-4" />
                                          Custom
                                        </Button>
                                      </div>
                                      {showCustomInput && (
                                        <div
                                          className={
                                            styles.customToneInputContainer
                                          }
                                        >
                                          <div
                                            className={
                                              styles.customToneInputWrapper
                                            }
                                          >
                                            <Input
                                              type="text"
                                              placeholder="Eg. Supportive"
                                              value={customToneInput}
                                              onChange={(e) =>
                                                handleCustomToneChange(
                                                  e.target.value,
                                                )
                                              }
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  handleCustomToneSubmit();
                                                }
                                              }}
                                              className={styles.customToneInput}
                                            />
                                            <ChevronUp
                                              className={styles.customToneIcon}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Step 2: Dos Section */}
                                {currentStep === REFINEMENT_STEPS.DOS && (
                                  <div className={styles.dosDontsSection}>
                                    <h3 className={styles.refinementTitle}>
                                      Let's refine your persona in 2/4 steps
                                    </h3>
                                    <h4 className={styles.dosDontsTitle}>
                                      Dos (what do you want the persona to
                                      always do?)
                                    </h4>
                                    <Textarea
                                      placeholder="Type your message here."
                                      value={dosText}
                                      onChange={(e) =>
                                        setDosText(e.target.value)
                                      }
                                      className={styles.dosDontsTextarea}
                                      rows={3}
                                    />
                                    {suggestedDos.length > 0 && (
                                      <>
                                        <p className={styles.suggestedTitle}>
                                          Select from Suggested
                                        </p>
                                        <div
                                          className={styles.suggestedButtons}
                                        >
                                          {suggestedDos.map((dos) => (
                                            <Button
                                              key={dos}
                                              variant="outline"
                                              onClick={() =>
                                                handleDosToggle(dos)
                                              }
                                              className={cn(
                                                styles.suggestedButton,
                                                selectedDos.includes(dos) &&
                                                  styles.suggestedButtonSelected,
                                              )}
                                            >
                                              {dos}
                                            </Button>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* Step 3: Don'ts Section */}
                                {currentStep === REFINEMENT_STEPS.DONTS && (
                                  <div className={styles.dosDontsSection}>
                                    <h3 className={styles.refinementTitle}>
                                      Let's refine your persona in 3/4 steps
                                    </h3>
                                    <h4 className={styles.dosDontsTitle}>
                                      Don'ts (what should the persona never do?)
                                    </h4>
                                    <Textarea
                                      placeholder="Type your message here."
                                      value={dontsText}
                                      onChange={(e) =>
                                        setDontsText(e.target.value)
                                      }
                                      className={styles.dosDontsTextarea}
                                      rows={3}
                                    />
                                    {suggestedDonts.length > 0 && (
                                      <>
                                        <p className={styles.suggestedTitle}>
                                          Select from Suggested
                                        </p>
                                        <div
                                          className={styles.suggestedButtons}
                                        >
                                          {suggestedDonts.map((dont) => (
                                            <Button
                                              key={dont}
                                              variant="outline"
                                              onClick={() =>
                                                handleDontsToggle(dont)
                                              }
                                              className={cn(
                                                styles.suggestedButton,
                                                selectedDonts.includes(dont) &&
                                                  styles.suggestedButtonSelected,
                                              )}
                                            >
                                              {dont}
                                            </Button>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </>
                            )}

                            <div className={styles.textareaActions}>
                              <div className={styles.iconButtonGroup}>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={undo}
                                  disabled={!canUndo}
                                  className={styles.iconButton}
                                >
                                  <Undo2
                                    size={18}
                                    strokeWidth={1.5}
                                    className={styles.undoIcon}
                                  />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={redo}
                                  disabled={!canRedo}
                                  className={styles.iconButton}
                                >
                                  <Redo2
                                    size={18}
                                    strokeWidth={1.5}
                                    className={styles.redoIcon}
                                  />
                                </Button>
                              </div>
                              <Button
                                onClick={handleEnhance}
                                disabled={isEnhancing}
                                className={styles.enhanceButton}
                              >
                                {isEnhancing ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Enhancing...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-4 w-4" />
                                    Enhance
                                  </>
                                )}
                              </Button>
                              {hasEnhancedContent && (
                                <>
                                  <Button
                                    variant="outline"
                                    onClick={handleEditManually}
                                    className={styles.editManualButton}
                                  >
                                    Edit Prompt Text Manually
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={handleSkipWithHistory}
                                    className={styles.skipButton}
                                  >
                                    Skip
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Creativity Level */}
                    <div className={styles.fieldGroup}>
                      <div className={styles.sliderHeader}>
                        <Label className={styles.label}>
                          Creativity level (Temperature)
                        </Label>
                        <span
                          className={cn(
                            styles.temperatureValue,
                            styles.sliderLabel,
                          )}
                        >
                          {temperature[0].toFixed(1)}
                        </span>
                      </div>
                      <div className={styles.sliderWrapper}>
                        <Slider
                          value={temperature}
                          onValueChange={setTemperature}
                          min={MIN_TEMPERATURE}
                          max={MAX_TEMPERATURE}
                          step={TEMPERATURE_STEP}
                          className={styles.slider}
                        />
                        <div
                          className={cn(
                            styles.sliderLabels,
                            styles.sliderLabelsStacked,
                          )}
                        >
                          <div className={styles.sliderLabelGroup}>
                            <span className={styles.sliderLabel}>0</span>
                            <span className={styles.sliderLabel}>
                              (Least creative)
                            </span>
                          </div>
                          <div
                            className={cn(
                              styles.sliderLabelGroup,
                              styles.sliderLabelGroupRight,
                            )}
                          >
                            <span className={styles.sliderLabel}>1</span>
                            <span className={styles.sliderLabel}>
                              (Most creative)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Knowledge */}
                    <div className={styles.fieldGroup}>
                      <Label className={styles.label}>Knowledge</Label>
                      <div className={styles.uploadArea}>
                        <input
                          type="file"
                          id="knowledge-upload"
                          multiple
                          accept={ACCEPTED_FILE_TYPES}
                          onChange={handleFileUpload}
                          className={styles.hiddenInput}
                        />
                        <p className={styles.uploadText}>
                          Add files for your persona to reference
                        </p>
                        <Button
                          variant="outline"
                          onClick={() =>
                            document.getElementById("knowledge-upload")?.click()
                          }
                          className={styles.uploadButton}
                        >
                          <Upload className="h-4 w-4" />
                          Upload file
                        </Button>
                      </div>
                      {uploadedFiles.length > 0 && (
                        <div className={styles.uploadedFilesContainer}>
                          {uploadedFiles.map((file) =>
                            file.type === "pdf" ? (
                              <div
                                key={file.id}
                                className={styles.uploadedFileCard}
                              >
                                {file.isUploading && (
                                  <div
                                    className={styles.uploadProgressBar}
                                    style={{
                                      width: `${file.uploadProgress || 0}%`,
                                    }}
                                  />
                                )}
                                <div className={styles.fileIconContainer}>
                                  <FileText className={styles.fileIcon} />
                                </div>
                                <div className={styles.fileInfo}>
                                  <p className={styles.fileName}>{file.name}</p>
                                  <p className={styles.fileType}>
                                    {file.isUploading
                                      ? `Uploading... ${file.uploadProgress || 0}%`
                                      : "PDF Document"}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeFile(file.id)}
                                  className={styles.removeFileButton}
                                >
                                  <X className="h-3 w-3 text-[#666666]" />
                                </button>
                              </div>
                            ) : (
                              <div
                                key={file.id}
                                className={styles.uploadedImageCard}
                              >
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className={styles.uploadedImage}
                                />
                                {file.isUploading && (
                                  <div className={styles.imageUploadOverlay}>
                                    <svg
                                      className={styles.uploadProgressCircle}
                                      viewBox="0 0 36 36"
                                    >
                                      <circle
                                        cx="18"
                                        cy="18"
                                        r="16"
                                        fill="none"
                                        stroke="#22C55E"
                                        strokeWidth="3"
                                        strokeDasharray={`${((file.uploadProgress || 0) * 100.48) / 100}, 100.48`}
                                        strokeLinecap="round"
                                        transform="rotate(-90 18 18)"
                                      />
                                    </svg>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeFile(file.id)}
                                  className={styles.removeFileButton}
                                >
                                  <X className="h-3 w-3 text-[#666666]" />
                                </button>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Panel - Preview & Chat */}
                  <div
                    className={cn(
                      styles.rightPanel,
                      "z-10 sticky top-[15px] min-w-0 max-w-[524px] w-[524px] min-h-[80vh] max-h-[80vh] h-[80vh] flex flex-col flex-start shrink-0 gap-0",
                    )}
                  >
                    {/* Header Row with Back and Actions - Right */}
                    <div className="w-full min-h-[36px] flex items-center justify-end mb-4 bg-white">
                      <Button
                        onClick={handleFinishBuilding}
                        disabled={!isPersonaReady || isSaving}
                        className={cn(
                          styles.saveButton,
                          !isPersonaReady &&
                            "bg-[#D4D4D4] hover:bg-[#D4D4D4] cursor-not-allowed",
                          isPersonaReady && "bg-[#171717] hover:bg-[#000000]",
                        )}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4" />
                            <span className={styles.saveButtonText}>
                              Finish building
                            </span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Preview Card with Chat Interface */}
                    <div className={cn(styles.previewCard)}>
                      <ChatInterface
                        messages={chatMessages}
                        setMessages={setChatMessages}
                        selectedModel={previewModel}
                        hidePersonaButton={true}
                        disableInput={!isTesting}
                        hideAttachButton={true}
                        personaTestConfig={
                          (isTesting || isChatMode)
                            ? {
                                personaId: createdPersonaId ?? undefined,
                                prompt: currentInstruction,
                                modelId:
                                  previewModel?.modelId ??
                                  previewModel?.id ??
                                  (Number.isFinite(Number(selectedModel))
                                    ? Number(selectedModel)
                                    : null),
                              }
                            : undefined
                        }
                        // For persona test: do not share chat history with other boards
                        customEmptyState={
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div
                              className="relative w-[146px] h-[146px]"
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  top: "50%",
                                  left: "50%",
                                  transform: "translate(-50%, -50%)",
                                  width: "81px",
                                  height: "81px",
                                  borderRadius: "50%",
                                  overflow: "hidden",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: "#f5f5f5",
                                }}
                              >
                                <Image
                                  src={
                                    avatarUrl ||
                                    uploadedFiles.find(
                                      (f) => f.type === "image",
                                    )?.url ||
                                    "/avatars/personaAvatarPlaceHolder.svg"
                                  }
                                  alt="Persona"
                                  width={82}
                                  height={82}
                                  className="rounded-full border-2 border-main-border"
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                    display: "block",
                                  }}
                                />
                              </div>
                              {Array.from({ length: 7 }).map((_, index) => {
                                const angle = (index / 7) * 360;
                                const radius = 54;
                                return (
                                  <div
                                    key={index}
                                    className={cn(
                                      "-rotate-90 absolute top-1/2 left-1/2 -translate-1/2 h-2 w-2 rounded-full transition-colors duration-300",
                                      index < progressSteps
                                        ? "bg-[#009951]"
                                        : index === progressSteps && progressSteps < 7
                                        ? "border border-[#009951] bg-transparent"
                                        : "bg-transparent",
                                    )}
                                    style={{
                                      transform: `rotate(${angle}deg) translateX(${radius}px) rotate(-${angle}deg)`,
                                    }}
                                  />
                                );
                              })}
                            </div>

                            <div className="text-center mb-2">
                              <p className={cn("font-clash font-medium text-[29px]", isPersonaReady ? "text-[#1E1E1E]" : "text-zinc-300")}>
                                {personaName}
                              </p>
                              <p className={cn("max-w-[240px] w-[240px] font-normal text-center text-[14px] mt-1", isPersonaReady ? "text-[#333333]" : "text-zinc-300")}>
                                Start chatting to test your persona
                              </p>
                            </div>

                            <Button
                              onClick={handleSaveToTest}
                              disabled={
                                !isPersonaReady || isSaving || isTesting
                              }
                              className={cn(
                                "flex items-center gap-2 rounded-[8px] px-6 py-2.5 text-sm font-medium transition-colors",
                                (!isPersonaReady || isTesting) &&
                                  "bg-[#D4D4D4] hover:bg-[#D4D4D4] cursor-not-allowed text-gray-500",
                                isPersonaReady &&
                                  !isTesting &&
                                  "bg-[#171717] hover:bg-[#000000] text-white",
                              )}
                            >
                              {isSaving ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Saving...
                                </>
                              ) : isTesting ? (
                                <>
                                  <Check className="h-4 w-4" />
                                  Ready to test
                                </>
                              ) : (
                                <>
                                  {isPersonaReady ? (
                                    <Rocket className="h-4 w-4" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                  Save to test
                                </>
                              )}
                            </Button>
                          </div>
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Dialog */}
        <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <DialogContent
            className="border-none p-0 gap-0"
            style={{
              width: "524px",
              maxWidth: "524px",
              borderRadius: "30px",
              padding: "12px",
            }}
          >
            <div
              className="flex flex-col items-center justify-center gap-3 px-6 py-8"
              style={{
                width: "500px",
                minHeight: "371px",
              }}
            >
              {/* Persona Image */}
              <div
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#f5f5f5",
                  marginBottom: "16px",
                }}
              >
                <Image
                  src={
                    avatarUrl ||
                    uploadedFiles.find((f) => f.type === "image")?.url ||
                    "/personas/persona1.png"
                  }
                  alt="Persona"
                  width={82}
                  height={82}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>

              {/* Success Message */}
              <h2
              className="w-[304px]"
                style={{
                  fontFamily: "Clash Grotesk Variable",
                  fontWeight: 500,
                  fontSize: "28.21px",
                  lineHeight: "129%",
                  letterSpacing: "0%",
                  textAlign: "center",
                  color: "#0A0A0A",
                  marginBottom: "8px",
                }}
              >
                Persona &apos;{personaName}&apos; has been created!
              </h2>

              <p
                className="w-[368px] text-center text-sm"
                style={{
                  color: "#666666",
                  maxWidth: "400px",
                  lineHeight: "1.5",
                  marginBottom: "24px",
                }}
              >
                &apos;{personaName}&apos; was created and added to your manager page. Try
                chatting with your persona or share it with your team.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3 w-full px-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSuccessDialog(false);
                    setShowShareDialog(true);
                  }}
                  style={{
                    color: "#0A0A0A",
                  }}
                  className="w-[108px] h-11 rounded-lg border border-[#E5E5E5] bg-white hover:bg-[#F5F5F5] hover:text-[#0A0A0A] font-medium"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button
                  onClick={() => {
                    setShowSuccessDialog(false);
                    router.push("/personaAdmin");
                  }}
                  className="w-[138px] h-11 rounded-lg bg-[#171717] hover:bg-[#000000] text-white font-medium"
                >
                  Go to Personas
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Share Dialog */}
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent
            className="border-none p-2 gap-3"
            style={{
              width: "420px",
              maxWidth: "420px",
              borderRadius: "10px",
              padding: "8px",
            }}
          >
            <div className="flex flex-col gap-3">
              {/* Title with Close Button */}
              <div className="flex items-center justify-between px-1">
                <h3
                  style={{
                    fontFamily: "Clash Grotesk Variable",
                    fontWeight: 400,
                    fontSize: "24px",
                    lineHeight: "120%",
                    letterSpacing: "-2%",
                    color: "#0A0A0A",
                  }}
                >
                  Share &quot;{personaName}&quot;
                </h3>
                {/* <button
                  onClick={() => setShowShareDialog(false)}
                  style={{
                    width: "16px",
                    height: "16px",
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X
                    style={{ width: "16px", height: "16px", color: "#666666" }}
                  />
                </button> */}
              </div>

              {/* Email Input */}
              <div className="w-full min-h-[36px] text-black border border-main-border rounded-[8px] flex items-center gap-2 pl-3">
                <Search size={16} className="text-[#525252]" />
                <Input
                  type="email"
                  placeholder="Enter email for adding people"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && shareEmail.trim()) {
                      toast("User added", {
                        description: `Invitation sent to ${shareEmail}`,
                      });
                      setShareEmail("");
                    }
                  }}
                  className="flex-1 h-full border-none py-[7.5px]"
                />
              </div>

              {/* User List */}
              <div
                className="flex flex-col gap-3"
                style={{
                  width: "404px",
                  height: "196px",
                  overflowY: "auto",
                }}
              >
                {/* Mock user - Owner */}
                <div
                  className="flex items-center justify-between"
                  style={{
                    width: "404px",
                    height: "40px",
                    paddingRight: "8px",
                    paddingLeft: "8px",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        backgroundColor: "#F5F5F5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      <Image
                        src={avatarUrl || "/personas/persona1.png"}
                        alt="User"
                        width={40}
                        height={40}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                    <div className="flex flex-col">
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "12px",
                          lineHeight: "140%",
                          textTransform: "capitalize",
                          color: "#0A0A0A",
                        }}
                      >
                        You
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#666666",
                        }}
                      >
                        your@email.com
                      </span>
                    </div>
                  </div>
                  <div
                    className="rounded-full"
                    style={{
                      width: "86px",
                      height: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#FBEEB1",
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "#B47800",
                    }}
                  >
                    Owner
                  </div>
                </div>

                {/* Mock users - Shared */}
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between"
                    style={{
                      width: "404px",
                      height: "40px",
                      paddingRight: "8px",
                      paddingLeft: "8px",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          backgroundColor: "#E5E5E5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span style={{ fontSize: "14px", color: "#666666" }}>
                          {String.fromCharCode(65 + i)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "12px",
                            lineHeight: "140%",
                            textTransform: "capitalize",
                            color: "#0A0A0A",
                          }}
                        >
                          Team Member {i}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#666666",
                          }}
                        >
                          member{i}@team.com
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        width: "86px",
                        height: "24px",
                        minHeight: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "9999px",
                        backgroundColor: "#EEF2FF",
                        paddingTop: "3px",
                        paddingRight: "2px",
                        paddingBottom: "3px",
                        paddingLeft: "2px",
                        gap: "6px",
                        fontFamily: "Geist",
                        fontSize: "12px",
                        fontWeight: 500,
                        lineHeight: "150%",
                        letterSpacing: "1.5%",
                        textAlign: "center",
                        color: "#4F46E7",
                      }}
                    >
                      Shared
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="font-geist font-medium mr-2 flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setShowShareDialog(false)}
                  style={{
                    fontSize: "14px",
                    color: "#666666",
                    padding: "8px 16px",
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (shareEmail.trim()) {
                      toast("User added", {
                        description: `Invitation sent to ${shareEmail}`,
                      });
                      setShareEmail("");
                    }
                  }}
                  style={{
                    width: "51px",
                    height: "32px",
                    borderRadius: "8px",
                    padding: "5.5px 3px",
                    backgroundColor: "#171717",
                    color: "#FAFAFA",
                    marginTop: "3px",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    </AppLayout>
  );
}

export default function PersonaConfigurePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PersonaConfigurePageContent />
    </Suspense>
  );
}
